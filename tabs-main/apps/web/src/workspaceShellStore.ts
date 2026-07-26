import { type Project, type Thread } from "./types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as Schema from "effect/Schema";
import {
  BrowserDevicePreset,
  DEFAULT_PROJECT_TOOL_KIND,
  DEFAULT_PROJECT_TOOL_ORDER,
  ProjectWorkspaceSessionState,
  ProjectWorkspaceSettings,
  type BrowserDevicePreset as BrowserDevicePresetType,
  type ProjectToolDefinition,
  type ProjectWorkspaceSessionState as ProjectWorkspaceSessionStateType,
  type ProjectWorkspaceSettings as ProjectWorkspaceSettingsType,
} from "@tabs/contracts/settings";
import { ProjectId, ThreadId } from "@tabs/contracts";

const WORKSPACE_SHELL_STORAGE_KEY = "tabs:workspace-shell:v1";

// One-time cleanup: nuke any previously-corrupted localStorage data written
// by the Python-script refactor. The persist middleware now uses version 2
// and will migrate any old data, but as an extra safety net we explicitly
// remove the old key here so there's no chance of reading stale state.
if (typeof localStorage !== "undefined") {
  try {
    const raw = localStorage.getItem(WORKSPACE_SHELL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number };
      // If the stored version is less than 2, wipe it so we start fresh.
      if (typeof parsed?.version !== "number" || parsed.version < 2) {
        localStorage.removeItem(WORKSPACE_SHELL_STORAGE_KEY);
      }
    }
  } catch {
    // If parsing fails, the data is corrupt — remove it.
    localStorage.removeItem(WORKSPACE_SHELL_STORAGE_KEY);
  }
}

const decodeProjectWorkspaceSettingsSchema = Schema.decodeUnknownSync(ProjectWorkspaceSettings);
const decodeProjectWorkspaceSessionState = Schema.decodeSync(ProjectWorkspaceSessionState);

export interface ProjectBrowserToolState {
  currentUrl: string;
  devicePreset: BrowserDevicePresetType;
  customWidth: number | null;
  customHeight: number | null;
  landscape: boolean;
  chromeExpanded?: boolean;
}

export interface ProjectCodeToolState {
  lastFocusedPath: string | null;
  navigationNonce: number;
  // The Code-tab AI side chat's open state and selected thread, persisted per
  // project so switching tools/projects (which unmounts the Code tool) doesn't
  // lose the side chat — the running task stays visible and continuous on return.
  sideChatOpen: boolean;
  sideChatThreadId: ThreadId | null;
}

export interface ProjectGitToolState {
  selectedPath: string | null;
  selectedCommit: string | null;
}

export interface ProjectServerToolState {
  logQueryByProcessId: Record<string, string>;
}

export interface WorkspaceShellPersistedState {
  session: ProjectWorkspaceSessionStateType;
  projectSettingsByProjectId: Record<ProjectId, ProjectWorkspaceSettingsType>;
  browserStateByProjectId: Record<ProjectId, ProjectBrowserToolState>;
  // Last-navigated URL per browser tab, keyed by `${projectId}:${sessionId}`, so
  // each tab (incl. custom tabs) reopens where the user left it.
  browserUrlBySessionKey: Record<string, string>;
  codeStateByProjectId: Record<ProjectId, ProjectCodeToolState>;
  gitStateByProjectId: Record<ProjectId, ProjectGitToolState>;
  serverStateByProjectId: Record<ProjectId, ProjectServerToolState>;
}

