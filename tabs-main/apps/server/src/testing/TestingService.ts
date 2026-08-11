import { join } from "node:path";

import type {
  TestingAuthStartResult,
  TestingBugDraft,
  TestingBugDraftInput,
  TestingCaseListResult,
  TestingCaseReviewInput,
  TestingClearGraphResult,
  TestingExplorationInput,
  TestingExplorationResult,
  TestingExecutionInput,
  TestingExecutionRun,
  TestingExecutionRunListResult,
  TestingGraphExplorerResult,
  TestingGraphSummary,
  TestingGenerationInput,
  TestingGenerationJob,
  TestingGenerationJobInput,
  TestingGenerationJobListResult,
  TestingHealingDecisionInput,
  TestingProjectInput,
  TestingReport,
  TestingReportInput,
  TestingSchedule,
  TestingScheduleInput,
  TestingScheduleListResult,
  TestingTargetInput,
  TestingTraceabilityInput,
  TestingTraceabilityResult,
  TestingTriageInput,
  TestingTriageResult,
  TestingWorkbookImportInput,
  TestingWorkbookImportResult,
} from "@tabs/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { TextGenerationShape } from "../textGeneration/TextGeneration";

import { TestingCrawler } from "./crawler";
import { TestingGraphStore } from "./graphStore";
import { TestingGenerator } from "./generator";
import { TestingExecutor } from "./execution";
import { createPlaywrightMcpSession, type PlaywrightMcpSession } from "./playwrightMcp";
import { TestingReporter } from "./reporting";
import {
  reconcileWorkbookCase,
  scenariosFromGraph,
  verifyReconciledCaseLive,
} from "./reconciliation";
import { shortDigest, tokenizePii } from "./security";
import { parseTestingWorkbook } from "./workbookParser";

interface AuthCapture {
  readonly session: PlaywrightMcpSession;
  readonly profilePath: string;
}

const FailureTriage = Schema.Struct({
  classification: Schema.Literals(["application-regression", "test-update", "uncertain"]),
  observedFacts: Schema.Array(Schema.String),
  inference: Schema.String,
  recommendation: Schema.String,
});

export class TestingService {
  readonly #testingRoot: string;
  readonly #store: TestingGraphStore;
  readonly #authCaptures = new Map<string, AuthCapture>();
  readonly #runningCrawls = new Set<string>();
  readonly #generator: TestingGenerator | null;
  readonly #executor: TestingExecutor;
  readonly #reporter: TestingReporter;
  readonly #textGeneration: TextGenerationShape | null;

