import type {
  GitApplyHunkInput,
  GitApplyStashInput,
  GitAbortOperationInput,
  GitCheckoutInput,
  GitActionProgressEvent,
  GitContinueOperationInput,
  GitConflictSnapshotInput,
  GitConflictSnapshotResult,
  GitCreateBranchInput,
  GitDeleteBranchInput,
  GitDiscardChangesInput,
  GitDiffInput,
  GitDiffResult,
  GitFetchInput,
  GitHistoryInput,
  GitHistoryResult,
  GitMergeInput,
  GitPreparePullRequestThreadInput,
  GitPreparePullRequestThreadResult,
  GitPullRequestRefInput,
  GitResolveConflictInput,
  GitCreateWorktreeInput,
  GitCreateWorktreeResult,
  GitInitInput,
  GitListBranchesInput,
  GitListBranchesResult,
  GitPullInput,
  GitPushInput,
  GitPushResult,
  GitPullResult,
  GitRenameBranchInput,
  GitRenameBranchResult,
  GitRemoveWorktreeInput,
  GitResolvePullRequestResult,
  GitRunStackedActionInput,
  GitRunStackedActionResult,
  GitSkipRebaseInput,
  GitStageFilesInput,
  GitStashListInput,
  GitStashListResult,
  GitStashSaveInput,
  GitStatusInput,
  GitStatusResult,
  GitDropStashInput,
  GitRebaseInput,
  GitSetBranchUpstreamInput,
  GitUnstageFilesInput,
} from "./git";
import type {
  ProjectReadFileInput,
  ProjectReadFileResult,
  ProjectSearchEntriesInput,
  ProjectSearchEntriesResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
} from "./project";
import type {
  ServerConfig,
  ServerProviderUpdatedPayload,
  ServerUpsertKeybindingResult,
} from "./server";
import type {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalRestartInput,
  TerminalSessionSnapshot,
  TerminalWriteInput,
} from "./terminal";
import type { ServerUpsertKeybindingInput } from "./server";
import type {
  ClientOrchestrationCommand,
  OrchestrationGetFullThreadDiffInput,
  OrchestrationGetFullThreadDiffResult,
  OrchestrationGetTurnDiffInput,
  OrchestrationGetTurnDiffResult,
  OrchestrationEvent,
  OrchestrationReadModel,
} from "./orchestration";
import { EditorId } from "./editor";
import type { DesktopIconTheme } from "./settings";
import { ServerSettings, ServerSettingsPatch } from "./settings";

export interface ContextMenuItem<T extends string = string> {
  id: T;
  label: string;
  destructive?: boolean;
}

export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export type DesktopRuntimeArch = "arm64" | "x64" | "other";
export type DesktopTheme = "light" | "dark" | "system";

export interface DesktopRuntimeInfo {
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
}

export interface DesktopUpdateState {
  enabled: boolean;
  status: DesktopUpdateStatus;
  currentVersion: string;
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null;
  message: string | null;
  errorContext: "check" | "download" | "install" | null;
  canRetry: boolean;
}

export interface DesktopUpdateActionResult {
  accepted: boolean;
  completed: boolean;
  state: DesktopUpdateState;
}

export interface DesktopCodeHostState {
  available: boolean;
  mode: "embedded" | "external";
  entry: string | null;
  reason: string | null;
}

export interface DesktopCodeHostEnsureSessionInput {
  projectId: string;
  workspaceRoot: string;
}

export interface DesktopCodeHostActivateSessionInput {
  projectId: string;
}

export interface DesktopCodeHostOpenFileInput {
  projectId: string;
  relativePath: string;
  navigationNonce: number;
}

