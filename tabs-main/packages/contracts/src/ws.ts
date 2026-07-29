import { Schema, Struct } from "effect";
import { NonNegativeInt, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas";

import {
  ClientOrchestrationCommand,
  OrchestrationEvent,
  ORCHESTRATION_WS_CHANNELS,
  OrchestrationGetFullThreadDiffInput,
  ORCHESTRATION_WS_METHODS,
  OrchestrationGetSnapshotInput,
  OrchestrationGetTurnDiffInput,
  OrchestrationReplayEventsInput,
} from "./orchestration";
import {
  GitApplyHunkInput,
  GitApplyStashInput,
  GitAbortOperationInput,
  GitActionProgressEvent,
  GitCheckoutInput,
  GitContinueOperationInput,
  GitConflictSnapshotInput,
  GitCreateBranchInput,
  GitCreateForkInput,
  GitDeleteBranchInput,
  GitDiscardChangesInput,
  GitDiffInput,
  GitFetchInput,
  GitHistoryInput,
  GitMergeInput,
  GitPreparePullRequestThreadInput,
  GitCreateWorktreeInput,
  GitDropStashInput,
  GitInitInput,
  GitListBranchesInput,
  GitListWorkflowRunsInput,
  GitPullInput,
  GitPushInput,
  GitPullRequestRefInput,
  GitRemoveWorktreeInput,
  GitRenameBranchInput,
  GitRunStackedActionInput,
  GitResolveConflictInput,
  GitSetBranchUpstreamInput,
  GitSkipRebaseInput,
  GitStageFilesInput,
  GitStashListInput,
  GitStashSaveInput,
  GitStatusInput,
  GitRebaseInput,
  GitUnstageFilesInput,
  GitEnvironmentInput,
  GitHubSwitchAccountInput,
  GitHubLogoutInput,
  GitAmendCommitInput,
  GitUndoLastCommitInput,
  GitRevertCommitInput,
  GitCherryPickInput,
  GitCreateTagInput,
} from "./git";
import {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalRestartInput,
  TerminalWriteInput,
} from "./terminal";
import { KeybindingRule } from "./keybindings";
import { ProjectReadFileInput, ProjectSearchEntriesInput, ProjectWriteFileInput } from "./project";
import { FilesystemBrowseInput } from "./filesystem";
import { OpenInEditorInput } from "./editor";
import {
  ServerConfigUpdatedPayload,
  ServerProviderUpdatedPayload,
  ServerRunProviderMaintenanceInput,
} from "./server";
import { ServerSettingsPatch } from "./settings";
import {
  SourceControlCloneRepositoryInput,
  SourceControlRepositoryLookupInput,
} from "./sourceControl";

// ── WebSocket RPC Method Names ───────────────────────────────────────

export const WS_METHODS = {
  projectsAdd: "projects.add",
  projectsList: "projects.list",
  projectsListEntries: "projects.listEntries",
  projectsReadFile: "projects.readFile",
  projectsRemove: "projects.remove",
  projectsSearchEntries: "projects.searchEntries",
  projectsWriteFile: "projects.writeFile",
  shellOpenInEditor: "shell.openInEditor",
  filesystemBrowse: "filesystem.browse",
  assetsCreateUrl: "assets.createUrl",
  gitAbortOperation: "git.abortOperation",
  gitAmendCommit: "git.amendCommit",
  gitApplyHunk: "git.applyHunk",
  gitApplyStash: "git.applyStash",
  gitCheckout: "git.checkout",
  gitCherryPick: "git.cherryPick",
  gitConflictSnapshot: "git.conflictSnapshot",
  gitContinueOperation: "git.continueOperation",
  gitCreateBranch: "git.createBranch",
  gitCreateFork: "git.createFork",
  gitCreateTag: "git.createTag",
  gitCreateWorktree: "git.createWorktree",
  gitDeleteBranch: "git.deleteBranch",
  gitDiff: "git.diff",
  gitDiscardChanges: "git.discardChanges",
  gitDropStash: "git.dropStash",
  gitEnvironment: "git.environment",
  gitFetch: "git.fetch",
  gitHistory: "git.history",
  gitHubLogout: "git.gitHubLogout",
  gitHubSwitchAccount: "git.gitHubSwitchAccount",
  gitInit: "git.init",
  gitListBranches: "git.listBranches",
  gitListStashes: "git.listStashes",
  gitListWorkflowRuns: "git.listWorkflowRuns",
  gitMerge: "git.merge",
  gitPreparePullRequestThread: "git.preparePullRequestThread",
  gitPull: "git.pull",
  gitPush: "git.push",
  gitRebase: "git.rebase",
  gitRemoveWorktree: "git.removeWorktree",
  gitRenameBranch: "git.renameBranch",
  gitResolveConflict: "git.resolveConflict",
  gitResolvePullRequest: "git.resolvePullRequest",
  gitRevertCommit: "git.revertCommit",
  gitRunStackedAction: "git.runStackedAction",
  gitSaveStash: "git.saveStash",
  gitSetBranchUpstream: "git.setBranchUpstream",
  gitSkipRebase: "git.skipRebase",
  gitStageFiles: "git.stageFiles",
  gitStatus: "git.status",
  gitUndoLastCommit: "git.undoLastCommit",
  gitUnstageFiles: "git.unstageFiles",
  vcsCreateRef: "vcs.createRef",
  vcsCreateWorktree: "vcs.createWorktree",
  vcsInit: "vcs.init",
  vcsListRefs: "vcs.listRefs",
  vcsPull: "vcs.pull",
  vcsRefreshStatus: "vcs.refreshStatus",
  vcsRemoveWorktree: "vcs.removeWorktree",
  vcsSwitchRef: "vcs.switchRef",
  reviewGetDiffPreview: "review.getDiffPreview",
  terminalAttach: "terminal.attach",
  terminalClear: "terminal.clear",
  terminalClose: "terminal.close",
  terminalList: "terminal.list",
  terminalOpen: "terminal.open",
  terminalResize: "terminal.resize",
  terminalRestart: "terminal.restart",
  terminalWrite: "terminal.write",
  previewAutomationConnect: "previewAutomation.connect",
  previewAutomationFocusHost: "previewAutomation.focusHost",
  previewAutomationRespond: "previewAutomation.respond",
  previewClose: "preview.close",
  previewList: "preview.list",
  previewNavigate: "preview.navigate",
  previewOpen: "preview.open",
  previewRefresh: "preview.refresh",
  previewReportStatus: "preview.reportStatus",
  previewResize: "preview.resize",
  serverCloneRepository: "server.cloneRepository",
  serverDiscoverSourceControl: "server.discoverSourceControl",
  serverGetConfig: "server.getConfig",
  serverGetProcessDiagnostics: "server.getProcessDiagnostics",
  serverGetProcessResourceHistory: "server.getProcessResourceHistory",
  serverGetSettings: "server.getSettings",
  serverGetTraceDiagnostics: "server.getTraceDiagnostics",
  serverLookupRepository: "server.lookupRepository",
  serverRefreshProviders: "server.refreshProviders",
  serverRemoveKeybinding: "server.removeKeybinding",
  serverRunProviderMaintenance: "server.runProviderMaintenance",
  serverSignalProcess: "server.signalProcess",
  serverUpdateProvider: "server.updateProvider",
  serverUpdateSettings: "server.updateSettings",
  serverUpsertKeybinding: "server.upsertKeybinding",
  cloudGetRelayClientStatus: "cloud.getRelayClientStatus",
  cloudInstallRelayClient: "cloud.installRelayClient",
  sourceControlCloneRepository: "sourceControl.cloneRepository",
  sourceControlLookupRepository: "sourceControl.lookupRepository",
  sourceControlPublishRepository: "sourceControl.publishRepository",
  subscribeAuthAccess: "subscribeAuthAccess",
  subscribeDiscoveredLocalServers: "subscribeDiscoveredLocalServers",
  subscribePreviewEvents: "subscribePreviewEvents",
  subscribeServerConfig: "subscribeServerConfig",
  subscribeServerLifecycle: "subscribeServerLifecycle",
  subscribeTerminalEvents: "subscribeTerminalEvents",
  subscribeTerminalMetadata: "subscribeTerminalMetadata",
  subscribeVcsStatus: "subscribeVcsStatus",
} as const;

// ── Push Event Channels ──────────────────────────────────────────────

export const WS_CHANNELS = {
  gitActionProgress: "git.actionProgress",
  terminalEvent: "terminal.event",
  serverWelcome: "server.welcome",
  serverConfigUpdated: "server.configUpdated",
  serverProvidersUpdated: "server.providersUpdated",
} as const;

// -- Tagged Union of all request body schemas ─────────────────────────

const tagRequestBody = <const Tag extends string, const Fields extends Schema.Struct.Fields>(
  tag: Tag,
  schema: Schema.Struct<Fields>,
) =>
  schema.mapFields(
    Struct.assign({ _tag: Schema.tag(tag) }),
    // PreserveChecks is safe here. No existing schema should have checks depending on the tag
    { unsafePreserveChecks: true },
  );

const WebSocketRequestBody = Schema.Union([
  // Orchestration methods
  tagRequestBody(
    ORCHESTRATION_WS_METHODS.dispatchCommand,
    Schema.Struct({ command: ClientOrchestrationCommand }),
  ),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getSnapshot, OrchestrationGetSnapshotInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getTurnDiff, OrchestrationGetTurnDiffInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getFullThreadDiff, OrchestrationGetFullThreadDiffInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.replayEvents, OrchestrationReplayEventsInput),

  // Project Search
  tagRequestBody(WS_METHODS.projectsSearchEntries, ProjectSearchEntriesInput),
  tagRequestBody(WS_METHODS.projectsReadFile, ProjectReadFileInput),
  tagRequestBody(WS_METHODS.projectsWriteFile, ProjectWriteFileInput),
  tagRequestBody(WS_METHODS.filesystemBrowse, FilesystemBrowseInput),

  // Shell methods
  tagRequestBody(WS_METHODS.shellOpenInEditor, OpenInEditorInput),

  // Git methods
  tagRequestBody(WS_METHODS.gitPull, GitPullInput),
  tagRequestBody(WS_METHODS.gitFetch, GitFetchInput),
  tagRequestBody(WS_METHODS.gitStatus, GitStatusInput),
  tagRequestBody(WS_METHODS.gitRunStackedAction, GitRunStackedActionInput),
  tagRequestBody(WS_METHODS.gitListBranches, GitListBranchesInput),
  tagRequestBody(WS_METHODS.gitListWorkflowRuns, GitListWorkflowRunsInput),
  tagRequestBody(WS_METHODS.gitCreateWorktree, GitCreateWorktreeInput),
  tagRequestBody(WS_METHODS.gitRemoveWorktree, GitRemoveWorktreeInput),
  tagRequestBody(WS_METHODS.gitCreateBranch, GitCreateBranchInput),
  tagRequestBody(WS_METHODS.gitCreateFork, GitCreateForkInput),
  tagRequestBody(WS_METHODS.gitCheckout, GitCheckoutInput),
  tagRequestBody(WS_METHODS.gitRenameBranch, GitRenameBranchInput),
  tagRequestBody(WS_METHODS.gitDeleteBranch, GitDeleteBranchInput),
  tagRequestBody(WS_METHODS.gitSetBranchUpstream, GitSetBranchUpstreamInput),
  tagRequestBody(WS_METHODS.gitInit, GitInitInput),
  tagRequestBody(WS_METHODS.gitHistory, GitHistoryInput),
  tagRequestBody(WS_METHODS.gitDiff, GitDiffInput),
  tagRequestBody(WS_METHODS.gitStageFiles, GitStageFilesInput),
  tagRequestBody(WS_METHODS.gitUnstageFiles, GitUnstageFilesInput),
  tagRequestBody(WS_METHODS.gitDiscardChanges, GitDiscardChangesInput),
  tagRequestBody(WS_METHODS.gitSaveStash, GitStashSaveInput),
  tagRequestBody(WS_METHODS.gitListStashes, GitStashListInput),
  tagRequestBody(WS_METHODS.gitApplyStash, GitApplyStashInput),
  tagRequestBody(WS_METHODS.gitDropStash, GitDropStashInput),
  tagRequestBody(WS_METHODS.gitResolveConflict, GitResolveConflictInput),
  tagRequestBody(WS_METHODS.gitConflictSnapshot, GitConflictSnapshotInput),
  tagRequestBody(WS_METHODS.gitApplyHunk, GitApplyHunkInput),
  tagRequestBody(WS_METHODS.gitMerge, GitMergeInput),
  tagRequestBody(WS_METHODS.gitRebase, GitRebaseInput),
  tagRequestBody(WS_METHODS.gitContinueOperation, GitContinueOperationInput),
  tagRequestBody(WS_METHODS.gitAbortOperation, GitAbortOperationInput),
  tagRequestBody(WS_METHODS.gitSkipRebase, GitSkipRebaseInput),
  tagRequestBody(WS_METHODS.gitResolvePullRequest, GitPullRequestRefInput),
  tagRequestBody(WS_METHODS.gitPreparePullRequestThread, GitPreparePullRequestThreadInput),
  tagRequestBody(WS_METHODS.gitPush, GitPushInput),
  tagRequestBody(WS_METHODS.gitEnvironment, GitEnvironmentInput),
  tagRequestBody(WS_METHODS.gitHubSwitchAccount, GitHubSwitchAccountInput),
  tagRequestBody(WS_METHODS.gitHubLogout, GitHubLogoutInput),
  tagRequestBody(WS_METHODS.gitAmendCommit, GitAmendCommitInput),
  tagRequestBody(WS_METHODS.gitUndoLastCommit, GitUndoLastCommitInput),
  tagRequestBody(WS_METHODS.gitRevertCommit, GitRevertCommitInput),
  tagRequestBody(WS_METHODS.gitCherryPick, GitCherryPickInput),
  tagRequestBody(WS_METHODS.gitCreateTag, GitCreateTagInput),

  // Terminal methods
  tagRequestBody(WS_METHODS.terminalOpen, TerminalOpenInput),
  tagRequestBody(WS_METHODS.terminalList, Schema.Struct({})),
  tagRequestBody(WS_METHODS.terminalWrite, TerminalWriteInput),
  tagRequestBody(WS_METHODS.terminalResize, TerminalResizeInput),
  tagRequestBody(WS_METHODS.terminalClear, TerminalClearInput),
  tagRequestBody(WS_METHODS.terminalRestart, TerminalRestartInput),
  tagRequestBody(WS_METHODS.terminalClose, TerminalCloseInput),

  // Server meta
  tagRequestBody(WS_METHODS.serverGetConfig, Schema.Struct({})),
  tagRequestBody(WS_METHODS.serverRefreshProviders, Schema.Struct({})),
  tagRequestBody(WS_METHODS.serverRunProviderMaintenance, ServerRunProviderMaintenanceInput),
  tagRequestBody(WS_METHODS.serverUpsertKeybinding, KeybindingRule),
  tagRequestBody(WS_METHODS.serverRemoveKeybinding, KeybindingRule),
  tagRequestBody(WS_METHODS.serverGetSettings, Schema.Struct({})),
  tagRequestBody(WS_METHODS.serverUpdateSettings, Schema.Struct({ patch: ServerSettingsPatch })),
  tagRequestBody(WS_METHODS.serverDiscoverSourceControl, Schema.Struct({})),
  tagRequestBody(WS_METHODS.serverCloneRepository, SourceControlCloneRepositoryInput),
  tagRequestBody(WS_METHODS.serverLookupRepository, SourceControlRepositoryLookupInput),
]);

