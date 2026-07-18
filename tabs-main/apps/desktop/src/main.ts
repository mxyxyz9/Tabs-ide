import * as ChildProcess from "node:child_process";
import * as Crypto from "node:crypto";
import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  protocol,
  session,
  shell,
} from "electron";
import type { MenuItemConstructorOptions } from "electron";
import * as Effect from "effect/Effect";
import type {
  DesktopIconTheme,
  DesktopTheme,
  DesktopUpdateActionResult,
  DesktopUpdateState,
} from "@tabs/contracts";
import { DEFAULT_DESKTOP_ICON_THEME } from "@tabs/contracts/settings";
import { autoUpdater } from "electron-updater";

import type {
  ContextMenuItem,
  DesktopCloneRepositoryInput,
  DesktopCloneRepositoryResult,
} from "@tabs/contracts";
import { NetService, layer as netServiceLayer } from "@tabs/shared/Net";
import { RotatingFileSink } from "@tabs/shared/logging";
import { showDesktopConfirmDialog } from "./confirmDialog";
import { DesktopShutdown, layer as shutdownLayer } from "./app/DesktopShutdown";
import { syncShellEnvironment } from "./syncShellEnvironment";
import { getAutoUpdateDisabledReason, shouldBroadcastDownloadProgress } from "./updateState";
import {
  createInitialDesktopUpdateState,
  reduceDesktopUpdateStateOnCheckFailure,
  reduceDesktopUpdateStateOnCheckStart,
  reduceDesktopUpdateStateOnDownloadComplete,
  reduceDesktopUpdateStateOnDownloadFailure,
  reduceDesktopUpdateStateOnDownloadProgress,
  reduceDesktopUpdateStateOnDownloadStart,
  reduceDesktopUpdateStateOnInstallFailure,
  reduceDesktopUpdateStateOnNoUpdate,
  reduceDesktopUpdateStateOnUpdateAvailable,
} from "./updateMachine";
import { isArm64HostRunningIntelBuild, resolveDesktopRuntimeInfo } from "./runtimeArch";
import {
  CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
  CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH,
  CODE_OSS_EMBED_EXTENSION_RELATIVE_PATH,
  CODE_OSS_NLS_MESSAGES_RELATIVE_PATH,
  CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH,
  CodeHostManager,
  resolveCodeHostConfig,
} from "./codeHostManager";
import { BrowserHostManager } from "./browserHostManager";
import {
  ensureRuntimeInstalled,
  isRuntimeInstalled,
  resolveInstalledRuntimeDir,
  type RuntimeInstallProgress,
} from "./codeOssRuntimeInstaller";
import { CodeControlChannel } from "./codeControlChannel";
import { getTailscaleStatus } from "./tailscale";
import type { CodeChromeState } from "@tabs/shared/codeChrome";

syncShellEnvironment();

const PICK_FOLDER_CHANNEL = "desktop:pick-folder";
const CLONE_REPOSITORY_CHANNEL = "desktop:clone-repository";
const PICK_FILE_CHANNEL = "desktop:pick-file";
const CONFIRM_CHANNEL = "desktop:confirm";
const SET_THEME_CHANNEL = "desktop:set-theme";
const SET_ICON_THEME_CHANNEL = "desktop:set-icon-theme";
const CONTEXT_MENU_CHANNEL = "desktop:context-menu";
const OPEN_EXTERNAL_CHANNEL = "desktop:open-external";
const MENU_ACTION_CHANNEL = "desktop:menu-action";
const APP_CLOSING_CHANNEL = "desktop:app-closing";
const UPDATE_STATE_CHANNEL = "desktop:update-state";
const UPDATE_GET_STATE_CHANNEL = "desktop:update-get-state";
const UPDATE_DOWNLOAD_CHANNEL = "desktop:update-download";
const UPDATE_INSTALL_CHANNEL = "desktop:update-install";
const GET_WS_URL_CHANNEL = "desktop:get-ws-url";
const CODE_HOST_GET_STATE_CHANNEL = "desktop:code-host:get-state";
const CODE_HOST_ENSURE_SESSION_CHANNEL = "desktop:code-host:ensure-session";
const CODE_HOST_ACTIVATE_SESSION_CHANNEL = "desktop:code-host:activate-session";
const CODE_HOST_HIDE_SESSION_CHANNEL = "desktop:code-host:hide-session";
const CODE_HOST_OPEN_FILE_CHANNEL = "desktop:code-host:open-file";
const CODE_HOST_SET_BOUNDS_CHANNEL = "desktop:code-host:set-bounds";
const CODE_HOST_SYNC_SESSIONS_CHANNEL = "desktop:code-host:sync-sessions";
// Native Code-tab chrome ↔ embedded workbench command bridge (see
// codeControlChannel.ts). The renderer invokes run-command; main pushes
// chrome-state updates back to the renderer.
const CODE_HOST_RUN_COMMAND_CHANNEL = "desktop:code-host:run-command";
const CODE_HOST_CHROME_STATE_CHANNEL = "desktop:code-host:chrome-state";
const BROWSER_HOST_GET_STATE_CHANNEL = "desktop:browser-host:get-state";
const BROWSER_HOST_GET_SESSION_STATE_CHANNEL = "desktop:browser-host:get-session-state";
const BROWSER_HOST_ENSURE_SESSION_CHANNEL = "desktop:browser-host:ensure-session";
const BROWSER_HOST_ACTIVATE_SESSION_CHANNEL = "desktop:browser-host:activate-session";
const BROWSER_HOST_HIDE_SESSION_CHANNEL = "desktop:browser-host:hide-session";
const BROWSER_HOST_NAVIGATE_SESSION_CHANNEL = "desktop:browser-host:navigate-session";
const BROWSER_HOST_RELOAD_SESSION_CHANNEL = "desktop:browser-host:reload-session";
const BROWSER_HOST_BACK_SESSION_CHANNEL = "desktop:browser-host:back-session";
const BROWSER_HOST_FORWARD_SESSION_CHANNEL = "desktop:browser-host:forward-session";
const BROWSER_HOST_TOGGLE_DEVTOOLS_CHANNEL = "desktop:browser-host:toggle-devtools";
const BROWSER_HOST_SET_BOUNDS_CHANNEL = "desktop:browser-host:set-bounds";
const BROWSER_HOST_SYNC_SESSIONS_CHANNEL = "desktop:browser-host:sync-sessions";

function readBrowserSessionId(input: unknown): string | undefined {
  const value = (input as { sessionId?: unknown }).sessionId;
  return typeof value === "string" ? value : undefined;
}
const VSCODE_FETCH_SHELL_ENV_CHANNEL = "vscode:fetchShellEnv";
const VSCODE_TOGGLE_DEVTOOLS_CHANNEL = "vscode:toggleDevTools";
const VSCODE_OPEN_DEVTOOLS_CHANNEL = "vscode:openDevTools";
const VSCODE_RELOAD_WINDOW_CHANNEL = "vscode:reloadWindow";
const VSCODE_NOTIFY_ZOOM_LEVEL_CHANNEL = "vscode:notifyZoomLevel";
const BASE_DIR = process.env.TABS_HOME?.trim() || Path.join(OS.homedir(), ".tabs");
const STATE_DIR = Path.join(BASE_DIR, "userdata");
const DESKTOP_SCHEME = "tabs";
// In packaged apps, ROOT_DIR should point to the Resources directory, not inside the asar.
// __dirname in packaged app: /path/to/Tabs.app/Contents/Resources/app.asar/apps/desktop/dist-electron
// We need ROOT_DIR to be: /path/to/Tabs.app/Contents/Resources (where tabs-code-main lives).
//
// IMPORTANT: This MUST be a function call — a top-level ternary referencing `app.isPackaged`
// gets tree-shaken by tsdown/esbuild because the bundler evaluates the electron import as
// a static external and folds the branch away.  A function body is opaque to the bundler.
function resolveRootDir(): string {
  // Dynamic require ensures the bundler cannot statically evaluate this branch.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _electron = require("electron") as typeof import("electron");
  if (_electron.app.isPackaged && process.resourcesPath) {
    return process.resourcesPath;
  }
  return Path.resolve(__dirname, "../../..");
}
const ROOT_DIR = resolveRootDir();

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const APP_BASE_NAME = "Tabs";
const APP_DISPLAY_NAME = isDevelopment ? `${APP_BASE_NAME} (Dev)` : APP_BASE_NAME;
const APP_USER_MODEL_ID = "com.tabs.app";
const USER_DATA_DIR_NAME = isDevelopment ? "tabs-dev" : "tabs";
const LEGACY_USER_DATA_DIR_NAME = isDevelopment ? "Tabs (Dev)" : "Tabs (Alpha)";
const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,40}$/i;
const COMMIT_HASH_DISPLAY_LENGTH = 12;
const LOG_DIR = Path.join(STATE_DIR, "logs");
const DEV_DESKTOP_LOG_PATH = Path.join(STATE_DIR, "desktop-dev.log");
const SLIDER_DEBUG_LOG_PATH = Path.join(process.cwd(), "slider-debug.log");
const DESKTOP_PREFERENCES_PATH = Path.join(STATE_DIR, "desktop-preferences.json");
const LOG_FILE_MAX_BYTES = 10 * 1024 * 1024;
const LOG_FILE_MAX_FILES = 10;

type DesktopPreferences = {
  iconTheme?: DesktopIconTheme;
};
const APP_RUN_ID = Crypto.randomBytes(6).toString("hex");
const AUTO_UPDATE_STARTUP_DELAY_MS = 15_000;
const AUTO_UPDATE_POLL_INTERVAL_MS = 4 * 60 * 60 * 1000;
const DESKTOP_UPDATE_CHANNEL = "latest";
const DESKTOP_UPDATE_ALLOW_PRERELEASE = false;
const CODE_OSS_READY_TIMEOUT_MS = 60_000;

type DesktopUpdateErrorContext = DesktopUpdateState["errorContext"];

let mainWindow: BrowserWindow | null = null;
let currentDesktopIconTheme = loadDesktopIconThemePreference();
let backendProcess: ChildProcess.ChildProcess | null = null;
let backendPort = 0;
let backendAuthToken = "";
let backendWsUrl = "";
let backendHttpUrl = "";
let restartAttempt = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let isQuitting = false;
let desktopProtocolRegistered = false;
let codeOssFileProtocolRegistered = false;
let aboutCommitHashCache: string | null | undefined;
let desktopLogSink: RotatingFileSink | null = null;
let backendLogSink: RotatingFileSink | null = null;
let restoreStdIoCapture: (() => void) | null = null;
// Level B (thin installer): when the runtime isn't bundled, resolve a
// previously-downloaded one for this app version so the editor "just works"
// after the one-time download.
if (!process.env.TABS_CODE_OSS_BUILD_DIR?.trim() && isRuntimeInstalled(app.getVersion())) {
  process.env.TABS_CODE_OSS_BUILD_DIR = resolveInstalledRuntimeDir(app.getVersion());
}
const codeHostConfig = resolveCodeHostConfig({
  rootDir: ROOT_DIR,
  env: process.env,
});
const codeHostManager = new CodeHostManager(() => mainWindow, codeHostConfig);
const browserHostManager = new BrowserHostManager(() => mainWindow);
const codeControlChannel = new CodeControlChannel();
const CODE_OSS_FILE_PROTOCOL = "vscode-file";
const CODE_OSS_FILE_PROTOCOL_AUTHORITY = "vscode-app";
const CODE_OSS_PRIMARY_STATE_DIR = Path.join(STATE_DIR, "code-oss-main");
const TABS_CODE_OSS_INTEGRATION_EXTENSION_RELATIVE_PATH = Path.join(
  "apps",
  "desktop",
  "resources",
  "code-oss-extensions",
  "tabs-workbench-integration",
);

