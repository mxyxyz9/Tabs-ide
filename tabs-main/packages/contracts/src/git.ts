import { Schema } from "effect";
import { NonNegativeInt, PositiveInt, TrimmedNonEmptyString } from "./baseSchemas";

const TrimmedNonEmptyStringSchema = TrimmedNonEmptyString;

// Domain Types

export const GitStackedAction = Schema.Literals(["commit", "commit_push", "commit_push_pr"]);
export type GitStackedAction = typeof GitStackedAction.Type;
export const GitActionProgressPhase = Schema.Literals(["branch", "commit", "push", "pr"]);
export type GitActionProgressPhase = typeof GitActionProgressPhase.Type;
export const GitActionProgressKind = Schema.Literals([
  "action_started",
  "phase_started",
  "hook_started",
  "hook_output",
  "hook_finished",
  "action_finished",
  "action_failed",
]);
export type GitActionProgressKind = typeof GitActionProgressKind.Type;
export const GitActionProgressStream = Schema.Literals(["stdout", "stderr"]);
export type GitActionProgressStream = typeof GitActionProgressStream.Type;
const GitCommitStepStatus = Schema.Literals(["created", "skipped_no_changes"]);
const GitPushStepStatus = Schema.Literals([
  "pushed",
  "skipped_not_requested",
  "skipped_up_to_date",
]);
const GitBranchStepStatus = Schema.Literals(["created", "skipped_not_requested"]);
const GitPrStepStatus = Schema.Literals(["created", "opened_existing", "skipped_not_requested"]);
const GitStatusPrState = Schema.Literals(["open", "closed", "merged"]);
const GitPullRequestReference = TrimmedNonEmptyStringSchema;
const GitPullRequestState = Schema.Literals(["open", "closed", "merged"]);
const GitPreparePullRequestThreadMode = Schema.Literals(["local", "worktree"]);
export const GitOperationKind = Schema.Literals(["merge", "rebase"]);
export type GitOperationKind = typeof GitOperationKind.Type;
const GitOperationStatus = Schema.Literals(["in_progress", "conflicted"]);
export const GitConflictResolutionSide = Schema.Literals(["ours", "theirs"]);
export type GitConflictResolutionSide = typeof GitConflictResolutionSide.Type;

export const GitBranch = Schema.Struct({
  name: TrimmedNonEmptyStringSchema,
  isRemote: Schema.optional(Schema.Boolean),
  remoteName: Schema.optional(TrimmedNonEmptyStringSchema),
  current: Schema.Boolean,
  isDefault: Schema.Boolean,
  worktreePath: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
});
export type GitBranch = typeof GitBranch.Type;

const GitWorktree = Schema.Struct({
  path: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
});
const GitResolvedPullRequest = Schema.Struct({
  number: PositiveInt,
  title: TrimmedNonEmptyStringSchema,
  url: Schema.String,
  baseBranch: TrimmedNonEmptyStringSchema,
  headBranch: TrimmedNonEmptyStringSchema,
  state: GitPullRequestState,
});
export type GitResolvedPullRequest = typeof GitResolvedPullRequest.Type;

// RPC Inputs

export const GitStatusInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitStatusInput = typeof GitStatusInput.Type;

export const GitPullInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitPullInput = typeof GitPullInput.Type;

export const GitPushInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitPushInput = typeof GitPushInput.Type;

export const GitFetchInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitFetchInput = typeof GitFetchInput.Type;

export const GitStageFilesInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  paths: Schema.Array(TrimmedNonEmptyStringSchema).check(Schema.isMinLength(1)),
});
export type GitStageFilesInput = typeof GitStageFilesInput.Type;

export const GitUnstageFilesInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  paths: Schema.Array(TrimmedNonEmptyStringSchema).check(Schema.isMinLength(1)),
});
export type GitUnstageFilesInput = typeof GitUnstageFilesInput.Type;

