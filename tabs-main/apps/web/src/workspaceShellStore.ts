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

const decodeProjectWorkspaceSettingsSchema = Schema.decodeUnknownSync(ProjectWorkspaceSettings);
const decodeProjectWorkspaceSessionState = Schema.decodeSync(ProjectWorkspaceSessionState);

export interface ProjectBrowserToolState {
  currentUrl: string;
  devicePreset: BrowserDevicePresetType;
  customWidth: number | null;
  customHeight: number | null;
  landscape: boolean;
}

export interface ProjectCodeToolState {
  lastFocusedPath: string | null;
  navigationNonce: number;
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
  setGitSelectedPath: (projectId: ProjectId, path: string | null) => void;
  setGitSelectedCommit: (projectId: ProjectId, commit: string | null) => void;
  setServerLogQuery: (projectId: ProjectId, processId: string, query: string) => void;
}

function createDefaultProjectWorkspaceSettings(): ProjectWorkspaceSettingsType {
  return decodeProjectWorkspaceSettings({});
}

function decodeProjectWorkspaceSettings(input: unknown): ProjectWorkspaceSettingsType {
  const decoded = decodeProjectWorkspaceSettingsSchema(input);
  return {
    ...decoded,
    serverProcesses: decoded.serverProcesses.map((process) => {
      const normalizedCommands =
        process.commands.length > 0
          ? process.commands
          : process.command && process.command.trim().length > 0
            ? [process.command.trim()]
            : [];
      if (process.command) {
        return {
          id: process.id,
          label: process.label,
          command: process.command,
          commands: normalizedCommands,
          cwd: process.cwd,
          env: process.env,
          autoStart: process.autoStart,
        };
      }
      return {
        id: process.id,
        label: process.label,
        commands: normalizedCommands,
        cwd: process.cwd,
        env: process.env,
        autoStart: process.autoStart,
      };
    }),
  };
}

function defaultBrowserToolState(settings: ProjectWorkspaceSettingsType): ProjectBrowserToolState {
  return {
    // Seed the live URL once, at creation. Keep it non-empty so a later change to
    // `browser.defaultUrl` (the template for new tabs) can never retroactively
    // re-navigate this already-open tab.
    currentUrl: settings.browser.defaultUrl.trim() || "http://localhost:3000",
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
  };
}

function defaultGitToolState(): ProjectGitToolState {
  return {
    selectedPath: null,
    selectedCommit: null,
  };
}

function defaultServerToolState(): ProjectServerToolState {
  return {
    logQueryByProcessId: {},
  };
}

function resolveVisibleTools(settings: ProjectWorkspaceSettingsType): ProjectToolDefinition[] {
  const customEmbedIds = new Set(settings.customEmbeds.map((embed) => embed.id));
  const serverProcessIds = new Set(settings.serverProcesses.map((process) => process.id));
  const visible = settings.tools.filter((tool) => {
    if (!tool.visible) return false;
    if (tool.kind === "custom_embed") {
      return tool.customEmbedId ? customEmbedIds.has(tool.customEmbedId) : false;
    }
    if (tool.kind === "custom_process") {
      return tool.serverProcessId ? serverProcessIds.has(tool.serverProcessId) : false;
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
  const nextOpenProjectIds = openProjectIds;
  const activeProjectId =
    input.session.activeProjectId &&
    projectIds.has(input.session.activeProjectId) &&
    nextOpenProjectIds.includes(input.session.activeProjectId)
      ? input.session.activeProjectId
      : (nextOpenProjectIds[0] ?? null);
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
    activeToolIdByProjectId,
    rememberedThreadIdByProjectId,
  };
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
          const nextActiveProjectId =
            state.session.activeProjectId === projectId
              ? (openProjectIds[openProjectIds.length - 1] ?? null)
              : state.session.activeProjectId;
          return {
            ...state,
            session: {
              ...state.session,
              openProjectIds,
              activeProjectId: nextActiveProjectId,
            },
          };
        }),
      setActiveProject: (projectId) =>
        set((state) => ({
          ...state,
          session: {
            ...state.session,
            activeProjectId: projectId,
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
    }),
    {
      name: WORKSPACE_SHELL_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        session: state.session,
        projectSettingsByProjectId: state.projectSettingsByProjectId,
        browserStateByProjectId: state.browserStateByProjectId,
        codeStateByProjectId: state.codeStateByProjectId,
        gitStateByProjectId: state.gitStateByProjectId,
        serverStateByProjectId: state.serverStateByProjectId,
      }),
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