let destructiveMenuIconCache: Electron.NativeImage | null | undefined;
const desktopRuntimeInfo = resolveDesktopRuntimeInfo({
  platform: process.platform,
  processArch: process.arch,
  runningUnderArm64Translation: app.runningUnderARM64Translation === true,
});
const initialUpdateState = (): DesktopUpdateState =>
  createInitialDesktopUpdateState(app.getVersion(), desktopRuntimeInfo);

function logTimestamp(): string {
  return new Date().toISOString();
}

function logScope(scope: string): string {
  return `${scope} run=${APP_RUN_ID}`;
}

function sanitizeLogValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function backendChildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.TABS_PORT;
  delete env.TABS_AUTH_TOKEN;
  delete env.TABS_MODE;
  delete env.TABS_NO_BROWSER;
  delete env.TABS_HOST;
  delete env.TABS_DESKTOP_WS_URL;
  return env;
}

function writeDesktopLogHeader(message: string): void {
  if (isDevelopment) {
    const line = `[${logTimestamp()}] [desktop-dev] ${message}\n`;
    try {
      FS.mkdirSync(STATE_DIR, { recursive: true });
      FS.appendFileSync(DEV_DESKTOP_LOG_PATH, line, "utf8");
    } catch {
      // Ignore dev logging failures.
    }
  }
  if (!desktopLogSink) return;
  desktopLogSink.write(`[${logTimestamp()}] [${logScope("desktop")}] ${message}\n`);
}

function writeBackendSessionBoundary(phase: "START" | "END", details: string): void {
  if (!backendLogSink) return;
  const normalizedDetails = sanitizeLogValue(details);
  backendLogSink.write(
    `[${logTimestamp()}] ---- APP SESSION ${phase} run=${APP_RUN_ID} ${normalizedDetails} ----\n`,
  );
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getSafeExternalUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return null;
  }

  return parsedUrl.toString();
}

function getSafeTheme(rawTheme: unknown): DesktopTheme | null {
  if (rawTheme === "light" || rawTheme === "dark" || rawTheme === "system") {
    return rawTheme;
  }

  return null;
}

function writeDesktopStreamChunk(
  streamName: "stdout" | "stderr",
  chunk: unknown,
  encoding: BufferEncoding | undefined,
): void {
  if (!desktopLogSink) return;
  const buffer = Buffer.isBuffer(chunk)
    ? chunk
    : Buffer.from(String(chunk), typeof chunk === "string" ? encoding : undefined);
  desktopLogSink.write(`[${logTimestamp()}] [${logScope(streamName)}] `);
  desktopLogSink.write(buffer);
  if (buffer.length === 0 || buffer[buffer.length - 1] !== 0x0a) {
    desktopLogSink.write("\n");
  }
}

function installStdIoCapture(): void {
  if (!app.isPackaged || desktopLogSink === null || restoreStdIoCapture !== null) {
    return;
  }

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  const patchWrite =
    (streamName: "stdout" | "stderr", originalWrite: typeof process.stdout.write) =>
    (
      chunk: string | Uint8Array,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ): boolean => {
      const encoding = typeof encodingOrCallback === "string" ? encodingOrCallback : undefined;
      writeDesktopStreamChunk(streamName, chunk, encoding);
      if (typeof encodingOrCallback === "function") {
        return originalWrite(chunk, encodingOrCallback);
      }
      if (callback !== undefined) {
        return originalWrite(chunk, encoding, callback);
      }
      if (encoding !== undefined) {
        return originalWrite(chunk, encoding);
      }
      return originalWrite(chunk);
    };

  process.stdout.write = patchWrite("stdout", originalStdoutWrite);
  process.stderr.write = patchWrite("stderr", originalStderrWrite);

  restoreStdIoCapture = () => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    restoreStdIoCapture = null;
  };
}

function initializePackagedLogging(): void {
  if (!app.isPackaged) return;
  try {
    desktopLogSink = new RotatingFileSink({
      filePath: Path.join(LOG_DIR, "desktop-main.log"),
      maxBytes: LOG_FILE_MAX_BYTES,
      maxFiles: LOG_FILE_MAX_FILES,
    });
    backendLogSink = new RotatingFileSink({
      filePath: Path.join(LOG_DIR, "server-child.log"),
      maxBytes: LOG_FILE_MAX_BYTES,
      maxFiles: LOG_FILE_MAX_FILES,
    });
    installStdIoCapture();
    writeDesktopLogHeader(`runtime log capture enabled logDir=${LOG_DIR}`);
  } catch (error) {
    // Logging setup should never block app startup.
    console.error("[desktop] failed to initialize packaged logging", error);
  }
}

function captureBackendOutput(child: ChildProcess.ChildProcess): void {
  if (!app.isPackaged || backendLogSink === null) return;
  const writeChunk = (chunk: unknown): void => {
    if (!backendLogSink) return;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
    backendLogSink.write(buffer);
  };
  child.stdout?.on("data", writeChunk);
  child.stderr?.on("data", writeChunk);
}

initializePackagedLogging();

function getDestructiveMenuIcon(): Electron.NativeImage | undefined {
  if (process.platform !== "darwin") return undefined;
  if (destructiveMenuIconCache !== undefined) {
    return destructiveMenuIconCache ?? undefined;
  }
  try {
    const icon = nativeImage.createFromNamedImage("trash").resize({
      width: 14,
      height: 14,
    });
    if (icon.isEmpty()) {
      destructiveMenuIconCache = null;
      return undefined;
    }
    icon.setTemplateImage(true);
    destructiveMenuIconCache = icon;
    return icon;
  } catch {
    destructiveMenuIconCache = null;
    return undefined;
  }
}

/**
 * Per-platform title-bar configuration.
 *
 * - macOS: inset traffic lights over our custom top bar (`hiddenInset`).
 * - Windows: hide the native title bar and overlay the caption buttons onto our
 *   own top bar via the Window Controls Overlay. Without this Windows renders a
 *   separate native title-bar strip *above* the tabs, which looks odd.
 * - Linux: keep the previous behavior.
 */
function resolveTitleBarOptions(): Pick<
  Electron.BrowserWindowConstructorOptions,
  "titleBarStyle" | "trafficLightPosition" | "titleBarOverlay"
> {
  if (process.platform === "darwin") {
    return { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 18 } };
  }
  if (process.platform === "win32") {
    return {
      titleBarStyle: "hidden",
      // Matches the app's dark top-bar surface and the 52px header height so the
      // min/maximize/close buttons sit on the tab bar instead of a native strip.
      titleBarOverlay: { color: "#161616", symbolColor: "#cfcfcf", height: 52 },
    };
  }
  return { titleBarStyle: "hiddenInset" };
}
let updatePollTimer: ReturnType<typeof setInterval> | null = null;
let updateStartupTimer: ReturnType<typeof setTimeout> | null = null;
let updateCheckInFlight = false;
let updateDownloadInFlight = false;
let updaterConfigured = false;
let updateState: DesktopUpdateState = initialUpdateState();

function resolveUpdaterErrorContext(): DesktopUpdateErrorContext {
  if (updateDownloadInFlight) return "download";
  if (updateCheckInFlight) return "check";
  return updateState.errorContext;
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: DESKTOP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: "vscode-file",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      codeCache: true,
    },
  },
  {
    scheme: "vscode-webview",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
      codeCache: true,
    },
  },
]);

function resolveAppRoot(): string {
  if (!app.isPackaged) {
    return ROOT_DIR;
  }
  return app.getAppPath();
}

/** Read the baked-in app-update.yml config (if applicable). */
function readAppUpdateYml(): Record<string, string> | null {
  try {
    // electron-updater reads from process.resourcesPath in packaged builds,
    // or dev-app-update.yml via app.getAppPath() in dev.
    const ymlPath = app.isPackaged
      ? Path.join(process.resourcesPath, "app-update.yml")
      : Path.join(app.getAppPath(), "dev-app-update.yml");
    const raw = FS.readFileSync(ymlPath, "utf-8");
    // The YAML is simple key-value pairs — avoid pulling in a YAML parser by
    // doing a line-based parse (fields: provider, owner, repo, releaseType, …).
    const entries: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match?.[1] && match[2]) entries[match[1]] = match[2].trim();
    }
    return entries.provider ? entries : null;
  } catch {
    return null;
  }
}

function normalizeCommitHash(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!COMMIT_HASH_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed.slice(0, COMMIT_HASH_DISPLAY_LENGTH).toLowerCase();
}

function resolveEmbeddedCommitHash(): string | null {
  const packageJsonPath = Path.join(resolveAppRoot(), "package.json");
  if (!FS.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const raw = FS.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { tabsCommitHash?: unknown };
    return normalizeCommitHash(parsed.tabsCommitHash);
  } catch {
    return null;
  }
}

function resolveAboutCommitHash(): string | null {
  if (aboutCommitHashCache !== undefined) {
    return aboutCommitHashCache;
  }

  const envCommitHash = normalizeCommitHash(process.env.TABS_COMMIT_HASH);
  if (envCommitHash) {
    aboutCommitHashCache = envCommitHash;
    return aboutCommitHashCache;
  }

  // Only packaged builds are required to expose commit metadata.
  if (!app.isPackaged) {
    aboutCommitHashCache = null;
    return aboutCommitHashCache;
  }

  aboutCommitHashCache = resolveEmbeddedCommitHash();

  return aboutCommitHashCache;
}

function resolveBackendEntry(): string {
  return Path.join(resolveAppRoot(), "apps/server/dist/index.mjs");
}

function resolveBackendCwd(): string {
  if (!app.isPackaged) {
    return resolveAppRoot();
  }
  return OS.homedir();
}

