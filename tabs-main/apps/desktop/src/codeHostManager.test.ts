import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { webContentsViews, MockWebContentsView } = vi.hoisted(() => {
  class MockWebContentsView {
    readonly webContents = {
      loadURL: vi.fn(async (url: string) => {
        this.loadedUrls.push(url);
      }),
      close: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      executeJavaScript: vi.fn(async () => null),
      isDestroyed: vi.fn(() => false),
      isLoading: vi.fn(() => false),
      stop: vi.fn(),
    };

    readonly loadedUrls: string[] = [];
    bounds: { x: number; y: number; width: number; height: number } | null = null;

    constructor(_options: unknown) {
      webContentsViews.push(this);
    }

    setBackgroundColor(_color: string): void {}

    setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
      this.bounds = bounds;
    }
  }

  const webContentsViews: MockWebContentsView[] = [];

  return { webContentsViews, MockWebContentsView };
});

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/mock-user-data") },
  WebContentsView: MockWebContentsView,
}));

import {
  CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
  CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH,
  CODE_OSS_NLS_MESSAGES_RELATIVE_PATH,
  CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH,
  CodeHostManager,
  filterWorkspaceTabs,
  isPathInsideWorkspace,
  mergeProductConfigurationDefaults,
  reconcileSharedExtensionRegistry,
  readWorkspaceTabs,
  resolveCodeHostConfig,
  writeWorkspaceTabs,
} from "./codeHostManager";

describe("reconcileSharedExtensionRegistry", () => {
  it("keeps valid registrations and removes stale workspace registrations", () => {
    const stateDir = makeTempDir("tabs-extension-registry-");
    const desktopRoot = Path.join(stateDir, "code-oss-desktop");
    const extensionsDir = Path.join(desktopRoot, "extensions");
    const validExtensionDir = Path.join(extensionsDir, "openai.chatgpt-1.0.0");
    FS.mkdirSync(validExtensionDir, { recursive: true });
    FS.writeFileSync(Path.join(validExtensionDir, "package.json"), "{}");

    const workspaceRegistry = Path.join(desktopRoot, "workspace", "profile", "default");
    FS.mkdirSync(workspaceRegistry, { recursive: true });
    FS.writeFileSync(
      Path.join(workspaceRegistry, "extensions.json"),
      JSON.stringify([
        {
          identifier: { id: "openai.chatgpt" },
          version: "1.0.0",
          relativeLocation: "openai.chatgpt-1.0.0",
          metadata: { installedTimestamp: 2 },
        },
        {
          identifier: { id: "coderabbit.coderabbit-vscode" },
          version: "0.21.4",
          relativeLocation: "coderabbit.coderabbit-vscode-0.21.4-universal",
          metadata: { installedTimestamp: 3 },
        },
      ]),
    );

    const sharedRegistry = reconcileSharedExtensionRegistry(stateDir);

    expect(JSON.parse(FS.readFileSync(sharedRegistry, "utf8"))).toEqual([
      expect.objectContaining({ identifier: { id: "openai.chatgpt" }, version: "1.0.0" }),
    ]);
  });
});

function makeTempDir(prefix: string): string {
  return FS.mkdtempSync(Path.join(OS.tmpdir(), prefix));
}

function writeVsCodeDesktopCheckout(rootDir: string): void {
  for (const relativePath of [
    CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
    CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH,
    CODE_OSS_NLS_MESSAGES_RELATIVE_PATH,
    CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH,
  ]) {
    const absolutePath = Path.join(rootDir, relativePath);
    FS.mkdirSync(Path.dirname(absolutePath), { recursive: true });
    FS.writeFileSync(absolutePath, absolutePath.endsWith(".json") ? "{}" : "// test");
  }
}

function createMockWindow() {
  const views: InstanceType<typeof MockWebContentsView>[] = [];
  return {
    contentView: {
      children: views,
      addChildView: vi.fn((view: InstanceType<typeof MockWebContentsView>) => {
        if (!views.includes(view)) views.push(view);
      }),
      removeChildView: vi.fn((view: InstanceType<typeof MockWebContentsView>) => {
        const index = views.indexOf(view);
        if (index >= 0) views.splice(index, 1);
      }),
    },
  };
}