export const GitDiscardChangesInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  paths: Schema.optional(Schema.Array(TrimmedNonEmptyStringSchema).check(Schema.isMinLength(1))),
  discardStaged: Schema.optional(Schema.Boolean),
  discardUnstaged: Schema.optional(Schema.Boolean),
  discardUntracked: Schema.optional(Schema.Boolean),
});
export type GitDiscardChangesInput = typeof GitDiscardChangesInput.Type;

export const GitStashSaveInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  message: Schema.optional(TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(500))),
  includeUntracked: Schema.optional(Schema.Boolean),
});
export type GitStashSaveInput = typeof GitStashSaveInput.Type;

export const GitStashListInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitStashListInput = typeof GitStashListInput.Type;

export const GitApplyStashInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  stashRef: TrimmedNonEmptyStringSchema,
  pop: Schema.optional(Schema.Boolean),
});
export type GitApplyStashInput = typeof GitApplyStashInput.Type;

export const GitDropStashInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  stashRef: TrimmedNonEmptyStringSchema,
});
export type GitDropStashInput = typeof GitDropStashInput.Type;

export const GitMergeInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
});
export type GitMergeInput = typeof GitMergeInput.Type;

export const GitRebaseInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
});
export type GitRebaseInput = typeof GitRebaseInput.Type;

export const GitContinueOperationInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  kind: GitOperationKind,
});
export type GitContinueOperationInput = typeof GitContinueOperationInput.Type;

export const GitAbortOperationInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  kind: GitOperationKind,
});
export type GitAbortOperationInput = typeof GitAbortOperationInput.Type;

export const GitSkipRebaseInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitSkipRebaseInput = typeof GitSkipRebaseInput.Type;

export const GitResolveConflictInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  path: TrimmedNonEmptyStringSchema,
  side: GitConflictResolutionSide,
});
export type GitResolveConflictInput = typeof GitResolveConflictInput.Type;

export const GitConflictSnapshotInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  path: TrimmedNonEmptyStringSchema,
});
export type GitConflictSnapshotInput = typeof GitConflictSnapshotInput.Type;

export const GitApplyHunkMode = Schema.Literals(["stage", "unstage", "discard"]);
export type GitApplyHunkMode = typeof GitApplyHunkMode.Type;

export const GitApplyHunkInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  path: TrimmedNonEmptyStringSchema,
  patch: TrimmedNonEmptyStringSchema,
  mode: GitApplyHunkMode,
});
export type GitApplyHunkInput = typeof GitApplyHunkInput.Type;

export const GitRunStackedActionInput = Schema.Struct({
  actionId: TrimmedNonEmptyStringSchema,
  cwd: TrimmedNonEmptyStringSchema,
  action: GitStackedAction,
  commitMessage: Schema.optional(TrimmedNonEmptyStringSchema.check(Schema.isMaxLength(10_000))),
  featureBranch: Schema.optional(Schema.Boolean),
  filePaths: Schema.optional(
    Schema.Array(TrimmedNonEmptyStringSchema).check(Schema.isMinLength(1)),
  ),
});
export type GitRunStackedActionInput = typeof GitRunStackedActionInput.Type;

export const GitListBranchesInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitListBranchesInput = typeof GitListBranchesInput.Type;

export const GitCreateWorktreeInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
  newBranch: Schema.optional(TrimmedNonEmptyStringSchema),
  path: Schema.NullOr(TrimmedNonEmptyStringSchema),
});
export type GitCreateWorktreeInput = typeof GitCreateWorktreeInput.Type;

export const GitPullRequestRefInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  reference: GitPullRequestReference,
});
export type GitPullRequestRefInput = typeof GitPullRequestRefInput.Type;

export const GitPreparePullRequestThreadInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  reference: GitPullRequestReference,
  mode: GitPreparePullRequestThreadMode,
});
export type GitPreparePullRequestThreadInput = typeof GitPreparePullRequestThreadInput.Type;

export const GitRemoveWorktreeInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  path: TrimmedNonEmptyStringSchema,
  force: Schema.optional(Schema.Boolean),
});
export type GitRemoveWorktreeInput = typeof GitRemoveWorktreeInput.Type;

export const GitCreateBranchInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
});
export type GitCreateBranchInput = typeof GitCreateBranchInput.Type;

