import { describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  fromPartition: vi.fn(),
  showItemInFolder: vi.fn(),
}));

// browserHostManager imports `electron` at module load; mock it so the pure
// helper under test can be imported in a plain Node test environment.
vi.mock("electron", () => ({
  app: { getPath: () => "/tmp/tabs-test-user-data" },
  clipboard: { write: vi.fn() },
  ClipboardItem: vi.fn(),
  nativeImage: { createFromBuffer: vi.fn() },
  WebContentsView: vi.fn(),
  Menu: { buildFromTemplate: () => ({ popup: () => undefined }) },
  session: { fromPartition: electronMocks.fromPartition },
  shell: {
    openExternal: () => Promise.resolve(),
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

import {
  BrowserHostManager,
  configurePartitionSession,
  hasReturnedToAuthenticationOrigin,
  isLikelyAuthenticationUrl,
  normalizeBrowserCookieDomain,
  normalizeBrowserProfileId,
  normalizeRemoteBrowserUrl,
  sanitizeEmbeddedBrowserUserAgent,
} from "./browserHostManager";

describe("hasReturnedToAuthenticationOrigin", () => {
  it("recognizes a completed redirect back to the originating site", () => {
    expect(
      hasReturnedToAuthenticationOrigin("https://chatgpt.com/", "https://www.chatgpt.com/"),
    ).toBe(true);
  });

  it("waits through provider and callback pages", () => {
    expect(
      hasReturnedToAuthenticationOrigin(
        "https://accounts.google.com/v3/signin/identifier",
        "https://chatgpt.com/",
      ),
    ).toBe(false);
    expect(
      hasReturnedToAuthenticationOrigin(
        "https://chatgpt.com/auth/callback?code=abc",
        "https://chatgpt.com/",
      ),
    ).toBe(false);
  });
});

describe("isLikelyAuthenticationUrl", () => {
  it("recognizes provider hosts and common authentication paths", () => {
    expect(isLikelyAuthenticationUrl("https://accounts.google.com/v3/signin/identifier")).toBe(
      true,
    );
    expect(isLikelyAuthenticationUrl("https://example.com/oauth/authorize?client_id=1")).toBe(true);
    expect(isLikelyAuthenticationUrl("https://example.com/account/login")).toBe(true);
  });

  it("does not route ordinary pages or unsupported URLs", () => {
    expect(isLikelyAuthenticationUrl("https://example.com/projects/authentication-guide")).toBe(
      false,
    );
    expect(isLikelyAuthenticationUrl("file:///tmp/login")).toBe(false);
    expect(isLikelyAuthenticationUrl("not a url")).toBe(false);
  });
});

describe("sanitizeEmbeddedBrowserUserAgent", () => {
  it("strips the Electron and app product tokens, leaving a vanilla Chrome UA", () => {
    const electronUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Tabs/0.0.14 Chrome/140.0.0.0 Electron/40.6.0 Safari/537.36";

    expect(sanitizeEmbeddedBrowserUserAgent(electronUserAgent)).toBe(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    );
  });

  it("preserves the platform segment on Windows", () => {
    const windowsUserAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Tabs/0.0.14 Chrome/140.0.0.0 Electron/40.6.0 Safari/537.36";

    const result = sanitizeEmbeddedBrowserUserAgent(windowsUserAgent);
    expect(result).toContain("Windows NT 10.0; Win64; x64");
    expect(result).not.toContain("Electron/");
    expect(result).not.toContain("Tabs/");
    expect(result).toContain("Chrome/140.0.0.0 Safari/537.36");
  });

  it("is a no-op for an already-clean Chrome UA", () => {
    const chromeUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

    expect(sanitizeEmbeddedBrowserUserAgent(chromeUserAgent)).toBe(chromeUserAgent);
  });
});

describe("BrowserHostManager profile storage", () => {
  it("reports exact stored cookie domains without claiming authenticated state", async () => {
    electronMocks.fromPartition.mockReturnValue({
      cookies: {
        on: vi.fn(),
        get: vi.fn().mockResolvedValue([
          { domain: ".accounts.example.co.uk", name: "sessionid", value: "long-session-value" },
          { domain: ".cdn.example.co.uk", name: "preferences", value: "dark" },
        ]),
      },
    });
    const manager = new BrowserHostManager(() => null);

    await expect(manager.getProfileDomains("work")).resolves.toEqual([
      { domain: "accounts.example.co.uk", cookieCount: 1, hasSessionHint: true },
      { domain: "cdn.example.co.uk", cookieCount: 1, hasSessionHint: false },
    ]);
  });

  it("uses comprehensive Chromium data clearing for a profile", async () => {
    const profileSession = {
      cookies: { on: vi.fn() },
      closeAllConnections: vi.fn().mockResolvedValue(undefined),
      clearData: vi.fn().mockResolvedValue(undefined),
      flushStorageData: vi.fn(),
    };
    electronMocks.fromPartition.mockReturnValue(profileSession);
    const manager = new BrowserHostManager(() => null);

    await manager.clearProfileData("personal");

    expect(electronMocks.fromPartition).toHaveBeenCalledWith(
      "persist:tabs-browser:profile:personal",
    );
    expect(profileSession.closeAllConnections).toHaveBeenCalledOnce();
    expect(profileSession.clearData).toHaveBeenCalledWith(
      expect.objectContaining({ dataTypes: expect.arrayContaining(["cookies", "indexedDB"]) }),
    );
    expect(profileSession.flushStorageData).toHaveBeenCalledOnce();
  });
});

describe("BrowserHostManager automation", () => {
  it("routes status and evaluation to the requested persistent session", async () => {
    const executeJavaScript = vi.fn().mockResolvedValue({ heading: "Ready" });
    const manager = new BrowserHostManager(() => null);
    const sessions = (
      manager as unknown as {
        sessions: Map<string, unknown>;
      }
    ).sessions;
    const browserSession = {
      projectId: "project-1",
      sessionId: "preview-1",
      key: "project-1::preview-1",
      view: {
        webContents: {
          isDestroyed: () => false,
          executeJavaScript,
        },
      },
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      currentUrl: "https://example.com/",
      pageTitle: "Example",
      loading: false,
      consoleEntries: [],
      networkEntries: [],
      actionTimeline: [],
    };
    sessions.set("project-1::preview-1", browserSession);

    await expect(
      manager.runAutomation({
        projectId: "project-1",
        sessionId: "preview-1",
        operation: "status",
      }),
    ).resolves.toMatchObject({
      available: true,
      tabId: "preview-1",
      url: "https://example.com/",
      viewport: { width: 800, height: 600 },
    });
    await expect(
      manager.runAutomation({
        projectId: "project-1",
        sessionId: "preview-1",
        operation: "evaluate",
        input: { expression: "({ heading: document.title })" },
      }),
    ).resolves.toEqual({ heading: "Ready" });
    expect(executeJavaScript).toHaveBeenCalledWith("({ heading: document.title })", true);
    expect(browserSession.actionTimeline).toEqual([
      expect.objectContaining({
        action: "evaluate",
        status: "succeeded",
        startedAt: expect.any(String),
        completedAt: expect.any(String),
      }),
    ]);
  });

  it("retains failed automation details for the next diagnostic snapshot", async () => {
    const manager = new BrowserHostManager(() => null);
    const browserSession = {
      projectId: "project-1",
      sessionId: "preview-1",
      key: "project-1::preview-1",
      view: {
        webContents: {
          isDestroyed: () => false,
          executeJavaScript: vi.fn().mockRejectedValue(new Error("page execution failed")),
        },
      },
      bounds: null,
      currentUrl: "https://example.com/",
      pageTitle: "Example",
      loading: false,
      consoleEntries: [],
      networkEntries: [],
      actionTimeline: [],
    };
    (
      manager as unknown as {
        sessions: Map<string, unknown>;
      }
    ).sessions.set("project-1::preview-1", browserSession);

    await expect(
      manager.runAutomation({
        projectId: "project-1",
        sessionId: "preview-1",
        operation: "evaluate",
        input: { expression: "broken()" },
      }),
    ).rejects.toThrow("page execution failed");
    expect(browserSession.actionTimeline).toEqual([
      expect.objectContaining({
        action: "evaluate",
        status: "failed",
        error: "page execution failed",
        completedAt: expect.any(String),
      }),
    ]);
  });

  it("marks an action interrupted when human input advances the control epoch", async () => {
    const manager = new BrowserHostManager(() => null);
    const browserSession = {
      projectId: "project-1",
      sessionId: "preview-1",
      key: "project-1::preview-1",
      view: { webContents: { isDestroyed: () => false, executeJavaScript: vi.fn() } },
      bounds: null,
      currentUrl: "https://example.com/",
      pageTitle: "Example",
      loading: false,
      consoleEntries: [],
      networkEntries: [],
      actionTimeline: [],
      controller: "none",
      controlEpoch: 0,
      dispatchingAgentInput: false,
      humanControlTimer: null,
    };
    browserSession.view.webContents.executeJavaScript.mockImplementation(async () => {
      browserSession.controlEpoch += 1;
      browserSession.controller = "human";
      return "late result";
    });
    (
      manager as unknown as {
        sessions: Map<string, unknown>;
      }
    ).sessions.set("project-1::preview-1", browserSession);

    await expect(
      manager.runAutomation({
        projectId: "project-1",
        sessionId: "preview-1",
        operation: "evaluate",
        input: { expression: "slowOperation()" },
      }),
    ).rejects.toThrow("interrupted by human input");
    expect(browserSession.actionTimeline).toEqual([
      expect.objectContaining({ status: "interrupted", error: expect.stringContaining("human") }),
    ]);
    expect(browserSession.controller).toBe("human");
  });

  it("serializes automation actions for one browser session", async () => {
    let releaseFirst!: () => void;
    const firstResult = new Promise<string>((resolve) => {
      releaseFirst = () => resolve("first");
    });
    const executeJavaScript = vi
      .fn()
      .mockImplementationOnce(() => firstResult)
      .mockResolvedValueOnce("second");
    const manager = new BrowserHostManager(() => null);
    (
      manager as unknown as {
        sessions: Map<string, unknown>;
      }
    ).sessions.set("project-1::preview-1", {
      projectId: "project-1",
      sessionId: "preview-1",
      key: "project-1::preview-1",
      view: { webContents: { isDestroyed: () => false, executeJavaScript } },
      actionTimeline: [],
      controller: "none",
      controlEpoch: 0,
      automationTail: Promise.resolve(),
    });

    const first = manager.runAutomation({
      projectId: "project-1",
      sessionId: "preview-1",
      operation: "evaluate",
      input: { expression: "first()" },
    });
    const second = manager.runAutomation({
      projectId: "project-1",
      sessionId: "preview-1",
      operation: "evaluate",
      input: { expression: "second()" },
    });
    await Promise.resolve();
    expect(executeJavaScript).toHaveBeenCalledTimes(1);
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(executeJavaScript).toHaveBeenCalledTimes(2);
  });

  it("rejects automation for a missing session", async () => {
    const manager = new BrowserHostManager(() => null);
    await expect(
      manager.runAutomation({ projectId: "missing", operation: "status" }),
    ).rejects.toThrow("browser session was not found");
  });
});

describe("BrowserHostManager artifacts", () => {
  it("reveals only files inside the managed artifact directory", () => {
    const manager = new BrowserHostManager(() => null);

    expect(() => manager.revealArtifact("/tmp/tabs-test-user-data/settings.json")).toThrow(
      "Tabs artifact directory",
    );
    manager.revealArtifact(
      "/tmp/tabs-test-user-data/browser-artifacts/browser-screenshot-test.png",
    );
    expect(electronMocks.showItemInFolder).toHaveBeenCalledWith(
      "/tmp/tabs-test-user-data/browser-artifacts/browser-screenshot-test.png",
    );
  });

  it("returns structured element context with a real page capture", async () => {
    const manager = new BrowserHostManager(() => null);
    const executeJavaScript = vi.fn().mockResolvedValue({
      pageUrl: "https://example.com/settings",
      pageTitle: "Settings",
      tagName: "button",
      selector: "#save",
      htmlPreview: '<button id="save">Save</button>',
      componentName: null,
      source: null,
      stack: [],
      styles: "display: block;",
      pickedAt: "2026-09-04T00:00:00.000Z",
      rect: { x: 10, y: 20, width: 80, height: 32 },
    });
    (
      manager as unknown as {
        sessions: Map<string, unknown>;
      }
    ).sessions.set("project-1::tab-1", {
      projectId: "project-1",
      sessionId: "tab-1",
      key: "project-1::tab-1",
      view: {
        webContents: {
          isDestroyed: () => false,
          executeJavaScript,
          capturePage: vi.fn().mockResolvedValue({
            getSize: () => ({ width: 1024, height: 768 }),
            toPNG: () => Buffer.from("real-png-bytes"),
          }),
        },
      },
    });

    await expect(
      manager.pickElement({ projectId: "project-1", sessionId: "tab-1" }),
    ).resolves.toMatchObject({
      pageUrl: "https://example.com/settings",
      elements: [
        {
          element: { selector: "#save", tagName: "button" },
          rect: { x: 10, y: 20, width: 80, height: 32 },
        },
      ],
      screenshot: {
        dataUrl: `data:image/png;base64,${Buffer.from("real-png-bytes").toString("base64")}`,
        width: 1024,
        height: 768,
      },
    });
    expect(executeJavaScript).toHaveBeenCalledOnce();
  });
});

describe("configurePartitionSession", () => {
  it("configures a partition once without forging Chromium client hints", () => {
    const flushStore = vi.fn().mockResolvedValue(undefined);
    let cookieChanged: (() => void) | undefined;
    const profileSession = {
      getUserAgent: vi
        .fn()
        .mockReturnValue("Mozilla/5.0 Tabs/1.0.0 Chrome/140.0.0.0 Electron/40.6.0 Safari/537.36"),
      setUserAgent: vi.fn(),
      cookies: {
        on: vi.fn((_event: string, listener: () => void) => {
          cookieChanged = listener;
        }),
        flushStore,
      },
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
    };

    configurePartitionSession(profileSession as never);
    configurePartitionSession(profileSession as never);

    expect(profileSession.setUserAgent).toHaveBeenCalledOnce();
    expect(profileSession.setUserAgent).toHaveBeenCalledWith(
      "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
    );
    expect(profileSession.setPermissionRequestHandler).toHaveBeenCalledOnce();
    expect(profileSession.cookies.on).toHaveBeenCalledOnce();

    cookieChanged?.();
    expect(flushStore).toHaveBeenCalledOnce();
  });
});

describe("browser profile input validation", () => {
  it("normalizes safe profile identifiers", () => {
    expect(normalizeBrowserProfileId(" Client_A ")).toBe("client_a");
  });

  it("rejects identifiers that could create ambiguous partitions", () => {
    expect(() => normalizeBrowserProfileId("../personal")).toThrow(
      "Invalid browser profile identifier",
    );
    expect(() => normalizeBrowserProfileId("work:other")).toThrow(
      "Invalid browser profile identifier",
    );
  });

  it("allows only HTTP and HTTPS profile-window destinations", () => {
    expect(normalizeRemoteBrowserUrl("https://example.com/login")).toBe(
      "https://example.com/login",
    );
    expect(() => normalizeRemoteBrowserUrl("file:///etc/passwd")).toThrow(
      "only support HTTP and HTTPS",
    );
  });

  it("rejects malformed cookie domains before data clearing", () => {
    expect(normalizeBrowserCookieDomain(".accounts.example.com")).toBe("accounts.example.com");
    expect(() => normalizeBrowserCookieDomain("example.com/path")).toThrow(
      "Invalid browser cookie domain",
    );
  });
});