export interface WorkspaceShellStore extends WorkspaceShellPersistedState {
  syncProjects: (projects: ReadonlyArray<Project>, threads: ReadonlyArray<Thread>) => void;
  openProject: (projectId: ProjectId) => void;
  closeProject: (projectId: ProjectId) => void;
  setActiveProject: (projectId: ProjectId | null) => void;
  setActiveTool: (projectId: ProjectId, toolId: string) => void;
  rememberThread: (projectId: ProjectId, threadId: ThreadId) => void;
  upsertProjectSettings: (
    projectId: ProjectId,
    updater:
      | Partial<ProjectWorkspaceSettingsType>
      | ((current: ProjectWorkspaceSettingsType) => ProjectWorkspaceSettingsType),
  ) => void;
  setBrowserCurrentUrl: (projectId: ProjectId, url: string) => void;
  setBrowserChromeExpanded: (projectId: ProjectId, expanded: boolean) => void;
  setBrowserSessionUrl: (projectId: ProjectId, sessionId: string, url: string) => void;
  setBrowserViewport: (
    projectId: ProjectId,
    input: {
      devicePreset: BrowserDevicePresetType;
      customWidth?: number | null;
      customHeight?: number | null;
      landscape?: boolean;
    },
  ) => void;
  setCodeFocusedPath: (projectId: ProjectId, path: string | null) => void;
  setSideChatOpen: (projectId: ProjectId, open: boolean) => void;
  setSideChatThread: (projectId: ProjectId, threadId: ThreadId | null) => void;
  setGitSelectedPath: (projectId: ProjectId, path: string | null) => void;
  setGitSelectedCommit: (projectId: ProjectId, commit: string | null) => void;
  setServerLogQuery: (projectId: ProjectId, processId: string, query: string) => void;
  // Pending-tab actions
  openPendingTab: (pendingId: string) => void;
  resolvePendingTab: (pendingId: string, projectId: ProjectId) => void;
  closePendingTab: (pendingId: string) => void;
}

export function createDefaultProjectWorkspaceSettings(): ProjectWorkspaceSettingsType {
  return decodeProjectWorkspaceSettings({});
}

function decodeProjectWorkspaceSettings(input: unknown): ProjectWorkspaceSettingsType {
  let toDecode = input;

  if (
    input !== null &&
    typeof input === "object" &&
    "serverProcesses" in input &&
    Array.isArray((input as any).serverProcesses)
  ) {
    const rawInput = input as any;
    toDecode = { ...rawInput };

    if (!("terminalProcesses" in rawInput) && !("serverPresets" in rawInput)) {
      (toDecode as any).terminalProcesses = rawInput.serverProcesses.filter(
        (p: any) => p && !p.autoStart,
      );
      (toDecode as any).serverPresets = rawInput.serverProcesses.filter(
        (p: any) => p && p.autoStart,
      );
    }
  }

  const decoded = decodeProjectWorkspaceSettingsSchema(toDecode);

  const normalizeProcess = (process: any) => {
    const normalizedCommands =
      process.commands && process.commands.length > 0
        ? process.commands
        : process.command && process.command.trim().length > 0
          ? [process.command.trim()]
          : [];

    const result: any = {
      id: process.id,
      label: process.label,
      commands: normalizedCommands,
      cwd: process.cwd || "",
      env: process.env || {},
      autoStart: Boolean(process.autoStart),
    };

    if (process.command) result.command = process.command;
    if (process.previewUrl !== undefined) result.previewUrl = process.previewUrl;
    if (process.autoOpenPreview !== undefined) result.autoOpenPreview = process.autoOpenPreview;
    if (process.previewOpenTarget !== undefined)
      result.previewOpenTarget = process.previewOpenTarget;
    if (process.previewFocus !== undefined) result.previewFocus = process.previewFocus;
    if (process.dependsOn !== undefined) result.dependsOn = process.dependsOn;

    return result;
  };

  return {
    ...decoded,
    terminalProcesses: (decoded.terminalProcesses || []).map(normalizeProcess),
    serverPresets: (decoded.serverPresets || []).map(normalizeProcess),
  };
}