export const GitCheckoutInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
});
export type GitCheckoutInput = typeof GitCheckoutInput.Type;

export const GitRenameBranchInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  oldBranch: TrimmedNonEmptyStringSchema,
  newBranch: TrimmedNonEmptyStringSchema,
});
export type GitRenameBranchInput = typeof GitRenameBranchInput.Type;

export const GitRenameBranchResult = Schema.Struct({
  branch: TrimmedNonEmptyStringSchema,
});
export type GitRenameBranchResult = typeof GitRenameBranchResult.Type;

export const GitDeleteBranchInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
  force: Schema.optional(Schema.Boolean),
});
export type GitDeleteBranchInput = typeof GitDeleteBranchInput.Type;

export const GitSetBranchUpstreamInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
  remoteName: TrimmedNonEmptyStringSchema,
  remoteBranch: TrimmedNonEmptyStringSchema,
});
export type GitSetBranchUpstreamInput = typeof GitSetBranchUpstreamInput.Type;

export const GitHistoryInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  limit: Schema.optional(PositiveInt),
});
export type GitHistoryInput = typeof GitHistoryInput.Type;

export const GitDiffInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  path: Schema.optional(TrimmedNonEmptyStringSchema),
  commit: Schema.optional(TrimmedNonEmptyStringSchema),
});
export type GitDiffInput = typeof GitDiffInput.Type;

export const GitInitInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitInitInput = typeof GitInitInput.Type;

// RPC Results

const GitStatusPr = Schema.Struct({
  number: PositiveInt,
  title: TrimmedNonEmptyStringSchema,
  url: Schema.String,
  baseBranch: TrimmedNonEmptyStringSchema,
  headBranch: TrimmedNonEmptyStringSchema,
  state: GitStatusPrState,
});

export const GitStatusFile = Schema.Struct({
  path: TrimmedNonEmptyStringSchema,
  insertions: NonNegativeInt,
  deletions: NonNegativeInt,
  staged: Schema.optional(Schema.Boolean),
  unstaged: Schema.optional(Schema.Boolean),
  untracked: Schema.optional(Schema.Boolean),
  conflicted: Schema.optional(Schema.Boolean),
});
export type GitStatusFile = typeof GitStatusFile.Type;

export const GitOperationState = Schema.Struct({
  kind: GitOperationKind,
  status: GitOperationStatus,
});
export type GitOperationState = typeof GitOperationState.Type;

export const GitStatusResult = Schema.Struct({
  branch: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
  hasWorkingTreeChanges: Schema.Boolean,
  workingTree: Schema.Struct({
    files: Schema.Array(GitStatusFile),
    insertions: NonNegativeInt,
    deletions: NonNegativeInt,
  }),
  staged: Schema.optional(
    Schema.Struct({
      files: Schema.Array(GitStatusFile),
      insertions: NonNegativeInt,
      deletions: NonNegativeInt,
    }),
  ),
  unstaged: Schema.optional(
    Schema.Struct({
      files: Schema.Array(GitStatusFile),
      insertions: NonNegativeInt,
      deletions: NonNegativeInt,
    }),
  ),
  conflicted: Schema.optional(
    Schema.Struct({
      files: Schema.Array(GitStatusFile),
    }),
  ),
  untracked: Schema.optional(
    Schema.Struct({
      files: Schema.Array(GitStatusFile),
    }),
  ),
  hasUpstream: Schema.Boolean,
  aheadCount: NonNegativeInt,
  behindCount: NonNegativeInt,
  operation: Schema.NullOr(GitOperationState),
  pr: Schema.NullOr(GitStatusPr),
});
export type GitStatusResult = typeof GitStatusResult.Type;

export const GitListBranchesResult = Schema.Struct({
  branches: Schema.Array(GitBranch),
  isRepo: Schema.Boolean,
  hasOriginRemote: Schema.Boolean,
});
export type GitListBranchesResult = typeof GitListBranchesResult.Type;

// Environment + GitHub account management

export const GitEnvironmentInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitEnvironmentInput = typeof GitEnvironmentInput.Type;