function resolveDesktopStaticDir(): string | null {
  const appRoot = resolveAppRoot();
  const candidates = [
    Path.join(appRoot, "apps/server/dist/client"),
    Path.join(appRoot, "apps/web/dist"),
  ];

  for (const candidate of candidates) {
    if (FS.existsSync(Path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return null;
}

function resolveDesktopStaticPath(staticRoot: string, requestUrl: string): string {
  const url = new URL(requestUrl);
  const rawPath = decodeURIComponent(url.pathname);
  const normalizedPath = Path.posix.normalize(rawPath).replace(/^\/+/, "");
  if (normalizedPath.includes("..")) {
    return Path.join(staticRoot, "index.html");
  }

  const requestedPath = normalizedPath.length > 0 ? normalizedPath : "index.html";
  const resolvedPath = Path.join(staticRoot, requestedPath);

  if (Path.extname(resolvedPath)) {
    return resolvedPath;
  }

  const nestedIndex = Path.join(resolvedPath, "index.html");
  if (FS.existsSync(nestedIndex)) {
    return nestedIndex;
  }

  return Path.join(staticRoot, "index.html");
}

function isStaticAssetRequest(requestUrl: string): boolean {
  try {
    const url = new URL(requestUrl);
    return Path.extname(url.pathname).length > 0;
  } catch {
    return false;
  }
}

function handleFatalStartupError(stage: string, error: unknown): void {
  const message = formatErrorMessage(error);
  const detail =
    error instanceof Error && typeof error.stack === "string" ? `\n${error.stack}` : "";
  writeDesktopLogHeader(`fatal startup error stage=${stage} message=${message}`);
  console.error(`[desktop] fatal startup error (${stage})`, error);
  if (!isQuitting) {
    isQuitting = true;
    dialog.showErrorBox("Tabs failed to start", `Stage: ${stage}\n${message}${detail}`);
  }
  stopBackend();
  restoreStdIoCapture?.();
  app.quit();
}

function registerDesktopProtocol(): void {
  if (isDevelopment || desktopProtocolRegistered) return;

  const staticRoot = resolveDesktopStaticDir();
  if (!staticRoot) {
    throw new Error(
      "Desktop static bundle missing. Build apps/server (with bundled client) first.",
    );
  }

  const staticRootResolved = Path.resolve(staticRoot);
  const staticRootPrefix = `${staticRootResolved}${Path.sep}`;
  const fallbackIndex = Path.join(staticRootResolved, "index.html");

  protocol.registerFileProtocol(DESKTOP_SCHEME, (request, callback) => {
    try {
      const candidate = resolveDesktopStaticPath(staticRootResolved, request.url);
      const resolvedCandidate = Path.resolve(candidate);
      const isInRoot =
        resolvedCandidate === fallbackIndex || resolvedCandidate.startsWith(staticRootPrefix);
      const isAssetRequest = isStaticAssetRequest(request.url);

      if (!isInRoot || !FS.existsSync(resolvedCandidate)) {
        if (isAssetRequest) {
          callback({ error: -6 });
          return;
        }
        callback({ path: fallbackIndex });
        return;
      }

      callback({ path: resolvedCandidate });
    } catch {
      callback({ path: fallbackIndex });
    }
  });

  desktopProtocolRegistered = true;
}

function dispatchMenuAction(action: string): void {
  const existingWindow =
    BrowserWindow.getFocusedWindow() ?? mainWindow ?? BrowserWindow.getAllWindows()[0];
  const targetWindow = existingWindow ?? createWindow();
  if (!existingWindow) {
    mainWindow = targetWindow;
  }

  const send = () => {
    if (targetWindow.isDestroyed()) return;
    targetWindow.webContents.send(MENU_ACTION_CHANNEL, action);
    if (!targetWindow.isVisible()) {
      targetWindow.show();
    }
    targetWindow.focus();
  };

  if (targetWindow.webContents.isLoadingMainFrame()) {
    targetWindow.webContents.once("did-finish-load", send);
    return;
  }

  send();
}

function handleCheckForUpdatesMenuClick(): void {
  const disabledReason = getAutoUpdateDisabledReason({
    isDevelopment,
    isPackaged: app.isPackaged,
    platform: process.platform,
    appImage: process.env.APPIMAGE,
    disabledByEnv: process.env.TABS_DISABLE_AUTO_UPDATE === "1",
  });
  if (disabledReason) {
    console.info("[desktop-updater] Manual update check requested, but updates are disabled.");
    void dialog.showMessageBox({
      type: "info",
      title: "Updates unavailable",
      message: "Automatic updates are not available right now.",
      detail: disabledReason,
      buttons: ["OK"],
    });
    return;
  }

  if (!BrowserWindow.getAllWindows().length) {
    mainWindow = createWindow();
  }
  void checkForUpdatesFromMenu();
}

async function checkForUpdatesFromMenu(): Promise<void> {
  await checkForUpdates("menu");

  if (updateState.status === "up-to-date") {
    void dialog.showMessageBox({
      type: "info",
      title: "You're up to date!",
      message: `Tabs ${updateState.currentVersion} is currently the newest version available.`,
      buttons: ["OK"],
    });
  } else if (updateState.status === "error") {
    void dialog.showMessageBox({
      type: "warning",
      title: "Update check failed",
      message: "Could not check for updates.",
      detail: updateState.message ?? "An unknown error occurred. Please try again later.",
      buttons: ["OK"],
    });
  }
}

function configureApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === "darwin") {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        {
          label: "Check for Updates...",
          click: () => handleCheckForUpdatesMenuClick(),
        },
        { type: "separator" },
        {
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => dispatchMenuAction("open-settings"),
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push(
    {
      label: "File",
      submenu: [
        ...(process.platform === "darwin"
          ? []
          : [
              {
                label: "Settings...",
                accelerator: "CmdOrCtrl+,",
                click: () => dispatchMenuAction("open-settings"),
              },
              { type: "separator" as const },
            ]),
        process.platform === "darwin"
          ? // cmd+W closes the active tab (see Tabs menu); window close moves to
            // cmd+shift+W, matching the browser convention.
            { role: "close" as const, accelerator: "CmdOrCtrl+Shift+W" }
          : { role: "quit" as const },
      ],
    },
    { role: "editMenu" },
    {
      label: "Tabs",
      submenu: [
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => dispatchMenuAction("tab-close"),
        },
        { type: "separator" },
        {
          label: "Next Tab",
          accelerator: "CmdOrCtrl+Shift+]",
          click: () => dispatchMenuAction("tab-next"),
        },
        {
          label: "Previous Tab",
          accelerator: "CmdOrCtrl+Shift+[",
          click: () => dispatchMenuAction("tab-prev"),
        },
        // Hidden duplicates so Ctrl+Tab / Ctrl+Shift+Tab also cycle tabs.
        {
          label: "Next Tab",
          accelerator: "Control+Tab",
          visible: false,
          click: () => dispatchMenuAction("tab-next"),
        },
        {
          label: "Previous Tab",
          accelerator: "Control+Shift+Tab",
          visible: false,
          click: () => dispatchMenuAction("tab-prev"),
        },
        { type: "separator" },
        ...Array.from({ length: 9 }, (_, index) => ({
          label: `Go to Tab ${index + 1}`,
          accelerator: `Alt+${index + 1}`,
          click: () => dispatchMenuAction(`tab-go-${index + 1}`),
        })),
        { type: "separator" },
        {
          label: "Switch Tool",
          submenu: Array.from({ length: 9 }, (_, index) => ({
            label: `Tool ${index + 1}`,
            accelerator: `CmdOrCtrl+${index + 1}`,
            click: () => dispatchMenuAction(`tool-go-${index + 1}`),
          })),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn", accelerator: "CmdOrCtrl+=" },
        { role: "zoomIn", accelerator: "CmdOrCtrl+Plus", visible: false },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Check for Updates...",
          click: () => handleCheckForUpdatesMenuClick(),
        },
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function resolveResourcePath(fileName: string): string | null {
  const candidates = [
    Path.join(__dirname, "../resources", fileName),
    Path.join(__dirname, "../prod-resources", fileName),
    Path.join(process.resourcesPath, "resources", fileName),
    Path.join(process.resourcesPath, fileName),
  ];

  for (const candidate of candidates) {
    if (FS.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getSafeIconTheme(rawTheme: unknown): DesktopIconTheme | null {
  return rawTheme === "light" || rawTheme === "dark" ? rawTheme : null;
}

function readDesktopPreferences(): DesktopPreferences {
  try {
    const raw = FS.readFileSync(DESKTOP_PREFERENCES_PATH, "utf8");
    const parsed = JSON.parse(raw) as DesktopPreferences;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeDesktopPreferences(preferences: DesktopPreferences): void {
  FS.mkdirSync(STATE_DIR, { recursive: true });
  FS.writeFileSync(DESKTOP_PREFERENCES_PATH, `${JSON.stringify(preferences, null, 2)}\n`, "utf8");
}

function loadDesktopIconThemePreference(): DesktopIconTheme {
  return readDesktopPreferences().iconTheme ?? DEFAULT_DESKTOP_ICON_THEME;
}

function resolveIconPath(
  ext: "ico" | "icns" | "png",
  theme: DesktopIconTheme = currentDesktopIconTheme,
): string | null {
  return resolveResourcePath(`icon-${theme}.${ext}`) ?? resolveResourcePath(`icon.${ext}`);
}

function applyDesktopIconTheme(theme: DesktopIconTheme): void {
  currentDesktopIconTheme = theme;
  writeDesktopPreferences({ ...readDesktopPreferences(), iconTheme: theme });

  if (process.platform === "darwin" && app.dock) {
    const iconPath = resolveIconPath("png", theme);
    if (iconPath) {
      app.dock.setIcon(iconPath);
    }
    return;
  }

  const ext = process.platform === "win32" ? "ico" : "png";
  const iconPath = resolveIconPath(ext, theme);
  if (!iconPath) {
    return;
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }
    window.setIcon(iconPath);
  }
}

function normalizeFilePath(input: string): string {
  return input.replace(/\\/g, "/");
}

function getRequiredCodeOssPath(root: string, relativePath: string): string {
  return Path.join(root, relativePath);
}

function buildVsCodeFileUrl(pathname: string): string {
  const fileUrl = pathToFileURL(pathname);
  return new URL(
    `${fileUrl.pathname}${fileUrl.search}${fileUrl.hash}`,
    `${CODE_OSS_FILE_PROTOCOL}://${CODE_OSS_FILE_PROTOCOL_AUTHORITY}/`,
  ).toString();
}

function resolveCodeOssEmbedExtensionPath(): string {
  return Path.resolve(__dirname, CODE_OSS_EMBED_EXTENSION_RELATIVE_PATH);
}

function resolveTabsWorkbenchIntegrationExtensionPath(): string {
  return Path.resolve(ROOT_DIR, TABS_CODE_OSS_INTEGRATION_EXTENSION_RELATIVE_PATH);
}

function isDirectory(pathname: string): boolean {
  return FS.existsSync(pathname) && FS.statSync(pathname).isDirectory();
}

function isFile(pathname: string): boolean {
  return FS.existsSync(pathname) && FS.statSync(pathname).isFile();
}

const codeOssProductConfigurationCache = new Map<string, Record<string, unknown>>();
const codeOssNlsMessagesCache = new Map<string, string[]>();
const codeOssCssModulesCache = new Map<string, string[]>();

function getCodeOssProductConfiguration(vscodeRoot: string): Record<string, unknown> {
  const cached = codeOssProductConfigurationCache.get(vscodeRoot);
  if (cached) return cached;
  const parsed = JSON.parse(
    FS.readFileSync(
      getRequiredCodeOssPath(vscodeRoot, CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH),
      "utf8",
    ),
  ) as Record<string, unknown>;
  codeOssProductConfigurationCache.set(vscodeRoot, parsed);
  return parsed;
}

function getCodeOssNlsMessages(vscodeRoot: string): string[] {
  const cached = codeOssNlsMessagesCache.get(vscodeRoot);
  if (cached) return cached;
  const parsed = JSON.parse(
    FS.readFileSync(
      getRequiredCodeOssPath(vscodeRoot, CODE_OSS_NLS_MESSAGES_RELATIVE_PATH),
      "utf8",
    ),
  ) as string[];
  codeOssNlsMessagesCache.set(vscodeRoot, parsed);
  return parsed;
}

function getCodeOssCssModules(vscodeRoot: string): string[] {
  const cached = codeOssCssModulesCache.get(vscodeRoot);
  if (cached) return cached;

  const outRoot = Path.join(vscodeRoot, "out");
  const cssModules: string[] = [];
  const queue = [outRoot];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || !isDirectory(current)) {
      continue;
    }

    for (const entry of FS.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = Path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".css")) {
        continue;
      }

      cssModules.push(normalizeFilePath(Path.relative(outRoot, absolutePath)));
    }
  }

  cssModules.sort();
  codeOssCssModulesCache.set(vscodeRoot, cssModules);
  return cssModules;
}

function hashCodeOssIdentity(value: string): string {
  return Crypto.createHash("sha256").update(value).digest("hex");
}

function toFileUriComponent(pathname: string) {
  const fileUrl = pathToFileURL(pathname);
  return {
    scheme: "file",
    authority: "",
    path: fileUrl.pathname,
    query: "",
    fragment: "",
  };
}

function ensureCodeOssUserDataProfile(profileRoot: string) {
  const location = Path.join(profileRoot, "default");
  const cacheHome = Path.join(profileRoot, "cache");
  for (const pathname of [location, cacheHome]) {
    FS.mkdirSync(pathname, { recursive: true });
  }
  for (const pathname of [
    Path.join(location, "snippets"),
    Path.join(location, "prompts"),
    Path.join(location, "globalStorage"),
  ]) {
    FS.mkdirSync(pathname, { recursive: true });
  }

  return {
    id: "default",
    isDefault: true,
    name: "Default",
    location: toFileUriComponent(location),
    globalStorageHome: toFileUriComponent(Path.join(location, "globalStorage")),
    settingsResource: toFileUriComponent(Path.join(location, "settings.json")),
    keybindingsResource: toFileUriComponent(Path.join(location, "keybindings.json")),
    tasksResource: toFileUriComponent(Path.join(location, "tasks.json")),
    snippetsHome: toFileUriComponent(Path.join(location, "snippets")),
    promptsHome: toFileUriComponent(Path.join(location, "prompts")),
    extensionsResource: toFileUriComponent(Path.join(location, "extensions.json")),
    mcpResource: toFileUriComponent(Path.join(location, "mcp.json")),
    cacheHome: toFileUriComponent(cacheHome),
  };
}

function resolveInitialCodeOssWorkspaceRoot(): string | null {
  const explicitWorkspaceRoot = process.env.TABS_PROJECT_ROOT?.trim() || null;
  if (explicitWorkspaceRoot && isDirectory(explicitWorkspaceRoot)) {
    return Path.resolve(explicitWorkspaceRoot);
  }
  if (!app.isPackaged && isDirectory(ROOT_DIR)) {
    return ROOT_DIR;
  }
  return null;
}

function resolveEmbeddedTabsWebAppUrl(): string {
  if (isDevelopment && process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }
  return backendHttpUrl;
}

async function inspectCodeOssWorkbench(window: BrowserWindow): Promise<{
  readyState: string;
  title: string;
  bodyChildCount: number;
  bodyText: string;
  hasWorkbench: boolean;
}> {
  return window.webContents.executeJavaScript(
    `({
      readyState: document.readyState,
      title: document.title,
      bodyChildCount: document.body?.childElementCount ?? -1,
      bodyText: document.body?.innerText?.slice(0, 400) ?? "",
      hasWorkbench: Boolean(document.querySelector(".monaco-workbench, .part.workbench, #workbench-container, [role='application']"))
    })`,
    true,
  ) as Promise<{
    readyState: string;
    title: string;
    bodyChildCount: number;
    bodyText: string;
    hasWorkbench: boolean;
  }>;
}

function buildPrimaryCodeOssWindowConfiguration(
  window: BrowserWindow,
  runtime: Extract<NonNullable<typeof codeHostConfig.runtime>, { kind: "desktop-renderer" }>,
  workspaceRoot: string | null,
) {
  const sessionStateRoot = CODE_OSS_PRIMARY_STATE_DIR;
  const profileRoot = Path.join(sessionStateRoot, "profile");
  const profile = ensureCodeOssUserDataProfile(profileRoot);
  const emptyWorkspacePath = Path.join(sessionStateRoot, "workspace.code-workspace");
  const embedExtensionPath = resolveCodeOssEmbedExtensionPath();
  const integrationExtensionPath = resolveTabsWorkbenchIntegrationExtensionPath();
  const builtInExtensionsDir = Path.join(runtime.vscodeRoot, ".build", "extensions");
  const workspaceUriPath = workspaceRoot ?? emptyWorkspacePath;

  FS.mkdirSync(Path.join(sessionStateRoot, "logs"), { recursive: true });
  FS.mkdirSync(Path.join(sessionStateRoot, "cache"), { recursive: true });
  FS.mkdirSync(Path.join(sessionStateRoot, "extensions"), { recursive: true });
  if (!isFile(emptyWorkspacePath)) {
    FS.writeFileSync(emptyWorkspacePath, JSON.stringify({ folders: [] }, null, 2), "utf8");
  }

  const configuration: Record<string, unknown> = {
    _: [],
    "disable-telemetry": true,
    "disable-updates": true,
    "skip-release-notes": true,
    "skip-welcome": true,
    "extensions-dir": Path.join(sessionStateRoot, "extensions"),
    windowId: window.webContents.id,
    appRoot: runtime.vscodeRoot,
    userEnv: {
      ...process.env,
      VSCODE_CWD: workspaceRoot ?? ROOT_DIR,
      TABS_DESKTOP_WS_URL: backendWsUrl,
      TABS_DESKTOP_HTTP_URL: backendHttpUrl,
      TABS_WEB_APP_URL: resolveEmbeddedTabsWebAppUrl(),
      TABS_WORKSPACE_ROOT: workspaceRoot ?? "",
      // The desktop-renderer fallback is the legacy Code-OSS-first shell: keep
      // the integration extension's in-editor "Tabs" panel behavior here. The
      // managed-server runtime omits this flag so only the control channel runs.
      TABS_CODE_OSS_PRIMARY_SHELL: "1",
    },
    product: getCodeOssProductConfiguration(runtime.vscodeRoot),
    zoomLevel: 0,
    codeCachePath: Path.join(sessionStateRoot, "cache"),
    nls: {
      messages: getCodeOssNlsMessages(runtime.vscodeRoot),
      language: "en",
    },
    cssModules: getCodeOssCssModules(runtime.vscodeRoot),
    mainPid: process.pid,
    machineId: hashCodeOssIdentity(`machine:${runtime.vscodeRoot}`),
    sqmId: hashCodeOssIdentity(`sqm:${runtime.vscodeRoot}`),
    devDeviceId: hashCodeOssIdentity(`dev:${runtime.vscodeRoot}`),
    isPortable: false,
    execPath: process.execPath,
    profiles: {
      home: toFileUriComponent(Path.join(sessionStateRoot, "profiles")),
      all: [profile],
      profile,
    },
    homeDir: OS.homedir(),
    tmpDir: OS.tmpdir(),
    userDataDir: sessionStateRoot,
    workspace: {
      id: hashCodeOssIdentity(`workspace:${workspaceUriPath}`),
      uri: toFileUriComponent(workspaceUriPath),
    },
    logLevel: 2,
    loggers: [],
    logsPath: Path.join(sessionStateRoot, "logs"),
    isInitialStartup: false,
    perfMarks: [],
    os: {
      release: OS.release(),
      hostname: OS.hostname(),
      arch: OS.arch(),
    },
    autoDetectHighContrast: true,
    autoDetectColorScheme: true,
    accessibilitySupport: false,
    colorScheme: {
      dark: nativeTheme.shouldUseDarkColors,
      highContrast: nativeTheme.shouldUseHighContrastColors,
    },
    policiesData: {},
    extensionDevelopmentPath: [embedExtensionPath, integrationExtensionPath].filter((pathname) =>
      isDirectory(pathname),
    ),
  };

  if (workspaceRoot) {
    configuration["folder-uri"] = [pathToFileURL(workspaceRoot).toString()];
  }

  if (isDirectory(builtInExtensionsDir)) {
    configuration["builtin-extensions-dir"] = builtInExtensionsDir;
  }

  return configuration;
}

function ensurePrimaryCodeOssFileProtocol(
  window: BrowserWindow,
  runtime: Extract<NonNullable<typeof codeHostConfig.runtime>, { kind: "desktop-renderer" }>,
  workspaceRoot: string | null,
): void {
  if (codeOssFileProtocolRegistered) {
    return;
  }

  const allowedRoots = [
    runtime.vscodeRoot,
    Path.join(runtime.vscodeRoot, "extensions"),
    Path.join(runtime.vscodeRoot, ".build", "extensions"),
    CODE_OSS_PRIMARY_STATE_DIR,
    resolveCodeOssEmbedExtensionPath(),
    resolveTabsWorkbenchIntegrationExtensionPath(),
    workspaceRoot,
  ]
    .filter((pathname): pathname is string => typeof pathname === "string" && pathname.length > 0)
    .map((pathname) => Path.resolve(pathname))
    .filter((value, index, array) => array.indexOf(value) === index);

  window.webContents.session.protocol.registerFileProtocol(
    CODE_OSS_FILE_PROTOCOL,
    (request, callback) => {
      try {
        const parsed = new URL(request.url);
        if (parsed.protocol !== `${CODE_OSS_FILE_PROTOCOL}:`) {
          callback({ error: -10 });
          return;
        }
        const fileUrl = new URL(`file://${parsed.pathname}${parsed.search}${parsed.hash}`);
        const resolvedPath = Path.resolve(fileURLToPath(fileUrl));
        const allowed = allowedRoots.some((root) => {
          const relativePath = Path.relative(root, resolvedPath);
          return (
            relativePath === "" ||
            (!relativePath.startsWith("..") && !Path.isAbsolute(relativePath))
          );
        });
        if (!allowed) {
          callback({ error: -3 });
          return;
        }

        const headers: Record<string, string> = {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        };
        if (
          resolvedPath.startsWith(Path.join(runtime.vscodeRoot, ".build", "extensions")) ||
          resolvedPath.startsWith(Path.join(runtime.vscodeRoot, "extensions"))
        ) {
          headers["Access-Control-Allow-Origin"] = "*";
        }
        callback({ path: resolvedPath, headers });
      } catch {
        callback({ error: -3 });
      }
    },
  );

  codeOssFileProtocolRegistered = true;
}

/**
 * Resolve the Electron userData directory path.
 *
 * Electron derives the default userData path from `productName` in
 * package.json, which currently produces directories with spaces and
 * parentheses (e.g. `~/.config/Tabs` on Linux). This is
 * unfriendly for shell usage and violates Linux naming conventions.
 *
 * We override it to a clean lowercase name (`tabs`). If the legacy
 * directory already exists we keep using it so existing users don't
 * lose their Chromium profile data (localStorage, cookies, sessions).
 */
function resolveUserDataPath(): string {
  const appDataBase =
    process.platform === "win32"
      ? process.env.APPDATA || Path.join(OS.homedir(), "AppData", "Roaming")
      : process.platform === "darwin"
        ? Path.join(OS.homedir(), "Library", "Application Support")
        : process.env.XDG_CONFIG_HOME || Path.join(OS.homedir(), ".config");

  const legacyPath = Path.join(appDataBase, LEGACY_USER_DATA_DIR_NAME);
  if (FS.existsSync(legacyPath)) {
    return legacyPath;
  }

  return Path.join(appDataBase, USER_DATA_DIR_NAME);
}

function configureAppIdentity(): void {
  app.setName(APP_DISPLAY_NAME);
  const commitHash = resolveAboutCommitHash();
  app.setAboutPanelOptions({
    applicationName: APP_DISPLAY_NAME,
    applicationVersion: app.getVersion(),
    version: commitHash ?? "unknown",
  });

  if (process.platform === "win32") {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  applyDesktopIconTheme(currentDesktopIconTheme);
}

function clearUpdatePollTimer(): void {
  if (updateStartupTimer) {
    clearTimeout(updateStartupTimer);
    updateStartupTimer = null;
  }
  if (updatePollTimer) {
    clearInterval(updatePollTimer);
    updatePollTimer = null;
  }
}

function emitUpdateState(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.webContents.send(UPDATE_STATE_CHANNEL, updateState);
  }
}

function setUpdateState(patch: Partial<DesktopUpdateState>): void {
  updateState = { ...updateState, ...patch };
  emitUpdateState();
}

function shouldEnableAutoUpdates(): boolean {
  return (
    getAutoUpdateDisabledReason({
      isDevelopment,
      isPackaged: app.isPackaged,
      platform: process.platform,
      appImage: process.env.APPIMAGE,
      disabledByEnv: process.env.TABS_DISABLE_AUTO_UPDATE === "1",
      macUpdatesSupported: process.env.TABS_ENABLE_MAC_AUTO_UPDATE === "1",
    }) === null
  );
}

async function checkForUpdates(reason: string): Promise<void> {
  if (isQuitting || !updaterConfigured || updateCheckInFlight) return;
  if (updateState.status === "downloading" || updateState.status === "downloaded") {
    console.info(
      `[desktop-updater] Skipping update check (${reason}) while status=${updateState.status}.`,
    );
    return;
  }
  updateCheckInFlight = true;
  setUpdateState(reduceDesktopUpdateStateOnCheckStart(updateState, new Date().toISOString()));
  console.info(`[desktop-updater] Checking for updates (${reason})...`);

  try {
    await autoUpdater.checkForUpdates();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setUpdateState(
      reduceDesktopUpdateStateOnCheckFailure(updateState, message, new Date().toISOString()),
    );
    console.error(`[desktop-updater] Failed to check for updates: ${message}`);
  } finally {
    updateCheckInFlight = false;
  }
}

async function downloadAvailableUpdate(): Promise<{ accepted: boolean; completed: boolean }> {
  if (!updaterConfigured || updateDownloadInFlight || updateState.status !== "available") {
    return { accepted: false, completed: false };
  }
  updateDownloadInFlight = true;
  setUpdateState(reduceDesktopUpdateStateOnDownloadStart(updateState));
  autoUpdater.disableDifferentialDownload = isArm64HostRunningIntelBuild(desktopRuntimeInfo);
  console.info("[desktop-updater] Downloading update...");

  try {
    await autoUpdater.downloadUpdate();
    return { accepted: true, completed: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setUpdateState(reduceDesktopUpdateStateOnDownloadFailure(updateState, message));
    console.error(`[desktop-updater] Failed to download update: ${message}`);
    return { accepted: true, completed: false };
  } finally {
    updateDownloadInFlight = false;
  }
}

async function installDownloadedUpdate(): Promise<{ accepted: boolean; completed: boolean }> {
  if (isQuitting || !updaterConfigured || updateState.status !== "downloaded") {
    return { accepted: false, completed: false };
  }

  isQuitting = true;
  clearUpdatePollTimer();
  try {
    await Effect.runPromise(resolvedShutdown.request);
    await Promise.race([
      (async () => {
        await shutdownPromise;
        await Effect.runPromise(resolvedShutdown.awaitComplete);
      })(),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error("Update install shutdown timed out after 10 seconds")),
          10000,
        ),
      ),
    ]);
    autoUpdater.quitAndInstall();
    return { accepted: true, completed: true };
  } catch (error: unknown) {
    const message = formatErrorMessage(error);
    isQuitting = false;
    setUpdateState(reduceDesktopUpdateStateOnInstallFailure(updateState, message));
    console.error(`[desktop-updater] Failed to install update: ${message}`);
    return { accepted: true, completed: false };
  }
}

function configureAutoUpdater(): void {
  const enabled = shouldEnableAutoUpdates();
  setUpdateState({
    ...createInitialDesktopUpdateState(app.getVersion(), desktopRuntimeInfo),
    enabled,
    status: enabled ? "idle" : "disabled",
  });
  if (!enabled) {
    return;
  }
  updaterConfigured = true;

  const githubToken =
    process.env.TABS_DESKTOP_UPDATE_GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || "";
  if (githubToken) {
    // When a token is provided, re-configure the feed with `private: true` so
    // electron-updater uses the GitHub API (api.github.com) instead of the
    // public Atom feed (github.com/…/releases.atom) which rejects Bearer auth.
    const appUpdateYml = readAppUpdateYml();
    if (appUpdateYml?.provider === "github") {
      autoUpdater.setFeedURL({
        ...appUpdateYml,
        provider: "github" as const,
        private: true,
        token: githubToken,
      });
    }
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // Keep alpha branding, but force all installs onto the stable update track.
  autoUpdater.channel = DESKTOP_UPDATE_CHANNEL;
  autoUpdater.allowPrerelease = DESKTOP_UPDATE_ALLOW_PRERELEASE;
  autoUpdater.allowDowngrade = false;
  autoUpdater.disableDifferentialDownload = isArm64HostRunningIntelBuild(desktopRuntimeInfo);
  let lastLoggedDownloadMilestone = -1;

  if (isArm64HostRunningIntelBuild(desktopRuntimeInfo)) {
    console.info(
      "[desktop-updater] Apple Silicon host detected while running Intel build; updates will switch to arm64 packages.",
    );
  }

  autoUpdater.on("checking-for-update", () => {
    console.info("[desktop-updater] Looking for updates...");
  });
  autoUpdater.on("update-available", (info) => {
    setUpdateState(
      reduceDesktopUpdateStateOnUpdateAvailable(
        updateState,
        info.version,
        new Date().toISOString(),
      ),
    );
    lastLoggedDownloadMilestone = -1;
    console.info(`[desktop-updater] Update available: ${info.version}`);
  });
  autoUpdater.on("update-not-available", () => {
    setUpdateState(reduceDesktopUpdateStateOnNoUpdate(updateState, new Date().toISOString()));
    lastLoggedDownloadMilestone = -1;
    console.info("[desktop-updater] No updates available.");
  });
  autoUpdater.on("error", (error) => {
    const message = formatErrorMessage(error);
    if (!updateCheckInFlight && !updateDownloadInFlight) {
      setUpdateState({
        status: "error",
        message,
        checkedAt: new Date().toISOString(),
        downloadPercent: null,
        errorContext: resolveUpdaterErrorContext(),
        canRetry: updateState.availableVersion !== null || updateState.downloadedVersion !== null,
      });
    }
    console.error(`[desktop-updater] Updater error: ${message}`);
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.floor(progress.percent);
    if (
      shouldBroadcastDownloadProgress(updateState, progress.percent) ||
      updateState.message !== null
    ) {
      setUpdateState(reduceDesktopUpdateStateOnDownloadProgress(updateState, progress.percent));
    }
    const milestone = percent - (percent % 10);
    if (milestone > lastLoggedDownloadMilestone) {
      lastLoggedDownloadMilestone = milestone;
      console.info(`[desktop-updater] Download progress: ${percent}%`);
    }
  });
  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState(reduceDesktopUpdateStateOnDownloadComplete(updateState, info.version));
    console.info(`[desktop-updater] Update downloaded: ${info.version}`);
  });

  clearUpdatePollTimer();

  updateStartupTimer = setTimeout(() => {
    updateStartupTimer = null;
    void checkForUpdates("startup");
  }, AUTO_UPDATE_STARTUP_DELAY_MS);
  updateStartupTimer.unref();

  updatePollTimer = setInterval(() => {
    void checkForUpdates("poll");
  }, AUTO_UPDATE_POLL_INTERVAL_MS);
  updatePollTimer.unref();
}
function scheduleBackendRestart(reason: string): void {
  if (isQuitting || restartTimer) return;

  const delayMs = Math.min(500 * 2 ** restartAttempt, 10_000);
  restartAttempt += 1;
  console.error(`[desktop] backend exited unexpectedly (${reason}); restarting in ${delayMs}ms`);

  restartTimer = setTimeout(() => {
    restartTimer = null;
    startBackend();
  }, delayMs);
}

function startBackend(): void {
  if (isQuitting || backendProcess) return;

  const backendEntry = resolveBackendEntry();
  if (!FS.existsSync(backendEntry)) {
    scheduleBackendRestart(`missing server entry at ${backendEntry}`);
    return;
  }

  const captureBackendLogs = app.isPackaged && backendLogSink !== null;
  const child = ChildProcess.spawn(process.execPath, [backendEntry, "--bootstrap-fd", "3"], {
    cwd: resolveBackendCwd(),
    // In Electron main, process.execPath points to the Electron binary.
    // Run the child in Node mode so this backend process does not become a GUI app instance.
    env: {
      ...backendChildEnv(),
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: captureBackendLogs
      ? ["ignore", "pipe", "pipe", "pipe"]
      : ["ignore", "inherit", "inherit", "pipe"],
  });
  const bootstrapStream = child.stdio[3];
  if (bootstrapStream && "write" in bootstrapStream) {
    bootstrapStream.write(
      `${JSON.stringify({
        mode: "desktop",
        noBrowser: true,
        port: backendPort,
        tabsHome: BASE_DIR,
        authToken: backendAuthToken,
      })}\n`,
    );
    bootstrapStream.end();
  } else {
    child.kill("SIGTERM");
    scheduleBackendRestart("missing desktop bootstrap pipe");
    return;
  }
  backendProcess = child;
  let backendSessionClosed = false;
  const closeBackendSession = (details: string) => {
    if (backendSessionClosed) return;
    backendSessionClosed = true;
    writeBackendSessionBoundary("END", details);
  };
  writeBackendSessionBoundary(
    "START",
    `pid=${child.pid ?? "unknown"} port=${backendPort} cwd=${resolveBackendCwd()}`,
  );
  captureBackendOutput(child);

  child.once("spawn", () => {
    restartAttempt = 0;
  });

  child.on("error", (error) => {
    if (backendProcess === child) {
      backendProcess = null;
    }
    closeBackendSession(`pid=${child.pid ?? "unknown"} error=${error.message}`);
    scheduleBackendRestart(error.message);
  });

  child.on("exit", (code, signal) => {
    if (backendProcess === child) {
      backendProcess = null;
    }
    closeBackendSession(
      `pid=${child.pid ?? "unknown"} code=${code ?? "null"} signal=${signal ?? "null"}`,
    );
    if (isQuitting) return;
    const reason = `code=${code ?? "null"} signal=${signal ?? "null"}`;
    scheduleBackendRestart(reason);
  });
}

function stopBackend(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  const child = backendProcess;
  backendProcess = null;
  if (!child) return;

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 2_000).unref();
  }
}

async function stopBackendProcessAndWait(
  child: ChildProcess.ChildProcess,
  timeoutMs = 5_000,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null;
    let exitTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

    function settle(): void {
      if (settled) return;
      settled = true;
      child.off("exit", onExit);
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }
      if (exitTimeoutTimer) {
        clearTimeout(exitTimeoutTimer);
      }
      resolve();
    }

    function onExit(): void {
      settle();
    }

    child.once("exit", onExit);
    child.kill("SIGTERM");

    forceKillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 2_000);
    forceKillTimer.unref();

    exitTimeoutTimer = setTimeout(() => {
      settle();
    }, timeoutMs);
    exitTimeoutTimer.unref();
  });
}

