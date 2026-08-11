import * as Schema from "effect/Schema";

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
}
