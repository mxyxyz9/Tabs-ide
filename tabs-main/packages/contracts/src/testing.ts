import * as Schema from "effect/Schema";
import { ModelSelection } from "./orchestration.ts";

export const TestingProjectInput = Schema.Struct({
  projectId: Schema.String,
});
export type TestingProjectInput = typeof TestingProjectInput.Type;

export const TestingTargetInput = Schema.Struct({
  projectId: Schema.String,
  targetUrl: Schema.String,
});
export type TestingTargetInput = typeof TestingTargetInput.Type;

export const DEFAULT_TESTING_MAX_STATES = 30;
export const MAX_TESTING_MAX_STATES = 10_000;
export const DEFAULT_TESTING_EXPLORATION_SCOPE = "origin";
export const TESTING_EXPLORATION_SCOPES = ["page", "path", "origin"] as const;
export const MAX_TESTING_DURATION_SECONDS = 86_400;

export const TestingExplorationScope = Schema.Literals(TESTING_EXPLORATION_SCOPES);
export type TestingExplorationScope = typeof TestingExplorationScope.Type;

export const TestingExplorationInput = Schema.Struct({
  projectId: Schema.String,
  targetUrl: Schema.String,
  cdpEndpoint: Schema.optionalKey(Schema.String),
  scope: Schema.optionalKey(TestingExplorationScope),
  maxStates: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).check(
      Schema.isLessThanOrEqualTo(MAX_TESTING_MAX_STATES),
    ),
  ),
  maxDurationSeconds: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).check(
      Schema.isLessThanOrEqualTo(MAX_TESTING_DURATION_SECONDS),
    ),
  ),
});
export type TestingExplorationInput = typeof TestingExplorationInput.Type;

export const TestingWorkbookImportInput = Schema.Struct({
  projectId: Schema.String,
  workbookPath: Schema.String,
  targetUrl: Schema.optionalKey(Schema.String),
  cdpEndpoint: Schema.optionalKey(Schema.String),
});
export type TestingWorkbookImportInput = typeof TestingWorkbookImportInput.Type;

export const TestingCaseReviewInput = Schema.Struct({
  projectId: Schema.String,
  caseId: Schema.String,
  decision: Schema.Literals(["accepted", "edited", "rejected"]),
  description: Schema.optionalKey(Schema.String),
  steps: Schema.optionalKey(Schema.Array(Schema.String)),
  notes: Schema.optionalKey(Schema.String),
});
export type TestingCaseReviewInput = typeof TestingCaseReviewInput.Type;

export const DEFAULT_TESTING_BATCH_MAX_CASES = 25;
export const DEFAULT_TESTING_BATCH_MAX_TOKENS = 200_000;
export const DEFAULT_TESTING_BATCH_MAX_COST_USD = 5;

export const TestingGenerationInput = Schema.Struct({
  projectId: Schema.String,
  projectPath: Schema.String,
  caseIds: Schema.optionalKey(Schema.Array(Schema.String)),
  framework: Schema.optionalKey(Schema.Literal("playwright-ts")),
  modelSelection: ModelSelection,
  reasoningTier: Schema.optionalKey(Schema.Literals(["low", "medium", "high"])),
  outputMode: Schema.optionalKey(Schema.Literals(["managed", "repository"])),
  repositoryOutputPath: Schema.optionalKey(Schema.String),
  templatePath: Schema.optionalKey(Schema.String),
  captureReplay: Schema.optionalKey(Schema.Boolean),
  maxCases: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  maxEstimatedTokens: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
  maxEstimatedCostUsd: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))),
});
export type TestingGenerationInput = typeof TestingGenerationInput.Type;

export const TestingGenerationJobInput = Schema.Struct({
  projectId: Schema.String,
  jobId: Schema.String,
});
export type TestingGenerationJobInput = typeof TestingGenerationJobInput.Type;

export const TestingExecutionInput = Schema.Struct({
  projectId: Schema.String,
  generationJobId: Schema.String,
  targetUrl: Schema.String,
  mode: Schema.Literals(["standalone", "ci"]),
  caseIds: Schema.optionalKey(Schema.Array(Schema.String)),
  timeoutSeconds: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).check(Schema.isLessThanOrEqualTo(3_600)),
  ),
  visualComparison: Schema.optionalKey(Schema.Boolean),
});
export type TestingExecutionInput = typeof TestingExecutionInput.Type;