async function stopBackendAndWaitForExit(timeoutMs = 5_000): Promise<void> {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  const child = backendProcess;
  backendProcess = null;
  if (!child) return;
  await stopBackendProcessAndWait(child, timeoutMs);
}

const resolvedShutdown = Effect.runSync(
  Effect.service(DesktopShutdown).pipe(Effect.provide(shutdownLayer)),
);

const performShutdownEffect = Effect.gen(function* () {
  const shutdown = yield* DesktopShutdown;

  yield* Effect.addFinalizer(() =>
    Effect.gen(function* () {
      writeDesktopLogHeader("shutdown finalizer running: stopping active backends");
      const activeInstances = backendProcess ? [backendProcess] : [];
      yield* Effect.forEach(
        activeInstances,
        (child) =>
          Effect.tryPromise({
            try: () => stopBackendProcessAndWait(child, 5000),
            catch: (error) => error,
          }).pipe(Effect.catch(() => Effect.void)),
        { concurrency: "unbounded" },
      );
      backendProcess = null;
      writeDesktopLogHeader("shutdown finalizer finished: backends stopped");
    }).pipe(Effect.ensuring(shutdown.markComplete)),
  );

  yield* shutdown.awaitRequest;
}).pipe(Effect.provideService(DesktopShutdown, resolvedShutdown), Effect.scoped);

