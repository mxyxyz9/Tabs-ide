import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  TestingExecutionCaseResult,
  TestingExecutionInput,
  TestingExecutionRun,
  TestingHealingProposal,
} from "@tabs/contracts";

import { runProcess, type ProcessRunResult } from "../processRunner";
import type { StoredGraphEdge, TestingExecutionArtifact, TestingGraphStore } from "./graphStore";
import { shortDigest } from "./security";

export const TESTING_HEAL_CONFIDENCE = 0.9;
export const TESTING_HEAL_MARGIN = 0.1;
export const TESTING_HEAL_ATTEMPT_CAP = 2;

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? 0;
}

function nameSimilarity(left: string, right: string): number {
  const a = normalized(left);
  const b = normalized(right);
  if (a === b) return 1;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length, 1);
}

export function rankHealingCandidates(
  fingerprint: TestingExecutionArtifact["fingerprints"][number],
  edges: ReadonlyArray<StoredGraphEdge>,
): ReadonlyArray<{ readonly edge: StoredGraphEdge; readonly confidence: number }> {
  return edges
    .map((edge) => ({
      edge,
      confidence: Math.min(
        1,
        nameSimilarity(fingerprint.accessibleName, edge.name) * 0.8 +
          (fingerprint.role === edge.role ? 0.2 : 0),
      ),
    }))
    .sort((left, right) => right.confidence - left.confidence);
}