  constructor(stateDirectory: string, textGeneration?: TextGenerationShape) {
    this.#testingRoot = join(stateDirectory, "testing");
    this.#store = new TestingGraphStore(join(this.#testingRoot, "state-graph.sqlite"));
    this.#generator = textGeneration
      ? new TestingGenerator(this.#store, this.#testingRoot, textGeneration)
      : null;
    this.#textGeneration = textGeneration ?? null;
    this.#executor = new TestingExecutor(this.#store, this.#testingRoot);
    this.#reporter = new TestingReporter(this.#store, this.#testingRoot);
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

  generateTests(input: TestingGenerationInput): Promise<TestingGenerationJob> {
    if (!this.#generator) {
      throw new Error("No configured coding-agent text-generation backend is available");
    }
    return this.#generator.generate(input);
  }

  listGenerationJobs(input: TestingProjectInput): TestingGenerationJobListResult {
    return this.#store.listGenerationJobs(input.projectId);
  }

  cancelGenerationJob(input: TestingGenerationJobInput): TestingGenerationJob {
    if (!this.#generator) {
      throw new Error("No configured coding-agent text-generation backend is available");
    }
    return this.#generator.cancel(input.projectId, input.jobId);
  }

  runTests(input: TestingExecutionInput): Promise<TestingExecutionRun> {
    return this.#executor.execute(input);
  }

  listExecutionRuns(input: TestingProjectInput): TestingExecutionRunListResult {
    return this.#store.executionRuns(input.projectId);
  }

  decideHealingProposal(input: TestingHealingDecisionInput): TestingExecutionRunListResult {
    return this.#store.decideHealingProposal(input);
  }

  createSchedule(input: TestingScheduleInput): TestingSchedule {
    return this.#store.createSchedule(input);
  }

  listSchedules(input: TestingProjectInput): TestingScheduleListResult {
    return this.#store.listSchedules(input.projectId);
  }

  generateReport(input: TestingReportInput): Promise<TestingReport> {
    return this.#reporter.generate(input);
  }

  getTraceability(input: TestingTraceabilityInput): TestingTraceabilityResult {
    return this.#store.traceability(input.projectId, input.externalId);
  }

  draftBug(input: TestingBugDraftInput): TestingBugDraft {
    const run = this.#store
      .executionRuns(input.projectId)
      .runs.find((item) => item.id === input.runId);
    const result = run?.results.find((item) => item.caseId === input.caseId);
    const testCase = this.#store
      .listCases(input.projectId)
      .cases.find((item) => item.id === input.caseId);
    if (!run || !result || !testCase || result.status !== "failed") {
      throw new Error("A failed execution result is required to draft a bug");
    }
    return {
      title: `${testCase.externalId}: ${testCase.description}`,
      markdown: [
        `# ${testCase.externalId}: ${testCase.description}`,
        "",
        "## Environment",
        `- Target: ${run.targetUrl}`,
        `- Run: ${run.id}`,
        `- Artifact revision: ${run.artifactRevision}`,
        "",
        "## Reproduction steps",
        ...testCase.steps.map((step, index) => `${index + 1}. ${step}`),
        "",
        "## Expected",
        testCase.description,
        "",
        "## Actual",
        result.error ?? "The generated test failed without additional error text.",
        "",
        "## Local evidence",
        `- Trace: ${result.tracePath ?? "Not captured"}`,
        `- Screenshot: ${result.screenshotPath ?? "Not captured"}`,
        "",
        "Draft only - review before filing or transmitting.",
      ].join("\n"),
      localOnly: true,
    };
  }

  getGraphExplorer(input: TestingProjectInput): TestingGraphExplorerResult {
    return this.#store.graphExplorer(input.projectId);
  }

  async triageFailure(input: TestingTriageInput): Promise<TestingTriageResult> {
    if (!this.#textGeneration) throw new Error("No configured coding-agent backend is available");
    const run = this.#store
      .executionRuns(input.projectId)
      .runs.find((item) => item.id === input.runId);
    const result = run?.results.find((item) => item.caseId === input.caseId);
    const testCase = this.#store
      .listCases(input.projectId)
      .cases.find((item) => item.id === input.caseId);
    if (
      !run ||
      run.mode !== "ci" ||
      !result ||
      !testCase ||
      result.status !== "failed" ||
      result.quarantined
    ) {
      throw new Error("Triage requires a non-quarantined failed CI case");
    }
    const raw = [
      `Case: ${testCase.externalId} - ${testCase.description}`,
      `Expected steps: ${testCase.steps.join(" | ")}`,
      `Observed failure: ${result.error ?? "No error text"}`,
      `Artifact revision: ${run.artifactRevision}`,
      "Separate observed facts from inference. Decide whether this is an application regression, a test update, or uncertain.",
    ].join("\n");
    const sanitized = tokenizePii(input.projectId, raw).tokenized.replace(
      /(?:authorization|cookie|password|token)\s*[:=]\s*\S+/gi,
      "$1=<REDACTED>",
    );
    return Effect.runPromise(
      this.#textGeneration.generateStructuredTesting({
        cwd: input.projectPath,
        taskKind: "failure-triage",
        sanitizedPrompt: sanitized,
        outputSchema: FailureTriage,
        modelSelection: input.modelSelection,
        reasoningTier: "high",
        budget: { maxEstimatedTokens: 8_000, maxEstimatedCostUsd: 1 },
      }),
    );
  }
}