const shutdownPromise = Effect.runPromise(
  performShutdownEffect.pipe(Effect.catch(() => Effect.void)),
);

function registerIpcHandlers(): void {
  ipcMain.removeAllListeners(GET_WS_URL_CHANNEL);
  ipcMain.on(GET_WS_URL_CHANNEL, (event) => {
    event.returnValue = backendWsUrl;
  });

  ipcMain.removeHandler("get-tailscale-status");
  ipcMain.handle("get-tailscale-status", async () => {
    return getTailscaleStatus();
  });

  ipcMain.removeHandler(PICK_FOLDER_CHANNEL);
  ipcMain.handle(PICK_FOLDER_CHANNEL, async () => {
    const owner = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const result = owner
      ? await dialog.showOpenDialog(owner, {
          properties: ["openDirectory", "createDirectory"],
        })
      : await dialog.showOpenDialog({
          properties: ["openDirectory", "createDirectory"],
        });
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.removeHandler(PICK_FILE_CHANNEL);
  ipcMain.handle(PICK_FILE_CHANNEL, async () => {
    const owner = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const result = owner
      ? await dialog.showOpenDialog(owner, {
          properties: ["openFile"],
        })
      : await dialog.showOpenDialog({
          properties: ["openFile"],
        });
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.removeHandler(CLONE_REPOSITORY_CHANNEL);
  ipcMain.handle(
    CLONE_REPOSITORY_CHANNEL,
    async (_event, rawInput: unknown): Promise<DesktopCloneRepositoryResult> => {
      const input = (rawInput ?? null) as Partial<DesktopCloneRepositoryInput> | null;
      const url = typeof input?.url === "string" ? input.url.trim() : "";
      const parentDir = typeof input?.parentDir === "string" ? input.parentDir : "";

      // Accept remote URLs git understands: scheme-based (https/http/git/ssh) or
      // scp-like (user@host:path). Local-path "URLs" are rejected on purpose —
      // this surface is for cloning remotes, and it keeps the input unambiguous.
      const isPlausibleGitUrl =
        /^(?:https?|git|ssh):\/\/.+/i.test(url) || /^[^@\s]+@[^:\s]+:.+/.test(url);
      if (!isPlausibleGitUrl) {
        return { ok: false, error: "Enter a valid git URL (https://…, git@…:…, or ssh://…)." };
      }
      if (!parentDir || !isDirectory(parentDir)) {
        return { ok: false, error: "Choose a valid destination folder." };
      }

      // Mirror git's own default: the folder is the last path segment minus .git.
      const dirName = url
        .replace(/[/]+$/, "")
        .replace(/\.git$/i, "")
        .split(/[/:]/)
        .pop()
        ?.replace(/[^A-Za-z0-9._-]/g, "");
      if (!dirName) {
        return { ok: false, error: "Could not derive a folder name from that URL." };
      }

      const dest = Path.join(parentDir, dirName);
      if (FS.existsSync(dest) && FS.readdirSync(dest).length > 0) {
        return { ok: false, error: `"${dirName}" already exists and is not empty.` };
      }

      try {
        await new Promise<void>((resolve, reject) => {
          ChildProcess.execFile(
            "git",
            ["clone", "--progress", "--", url, dest],
            { cwd: parentDir, env: process.env, timeout: 10 * 60_000, maxBuffer: 32 * 1024 * 1024 },
            (error, _stdout, stderr) => {
              if (error) {
                const detail = stderr ? stderr.toString().trim() : "";
                reject(new Error(detail || error.message));
              } else {
                resolve();
              }
            },
          );
        });
        return { ok: true, path: dest };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "git clone failed." };
      }
    },
  );

  ipcMain.removeHandler(CONFIRM_CHANNEL);
  ipcMain.handle(CONFIRM_CHANNEL, async (_event, message: unknown) => {
    if (typeof message !== "string") {
      return false;
    }

    const owner = BrowserWindow.getFocusedWindow() ?? mainWindow;
    return showDesktopConfirmDialog(message, owner);
  });

  ipcMain.removeHandler(SET_THEME_CHANNEL);
  ipcMain.handle(SET_THEME_CHANNEL, async (_event, rawTheme: unknown) => {
    const theme = getSafeTheme(rawTheme);
    if (!theme) {
      return;
    }

    nativeTheme.themeSource = theme;
  });

  ipcMain.removeHandler(SET_ICON_THEME_CHANNEL);
  ipcMain.handle(SET_ICON_THEME_CHANNEL, async (_event, rawTheme: unknown) => {
    const theme = getSafeIconTheme(rawTheme);
    if (!theme) {
      return;
    }

    applyDesktopIconTheme(theme);
  });

  ipcMain.removeHandler(CONTEXT_MENU_CHANNEL);
  ipcMain.handle(
    CONTEXT_MENU_CHANNEL,
    async (_event, items: ContextMenuItem[], position?: { x: number; y: number }) => {
      const normalizedItems = items
        .filter((item) => typeof item.id === "string" && typeof item.label === "string")
        .map((item) => ({
          id: item.id,
          label: item.label,
          destructive: item.destructive === true,
        }));
      if (normalizedItems.length === 0) {
        return null;
      }

      const popupPosition =
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        position.x >= 0 &&
        position.y >= 0
          ? {
              x: Math.floor(position.x),
              y: Math.floor(position.y),
            }
          : null;

      const window = BrowserWindow.getFocusedWindow() ?? mainWindow;
      if (!window) return null;

      return new Promise<string | null>((resolve) => {
        const template: MenuItemConstructorOptions[] = [];
        let hasInsertedDestructiveSeparator = false;
        for (const item of normalizedItems) {
          if (item.destructive && !hasInsertedDestructiveSeparator && template.length > 0) {
            template.push({ type: "separator" });
            hasInsertedDestructiveSeparator = true;
          }
          const itemOption: MenuItemConstructorOptions = {
            label: item.label,
            click: () => resolve(item.id),
          };
          if (item.destructive) {
            const destructiveIcon = getDestructiveMenuIcon();
            if (destructiveIcon) {
              itemOption.icon = destructiveIcon;
            }
          }
          template.push(itemOption);
        }

        const menu = Menu.buildFromTemplate(template);
        menu.popup({
          window,
          ...popupPosition,
          callback: () => resolve(null),
        });
      });
    },
  );

  ipcMain.removeHandler(OPEN_EXTERNAL_CHANNEL);
  ipcMain.handle(OPEN_EXTERNAL_CHANNEL, async (_event, rawUrl: unknown) => {
    const externalUrl = getSafeExternalUrl(rawUrl);
    if (!externalUrl) {
      return false;
    }

    try {
      await shell.openExternal(externalUrl);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.removeHandler(UPDATE_GET_STATE_CHANNEL);
  ipcMain.handle(UPDATE_GET_STATE_CHANNEL, async () => updateState);

  ipcMain.removeHandler(UPDATE_DOWNLOAD_CHANNEL);
  ipcMain.handle(UPDATE_DOWNLOAD_CHANNEL, async () => {
    const result = await downloadAvailableUpdate();
    return {
      accepted: result.accepted,
      completed: result.completed,
      state: updateState,
    } satisfies DesktopUpdateActionResult;
  });

  ipcMain.removeHandler(UPDATE_INSTALL_CHANNEL);
  ipcMain.handle(UPDATE_INSTALL_CHANNEL, async () => {
    if (isQuitting) {
      return {
        accepted: false,
        completed: false,
        state: updateState,
      } satisfies DesktopUpdateActionResult;
    }
    const result = await installDownloadedUpdate();
    return {
      accepted: result.accepted,
      completed: result.completed,
      state: updateState,
    } satisfies DesktopUpdateActionResult;
  });

  ipcMain.removeHandler(CODE_HOST_GET_STATE_CHANNEL);
  ipcMain.handle(CODE_HOST_GET_STATE_CHANNEL, async () => codeHostManager.getState());

  ipcMain.removeHandler(CODE_HOST_ENSURE_SESSION_CHANNEL);
  ipcMain.handle(CODE_HOST_ENSURE_SESSION_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string" ||
      typeof (input as { workspaceRoot?: unknown }).workspaceRoot !== "string"
    ) {
      return;
    }
    await codeHostManager.ensureSession({
      projectId: (input as { projectId: string }).projectId,
      workspaceRoot: (input as { workspaceRoot: string }).workspaceRoot,
    });
  });

  ipcMain.removeHandler(CODE_HOST_ACTIVATE_SESSION_CHANNEL);
  ipcMain.handle(CODE_HOST_ACTIVATE_SESSION_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string"
    ) {
      return;
    }
    await codeHostManager.activateSession({
      projectId: (input as { projectId: string }).projectId,
    });
  });

  ipcMain.removeHandler(CODE_HOST_HIDE_SESSION_CHANNEL);
  ipcMain.handle(CODE_HOST_HIDE_SESSION_CHANNEL, async () => {
    codeHostManager.hideActiveSession();
  });

  ipcMain.removeHandler(CODE_HOST_OPEN_FILE_CHANNEL);
  ipcMain.handle(CODE_HOST_OPEN_FILE_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string" ||
      typeof (input as { relativePath?: unknown }).relativePath !== "string" ||
      typeof (input as { navigationNonce?: unknown }).navigationNonce !== "number"
    ) {
      return;
    }
    await codeHostManager.openFile({
      projectId: (input as { projectId: string }).projectId,
      relativePath: (input as { relativePath: string }).relativePath,
      navigationNonce: (input as { navigationNonce: number }).navigationNonce,
    });
  });

  ipcMain.removeHandler(CODE_HOST_SET_BOUNDS_CHANNEL);
  ipcMain.handle(CODE_HOST_SET_BOUNDS_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string" ||
      typeof (input as { x?: unknown }).x !== "number" ||
      typeof (input as { y?: unknown }).y !== "number" ||
      typeof (input as { width?: unknown }).width !== "number" ||
      typeof (input as { height?: unknown }).height !== "number" ||
      typeof (input as { visible?: unknown }).visible !== "boolean"
    ) {
      return;
    }
    codeHostManager.setBounds({
      projectId: (input as { projectId: string }).projectId,
      x: (input as { x: number }).x,
      y: (input as { y: number }).y,
      width: (input as { width: number }).width,
      height: (input as { height: number }).height,
      visible: (input as { visible: boolean }).visible,
    });
  });

  ipcMain.removeHandler(CODE_HOST_SYNC_SESSIONS_CHANNEL);
  ipcMain.handle(CODE_HOST_SYNC_SESSIONS_CHANNEL, async (_event, projectIds: unknown) => {
    if (
      !Array.isArray(projectIds) ||
      !projectIds.every((projectId) => typeof projectId === "string")
    ) {
      return;
    }
    codeHostManager.syncSessions(projectIds);
  });

  ipcMain.removeHandler(CODE_HOST_RUN_COMMAND_CHANNEL);
  ipcMain.handle(CODE_HOST_RUN_COMMAND_CHANNEL, async (_event, input: unknown) => {
    // The control channel re-validates against the allowlist; this is just the
    // shape guard for the IPC boundary.
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string" ||
      typeof (input as { commandId?: unknown }).commandId !== "string"
    ) {
      return false;
    }
    return codeControlChannel.runCommand(
      (input as { projectId: string }).projectId,
      (input as { commandId: string }).commandId,
    );
  });

  ipcMain.removeHandler(BROWSER_HOST_GET_STATE_CHANNEL);
  ipcMain.handle(BROWSER_HOST_GET_STATE_CHANNEL, async () => browserHostManager.getState());

  ipcMain.removeHandler(BROWSER_HOST_GET_SESSION_STATE_CHANNEL);
  ipcMain.handle(BROWSER_HOST_GET_SESSION_STATE_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string"
    ) {
      return null;
    }
    return browserHostManager.getSessionState(
      (input as { projectId: string }).projectId,
      readBrowserSessionId(input),
    );
  });

  ipcMain.removeHandler(BROWSER_HOST_ENSURE_SESSION_CHANNEL);
  ipcMain.handle(BROWSER_HOST_ENSURE_SESSION_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string" ||
      typeof (input as { initialUrl?: unknown }).initialUrl !== "string"
    ) {
      return;
    }
    // Allow an empty initialUrl: create a blank "new tab" view that loads
    // nothing until the user navigates. A non-empty URL must be a safe http(s).
    const rawUrl = (input as { initialUrl: string }).initialUrl;
    const safeUrl = rawUrl.trim().length === 0 ? "" : getSafeExternalUrl(rawUrl);
    if (safeUrl === null) {
      return;
    }
    await browserHostManager.ensureSession({
      projectId: (input as { projectId: string }).projectId,
      sessionId: readBrowserSessionId(input),
      initialUrl: safeUrl,
    });
  });

  ipcMain.removeHandler(BROWSER_HOST_ACTIVATE_SESSION_CHANNEL);
  ipcMain.handle(BROWSER_HOST_ACTIVATE_SESSION_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string"
    ) {
      return;
    }
    await browserHostManager.activateSession({
      projectId: (input as { projectId: string }).projectId,
      sessionId: readBrowserSessionId(input),
    });
  });

  ipcMain.removeHandler(BROWSER_HOST_HIDE_SESSION_CHANNEL);
  ipcMain.handle(BROWSER_HOST_HIDE_SESSION_CHANNEL, async () => {
    browserHostManager.hideActiveSession();
  });

  ipcMain.removeHandler(BROWSER_HOST_NAVIGATE_SESSION_CHANNEL);
  ipcMain.handle(BROWSER_HOST_NAVIGATE_SESSION_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string" ||
      typeof (input as { url?: unknown }).url !== "string"
    ) {
      return;
    }
    const safeUrl = getSafeExternalUrl((input as { url: string }).url);
    if (!safeUrl) {
      return;
    }
    await browserHostManager.navigate({
      projectId: (input as { projectId: string }).projectId,
      sessionId: readBrowserSessionId(input),
      url: safeUrl,
    });
  });

  ipcMain.removeHandler(BROWSER_HOST_RELOAD_SESSION_CHANNEL);
  ipcMain.handle(BROWSER_HOST_RELOAD_SESSION_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string"
    ) {
      return;
    }
    await browserHostManager.reload({
      projectId: (input as { projectId: string }).projectId,
      sessionId: readBrowserSessionId(input),
    });
  });

  ipcMain.removeHandler(BROWSER_HOST_BACK_SESSION_CHANNEL);
  ipcMain.handle(BROWSER_HOST_BACK_SESSION_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string"
    ) {
      return;
    }
    await browserHostManager.goBack({
      projectId: (input as { projectId: string }).projectId,
      sessionId: readBrowserSessionId(input),
    });
  });

  ipcMain.removeHandler(BROWSER_HOST_FORWARD_SESSION_CHANNEL);
  ipcMain.handle(BROWSER_HOST_FORWARD_SESSION_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string"
    ) {
      return;
    }
    await browserHostManager.goForward({
      projectId: (input as { projectId: string }).projectId,
      sessionId: readBrowserSessionId(input),
    });
  });

  ipcMain.removeHandler(BROWSER_HOST_TOGGLE_DEVTOOLS_CHANNEL);
  ipcMain.handle(BROWSER_HOST_TOGGLE_DEVTOOLS_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string"
    ) {
      return;
    }
    await browserHostManager.toggleDevTools({
      projectId: (input as { projectId: string }).projectId,
      sessionId: readBrowserSessionId(input),
    });
  });

  ipcMain.removeHandler(BROWSER_HOST_SET_BOUNDS_CHANNEL);
  ipcMain.handle(BROWSER_HOST_SET_BOUNDS_CHANNEL, async (_event, input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { projectId?: unknown }).projectId !== "string" ||
      typeof (input as { x?: unknown }).x !== "number" ||
      typeof (input as { y?: unknown }).y !== "number" ||
      typeof (input as { width?: unknown }).width !== "number" ||
      typeof (input as { height?: unknown }).height !== "number" ||
      typeof (input as { visible?: unknown }).visible !== "boolean"
    ) {
      return;
    }
    browserHostManager.setBounds({
      projectId: (input as { projectId: string }).projectId,
      sessionId: readBrowserSessionId(input),
      x: (input as { x: number }).x,
      y: (input as { y: number }).y,
      width: (input as { width: number }).width,
      height: (input as { height: number }).height,
      visible: (input as { visible: boolean }).visible,
    });
  });

  ipcMain.removeHandler(BROWSER_HOST_SYNC_SESSIONS_CHANNEL);
  ipcMain.handle(BROWSER_HOST_SYNC_SESSIONS_CHANNEL, async (_event, projectIds: unknown) => {
    if (
      !Array.isArray(projectIds) ||
      !projectIds.every((projectId) => typeof projectId === "string")
    ) {
      return;
    }
    browserHostManager.syncSessions(projectIds);
  });

  ipcMain.removeHandler(VSCODE_FETCH_SHELL_ENV_CHANNEL);
  ipcMain.handle(VSCODE_FETCH_SHELL_ENV_CHANNEL, async () => ({ ...process.env }));

  ipcMain.removeAllListeners(VSCODE_TOGGLE_DEVTOOLS_CHANNEL);
  ipcMain.on(VSCODE_TOGGLE_DEVTOOLS_CHANNEL, (event) => {
    event.sender.toggleDevTools();
  });

  ipcMain.removeAllListeners(VSCODE_OPEN_DEVTOOLS_CHANNEL);
  ipcMain.on(VSCODE_OPEN_DEVTOOLS_CHANNEL, (event) => {
    event.sender.openDevTools({ mode: "detach" });
  });

  ipcMain.removeAllListeners(VSCODE_RELOAD_WINDOW_CHANNEL);
  ipcMain.on(VSCODE_RELOAD_WINDOW_CHANNEL, (event) => {
    event.sender.reload();
  });

  ipcMain.removeHandler(VSCODE_NOTIFY_ZOOM_LEVEL_CHANNEL);
  ipcMain.handle(VSCODE_NOTIFY_ZOOM_LEVEL_CHANNEL, async () => undefined);
}