export const GitHubAccount = Schema.Struct({
  host: TrimmedNonEmptyStringSchema,
  login: TrimmedNonEmptyStringSchema,
  active: Schema.Boolean,
  scopes: Schema.Array(Schema.String),
});
export type GitHubAccount = typeof GitHubAccount.Type;

export const GitEnvironmentResult = Schema.Struct({
  git: Schema.Struct({
    installed: Schema.Boolean,
    version: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
  }),
  gitHub: Schema.Struct({
    cliInstalled: Schema.Boolean,
    version: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
    authenticated: Schema.Boolean,
    accounts: Schema.Array(GitHubAccount),
    activeLogin: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
  }),
});
export type GitEnvironmentResult = typeof GitEnvironmentResult.Type;

export const GitHubSwitchAccountInput = Schema.Struct({
  host: TrimmedNonEmptyStringSchema,
  login: TrimmedNonEmptyStringSchema,
});
export type GitHubSwitchAccountInput = typeof GitHubSwitchAccountInput.Type;

export const GitHubLogoutInput = Schema.Struct({
  host: TrimmedNonEmptyStringSchema,
  login: TrimmedNonEmptyStringSchema,
});
export type GitHubLogoutInput = typeof GitHubLogoutInput.Type;

export const GitCreateWorktreeResult = Schema.Struct({
  worktree: GitWorktree,
});
export type GitCreateWorktreeResult = typeof GitCreateWorktreeResult.Type;

export const GitResolvePullRequestResult = Schema.Struct({
  pullRequest: GitResolvedPullRequest,
});
export type GitResolvePullRequestResult = typeof GitResolvePullRequestResult.Type;

export const GitPreparePullRequestThreadResult = Schema.Struct({
  pullRequest: GitResolvedPullRequest,
  branch: TrimmedNonEmptyStringSchema,
  worktreePath: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
});
export type GitPreparePullRequestThreadResult = typeof GitPreparePullRequestThreadResult.Type;

export const GitRunStackedActionResult = Schema.Struct({
  action: GitStackedAction,
  branch: Schema.Struct({
    status: GitBranchStepStatus,
    name: Schema.optional(TrimmedNonEmptyStringSchema),
  }),
  commit: Schema.Struct({
    status: GitCommitStepStatus,
    commitSha: Schema.optional(TrimmedNonEmptyStringSchema),
    subject: Schema.optional(TrimmedNonEmptyStringSchema),
  }),
  push: Schema.Struct({
    status: GitPushStepStatus,
    branch: Schema.optional(TrimmedNonEmptyStringSchema),
    upstreamBranch: Schema.optional(TrimmedNonEmptyStringSchema),
    setUpstream: Schema.optional(Schema.Boolean),
  }),
  pr: Schema.Struct({
    status: GitPrStepStatus,
    url: Schema.optional(Schema.String),
    number: Schema.optional(PositiveInt),
    baseBranch: Schema.optional(TrimmedNonEmptyStringSchema),
    headBranch: Schema.optional(TrimmedNonEmptyStringSchema),
    title: Schema.optional(TrimmedNonEmptyStringSchema),
  }),
});
export type GitRunStackedActionResult = typeof GitRunStackedActionResult.Type;

export const GitPullResult = Schema.Struct({
  status: Schema.Literals(["pulled", "skipped_up_to_date"]),
  branch: TrimmedNonEmptyStringSchema,
  upstreamBranch: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
});
export type GitPullResult = typeof GitPullResult.Type;

export const GitPushResult = Schema.Struct({
  status: Schema.Literals(["pushed", "skipped_up_to_date"]),
  branch: TrimmedNonEmptyStringSchema,
  upstreamBranch: Schema.optional(TrimmedNonEmptyStringSchema),
  setUpstream: Schema.optional(Schema.Boolean),
});
export type GitPushResult = typeof GitPushResult.Type;