export const TestingExecutionRunInput = Schema.Struct({
  projectId: Schema.String,
  runId: Schema.String,
});
export type TestingExecutionRunInput = typeof TestingExecutionRunInput.Type;

export const TestingHealingDecisionInput = Schema.Struct({
  projectId: Schema.String,
  proposalId: Schema.String,
  decision: Schema.Literals(["accepted", "rejected"]),
});
export type TestingHealingDecisionInput = typeof TestingHealingDecisionInput.Type;

export const TestingScheduleInput = Schema.Struct({
  projectId: Schema.String,
  generationJobId: Schema.String,
  targetUrl: Schema.String,
  timezone: Schema.String,
  runAt: Schema.String,
  recurrence: Schema.optionalKey(Schema.Literals(["none", "daily", "weekly"])),
});
export type TestingScheduleInput = typeof TestingScheduleInput.Type;

export const TestingCaseSource = Schema.Literals(["excel", "generated"]);
export type TestingCaseSource = typeof TestingCaseSource.Type;
export const TestingReconciliationStatus = Schema.Literals(["matches", "needs-review", "blocked"]);
export type TestingReconciliationStatus = typeof TestingReconciliationStatus.Type;
export const TestingReviewDecision = Schema.Literals(["pending", "accepted", "edited", "rejected"]);
export type TestingReviewDecision = typeof TestingReviewDecision.Type;

export interface TestingMismatch {
  readonly stepIndex: number | null;
  readonly expected: string;
  readonly actual: string;
  readonly kind: "parse" | "duplicate" | "unreachable" | "live-verification";
}

export interface TestingCaseSummary {
  readonly id: string;
  readonly externalId: string;
  readonly source: TestingCaseSource;
  readonly description: string;
  readonly steps: ReadonlyArray<string>;
  readonly sourceSheet: string | null;
  readonly sourceRow: number | null;
  readonly status: TestingReconciliationStatus;
  readonly reviewDecision: TestingReviewDecision;
  readonly mismatches: ReadonlyArray<TestingMismatch>;
  readonly matchedStateIds: ReadonlyArray<string>;
  readonly standaloneStatus: "passed" | "failed" | "blocked" | "not-applicable" | "not-yet-tested";
  readonly ciStatus: "pass" | "fail" | null;
  readonly notes: string;
}

export interface TestingCaseListResult {
  readonly cases: ReadonlyArray<TestingCaseSummary>;
}

export interface TestingWorkbookImportResult extends TestingCaseListResult {
  readonly importId: string;
  readonly workbookName: string;
  readonly importedCount: number;
  readonly matchesCount: number;
  readonly needsReviewCount: number;
  readonly blockedCount: number;
}

export interface TestingClearGraphResult extends TestingGraphSummary {
  readonly clearedNodeCount: number;
  readonly clearedEdgeCount: number;
}

export interface TestingGeneratedArtifact {
  readonly caseId: string;
  readonly externalId: string;
  readonly featureSlug: string;
  readonly pageObjectPath: string;
  readonly dataPath: string;
  readonly specPath: string;
  readonly fingerprintCount: number;
}

export interface TestingGenerationJob {
  readonly id: string;
  readonly projectId: string;
  readonly status: "queued" | "running" | "completed" | "failed" | "cancelled" | "budget-stopped";
  readonly framework: "playwright-ts";
  readonly modelSelection: ModelSelection;
  readonly outputDirectory: string;
  readonly totalCases: number;
  readonly completedCases: number;
  readonly estimatedTokens: number;
  readonly estimatedCostUsd: number;
  readonly error: string | null;
  readonly artifacts: ReadonlyArray<TestingGeneratedArtifact>;
}

export interface TestingGenerationJobListResult {
  readonly jobs: ReadonlyArray<TestingGenerationJob>;
}

export interface TestingHealingProposal {
  readonly id: string;
  readonly caseId: string;
  readonly locatorKey: string;
  readonly previousRole: string;
  readonly previousName: string;
  readonly proposedRole: string;
  readonly proposedName: string;
  readonly confidence: number;
  readonly margin: number;
  readonly diff: string;
  readonly status: "pending" | "accepted" | "rejected" | "below-threshold";
  readonly consecutiveAttempts: number;
}

