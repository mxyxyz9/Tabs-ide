import * as ChildProcess from "node:child_process";
import * as Crypto from "node:crypto";
import * as FS from "node:fs";
import * as Http from "node:http";
import * as Net from "node:net";
import * as OS from "node:os";
import * as Path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  BrowserView,
  ipcMain,
  nativeTheme,
  type BrowserWindow,
  type ProtocolRequest,
  type Rectangle,
  type Session as ElectronSession,
} from "electron";
import type {
  DesktopCodeHostActivateSessionInput,
  DesktopCodeHostEnsureSessionInput,
  DesktopCodeHostOpenFileInput,
  DesktopCodeHostSetBoundsInput,
  DesktopCodeHostState,
} from "@tabs/contracts";

import { CODE_OSS_THEME_CSS } from "./codeOssThemeCss";

const CODE_OSS_SERVER_HOST = "127.0.0.1";
const CODE_OSS_SERVER_START_TIMEOUT_MS = 20_000;
const CODE_OSS_STARTUP_LOG_LIMIT = 24;

export const CODE_OSS_WEB_LAUNCHER_RELATIVE_PATH = Path.join("scripts", "code-web.js");
export const CODE_OSS_WEB_SERVER_RELATIVE_PATH = Path.join(
  "node_modules",
  "@vscode",
  "test-web",
  "out",
  "server",
  "index.js",
);
export const PRIMARY_CODE_OSS_WEB_ASSET_RELATIVE_PATH = Path.join(
  "out",
  "vs",
  "workbench",
  "workbench.web.main.internal.js",
);
export const SECONDARY_CODE_OSS_WEB_ASSET_RELATIVE_PATH = Path.join(
  "out-vscode-web",
  "vs",
  "workbench",
  "workbench.web.main.internal.js",
);
export const CODE_OSS_EMBED_EXTENSION_RELATIVE_PATH = Path.join(
  "..",
  "resources",
  "code-oss-extensions",
  "tabs-embed-defaults",
);
export const CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH = Path.join(
  "out",
  "vs",
  "base",
  "parts",
  "sandbox",
  "electron-browser",
  "preload.js",
);
export const CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH = Path.join(
  "out",
  "vs",
  "code",
  "electron-browser",
  "workbench",
  "workbench-dev.html",
);
export const CODE_OSS_NLS_MESSAGES_RELATIVE_PATH = Path.join("out-build", "nls.messages.json");
export const CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH = "product.json";

// Real VS Code REH web server ("code-server-oss"). Unlike `@vscode/test-web`
// (a read-only test harness), this server provides genuine disk read/write via
// its remote filesystem provider, so edits in the embedded editor persist.
export const CODE_OSS_WEB_SERVER_MAIN_RELATIVE_PATH = Path.join("out", "server-main.js");
export const CODE_OSS_WEB_SERVER_CLI_RELATIVE_PATH = Path.join("out", "server-cli.js");
// The server reads NLS strings from out/nls.messages.json; the dev `compile`
// only writes it under out-build/, so we copy it on first launch (see below).
export const CODE_OSS_WEB_SERVER_NLS_RELATIVE_PATH = Path.join("out", "nls.messages.json");

const REQUIRED_CODE_OSS_DESKTOP_RELATIVE_PATHS = [
  CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
  CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH,
  CODE_OSS_NLS_MESSAGES_RELATIVE_PATH,
  CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH,
] as const;
const CODE_OSS_FILE_PROTOCOL = "vscode-file";
const CODE_OSS_WEBVIEW_PROTOCOL = "vscode-webview";
const CODE_OSS_FILE_PROTOCOL_AUTHORITY = "vscode-app";
const DEFAULT_CODE_HOST_STATE_DIR = Path.join(
  process.env.TABS_HOME?.trim() || Path.join(OS.homedir(), ".tabs"),
  "userdata",
);
const CODE_OSS_WEB_SERVER_DATA_DIR = Path.join(DEFAULT_CODE_HOST_STATE_DIR, "code-oss-web-server");

export interface CodeHostConfig {
  state: DesktopCodeHostState;
  runtime: CodeHostRuntime | null;
  rootDir?: string;
}

type FsLike = Pick<typeof FS, "existsSync" | "readdirSync" | "statSync">;

type CodeHostRuntime =
  | { kind: "managed-server"; vscodeRoot: string }
  | { kind: "desktop-renderer"; vscodeRoot: string; stateDir: string };

type CodeSession = {
  projectId: string;
  workspaceRoot: string;
  view: BrowserView | null;
  partition: string | null;
  bounds: Rectangle | null;
  lastFocusedPath: string | null;
  lastNavigationNonce: number;
  lastLoadedUrl: string | null;
  desktopLoadPending: boolean;
  entry: string | null;
  workspaceUri: string | null;
  desktopConfigChannel: string | null;
  desktopProtocolRegistered: boolean;
  desktopRequestDiagnosticsRegistered: boolean;
  runtimeStartPromise: Promise<CodeSessionRuntime> | null;
  serverProcess: ChildProcess.ChildProcess | null;
  serverStartupLogs: string[];
};

type ManagedServerSessionRuntime = {
  kind: "managed-server";
  entry: string;
  mountRoot: string;
  workspaceUri: string;
};

type DesktopRendererSessionRuntime = {
  kind: "desktop-renderer";
  entry: string;
  workspaceUri: string;
};

type CodeSessionRuntime = ManagedServerSessionRuntime | DesktopRendererSessionRuntime;

type UriComponent = {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
};

type DesktopUserDataProfile = {
  id: string;
  isDefault: boolean;
  name: string;
  location: UriComponent;
  globalStorageHome: UriComponent;
  settingsResource: UriComponent;
  keybindingsResource: UriComponent;
  tasksResource: UriComponent;
  snippetsHome: UriComponent;
  promptsHome: UriComponent;
  extensionsResource: UriComponent;
  mcpResource: UriComponent;
  cacheHome: UriComponent;
};

type DesktopWindowConfiguration = {
  _: string[];
  "folder-uri"?: string[];
  "file-uri"?: string[];
  "disable-telemetry": boolean;
  "disable-updates": boolean;
  "skip-release-notes": boolean;
  "skip-welcome": boolean;
  "builtin-extensions-dir"?: string;
  "extensions-dir": string;
  extensionDevelopmentPath?: string[];
  windowId: number;
  appRoot: string;
  userEnv: NodeJS.ProcessEnv;
  product: Record<string, unknown>;
  zoomLevel: number;
  codeCachePath: string;
  nls: {
    messages: string[];
    language: string;
  };
  cssModules?: string[];
  mainPid: number;
  machineId: string;
  sqmId: string;
  devDeviceId: string;
  isPortable: boolean;
  execPath: string;
  backupPath?: string;
  profiles: {
    home: UriComponent;
    all: DesktopUserDataProfile[];
    profile: DesktopUserDataProfile;
  };
  homeDir: string;
  tmpDir: string;
  userDataDir: string;
  workspace: {
    id: string;
    uri: UriComponent;
  };
  logLevel: number;
  loggers: unknown[];
  logsPath: string;
  isInitialStartup: boolean;
  perfMarks: never[];
  os: {
    release: string;
    hostname: string;
    arch: string;
  };
  autoDetectHighContrast: boolean;
  autoDetectColorScheme: boolean;
  accessibilitySupport: boolean;
  colorScheme: {
    dark: boolean;
    highContrast: boolean;
  };
  policiesData: Record<string, never>;
};