export interface DesktopCodeHostSetBoundsInput {
  projectId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

/** Sidebar view ids the native Code-tab activity rail can switch between. */
export type CodeActivityViewId = "explorer" | "search" | "scm" | "debug" | "extensions";

/**
 * State of the embedded workbench surfaced to the native Code-tab chrome
 * (activity rail / header / status bar). Pushed from the integration extension
 * through the loopback control channel. Runtime helpers that produce/validate
 * this live in `@tabs/shared/codeChrome` (contracts stays schema-only).
 */
export interface CodeChromeState {
  activeViewId: CodeActivityViewId | null;
  panelOpen: boolean;
  dirtyCount: number;
  branch: string | null;
}

export interface DesktopBrowserHostState {
  available: boolean;
  reason: string | null;
}

// `sessionId` identifies a distinct browser tab within a project (e.g. the main
// "Browser" tool vs. each custom browser tab). Each session gets its own
// kept-alive BrowserView so switching tabs doesn't reload. Defaults to "browser".
export interface DesktopBrowserHostEnsureSessionInput {
  projectId: string;
  sessionId?: string | undefined;
  initialUrl: string;
}

export interface DesktopBrowserHostActivateSessionInput {
  projectId: string;
  sessionId?: string | undefined;
}

export interface DesktopBrowserHostNavigateInput {
  projectId: string;
  sessionId?: string | undefined;
  url: string;
}

export interface DesktopBrowserHostControlInput {
  projectId: string;
  sessionId?: string | undefined;
}

export interface DesktopBrowserHostSetBoundsInput {
  projectId: string;
  sessionId?: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface DesktopBrowserSessionState {
  projectId: string;
  sessionId: string;
  currentUrl: string | null;
  pageTitle: string | null;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  devToolsOpen: boolean;
  lastError: string | null;
}

export interface DesktopBridge {
  getWsUrl: () => string | null;
  getPersistedItem: (key: string) => Promise<string | null>;
  setPersistedItem: (key: string, value: string) => Promise<void>;
  removePersistedItem: (key: string) => Promise<void>;
  pickFolder: () => Promise<string | null>;
  pickFile: () => Promise<string | null>;
  confirm: (message: string) => Promise<boolean>;
  setTheme: (theme: DesktopTheme) => Promise<void>;
  setIconTheme: (theme: DesktopIconTheme) => Promise<void>;
  showContextMenu: <T extends string>(
    items: readonly ContextMenuItem<T>[],
    position?: { x: number; y: number },
  ) => Promise<T | null>;
  openExternal: (url: string) => Promise<boolean>;
  onMenuAction: (listener: (action: string) => void) => () => void;
  getUpdateState: () => Promise<DesktopUpdateState>;
  downloadUpdate: () => Promise<DesktopUpdateActionResult>;
  installUpdate: () => Promise<DesktopUpdateActionResult>;
  onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
  getCodeHostState: () => Promise<DesktopCodeHostState>;
  ensureCodeSession: (input: DesktopCodeHostEnsureSessionInput) => Promise<void>;
  activateCodeSession: (input: DesktopCodeHostActivateSessionInput) => Promise<void>;
  hideCodeSession: () => Promise<void>;
  openCodeFile: (input: DesktopCodeHostOpenFileInput) => Promise<void>;
  setCodeBounds: (input: DesktopCodeHostSetBoundsInput) => Promise<void>;
  syncCodeSessions: (projectIds: readonly string[]) => Promise<void>;
  /** Forward an allowlisted workbench command to the embedded editor. Resolves true when delivered. */
  runCodeCommand: (commandId: string) => Promise<boolean>;
  /** Subscribe to chrome-state pushes from the embedded workbench. Returns an unsubscribe fn. */
  onCodeChromeState: (listener: (state: CodeChromeState) => void) => () => void;
  getBrowserHostState: () => Promise<DesktopBrowserHostState>;
  getBrowserSessionState: (
    input: DesktopBrowserHostControlInput,
  ) => Promise<DesktopBrowserSessionState>;
  ensureBrowserSession: (input: DesktopBrowserHostEnsureSessionInput) => Promise<void>;
  activateBrowserSession: (input: DesktopBrowserHostActivateSessionInput) => Promise<void>;
  hideBrowserSession: () => Promise<void>;
  navigateBrowserSession: (input: DesktopBrowserHostNavigateInput) => Promise<void>;
  reloadBrowserSession: (input: DesktopBrowserHostControlInput) => Promise<void>;
  goBackBrowserSession: (input: DesktopBrowserHostControlInput) => Promise<void>;
  goForwardBrowserSession: (input: DesktopBrowserHostControlInput) => Promise<void>;
  toggleBrowserDevTools: (input: DesktopBrowserHostControlInput) => Promise<void>;
  setBrowserBounds: (input: DesktopBrowserHostSetBoundsInput) => Promise<void>;
  syncBrowserSessions: (projectIds: readonly string[]) => Promise<void>;
  onBrowserSessionState: (listener: (state: DesktopBrowserSessionState) => void) => () => void;
}

export interface NativeApi {
  dialogs: {
    pickFolder: () => Promise<string | null>;
    pickFile: () => Promise<string | null>;
    confirm: (message: string) => Promise<boolean>;
  };
  terminal: {
    open: (input: TerminalOpenInput) => Promise<TerminalSessionSnapshot>;
    write: (input: TerminalWriteInput) => Promise<void>;
    resize: (input: TerminalResizeInput) => Promise<void>;
    clear: (input: TerminalClearInput) => Promise<void>;
    restart: (input: TerminalRestartInput) => Promise<TerminalSessionSnapshot>;
    close: (input: TerminalCloseInput) => Promise<void>;
    onEvent: (callback: (event: TerminalEvent) => void) => () => void;
  };
  projects: {
    searchEntries: (input: ProjectSearchEntriesInput) => Promise<ProjectSearchEntriesResult>;
    readFile: (input: ProjectReadFileInput) => Promise<ProjectReadFileResult>;
    writeFile: (input: ProjectWriteFileInput) => Promise<ProjectWriteFileResult>;
  };
  shell: {
    openInEditor: (cwd: string, editor: EditorId) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  git: {
    // Existing branch/worktree API
    listBranches: (input: GitListBranchesInput) => Promise<GitListBranchesResult>;
    createWorktree: (input: GitCreateWorktreeInput) => Promise<GitCreateWorktreeResult>;
    removeWorktree: (input: GitRemoveWorktreeInput) => Promise<void>;
    createBranch: (input: GitCreateBranchInput) => Promise<void>;
    checkout: (input: GitCheckoutInput) => Promise<void>;
    renameBranch: (input: GitRenameBranchInput) => Promise<GitRenameBranchResult>;
    deleteBranch: (input: GitDeleteBranchInput) => Promise<void>;
    setBranchUpstream: (input: GitSetBranchUpstreamInput) => Promise<void>;
    init: (input: GitInitInput) => Promise<void>;
    history: (input: GitHistoryInput) => Promise<GitHistoryResult>;
    diff: (input: GitDiffInput) => Promise<GitDiffResult>;
    stageFiles: (input: GitStageFilesInput) => Promise<void>;
    unstageFiles: (input: GitUnstageFilesInput) => Promise<void>;
    discardChanges: (input: GitDiscardChangesInput) => Promise<void>;
    saveStash: (input: GitStashSaveInput) => Promise<void>;
    listStashes: (input: GitStashListInput) => Promise<GitStashListResult>;
    applyStash: (input: GitApplyStashInput) => Promise<void>;
    dropStash: (input: GitDropStashInput) => Promise<void>;
    resolveConflict: (input: GitResolveConflictInput) => Promise<void>;
    readConflictSnapshot: (input: GitConflictSnapshotInput) => Promise<GitConflictSnapshotResult>;
    applyHunk: (input: GitApplyHunkInput) => Promise<void>;
    merge: (input: GitMergeInput) => Promise<void>;
    rebase: (input: GitRebaseInput) => Promise<void>;
    continueOperation: (input: GitContinueOperationInput) => Promise<void>;
    abortOperation: (input: GitAbortOperationInput) => Promise<void>;
    skipRebase: (input: GitSkipRebaseInput) => Promise<void>;
    resolvePullRequest: (input: GitPullRequestRefInput) => Promise<GitResolvePullRequestResult>;
    preparePullRequestThread: (
      input: GitPreparePullRequestThreadInput,
    ) => Promise<GitPreparePullRequestThreadResult>;
    // Stacked action API
    fetch: (input: GitFetchInput) => Promise<void>;
    pull: (input: GitPullInput) => Promise<GitPullResult>;
    push: (input: GitPushInput) => Promise<GitPushResult>;
    status: (input: GitStatusInput) => Promise<GitStatusResult>;
    runStackedAction: (input: GitRunStackedActionInput) => Promise<GitRunStackedActionResult>;
    onActionProgress: (callback: (event: GitActionProgressEvent) => void) => () => void;
  };
  contextMenu: {
    show: <T extends string>(
      items: readonly ContextMenuItem<T>[],
      position?: { x: number; y: number },
    ) => Promise<T | null>;
  };
  server: {
    getConfig: () => Promise<ServerConfig>;
    refreshProviders: () => Promise<ServerProviderUpdatedPayload>;
    upsertKeybinding: (input: ServerUpsertKeybindingInput) => Promise<ServerUpsertKeybindingResult>;
    getSettings: () => Promise<ServerSettings>;
    updateSettings: (patch: ServerSettingsPatch) => Promise<ServerSettings>;
  };
  orchestration: {
    getSnapshot: () => Promise<OrchestrationReadModel>;
    dispatchCommand: (command: ClientOrchestrationCommand) => Promise<{ sequence: number }>;
    getTurnDiff: (input: OrchestrationGetTurnDiffInput) => Promise<OrchestrationGetTurnDiffResult>;
    getFullThreadDiff: (
      input: OrchestrationGetFullThreadDiffInput,
    ) => Promise<OrchestrationGetFullThreadDiffResult>;
    replayEvents: (fromSequenceExclusive: number) => Promise<OrchestrationEvent[]>;
    onDomainEvent: (callback: (event: OrchestrationEvent) => void) => () => void;
  };
}