function defaultBrowserToolState(settings: ProjectWorkspaceSettingsType): ProjectBrowserToolState {
  return {
    // Seed the live URL once, at creation, from the configured default. Empty is
    // allowed — it renders a blank "new tab" rather than forcing localhost:3000.
    // A later change to `browser.defaultUrl` never re-navigates an open tab
    // (upsertProjectSettings leaves an existing tab's currentUrl untouched).
    currentUrl: settings.browser.defaultUrl.trim(),
    devicePreset: Schema.decodeSync(BrowserDevicePreset)("project-default"),
    customWidth: null,
    customHeight: null,
    landscape: false,
  };
}

function defaultCodeToolState(): ProjectCodeToolState {
  return {
    lastFocusedPath: null,
    navigationNonce: 0,
    sideChatOpen: false,
    sideChatThreadId: null,
  };
}

function defaultGitToolState(): ProjectGitToolState {
  return {
    selectedPath: null,
    selectedCommit: null,
  };
}

/**
 * Stable, frozen singletons used as the fallback when a project has no per-tool
 * state yet. Zustand selectors compare the returned snapshot by reference, so a
 * fresh `{}` fallback would make the component re-render on EVERY store update
 * (until the project's state exists). Returning these constants keeps the
 * reference stable, so the component only re-renders when the real state changes.
 */
export const EMPTY_PROJECT_CODE_TOOL_STATE: ProjectCodeToolState = Object.freeze({
  lastFocusedPath: null,
  navigationNonce: 0,
  sideChatOpen: false,
  sideChatThreadId: null,
});
export const EMPTY_PROJECT_GIT_TOOL_STATE: ProjectGitToolState = Object.freeze({
  selectedPath: null,
  selectedCommit: null,
});

function defaultServerToolState(): ProjectServerToolState {
  return {
    logQueryByProcessId: {},
  };
}

function resolveVisibleTools(settings: ProjectWorkspaceSettingsType): ProjectToolDefinition[] {
  const customEmbedIds = new Set((settings.customEmbeds || []).map((embed) => embed.id));
  const terminalProcessIds = new Set(
    (settings.terminalProcesses || []).map((process) => process.id),
  );
  const visible = (settings.tools || []).filter((tool) => {
    if (!tool.visible) return false;
    if (tool.kind === "custom_embed") {
      return tool.customEmbedId ? customEmbedIds.has(tool.customEmbedId) : false;
    }
    if (tool.kind === "custom_process") {
      return tool.terminalProcessId ? terminalProcessIds.has(tool.terminalProcessId) : false;
    }
    return true;
  });
  return visible.length > 0 ? visible : [...createDefaultProjectWorkspaceSettings().tools];
}

function resolveActiveToolId(
  settings: ProjectWorkspaceSettingsType,
  requestedToolId: string | undefined,
): string {
  const visibleTools = resolveVisibleTools(settings);
  if (requestedToolId && visibleTools.some((tool) => tool.id === requestedToolId)) {
    return requestedToolId;
  }
  const defaultTool =
    visibleTools.find((tool) => tool.id === DEFAULT_PROJECT_TOOL_KIND) ??
    visibleTools.find((tool) => tool.kind === DEFAULT_PROJECT_TOOL_KIND);
  return defaultTool?.id ?? visibleTools[0]?.id ?? "agents";
}

function ensureProjectDefaults(
  state: WorkspaceShellPersistedState,
  projectId: ProjectId,
): WorkspaceShellPersistedState {
  const nextSettings =
    state.projectSettingsByProjectId[projectId] ?? createDefaultProjectWorkspaceSettings();
  return {
    ...state,
    projectSettingsByProjectId: {
      ...state.projectSettingsByProjectId,
      [projectId]: nextSettings,
    },
    browserStateByProjectId: {
      ...state.browserStateByProjectId,
      [projectId]:
        state.browserStateByProjectId[projectId] ?? defaultBrowserToolState(nextSettings),
    },
    codeStateByProjectId: {
      ...state.codeStateByProjectId,
      [projectId]: state.codeStateByProjectId[projectId] ?? defaultCodeToolState(),
    },
    gitStateByProjectId: {
      ...state.gitStateByProjectId,
      [projectId]: state.gitStateByProjectId[projectId] ?? defaultGitToolState(),
    },
    serverStateByProjectId: {
      ...state.serverStateByProjectId,
      [projectId]: state.serverStateByProjectId[projectId] ?? defaultServerToolState(),
    },
    session: {
      ...state.session,
      activeToolIdByProjectId: {
        ...state.session.activeToolIdByProjectId,
        [projectId]: resolveActiveToolId(
          nextSettings,
          state.session.activeToolIdByProjectId[projectId],
        ),
      },
    },
  };
}