const productConfigurationCache = new Map<string, Record<string, unknown>>();
const nlsMessagesCache = new Map<string, string[]>();
const cssModulesCache = new Map<string, string[]>();

function normalizeFilePath(input: string): string {
  return input.replace(/\\/g, "/");
}

function trimTrailingSlash(input: string): string {
  return input.replace(/\/+$/, "");
}

function formatCodeHostPayload(entries: ReadonlyArray<readonly [string, string]>): string {
  return JSON.stringify(entries);
}

export function buildMountedWorkspaceDescriptor(workspaceRoot: string): {
  mountRoot: string;
  workspaceUri: string;
} {
  // The real REH server opens the workspace by its actual filesystem path. The
  // web workbench maps a leading-`/` `?folder=` value to `vscode-remote://` for
  // the server's remote authority, giving genuine on-disk read/write.
  const resolvedWorkspaceRoot = Path.resolve(workspaceRoot);
  return {
    mountRoot: resolvedWorkspaceRoot,
    workspaceUri: resolvedWorkspaceRoot,
  };
}

/**
 * Seed the embedded Code-OSS server's user settings so the stock VS Code
 * "Get Started" walkthrough / welcome editor never opens in the Tabs embed.
 * Merges into any existing settings.json (our embed keys win). Best-effort.
 */