async function findEvidence(root: string, suffix: string): Promise<string | null> {
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        const nested = await findEvidence(path, suffix);
        if (nested) return nested;
      } else if (entry.name.endsWith(suffix)) {
        return path;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function statusFor(result: ProcessRunResult): TestingExecutionCaseResult["status"] {
  if (result.timedOut) return "blocked";
  return result.code === 0 ? "passed" : "failed";
}

export class TestingExecutor {
  readonly #store: TestingGraphStore;
  readonly #testingRoot: string;
  readonly #run: typeof runProcess;

  constructor(store: TestingGraphStore, testingRoot: string, run = runProcess) {
    this.#store = store;
    this.#testingRoot = testingRoot;
    this.#run = run;
  }

  async execute(input: TestingExecutionInput): Promise<TestingExecutionRun> {
    const target = new URL(input.targetUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("Test execution requires an http:// or https:// target URL");
    }
    const job = this.#store.generationJob(input.projectId, input.generationJobId);
    if (!job || job.status !== "completed") throw new Error("Choose a completed generation job");
    const artifacts = this.#store.executionArtifacts(input.generationJobId, input.caseIds);
    if (artifacts.length === 0)
      throw new Error("The selected generation job has no matching cases");
    const artifactRevision = shortDigest(
      artifacts.map((artifact) => `${artifact.caseId}:${artifact.specPath}`).join("|"),
    );
    const runId = crypto.randomUUID();
    const runRoot = join(this.#testingRoot, "executions", runId);
    await mkdir(runRoot, { recursive: true });
    this.#store.beginExecutionRun({
      id: runId,
      projectId: input.projectId,
      generationJobId: input.generationJobId,
      mode: input.mode,
      targetUrl: target.href,
      artifactRevision,
    });
    const startedAt = Date.now();
    const results: TestingExecutionCaseResult[] = [];
    const proposals: Array<Omit<TestingHealingProposal, "id">> = [];
    const outputs: ProcessRunResult[] = [];
    const cliPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../..",
      "node_modules/playwright/cli.js",
    );
    const graph = this.#store.graph(input.projectId);

    for (const artifact of artifacts) {
      const caseOutput = join(runRoot, artifact.caseId);
      await mkdir(caseOutput, { recursive: true });
      const configPath = join(runRoot, `${artifact.caseId}.playwright.config.mjs`);
      await writeFile(
        configPath,
        `export default { testDir: ${JSON.stringify(dirname(artifact.specPath))}, reporter: "line", outputDir: ${JSON.stringify(caseOutput)}, use: { trace: "retain-on-failure", screenshot: ${JSON.stringify(input.visualComparison ? "on" : "only-on-failure")} } };\n`,
        "utf8",
      );
      const caseStartedAt = Date.now();
      const processResult = await this.#run(
        process.execPath,
        [cliPath, "test", basename(artifact.specPath), "--config", configPath, "--workers=1"],
        {
          cwd: dirname(artifact.specPath),
          timeoutMs: (input.timeoutSeconds ?? 120) * 1_000,
          maxBufferBytes: 512 * 1024,
          outputMode: "truncate",
          allowNonZeroExit: true,
          env: { ...process.env, TESTING_BASE_URL: target.href },
        },
      );
      outputs.push(processResult);
      const tracePath = await findEvidence(caseOutput, ".zip");
      const screenshotPath = await findEvidence(caseOutput, ".png");
      const status = statusFor(processResult);
      const history = [
        ...this.#store.comparableCaseStatuses(artifact.caseId, artifactRevision),
        status,
      ].filter((value): value is "passed" | "failed" => value === "passed" || value === "failed");
      const flaky = history.length >= 3 && history.includes("passed") && history.includes("failed");
      let visualStatus: TestingExecutionCaseResult["visualStatus"] = "disabled";
      if (input.visualComparison && screenshotPath) {
        const hash = createHash("sha256")
          .update(await readFile(screenshotPath))
          .digest("hex");
        visualStatus = this.#store.compareVisualBaseline(artifact.caseId, hash, screenshotPath);
      }
      results.push({
        caseId: artifact.caseId,
        externalId: artifact.externalId,
        status,
        durationMs: Date.now() - caseStartedAt,
        error:
          status === "passed" ? null : (processResult.stderr || processResult.stdout).slice(-8_000),
        tracePath,
        screenshotPath,
        flaky,
        quarantined: flaky,
        visualStatus,
      });

      if (
        status === "failed" &&
        /locator|getByRole|element|waiting for/i.test(
          `${processResult.stdout}\n${processResult.stderr}`,
        )
      ) {
        for (const fingerprint of artifact.fingerprints) {
          const ranked = rankHealingCandidates(fingerprint, graph.edges);
          const best = ranked[0];
          if (
            !best ||
            (best.edge.role === fingerprint.role && best.edge.name === fingerprint.accessibleName)
          )
            continue;
          const margin = best.confidence - (ranked[1]?.confidence ?? 0);
          const attempts =
            this.#store.consecutiveHealingAttempts(artifact.caseId, fingerprint.locatorKey) + 1;
          const eligible =
            best.confidence >= TESTING_HEAL_CONFIDENCE &&
            margin >= TESTING_HEAL_MARGIN &&
            attempts <= TESTING_HEAL_ATTEMPT_CAP;
          proposals.push({
            caseId: artifact.caseId,
            locatorKey: fingerprint.locatorKey,
            previousRole: fingerprint.role,
            previousName: fingerprint.accessibleName,
            proposedRole: best.edge.role,
            proposedName: best.edge.name,
            confidence: best.confidence,
            margin,
            diff: `- getByRole(${JSON.stringify(fingerprint.role)}, { name: ${JSON.stringify(fingerprint.accessibleName)} })\n+ getByRole(${JSON.stringify(best.edge.role)}, { name: ${JSON.stringify(best.edge.name)} })`,
            status: eligible ? "pending" : "below-threshold",
            consecutiveAttempts: attempts,
          });
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    const runStatus = results.every((result) => result.status === "passed") ? "passed" : "failed";
    const stdout = outputs
      .map((output) => output.stdout)
      .join("\n")
      .slice(-512 * 1024);
    const stderr = outputs
      .map((output) => output.stderr)
      .join("\n")
      .slice(-512 * 1024);
    this.#store.finishExecutionRun({
      runId,
      status: runStatus,
      durationMs,
      stdout,
      stderr,
      artifactRevision,
      results,
      proposals,
    });
    return this.#store.executionRuns(input.projectId).runs.find((run) => run.id === runId)!;
  }
}
