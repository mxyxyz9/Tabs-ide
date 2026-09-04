import * as FS from "node:fs/promises";
import * as Path from "node:path";

import {
  app,
  BrowserWindow,
  clipboard,
  ClipboardItem,
  Menu,
  nativeImage,
  WebContentsView,
  session as electronSession,
  shell,
  type MenuItemConstructorOptions,
  type Rectangle,
  type Session,
} from "electron";
import type {
  DesktopBrowserHostActivateSessionInput,
  DesktopBrowserHostControlInput,
  DesktopBrowserHostEnsureSessionInput,
  DesktopBrowserHostNavigateInput,
  DesktopBrowserHostSetBoundsInput,
  DesktopBrowserHostState,
  DesktopBrowserSessionState,
  BrowserProfileDomainInfo,
  DesktopPreviewScreenshotArtifact,
  DesktopPreviewRecordingArtifact,
  PreviewAnnotationPayload,
  PickedElementPayload,
} from "@tabs/contracts";

const DEFAULT_BROWSER_HOST_STATE: DesktopBrowserHostState = {
  available: true,
  reason: null,
};
const DOCKED_DEVTOOLS_MODE = "bottom";

const DEFAULT_SESSION_ID = "browser";
const PROFILE_PARTITION_PREFIX = "persist:tabs-browser:profile:";
const configuredSessions = new WeakSet<Session>();
const ALLOWED_REMOTE_PERMISSIONS = new Set([
  "clipboard-read",
  "clipboard-write",
  "clipboard-sanitized-write",
  "pointerLock",
  "notifications",
]);
const BROWSER_PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;

export function normalizeBrowserProfileId(profileId: string): string {
  const normalized = profileId.trim().toLowerCase();
  if (!BROWSER_PROFILE_ID_PATTERN.test(normalized)) {
    throw new Error("Invalid browser profile identifier.");
  }
  return normalized;
}

export function normalizeRemoteBrowserUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Browser profiles only support HTTP and HTTPS URLs.");
  }
  return parsed.toString();
}

const AUTHENTICATION_HOST_PREFIXES = ["accounts.", "auth.", "id.", "login.", "sso."];
const AUTHENTICATION_PATH_SEGMENTS = new Set([
  "auth",
  "authorize",
  "login",
  "oauth",
  "signin",
  "sso",
]);

function normalizeAuthenticationHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./u, "");
}

export function isLikelyAuthenticationUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const hostname = parsed.hostname.toLowerCase();
  if (AUTHENTICATION_HOST_PREFIXES.some((prefix) => hostname.startsWith(prefix))) return true;

  const pathSegments = parsed.pathname.toLowerCase().split("/").filter(Boolean);
  return pathSegments.some((segment) => AUTHENTICATION_PATH_SEGMENTS.has(segment));
}

export function hasReturnedToAuthenticationOrigin(
  candidateUrl: string,
  originatingUrl: string,
): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const originating = new URL(originatingUrl);
    return (
      (candidate.protocol === "https:" || candidate.protocol === "http:") &&
      normalizeAuthenticationHostname(candidate.hostname) ===
        normalizeAuthenticationHostname(originating.hostname) &&
      !isLikelyAuthenticationUrl(candidate.toString())
    );
  } catch {
    return false;
  }
}

export function normalizeBrowserCookieDomain(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^\./u, "");
  if (
    normalized.length === 0 ||
    normalized.length > 253 ||
    normalized.includes("..") ||
    !/^[a-z0-9.-]+$/u.test(normalized)
  ) {
    throw new Error("Invalid browser cookie domain.");
  }
  return normalized;
}

export function getCleanDesktopUserAgent(): string {
  const chromeVersion = process.versions.chrome ?? "140.0.0.0";
  const platform =
    process.platform === "darwin"
      ? "Macintosh; Intel Mac OS X 10_15_7"
      : process.platform === "win32"
        ? "Windows NT 10.0; Win64; x64"
        : "X11; Linux x86_64";
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

export function configurePartitionSession(s: Session): void {
  if (configuredSessions.has(s)) return;
  configuredSessions.add(s);
  try {
    s.setUserAgent(sanitizeEmbeddedBrowserUserAgent(s.getUserAgent()));
    s.cookies.on("changed", () => {
      void s.cookies.flushStore().catch((err) => {
        console.error("[browserHostManager] Failed to persist browser cookies:", err);
      });
    });
    s.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(ALLOWED_REMOTE_PERMISSIONS.has(permission));
    });
    s.setPermissionCheckHandler((_webContents, permission) => {
      return ALLOWED_REMOTE_PERMISSIONS.has(permission);
    });
  } catch (err) {
    console.error("[browserHostManager] Failed to configure partition session:", err);
  }
}