function ensureCodeOssWebServerDefaultSettings(): void {
  const userDir = Path.join(CODE_OSS_WEB_SERVER_DATA_DIR, "data", "User");
  const settingsPath = Path.join(userDir, "settings.json");
  const embedDefaults: Record<string, unknown> = {
    "workbench.startupEditor": "none",
    "workbench.welcomePage.walkthroughs.openOnInstall": false,
    "workbench.welcome.enabled": false,
    "workbench.tips.enabled": false,
    "workbench.editor.empty.hint": "hidden",
    // The "Setup VS Code Web" walkthrough kept coming back because it was a
    // *restored* editor tab (restore ignores startupEditor). Don't restore
    // editors in the embed so the walkthrough cannot persist.
    "workbench.editor.restoreEditors": false,
  };
  try {
    FS.mkdirSync(userDir, { recursive: true });
    let current: Record<string, unknown> = {};
    if (isFile(settingsPath, FS)) {
      try {
        current = JSON.parse(FS.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
      } catch {
        current = {};
      }
    }
    FS.writeFileSync(
      settingsPath,
      `${JSON.stringify({ ...current, ...embedDefaults }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // Non-fatal.
  }
}

/**
 * The web workbench bootstrap loads NLS from `out/nls.messages.js` and the
 * server reads `out/nls.messages.json`, but the dev `compile` only writes these
 * under `out-build/`. Without `out/nls.messages.js` the workbench fails to load
 * (the script 404s and the page renders blank). Copy both across once.
 * Best-effort: copy failures are swallowed.
 */
function ensureCodeOssWebServerNlsMessages(vscodeRoot: string): void {
  const outBuildDir = Path.dirname(
    getRequiredCodeOssPath(vscodeRoot, CODE_OSS_NLS_MESSAGES_RELATIVE_PATH),
  );
  const outDir = Path.dirname(
    getRequiredCodeOssPath(vscodeRoot, CODE_OSS_WEB_SERVER_NLS_RELATIVE_PATH),
  );
  for (const fileName of ["nls.messages.json", "nls.messages.js"]) {
    const target = Path.join(outDir, fileName);
    if (isFile(target, FS)) {
      continue;
    }
    const source = Path.join(outBuildDir, fileName);
    try {
      if (isFile(source, FS)) {
        FS.copyFileSync(source, target);
      }
    } catch {
      // Non-fatal.
    }
  }
}

function formatCodeHostStartupLogs(logs: readonly string[]): string {
  if (logs.length === 0) {
    return "No startup logs were captured.";
  }

  return logs.slice(-CODE_OSS_STARTUP_LOG_LIMIT).join(" | ");
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

function getCodeOssEmbedExtensionPath(baseDir: string): string {
  return Path.resolve(baseDir, CODE_OSS_EMBED_EXTENSION_RELATIVE_PATH);
}

function isDirectory(pathname: string, fs: FsLike): boolean {
  return fs.existsSync(pathname) && fs.statSync(pathname).isDirectory();
}

function isFile(pathname: string, fs: FsLike): boolean {
  return fs.existsSync(pathname) && fs.statSync(pathname).isFile();
}

function hasCodeOssMarker(candidate: string, fs: FsLike): boolean {
  return [
    CODE_OSS_WEB_LAUNCHER_RELATIVE_PATH,
    CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
    CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH,
  ].some((relativePath) => isFile(getRequiredCodeOssPath(candidate, relativePath), fs));
}

function resolveVsCodeRootCandidate(candidate: string, fs: FsLike): string | null {
  const normalizedCandidate = Path.resolve(candidate);
  if (hasCodeOssMarker(normalizedCandidate, fs)) {
    return normalizedCandidate;
  }

  const parentCandidate = Path.dirname(normalizedCandidate);
  if (hasCodeOssMarker(parentCandidate, fs)) {
    return parentCandidate;
  }

  return null;
}

function createUnavailableState(reason: string): CodeHostConfig {
  return {
    state: {
      available: false,
      mode: "external",
      entry: null,
      reason,
    },
    runtime: null,
  };
}

function createAvailableState(input: {
  entry?: string | null;
  runtime: CodeHostRuntime | null;
  rootDir?: string;
}): CodeHostConfig {
  return {
    ...(input.rootDir ? { rootDir: input.rootDir } : {}),
    state: {
      available: true,
      mode: "embedded",
      entry: input.entry ?? null,
      reason: null,
    },
    runtime: input.runtime,
  };
}

function safeReadDirectoryNames(pathname: string, fs: FsLike): string[] {
  try {
    return fs
      .readdirSync(pathname, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function resolveWorkspaceRootForSession(
  requestedWorkspaceRoot: string,
  config: Pick<CodeHostConfig, "rootDir" | "runtime">,
  fs: FsLike,
): string {
  const normalizedRequestedRoot = Path.resolve(requestedWorkspaceRoot);
  if (isDirectory(normalizedRequestedRoot, fs)) {
    return normalizedRequestedRoot;
  }

  const basename = Path.basename(normalizedRequestedRoot);
  if (!basename) {
    return normalizedRequestedRoot;
  }

  const candidateRoots = new Set<string>();
  const candidatePaths = new Set<string>();
  const addRoot = (value: string | null | undefined) => {
    if (!value) return;
    candidateRoots.add(Path.resolve(value));
  };
  const addCandidate = (value: string | null | undefined) => {
    if (!value) return;
    candidatePaths.add(Path.resolve(value));
  };

  addRoot(Path.dirname(normalizedRequestedRoot));
  addRoot(config.rootDir ?? null);
  addRoot(config.rootDir ? Path.dirname(config.rootDir) : null);
  addRoot(config.rootDir ? Path.dirname(Path.dirname(config.rootDir)) : null);
  addRoot(config.runtime ? Path.dirname(config.runtime.vscodeRoot) : null);

  addCandidate(normalizedRequestedRoot);
  for (const root of candidateRoots) {
    if (Path.basename(root) === basename) {
      addCandidate(root);
    }
    addCandidate(Path.join(root, basename));
    for (const child of safeReadDirectoryNames(root, fs)) {
      addCandidate(Path.join(root, child, basename));
    }
  }

  for (const candidate of candidatePaths) {
    if (isDirectory(candidate, fs)) {
      return candidate;
    }
  }

  return normalizedRequestedRoot;
}

function resolveExplicitEntry(
  candidate: string,
): { ok: true; entry: string } | { ok: false; reason: string } {
  if (/^https?:\/\//.test(candidate)) {
    try {
      const url = new URL(candidate);
      return { ok: true, entry: trimTrailingSlash(url.toString()) };
    } catch {
      return {
        ok: false,
        reason: `Invalid Code-OSS entry URL: ${candidate}`,
      };
    }
  }

  return {
    ok: false,
    reason: [
      `Unsupported Code-OSS entry: ${candidate}.`,
      "Tabs now embeds VS Code through a served web runtime, not a raw `workbench.html` file.",
      "Set `TABS_CODE_OSS_ENTRY` to an `http://` or `https://` workbench URL, or set `TABS_CODE_OSS_BUILD_DIR` to the local `tabs-code-main` checkout root built with `npm run compile && npm run compile-web`.",
    ].join(" "),
  };
}

function resolveManagedServerRoot(
  candidate: string,
  fs: FsLike,
): { ok: true; vscodeRoot: string } | { ok: false; reason: string } {
  const vscodeRoot = resolveVsCodeRootCandidate(candidate, fs);
  if (!vscodeRoot || !isDirectory(vscodeRoot, fs)) {
    return {
      ok: false,
      reason: `Configured Code-OSS build directory does not exist or is not a VS Code checkout: ${candidate}`,
    };
  }

  for (const relativePath of [
    CODE_OSS_WEB_SERVER_MAIN_RELATIVE_PATH,
    CODE_OSS_WEB_SERVER_CLI_RELATIVE_PATH,
  ]) {
    const serverEntryPath = getRequiredCodeOssPath(vscodeRoot, relativePath);
    if (!isFile(serverEntryPath, fs)) {
      return {
        ok: false,
        reason: [
          "Code-OSS web server build not found.",
          `Expected compiled asset: ${serverEntryPath}`,
          `Build it with: \`cd ${vscodeRoot} && npm run compile\` (and \`npm install\`).`,
          "Then restart the Tabs desktop app.",
        ].join(" "),
      };
    }
  }

  return { ok: true, vscodeRoot };
}

function resolveManagedDesktopRoot(
  candidate: string,
  fs: FsLike,
): { ok: true; vscodeRoot: string; stateDir: string } | { ok: false; reason: string } {
  const vscodeRoot = resolveVsCodeRootCandidate(candidate, fs);
  if (!vscodeRoot || !isDirectory(vscodeRoot, fs)) {
    return {
      ok: false,
      reason: `Configured Code-OSS build directory does not exist or is not a VS Code checkout: ${candidate}`,
    };
  }

  for (const relativePath of REQUIRED_CODE_OSS_DESKTOP_RELATIVE_PATHS) {
    const assetPath = getRequiredCodeOssPath(vscodeRoot, relativePath);
    if (!isFile(assetPath, fs)) {
      return {
        ok: false,
        reason: [
          "Code-OSS desktop runtime not found.",
          `Expected compiled asset: ${assetPath}`,
          `Build it with: \`cd ${vscodeRoot} && npm install && npm run compile\``,
          "Then restart the Tabs desktop app.",
        ].join(" "),
      };
    }
  }

  return {
    ok: true,
    vscodeRoot,
    stateDir: DEFAULT_CODE_HOST_STATE_DIR,
  };
}

function getDefaultResolutionFailureReason(rootDir: string): string {
  const expectedSiblingRoot = Path.join(rootDir, "..", "tabs-code-main");
  const expectedAsset = Path.join(expectedSiblingRoot, CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH);
  return [
    "Code-OSS desktop runtime not found.",
    `Expected local VS Code checkout: ${expectedSiblingRoot}`,
    `Expected compiled asset: ${expectedAsset}`,
    "Build it with: `cd ../tabs-code-main && npm install && npm run compile`",
    "Or set `TABS_CODE_OSS_ENTRY` to a served workbench URL or `TABS_CODE_OSS_BUILD_DIR` to the local `tabs-code-main` checkout root.",
  ].join(" ");
}

export function resolveCodeHostConfigWithFs(
  input: {
    rootDir: string;
    env: NodeJS.ProcessEnv;
  },
  fs: FsLike,
): CodeHostConfig {
  const explicitEntry = input.env.TABS_CODE_OSS_ENTRY?.trim() || null;
  if (explicitEntry) {
    const resolvedEntry = resolveExplicitEntry(explicitEntry);
    return resolvedEntry.ok
      ? createAvailableState({
          entry: resolvedEntry.entry,
          runtime: null,
          rootDir: input.rootDir,
        })
      : createUnavailableState(resolvedEntry.reason);
  }

  const explicitBuildDir = input.env.TABS_CODE_OSS_BUILD_DIR?.trim() || null;
  if (explicitBuildDir) {
    const resolvedRoot = resolveManagedServerRoot(explicitBuildDir, fs);
    if (resolvedRoot.ok) {
      return createAvailableState({
        runtime: {
          kind: "managed-server",
          vscodeRoot: resolvedRoot.vscodeRoot,
        },
        rootDir: input.rootDir,
      });
    }

    const resolvedDesktopRoot = resolveManagedDesktopRoot(explicitBuildDir, fs);
    if (resolvedDesktopRoot.ok) {
      return createAvailableState({
        runtime: {
          kind: "desktop-renderer",
          vscodeRoot: resolvedDesktopRoot.vscodeRoot,
          stateDir: resolvedDesktopRoot.stateDir,
        },
        rootDir: input.rootDir,
      });
    }
    return createUnavailableState(resolvedRoot.reason);
  }

  // In packaged apps, process.resourcesPath points to the Resources directory
  // which contains tabs-code-main as an unpacked directory
  const fallbackRoots = process.resourcesPath
    ? [
        // First try Resources/tabs-code-main (packaged app location)
        Path.join(process.resourcesPath, "tabs-code-main"),
        // Then try sibling directories (development)
        Path.join(input.rootDir, "..", "tabs-code-main"),
        Path.join(input.rootDir, "..", "vscode"),
      ]
    : [
        // Development mode fallbacks
        Path.join(input.rootDir, "..", "tabs-code-main"),
        Path.join(input.rootDir, "..", "vscode"),
      ];

  for (const fallbackRoot of fallbackRoots) {
    if (!isDirectory(fallbackRoot, fs)) {
      continue;
    }

    // Prefer the real REH web server: it persists edits to disk and boots
    // reliably. The desktop-renderer path is kept only as a fallback for
    // checkouts that lack the server build.
    const resolvedRoot = resolveManagedServerRoot(fallbackRoot, fs);
    if (resolvedRoot.ok) {
      return createAvailableState({
        runtime: {
          kind: "managed-server",
          vscodeRoot: resolvedRoot.vscodeRoot,
        },
        rootDir: input.rootDir,
      });
    }

    const resolvedDesktopRoot = resolveManagedDesktopRoot(fallbackRoot, fs);
    if (resolvedDesktopRoot.ok) {
      return createAvailableState({
        runtime: {
          kind: "desktop-renderer",
          vscodeRoot: resolvedDesktopRoot.vscodeRoot,
          stateDir: resolvedDesktopRoot.stateDir,
        },
        rootDir: input.rootDir,
      });
    }
  }

  return createUnavailableState(getDefaultResolutionFailureReason(input.rootDir));
}

export function resolveCodeHostConfig(input: {
  rootDir: string;
  env: NodeJS.ProcessEnv;
}): CodeHostConfig {
  return resolveCodeHostConfigWithFs(input, FS);
}

export function buildSessionUrl(
  entry: string,
  session: Pick<
    CodeSession,
    "workspaceRoot" | "lastFocusedPath" | "lastNavigationNonce" | "projectId"
  >,
  options?: {
    workspaceUri?: string;
    focusedFileUri?: string | null;
  },
): string {
  const url = new URL(entry);
  // The real web workbench reads `?folder=`; a leading-`/` value is resolved
  // against the server's remote authority (vscode-remote://). Pass the plain
  // absolute path so the workspace opens on the server's real filesystem.
  const workspaceUri = options?.workspaceUri ?? Path.resolve(session.workspaceRoot);

  url.searchParams.set("folder", workspaceUri);
  url.searchParams.set("tabs_projectId", session.projectId);
  url.searchParams.set("tabs_workspaceRoot", session.workspaceRoot);
  url.searchParams.set("tabs_navigationNonce", String(session.lastNavigationNonce));

  if (session.lastFocusedPath) {
    const focusedFilePath = Path.resolve(Path.join(session.workspaceRoot, session.lastFocusedPath));
    const fileUri = options?.focusedFileUri ?? focusedFilePath;
    url.searchParams.set("payload", formatCodeHostPayload([["openFile", fileUri]]));
    url.searchParams.set("tabs_relativePath", normalizeFilePath(session.lastFocusedPath));
  } else {
    url.searchParams.delete("payload");
    url.searchParams.delete("tabs_relativePath");
  }

  return url.toString();
}

function buildDesktopSessionUrl(
  entry: string,
  session: Pick<
    CodeSession,
    "workspaceRoot" | "lastFocusedPath" | "lastNavigationNonce" | "projectId"
  >,
): string {
  const url = new URL(entry);
  url.searchParams.set("tabs_projectId", session.projectId);
  url.searchParams.set("tabs_workspaceRoot", session.workspaceRoot);
  url.searchParams.set("tabs_navigationNonce", String(session.lastNavigationNonce));
  if (session.lastFocusedPath) {
    url.searchParams.set("tabs_relativePath", normalizeFilePath(session.lastFocusedPath));
  } else {
    url.searchParams.delete("tabs_relativePath");
  }
  return url.toString();
}

export function buildManagedServerArgs(input: {
  host: string;
  port: number;
  serverDataDir: string;
}): string[] {
  // Launch the real REH web server (out/server-main.js). The workspace folder
  // is selected per-session via the `?folder=` URL param, not a CLI argument.
  return [
    CODE_OSS_WEB_SERVER_MAIN_RELATIVE_PATH,
    "--without-connection-token",
    "--accept-server-license-terms",
    "--host",
    input.host,
    "--port",
    String(input.port),
    "--server-data-dir",
    input.serverDataDir,
  ];
}

async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = Net.createServer();
    server.once("error", reject);
    server.listen(0, CODE_OSS_SERVER_HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => {
          reject(new Error("Unable to reserve a loopback port for the VS Code web runtime."));
        });
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForHttpReady(entry: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const isReady = await new Promise<boolean>((resolve) => {
      const request = Http.get(entry, (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      });

      request.once("error", () => resolve(false));
      request.setTimeout(1_000, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (isReady) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for the VS Code web runtime at ${entry}.`);
}

export class CodeHostManager {
  private readonly sessions = new Map<string, CodeSession>();
  private activeProjectId: string | null = null;
  private disposed = false;

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly config: CodeHostConfig,
  ) {}

  async getState(): Promise<DesktopCodeHostState> {
    return { ...this.config.state };
  }

  async ensureSession(input: DesktopCodeHostEnsureSessionInput): Promise<void> {
    if (!this.config.state.available) {
      return;
    }

    const workspaceRoot = resolveWorkspaceRootForSession(input.workspaceRoot, this.config, FS);

    const existing = this.sessions.get(input.projectId);
    if (existing) {
      const workspaceChanged = existing.workspaceRoot !== workspaceRoot;
      existing.workspaceRoot = workspaceRoot;
      if (workspaceChanged) {
        this.stopSessionServer(existing);
        existing.entry = null;
        existing.workspaceUri = null;
        existing.runtimeStartPromise = null;
        existing.lastLoadedUrl = null;
        existing.desktopLoadPending = true;
        await this.loadSessionWhenVisible(existing);
      }
      return;
    }

    const partition = `persist:tabs-code-host:${input.projectId}`;
    const desktopRuntime =
      this.config.runtime?.kind === "desktop-renderer" ? this.config.runtime : null;
    const desktopConfigChannel = desktopRuntime
      ? `vscode:tabs-window-config:${Crypto.randomUUID()}`
      : null;
    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition,
        ...(desktopRuntime
          ? {
              preload: getRequiredCodeOssPath(
                desktopRuntime.vscodeRoot,
                CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
              ),
              additionalArguments: [`--vscode-window-config=${desktopConfigChannel}`],
              backgroundThrottling: false,
            }
          : null),
      },
    });
    view.setBackgroundColor("#121212");

    // Theme the embedded Code-OSS workbench to match the Tabs shell. The
    // managed-server runtime loads the workbench over http into this view, so
    // we inject our CSS host-side (no VS Code fork edits needed). insertCSS is
    // cleared on navigation, so re-apply on every load.
    if (!desktopRuntime) {
      const applyThemeCss = () => {
        void view.webContents.insertCSS(CODE_OSS_THEME_CSS).catch(() => {
          /* view may have been torn down */
        });
      };
      view.webContents.on("did-finish-load", applyThemeCss);
      view.webContents.on("dom-ready", applyThemeCss);
    }

    if (desktopConfigChannel) {
      ipcMain.handle(desktopConfigChannel, async () =>
        this.buildDesktopWindowConfiguration(input.projectId),
      );
    }

    const session: CodeSession = {
      projectId: input.projectId,
      workspaceRoot,
      view,
      partition,
      bounds: null,
      lastFocusedPath: null,
      lastNavigationNonce: 0,
      lastLoadedUrl: null,
      desktopLoadPending: true,
      entry: null,
      workspaceUri: null,
      desktopConfigChannel,
      desktopProtocolRegistered: false,
      desktopRequestDiagnosticsRegistered: false,
      runtimeStartPromise: null,
      serverProcess: null,
      serverStartupLogs: [],
    };
    this.registerDesktopDiagnostics(session);
    this.sessions.set(input.projectId, session);
    await this.loadSessionWhenVisible(session);
  }

  async activateSession(input: DesktopCodeHostActivateSessionInput): Promise<void> {
    if (!this.config.state.available) {
      return;
    }

    const session = this.sessions.get(input.projectId);
    const window = this.getWindow();
    if (!session || !window) {
      return;
    }

    const current = this.activeProjectId ? this.sessions.get(this.activeProjectId) : null;
    if (current && current.projectId !== session.projectId) {
      this.detachSession(current);
    }

    this.activeProjectId = session.projectId;
    if (session.bounds && session.view) {
      this.attachSession(session);
      session.view.setBounds(session.bounds);
    }
    await this.loadSessionWhenVisible(session);
  }

  hideActiveSession(): void {
    if (!this.activeProjectId) return;
    const session = this.sessions.get(this.activeProjectId);
    if (session && session.view) {
      this.detachSession(session);
    }
    this.activeProjectId = null;
  }

  async openFile(input: DesktopCodeHostOpenFileInput): Promise<void> {
    if (!this.config.state.available) {
      return;
    }

    const session = this.sessions.get(input.projectId);
    if (!session) {
      return;
    }

    const normalizedRelativePath = normalizeFilePath(input.relativePath);
    const needsReload =
      session.lastFocusedPath !== normalizedRelativePath ||
      session.lastNavigationNonce !== input.navigationNonce;
    session.lastFocusedPath = normalizedRelativePath;
    session.lastNavigationNonce = input.navigationNonce;
    if (needsReload) {
      session.desktopLoadPending = true;
      await this.loadSessionWhenVisible(session);
    }
  }

  setBounds(input: DesktopCodeHostSetBoundsInput): void {
    if (!this.config.state.available) {
      return;
    }
    const session = this.sessions.get(input.projectId);
    if (!session) {
      return;
    }

    if (!input.visible || input.width <= 0 || input.height <= 0) {
      session.bounds = null;
      if (this.activeProjectId === input.projectId) {
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

    if (this.activeProjectId === input.projectId) {
      this.attachSession(session);
      session.view?.setBounds(session.bounds);
      void this.loadSessionWhenVisible(session);
    }
  }

  syncSessions(projectIds: readonly string[]): void {
    const allowed = new Set(projectIds);
    for (const [projectId, session] of this.sessions) {
      if (allowed.has(projectId)) continue;
      if (this.activeProjectId === projectId) {
        if (session.view) {
          this.detachSession(session);
        }
        this.activeProjectId = null;
      }
      this.disposeSessionConfigChannel(session);
      session.view?.webContents.close({ waitForBeforeUnload: false });
      this.sessions.delete(projectId);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.hideActiveSession();
    for (const session of this.sessions.values()) {
      this.stopSessionServer(session);
      this.disposeSessionConfigChannel(session);
      session.view?.webContents.close({ waitForBeforeUnload: false });
    }
    this.sessions.clear();
  }

  downgradeToManagedServer(reason: string): boolean {
    const runtime = this.config.runtime;
    if (!runtime || runtime.kind !== "desktop-renderer") {
      return false;
    }

    const resolvedRoot = resolveManagedServerRoot(runtime.vscodeRoot, FS);
    if (!resolvedRoot.ok) {
      return false;
    }

    this.hideActiveSession();
    for (const session of this.sessions.values()) {
      this.stopSessionServer(session);
      this.disposeSessionConfigChannel(session);
      session.view?.webContents.close({ waitForBeforeUnload: false });
    }
    this.sessions.clear();

    this.config.runtime = {
      kind: "managed-server",
      vscodeRoot: resolvedRoot.vscodeRoot,
    };
    this.config.state.available = true;
    this.config.state.entry = null;
    this.config.state.reason = null;
    return true;
  }

  disableEmbeddedHost(reason: string): void {
    this.hideActiveSession();
    for (const session of this.sessions.values()) {
      this.stopSessionServer(session);
      this.disposeSessionConfigChannel(session);
      session.view?.webContents.close({ waitForBeforeUnload: false });
    }
    this.sessions.clear();
    this.config.runtime = null;
    this.config.state.available = false;
    this.config.state.entry = null;
    this.config.state.reason = reason;
  }

  private async loadSession(session: CodeSession): Promise<void> {
    const runtime = await this.ensureSessionRuntime(session);
    const nextUrl =
      runtime.kind === "desktop-renderer"
        ? buildDesktopSessionUrl(runtime.entry, session)
        : buildSessionUrl(runtime.entry, session, {
            workspaceUri: runtime.workspaceUri,
            focusedFileUri: session.lastFocusedPath
              ? this.buildMountedResourceUri(session, session.lastFocusedPath)
              : null,
          });
    if (session.lastLoadedUrl === nextUrl) {
      return;
    }
    if (runtime.kind === "desktop-renderer") {
      const desktopRuntime = this.config.runtime;
      if (!desktopRuntime || desktopRuntime.kind !== "desktop-renderer") {
        throw new Error("Desktop Code-OSS runtime is unavailable.");
      }
      this.ensureDesktopProtocol(session, desktopRuntime);
      session.desktopLoadPending = false;
    }
    session.lastLoadedUrl = nextUrl;
    if (!session.view) {
      throw new Error("Embedded Code-OSS session view is unavailable.");
    }
    await session.view.webContents.loadURL(nextUrl);
  }

  private async loadSessionWhenVisible(session: CodeSession): Promise<void> {
    const runtime = this.config.runtime;
    if (!runtime || runtime.kind !== "desktop-renderer") {
      await this.loadSession(session);
      return;
    }

    if (!session.desktopLoadPending) {
      return;
    }

    const isActive = this.activeProjectId === session.projectId;
    const hasBounds = Boolean(
      session.bounds && session.bounds.width > 0 && session.bounds.height > 0,
    );
    if (!isActive || !hasBounds) {
      return;
    }

    await this.loadSession(session);
  }

  private async ensureSessionRuntime(session: CodeSession): Promise<CodeSessionRuntime> {
    if (!this.config.state.available) {
      throw new Error(this.config.state.reason ?? "Code-OSS is unavailable.");
    }

    if (!this.config.runtime) {
      if (!this.config.state.entry) {
        throw new Error("Missing served Code-OSS entry.");
      }

      return {
        kind: "managed-server",
        entry: this.config.state.entry,
        mountRoot: session.workspaceRoot,
        workspaceUri: pathToFileURL(session.workspaceRoot).toString(),
      };
    }

    if (session.entry && session.workspaceUri) {
      if (this.config.runtime.kind === "managed-server") {
        return {
          kind: "managed-server",
          entry: session.entry,
          mountRoot: session.workspaceRoot,
          workspaceUri: session.workspaceUri,
        };
      }

      if (this.config.runtime.kind === "desktop-renderer") {
        return {
          kind: "desktop-renderer",
          entry: session.entry,
          workspaceUri: session.workspaceUri,
        };
      }
    }

    if (session.runtimeStartPromise) {
      return session.runtimeStartPromise;
    }

    session.runtimeStartPromise = this.startManagedServer(this.config.runtime, session)
      .then((runtime) => {
        session.entry = runtime.entry;
        session.workspaceUri = runtime.workspaceUri;
        this.config.state.entry = runtime.entry;
        this.config.state.reason = null;
        return runtime;
      })
      .catch((error) => {
        session.runtimeStartPromise = null;
        this.config.state.available = false;
        this.config.state.reason = error instanceof Error ? error.message : String(error);
        if (this.config.state.entry === session.entry) {
          this.config.state.entry = null;
        }
        throw error;
      });

    return session.runtimeStartPromise;
  }

  private async startManagedServer(
    runtime: CodeHostRuntime,
    session: CodeSession,
  ): Promise<CodeSessionRuntime> {
    if (runtime.kind !== "managed-server") {
      return this.startDesktopRenderer(runtime, session);
    }

    ensureCodeOssWebServerNlsMessages(runtime.vscodeRoot);
    FS.mkdirSync(CODE_OSS_WEB_SERVER_DATA_DIR, { recursive: true });
    ensureCodeOssWebServerDefaultSettings();

    const port = await reserveLoopbackPort();
    const entry = `http://${CODE_OSS_SERVER_HOST}:${port}`;
    const mountedWorkspace = buildMountedWorkspaceDescriptor(session.workspaceRoot);

    session.serverStartupLogs = [];
    const serverArgs = buildManagedServerArgs({
      host: CODE_OSS_SERVER_HOST,
      port,
      serverDataDir: CODE_OSS_WEB_SERVER_DATA_DIR,
    });
    // Run the Code-OSS server (and the extension host it forks) on Electron's
    // bundled Node via `ELECTRON_RUN_AS_NODE`, rather than a `node` from PATH.
    // This (a) removes the dependency on the user having Node installed in the
    // packaged app, and (b) guarantees Node >= 22 so `globalThis.WebSocket`
    // exists — without it `@vscode/proxy-agent`'s `createWebSocketPatch` throws
    // `Cannot read properties of undefined (reading 'prototype')` during
    // extension-host startup.
    const child = ChildProcess.spawn(process.execPath, serverArgs, {
      cwd: runtime.vscodeRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        BROWSER: "none",
        VSCODE_DEV: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    session.serverProcess = child;
    const appendLog = (chunk: Buffer | string) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) {
          session.serverStartupLogs.push(trimmedLine);
        }
      }
    };
    child.stdout?.on("data", appendLog);
    child.stderr?.on("data", appendLog);

    child.once("exit", (code, signal) => {
      if (session.serverProcess !== child) {
        return;
      }

      session.serverProcess = null;
      session.entry = null;
      session.workspaceUri = null;
      session.runtimeStartPromise = null;
      if (this.disposed) {
        return;
      }

      this.config.state.available = false;
      if (this.config.state.entry === entry) {
        this.config.state.entry = null;
      }
      this.config.state.reason = [
        "The local VS Code web runtime exited unexpectedly.",
        signal ? `Signal: ${signal}.` : `Exit code: ${code ?? "unknown"}.`,
        `Workspace root: ${session.workspaceRoot}.`,
        `Mounted root: ${mountedWorkspace.mountRoot}.`,
        `Startup logs: ${formatCodeHostStartupLogs(session.serverStartupLogs)}`,
      ].join(" ");
    });

    child.once("error", (error) => {
      appendLog(error.message);
    });

    try {
      await waitForHttpReady(entry, CODE_OSS_SERVER_START_TIMEOUT_MS);
      return {
        kind: "managed-server",
        entry,
        mountRoot: mountedWorkspace.mountRoot,
        workspaceUri: mountedWorkspace.workspaceUri,
      };
    } catch (error) {
      this.stopSessionServer(session);
      const prefix =
        error instanceof Error && error.message.includes("Timed out waiting")
          ? error.message
          : "Failed to start the local VS Code web runtime.";
      const details =
        error instanceof Error && error.message.includes("Timed out waiting")
          ? `Startup logs: ${formatCodeHostStartupLogs(session.serverStartupLogs)}`
          : [
              error instanceof Error ? error.message : String(error),
              `Startup logs: ${formatCodeHostStartupLogs(session.serverStartupLogs)}`,
            ].join(" ");
      throw new Error(
        [
          prefix,
          `Checkout root: ${runtime.vscodeRoot}.`,
          `Workspace root: ${session.workspaceRoot}.`,
          `Mounted root: ${mountedWorkspace.mountRoot}.`,
          `Launch command: node ${serverArgs.map((arg) => normalizeFilePath(arg)).join(" ")}.`,
          details,
        ].join(" "),
      );
    }
  }

  private stopSessionServer(session: CodeSession): void {
    if (!session.serverProcess) {
      return;
    }

    const serverProcess = session.serverProcess;
    session.serverProcess = null;
    session.entry = null;
    session.workspaceUri = null;
    session.runtimeStartPromise = null;
    if (!serverProcess.killed) {
      serverProcess.kill("SIGTERM");
    }
  }

  private startDesktopRenderer(
    runtime: Extract<CodeHostRuntime, { kind: "desktop-renderer" }>,
    session: CodeSession,
  ): DesktopRendererSessionRuntime {
    if (!session.desktopConfigChannel) {
      throw new Error("Missing desktop Code-OSS configuration channel.");
    }

    return {
      kind: "desktop-renderer",
      entry: buildVsCodeFileUrl(
        getRequiredCodeOssPath(runtime.vscodeRoot, CODE_OSS_DESKTOP_WORKBENCH_RELATIVE_PATH),
      ),
      workspaceUri: pathToFileURL(session.workspaceRoot).toString(),
    };
  }

  private buildMountedResourceUri(session: CodeSession, relativePath: string): string {
    const normalizedRelativePath = normalizeFilePath(relativePath).replace(/^\/+/, "");
    const baseUri =
      session.workspaceUri ?? buildMountedWorkspaceDescriptor(session.workspaceRoot).workspaceUri;
    if (normalizedRelativePath.length === 0) {
      return baseUri;
    }

    return new URL(
      normalizedRelativePath
        .split("/")
        .filter((segment) => segment.length > 0)
        .map(encodeURIComponent)
        .join("/"),
      `${trimTrailingSlash(baseUri)}/`,
    ).toString();
  }

  private attachSession(session: CodeSession): void {
    const window = this.getWindow();
    if (!window || !session.view) return;
    const currentViews = window.getBrowserViews();
    if (!currentViews.includes(session.view)) {
      window.addBrowserView(session.view);
    }
    session.view.webContents.focus?.();
  }

  private detachSession(session: CodeSession): void {
    const window = this.getWindow();
    if (!window || !session.view) return;
    const currentViews = window.getBrowserViews();
    if (currentViews.includes(session.view)) {
      window.removeBrowserView(session.view);
    }
  }

  private disposeSessionConfigChannel(session: CodeSession): void {
    if (!session.desktopConfigChannel) {
      return;
    }
    ipcMain.removeHandler(session.desktopConfigChannel);
    session.desktopConfigChannel = null;
  }

  private ensureDesktopProtocol(
    session: CodeSession,
    runtime: Extract<CodeHostRuntime, { kind: "desktop-renderer" }>,
  ): void {
    if (session.desktopProtocolRegistered) {
      return;
    }
    if (!session.view) {
      throw new Error("Desktop Code-OSS BrowserView is unavailable.");
    }

    const browserSession = session.view.webContents.session;
    const allowedRoots = this.getDesktopAllowedRoots(session);
    browserSession.protocol.registerFileProtocol(CODE_OSS_FILE_PROTOCOL, (request, callback) => {
      const resolvedPath = this.resolveDesktopProtocolPath(request, allowedRoots);
      if (!resolvedPath) {
        callback({ error: -3 });
        return;
      }

      const headers = this.buildDesktopProtocolHeaders(request.url, resolvedPath, runtime);
      callback({ path: resolvedPath, headers });
    });
    this.registerDesktopRequestDiagnostics(session);

    session.desktopProtocolRegistered = true;
    this.config.state.entry = session.entry;
  }

  private buildDesktopProtocolHeaders(
    requestUrl: string,
    resolvedPath: string,
    runtime: Extract<CodeHostRuntime, { kind: "desktop-renderer" }>,
  ): Record<string, string> {
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

    return headers;
  }

  private getDesktopAllowedRoots(session: CodeSession): string[] {
    const runtime = this.config.runtime;
    if (!runtime || runtime.kind !== "desktop-renderer") {
      return [session.workspaceRoot];
    }

    const sessionStateRoot = this.getDesktopSessionStateRoot(session.projectId, runtime.stateDir);
    return [
      runtime.vscodeRoot,
      Path.join(runtime.vscodeRoot, "extensions"),
      Path.join(runtime.vscodeRoot, ".build", "extensions"),
      session.workspaceRoot,
      sessionStateRoot,
      getCodeOssEmbedExtensionPath(__dirname),
    ]
      .map((pathname) => Path.resolve(pathname))
      .filter((value, index, array) => array.indexOf(value) === index);
  }

  private resolveDesktopProtocolPath(
    request: ProtocolRequest,
    allowedRoots: readonly string[],
  ): string | null {
    try {
      const parsed = new URL(request.url);
      if (parsed.protocol !== `${CODE_OSS_FILE_PROTOCOL}:`) {
        return null;
      }

      const fileUrl = new URL(`file://${parsed.pathname}${parsed.search}${parsed.hash}`);
      const resolvedPath = Path.resolve(fileURLToPath(fileUrl));
      if (
        allowedRoots.some((root) => {
          const relativePath = Path.relative(root, resolvedPath);
          return (
            relativePath === "" ||
            (!relativePath.startsWith("..") && !Path.isAbsolute(relativePath))
          );
        })
      ) {
        return resolvedPath;
      }
    } catch {
      return null;
    }

    return null;
  }

  private buildDesktopWindowConfiguration(projectId: string): DesktopWindowConfiguration {
    const session = this.sessions.get(projectId);
    const runtime = this.config.runtime;
    if (!session || !runtime || runtime.kind !== "desktop-renderer" || !session.view) {
      throw new Error("Desktop Code-OSS runtime is unavailable.");
    }

    const sessionStateRoot = this.getDesktopSessionStateRoot(projectId, runtime.stateDir);
    const profileRoot = Path.join(sessionStateRoot, "profile");
    const profile = this.ensureDesktopUserDataProfile(profileRoot);
    const focusedFilePath = session.lastFocusedPath
      ? Path.join(session.workspaceRoot, session.lastFocusedPath)
      : null;
    const embedExtensionPath = getCodeOssEmbedExtensionPath(__dirname);
    const builtInExtensionsDir = Path.join(runtime.vscodeRoot, ".build", "extensions");

    FS.mkdirSync(Path.join(sessionStateRoot, "logs"), { recursive: true });
    FS.mkdirSync(Path.join(sessionStateRoot, "cache"), { recursive: true });
    FS.mkdirSync(Path.join(sessionStateRoot, "extensions"), { recursive: true });

    const configuration: DesktopWindowConfiguration = {
      _: [],
      "folder-uri": [pathToFileURL(session.workspaceRoot).toString()],
      "disable-telemetry": true,
      "disable-updates": true,
      "skip-release-notes": true,
      "skip-welcome": true,
      "extensions-dir": Path.join(sessionStateRoot, "extensions"),
      windowId: session.view.webContents.id,
      appRoot: runtime.vscodeRoot,
      userEnv: {
        VSCODE_CWD: session.workspaceRoot,
      },
      product: this.getProductConfiguration(runtime.vscodeRoot),
      zoomLevel: 0,
      codeCachePath: Path.join(sessionStateRoot, "cache"),
      nls: {
        messages: this.getNlsMessages(runtime.vscodeRoot),
        language: "en",
      },
      cssModules: this.getCssModules(runtime.vscodeRoot),
      mainPid: process.pid,
      machineId: this.hashDesktopIdentity(`machine:${runtime.vscodeRoot}`),
      sqmId: this.hashDesktopIdentity(`sqm:${runtime.vscodeRoot}`),
      devDeviceId: this.hashDesktopIdentity(`dev:${runtime.vscodeRoot}`),
      isPortable: false,
      execPath: process.execPath,
      profiles: {
        home: this.toFileUriComponent(Path.join(sessionStateRoot, "profiles")),
        all: [profile],
        profile,
      },
      homeDir: OS.homedir(),
      tmpDir: OS.tmpdir(),
      userDataDir: sessionStateRoot,
      workspace: {
        id: this.hashDesktopIdentity(`workspace:${session.workspaceRoot}`),
        uri: this.toFileUriComponent(session.workspaceRoot),
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
    };

    if (focusedFilePath) {
      configuration["file-uri"] = [pathToFileURL(focusedFilePath).toString()];
    }

    if (isDirectory(builtInExtensionsDir, FS)) {
      configuration["builtin-extensions-dir"] = builtInExtensionsDir;
    }

    if (isDirectory(embedExtensionPath, FS)) {
      configuration.extensionDevelopmentPath = [embedExtensionPath];
    }

    return configuration;
  }

  private getDesktopSessionStateRoot(projectId: string, stateDir: string): string {
    return Path.join(stateDir, "code-oss-desktop", projectId);
  }

  private ensureDesktopUserDataProfile(profileRoot: string): DesktopUserDataProfile {
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
      location: this.toFileUriComponent(location),
      globalStorageHome: this.toFileUriComponent(Path.join(location, "globalStorage")),
      settingsResource: this.toFileUriComponent(Path.join(location, "settings.json")),
      keybindingsResource: this.toFileUriComponent(Path.join(location, "keybindings.json")),
      tasksResource: this.toFileUriComponent(Path.join(location, "tasks.json")),
      snippetsHome: this.toFileUriComponent(Path.join(location, "snippets")),
      promptsHome: this.toFileUriComponent(Path.join(location, "prompts")),
      extensionsResource: this.toFileUriComponent(Path.join(location, "extensions.json")),
      mcpResource: this.toFileUriComponent(Path.join(location, "mcp.json")),
      cacheHome: this.toFileUriComponent(cacheHome),
    };
  }

  private toFileUriComponent(pathname: string): UriComponent {
    const fileUrl = pathToFileURL(pathname);
    return {
      scheme: "file",
      authority: "",
      path: fileUrl.pathname,
      query: "",
      fragment: "",
    };
  }

  private hashDesktopIdentity(value: string): string {
    return Crypto.createHash("sha256").update(value).digest("hex");
  }

  private getProductConfiguration(vscodeRoot: string): Record<string, unknown> {
    const cached = productConfigurationCache.get(vscodeRoot);
    if (cached) {
      return cached;
    }

    const parsed = JSON.parse(
      FS.readFileSync(
        getRequiredCodeOssPath(vscodeRoot, CODE_OSS_PRODUCT_CONFIGURATION_RELATIVE_PATH),
        "utf8",
      ),
    ) as Record<string, unknown>;
    productConfigurationCache.set(vscodeRoot, parsed);
    return parsed;
  }

  private getNlsMessages(vscodeRoot: string): string[] {
    const cached = nlsMessagesCache.get(vscodeRoot);
    if (cached) {
      return cached;
    }

    const parsed = JSON.parse(
      FS.readFileSync(
        getRequiredCodeOssPath(vscodeRoot, CODE_OSS_NLS_MESSAGES_RELATIVE_PATH),
        "utf8",
      ),
    ) as string[];
    nlsMessagesCache.set(vscodeRoot, parsed);
    return parsed;
  }

  private registerDesktopDiagnostics(session: CodeSession): void {
    const runtime = this.config.runtime;
    if (!runtime || runtime.kind !== "desktop-renderer" || !session.view) {
      return;
    }

    const prefix = `[code-oss:${session.projectId}]`;
    session.view.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        console.error(`${prefix} did-fail-load`, { errorCode, errorDescription, validatedURL });
      },
    );
    session.view.webContents.on("render-process-gone", (_event, details) => {
      console.error(`${prefix} render-process-gone`, details);
    });
    session.view.webContents.on("preload-error", (_event, preloadPathname, error) => {
      console.error(`${prefix} preload-error`, preloadPathname, error);
    });
    session.view.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.error(`${prefix} console`, { level, message, line, sourceId });
    });
    session.view.webContents.on("did-finish-load", () => {
      setTimeout(() => {
        void session.view?.webContents
          .executeJavaScript(
            `({
              readyState: document.readyState,
              title: document.title,
              bodyChildCount: document.body?.childElementCount ?? -1,
              bodyText: document.body?.innerText?.slice(0, 400) ?? "",
              bodyHtml: document.body?.innerHTML?.slice(0, 400) ?? ""
            })`,
            true,
          )
          .then((snapshot) => {
            console.error(`${prefix} dom-snapshot`, snapshot);
          })
          .catch((error) => {
            console.error(`${prefix} dom-snapshot-error`, error);
          });
      }, 2_000);
    });
  }

  private registerDesktopRequestDiagnostics(session: CodeSession): void {
    if (session.desktopRequestDiagnosticsRegistered) {
      return;
    }

    const runtime = this.config.runtime;
    if (!runtime || runtime.kind !== "desktop-renderer" || !session.view) {
      return;
    }

    const prefix = `[code-oss:${session.projectId}]`;
    const browserSession = session.view.webContents.session;
    const filter = { urls: [`${CODE_OSS_FILE_PROTOCOL}://*/*`] };
    browserSession.webRequest.onErrorOccurred(filter, (details) => {
      console.error(`${prefix} request-error`, {
        url: details.url,
        error: details.error,
        resourceType: details.resourceType,
      });
    });
    browserSession.webRequest.onHeadersReceived(filter, (details) => {
      if (details.url.includes("/workbench-dev.html") || details.url.includes("/workbench.js")) {
        console.error(`${prefix} response`, {
          url: details.url,
          statusCode: details.statusCode,
          resourceType: details.resourceType,
          responseHeaders: details.responseHeaders,
        });
      }
    });

    session.desktopRequestDiagnosticsRegistered = true;
  }

  private getCssModules(vscodeRoot: string): string[] {
    const cached = cssModulesCache.get(vscodeRoot);
    if (cached) {
      return cached;
    }

    const outRoot = Path.join(vscodeRoot, "out");
    const cssModules: string[] = [];
    const queue = [outRoot];

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current || !isDirectory(current, FS)) {
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

        const relativePath = Path.relative(outRoot, absolutePath);
        cssModules.push(normalizeFilePath(relativePath));
      }
    }

    cssModules.sort();
    cssModulesCache.set(vscodeRoot, cssModules);
    return cssModules;
  }
}
