import {
  BrowserView,
  Menu,
  shell,
  type BrowserWindow,
  type MenuItemConstructorOptions,
  type Rectangle,
} from "electron";
import type {
  DesktopBrowserHostActivateSessionInput,
  DesktopBrowserHostControlInput,
  DesktopBrowserHostEnsureSessionInput,
  DesktopBrowserHostNavigateInput,
  DesktopBrowserHostSetBoundsInput,
  DesktopBrowserHostState,
  DesktopBrowserSessionState,
} from "@tabs/contracts";

const DEFAULT_BROWSER_HOST_STATE: DesktopBrowserHostState = {
  available: true,
  reason: null,
};
const DOCKED_DEVTOOLS_MODE = "bottom";

const DEFAULT_SESSION_ID = "browser";

type BrowserSession = {
  projectId: string;
  sessionId: string;
  key: string;
  view: BrowserView;
  bounds: Rectangle | null;
  currentUrl: string | null;
  pageTitle: string | null;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  devToolsOpen: boolean;
  lastError: string | null;
};

export class BrowserHostManager {
  // Keyed by `${projectId}::${sessionId}` so each browser tab keeps its own
  // BrowserView alive — switching tabs shows/hides instead of reloading.
  private readonly sessions = new Map<string, BrowserSession>();
  private activeKey: string | null = null;

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private sessionKey(projectId: string, sessionId?: string): string {
    return `${projectId}::${sessionId ?? DEFAULT_SESSION_ID}`;
  }

  getState(): DesktopBrowserHostState {
    return DEFAULT_BROWSER_HOST_STATE;
  }

  getSessionState(projectId: string, sessionId?: string): DesktopBrowserSessionState {
    const session = this.sessions.get(this.sessionKey(projectId, sessionId));
    if (!session) {
      return {
        projectId,
        sessionId: sessionId ?? DEFAULT_SESSION_ID,
        currentUrl: null,
        pageTitle: null,
        loading: false,
        canGoBack: false,
        canGoForward: false,
        devToolsOpen: false,
        lastError: null,
      };
    }

    return this.snapshotSession(session);
  }

