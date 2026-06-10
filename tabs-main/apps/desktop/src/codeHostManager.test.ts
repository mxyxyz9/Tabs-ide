import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { browserViews, MockBrowserView } = vi.hoisted(() => {
  const browserViews: {
    webContents: {
      loadURL: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
    loadedUrls: string[];
    bounds: { x: number; y: number; width: number; height: number } | null;
    setBackgroundColor: (color: string) => void;
    setBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
  }[] = [];

  class MockBrowserView {
    readonly webContents = {
      loadURL: vi.fn(async (url: string) => {
        this.loadedUrls.push(url);
      }),
      close: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      setWindowOpenHandler: vi.fn(),
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

  return { browserViews, MockBrowserView };
});

vi.mock("electron", () => ({
  BrowserView: MockBrowserView,
}));

import {
  CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
  CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH,
  CODE_OSS_NLS_MESSAGES_RELATIVE_PATH,
  CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH,
  CODE_OSS_WEB_LAUNCHER_RELATIVE_PATH,
  CODE_OSS_WEB_SERVER_MAIN_RELATIVE_PATH,
  CODE_OSS_WEB_SERVER_CLI_RELATIVE_PATH,
  CodeHostManager,
  buildMountedWorkspaceDescriptor,
  buildManagedServerArgs,
  buildSessionUrl,
  mergeProductConfigurationDefaults,
  removeExtensionFromManifest,
  resolveCodeHostConfig,
} from "./codeHostManager";

function makeTempDir(prefix: string): string {
  return FS.mkdtempSync(Path.join(OS.tmpdir(), prefix));
}

function writeVsCodeCheckout(rootDir: string): void {
  for (const relativePath of [
    // code-web.js is the checkout marker (`hasCodeOssMarker`); the real REH web
    // server is detected via server-main.js + server-cli.js.
    CODE_OSS_WEB_LAUNCHER_RELATIVE_PATH,
    CODE_OSS_WEB_SERVER_MAIN_RELATIVE_PATH,
    CODE_OSS_WEB_SERVER_CLI_RELATIVE_PATH,
  ]) {
    const absolutePath = Path.join(rootDir, relativePath);
    FS.mkdirSync(Path.dirname(absolutePath), { recursive: true });
    FS.writeFileSync(absolutePath, "// test");
  }
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
  it("uses an explicit served Code-OSS entry", () => {
    const rootDir = makeTempDir("tabs-codehost-root-");

    const config = resolveCodeHostConfig({
      rootDir,
      env: {
        TABS_CODE_OSS_ENTRY: "http://127.0.0.1:9333/",
      },
    });

    expect(config.state.available).toBe(true);
    expect(config.state.entry).toBe("http://127.0.0.1:9333");
    expect(config.state.reason).toBeNull();
  });

  it("uses TABS_CODE_OSS_BUILD_DIR when the VS Code web assets exist", () => {
    const rootDir = makeTempDir("tabs-codehost-root-");
    const vscodeRoot = makeTempDir("vscode-root-");
    writeVsCodeCheckout(vscodeRoot);

    const config = resolveCodeHostConfig({
      rootDir,
      env: {
        TABS_CODE_OSS_BUILD_DIR: vscodeRoot,
      },
    });

    expect(config.state.available).toBe(true);
    expect(config.state.entry).toBeNull();
    expect(config.runtime).toEqual({
      kind: "managed-server",
      vscodeRoot,
    });
  });

  it("prefers the web server when desktop and web assets both exist", () => {
    const rootDir = makeTempDir("tabs-codehost-root-");
    const vscodeRoot = makeTempDir("vscode-root-");
    writeVsCodeCheckout(vscodeRoot);
    writeVsCodeDesktopCheckout(vscodeRoot);

    const config = resolveCodeHostConfig({
      rootDir,
      env: {
        TABS_CODE_OSS_BUILD_DIR: vscodeRoot,
      },
    });

    expect(config.state.available).toBe(true);
    expect(config.runtime).toMatchObject({
      kind: "managed-server",
      vscodeRoot,
    });
  });

  it("falls back to a sibling tabs-code-main checkout", () => {
    const parentDir = makeTempDir("tabs-parent-");
    const rootDir = Path.join(parentDir, "tabs-main");
    const vscodeMainDir = Path.join(parentDir, "tabs-code-main");
    FS.mkdirSync(rootDir, { recursive: true });
    writeVsCodeCheckout(vscodeMainDir);

    const config = resolveCodeHostConfig({
      rootDir,
      env: {},
    });

    expect(config.state.available).toBe(true);
    expect(config.runtime).toEqual({
      kind: "managed-server",
      vscodeRoot: vscodeMainDir,
    });
  });

  it("prefers a sibling web server when desktop and web assets both exist", () => {
    const parentDir = makeTempDir("tabs-parent-");
    const rootDir = Path.join(parentDir, "tabs-main");
    const vscodeMainDir = Path.join(parentDir, "tabs-code-main");
    FS.mkdirSync(rootDir, { recursive: true });
    writeVsCodeCheckout(vscodeMainDir);
    writeVsCodeDesktopCheckout(vscodeMainDir);

    const config = resolveCodeHostConfig({
      rootDir,
      env: {},
    });

    expect(config.state.available).toBe(true);
    expect(config.runtime).toMatchObject({
      kind: "managed-server",
      vscodeRoot: vscodeMainDir,
    });
  });

  it("rejects raw workbench HTML entries", () => {
    const rootDir = makeTempDir("tabs-codehost-root-");
    const workbenchPath = Path.join(
      makeTempDir("vscode-root-"),
      "out/vs/code/browser/workbench/workbench.html",
    );
    FS.mkdirSync(Path.dirname(workbenchPath), { recursive: true });
    FS.writeFileSync(workbenchPath, "<!doctype html>");

    const config = resolveCodeHostConfig({
      rootDir,
      env: {
        TABS_CODE_OSS_ENTRY: workbenchPath,
      },
    });

    expect(config.state.available).toBe(false);
    expect(config.state.reason).toContain("served web runtime");
    expect(config.state.reason).toContain("npm run compile");
    expect(config.state.reason).toContain("compile-web");
  });

  it("returns an actionable message when the desktop build is missing", () => {
    const parentDir = makeTempDir("tabs-parent-");
    const rootDir = Path.join(parentDir, "tabs-main");
    const vscodeMainDir = Path.join(parentDir, "tabs-code-main");
    FS.mkdirSync(rootDir, { recursive: true });
    FS.mkdirSync(vscodeMainDir, { recursive: true });
    // Only the checkout marker exists — neither the web server (server-main.js)
    // nor the desktop runtime is built.
    const markerPath = Path.join(vscodeMainDir, CODE_OSS_WEB_LAUNCHER_RELATIVE_PATH);
    FS.mkdirSync(Path.dirname(markerPath), { recursive: true });
    FS.writeFileSync(markerPath, "// test");

    const config = resolveCodeHostConfig({
      rootDir,
      env: {},
    });

    expect(config.state.available).toBe(false);
    expect(config.state.reason).toContain("Code-OSS desktop runtime not found");
    expect(config.state.reason).toContain("npm run compile");
    expect(config.state.reason).not.toContain("npm run compile-web");
    expect(config.state.reason).toContain("tabs-code-main");
  });
});

describe("buildSessionUrl", () => {
  it("loads the workspace without a file when no handoff exists", () => {
    const url = new URL(
      buildSessionUrl("http://127.0.0.1:3000/?existing=1", {
        projectId: "project-1",
        workspaceRoot: "/tmp/workspace",
        lastFocusedPath: null,
        lastNavigationNonce: 0,
      }),
    );

    expect(url.searchParams.get("existing")).toBe("1");
    expect(url.searchParams.get("folder")).toBe("/tmp/workspace");
    expect(url.searchParams.get("folderUri")).toBeNull();
    expect(url.searchParams.get("payload")).toBeNull();
  });

  it("includes the focused file in the VS Code payload and tracks the nonce", () => {
    const url = new URL(
      buildSessionUrl("http://127.0.0.1:3000/", {
        projectId: "project-1",
        workspaceRoot: "/tmp/workspace",
        lastFocusedPath: "src/example.ts",
        lastNavigationNonce: 3,
      }),
    );

    expect(url.searchParams.get("payload")).toBe(
      JSON.stringify([["openFile", "/tmp/workspace/src/example.ts"]]),
    );
    expect(url.searchParams.get("tabs_relativePath")).toBe("src/example.ts");
    expect(url.searchParams.get("tabs_navigationNonce")).toBe("3");
  });
});

describe("buildManagedServerArgs", () => {
  it("launches the real REH web server with a connection-token-less local bind", () => {
    const args = buildManagedServerArgs({
      host: "127.0.0.1",
      port: 3000,
      serverDataDir: "/tmp/server-data",
    });

    expect(args[0]).toBe(CODE_OSS_WEB_SERVER_MAIN_RELATIVE_PATH);
    expect(args).toContain("--without-connection-token");
    expect(args).toContain("--accept-server-license-terms");
    expect(args).toEqual(expect.arrayContaining(["--host", "127.0.0.1", "--port", "3000"]));
    expect(args).toEqual(expect.arrayContaining(["--server-data-dir", "/tmp/server-data"]));
    // The workspace folder is passed via the URL, not as a CLI argument.
    expect(args).not.toContain("--browserType");
    // The REH server ignores --extensionDevelopmentPath; the integration
    // extension is installed as a built-in under <vscodeRoot>/extensions
    // instead (see installManagedServerControlExtension).
    expect(args).not.toContain("--extensionDevelopmentPath");
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

describe("removeExtensionFromManifest", () => {
  const id = "tabs.tabs-workbench-integration";

  it("removes matching entries case-insensitively", () => {
    const stale = { identifier: { id: "Tabs.Tabs-Workbench-Integration" }, version: "0.0.1" };
    expect(removeExtensionFromManifest([stale], id)).toEqual([]);
  });

  it("preserves unrelated installed extensions", () => {
    const other = { identifier: { id: "acme.other" }, version: "1.0.0" };
    expect(removeExtensionFromManifest([other, { identifier: { id } }], id)).toEqual([other]);
  });

  it("leaves malformed entries untouched", () => {
    const junk = [null, 42, { identifier: {} }];
    expect(removeExtensionFromManifest(junk, id)).toEqual(junk);
  });
});

describe("buildMountedWorkspaceDescriptor", () => {
  it("opens the workspace root by its real filesystem path for the web server", () => {
    expect(buildMountedWorkspaceDescriptor("/tmp/workspace")).toEqual({
      mountRoot: "/tmp/workspace",
      workspaceUri: "/tmp/workspace",
    });
  });
});

describe("CodeHostManager", () => {
  beforeEach(() => {
    browserViews.length = 0;
  });

  it("reuses a session and reloads when the workspace root changes", async () => {
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

    await manager.ensureSession({
      projectId: "project-1",
      workspaceRoot: "/tmp/workspace-a",
    });
    const view = browserViews[0];
    expect(view).toBeDefined();

    await manager.ensureSession({
      projectId: "project-1",
      workspaceRoot: "/tmp/workspace-a",
    });
    await manager.ensureSession({
      projectId: "project-1",
      workspaceRoot: "/tmp/workspace-b",
    });

    expect(browserViews).toHaveLength(1);
    expect(view!.webContents.loadURL).toHaveBeenCalledTimes(2);
    expect(new URL(view!.loadedUrls[1]!).searchParams.get("folder")).toBe(
      "file:///tmp/workspace-b",
    );
  });

  it("recovers a moved workspace root before loading the embedded runtime", async () => {
    const parentDir = makeTempDir("tabs-workspace-moved-");
    const rootDir = Path.join(parentDir, "tabs", "tabs-main");
    const staleWorkspaceRoot = Path.join(parentDir, "tabs-main");
    FS.mkdirSync(rootDir, { recursive: true });

    const window = createMockWindow();
    const manager = new CodeHostManager(() => window as never, {
      rootDir,
      state: {
        available: true,
        mode: "embedded",
        entry: "http://127.0.0.1:3000",
        reason: null,
      },
      runtime: null,
    });

    await manager.ensureSession({
      projectId: "project-1",
      workspaceRoot: staleWorkspaceRoot,
    });

    const view = browserViews[0];
    expect(view).toBeDefined();
    expect(new URL(view!.loadedUrls[0]!).searchParams.get("folder")).toBe(`file://${rootDir}`);
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
});
