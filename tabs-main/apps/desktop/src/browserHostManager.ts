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

// Electron appends app/runtime tokens to the default User-Agent, e.g.
// "... (KHTML, like Gecko) Tabs/0.0.14 Chrome/140.0.0.0 Electron/40.6.0 Safari/537.36".
// Some web apps (figma being the notable one) branch on the UA and throw a
// client-side exception when they see the `Electron/` token / unrecognized
// product, rendering a blank error page inside the embed. Present as a vanilla
// Chrome build by stripping the `Electron/<ver>` token and the product token
// that precedes `Chrome/`, while preserving the real platform + Chrome version
// (so this stays correct across macOS/Windows/Linux and Electron upgrades).
export function sanitizeEmbeddedBrowserUserAgent(userAgent: string): string {
  return userAgent.replace(/ Electron\/[^ ]+/g, "").replace(/ [^ /]+\/[^ ]+ Chrome\//, " Chrome/");
}

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

    const allowedPermissions = new Set([
      "clipboard-read",
      "clipboard-write",
      "clipboard-sanitized-write",
      "pointerLock",
      "notifications",
    ]);
    if (view.webContents?.session) {
      view.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(allowedPermissions.has(permission));
      });
      view.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
        return allowedPermissions.has(permission);
      });
    }

    view.webContents.setUserAgent(
      sanitizeEmbeddedBrowserUserAgent(view.webContents.getUserAgent()),
    );

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
    // A blank embed used to be indistinguishable from a crash: if the page's
    // renderer process died, the BrowserView just painted its background color
    // with no indication. Surface it as an error (which the UI shows with a
    // reload affordance) instead of a silent black void.
    contents.on("render-process-gone", (_event, details) => {
      session.loading = false;
      session.lastError = `The page crashed (${details.reason}). Reload to try again.`;
      refreshNavigationState();
      this.emitState(session);
      console.error(
        `[browser-host] render process gone for ${session.key} (${session.currentUrl ?? "?"}): ${details.reason}`,
      );
    });
    // Forward page-level error logs to the main process log. Many "the site is
    // blank" reports are a client-side exception thrown by the embedded page
    // (e.g. figma); capturing it here makes those diagnosable without manually
    // opening DevTools on the BrowserView.
    contents.on("console-message", (details) => {
      if (details.level === "error") {
        console.error(
          `[browser-host] page console error ${session.key} (${details.sourceId}:${details.lineNumber}): ${details.message}`,
        );
      }
    });
    contents.on("devtools-opened", () => {
      session.devToolsOpen = true;
      this.emitState(session);
    });
    contents.on("devtools-closed", () => {
      session.devToolsOpen = false;
      this.emitState(session);
    });
    contents.setWindowOpenHandler(({ url, disposition }) => {
      // OAuth flows ("Continue with Google", SSO, etc.) call window.open(...)
      // with popup features, which Electron reports as a "new-window"
      // disposition. Those popups MUST stay in-app and share this view's
      // session partition — otherwise the auth completes in the external
      // browser (different cookies, no window.opener) and can never hand the
      // session back. Allow them as a child window on the same partition.
      if (disposition === "new-window") {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            webPreferences: {
              contextIsolation: true,
              sandbox: true,
              nodeIntegration: false,
              partition: `persist:tabs-browser:${session.projectId}`,
            },
          },
        };
      }
      // Plain link clicks (target=_blank / foreground-tab) open in the user's
      // real browser, matching prior behavior.
      void shell.openExternal(url).catch(() => undefined);
      return { action: "deny" };
    });
    contents.on("did-create-window", (childWindow) => {
      // Keep the OAuth popup tidy and let it close itself when the provider
      // calls window.close() at the end of the flow.
      childWindow.setMenuBarVisibility(false);
      childWindow.webContents.setWindowOpenHandler(
        ({ url: nestedUrl, disposition: nestedDisposition }) => {
          if (nestedDisposition === "new-window") {
            return {
              action: "allow",
              overrideBrowserWindowOptions: {
                autoHideMenuBar: true,
                webPreferences: {
                  contextIsolation: true,
                  sandbox: true,
                  nodeIntegration: false,
                  partition: `persist:tabs-browser:${session.projectId}`,
                },
              },
            };
          }
          void shell.openExternal(nestedUrl).catch(() => undefined);
          return { action: "deny" };
        },
      );
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