export const WebSocketRequest = Schema.Struct({
  id: TrimmedNonEmptyString,
  body: WebSocketRequestBody,
});
export type WebSocketRequest = typeof WebSocketRequest.Type;

export const WebSocketResponse = Schema.Struct({
  id: TrimmedNonEmptyString,
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(
    Schema.Struct({
      message: Schema.String,
      phase: Schema.optional(Schema.NullOr(Schema.String)),
      createdCommitSha: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
});
export type WebSocketResponse = typeof WebSocketResponse.Type;

export const WsPushSequence = NonNegativeInt;
export type WsPushSequence = typeof WsPushSequence.Type;

export const WsWelcomePayload = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  projectName: TrimmedNonEmptyString,
  bootstrapProjectId: Schema.optional(ProjectId),
  bootstrapThreadId: Schema.optional(ThreadId),
});
export type WsWelcomePayload = typeof WsWelcomePayload.Type;

export interface WsPushPayloadByChannel {
  readonly [WS_CHANNELS.serverWelcome]: WsWelcomePayload;
  readonly [WS_CHANNELS.serverConfigUpdated]: typeof ServerConfigUpdatedPayload.Type;
  readonly [WS_CHANNELS.serverProvidersUpdated]: typeof ServerProviderUpdatedPayload.Type;
  readonly [WS_CHANNELS.gitActionProgress]: typeof GitActionProgressEvent.Type;
  readonly [WS_CHANNELS.terminalEvent]: typeof TerminalEvent.Type;
  readonly [ORCHESTRATION_WS_CHANNELS.domainEvent]: OrchestrationEvent;
}

export type WsPushChannel = keyof WsPushPayloadByChannel;
export type WsPushData<C extends WsPushChannel> = WsPushPayloadByChannel[C];

const makeWsPushSchema = <const Channel extends string, Payload extends Schema.Schema<any>>(
  channel: Channel,
  payload: Payload,
) =>
  Schema.Struct({
    type: Schema.Literal("push"),
    sequence: WsPushSequence,
    channel: Schema.Literal(channel),
    data: payload,
  });

export const WsPushServerWelcome = makeWsPushSchema(WS_CHANNELS.serverWelcome, WsWelcomePayload);
export const WsPushServerConfigUpdated = makeWsPushSchema(
  WS_CHANNELS.serverConfigUpdated,
  ServerConfigUpdatedPayload,
);
export const WsPushServerProvidersUpdated = makeWsPushSchema(
  WS_CHANNELS.serverProvidersUpdated,
  ServerProviderUpdatedPayload,
);
export const WsPushGitActionProgress = makeWsPushSchema(
  WS_CHANNELS.gitActionProgress,
  GitActionProgressEvent,
);
export const WsPushTerminalEvent = makeWsPushSchema(WS_CHANNELS.terminalEvent, TerminalEvent);
export const WsPushOrchestrationDomainEvent = makeWsPushSchema(
  ORCHESTRATION_WS_CHANNELS.domainEvent,
  OrchestrationEvent,
);

export const WsPushChannelSchema = Schema.Literals([
  WS_CHANNELS.gitActionProgress,
  WS_CHANNELS.serverWelcome,
  WS_CHANNELS.serverConfigUpdated,
  WS_CHANNELS.serverProvidersUpdated,
  WS_CHANNELS.terminalEvent,
  ORCHESTRATION_WS_CHANNELS.domainEvent,
]);
export type WsPushChannelSchema = typeof WsPushChannelSchema.Type;

export const WsPush = Schema.Union([
  WsPushServerWelcome,
  WsPushServerConfigUpdated,
  WsPushServerProvidersUpdated,
  WsPushGitActionProgress,
  WsPushTerminalEvent,
  WsPushOrchestrationDomainEvent,
]);
export type WsPush = typeof WsPush.Type;

export type WsPushMessage<C extends WsPushChannel> = Extract<WsPush, { channel: C }>;

export const WsPushEnvelopeBase = Schema.Struct({
  type: Schema.Literal("push"),
  sequence: WsPushSequence,
  channel: WsPushChannelSchema,
  data: Schema.Unknown,
});
export type WsPushEnvelopeBase = typeof WsPushEnvelopeBase.Type;

// ── Union of all server → client messages ─────────────────────────────

export const WsResponse = Schema.Union([WebSocketResponse, WsPush]);
export type WsResponse = typeof WsResponse.Type;
