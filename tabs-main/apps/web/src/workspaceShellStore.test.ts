import { DEFAULT_MODEL_BY_PROVIDER, ProjectId, ThreadId } from "@tabs/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE, type Project, type Thread } from "./types";

let createDefaultWorkspaceShellPersistedState: typeof import("./workspaceShellStore").createDefaultWorkspaceShellPersistedState;
let syncWorkspaceShellState: typeof import("./workspaceShellStore").syncWorkspaceShellState;
let useWorkspaceShellStore: typeof import("./workspaceShellStore").useWorkspaceShellStore;
type WorkspaceShellPersistedState = import("./workspaceShellStore").WorkspaceShellPersistedState;

function makeProject(id: string, cwd = `/tmp/${id}`): Project {
  return {
    id: ProjectId.makeUnsafe(id),
    name: id,
    cwd,
    defaultModelSelection: {
      provider: "codex",
      model: DEFAULT_MODEL_BY_PROVIDER.codex,
    },
    expanded: true,
    scripts: [],
  };
}

function makeThread(id: string, projectId: Project["id"]): Thread {
  return {
    id: ThreadId.makeUnsafe(id),
    codexThreadId: null,
    projectId,
    title: id,
    modelSelection: {
      provider: "codex",
      model: DEFAULT_MODEL_BY_PROVIDER.codex,
    },
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    session: null,
    messages: [],
    proposedPlans: [],
    error: null,
    createdAt: "2026-03-27T00:00:00.000Z",
    updatedAt: "2026-03-27T00:00:00.000Z",
    latestTurn: null,
    lastVisitedAt: undefined,
    branch: null,
    worktreePath: null,
    turnDiffSummaries: [],
    activities: [],
  };
}

function createLocalStorageStub() {
  const state = new Map<string, string>();
  return {
    clear: () => state.clear(),
    getItem: (key: string) => state.get(key) ?? null,
    key: (index: number) => Array.from(state.keys())[index] ?? null,
    removeItem: (key: string) => {
      state.delete(key);
    },
    setItem: (key: string, value: string) => {
      state.set(key, String(value));
    },
    get length() {
      return state.size;
    },
  };
}

