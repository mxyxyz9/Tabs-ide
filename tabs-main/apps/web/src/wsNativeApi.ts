import {
  type GitActionProgressEvent,
  type ReviewProgressEvent,
  ORCHESTRATION_WS_CHANNELS,
  ORCHESTRATION_WS_METHODS,
  type ContextMenuItem,
  type NativeApi,
  ServerConfigUpdatedPayload,
  ServerProviderUpdatedPayload,
  WS_CHANNELS,
  WS_METHODS,
  type WsWelcomePayload,
  type TerminalEvent,
} from "@tabs/contracts";

import { showContextMenuFallback } from "./contextMenuFallback";
import { WsTransport } from "./wsTransport";
import { showCustomConfirm } from "./lib/customConfirm";

let instance: { api: NativeApi; transport: WsTransport } | null = null;
const welcomeListeners = new Set<(payload: WsWelcomePayload) => void>();
const serverConfigUpdatedListeners = new Set<(payload: ServerConfigUpdatedPayload) => void>();
const providersUpdatedListeners = new Set<(payload: ServerProviderUpdatedPayload) => void>();
const gitActionProgressListeners = new Set<(payload: GitActionProgressEvent) => void>();
const reviewProgressListeners = new Set<(payload: ReviewProgressEvent) => void>();

/**
 * Subscribe to the server welcome message. If a welcome was already received
 * before this call, the listener fires synchronously with the cached payload.
 * This avoids the race between WebSocket connect and React effect registration.
 */