function getIconOption(): { icon: string } | Record<string, never> {
  if (process.platform === "darwin") return {}; // macOS uses .icns from app bundle
  const ext = process.platform === "win32" ? "ico" : "png";
  const iconPath = resolveIconPath(ext);
  return iconPath ? { icon: iconPath } : {};
}

function createLegacyWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 840,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    ...getIconOption(),
    title: APP_DISPLAY_NAME,
    ...resolveTitleBarOptions(),
    webPreferences: {
      preload: Path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.on("context-menu", (event, params) => {
    event.preventDefault();

    const menuTemplate: MenuItemConstructorOptions[] = [];

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        menuTemplate.push({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion),
        });
      }
      if (params.dictionarySuggestions.length === 0) {
        menuTemplate.push({ label: "No suggestions", enabled: false });
      }
      menuTemplate.push({ type: "separator" });
    }

    menuTemplate.push(
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { role: "selectAll", enabled: params.editFlags.canSelectAll },
    );

    Menu.buildFromTemplate(menuTemplate).popup({ window });
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    const externalUrl = getSafeExternalUrl(url);
    if (externalUrl) {
      void shell.openExternal(externalUrl);
    }
    return { action: "deny" };
  });

  window.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle(APP_DISPLAY_NAME);
  });
  window.webContents.on("did-finish-load", () => {
    window.setTitle(APP_DISPLAY_NAME);
    emitUpdateState();
  });
  window.webContents.on("console-message", (_event, _level, message, line, sourceId) => {
    if (message.includes("[SLIDER-DEBUG-3]")) {
      console.log(`[RENDERER] [${sourceId}:${line}] ${message}`);
      try {
        const logLine = `[${new Date().toISOString()}] ${message}\n`;
        FS.appendFileSync(SLIDER_DEBUG_LOG_PATH, logLine, "utf8");
      } catch {
        /* ignore */
      }
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  if (isDevelopment) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    void window.loadURL(`${DESKTOP_SCHEME}://app/index.html`);
  }

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.webContents.on("did-fail-load", (_event, _errorCode, _errorDescription, _validatedURL, isMainFrame) => {
    if (isMainFrame && !window.isVisible()) {
      window.show();
    }
  });

  return window;
}

function createCodeOssWindow(
  runtime: Extract<NonNullable<typeof codeHostConfig.runtime>, { kind: "desktop-renderer" }>,
): BrowserWindow {
  const workspaceRoot = resolveInitialCodeOssWorkspaceRoot();
  const configChannel = `vscode:tabs-main-window-config:${Crypto.randomUUID()}`;
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    ...getIconOption(),
    title: APP_DISPLAY_NAME,
    ...resolveTitleBarOptions(),
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: getRequiredCodeOssPath(runtime.vscodeRoot, CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH),
      additionalArguments: [`--vscode-window-config=${configChannel}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  ipcMain.handle(configChannel, async () =>
    buildPrimaryCodeOssWindowConfiguration(window, runtime, workspaceRoot),
  );

  ensurePrimaryCodeOssFileProtocol(window, runtime, workspaceRoot);

  window.webContents.setWindowOpenHandler(({ url }) => {
    const externalUrl = getSafeExternalUrl(url);
    if (externalUrl) {
      void shell.openExternal(externalUrl);
    }
    return { action: "deny" };
  });

  let codeOssReady = false;
  let fallbackTriggered = false;
  const workbenchEntry = buildVsCodeFileUrl(
    getRequiredCodeOssPath(runtime.vscodeRoot, CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH),
  );

  const fallbackToLegacyShell = (reason: string): void => {
    if (fallbackTriggered || isQuitting) {
      return;
    }
    fallbackTriggered = true;
    writeDesktopLogHeader(`code-oss primary shell fallback reason=${sanitizeLogValue(reason)}`);
    const downgradedToManagedServer = codeHostManager.downgradeToManagedServer(reason);
    if (downgradedToManagedServer) {
      writeDesktopLogHeader("code-oss legacy shell downgrade target=managed-server");
    } else {
      codeHostManager.disableEmbeddedHost(
        `Primary Code-OSS startup failed: ${reason}. Using the fallback code workspace for this session.`,
      );
      writeDesktopLogHeader("code-oss legacy shell downgrade target=fallback-workspace");
    }

    const replacementWindow = createLegacyWindow();
    mainWindow = replacementWindow;
    window.destroy();
  };

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        writeDesktopLogHeader(
          `code-oss did-fail-load (ignored iframe) code=${errorCode} url=${validatedURL}`,
        );
        return;
      }
      writeDesktopLogHeader(
        `code-oss did-fail-load code=${errorCode} url=${validatedURL} description=${sanitizeLogValue(errorDescription)}`,
      );
      fallbackToLegacyShell(`did-fail-load ${errorCode} ${errorDescription}`);
    },
  );
  window.webContents.on("render-process-gone", (_event, details) => {
    writeDesktopLogHeader(
      `code-oss render-process-gone reason=${details.reason} exitCode=${details.exitCode}`,
    );
    fallbackToLegacyShell(`render-process-gone ${details.reason}`);
  });
  window.webContents.on("preload-error", (_event, preloadPathname, error) => {
    writeDesktopLogHeader(
      `code-oss preload-error preload=${preloadPathname} message=${sanitizeLogValue(formatErrorMessage(error))}`,
    );
    fallbackToLegacyShell(`preload-error ${formatErrorMessage(error)}`);
  });
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    writeDesktopLogHeader(
      `code-oss console level=${level} source=${sourceId}:${line} message=${sanitizeLogValue(message)}`,
    );
    if (message.includes("[SLIDER-DEBUG-3]")) {
      try {
        const logLine = `[${new Date().toISOString()}] ${message}\n`;
        FS.appendFileSync(SLIDER_DEBUG_LOG_PATH, logLine, "utf8");
      } catch {
        /* ignore */
      }
    }
  });
  window.webContents.on("did-finish-load", () => {
    writeDesktopLogHeader(`code-oss did-finish-load entry=${workbenchEntry}`);
    window.setTitle(APP_DISPLAY_NAME);
    void inspectCodeOssWorkbench(window)
      .then((snapshot) => {
        codeOssReady = snapshot.hasWorkbench;
        writeDesktopLogHeader(
          `code-oss dom ready=${String(codeOssReady)} readyState=${snapshot.readyState} children=${snapshot.bodyChildCount} title=${sanitizeLogValue(snapshot.title)} text=${sanitizeLogValue(snapshot.bodyText)}`,
        );
      })
      .catch((error) => {
        writeDesktopLogHeader(
          `code-oss dom-inspect-error message=${sanitizeLogValue(formatErrorMessage(error))}`,
        );
      });
  });

  const readyTimeout = setTimeout(() => {
    if (fallbackTriggered || codeOssReady || window.isDestroyed()) {
      return;
    }

    void inspectCodeOssWorkbench(window)
      .then((snapshot) => {
        const hasVisibleWorkbench = snapshot.hasWorkbench;
        writeDesktopLogHeader(
          `code-oss ready-timeout ready=${String(hasVisibleWorkbench)} readyState=${snapshot.readyState} children=${snapshot.bodyChildCount} title=${sanitizeLogValue(snapshot.title)} text=${sanitizeLogValue(snapshot.bodyText)}`,
        );
        if (!hasVisibleWorkbench) {
          fallbackToLegacyShell("workbench readiness timeout");
        }
      })
      .catch((error) => {
        writeDesktopLogHeader(
          `code-oss ready-timeout inspect-failed message=${sanitizeLogValue(formatErrorMessage(error))}`,
        );
        fallbackToLegacyShell(`workbench inspect failed ${formatErrorMessage(error)}`);
      });
  }, CODE_OSS_READY_TIMEOUT_MS);

  window.once("ready-to-show", () => {
    window.show();
  });

  window.on("closed", () => {
    clearTimeout(readyTimeout);
    ipcMain.removeHandler(configChannel);
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  writeDesktopLogHeader(
    `code-oss load start entry=${workbenchEntry} workspaceRoot=${workspaceRoot ?? "<empty>"}`,
  );
  void window.loadURL(workbenchEntry);

  return window;
}

function createWindow(): BrowserWindow {
  const runtime = codeHostConfig.runtime;
  if (runtime && runtime.kind === "desktop-renderer") {
    return createCodeOssWindow(runtime);
  }
  return createLegacyWindow();
}

// Override Electron's userData path before the `ready` event so that
// Chromium session data uses a filesystem-friendly directory name.
// Must be called synchronously at the top level — before `app.whenReady()`.
app.setPath("userData", resolveUserDataPath());

configureAppIdentity();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  const targetWindow = mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
  if (!targetWindow) {
    return;
  }

  if (targetWindow.isMinimized()) {
    targetWindow.restore();
  }
  if (!targetWindow.isVisible()) {
    targetWindow.show();
  }
  targetWindow.focus();
});

function formatRuntimeDownloadStatus(progress: RuntimeInstallProgress): string {
  if (progress.phase === "downloading") {
    if (progress.totalBytes && progress.receivedBytes) {
      const pct = Math.floor((progress.receivedBytes / progress.totalBytes) * 100);
      const mb = Math.round(progress.totalBytes / 1_000_000);
      return `Preparing the editor… downloading runtime (${pct}% of ~${mb} MB).`;
    }
    return "Preparing the editor… downloading runtime.";
  }
  if (progress.phase === "verifying") return "Preparing the editor… verifying download.";
  if (progress.phase === "extracting") return "Preparing the editor… installing runtime.";
  return "Editor runtime ready.";
}

let codeOssRuntimeDownloadStarted = false;

/**
 * Level B (thin installer): when no runtime is bundled or already downloaded,
 * fetch it on demand and adopt it once ready. Download progress is reflected in
 * the Code-OSS state `reason` (surfaced in the Code tab). No-op for fat/dev
 * builds where a runtime is already resolvable.
 */
function ensureDownloadedCodeOssRuntime(): void {
  if (codeOssRuntimeDownloadStarted || codeHostConfig.state.available) {
    return;
  }
  const appVersion = app.getVersion();
  if (isRuntimeInstalled(appVersion)) {
    return; // already resolved synchronously at startup
  }
  codeOssRuntimeDownloadStarted = true;
  codeHostConfig.state.available = false;
  codeHostConfig.state.reason = "Preparing the editor… downloading runtime.";

  void ensureRuntimeInstalled({
    version: appVersion,
    onProgress: (progress) => {
      codeHostConfig.state.reason = formatRuntimeDownloadStatus(progress);
    },
  })
    .then(() => {
      process.env.TABS_CODE_OSS_BUILD_DIR = resolveInstalledRuntimeDir(appVersion);
      const next = resolveCodeHostConfig({ rootDir: ROOT_DIR, env: process.env });
      if (next.state.available) {
        codeHostManager.reconfigure(next);
        writeDesktopLogHeader("code-oss runtime downloaded and activated");
      } else {
        codeHostManager.disableEmbeddedHost(
          next.state.reason ?? "Downloaded editor runtime could not be resolved.",
        );
      }
    })
    .catch((error: unknown) => {
      codeOssRuntimeDownloadStarted = false; // allow a retry on next launch
      codeHostManager.disableEmbeddedHost(
        `Could not download the editor runtime: ${formatErrorMessage(error)}. It will retry next launch.`,
      );
    });
}

async function bootstrap(): Promise<void> {
  writeDesktopLogHeader("bootstrap start");
  ensureDownloadedCodeOssRuntime();
  backendPort = await Effect.service(NetService).pipe(
    Effect.flatMap((net) => net.reserveLoopbackPort()),
    Effect.provide(netServiceLayer),
    Effect.runPromise,
  );
  writeDesktopLogHeader(`reserved backend port via NetService port=${backendPort}`);
  backendAuthToken = Crypto.randomBytes(24).toString("hex");
  const wsBaseUrl = `ws://127.0.0.1:${backendPort}`;
  backendWsUrl = `${wsBaseUrl}/?token=${encodeURIComponent(backendAuthToken)}`;
  backendHttpUrl = `http://127.0.0.1:${backendPort}`;
  writeDesktopLogHeader(`bootstrap resolved websocket endpoint baseUrl=${wsBaseUrl}`);

  // Start the loopback control channel and expose its URL to the embedded
  // Code-OSS extension host via env (inherited by the spawned REH server). Done
  // before startBackend so the env is in place when the code session later
  // spawns its server. Non-fatal if it fails — the chrome simply can't drive
  // the workbench (clicks become no-ops) but the editor still works.
  try {
    // Deterministic path (stable across restarts) so a reused/long-lived
    // workbench can re-read the current URL after a main-process restart.
    const controlUrlFile = Path.join(STATE_DIR, "code-control.json");
    const control = await codeControlChannel.start(controlUrlFile);
    process.env.TABS_CODE_CONTROL_URL = control.url;
    process.env.TABS_CODE_CONTROL_FILE = controlUrlFile;
    codeControlChannel.onChromeState((projectId: string, state: CodeChromeState) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(CODE_HOST_CHROME_STATE_CHANNEL, { projectId, state });
      }
    });
    writeDesktopLogHeader("bootstrap code control channel started");
  } catch (error) {
    writeDesktopLogHeader(`bootstrap code control channel failed: ${formatErrorMessage(error)}`);
  }

  registerIpcHandlers();
  writeDesktopLogHeader("bootstrap ipc handlers registered");
  startBackend();
  writeDesktopLogHeader("bootstrap backend start requested");
  mainWindow = createWindow();
  writeDesktopLogHeader("bootstrap main window created");

  // SLIDER-DEBUG: Inject a console.log wrapper into the renderer and poll for logs
  if (isDevelopment && mainWindow) {
    const win = mainWindow;
    const injectScript = `
      if (!window.__SLIDER_LOGS) {
        window.__SLIDER_LOGS = [];
        const origLog = console.log.bind(console);
        console.log = function(...args) {
          origLog(...args);
          const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
          if (msg.includes('[SLIDER-DEBUG-3]')) {
            window.__SLIDER_LOGS.push('[' + new Date().toISOString() + '] ' + msg);
          }
        };
      }
      'injected';
    `;
    // Inject after page loads, and re-inject on navigation
    const inject = () => {
      if (!win.isDestroyed()) {
        win.webContents.executeJavaScript(injectScript).catch(() => {});
      }
    };
    win.webContents.on("did-finish-load", inject);
    win.webContents.on("dom-ready", inject);
    // Poll every 2 seconds to read accumulated logs
    const pollTimer = setInterval(() => {
      if (win.isDestroyed()) {
        clearInterval(pollTimer);
        return;
      }
      win.webContents
        .executeJavaScript(`
        const logs = window.__SLIDER_LOGS || [];
        window.__SLIDER_LOGS = [];
        JSON.stringify(logs);
      `)
        .then((result: string) => {
          const logs = JSON.parse(result) as string[];
          if (logs.length > 0) {
            const content = logs.join("\\n") + "\\n";
            try {
              FS.appendFileSync(SLIDER_DEBUG_LOG_PATH, content, "utf8");
            } catch {}
            console.log(
              "[SLIDER-DEBUG-POLL] wrote " +
                logs.length +
                " log entries to " +
                SLIDER_DEBUG_LOG_PATH,
            );
          }
        })
        .catch(() => {});
    }, 2000);
    win.on("closed", () => clearInterval(pollTimer));
  }
}

