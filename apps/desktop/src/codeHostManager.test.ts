import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { browserViews, MockBrowserView } = vi.hoisted(() => {
  const browserViews: {
    webContents: {
      loadURL: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
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
  CODE_OSS_EMBED_EXTENSION_RELATIVE_PATH,
  CODE_OSS_NLS_MESSAGES_RELATIVE_PATH,
  CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH,
  CODE_OSS_WEB_LAUNCHER_RELATIVE_PATH,
  CODE_OSS_WEB_SERVER_RELATIVE_PATH,
  PRIMARY_CODE_OSS_WEB_ASSET_RELATIVE_PATH,
  SECONDARY_CODE_OSS_WEB_ASSET_RELATIVE_PATH,
  CodeHostManager,
  buildMountedWorkspaceDescriptor,
  buildManagedServerArgs,
  buildSessionUrl,
  resolveCodeHostConfig,
} from "./codeHostManager";

function makeTempDir(prefix: string): string {
  return FS.mkdtempSync(Path.join(OS.tmpdir(), prefix));
}

function writeVsCodeCheckout(rootDir: string): void {
  for (const relativePath of [
    CODE_OSS_WEB_LAUNCHER_RELATIVE_PATH,
    CODE_OSS_WEB_SERVER_RELATIVE_PATH,
    PRIMARY_CODE_OSS_WEB_ASSET_RELATIVE_PATH,
    SECONDARY_CODE_OSS_WEB_ASSET_RELATIVE_PATH,
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
    FS.writeFileSync(
      absolutePath,
      absolutePath.endsWith(".json") ? "{}" : "// test",
    );
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

  it("prefers the local desktop runtime when desktop and web assets both exist", () => {
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
      kind: "desktop-renderer",
      vscodeRoot,
    });
  });

  it("falls back to a sibling vscode-main checkout", () => {
    const parentDir = makeTempDir("tabs-parent-");
    const rootDir = Path.join(parentDir, "tabs-main");
    const vscodeMainDir = Path.join(parentDir, "vscode-main");
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

  it("prefers a sibling desktop checkout when desktop and web assets both exist", () => {
    const parentDir = makeTempDir("tabs-parent-");
    const rootDir = Path.join(parentDir, "tabs-main");
    const vscodeMainDir = Path.join(parentDir, "vscode-main");
    FS.mkdirSync(rootDir, { recursive: true });
    writeVsCodeCheckout(vscodeMainDir);
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
    const vscodeMainDir = Path.join(parentDir, "vscode-main");
    FS.mkdirSync(rootDir, { recursive: true });
    FS.mkdirSync(vscodeMainDir, { recursive: true });
    for (const relativePath of [
      CODE_OSS_WEB_LAUNCHER_RELATIVE_PATH,
      CODE_OSS_WEB_SERVER_RELATIVE_PATH,
    ]) {
      const absolutePath = Path.join(vscodeMainDir, relativePath);
      FS.mkdirSync(Path.dirname(absolutePath), { recursive: true });
      FS.writeFileSync(absolutePath, "// test");
    }

    const config = resolveCodeHostConfig({
      rootDir,
      env: {},
    });

    expect(config.state.available).toBe(false);
    expect(config.state.reason).toContain("Code-OSS desktop runtime not found");
    expect(config.state.reason).toContain("npm run compile");
    expect(config.state.reason).not.toContain("npm run compile-web");
    expect(config.state.reason).toContain("vscode-main");
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
    expect(url.searchParams.get("folder")).toBe("file:///tmp/workspace");
    expect(url.searchParams.get("folderUri")).toBe("file:///tmp/workspace");
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
      JSON.stringify([["openFile", "file:///tmp/workspace/src/example.ts"]]),
    );
    expect(url.searchParams.get("tabs_relativePath")).toBe("src/example.ts");
    expect(url.searchParams.get("tabs_navigationNonce")).toBe("3");
  });
});

describe("buildManagedServerArgs", () => {
  it("includes the embed defaults extension when it exists", () => {
    const args = buildManagedServerArgs({
      mountRoot: "/tmp/workspace",
      host: "127.0.0.1",
      port: 3000,
    });

    expect(args).toContain("--extensionPath");
    expect(args).toContain(
      Path.resolve(__dirname, CODE_OSS_EMBED_EXTENSION_RELATIVE_PATH),
    );
  });
});

describe("buildMountedWorkspaceDescriptor", () => {
  it("mounts the workspace root directly for the managed web runtime", () => {
    expect(buildMountedWorkspaceDescriptor("/tmp/workspace")).toEqual({
      mountRoot: "/tmp/workspace",
      workspaceUri: "vscode-test-web://mount/?tabsLabel=workspace",
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
    expect(new URL(view!.loadedUrls[1]!).searchParams.get("folder")).toBe("file:///tmp/workspace-b");
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
    expect(new URL(view!.loadedUrls[0]!).searchParams.get("folder")).toBe(
      `file://${rootDir}`,
    );
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