export function createDefaultWorkspaceShellPersistedState(): WorkspaceShellPersistedState {
  return {
    session: decodeProjectWorkspaceSessionState({}),
    projectSettingsByProjectId: {},
    browserStateByProjectId: {},
    browserUrlBySessionKey: {},
    codeStateByProjectId: {},
    gitStateByProjectId: {},
    serverStateByProjectId: {},
  };
}

export function syncWorkspaceShellState(
  input: WorkspaceShellPersistedState,
  projects: ReadonlyArray<Project>,
  threads: ReadonlyArray<Thread>,
): WorkspaceShellPersistedState {
  const projectIds = new Set(projects.map((project) => project.id));
  let nextState = createDefaultWorkspaceShellPersistedState();
  // Preserve per-tab navigated URLs (keyed by `${projectId}:${sessionId}`) across
  // the project sync so tabs reopen where the user left them.
  nextState.browserUrlBySessionKey = { ...input.browserUrlBySessionKey };

  for (const project of projects) {
    nextState = ensureProjectDefaults(nextState, project.id);
    const settings = input.projectSettingsByProjectId[project.id];
    if (settings) {
      nextState.projectSettingsByProjectId[project.id] = decodeProjectWorkspaceSettings(settings);
      nextState.browserStateByProjectId[project.id] =
        input.browserStateByProjectId[project.id] ??
        defaultBrowserToolState(nextState.projectSettingsByProjectId[project.id]!);
    }
    if (input.codeStateByProjectId[project.id]) {
      nextState.codeStateByProjectId[project.id] = input.codeStateByProjectId[project.id]!;
    }
    if (input.gitStateByProjectId[project.id]) {
      nextState.gitStateByProjectId[project.id] = input.gitStateByProjectId[project.id]!;
    }
    if (input.serverStateByProjectId[project.id]) {
      nextState.serverStateByProjectId[project.id] = input.serverStateByProjectId[project.id]!;
    }
  }

  const openProjectIds = input.session.openProjectIds.filter((projectId) =>
    projectIds.has(projectId),
  );
  // Preserve pending tab IDs as-is — they have no server-side project to
  // resolve against, so the existing "resolve or drop" filter must not touch them.
  const pendingTabIds = [...(input.session.pendingTabIds ?? [])];
  const nextOpenProjectIds = openProjectIds;
  const activeProjectId =
    input.session.activeProjectId &&
    projectIds.has(input.session.activeProjectId) &&
    nextOpenProjectIds.includes(input.session.activeProjectId)
      ? input.session.activeProjectId
      : (nextOpenProjectIds[0] ?? null);
  // Preserve activePendingTabId only if the pending tab still exists.
  const activePendingTabId =
    input.session.activePendingTabId && pendingTabIds.includes(input.session.activePendingTabId)
      ? input.session.activePendingTabId
      : null;
  const rememberedThreadIdByProjectId: Record<ProjectId, ThreadId> = {};
  const threadIds = new Set(threads.map((thread) => thread.id));
  for (const [projectId, threadId] of Object.entries(
    input.session.rememberedThreadIdByProjectId,
  ) as Array<[ProjectId, ThreadId]>) {
    if (!projectIds.has(projectId) || !threadIds.has(threadId)) {
      continue;
    }
    rememberedThreadIdByProjectId[projectId] = threadId;
  }

  const activeToolIdByProjectId: Record<ProjectId, string> = {};
  for (const project of projects) {
    activeToolIdByProjectId[project.id] = resolveActiveToolId(
      nextState.projectSettingsByProjectId[project.id] ?? createDefaultProjectWorkspaceSettings(),
      input.session.activeToolIdByProjectId[project.id],
    );
  }

  nextState.session = {
    openProjectIds: nextOpenProjectIds,
    activeProjectId,
    pendingTabIds,
    activePendingTabId,
    activeToolIdByProjectId,
    rememberedThreadIdByProjectId,
  };

  // Reset browser URL to default if resumeLastVisitedPage is disabled
  for (const project of projects) {
    const settings = nextState.projectSettingsByProjectId[project.id];
    const browserState = nextState.browserStateByProjectId[project.id];
    if (settings && browserState && settings.browser.resumeLastVisitedPage === false) {
      browserState.currentUrl = settings.browser.defaultUrl.trim();
    }
  }

  return nextState;
}