export function sanitizeEmbeddedBrowserUserAgent(userAgent: string): string {
  return userAgent.replace(/ Electron\/[^ ]+/g, "").replace(/ [^ /]+\/[^ ]+ Chrome\//, " Chrome/");
}

type BrowserSession = {
  projectId: string;
  sessionId: string;
  partition: string;
  key: string;
  view: WebContentsView;
  bounds: Rectangle | null;
  currentUrl: string | null;
  pageTitle: string | null;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  devToolsOpen: boolean;
  lastError: string | null;
  /** Transient error set when ERR_CONNECTION_REFUSED fires (dev server not ready yet).
   * Cleared as soon as any successful navigation or page load occurs. */
  transientError: string | null;
  consoleEntries: BrowserConsoleEntry[];
  networkEntries: BrowserNetworkEntry[];
  actionTimeline: BrowserActionEvent[];
};

interface BrowserConsoleEntry {
  readonly level: string;
  readonly text: string;
  readonly timestamp: string;
  readonly source?: string;
}

interface BrowserNetworkEntry {
  readonly url: string;
  readonly method: string;
  readonly status: number | null;
  readonly failed: boolean;
  readonly errorText?: string;
  readonly timestamp: string;
}

interface BrowserActionEvent {
  readonly id: string;
  readonly action: string;
  status: "running" | "succeeded" | "failed" | "interrupted";
  readonly startedAt: string;
  completedAt?: string;
  error?: string;
}

const AUTOMATION_OBSERVATION_LIMIT = 200;

function appendBounded<T>(entries: T[], entry: T): void {
  entries.push(entry);
  if (entries.length > AUTOMATION_OBSERVATION_LIMIT) {
    entries.splice(0, entries.length - AUTOMATION_OBSERVATION_LIMIT);
  }
}

interface BrowserAutomationRequest {
  readonly projectId: string;
  readonly sessionId?: string;
  readonly operation: string;
  readonly input?: unknown;
}

function automationInput(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function pageTargetExpression(input: Record<string, unknown>): string {
  const selector = typeof input.selector === "string" ? input.selector : null;
  const locator = typeof input.locator === "string" ? input.locator : null;
  const encodedSelector = JSON.stringify(selector);
  const encodedLocator = JSON.stringify(locator);
  return `(() => {
    const selector = ${encodedSelector};
    const locator = ${encodedLocator};
    if (selector) return document.querySelector(selector);
    if (!locator) return document.activeElement;
    if (locator.startsWith("text=")) {
      const text = locator.slice(5);
      return [...document.querySelectorAll("*")].find((element) =>
        element instanceof HTMLElement && element.innerText.trim().includes(text)
      ) ?? null;
    }
    const roleMatch = /^role=([^\\[]+)(?:\\[name=['"]?(.+?)['"]?\\])?$/.exec(locator);
    if (roleMatch) {
      const role = roleMatch[1];
      const name = roleMatch[2];
      return [...document.querySelectorAll('[role="' + CSS.escape(role) + '"], ' + role)].find(
        (element) => !name || ((element.getAttribute("aria-label") || element.textContent || "").trim() === name)
      ) ?? null;
    }
    return document.querySelector(locator);
  })()`;
}

export class BrowserHostManager {
  // Keyed by `${projectId}::${sessionId}` so each browser tab keeps its own
  // WebContentsView alive — switching tabs shows/hides instead of reloading.
  private readonly sessions = new Map<string, BrowserSession>();
  private activeKey: string | null = null;
  private readonly observedProfileSessions = new WeakSet<Session>();
  private readonly observedAutomationSessions = new WeakSet<Session>();

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
        transientError: null,
      };
    }

    return this.snapshotSession(session);
  }

  async ensureSession(input: DesktopBrowserHostEnsureSessionInput): Promise<void> {
    const key = this.sessionKey(input.projectId, input.sessionId);
    const partition = input.partition ?? `persist:tabs-browser:${input.projectId}`;
    const existing = this.sessions.get(key);
    if (existing) {
      // If the session's partition was updated in settings, recreate the session.
      if (existing.partition !== partition) {
        await this.recreateSession(input.projectId, input.sessionId, partition);
        return;
      }
      // Keep the tab alive across switches/re-mounts: do NOT re-navigate here
      // (that caused the reload-on-switch). Only load if it has nothing yet.
      if (!existing.currentUrl && input.initialUrl) {
        await this.loadUrl(existing, input.initialUrl);
      }
      return;
    }

    const sessionId = input.sessionId ?? DEFAULT_SESSION_ID;
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition,
      },
    });
    configurePartitionSession(view.webContents.session);
    this.observeProfileSession(partition, view.webContents.session);
    view.setBackgroundColor("#111111");

    const initialZoom = this.getWindow()?.webContents?.getZoomFactor() ?? 1.0;
    view.webContents?.setZoomFactor(initialZoom);

    view.webContents.setUserAgent(
      sanitizeEmbeddedBrowserUserAgent(view.webContents.getUserAgent()),
    );

    const session: BrowserSession = {
      projectId: input.projectId,
      sessionId,
      partition,
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
      transientError: null,
      consoleEntries: [],
      networkEntries: [],
      actionTimeline: [],
    };

    this.sessions.set(key, session);
    this.registerSessionEvents(session);
    this.observeAutomationNetwork(view.webContents.session);
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

  async recreateSession(
    projectId: string,
    sessionId?: string,
    partitionInput?: string,
  ): Promise<void> {
    const key = this.sessionKey(projectId, sessionId);
    const session = this.sessions.get(key);
    if (!session) return;

    const currentUrl = session.currentUrl;
    const partition = partitionInput ?? session.partition ?? `persist:tabs-browser:${projectId}`;

    this.detachSession(session);
    session.view.webContents.close({ waitForBeforeUnload: false });

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition,
      },
    });
    configurePartitionSession(view.webContents.session);
    this.observeProfileSession(partition, view.webContents.session);
    view.setBackgroundColor("#111111");

    const initialZoom = this.getWindow()?.webContents?.getZoomFactor() ?? 1.0;
    view.webContents?.setZoomFactor(initialZoom);

    view.webContents.setUserAgent(
      sanitizeEmbeddedBrowserUserAgent(view.webContents.getUserAgent()),
    );

    session.view = view;
    session.partition = partition;
    session.lastError = null;
    session.transientError = null;
    this.registerSessionEvents(session);
    this.observeAutomationNetwork(view.webContents.session);

    if (this.activeKey === key && session.bounds) {
      this.attachSession(session);
      session.view.setBounds(session.bounds);
    }

    if (currentUrl) {
      await this.loadUrl(session, currentUrl);
    }
  }

  async clearProfileData(profileId: string): Promise<void> {
    const trimmed = normalizeBrowserProfileId(profileId);
    const partition = `persist:tabs-browser:profile:${trimmed}`;
    const s = electronSession.fromPartition(partition);
    this.observeProfileSession(partition, s);
    await s.closeAllConnections();
    await s.clearData({
      dataTypes: [
        "cache",
        "cookies",
        "fileSystems",
        "indexedDB",
        "localStorage",
        "serviceWorkers",
        "webSQL",
      ],
    });
    s.flushStorageData();
    for (const session of this.sessions.values()) {
      if (session.partition === partition && session.currentUrl) {
        await this.loadUrl(session, session.currentUrl);
      }
    }
  }

  async getProfileDomains(profileId: string): Promise<BrowserProfileDomainInfo[]> {
    const trimmed = normalizeBrowserProfileId(profileId);
    const partition = `persist:tabs-browser:profile:${trimmed}`;
    const s = electronSession.fromPartition(partition);
    this.observeProfileSession(partition, s);
    try {
      const cookies = await s.cookies.get({});
      const map = new Map<string, { count: number; hasSessionHint: boolean }>();

      const AUTH_COOKIE_NAMES = [
        "sid",
        "hsid",
        "ssid",
        "apisid",
        "sapisid",
        "osid",
        "user_session",
        "logged_in",
        "dotcom_user",
        "__secure-next-auth.session-token",
        "auth_token",
        "figma.session",
        "figma.login",
        "linear_session",
        "token_v2",
        "jwt",
        "sessionid",
      ];

      for (const cookie of cookies) {
        let domain = cookie.domain || "";
        if (domain.startsWith(".")) domain = domain.slice(1);
        if (!domain) continue;

        const existing = map.get(domain) ?? { count: 0, hasSessionHint: false };
        existing.count += 1;

        const cName = cookie.name.toLowerCase();
        const hasSessionHint =
          AUTH_COOKIE_NAMES.some((name) => cName === name || cName.includes(name)) ||
          ((cName.includes("session") || cName.includes("token") || cName.includes("auth")) &&
            Boolean(cookie.value && cookie.value.length > 10));

        if (hasSessionHint) {
          existing.hasSessionHint = true;
        }
        map.set(domain, existing);
      }

      return Array.from(map.entries())
        .map(([domain, data]) => ({
          domain,
          cookieCount: data.count,
          hasSessionHint: data.hasSessionHint,
        }))
        .toSorted((a, b) => {
          if (a.hasSessionHint && !b.hasSessionHint) return -1;
          if (!a.hasSessionHint && b.hasSessionHint) return 1;
          return a.domain.localeCompare(b.domain);
        });
    } catch (err) {
      console.error("[browserHostManager] Failed to get profile domains:", err);
      return [];
    }
  }

  async clearProfileDomain(profileId: string, domainToClear: string): Promise<void> {
    const trimmed = normalizeBrowserProfileId(profileId);
    const domain = normalizeBrowserCookieDomain(domainToClear);
    const partition = `persist:tabs-browser:profile:${trimmed}`;
    const s = electronSession.fromPartition(partition);
    this.observeProfileSession(partition, s);
    try {
      const cookies = await s.cookies.get({});
      for (const cookie of cookies) {
        const cDomain = (cookie.domain || "").replace(/^\./, "").toLowerCase();
        if (cDomain === domain || cDomain.endsWith("." + domain)) {
          const protocol = cookie.secure ? "https:" : "http:";
          const url = `${protocol}//${cDomain}${cookie.path || "/"}`;
          await s.cookies.remove(url, cookie.name);
        }
      }
      await s.closeAllConnections();
      await s.clearData({
        origins: [`https://${domain}`, `http://${domain}`],
        dataTypes: [
          "cookies",
          "fileSystems",
          "indexedDB",
          "localStorage",
          "serviceWorkers",
          "webSQL",
        ],
        originMatchingMode: "third-parties-included",
      });
      s.flushStorageData();
      for (const session of this.sessions.values()) {
        if (
          session.partition === partition &&
          session.currentUrl &&
          session.currentUrl.includes(domain)
        ) {
          await this.loadUrl(session, session.currentUrl);
        }
      }
    } catch (err) {
      console.error("[browserHostManager] Failed to clear profile domain:", err);
    }
  }

  async openProfileLoginWindow(profileId: string, targetUrl?: string): Promise<void> {
    const trimmed = normalizeBrowserProfileId(profileId);
    const partition = `persist:tabs-browser:profile:${trimmed}`;
    await this.openLoginWindow(
      partition,
      trimmed,
      targetUrl?.trim() || "https://accounts.google.com",
    );
  }

  private async openLoginWindow(
    partition: string,
    label: string,
    targetUrl: string,
    completionOriginUrl?: string,
  ): Promise<void> {
    const url = normalizeRemoteBrowserUrl(targetUrl);

    const s = electronSession.fromPartition(partition);
    this.observeProfileSession(partition, s);
    configurePartitionSession(s);

    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      title: `Tabs Profile Login - ${label}`,
      webPreferences: {
        partition,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    win.webContents.setUserAgent(sanitizeEmbeddedBrowserUserAgent(win.webContents.getUserAgent()));
    let authenticationCompleted = false;
    const closeAfterAuthentication = (candidateUrl: string) => {
      if (
        authenticationCompleted ||
        !completionOriginUrl ||
        !hasReturnedToAuthenticationOrigin(candidateUrl, completionOriginUrl)
      ) {
        return;
      }
      authenticationCompleted = true;
      void s.cookies
        .flushStore()
        .catch((err) => {
          console.error("[browserHostManager] Failed to persist authenticated session:", err);
        })
        .finally(() => {
          if (!win.isDestroyed()) win.close();
        });
    };
    win.webContents.on("did-navigate", (_event, navigatedUrl) => {
      closeAfterAuthentication(navigatedUrl);
    });
    win.webContents.on("did-navigate-in-page", (_event, navigatedUrl) => {
      closeAfterAuthentication(navigatedUrl);
    });
    win.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.key === "Escape") {
        event.preventDefault();
        win.close();
      }
    });
    win.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
      let protocol = "";
      try {
        protocol = new URL(popupUrl).protocol;
      } catch {
        return { action: "deny" };
      }
      if (protocol !== "https:" && protocol !== "http:") {
        return { action: "deny" };
      }
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            partition,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    });

    await win.loadURL(url).catch((err) => {
      console.error("[browserHostManager] Failed to load login URL:", err);
    });
    await new Promise<void>((resolve) => {
      if (win.isDestroyed()) {
        resolve();
        return;
      }
      win.once("closed", resolve);
    });
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

    const mainWindow = this.getWindow();
    const zoomFactor = mainWindow?.webContents?.getZoomFactor() ?? 1.0;

    let x = Math.round(input.x * zoomFactor);
    let y = Math.round(input.y * zoomFactor);
    let width = Math.round(input.width * zoomFactor);
    let height = Math.round(input.height * zoomFactor);

    const isDestroyed =
      typeof mainWindow?.isDestroyed === "function" ? mainWindow.isDestroyed() : false;
    const getContentSize =
      typeof mainWindow?.getContentSize === "function"
        ? mainWindow.getContentSize.bind(mainWindow)
        : null;

    if (mainWindow && !isDestroyed && getContentSize) {
      try {
        const [contentWidth, contentHeight] = getContentSize();
        if (typeof contentWidth === "number" && typeof contentHeight === "number") {
          const rightEdgeDip = Math.round((input.x + input.width) * zoomFactor);
          if (Math.abs(contentWidth - rightEdgeDip) <= 12) {
            width = Math.max(0, contentWidth - x);
          }
          const bottomEdgeDip = Math.round((input.y + input.height) * zoomFactor);
          if (Math.abs(contentHeight - bottomEdgeDip) <= 12) {
            height = Math.max(0, contentHeight - y);
          }
        }
      } catch {
        /* ignore */
      }
    }

    session.bounds = { x, y, width, height };

    if (session.view) {
      const currentZoom = session.view.webContents?.getZoomFactor() ?? 1.0;
      if (Math.abs(currentZoom - zoomFactor) > 0.001) {
        session.view.webContents?.setZoomFactor(zoomFactor);
      }
    }

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

  async runAutomation(request: BrowserAutomationRequest): Promise<unknown> {
    const session = this.sessions.get(this.sessionKey(request.projectId, request.sessionId));
    if (!session) throw new Error("The requested browser session was not found.");
    const contents = session.view.webContents;
    if (contents.isDestroyed()) throw new Error("The requested browser session is unavailable.");
    const input = automationInput(request.input);

    if (request.operation === "status") {
      return {
        available: true,
        visible: this.activeKey === session.key && session.bounds !== null,
        tabId: session.sessionId,
        url: session.currentUrl,
        title: session.pageTitle,
        loading: session.loading,
        viewport: session.bounds
          ? { width: session.bounds.width, height: session.bounds.height }
          : undefined,
      };
    }

    if (request.operation === "evaluate") {
      if (typeof input.expression !== "string" || input.expression.trim().length === 0) {
        throw new Error("A JavaScript expression is required.");
      }
      return this.trackAutomation(session, "evaluate", () =>
        contents.executeJavaScript(input.expression as string, true),
      );
    }

    if (request.operation === "snapshot") {
      const page = await contents.executeJavaScript(
        `(() => ({
          visibleText: (document.body?.innerText || "").slice(0, 20000),
          interactiveElements: [...document.querySelectorAll(
            'a[href],button,input,select,textarea,[role="button"],[role="link"],[tabindex]'
          )].slice(0, 200).map((element, index) => {
            const rect = element.getBoundingClientRect();
            const html = element;
            return {
              tag: element.tagName.toLowerCase(),
              role: element.getAttribute("role"),
              name: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 500),
              selector: element.id ? "#" + CSS.escape(element.id) : element.tagName.toLowerCase() + ":nth-of-type(" + (index + 1) + ")",
              x: rect.x, y: rect.y, width: rect.width, height: rect.height
            };
          })
        }))()`,
        true,
      );
      let accessibilityTree: unknown = null;
      const debuggerApi = contents.debugger;
      const wasAttached = debuggerApi.isAttached();
      try {
        if (!wasAttached) debuggerApi.attach("1.3");
        accessibilityTree = await debuggerApi.sendCommand("Accessibility.getFullAXTree");
      } finally {
        if (!wasAttached && debuggerApi.isAttached()) debuggerApi.detach();
      }
      const image = await contents.capturePage();
      const size = image.getSize();
      return {
        url: contents.getURL(),
        title: contents.getTitle(),
        loading: session.loading,
        visibleText: page.visibleText,
        interactiveElements: page.interactiveElements,
        accessibilityTree,
        consoleEntries: [...(session.consoleEntries ?? [])],
        networkEntries: [...(session.networkEntries ?? [])],
        actionTimeline: [...(session.actionTimeline ?? [])],
        screenshot: {
          mimeType: "image/png",
          data: image.toPNG().toString("base64"),
          width: size.width,
          height: size.height,
        },
      };
    }

    if (request.operation === "press") {
      if (typeof input.key !== "string" || input.key.length === 0) {
        throw new Error("A key is required.");
      }
      const modifierMap = {
        Alt: "alt",
        Control: "control",
        Meta: "meta",
        Shift: "shift",
      } as const;
      const modifiers = Array.isArray(input.modifiers)
        ? input.modifiers.flatMap((value) =>
            typeof value === "string" && value in modifierMap
              ? [modifierMap[value as keyof typeof modifierMap]]
              : [],
          )
        : [];
      return this.trackAutomation(session, "press", async () => {
        contents.sendInputEvent({ type: "keyDown", keyCode: input.key as string, modifiers });
        contents.sendInputEvent({ type: "keyUp", keyCode: input.key as string, modifiers });
        return { pressed: true };
      });
    }

    if (request.operation === "click") {
      return this.trackAutomation(session, "click", async () => {
        if (typeof input.x === "number" && typeof input.y === "number") {
          contents.sendInputEvent({
            type: "mouseDown",
            x: input.x,
            y: input.y,
            button: "left",
            clickCount: 1,
          });
          contents.sendInputEvent({
            type: "mouseUp",
            x: input.x,
            y: input.y,
            button: "left",
            clickCount: 1,
          });
        } else {
          const target = pageTargetExpression(input);
          const clicked = await contents.executeJavaScript(
            `(() => { const element = ${target}; if (!(element instanceof HTMLElement)) return false; element.click(); return true; })()`,
            true,
          );
          if (!clicked) throw new Error("The browser click target was not found.");
        }
        return { clicked: true };
      });
    }

    if (request.operation === "type") {
      if (typeof input.text !== "string") throw new Error("Text is required.");
      const target = pageTargetExpression(input);
      const encodedText = JSON.stringify(input.text);
      const clear = input.clear === true;
      return this.trackAutomation(session, "type", async () => {
        const typed = await contents.executeJavaScript(
          `(() => {
          const element = ${target};
          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLElement && element.isContentEditable)) return false;
          element.focus();
          if (${clear}) {
            if ("value" in element) element.value = "";
            else element.textContent = "";
          }
          if ("value" in element) element.value += ${encodedText};
          else element.textContent = (element.textContent || "") + ${encodedText};
          element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ${encodedText} }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        })()`,
          true,
        );
        if (!typed) throw new Error("The browser type target is not editable.");
        return { typed: true };
      });
    }

    if (request.operation === "scroll") {
      const target = pageTargetExpression(input);
      const deltaX = typeof input.deltaX === "number" ? input.deltaX : 0;
      const deltaY = typeof input.deltaY === "number" ? input.deltaY : 0;
      return this.trackAutomation(session, "scroll", async () => {
        await contents.executeJavaScript(
          `(() => { const target = ${target}; (target || window).scrollBy(${deltaX}, ${deltaY}); })()`,
          true,
        );
        return { scrolled: true };
      });
    }

    if (request.operation === "waitFor") {
      const timeoutMs =
        typeof input.timeoutMs === "number"
          ? Math.min(60_000, Math.max(1, input.timeoutMs))
          : 15_000;
      const deadline = Date.now() + timeoutMs;
      return this.trackAutomation(session, "waitFor", async () => {
        while (Date.now() <= deadline) {
          const target = pageTargetExpression(input);
          const text = typeof input.text === "string" ? JSON.stringify(input.text) : "null";
          const url =
            typeof input.urlIncludes === "string" ? JSON.stringify(input.urlIncludes) : "null";
          const matched = await contents.executeJavaScript(
            `(() => {
            const target = ${target};
            const text = ${text};
            const url = ${url};
            return (!${Boolean(input.selector || input.locator)} || Boolean(target))
              && (!text || (document.body?.innerText || "").includes(text))
              && (!url || location.href.includes(url));
          })()`,
            true,
          );
          if (matched) return { matched: true };
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(`Browser wait timed out after ${timeoutMs}ms.`);
      });
    }

    throw new Error(`Unsupported browser automation operation: ${request.operation}`);
  }

  async captureScreenshot(
    input: DesktopBrowserHostControlInput,
  ): Promise<DesktopPreviewScreenshotArtifact> {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session || session.view.webContents.isDestroyed()) {
      throw new Error("The requested browser session is unavailable.");
    }
    const image = await session.view.webContents.capturePage();
    const data = image.toPNG();
    const createdAt = new Date().toISOString();
    const id = `browser-screenshot-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const artifactDirectory = this.artifactDirectory();
    const artifactPath = Path.join(artifactDirectory, `${id}.png`);
    await FS.mkdir(artifactDirectory, { recursive: true });
    await FS.writeFile(artifactPath, data, { flag: "wx" });
    return {
      id,
      tabId: session.sessionId,
      path: artifactPath,
      mimeType: "image/png",
      sizeBytes: data.byteLength,
      createdAt,
    };
  }

  getMediaSourceId(input: DesktopBrowserHostControlInput): string {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session || session.view.webContents.isDestroyed()) {
      throw new Error("The requested browser session is unavailable.");
    }
    const requestContents = this.getWindow()?.webContents;
    if (!requestContents) throw new Error("The browser recording renderer is unavailable.");
    return session.view.webContents.getMediaSourceId(requestContents);
  }

  async saveRecording(
    input: DesktopBrowserHostControlInput & { mimeType: string; data: Uint8Array },
  ): Promise<DesktopPreviewRecordingArtifact> {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session) throw new Error("The requested browser session is unavailable.");
    const extension = input.mimeType.includes("mp4") ? "mp4" : "webm";
    const createdAt = new Date().toISOString();
    const id = `browser-recording-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const artifactDirectory = this.artifactDirectory();
    const artifactPath = Path.join(artifactDirectory, `${id}.${extension}`);
    await FS.mkdir(artifactDirectory, { recursive: true });
    await FS.writeFile(artifactPath, input.data, { flag: "wx" });
    return {
      id,
      tabId: session.sessionId,
      path: artifactPath,
      mimeType: input.mimeType,
      sizeBytes: input.data.byteLength,
      createdAt,
    };
  }

  async pickElement(
    input: DesktopBrowserHostControlInput,
  ): Promise<PreviewAnnotationPayload | null> {
    const session = this.sessions.get(this.sessionKey(input.projectId, input.sessionId));
    if (!session || session.view.webContents.isDestroyed()) {
      throw new Error("The requested browser session is unavailable.");
    }
    const picked = (await session.view.webContents.executeJavaScript(
      `(() => new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.setAttribute("data-tabs-element-picker", "");
        Object.assign(overlay.style, {
          position: "fixed", pointerEvents: "none", zIndex: "2147483647",
          border: "2px solid #7c3aed", background: "rgba(124,58,237,.14)",
          boxSizing: "border-box", display: "none"
        });
        const help = document.createElement("div");
        help.textContent = "Select an element · Esc to cancel";
        Object.assign(help.style, {
          position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)",
          zIndex: "2147483647", padding: "8px 12px", borderRadius: "8px",
          color: "white", background: "rgba(17,24,39,.94)", font: "12px system-ui",
          pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,.3)"
        });
        document.documentElement.append(overlay, help);
        let hovered = null;
        const cleanup = () => {
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("click", onClick, true);
          document.removeEventListener("keydown", onKey, true);
          overlay.remove(); help.remove();
        };
        const selectorFor = (element) => {
          if (element.id) return "#" + CSS.escape(element.id);
          const parts = [];
          for (let current = element; current && current.nodeType === 1 && parts.length < 6; current = current.parentElement) {
            let part = current.tagName.toLowerCase();
            const stableClasses = [...current.classList].filter((name) => /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name)).slice(0, 2);
            if (stableClasses.length) part += stableClasses.map((name) => "." + CSS.escape(name)).join("");
            const siblings = current.parentElement ? [...current.parentElement.children].filter((child) => child.tagName === current.tagName) : [];
            if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
            parts.unshift(part);
          }
          return parts.join(" > ") || null;
        };
        const onMove = (event) => {
          const target = event.target;
          if (!(target instanceof Element) || target === overlay || target === help) return;
          hovered = target;
          const rect = target.getBoundingClientRect();
          Object.assign(overlay.style, { display: "block", left: rect.x + "px", top: rect.y + "px", width: rect.width + "px", height: rect.height + "px" });
        };
        const onClick = (event) => {
          event.preventDefault(); event.stopImmediatePropagation();
          const target = hovered;
          if (!(target instanceof HTMLElement)) return;
          const rect = target.getBoundingClientRect();
          const computed = getComputedStyle(target);
          const styles = ["display", "position", "color", "background-color", "font", "margin", "padding", "border", "border-radius", "width", "height"]
            .map((property) => property + ": " + computed.getPropertyValue(property) + ";").join("\n");
          const result = {
            pageUrl: location.href, pageTitle: document.title?.trim() || null,
            tagName: target.tagName.toLowerCase(), selector: selectorFor(target),
            htmlPreview: target.outerHTML.slice(0, 12000), componentName: null,
            source: null, stack: [], styles, pickedAt: new Date().toISOString(),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          };
          cleanup(); resolve(result);
        };
        const onKey = (event) => {
          if (event.key !== "Escape") return;
          event.preventDefault(); event.stopImmediatePropagation(); cleanup(); resolve(null);
        };
        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("keydown", onKey, true);
      }))()`,
      true,
    )) as
      | (PickedElementPayload & {
          rect: { x: number; y: number; width: number; height: number };
        })
      | null;
    if (!picked) return null;
    const image = await session.view.webContents.capturePage();
    const size = image.getSize();
    const { rect, ...element } = picked;
    return {
      id: `annotation-${crypto.randomUUID()}`,
      pageUrl: element.pageUrl as string,
      pageTitle: element.pageTitle as string | null,
      comment: "",
      elements: [{ id: `element-${crypto.randomUUID()}`, element, rect }],
      regions: [],
      strokes: [],
      styleChanges: [],
      screenshot: {
        dataUrl: `data:image/png;base64,${image.toPNG().toString("base64")}`,
        width: size.width,
        height: size.height,
        cropRect: rect,
      },
      createdAt: new Date().toISOString(),
    };
  }

  revealArtifact(artifactPath: string): void {
    shell.showItemInFolder(this.requireArtifactPath(artifactPath));
  }

  async copyArtifactToClipboard(artifactPath: string): Promise<void> {
    const safePath = this.requireArtifactPath(artifactPath);
    const data = await FS.readFile(safePath);
    const image = nativeImage.createFromBuffer(data);
    if (image.isEmpty()) throw new Error("The browser artifact is not a readable image.");
    await clipboard.write([
      new ClipboardItem({ "image/png": new Blob([new Uint8Array(data)], { type: "image/png" }) }),
    ]);
  }

  private artifactDirectory(): string {
    return Path.join(app.getPath("userData"), "browser-artifacts");
  }

  private requireArtifactPath(artifactPath: string): string {
    const artifactDirectory = Path.resolve(this.artifactDirectory());
    const resolved = Path.resolve(artifactPath);
    if (!resolved.startsWith(`${artifactDirectory}${Path.sep}`)) {
      throw new Error("Browser artifacts must be inside the Tabs artifact directory.");
    }
    return resolved;
  }

  private sessionForWebContentsId(webContentsId: number | undefined): BrowserSession | undefined {
    if (webContentsId === undefined) return undefined;
    return [...this.sessions.values()].find(
      (candidate) => candidate.view.webContents.id === webContentsId,
    );
  }

  private async trackAutomation<T>(
    session: BrowserSession,
    action: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const event: BrowserActionEvent = {
      id: crypto.randomUUID(),
      action,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    session.actionTimeline ??= [];
    appendBounded(session.actionTimeline, event);
    try {
      const result = await run();
      event.status = "succeeded";
      event.completedAt = new Date().toISOString();
      return result;
    } catch (cause) {
      event.status = "failed";
      event.completedAt = new Date().toISOString();
      event.error = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    }
  }

  private observeAutomationNetwork(browserSession: Session): void {
    if (this.observedAutomationSessions.has(browserSession)) return;
    this.observedAutomationSessions.add(browserSession);
    browserSession.webRequest.onCompleted((details) => {
      const target = this.sessionForWebContentsId(details.webContentsId);
      if (!target) return;
      target.networkEntries ??= [];
      appendBounded(target.networkEntries, {
        url: details.url,
        method: details.method,
        status: details.statusCode,
        failed: false,
        timestamp: new Date().toISOString(),
      });
    });
    browserSession.webRequest.onErrorOccurred((details) => {
      const target = this.sessionForWebContentsId(details.webContentsId);
      if (!target) return;
      target.networkEntries ??= [];
      appendBounded(target.networkEntries, {
        url: details.url,
        method: details.method,
        status: null,
        failed: true,
        errorText: details.error,
        timestamp: new Date().toISOString(),
      });
    });
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
    session.transientError = null;
    this.emitState(session);
    try {
      await session.view.webContents.loadURL(url);
    } catch {
      // Electron's loadURL rejects when navigation fails (e.g. ERR_CONNECTION_REFUSED, ERR_ABORTED).
      // The did-fail-load event listener captures the error and updates session state cleanly.
    }
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
      transientError: session.transientError,
    };
  }

  private emitState(session: BrowserSession): void {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.send("desktop:browser-host:session-state", this.snapshotSession(session));
  }

  private observeProfileSession(partition: string, s: Session): void {
    if (!partition.startsWith(PROFILE_PARTITION_PREFIX) || this.observedProfileSessions.has(s)) {
      return;
    }
    const profileId = partition.slice(PROFILE_PARTITION_PREFIX.length);
    if (!BROWSER_PROFILE_ID_PATTERN.test(profileId)) return;
    this.observedProfileSessions.add(s);
    s.cookies.on("changed", () => {
      const window = this.getWindow();
      if (!window || window.isDestroyed()) return;
      window.webContents.send("desktop:browser-host:profile-data-changed", profileId);
    });
  }

  private attachSession(session: BrowserSession): void {
    const window = this.getWindow();
    if (!window) return;
    const currentViews = window.contentView.children;
    if (!currentViews.includes(session.view)) {
      window.contentView.addChildView(session.view);
    }
    session.view.webContents.focus?.();
  }

  private detachSession(session: BrowserSession): void {
    const window = this.getWindow();
    if (!window) return;
    const currentViews = window.contentView.children;
    if (currentViews.includes(session.view)) {
      window.contentView.removeChildView(session.view);
    }
  }

  private registerSessionEvents(session: BrowserSession): void {
    const contents = session.view.webContents;
    const refreshNavigationState = () => {
      session.canGoBack = contents.canGoBack();
      session.canGoForward = contents.canGoForward();
    };
    let authenticationWindowPending = false;
    const openAuthenticationWindow = (url: string, originatingUrl: string) => {
      if (authenticationWindowPending) return;
      authenticationWindowPending = true;
      const profileId = session.partition.startsWith(PROFILE_PARTITION_PREFIX)
        ? session.partition.slice(PROFILE_PARTITION_PREFIX.length)
        : session.projectId;
      void this.openLoginWindow(session.partition, profileId, url, originatingUrl).finally(() => {
        authenticationWindowPending = false;
        if (!contents.isDestroyed()) contents.reload();
      });
    };

    contents.on("will-navigate", (event, url) => {
      const currentUrl = contents.getURL();
      if (!isLikelyAuthenticationUrl(url) || isLikelyAuthenticationUrl(currentUrl)) return;
      event.preventDefault();
      openAuthenticationWindow(url, currentUrl);
    });

    contents.on("did-start-loading", () => {
      session.loading = true;
      session.lastError = null;
      session.transientError = null;
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
      session.transientError = null;
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
        // ERR_CONNECTION_REFUSED (-102): dev server hasn't bound to the port yet.
        // Treat as a transient startup condition — the frontend will show a
        // "Starting..." overlay and retry. Do NOT set lastError here.
        if (errorCode === -102) {
          session.transientError = errorDescription || "ERR_CONNECTION_REFUSED";
          session.lastError = null;
        } else {
          session.lastError = errorDescription || "Unable to load page.";
          session.transientError = null;
        }
        refreshNavigationState();
        this.emitState(session);
      },
    );
    // A blank embed used to be indistinguishable from a crash: if the page's
    // renderer process died, the WebContentsView just painted its background color
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
      session.consoleEntries ??= [];
      appendBounded(session.consoleEntries, {
        level: details.level,
        text: details.message,
        timestamp: new Date().toISOString(),
        ...(details.sourceId.length > 0
          ? { source: `${details.sourceId}:${details.lineNumber}` }
          : {}),
      });
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
      if (disposition === "new-window" && isLikelyAuthenticationUrl(url)) {
        openAuthenticationWindow(url, contents.getURL());
        return { action: "deny" };
      }
      if (disposition === "new-window") {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            webPreferences: {
              contextIsolation: true,
              sandbox: true,
              nodeIntegration: false,
              partition: session.partition || `persist:tabs-browser:${session.projectId}`,
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
                  partition: session.partition || `persist:tabs-browser:${session.projectId}`,
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