describe("resolveCodeHostConfig", () => {
  it("selects desktop renderer when desktop assets exist", () => {
    const rootDir = makeTempDir("tabs-codehost-root-");
    const vscodeRoot = makeTempDir("vscode-root-");
    writeVsCodeDesktopCheckout(vscodeRoot);

    const config = resolveCodeHostConfig({
      rootDir,
      env: {
        TABS_CODE_OSS_BUILD_DIR: vscodeRoot,
      },
    });

    expect(config.state.available).toBe(true);
    expect(config.runtime).toMatchObject({
      kind: "desktop-renderer",
      vscodeRoot,
    });
  });

  it("selects a sibling desktop runtime", () => {
    const parentDir = makeTempDir("tabs-parent-");
    const rootDir = Path.join(parentDir, "tabs-main");
    const vscodeMainDir = Path.join(parentDir, "tabs-code-main");
    FS.mkdirSync(rootDir, { recursive: true });
    writeVsCodeDesktopCheckout(vscodeMainDir);

    const config = resolveCodeHostConfig({
      rootDir,
      env: {},
    });

    expect(config.state.available).toBe(true);
    expect(config.runtime).toMatchObject({
      kind: "desktop-renderer",
      vscodeRoot: vscodeMainDir,
    });
  });

  it("returns an actionable message when the desktop build is missing", () => {
    const parentDir = makeTempDir("tabs-parent-");
    const rootDir = Path.join(parentDir, "tabs-main");
    const vscodeMainDir = Path.join(parentDir, "tabs-code-main");
    FS.mkdirSync(rootDir, { recursive: true });
    FS.mkdirSync(vscodeMainDir, { recursive: true });
    const markerPath = Path.join(vscodeMainDir, CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH);
    FS.mkdirSync(Path.dirname(markerPath), { recursive: true });
    FS.writeFileSync(markerPath, "// incomplete desktop build");

    const config = resolveCodeHostConfig({
      rootDir,
      env: {},
    });

    expect(config.state.available).toBe(false);
    expect(config.state.reason).toContain("Code-OSS desktop runtime not found");
    expect(config.state.reason).toContain("npm run compile");
    expect(config.state.reason).toContain("tabs-code-main");
  });
});

describe("mergeProductConfigurationDefaults", () => {
  const defaults = { "security.workspace.trust.enabled": false, "chat.disableAIFeatures": true };

  it("adds configurationDefaults to a product without any", () => {
    const { product, changed } = mergeProductConfigurationDefaults({ nameShort: "Code" }, defaults);
    expect(changed).toBe(true);
    expect(product.configurationDefaults).toEqual(defaults);
    expect(product.nameShort).toBe("Code");
  });

  it("preserves unrelated existing defaults", () => {
    const { product, changed } = mergeProductConfigurationDefaults(
      { configurationDefaults: { "editor.fontSize": 13 } },
      defaults,
    );
    expect(changed).toBe(true);
    expect(product.configurationDefaults).toEqual({ "editor.fontSize": 13, ...defaults });
  });

  it("reports unchanged when the defaults are already present", () => {
    const { changed } = mergeProductConfigurationDefaults(
      { configurationDefaults: { ...defaults, "editor.fontSize": 13 } },
      defaults,
    );
    expect(changed).toBe(false);
  });
});

