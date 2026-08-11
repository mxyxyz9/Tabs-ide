import { join } from "node:path";

import type {
  TestingAuthStartResult,
  TestingCaseListResult,
  TestingCaseReviewInput,
  TestingClearGraphResult,
  TestingExplorationInput,
  TestingExplorationResult,
  TestingGraphSummary,
  TestingProjectInput,
  TestingTargetInput,
  TestingWorkbookImportInput,
  TestingWorkbookImportResult,
} from "@tabs/contracts";

import { TestingCrawler } from "./crawler";
import { TestingGraphStore } from "./graphStore";
import { createPlaywrightMcpSession, type PlaywrightMcpSession } from "./playwrightMcp";
import {
  reconcileWorkbookCase,
  scenariosFromGraph,
  verifyReconciledCaseLive,
} from "./reconciliation";
import { shortDigest } from "./security";
import { parseTestingWorkbook } from "./workbookParser";

interface AuthCapture {
  readonly session: PlaywrightMcpSession;
  readonly profilePath: string;
}

export class TestingService {
  readonly #testingRoot: string;
  readonly #store: TestingGraphStore;
  readonly #authCaptures = new Map<string, AuthCapture>();
  readonly #runningCrawls = new Set<string>();

  constructor(stateDirectory: string) {
    this.#testingRoot = join(stateDirectory, "testing");
    this.#store = new TestingGraphStore(join(this.#testingRoot, "state-graph.sqlite"));
  }

  close(): void {
    for (const capture of this.#authCaptures.values()) {
      void capture.session.close();
    }
    this.#authCaptures.clear();
    this.#store.close();
  }

  getStatus(input: TestingProjectInput): TestingGraphSummary {
    return this.#store.summary(input.projectId);
  }

  async startAuthCapture(input: TestingTargetInput): Promise<TestingAuthStartResult> {
    if (this.#authCaptures.has(input.projectId)) {
      throw new Error("An authentication capture browser is already open for this project");
    }
    const target = new URL(input.targetUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("Authentication capture requires an http:// or https:// target URL");
    }
    const projectKey = shortDigest(input.projectId);
    const profilePath = join(this.#testingRoot, "auth", projectKey);
    const session = await createPlaywrightMcpSession({
      profilePath,
      outputPath: join(this.#testingRoot, "mcp-output", `auth-${projectKey}`),
      headless: false,
    });
    await session.call("browser_navigate", { url: target.href });
    this.#authCaptures.set(input.projectId, { session, profilePath });
    return { started: true, profilePath };
  }

  async finishAuthCapture(input: TestingProjectInput): Promise<TestingGraphSummary> {
    const capture = this.#authCaptures.get(input.projectId);
    if (!capture) {
      throw new Error("No authentication capture browser is open for this project");
    }
    this.#authCaptures.delete(input.projectId);
    await capture.session.close();
    this.#store.recordAuthSession(input.projectId, capture.profilePath);
    return this.#store.summary(input.projectId);
  }

  async startExploration(input: TestingExplorationInput): Promise<TestingExplorationResult> {
    if (this.#runningCrawls.has(input.projectId)) {
      throw new Error("An exploration is already running for this project");
    }
    if (this.#authCaptures.has(input.projectId)) {
      throw new Error("Finish authentication capture before starting exploration");
    }
    this.#runningCrawls.add(input.projectId);
    try {
      return await new TestingCrawler(this.#store, this.#testingRoot).explore(input);
    } finally {
      this.#runningCrawls.delete(input.projectId);
    }
  }

  async importWorkbook(input: TestingWorkbookImportInput): Promise<TestingWorkbookImportResult> {
    const parsed = await parseTestingWorkbook(input.workbookPath);
    const graph = this.#store.graph(input.projectId);
    if (graph.nodes.length === 0) {
      throw new Error("Explore the target application before reconciling an Excel workbook");
    }
    const targetUrl = input.targetUrl ?? this.#store.summary(input.projectId).targetUrl;
    if (!targetUrl) throw new Error("A live target URL is required for reconciliation");
    const reconciled = [];
    for (const parsedCase of parsed.cases) {
      const graphMatch = reconcileWorkbookCase(parsedCase, graph);
      reconciled.push(
        await verifyReconciledCaseLive({
          projectId: input.projectId,
          targetUrl,
          ...(input.cdpEndpoint ? { cdpEndpoint: input.cdpEndpoint } : {}),
          testingRoot: this.#testingRoot,
          store: this.#store,
          reconciled: graphMatch,
        }),
      );
    }
    return this.#store.saveImportedCases({
      projectId: input.projectId,
      workbookName: parsed.workbookName,
      workbookPath: input.workbookPath,
      cases: reconciled,
    });
  }

  listCases(input: TestingProjectInput): TestingCaseListResult {
    return this.#store.listCases(input.projectId);
  }

  reviewCase(input: TestingCaseReviewInput): TestingCaseListResult {
    return this.#store.reviewCase(input);
  }

  generateScenarios(input: TestingProjectInput): TestingCaseListResult {
    const graph = this.#store.graph(input.projectId);
    const scenarios = scenariosFromGraph(graph);
    if (scenarios.length === 0) {
      throw new Error("Explore the target application before generating discovered scenarios");
    }
    return this.#store.saveGeneratedCases(input.projectId, scenarios);
  }

  clearGraph(input: TestingProjectInput): TestingClearGraphResult {
    if (this.#runningCrawls.has(input.projectId)) {
      throw new Error("Wait for the active exploration to finish before clearing its graph");
    }
    return this.#store.clearGraph(input.projectId);
  }
}