export function onServerWelcome(listener: (payload: WsWelcomePayload) => void): () => void {
  welcomeListeners.add(listener);

  const latestWelcome = instance?.transport.getLatestPush(WS_CHANNELS.serverWelcome)?.data ?? null;
  if (latestWelcome) {
    try {
      listener(latestWelcome);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    welcomeListeners.delete(listener);
  };
}

/**
 * Subscribe to server config update events. Replays the latest update for
 * late subscribers to avoid missing config validation feedback.
 */
export function onServerConfigUpdated(
  listener: (payload: ServerConfigUpdatedPayload) => void,
): () => void {
  serverConfigUpdatedListeners.add(listener);

  const latestConfig =
    instance?.transport.getLatestPush(WS_CHANNELS.serverConfigUpdated)?.data ?? null;
  if (latestConfig) {
    try {
      listener(latestConfig);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    serverConfigUpdatedListeners.delete(listener);
  };
}

export function onServerProvidersUpdated(
  listener: (payload: ServerProviderUpdatedPayload) => void,
): () => void {
  providersUpdatedListeners.add(listener);

  const latestProviders =
    instance?.transport.getLatestPush(WS_CHANNELS.serverProvidersUpdated)?.data ?? null;
  if (latestProviders) {
    try {
      listener(latestProviders);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    providersUpdatedListeners.delete(listener);
  };
}

export function createWsNativeApi(): NativeApi {
  if (instance) return instance.api;

  const transport = new WsTransport();

  transport.subscribe(WS_CHANNELS.serverWelcome, (message) => {
    const payload = message.data;
    for (const listener of welcomeListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.serverConfigUpdated, (message) => {
    const payload = message.data;
    for (const listener of serverConfigUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.serverProvidersUpdated, (message) => {
    const payload = message.data;
    for (const listener of providersUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.gitActionProgress, (message) => {
    const payload = message.data;
    for (const listener of gitActionProgressListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.reviewProgress, (message) => {
    const payload = message.data;
    for (const listener of reviewProgressListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });

  const api: NativeApi = {
    dialogs: {
      pickFolder: async () => {
        if (!window.desktopBridge) return null;
        return window.desktopBridge.pickFolder();
      },
      pickFile: async () => {
        if (!window.desktopBridge) return null;
        return window.desktopBridge.pickFile();
      },
      confirm: async (message) => {
        return showCustomConfirm(message);
      },
    },
    terminal: {
      open: (input) => transport.request(WS_METHODS.terminalOpen, input),
      list: () => transport.request(WS_METHODS.terminalList, {}),
      write: (input) => transport.request(WS_METHODS.terminalWrite, input),
      resize: (input) => transport.request(WS_METHODS.terminalResize, input),
      clear: (input) => transport.request(WS_METHODS.terminalClear, input),
      restart: (input) => transport.request(WS_METHODS.terminalRestart, input),
      close: (input) => transport.request(WS_METHODS.terminalClose, input),
      onEvent: (callback) =>
        transport.subscribe(WS_CHANNELS.terminalEvent, (message) => callback(message.data)),
      attach: () => () => {},
      onMetadata: () => () => {},
    },
    projects: {
      searchEntries: (input) => transport.request(WS_METHODS.projectsSearchEntries, input),
      readFile: (input) => transport.request(WS_METHODS.projectsReadFile, input),
      writeFile: (input) => transport.request(WS_METHODS.projectsWriteFile, input),
      filesystemBrowse: (input) => transport.request(WS_METHODS.filesystemBrowse, input),
      listEntries: (input) => transport.request(WS_METHODS.projectsListEntries, input),
    },
    filesystem: {
      browse: (input) => transport.request(WS_METHODS.filesystemBrowse, input),
    },
    repositories: {
      clone: async (input) => {
        if (!window.desktopBridge) {
          return { ok: false, error: "Cloning a repository requires the desktop app." };
        }
        return window.desktopBridge.cloneRepository(input);
      },
    },
    shell: {
      openInEditor: (cwd, editor) =>
        transport.request(WS_METHODS.shellOpenInEditor, { cwd, editor }),
      openExternal: async (url) => {
        if (window.desktopBridge) {
          const opened = await window.desktopBridge.openExternal(url);
          if (!opened) {
            throw new Error("Unable to open link.");
          }
          return;
        }

        // Some mobile browsers can return null here even when the tab opens.
        // Avoid false negatives and let the browser handle popup policy.
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    git: {
      fetch: (input) => transport.request(WS_METHODS.gitFetch, input),
      pull: (input) => transport.request(WS_METHODS.gitPull, input),
      status: (input) => transport.request(WS_METHODS.gitStatus, input),
      runStackedAction: (input) =>
        transport.request(WS_METHODS.gitRunStackedAction, input, { timeoutMs: null }),
      listBranches: (input) => transport.request(WS_METHODS.gitListBranches, input),
      listWorkflowRuns: (input) => transport.request(WS_METHODS.gitListWorkflowRuns, input),
      createWorktree: (input) => transport.request(WS_METHODS.gitCreateWorktree, input),
      removeWorktree: (input) => transport.request(WS_METHODS.gitRemoveWorktree, input),
      createBranch: (input) => transport.request(WS_METHODS.gitCreateBranch, input),
      createFork: (input) => transport.request(WS_METHODS.gitCreateFork, input, { timeoutMs: 45_000 }),
      checkout: (input) => transport.request(WS_METHODS.gitCheckout, input),
      renameBranch: (input) => transport.request(WS_METHODS.gitRenameBranch, input),
      deleteBranch: (input) => transport.request(WS_METHODS.gitDeleteBranch, input),
      setBranchUpstream: (input) => transport.request(WS_METHODS.gitSetBranchUpstream, input),
      init: (input) => transport.request(WS_METHODS.gitInit, input),
      history: (input) => transport.request(WS_METHODS.gitHistory, input),
      diff: (input) => transport.request(WS_METHODS.gitDiff, input),
      stageFiles: (input) => transport.request(WS_METHODS.gitStageFiles, input),
      unstageFiles: (input) => transport.request(WS_METHODS.gitUnstageFiles, input),
      discardChanges: (input) => transport.request(WS_METHODS.gitDiscardChanges, input),
      saveStash: (input) => transport.request(WS_METHODS.gitSaveStash, input),
      listStashes: (input) => transport.request(WS_METHODS.gitListStashes, input),
      applyStash: (input) => transport.request(WS_METHODS.gitApplyStash, input),
      dropStash: (input) => transport.request(WS_METHODS.gitDropStash, input),
      resolveConflict: (input) => transport.request(WS_METHODS.gitResolveConflict, input),
      readConflictSnapshot: (input) => transport.request(WS_METHODS.gitConflictSnapshot, input),
      applyHunk: (input) => transport.request(WS_METHODS.gitApplyHunk, input),
      merge: (input) => transport.request(WS_METHODS.gitMerge, input),
      rebase: (input) => transport.request(WS_METHODS.gitRebase, input),
      continueOperation: (input) => transport.request(WS_METHODS.gitContinueOperation, input),
      abortOperation: (input) => transport.request(WS_METHODS.gitAbortOperation, input),
      skipRebase: (input) => transport.request(WS_METHODS.gitSkipRebase, input),
      resolvePullRequest: (input) => transport.request(WS_METHODS.gitResolvePullRequest, input),
      listPullRequests: (input) => transport.request(WS_METHODS.gitListPullRequests, input),
      preparePullRequestThread: (input) =>
        transport.request(WS_METHODS.gitPreparePullRequestThread, input),
      push: (input) => transport.request(WS_METHODS.gitPush, input),
      environment: (input) => transport.request(WS_METHODS.gitEnvironment, input),
      gitHubSwitchAccount: (input) =>
        transport.request(WS_METHODS.gitHubSwitchAccount, input, { timeoutMs: null }),
      gitHubLogout: (input) => transport.request(WS_METHODS.gitHubLogout, input),
      amendCommit: (input) => transport.request(WS_METHODS.gitAmendCommit, input),
      undoLastCommit: (input) => transport.request(WS_METHODS.gitUndoLastCommit, input),
      revertCommit: (input) => transport.request(WS_METHODS.gitRevertCommit, input),
      cherryPick: (input) => transport.request(WS_METHODS.gitCherryPick, input),
      createTag: (input) => transport.request(WS_METHODS.gitCreateTag, input),
      listTags: (input) => transport.request(WS_METHODS.gitListTags, input),
      watchedBranchStatuses: (input) => transport.request(WS_METHODS.gitWatchedBranchStatuses, input),
      generateDiffSummary: (input) => transport.request(WS_METHODS.gitGenerateDiffSummary, input),
      generateReview: (input) =>
        transport.request(WS_METHODS.gitGenerateReview, input, { timeoutMs: null }),
      submitFindingFeedback: (input) =>
        transport.request(WS_METHODS.gitSubmitFindingFeedback, input),
      getReviewHistory: (input) =>
        transport.request(WS_METHODS.gitGetReviewHistory, input),



      onActionProgress: (callback) => {
        gitActionProgressListeners.add(callback);
        return () => {
          gitActionProgressListeners.delete(callback);
        };
      },
      onReviewProgress: (callback) => {
        reviewProgressListeners.add(callback);
        return () => {
          reviewProgressListeners.delete(callback);
        };
      },
    },
    contextMenu: {
      show: async <T extends string>(
        items: readonly ContextMenuItem<T>[],
        position?: { x: number; y: number },
      ): Promise<T | null> => {
        if (window.desktopBridge) {
          return window.desktopBridge.showContextMenu(items, position) as Promise<T | null>;
        }
        return showContextMenuFallback(items, position);
      },
    },
    server: {
      getConfig: () => transport.request(WS_METHODS.serverGetConfig),
      refreshProviders: () => transport.request(WS_METHODS.serverRefreshProviders),
      runProviderMaintenance: (input) =>
        transport.request(WS_METHODS.serverRunProviderMaintenance, input),
      upsertKeybinding: (input) => transport.request(WS_METHODS.serverUpsertKeybinding, input),
      removeKeybinding: (input) => transport.request(WS_METHODS.serverRemoveKeybinding, input),
      getSettings: () => transport.request(WS_METHODS.serverGetSettings),
      updateSettings: (patch) => transport.request(WS_METHODS.serverUpdateSettings, { patch }),
      discoverSourceControl: () => transport.request(WS_METHODS.serverDiscoverSourceControl),
      cloneRepository: (input) => transport.request(WS_METHODS.serverCloneRepository, input),
      lookupRepository: (input) => transport.request(WS_METHODS.serverLookupRepository, input),
      updateProvider: (input) => transport.request(WS_METHODS.serverUpdateProvider, input),
      getTraceDiagnostics: () => transport.request(WS_METHODS.serverGetTraceDiagnostics),
      getProcessDiagnostics: () => transport.request(WS_METHODS.serverGetProcessDiagnostics),
      getProcessResourceHistory: (input) =>
        transport.request(WS_METHODS.serverGetProcessResourceHistory, input),
      signalProcess: (input) => transport.request(WS_METHODS.serverSignalProcess, input),
    },
    orchestration: {
      getSnapshot: () => transport.request(ORCHESTRATION_WS_METHODS.getSnapshot),
      dispatchCommand: (command) =>
        transport.request(ORCHESTRATION_WS_METHODS.dispatchCommand, { command }),
      getTurnDiff: (input) => transport.request(ORCHESTRATION_WS_METHODS.getTurnDiff, input),
      getFullThreadDiff: (input) =>
        transport.request(ORCHESTRATION_WS_METHODS.getFullThreadDiff, input),
      replayEvents: (fromSequenceExclusive) =>
        transport.request(ORCHESTRATION_WS_METHODS.replayEvents, { fromSequenceExclusive }),
      onDomainEvent: (callback) =>
        transport.subscribe(ORCHESTRATION_WS_CHANNELS.domainEvent, (message) =>
          callback(message.data),
        ),
      getArchivedShellSnapshot: () =>
        transport.request(ORCHESTRATION_WS_METHODS.getArchivedShellSnapshot, {}),
      subscribeShell: () => () => {},
      subscribeThread: () => () => {},
    },
    persistence: {
      getClientSettings: async () => null,
      setClientSettings: async () => {},
    } as any,
    assets: {
      createUrl: async () => ({ url: "" }),
    } as any,
    sourceControl: {
      lookupRepository: async () => {
        throw new Error("Unsupported in web");
      },
      cloneRepository: async () => {
        throw new Error("Unsupported in web");
      },
      publishRepository: async () => {
        throw new Error("Unsupported in web");
      },
    } as any,
    vcs: {
      listRefs: async () => ({ refs: [], activeRef: null }),
      createWorktree: async () => ({ path: "", branch: "" }),
      removeWorktree: async () => {},
      createRef: async () => ({ ref: "" }),
      switchRef: async () => ({ ref: "" }),
      init: async () => {},
      pull: async () => ({ success: true }),
      refreshStatus: async () => ({ clean: true, changes: [] }),
      onStatus: () => () => {},
    } as any,
    review: {
      getDiffPreview: async () => {
        throw new Error("Unsupported in web");
      },
    } as any,
    preview: {} as any,
  };

  instance = { api, transport };
  return api;
}