describe("CodeHostManager", () => {
  beforeEach(() => {
    webContentsViews.length = 0;
  });

  it("switches active sessions by detaching the previous WebContentsView", async () => {
    const window = createMockWindow();
    const manager = new CodeHostManager(() => window as never, {
      state: {
        available: true,
        mode: "embedded",
        entry: "http://127.0.0.1:3000",
        reason: null,
      },
      runtime: null,
    });

    await manager.ensureSession({ projectId: "a", workspaceRoot: "/tmp/a" });
    await manager.ensureSession({ projectId: "b", workspaceRoot: "/tmp/b" });
    manager.setBounds({ projectId: "a", x: 0, y: 0, width: 800, height: 600, visible: true });
    manager.setBounds({ projectId: "b", x: 0, y: 0, width: 800, height: 600, visible: true });

    await manager.activateSession({ projectId: "a" });
    await manager.activateSession({ projectId: "b" });

    expect(window.contentView.removeChildView).toHaveBeenCalledTimes(1);
    expect(window.contentView.addChildView).toHaveBeenCalledTimes(2);
    expect(window.contentView.children).toHaveLength(1);
  });

  it("hides the active session and disposes stale sessions on sync", async () => {
    const window = createMockWindow();
    const manager = new CodeHostManager(() => window as never, {
      state: {
        available: true,
        mode: "embedded",
        entry: "http://127.0.0.1:3000",
        reason: null,
      },
      runtime: null,
    });

    await manager.ensureSession({ projectId: "a", workspaceRoot: "/tmp/a" });
    await manager.ensureSession({ projectId: "b", workspaceRoot: "/tmp/b" });
    manager.setBounds({ projectId: "a", x: 0, y: 0, width: 800, height: 600, visible: true });
    await manager.activateSession({ projectId: "a" });

    manager.hideActiveSession();
    manager.syncSessions(["b"]);

    expect(window.contentView.removeChildView).toHaveBeenCalled();
    expect(webContentsViews[0]!.webContents.close).toHaveBeenCalledWith({
      waitForBeforeUnload: false,
    });
    expect(webContentsViews[1]!.webContents.close).not.toHaveBeenCalled();
  });

  it("re-syncs the active theme ID (not generic dark/light) on extension host reconnect", async () => {
    let extensionHostConnectedHandler: ((projectId: string) => void) | null = null;
    const mockControlChannel = {
      onExtensionHostConnected: vi.fn((handler) => {
        extensionHostConnectedHandler = handler;
      }),
      onChromeState: vi.fn(),
      setTheme: vi.fn(),
      openFile: vi.fn(),
    };

    const window = createMockWindow();
    const manager = new CodeHostManager(
      () => window as never,
      {
        state: { available: true, mode: "embedded", entry: "http://127.0.0.1:3000", reason: null },
        runtime: null,
      },
      mockControlChannel as never,
    );

    // Set a non-default theme (e.g. dracula)
    manager.setTheme("dracula", { colors: { background: "#282a36" } });

    // Simulate extension host connection
    expect(extensionHostConnectedHandler).not.toBeNull();
    extensionHostConnectedHandler!("project-1");

    // Verify controlChannel.setTheme was called with "dracula" and custom config, not generic "dark"
    expect(mockControlChannel.setTheme).toHaveBeenCalledWith("dracula", {
      colors: { background: "#282a36" },
    });
  });

  it("verifies setTheme executes cleanly across all 7 built-in themes plus custom theme", async () => {
    const window = createMockWindow();
    const manager = new CodeHostManager(() => window as never, {
      state: { available: true, mode: "embedded", entry: "http://127.0.0.1:3000", reason: null },
      runtime: null,
    });

    await manager.ensureSession({ projectId: "proj-all-themes", workspaceRoot: "/tmp/at" });

    const themesToTest = [
      "tabs-dark",
      "true-black",
      "tabs-light",
      "abyss",
      "dracula",
      "deep-blue",
      "solarized-light",
      "custom",
    ];

    for (const themeId of themesToTest) {
      expect(() => manager.setTheme(themeId)).not.toThrow();
    }
  });

  describe("readWorkspaceTabs & writeWorkspaceTabs", () => {
    it("writes and reads workspace tab persistence correctly", () => {
      const testDir = makeTempDir("tab-test-");
      try {
        const projectId = "test-proj-123";
        const sampleTabs = [
          { filePath: "/path/to/fileA.ts", viewColumn: 1, active: false, pinned: true },
          { filePath: "/path/to/fileB.ts", viewColumn: 1, active: true, pinned: false },
        ];

        writeWorkspaceTabs(projectId, sampleTabs, testDir);
        const readBack = readWorkspaceTabs(projectId, testDir);

        expect(readBack).toEqual(sampleTabs);
      } finally {
        FS.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("returns null for non-existent workspace tab file", () => {
      const testDir = makeTempDir("tab-test-none-");
      try {
        const readBack = readWorkspaceTabs("non-existent-project-xyz", testDir);
        expect(readBack).toBeNull();
      } finally {
        FS.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("keeps only tabs contained by the project workspace", () => {
      const workspaceRoot = Path.join(Path.sep, "projects", "tabs");
      const tabs = [
        { filePath: Path.join(workspaceRoot, "src", "index.ts"), active: true },
        { filePath: "README.md", active: false },
        { filePath: Path.join(Path.sep, "projects", "throttle", "app.json"), active: false },
        { filePath: Path.join("..", "throttle", "package.json"), active: false },
      ];

      expect(filterWorkspaceTabs(workspaceRoot, tabs)).toEqual(tabs.slice(0, 2));
      expect(isPathInsideWorkspace(workspaceRoot, workspaceRoot)).toBe(false);
    });
  });
});