let isCleanupFinished = false;
let isCleaningUp = false;

app.on("before-quit", (event) => {
  if (isCleanupFinished) {
    return;
  }
  if (isCleaningUp) {
    event.preventDefault();
    return;
  }

  isCleaningUp = true;
  event.preventDefault(); // Hold the quit to perform async cleanup
  isQuitting = true;
  writeDesktopLogHeader("before-quit received, performing async cleanup");

  // Notify the renderer to show the close animation.
  // The renderer goes into "idle" (waving) while we clean up.
  mainWindow?.webContents.send(APP_CLOSING_CHANNEL);

  clearUpdatePollTimer();
  codeHostManager.dispose();
  browserHostManager.dispose();
  codeControlChannel.dispose();

  void (async () => {
    try {
      await Effect.runPromise(resolvedShutdown.request);
      await Promise.race([
        (async () => {
          await shutdownPromise;
          await Effect.runPromise(resolvedShutdown.awaitComplete);
        })(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("App shutdown timed out after 10 seconds")), 10000),
        ),
      ]);
    } catch (error) {
      writeDesktopLogHeader(`shutdown failed or timed out: ${error}`);
    } finally {
      isCleanupFinished = true;
      restoreStdIoCapture?.();
      writeDesktopLogHeader("cleanup finished, notifying renderer to finalize close animation");

      // Tell renderer that cleanup is done so it can trigger the squash/drain
      mainWindow?.webContents.send("desktop:app-cleanup-done");

      // Wait for renderer to signal that animation is finished
      try {
        await Promise.race([
          new Promise<void>((resolve) => {
            ipcMain.once("desktop:app-ready-to-exit", () => resolve());
          }),
          new Promise<void>((_, reject) =>
            setTimeout(
              () => reject(new Error("Renderer close animation timed out after 5 seconds")),
              5000,
            ),
          ),
        ]);
        writeDesktopLogHeader("renderer animation done, exiting app");
      } catch (err: any) {
        writeDesktopLogHeader(err.message);
      }

      app.exit(0);
    }
  })();
});