export function resolveProjectTools(
  settings: ProjectWorkspaceSettingsType,
): ProjectToolDefinition[] {
  return resolveVisibleTools(settings);
}

export const useWorkspaceShellStore = create<WorkspaceShellStore>()(
  persist(
    (set) => ({
      ...createDefaultWorkspaceShellPersistedState(),
      syncProjects: (projects, threads) =>
        set((state) => syncWorkspaceShellState(state, projects, threads)),
      openProject: (projectId) =>
        set((state) => {
          const projectSettings =
            state.projectSettingsByProjectId[projectId] ?? createDefaultProjectWorkspaceSettings();
          const openProjectIds = state.session.openProjectIds.includes(projectId)
            ? state.session.openProjectIds
            : [...state.session.openProjectIds, projectId];
          return ensureProjectDefaults(
            {
              ...state,
              session: {
                ...state.session,
                openProjectIds,
                activeProjectId: projectId,
                activePendingTabId: null,
                activeToolIdByProjectId: {
                  ...state.session.activeToolIdByProjectId,
                  [projectId]: resolveActiveToolId(
                    projectSettings,
                    state.session.activeToolIdByProjectId[projectId],
                  ),
                },
              },
            },
            projectId,
          );
        }),
      closeProject: (projectId) =>
        set((state) => {
          const openProjectIds = state.session.openProjectIds.filter((id) => id !== projectId);
          const wasActive = state.session.activeProjectId === projectId;
          // When closing the active project, fall back to: another real project
          // first, then a pending tab (setting activePendingTabId, not activeProjectId),
          // then null if all tabs are gone.
          const nextActiveProjectId = wasActive
            ? (openProjectIds[openProjectIds.length - 1] ?? null)
            : state.session.activeProjectId;
          const nextActivePendingTabId =
            wasActive && !nextActiveProjectId
              ? (state.session.pendingTabIds[state.session.pendingTabIds.length - 1] ??
                state.session.activePendingTabId)
              : state.session.activePendingTabId;
          return {
            ...state,
            session: {
              ...state.session,
              openProjectIds,
              activeProjectId: nextActiveProjectId,
              activePendingTabId: nextActivePendingTabId,
            },
          };
        }),

      setActiveProject: (projectId) =>
        set((state) => ({
          ...state,
          session: {
            ...state.session,
            activeProjectId: projectId,
            activePendingTabId: null,
            openProjectIds:
              projectId && !state.session.openProjectIds.includes(projectId)
                ? [...state.session.openProjectIds, projectId]
                : state.session.openProjectIds,
          },
        })),
      setActiveTool: (projectId, toolId) =>
        set((state) => ({
          ...state,
          session: {
            ...state.session,
            activeToolIdByProjectId: {
              ...state.session.activeToolIdByProjectId,
              [projectId]: toolId,
            },
          },
        })),
      rememberThread: (projectId, threadId) =>
        set((state) => ({
          ...state,
          session: {
            ...state.session,
            rememberedThreadIdByProjectId: {
              ...state.session.rememberedThreadIdByProjectId,
              [projectId]: threadId,
            },
          },
        })),
      upsertProjectSettings: (projectId, updater) =>
        set((state) => {
          const current =
            state.projectSettingsByProjectId[projectId] ?? createDefaultProjectWorkspaceSettings();
          const nextSettings = decodeProjectWorkspaceSettings(
            typeof updater === "function" ? updater(current) : { ...current, ...updater },
          );
          return {
            ...state,
            projectSettingsByProjectId: {
              ...state.projectSettingsByProjectId,
              [projectId]: nextSettings,
            },
            // `browser.defaultUrl` is the template for *new* browser tabs only.
            // Never re-write an existing tab's live `currentUrl` from a settings
            // change — otherwise editing the default re-navigates open tabs. Seed
            // a fresh entry only when one doesn't exist yet.
            browserStateByProjectId: state.browserStateByProjectId[projectId]
              ? state.browserStateByProjectId
              : {
                  ...state.browserStateByProjectId,
                  [projectId]: defaultBrowserToolState(nextSettings),
                },
            session: {
              ...state.session,
              activeToolIdByProjectId: {
                ...state.session.activeToolIdByProjectId,
                [projectId]: resolveActiveToolId(
                  nextSettings,
                  state.session.activeToolIdByProjectId[projectId],
                ),
              },
            },
          };
        }),
      setBrowserCurrentUrl: (projectId, url) =>
        set((state) => {
          const currentState =
            state.browserStateByProjectId[projectId] ??
            defaultBrowserToolState(
              state.projectSettingsByProjectId[projectId] ??
                createDefaultProjectWorkspaceSettings(),
            );
          if (currentState.currentUrl === url) {
            return state;
          }
          return {
            ...state,
            browserStateByProjectId: {
              ...state.browserStateByProjectId,
              [projectId]: {
                ...currentState,
                currentUrl: url,
              },
            },
          };
        }),
      setBrowserChromeExpanded: (projectId, expanded) =>
        set((state) => {
          const currentState =
            state.browserStateByProjectId[projectId] ??
            defaultBrowserToolState(
              state.projectSettingsByProjectId[projectId] ??
                createDefaultProjectWorkspaceSettings(),
            );
          if (currentState.chromeExpanded === expanded) {
            return state;
          }
          return {
            ...state,
            browserStateByProjectId: {
              ...state.browserStateByProjectId,
              [projectId]: {
                ...currentState,
                chromeExpanded: expanded,
              },
            },
          };
        }),
      setBrowserSessionUrl: (projectId, sessionId, url) =>
        set((state) => {
          const key = `${projectId}:${sessionId}`;
          if (state.browserUrlBySessionKey[key] === url) {
            return state;
          }
          return {
            ...state,
            browserUrlBySessionKey: {
              ...state.browserUrlBySessionKey,
              [key]: url,
            },
          };
        }),
      setBrowserViewport: (projectId, input) =>
        set((state) => ({
          ...state,
          browserStateByProjectId: {
            ...state.browserStateByProjectId,
            [projectId]: {
              ...(state.browserStateByProjectId[projectId] ??
                defaultBrowserToolState(
                  state.projectSettingsByProjectId[projectId] ??
                    createDefaultProjectWorkspaceSettings(),
                )),
              devicePreset: input.devicePreset,
              customWidth:
                input.customWidth !== undefined
                  ? input.customWidth
                  : (state.browserStateByProjectId[projectId]?.customWidth ?? null),
              customHeight:
                input.customHeight !== undefined
                  ? input.customHeight
                  : (state.browserStateByProjectId[projectId]?.customHeight ?? null),
              landscape:
                input.landscape !== undefined
                  ? input.landscape
                  : (state.browserStateByProjectId[projectId]?.landscape ?? false),
            },
          },
        })),
      setCodeFocusedPath: (projectId, path) =>
        set((state) => ({
          ...state,
          codeStateByProjectId: {
            ...state.codeStateByProjectId,
            [projectId]: {
              ...(state.codeStateByProjectId[projectId] ?? defaultCodeToolState()),
              lastFocusedPath: path,
              navigationNonce: (state.codeStateByProjectId[projectId]?.navigationNonce ?? 0) + 1,
            },
          },
        })),
      setSideChatOpen: (projectId, open) =>
        set((state) => ({
          ...state,
          codeStateByProjectId: {
            ...state.codeStateByProjectId,
            [projectId]: {
              ...(state.codeStateByProjectId[projectId] ?? defaultCodeToolState()),
              sideChatOpen: open,
            },
          },
        })),
      setSideChatThread: (projectId, threadId) =>
        set((state) => ({
          ...state,
          codeStateByProjectId: {
            ...state.codeStateByProjectId,
            [projectId]: {
              ...(state.codeStateByProjectId[projectId] ?? defaultCodeToolState()),
              sideChatThreadId: threadId,
            },
          },
        })),
      setGitSelectedPath: (projectId, path) =>
        set((state) => ({
          ...state,
          gitStateByProjectId: {
            ...state.gitStateByProjectId,
            [projectId]: {
              ...(state.gitStateByProjectId[projectId] ?? defaultGitToolState()),
              selectedPath: path,
              selectedCommit: path
                ? null
                : (state.gitStateByProjectId[projectId]?.selectedCommit ?? null),
            },
          },
        })),
      setGitSelectedCommit: (projectId, commit) =>
        set((state) => ({
          ...state,
          gitStateByProjectId: {
            ...state.gitStateByProjectId,
            [projectId]: {
              ...(state.gitStateByProjectId[projectId] ?? defaultGitToolState()),
              selectedPath: commit
                ? null
                : (state.gitStateByProjectId[projectId]?.selectedPath ?? null),
              selectedCommit: commit,
            },
          },
        })),
      setServerLogQuery: (projectId, processId, query) =>
        set((state) => ({
          ...state,
          serverStateByProjectId: {
            ...state.serverStateByProjectId,
            [projectId]: {
              ...(state.serverStateByProjectId[projectId] ?? defaultServerToolState()),
              logQueryByProcessId: {
                ...state.serverStateByProjectId[projectId]?.logQueryByProcessId,
                [processId]: query,
              },
            },
          },
        })),

      // ── Pending-tab actions ──────────────────────────────────────────────────

      openPendingTab: (pendingId) =>
        set((state) => ({
          ...state,
          session: {
            ...state.session,
            // Append the new pending tab to the end of the tab strip, but only
            // if it isn't already there (idempotent).
            pendingTabIds: state.session.pendingTabIds.includes(pendingId)
              ? state.session.pendingTabIds
              : [...state.session.pendingTabIds, pendingId],
            activePendingTabId: pendingId,
            // Clear the real active project so the content area shows the landing
            // screen for this pending tab.
            activeProjectId: null,
          },
        })),

      resolvePendingTab: (pendingId, projectId) =>
        set((state) => {
          // Replace the pending slot with the real project ID at the same position
          // in the combined tab strip (pending tabs interleave with real tabs).
          const pendingTabIds = state.session.pendingTabIds.filter((id) => id !== pendingId);
          const openProjectIds = state.session.openProjectIds.includes(projectId)
            ? state.session.openProjectIds
            : [...state.session.openProjectIds, projectId];
          const projectSettings =
            state.projectSettingsByProjectId[projectId] ?? createDefaultProjectWorkspaceSettings();
          return ensureProjectDefaults(
            {
              ...state,
              session: {
                ...state.session,
                pendingTabIds,
                activePendingTabId: null,
                openProjectIds,
                activeProjectId: projectId,
                activeToolIdByProjectId: {
                  ...state.session.activeToolIdByProjectId,
                  [projectId]: resolveActiveToolId(
                    projectSettings,
                    state.session.activeToolIdByProjectId[projectId],
                  ),
                },
              },
            },
            projectId,
          );
        }),

      closePendingTab: (pendingId) =>
        set((state) => {
          const pendingTabIds = state.session.pendingTabIds.filter((id) => id !== pendingId);
          const wasActive = state.session.activePendingTabId === pendingId;
          // On close, fall back to the last real open project, or the last
          // remaining pending tab, or null (all tabs gone).
          const nextActivePendingTabId = wasActive
            ? (pendingTabIds[pendingTabIds.length - 1] ?? null)
            : state.session.activePendingTabId;
          const nextActiveProjectId = wasActive
            ? nextActivePendingTabId
              ? null
              : (state.session.openProjectIds[state.session.openProjectIds.length - 1] ?? null)
            : state.session.activeProjectId;
          return {
            ...state,
            session: {
              ...state.session,
              pendingTabIds,
              activePendingTabId: nextActivePendingTabId,
              activeProjectId: nextActiveProjectId,
            },
          };
        }),
    }),
    {
      name: WORKSPACE_SHELL_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Bump version whenever persisted shape changes to force a clean reset.
      // Version 2: Clear corrupted data written by partial Python-script refactor.
      version: 2,
      migrate: (_persistedState: unknown, _version: number) => {
        // Any state from version < 2 is potentially corrupted — start fresh.
        return createDefaultWorkspaceShellPersistedState();
      },
      partialize: (state) => ({
        session: state.session,
        projectSettingsByProjectId: state.projectSettingsByProjectId,
        browserStateByProjectId: state.browserStateByProjectId,
        browserUrlBySessionKey: state.browserUrlBySessionKey,
        codeStateByProjectId: state.codeStateByProjectId,
        gitStateByProjectId: state.gitStateByProjectId,
        serverStateByProjectId: state.serverStateByProjectId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Sanitize session
        if (state.session) {
          state.session = {
            ...state.session,
            openProjectIds: state.session.openProjectIds ?? [],
            pendingTabIds: state.session.pendingTabIds ?? [],
            activePendingTabId: state.session.activePendingTabId ?? null,
            activeProjectId: state.session.activeProjectId ?? null,
            activeToolIdByProjectId: state.session.activeToolIdByProjectId ?? {},
            rememberedThreadIdByProjectId: state.session.rememberedThreadIdByProjectId ?? {},
          };
        }
        // Sanitize each project's settings so arrays are never undefined
        if (state.projectSettingsByProjectId) {
          const sanitized: typeof state.projectSettingsByProjectId = {};
          for (const [id, settings] of Object.entries(state.projectSettingsByProjectId)) {
            sanitized[id as keyof typeof sanitized] = {
              ...settings,
              tools: settings.tools ?? [],
              terminalProcesses: settings.terminalProcesses ?? [],
              serverPresets: settings.serverPresets ?? [],
              customEmbeds: settings.customEmbeds ?? [],
              browser: settings.browser ?? { defaultUrl: "", openExternalByDefault: false },
            };
          }
          state.projectSettingsByProjectId = sanitized;
        }
      },
    },
  ),
);

export function useProjectWorkspaceSettings(
  projectId: ProjectId | null,
): ProjectWorkspaceSettingsType | null {
  return useWorkspaceShellStore((state) =>
    projectId
      ? (state.projectSettingsByProjectId[projectId] ?? createDefaultProjectWorkspaceSettings())
      : null,
  );
}

export function useResolvedProjectTools(projectId: ProjectId | null): ProjectToolDefinition[] {
  return useWorkspaceShellStore((state) => {
    if (!projectId) {
      return [...createDefaultProjectWorkspaceSettings().tools];
    }
    return resolveProjectTools(
      state.projectSettingsByProjectId[projectId] ?? createDefaultProjectWorkspaceSettings(),
    );
  });
}

export function resolveDefaultProjectToolOrder(): typeof DEFAULT_PROJECT_TOOL_ORDER {
  return DEFAULT_PROJECT_TOOL_ORDER;
}
