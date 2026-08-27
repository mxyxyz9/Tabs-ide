import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { browserViews, MockBrowserView } = vi.hoisted(() => {
  class MockBrowserView {
    readonly webContents = {
      loadURL: vi.fn(async (url: string) => {
        this.loadedUrls.push(url);
      }),
      close: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      insertCSS: vi.fn(async () => ""),
      executeJavaScript: vi.fn(async () => null),
      isDestroyed: vi.fn(() => false),
    };

    readonly loadedUrls: string[] = [];
    bounds: { x: number; y: number; width: number; height: number } | null = null;

    constructor(_options: unknown) {
      browserViews.push(this);
    }

    setBackgroundColor(_color: string): void {}

    setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
      this.bounds = bounds;
    }
  }

  const browserViews: MockBrowserView[] = [];

  return { browserViews, MockBrowserView };
});

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/mock-user-data") },
  BrowserView: MockBrowserView,
}));

import {
  CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
  CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH,
  CODE_OSS_NLS_MESSAGES_RELATIVE_PATH,
  CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH,
  CodeHostManager,
  mergeProductConfigurationDefaults,
  readWorkspaceTabs,
  resolveCodeHostConfig,
  writeWorkspaceTabs,
} from "./codeHostManager";

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
  const views: InstanceType<typeof MockBrowserView>[] = [];
  return {
    addBrowserView: vi.fn((view: InstanceType<typeof MockBrowserView>) => {
      if (!views.includes(view)) {
        views.push(view);
      }
    }),
    removeBrowserView: vi.fn((view: InstanceType<typeof MockBrowserView>) => {
      const index = views.indexOf(view);
      if (index >= 0) {
        views.splice(index, 1);
      }
    }),
    getBrowserViews: vi.fn(() => [...views]),
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
    browserViews.length = 0;
  });

  it("switches active sessions by detaching the previous BrowserView", async () => {
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

    expect(window.removeBrowserView).toHaveBeenCalledTimes(1);
    expect(window.addBrowserView).toHaveBeenCalledTimes(2);
    expect(window.getBrowserViews()).toHaveLength(1);
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

    expect(window.removeBrowserView).toHaveBeenCalled();
    expect(browserViews[0]!.webContents.close).toHaveBeenCalledWith({
      waitForBeforeUnload: false,
    });
    expect(browserViews[1]!.webContents.close).not.toHaveBeenCalled();
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
    expect(mockControlChannel.setTheme).toHaveBeenCalledWith("dracula", { colors: { background: "#282a36" } });
  });

  it("applies the active theme immediately when a fresh session BrowserView is created", async () => {
    const window = createMockWindow();
    const manager = new CodeHostManager(() => window as never, {
      state: { available: true, mode: "embedded", entry: "http://127.0.0.1:3000", reason: null },
      runtime: null,
    });

    // Set theme before session creation
    manager.setTheme("solarized-light");

    // Create fresh session BrowserView
    await manager.ensureSession({ projectId: "proj-new", workspaceRoot: "/tmp/new" });

    const view = browserViews[0];
    expect(view).toBeDefined();
    expect(view!.webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("solarized-light"),
    );
  });

  it("symmetrically removes all inline --tabs-* CSS properties from monaco-workbench and documentElement when switching from custom theme to True Black", async () => {
    const window = createMockWindow();
    const manager = new CodeHostManager(() => window as never, {
      state: { available: true, mode: "embedded", entry: "http://127.0.0.1:3000", reason: null },
      runtime: null,
    });

    await manager.ensureSession({ projectId: "proj-1", workspaceRoot: "/tmp/1" });
    const view = browserViews[0]!;

    // 1. Set Custom Theme ("Cosmic Glow")
    manager.setTheme("custom", {
      colors: {
        background: "#ffffff",
        card: "#f6f5f2",
        foreground: "#3a3936",
        primary: "#366ffb",
      },
    });

    expect(view.webContents.executeJavaScript).toHaveBeenLastCalledWith(
      expect.stringContaining("setProperty(key, customProps[key])"),
    );

    // 2. Switch directly to True Black
    manager.setTheme("true-black");

    expect(view.webContents.executeJavaScript).toHaveBeenLastCalledWith(
      expect.stringContaining("removeProperty(key)"),
    );
  });

  it("verifies custom theme token completeness covers all 12 --tabs-* surface tokens", async () => {
    const window = createMockWindow();
    const manager = new CodeHostManager(() => window as never, {
      state: { available: true, mode: "embedded", entry: "http://127.0.0.1:3000", reason: null },
      runtime: null,
    });

    await manager.ensureSession({ projectId: "proj-token-check", workspaceRoot: "/tmp/tc" });
    const view = browserViews[0]!;

    manager.setTheme("custom", {
      colors: {
        background: "#121212",
        card: "#1e1e1e",
        foreground: "#ffffff",
        primary: "#ff007f",
      },
    });

    const lastCallArg = (view.webContents.executeJavaScript as any).mock.calls.slice(-1)[0][0];
    const requiredTokens = [
      "--tabs-bg",
      "--tabs-bg-sidebar",
      "--tabs-bg-elevated",
      "--tabs-bg-popover",
      "--tabs-input-bg",
      "--tabs-text",
      "--tabs-text-muted",
      "--tabs-accent",
      "--tabs-accent-strong",
      "--tabs-accent-fg",
      "--tabs-accent-soft",
      "--tabs-hairline",
      "--tabs-hairline-strong",
    ];

    requiredTokens.forEach((token) => {
      expect(lastCallArg).toContain(token);
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
  });
});