export interface TestingExecutionCaseResult {
  readonly caseId: string;
  readonly externalId: string;
  readonly status: "passed" | "failed" | "blocked" | "not-applicable";
  readonly durationMs: number;
  readonly error: string | null;
  readonly tracePath: string | null;
  readonly screenshotPath: string | null;
  readonly flaky: boolean;
  readonly quarantined: boolean;
  readonly visualStatus:
    | "disabled"
    | "baseline-created"
    | "matched"
    | "changed"
    | "review-required";
}

export interface TestingExecutionRun {
  readonly id: string;
  readonly projectId: string;
  readonly generationJobId: string;
  readonly mode: "standalone" | "ci";
  readonly status: "queued" | "running" | "passed" | "failed" | "blocked";
  readonly targetUrl: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly durationMs: number;
  readonly artifactRevision: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly results: ReadonlyArray<TestingExecutionCaseResult>;
  readonly healingProposals: ReadonlyArray<TestingHealingProposal>;
}

export interface TestingExecutionRunListResult {
  readonly runs: ReadonlyArray<TestingExecutionRun>;
}

export interface TestingSchedule {
  readonly id: string;
  readonly projectId: string;
  readonly generationJobId: string;
  readonly targetUrl: string;
  readonly timezone: string;
  readonly recurrence: "none" | "daily" | "weekly";
  readonly nextRunAt: string;
  readonly enabled: boolean;
}

export interface TestingScheduleListResult {
  readonly schedules: ReadonlyArray<TestingSchedule>;
}

export interface TestingGraphSummary {
  readonly projectId: string;
  readonly targetUrl: string | null;
  readonly databasePath: string;
  readonly authCapturedAt: string | null;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly cacheEntryCount: number;
  readonly cacheHitCount: number;
  readonly lastRunStatus: "idle" | "running" | "completed" | "failed";
  readonly lastRunError: string | null;
}

export interface TestingAuthStartResult {
  readonly started: true;
  readonly profilePath: string;
}

export interface TestingExplorationResult extends TestingGraphSummary {
  readonly runId: string;
  readonly injectionFlags: ReadonlyArray<string>;
  readonly piiTokenCount: number;
  readonly statesVisited: number;
  readonly transitionsObserved: number;
  readonly durationMs: number;
  readonly maxStates: number;
  readonly maxDurationSeconds: number | null;
  readonly scope: TestingExplorationScope;
  readonly terminationReason: "plateaued" | "max-states" | "time-budget";
}

export interface TestingApi {
  readonly getStatus: (input: TestingProjectInput) => Promise<TestingGraphSummary>;
  readonly startAuthCapture: (input: TestingTargetInput) => Promise<TestingAuthStartResult>;
  readonly finishAuthCapture: (input: TestingProjectInput) => Promise<TestingGraphSummary>;
  readonly startExploration: (input: TestingExplorationInput) => Promise<TestingExplorationResult>;
  readonly importWorkbook: (
    input: TestingWorkbookImportInput,
  ) => Promise<TestingWorkbookImportResult>;
  readonly listCases: (input: TestingProjectInput) => Promise<TestingCaseListResult>;
  readonly reviewCase: (input: TestingCaseReviewInput) => Promise<TestingCaseListResult>;
  readonly generateScenarios: (input: TestingProjectInput) => Promise<TestingCaseListResult>;
  readonly clearGraph: (input: TestingProjectInput) => Promise<TestingClearGraphResult>;
  readonly generateTests: (input: TestingGenerationInput) => Promise<TestingGenerationJob>;
  readonly listGenerationJobs: (
    input: TestingProjectInput,
  ) => Promise<TestingGenerationJobListResult>;
  readonly cancelGenerationJob: (input: TestingGenerationJobInput) => Promise<TestingGenerationJob>;
  readonly runTests: (input: TestingExecutionInput) => Promise<TestingExecutionRun>;
  readonly listExecutionRuns: (
    input: TestingProjectInput,
  ) => Promise<TestingExecutionRunListResult>;
  readonly decideHealingProposal: (
    input: TestingHealingDecisionInput,
  ) => Promise<TestingExecutionRunListResult>;
  readonly createSchedule: (input: TestingScheduleInput) => Promise<TestingSchedule>;
  readonly listSchedules: (input: TestingProjectInput) => Promise<TestingScheduleListResult>;
}