if (hasSingleInstanceLock) {
  app
    .whenReady()
    .then(() => {
      writeDesktopLogHeader("app ready");
      configureAppIdentity();
      configureApplicationMenu();
      registerDesktopProtocol();
      configureAutoUpdater();

      const allowedPermissions = new Set([
        "clipboard-read",
        "clipboard-write",
        "clipboard-sanitized-write",
        "pointerLock",
        "notifications",
      ]);
      session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(allowedPermissions.has(permission));
      });
      session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        return allowedPermissions.has(permission);
      });

      void bootstrap().catch((error) => {
        handleFatalStartupError("bootstrap", error);
      });

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          mainWindow = createWindow();
        }
      });
    })
    .catch((error) => {
      handleFatalStartupError("whenReady", error);
    });
}

// Window-all-closed unconditionally calls app.quit() on all platforms (including darwin).
// This is intentional IDE behavior (exits the app when the main editor window is closed,
// rather than leaving a headless backend process running).
app.on("window-all-closed", () => {
  writeDesktopLogHeader("window-all-closed emitted, calling app.quit()");
  app.quit();
});

if (process.platform !== "win32") {
  process.on("SIGINT", () => {
    writeDesktopLogHeader("SIGINT received");
    app.quit();
  });

  process.on("SIGTERM", () => {
    writeDesktopLogHeader("SIGTERM received");
    app.quit();
  });
}