describe("workspaceShellStore", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", createLocalStorageStub());
    ({
      createDefaultWorkspaceShellPersistedState,
      syncWorkspaceShellState,
      useWorkspaceShellStore,
    } = await import("./workspaceShellStore"));
    useWorkspaceShellStore.setState(createDefaultWorkspaceShellPersistedState());
  });

  it("isolates the active tool and browser state per project", () => {
    const projectAlpha = ProjectId.makeUnsafe("project-alpha");
    const projectBeta = ProjectId.makeUnsafe("project-beta");
    const store = useWorkspaceShellStore.getState();

    store.openProject(projectAlpha);
    store.openProject(projectBeta);
    store.setActiveTool(projectAlpha, "git");
    store.setActiveTool(projectBeta, "browser");
    store.setBrowserCurrentUrl(projectAlpha, "http://localhost:3001");
    store.setBrowserCurrentUrl(projectBeta, "http://localhost:5173");

    const state = useWorkspaceShellStore.getState();
    expect(state.session.activeToolIdByProjectId[projectAlpha]).toBe("git");
    expect(state.session.activeToolIdByProjectId[projectBeta]).toBe("browser");
    expect(state.browserStateByProjectId[projectAlpha]?.currentUrl).toBe("http://localhost:3001");
    expect(state.browserStateByProjectId[projectBeta]?.currentUrl).toBe("http://localhost:5173");
  });

  it("falls back to the default tool when a persisted active tool becomes hidden", () => {
    const projectId = ProjectId.makeUnsafe("project-shell");
    const store = useWorkspaceShellStore.getState();

    store.openProject(projectId);
    store.setActiveTool(projectId, "git");
    store.upsertProjectSettings(projectId, (current) => ({
      ...current,
      tools: current.tools.map((tool) => (tool.id === "git" ? { ...tool, visible: false } : tool)),
    }));

    const state = useWorkspaceShellStore.getState();
    // Defaults to the Agents tab (DEFAULT_PROJECT_TOOL_KIND) — not the heavy
    // Code-OSS editor, which would cold-boot on every fresh load.
    expect(state.session.activeToolIdByProjectId[projectId]).toBe("agents");
  });

  it("syncs persisted shell state against available projects and valid threads", () => {
    const alpha = makeProject("project-alpha");
    const beta = makeProject("project-beta");
    const alphaThread = makeThread("thread-alpha", alpha.id);
    const gammaProjectId = ProjectId.makeUnsafe("project-gamma");

    const baseState = createDefaultWorkspaceShellPersistedState();
    const input: WorkspaceShellPersistedState = {
      ...baseState,
      session: {
        ...baseState.session,
        openProjectIds: [alpha.id, gammaProjectId],
        activeProjectId: gammaProjectId,
        activeToolIdByProjectId: {
          [alpha.id]: "git",
          [beta.id]: "browser",
          [gammaProjectId]: "server",
        },
        rememberedThreadIdByProjectId: {
          [alpha.id]: alphaThread.id,
          [beta.id]: ThreadId.makeUnsafe("thread-missing"),
        },
      },
      projectSettingsByProjectId: {
        [alpha.id]: {
          tools: [
            {
              id: "agents",
              kind: "agents" as const,
              label: "Agents",
              visible: true,
            },
            {
              id: "git",
              kind: "git" as const,
              label: "Git",
              visible: true,
            },
          ],
          browser: {
            defaultUrl: "http://localhost:3000",
            openExternalByDefault: false,
          },
          serverProcesses: [],
          customEmbeds: [],
        },
      },
    };

    const next = syncWorkspaceShellState(input, [alpha, beta], [alphaThread]);

    expect(next.session.openProjectIds).toEqual([alpha.id]);
    expect(next.session.activeProjectId).toBe(alpha.id);
    expect(next.session.activeToolIdByProjectId[alpha.id]).toBe("git");
    expect(next.session.activeToolIdByProjectId[beta.id]).toBe("browser");
    expect(next.session.rememberedThreadIdByProjectId).toEqual({
      [alpha.id]: alphaThread.id,
    });
    expect(next.projectSettingsByProjectId[beta.id]).toBeDefined();
    expect(next.browserStateByProjectId[beta.id]).toBeDefined();
  });

  it("drops custom terminal tools that no longer have a backing process", () => {
    const project = makeProject("project-terminal");
    const baseState = createDefaultWorkspaceShellPersistedState();

    const next = syncWorkspaceShellState(
      {
        ...baseState,
        session: {
          ...baseState.session,
          openProjectIds: [project.id],
          activeProjectId: project.id,
          activeToolIdByProjectId: {
            [project.id]: "terminal-frontend",
          },
        },
        projectSettingsByProjectId: {
          [project.id]: {
            tools: [
              {
                id: "code",
                kind: "code",
                label: "Code",
                visible: true,
              },
              {
                id: "terminal-frontend",
                kind: "custom_process",
                label: "Frontend",
                visible: true,
                serverProcessId: "frontend",
              },
            ],
            browser: {
              defaultUrl: "",
              openExternalByDefault: false,
            },
            serverProcesses: [],
            customEmbeds: [],
          },
        },
      },
      [project],
      [],
    );

    expect(next.session.activeToolIdByProjectId[project.id]).toBe("code");
  });

  it("clears open tabs when synced against an empty project list (why callers must gate on hydration)", () => {
    // syncWorkspaceShellState rebuilds from scratch and keeps only tabs whose
    // project is present in `projects`. If a caller runs it before the server
    // read model has loaded (projects still []), it wipes the restored
    // workspace. WorkspaceShell therefore gates the sync effect on
    // `threadsHydrated`; this test pins the clobbering behavior so that gate is
    // never removed without understanding the consequence.
    const project = makeProject("project-prehydration");
    const baseState = createDefaultWorkspaceShellPersistedState();

    const input: WorkspaceShellPersistedState = {
      ...baseState,
      session: {
        ...baseState.session,
        openProjectIds: [project.id],
        activeProjectId: project.id,
      },
    };

    const next = syncWorkspaceShellState(input, [], []);

    expect(next.session.openProjectIds).toEqual([]);
    expect(next.session.activeProjectId).toBeNull();
  });

  it("restores custom terminal and browser tabs (plus per-tab URLs) when the project id is stable", () => {
    const project = makeProject("project-restore");
    const baseState = createDefaultWorkspaceShellPersistedState();
    const browserSessionKey = `${project.id}:browser-figma`;

    const input: WorkspaceShellPersistedState = {
      ...baseState,
      session: {
        ...baseState.session,
        openProjectIds: [project.id],
        activeProjectId: project.id,
        activeToolIdByProjectId: {
          [project.id]: "terminal-frontend",
        },
      },
      browserUrlBySessionKey: {
        [browserSessionKey]: "https://figma.com/file/abc",
      },
      projectSettingsByProjectId: {
        [project.id]: {
          tools: [
            { id: "agents", kind: "agents", label: "Agents", visible: true },
            {
              id: "terminal-frontend",
              kind: "custom_process",
              label: "Frontend",
              visible: true,
              serverProcessId: "frontend",
            },
            {
              id: "browser-figma",
              kind: "custom_embed",
              label: "Figma",
              visible: true,
              customEmbedId: "figma",
            },
          ],
          browser: { defaultUrl: "", openExternalByDefault: false },
          serverProcesses: [
            {
              id: "frontend",
              label: "Frontend",
              commands: ["npm run dev"],
              cwd: "",
              env: {},
              autoStart: false,
            },
          ],
          customEmbeds: [{ id: "figma", label: "Figma", url: "https://figma.com" }],
        },
      },
    };

    const next = syncWorkspaceShellState(input, [project], []);

    const restoredTools = next.projectSettingsByProjectId[project.id]?.tools ?? [];
    // Both custom tabs survive the project sync, so they reappear on reopen.
    expect(restoredTools.some((tool) => tool.id === "terminal-frontend")).toBe(true);
    expect(restoredTools.some((tool) => tool.id === "browser-figma")).toBe(true);
    // The active tool (the custom terminal) and the project itself are restored.
    expect(next.session.openProjectIds).toEqual([project.id]);
    expect(next.session.activeToolIdByProjectId[project.id]).toBe("terminal-frontend");
    // The per-tab browser URL is preserved so the tab reopens where it was.
    expect(next.browserUrlBySessionKey[browserSessionKey]).toBe("https://figma.com/file/abc");
  });
});