  async ensureSession(input: DesktopBrowserHostEnsureSessionInput): Promise<void> {
    const key = this.sessionKey(input.projectId, input.sessionId);
    const existing = this.sessions.get(key);
    if (existing) {
      // Keep the tab alive across switches/re-mounts: do NOT re-navigate here
      // (that caused the reload-on-switch). Only load if it has nothing yet.
      if (!existing.currentUrl && input.initialUrl) {
        await this.loadUrl(existing, input.initialUrl);
      }
      return;
    }

    const sessionId = input.sessionId ?? DEFAULT_SESSION_ID;
    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        // Shared per-project partition so logins/cookies are common across the
        // project's browser tabs (like a real browser), while each tab keeps
        // its own kept-alive view.
        partition: `persist:tabs-browser:${input.projectId}`,
      },
    });
    view.setBackgroundColor("#111111");

    const session: BrowserSession = {
      projectId: input.projectId,
      sessionId,
      key,
      view,
      bounds: null,
      currentUrl: null,
      pageTitle: null,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      devToolsOpen: view.webContents.isDevToolsOpened(),
      lastError: null,
    };

    this.registerSessionEvents(session);
    this.sessions.set(key, session);
    if (input.initialUrl) {
      await this.loadUrl(session, input.initialUrl);
    }
  }

  async activateSession(input: DesktopBrowserHostActivateSessionInput): Promise<void> {
    const key = this.sessionKey(input.projectId, input.sessionId);
    const session = this.sessions.get(key);
    const window = this.getWindow();
    if (!session || !window) {
      return;
    }

    const current = this.activeKey ? this.sessions.get(this.activeKey) : null;
    if (current && current.key !== session.key) {
      this.detachSession(current);
    }

    this.activeKey = key;
    if (session.bounds) {
      this.attachSession(session);
      session.view.setBounds(session.bounds);
    }
  }

  hideActiveSession(): void {
    if (!this.activeKey) return;
    const session = this.sessions.get(this.activeKey);
    if (session) {
      this.detachSession(session);
    }
    this.activeKey = null;
  }

  setBounds(input: DesktopBrowserHostSetBoundsInput): void {
    const key = this.sessionKey(input.projectId, input.sessionId);
    const session = this.sessions.get(key);
    if (!session) {
      return;
    }

    if (!input.visible || input.width <= 0 || input.height <= 0) {
      session.bounds = null;
      if (this.activeKey === key) {
        this.detachSession(session);
      }
      return;
    }

    session.bounds = {
      x: Math.round(input.x),
      y: Math.round(input.y),
      width: Math.round(input.width),
      height: Math.round(input.height),
    };

    if (this.activeKey === key) {
      this.attachSession(session);
      session.view.setBounds(session.bounds);
    }
  }

  async navigate(input: DesktopBrowserHostNavigateInput): Promise<void> {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session) return;
    await this.loadUrl(session, input.url);
  }

  async reload(input: DesktopBrowserHostControlInput): Promise<void> {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session) return;
    session.lastError = null;
    this.emitState(session);
    session.view.webContents.reload();
  }

  async goBack(input: DesktopBrowserHostControlInput): Promise<void> {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session || !session.view.webContents.canGoBack()) return;
    session.lastError = null;
    this.emitState(session);
    session.view.webContents.goBack();
  }

  async goForward(input: DesktopBrowserHostControlInput): Promise<void> {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session || !session.view.webContents.canGoForward()) return;
    session.lastError = null;
    this.emitState(session);
    session.view.webContents.goForward();
  }

  async toggleDevTools(input: DesktopBrowserHostControlInput): Promise<void> {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session) return;
    if (session.view.webContents.isDevToolsOpened()) {
      session.view.webContents.closeDevTools();
    } else {
      session.view.webContents.openDevTools({ mode: DOCKED_DEVTOOLS_MODE, activate: false });
    }
  }

  syncSessions(projectIds: readonly string[]): void {
    const allowed = new Set(projectIds);
    for (const [key, session] of this.sessions) {
      if (allowed.has(session.projectId)) continue;
      if (this.activeKey === key) {
        this.detachSession(session);
        this.activeKey = null;
      }
      session.view.webContents.close({ waitForBeforeUnload: false });
      this.sessions.delete(key);
    }
  }

  dispose(): void {
    this.hideActiveSession();
    for (const session of this.sessions.values()) {
      session.view.webContents.close({ waitForBeforeUnload: false });
    }
    this.sessions.clear();
  }

  private async loadUrl(session: BrowserSession, url: string): Promise<void> {
    session.currentUrl = url;
    session.lastError = null;
    this.emitState(session);
    await session.view.webContents.loadURL(url);
  }

  private snapshotSession(session: BrowserSession): DesktopBrowserSessionState {
    return {
      projectId: session.projectId,
      sessionId: session.sessionId,
      currentUrl: session.currentUrl,
      pageTitle: session.pageTitle,
      loading: session.loading,
      canGoBack: session.canGoBack,
      canGoForward: session.canGoForward,
      devToolsOpen: session.devToolsOpen,
      lastError: session.lastError,
    };
  }

  private emitState(session: BrowserSession): void {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.send("desktop:browser-host:session-state", this.snapshotSession(session));
  }

  private attachSession(session: BrowserSession): void {
    const window = this.getWindow();
    if (!window) return;
    const currentViews = window.getBrowserViews();
    if (!currentViews.includes(session.view)) {
      window.addBrowserView(session.view);
    }
    session.view.webContents.focus?.();
  }

  private detachSession(session: BrowserSession): void {
    const window = this.getWindow();
    if (!window) return;
    const currentViews = window.getBrowserViews();
    if (currentViews.includes(session.view)) {
      window.removeBrowserView(session.view);
    }
  }

  private registerSessionEvents(session: BrowserSession): void {
    const contents = session.view.webContents;
    const refreshNavigationState = () => {
      session.canGoBack = contents.canGoBack();
      session.canGoForward = contents.canGoForward();
    };

    contents.on("did-start-loading", () => {
      session.loading = true;
      session.lastError = null;
      refreshNavigationState();
      this.emitState(session);
    });
    contents.on("did-stop-loading", () => {
      session.loading = false;
      session.currentUrl = contents.getURL() || session.currentUrl;
      session.pageTitle = contents.getTitle() || session.pageTitle;
      refreshNavigationState();
      this.emitState(session);
    });
    contents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      session.pageTitle = title || null;
      this.emitState(session);
    });
    contents.on("did-navigate", (_event, url) => {
      session.currentUrl = url;
      session.lastError = null;
      refreshNavigationState();
      this.emitState(session);
    });
    contents.on("did-navigate-in-page", (_event, url) => {
      session.currentUrl = url;
      refreshNavigationState();
      this.emitState(session);
    });
    contents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) {
          return;
        }
        session.loading = false;
        session.currentUrl = validatedUrl || session.currentUrl;
        session.lastError = errorDescription || "Unable to load page.";
        refreshNavigationState();
        this.emitState(session);
      },
    );
    contents.on("devtools-opened", () => {
      session.devToolsOpen = true;
      this.emitState(session);
    });
    contents.on("devtools-closed", () => {
      session.devToolsOpen = false;
      this.emitState(session);
    });
    contents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url).catch(() => undefined);
      return { action: "deny" };
    });
    contents.on("context-menu", (_event, params) => {
      const template: MenuItemConstructorOptions[] = [
        {
          label: "Back",
          enabled: contents.canGoBack(),
          click: () => contents.goBack(),
        },
        {
          label: "Forward",
          enabled: contents.canGoForward(),
          click: () => contents.goForward(),
        },
        {
          label: "Reload",
          click: () => contents.reload(),
        },
        { type: "separator" },
        {
          label: "Open In Browser",
          click: () => {
            const url = contents.getURL();
            if (url) {
              void shell.openExternal(url).catch(() => undefined);
            }
          },
        },
        {
          label: "Inspect Element",
          click: () => {
            if (!contents.isDevToolsOpened()) {
              contents.openDevTools({ mode: DOCKED_DEVTOOLS_MODE });
            }
            contents.inspectElement(params.x, params.y);
          },
        },
      ];
      const popupWindow = this.getWindow();
      Menu.buildFromTemplate(template).popup(
        popupWindow
          ? {
              window: popupWindow,
            }
          : {},
      );
    });
  }
}