export const GitHistoryCommit = Schema.Struct({
  sha: TrimmedNonEmptyStringSchema,
  shortSha: TrimmedNonEmptyStringSchema,
  subject: TrimmedNonEmptyStringSchema,
  authorName: TrimmedNonEmptyStringSchema,
  authoredAt: Schema.String,
  refs: Schema.Array(TrimmedNonEmptyStringSchema),
  isHead: Schema.Boolean,
});
export type GitHistoryCommit = typeof GitHistoryCommit.Type;

export const GitHistoryResult = Schema.Struct({
  commits: Schema.Array(GitHistoryCommit),
});
export type GitHistoryResult = typeof GitHistoryResult.Type;

export const GitDiffTarget = Schema.Literals(["working_tree", "commit"]);
export type GitDiffTarget = typeof GitDiffTarget.Type;

export const GitDiffStats = Schema.Struct({
  filesChanged: NonNegativeInt,
  insertions: NonNegativeInt,
  deletions: NonNegativeInt,
});
export type GitDiffStats = typeof GitDiffStats.Type;

export const GitDiffResult = Schema.Struct({
  target: GitDiffTarget,
  path: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
  commit: TrimmedNonEmptyStringSchema.pipe(Schema.NullOr),
  title: TrimmedNonEmptyStringSchema,
  patch: Schema.String,
  stats: GitDiffStats,
});
export type GitDiffResult = typeof GitDiffResult.Type;

export const GitConflictSnapshotResult = Schema.Struct({
  path: TrimmedNonEmptyStringSchema,
  baseContents: Schema.NullOr(Schema.String),
  oursContents: Schema.NullOr(Schema.String),
  theirsContents: Schema.NullOr(Schema.String),
});
export type GitConflictSnapshotResult = typeof GitConflictSnapshotResult.Type;

export const GitStashEntry = Schema.Struct({
  stashRef: TrimmedNonEmptyStringSchema,
  sha: TrimmedNonEmptyStringSchema,
  shortSha: TrimmedNonEmptyStringSchema,
  message: TrimmedNonEmptyStringSchema,
  createdAt: Schema.String,
});
export type GitStashEntry = typeof GitStashEntry.Type;

export const GitStashListResult = Schema.Struct({
  entries: Schema.Array(GitStashEntry),
});
export type GitStashListResult = typeof GitStashListResult.Type;

const GitActionProgressBase = Schema.Struct({
  actionId: TrimmedNonEmptyStringSchema,
  cwd: TrimmedNonEmptyStringSchema,
  action: GitStackedAction,
});

const GitActionStartedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("action_started"),
  phases: Schema.Array(GitActionProgressPhase),
});
const GitActionPhaseStartedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("phase_started"),
  phase: GitActionProgressPhase,
  label: TrimmedNonEmptyStringSchema,
});
const GitActionHookStartedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("hook_started"),
  hookName: TrimmedNonEmptyStringSchema,
});
const GitActionHookOutputEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("hook_output"),
  hookName: Schema.NullOr(TrimmedNonEmptyStringSchema),
  stream: GitActionProgressStream,
  text: TrimmedNonEmptyStringSchema,
});
const GitActionHookFinishedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("hook_finished"),
  hookName: TrimmedNonEmptyStringSchema,
  exitCode: Schema.NullOr(Schema.Int),
  durationMs: Schema.NullOr(NonNegativeInt),
});
const GitActionFinishedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("action_finished"),
  result: GitRunStackedActionResult,
});
const GitActionFailedEvent = Schema.Struct({
  ...GitActionProgressBase.fields,
  kind: Schema.Literal("action_failed"),
  phase: Schema.NullOr(GitActionProgressPhase),
  message: TrimmedNonEmptyStringSchema,
});

export const GitActionProgressEvent = Schema.Union([
  GitActionStartedEvent,
  GitActionPhaseStartedEvent,
  GitActionHookStartedEvent,
  GitActionHookOutputEvent,
  GitActionHookFinishedEvent,
  GitActionFinishedEvent,
  GitActionFailedEvent,
]);
export type GitActionProgressEvent = typeof GitActionProgressEvent.Type;

export class TextGenerationError extends Schema.TaggedErrorClass<TextGenerationError>()(
  "TextGenerationError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Text generation failed in ${this.operation}: ${this.detail}`;
  }
}
