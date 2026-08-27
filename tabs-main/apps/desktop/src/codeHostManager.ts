import * as Crypto from "node:crypto";
import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  app,
  BrowserView,
  ipcMain,
  nativeTheme,
  shell,
  type BrowserWindow,
  type ProtocolRequest,
  type Rectangle,
  type Session as ElectronSession,
} from "electron";
import type {
  CodeChromeState,
  CodeTabInfo,
  DesktopCodeHostActivateSessionInput,
  DesktopCodeHostEnsureSessionInput,
  DesktopCodeHostOpenFileInput,
  DesktopCodeHostSetBoundsInput,
  DesktopCodeHostState,
} from "@tabs/contracts";

import { CODE_OSS_THEME_CSS } from "./codeOssThemeCss";
import { GEIST_MONO_FONT_CSS } from "./geistMonoFontCss";
import type { CodeControlChannel } from "./codeControlChannel";
import {
  BUILTIN_THEME_CONFIGS,
  evaluateThemeTokens,
  getOptimalPrimaryForeground,
  type CustomThemeConfig,
} from "@tabs/shared/themeDerivation";

export const CODE_HOST_CHROME_STATE_CHANNEL = "desktop:code-host:chrome-state";

export const CODE_OSS_EMBED_EXTENSION_RELATIVE_PATH = Path.join(
  "..",
  "resources",
  "code-oss-extensions",
  "tabs-embed-defaults",
);
export const CODE_OSS_INTEGRATION_EXTENSION_RELATIVE_PATH = Path.join(
  "..",
  "resources",
  "code-oss-extensions",
  "tabs-workbench-integration",
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

export interface CodeHostConfig {
  state: DesktopCodeHostState;
  runtime: CodeHostRuntime | null;
  rootDir?: string;
}

type FsLike = Pick<typeof FS, "existsSync" | "readdirSync" | "statSync">;

type CodeHostRuntime = { kind: "desktop-renderer"; vscodeRoot: string; stateDir: string };

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
};

type DesktopRendererSessionRuntime = {
  kind: "desktop-renderer";
  entry: string;
  workspaceUri: string;
};

type CodeSessionRuntime = DesktopRendererSessionRuntime;

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

function findDefaultWorkspaceFile(workspaceRoot: string): string | null {
  try {
    const candidates = [
      "README.md",
      "readme.md",
      "README.txt",
      "package.json",
      "index.ts",
      "index.js",
      "src/main.ts",
      "src/index.ts",
      "src/App.tsx",
      "src/App.jsx",
    ];
    for (const cand of candidates) {
      if (isFile(Path.join(workspaceRoot, cand), FS)) {
        return cand;
      }
    }
    const entries = FS.readdirSync(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith(".")) {
        return entry.name;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

const CODE_OSS_EMBED_DEFAULT_SETTINGS: Record<string, unknown> = {
  "workbench.startupEditor": "none",
  "workbench.welcomePage.walkthroughs.openOnInstall": false,
  "workbench.welcome.enabled": false,
  "workbench.tips.enabled": false,
  "workbench.editor.empty.hint": "hidden",
  // Restore the user's open editors across app restarts so the Code tab
  // reopens exactly where they left off (a core "continue where I left off"
  // expectation). The "Setup VS Code Web" walkthrough that previously rode
  // back in on restore is suppressed structurally instead: it can never be
  // opened in the first place (startupEditor "none" + welcome/walkthrough
  // disabled above), so there is nothing for the restore to bring back.
  "workbench.editor.restoreEditors": true,
  // Hide VS Code's own chrome — Tabs renders its own native React chrome
  // (activity rail, header, status bar) in the gutters around the embedded
  // view (see DesktopCodeTool in apps/web). The remaining sidebar / editor /
  // panel stay inside the embedded view and are driven by the integration
  // extension's command bridge.
  "workbench.activityBar.location": "hidden",
  "workbench.activityBar.visible": false,
  "workbench.statusBar.visible": false,
  "window.menuBarVisibility": "hidden",
  "window.titleBarStyle": "native",
  "window.customTitleBarVisibility": "never",
  "workbench.layoutControl.enabled": false,
  "window.commandCenter": false,
  // The embedded editor is a single-user local IDE driving the user's own
  // checkout — Workspace Trust prompts add nothing here and, more importantly,
  // an untrusted workspace can prevent the bundled Tabs integration extension
  // from activating.
  "security.workspace.trust.enabled": false,
  // Tabs has its own Agents surface; VS Code's built-in Chat ("Build with
  // Agent") duplicates it and its auxiliary bar squeezes the editor. Disable
  // the AI features and keep the secondary side bar closed by default. (The
  // integration extension also closes the auxiliary bar on activation, which
  // covers workspaces whose persisted layout still has the chat panel open.)
  "chat.disableAIFeatures": true,
  "chat.commandCenter.enabled": false,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  // The embed ships a fixed, bundled extension set with no marketplace, so
  // background update checks only add startup work and network noise (and can
  // delay the integration extension's activation on a cold session).
  "extensions.autoCheckUpdates": false,
};

function writeMergedJsonFile(pathname: string, patch: Record<string, unknown>): void {
  FS.mkdirSync(Path.dirname(pathname), { recursive: true });
  let current: Record<string, unknown> = {};
  if (isFile(pathname, FS)) {
    try {
      current = JSON.parse(FS.readFileSync(pathname, "utf8")) as Record<string, unknown>;
    } catch {
      current = {};
    }
  }
  FS.writeFileSync(pathname, `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`, "utf8");
}

function writeKeybindingsJsonFile(pathname: string, rules: Array<Record<string, unknown>>): void {
  FS.mkdirSync(Path.dirname(pathname), { recursive: true });
  let current: Array<Record<string, unknown>> = [];
  if (isFile(pathname, FS)) {
    try {
      current = JSON.parse(FS.readFileSync(pathname, "utf8")) as Array<Record<string, unknown>>;
      if (!Array.isArray(current)) {
        current = [];
      }
    } catch {
      current = [];
    }
  }
  const targetKeys = new Set(rules.map((r) => r.key));
  const filtered = current.filter((item) => !targetKeys.has(item.key));
  FS.writeFileSync(pathname, `${JSON.stringify([...filtered, ...rules], null, 2)}\n`, "utf8");
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

/**
 * Merge the embed's settings into a product.json's `configurationDefaults`.
 * Pure for testability. Returns the next product object and whether anything
 * actually changed (callers skip the disk write when unchanged).
 *
 * Product configuration defaults are applied before the native workbench's
 * profile and workspace configuration, avoiding first-run prompt races.
 */
export function mergeProductConfigurationDefaults(
  product: Record<string, unknown>,
  defaults: Record<string, unknown>,
): { product: Record<string, unknown>; changed: boolean } {
  const existing =
    typeof product.configurationDefaults === "object" && product.configurationDefaults !== null
      ? (product.configurationDefaults as Record<string, unknown>)
      : {};
  let changed = false;
  for (const [key, value] of Object.entries(defaults)) {
    if (JSON.stringify(existing[key]) !== JSON.stringify(value)) {
      changed = true;
      break;
    }
  }
  if (!changed) {
    return { product, changed: false };
  }
  return {
    product: { ...product, configurationDefaults: { ...existing, ...defaults } },
    changed: true,
  };
}

/**
 * Bake the embed defaults into the runtime's product.json
 * `configurationDefaults` (see mergeProductConfigurationDefaults for why the
 * settings.json route is not enough). Idempotent; best-effort.
 */
function ensureProductConfigurationDefaults(vscodeRoot: string): void {
  try {
    const productPath = Path.join(vscodeRoot, "product.json");
    if (!isFile(productPath, FS)) {
      return;
    }
    const parsed = JSON.parse(FS.readFileSync(productPath, "utf8")) as Record<string, unknown>;
    const { product, changed } = mergeProductConfigurationDefaults(
      parsed,
      CODE_OSS_EMBED_DEFAULT_SETTINGS,
    );
    if (changed) {
      FS.writeFileSync(productPath, `${JSON.stringify(product, null, "\t")}\n`, "utf8");
    }
  } catch {
    // Non-fatal: the workbench still runs, the user may just see stock chrome
    // prompts (e.g. Workspace Trust) that the defaults would have suppressed.
  }
}

function isDirectory(pathname: string, fs: FsLike): boolean {
  return fs.existsSync(pathname) && fs.statSync(pathname).isDirectory();
}

function isFile(pathname: string, fs: FsLike): boolean {
  return fs.existsSync(pathname) && fs.statSync(pathname).isFile();
}

function hasCodeOssMarker(candidate: string, fs: FsLike): boolean {
  return [
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
    "Or set `TABS_CODE_OSS_BUILD_DIR` to the local `tabs-code-main` checkout root.",
  ].join(" ");
}

export function resolveCodeHostConfigWithFs(
  input: {
    rootDir: string;
    env: NodeJS.ProcessEnv;
  },
  fs: FsLike,
): CodeHostConfig {
  const explicitBuildDir = input.env.TABS_CODE_OSS_BUILD_DIR?.trim() || null;
  if (explicitBuildDir) {
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
    return createUnavailableState(resolvedDesktopRoot.reason);
  }

  // In packaged apps, process.resourcesPath points to the Resources directory
  // which contains tabs-code-main as an unpacked directory
  const fallbackRoots = process.resourcesPath
    ? [
        // First try Resources/tabs-code-main (packaged app location)
        Path.join(process.resourcesPath, "vscode-main"),
        Path.join(process.resourcesPath, "tabs-code-main"),
        // Then try sibling directories (development)
        Path.join(input.rootDir, "..", "vscode-main"),
        Path.join(input.rootDir, "..", "tabs-code-main"),
        Path.join(input.rootDir, "..", "vscode"),
      ]
    : [
        // Development mode fallbacks
        Path.join(input.rootDir, "..", "vscode-main"),
        Path.join(input.rootDir, "..", "tabs-code-main"),
        Path.join(input.rootDir, "..", "vscode"),
      ];


  for (const fallbackRoot of fallbackRoots) {
    if (!isDirectory(fallbackRoot, fs)) {
      continue;
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

export function getWorkspaceTabsFilePath(
  projectId: string,
  stateDir: string = DEFAULT_CODE_HOST_STATE_DIR,
): string {
  const safeId = projectId.trim() || "default";
  return Path.join(stateDir, `workspace-tabs-${safeId}.json`);
}

export function readWorkspaceTabs(
  projectId: string,
  stateDir: string = DEFAULT_CODE_HOST_STATE_DIR,
  fs: Pick<typeof FS, "readFileSync" | "existsSync"> = FS,
): CodeTabInfo[] | null {
  try {
    const filePath = getWorkspaceTabsFilePath(projectId, stateDir);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CodeTabInfo[]) : null;
  } catch {
    return null;
  }
}

export function writeWorkspaceTabs(
  projectId: string,
  tabs: CodeTabInfo[],
  stateDir: string = DEFAULT_CODE_HOST_STATE_DIR,
  fs: Pick<typeof FS, "mkdirSync" | "writeFileSync"> = FS,
): void {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    const filePath = getWorkspaceTabsFilePath(projectId, stateDir);
    fs.writeFileSync(filePath, `${JSON.stringify(tabs, null, 2)}\n`, "utf8");
  } catch (err) {
    console.error(`[code-oss] failed to write workspace tabs for ${projectId}:`, err);
  }
}

export class CodeHostManager {
  private readonly sessions = new Map<string, CodeSession>();
  private readonly loadPromiseByProjectId = new Map<string, Promise<void>>();
  private activeProjectId: string | null = null;
  private currentThemeId: string = "tabs-dark";
  private currentCustomConfig: any = null;
  private disposed = false;
  private registerNativeWebContents: ((webContents: Electron.WebContents) => void) | null = null;

  setNativeWebContentsRegistrar(
    registrar: ((webContents: Electron.WebContents) => void) | null,
  ): void {
    this.registerNativeWebContents = registrar;
    if (registrar) {
      for (const session of this.sessions.values()) {
        if (session.view && !session.view.webContents.isDestroyed()) {
          registrar(session.view.webContents);
        }
      }
    }
  }

  private applyThemeToWebContents(webContents: Electron.WebContents): void {
    if (!webContents || webContents.isDestroyed?.()) return;
    const themeId = this.currentThemeId;
    const customConfig = this.currentCustomConfig;
    const config: CustomThemeConfig | undefined =
      themeId === "custom" && customConfig?.colors
        ? customConfig
        : BUILTIN_THEME_CONFIGS[themeId] || BUILTIN_THEME_CONFIGS["tabs-dark"];

    let customPropsJson = "null";
    if (config) {
      const evaluated = evaluateThemeTokens(config);
      const primary = evaluated["app.primaryBackground"] || config.colors.primary;
      const primaryFg = evaluated["app.primaryForeground"] || getOptimalPrimaryForeground(primary);
      const buttonBg = evaluated["button.background"] || primary;
      const buttonFg = evaluated["button.foreground"] || primaryFg;
      const bg = evaluated["editor.background"] || config.colors.background;
      const cardBg = evaluated["sideBar.background"] || config.colors.card;
      const popoverBg = evaluated["editorWidget.background"] || config.colors.card;
      const fg = evaluated["foreground"] || config.colors.foreground;
      const mutedFg = evaluated["app.mutedForeground"] || `color-mix(in srgb, ${fg} 65%, transparent)`;

      customPropsJson = JSON.stringify({
        "--tabs-bg": bg,
        "--tabs-bg-sidebar": cardBg,
        "--tabs-bg-elevated": cardBg,
        "--tabs-bg-popover": popoverBg,
        "--tabs-input-bg": cardBg,
        "--tabs-text": fg,
        "--tabs-text-muted": mutedFg,
        "--tabs-accent": primary,
        "--tabs-accent-strong": buttonBg,
        "--tabs-accent-fg": buttonFg,
        "--tabs-accent-soft": `color-mix(in srgb, ${primary} 15%, transparent)`,
        "--tabs-hairline": `color-mix(in srgb, ${fg} 6%, transparent)`,
        "--tabs-hairline-strong": `color-mix(in srgb, ${fg} 12%, transparent)`,
        "--vscode-button-background": buttonBg,
        "--vscode-button-foreground": buttonFg,
      });
    }

    const script = `(() => {
      const themeId = ${JSON.stringify(themeId)};
      const customProps = ${customPropsJson};
      const TABS_PROP_KEYS = [
        '--tabs-bg',
        '--tabs-bg-sidebar',
        '--tabs-bg-elevated',
        '--tabs-bg-popover',
        '--tabs-input-bg',
        '--tabs-text',
        '--tabs-text-muted',
        '--tabs-accent',
        '--tabs-accent-strong',
        '--tabs-accent-fg',
        '--tabs-accent-soft',
        '--tabs-hairline',
        '--tabs-hairline-strong',
        '--vscode-button-background',
        '--vscode-button-foreground',
      ];

      const targets = [
        document.documentElement,
        document.body,
        document.querySelector('.monaco-workbench'),
      ].filter(Boolean);

      targets.forEach((el) => {
        el.setAttribute('data-theme', themeId);
        TABS_PROP_KEYS.forEach((key) => {
          if (customProps && customProps[key]) {
            el.style.setProperty(key, customProps[key]);
          } else {
            el.style.removeProperty(key);
          }
        });
      });
    })()`;
    void webContents.executeJavaScript?.(script)?.catch(() => {});
  }

  private currentAiProvider: "tabs" | "copilot" = "tabs";

  setTheme(themeId: string, customConfig?: any): void {
    this.currentThemeId = themeId;
    this.currentCustomConfig = customConfig ?? null;
    for (const session of this.sessions.values()) {
      if (session.view && !session.view.webContents.isDestroyed()) {
        this.applyThemeToWebContents(session.view.webContents);
      }
    }
  }

  setAiProvider(provider: "tabs" | "copilot"): void {
    this.currentAiProvider = provider;
    const settingsPatch: Record<string, unknown> =
      provider === "copilot"
        ? {
            "chat.disableAIFeatures": false,
            "chat.commandCenter.enabled": true,
            "workbench.secondarySideBar.defaultVisibility": "visible",
          }
        : {
            "chat.disableAIFeatures": true,
            "chat.commandCenter.enabled": false,
            "workbench.secondarySideBar.defaultVisibility": "hidden",
          };
    const settingsPaths = new Set<string>([
      Path.join(DEFAULT_CODE_HOST_STATE_DIR, "code-oss-main", "profile", "default", "settings.json"),
    ]);
    const runtime = this.config.runtime;
    if (runtime) {
      for (const session of this.sessions.values()) {
        settingsPaths.add(
          Path.join(
            this.getDesktopSessionStateRoot(session.projectId, runtime.stateDir),
            "profile",
            "default",
            "settings.json",
          ),
        );
      }
    }
    for (const settingsPath of settingsPaths) {
      try {
        writeMergedJsonFile(settingsPath, settingsPatch);
        console.log(`[code-oss] updated AI provider settings (${provider}) → ${settingsPath}`);
      } catch (err) {
        console.error("[code-oss] failed to write AI provider settings", err);
      }
    }
  }

  private workspaceTabsDebounceTimers = new Map<string, NodeJS.Timeout>();

  handleChromeStateForTabs(projectId: string, state: CodeChromeState): void {
    if (!state.openTabs) return;

    const tabs = state.openTabs;
    const existingTimer = this.workspaceTabsDebounceTimers.get(projectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.workspaceTabsDebounceTimers.delete(projectId);
    }

    if (tabs.length > 0) {
      const timer = setTimeout(() => {
        this.workspaceTabsDebounceTimers.delete(projectId);
        writeWorkspaceTabs(projectId, [...tabs]);
      }, 500);
      this.workspaceTabsDebounceTimers.set(projectId, timer);
    } else {
      // Empty tabs: stabilization delay (1000ms) to ensure intentional zero-tabs state
      const timer = setTimeout(() => {
        this.workspaceTabsDebounceTimers.delete(projectId);
        writeWorkspaceTabs(projectId, []);
      }, 1000);
      this.workspaceTabsDebounceTimers.set(projectId, timer);
    }
  }

  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly config: CodeHostConfig,
    private readonly controlChannel?: CodeControlChannel,
  ) {
    this.controlChannel?.onChromeState((projectId, state) => {
      this.handleChromeStateForTabs(projectId, state);
    });

    this.controlChannel?.onExtensionHostConnected(async (projectId) => {
      // 1. Sync active theme
      this.controlChannel?.setTheme(this.currentThemeId, this.currentCustomConfig);

      // 2. Restore persisted workspace tabs sequentially
      const session = this.sessions.get(projectId);
      const savedTabs = readWorkspaceTabs(projectId);

      if (Array.isArray(savedTabs)) {
        if (savedTabs.length === 0) {
          // Explicit zero-tabs state persisted by user closing all tabs. Do not open fallback file.
          return;
        }

        const tabsToRestore = [...savedTabs];
        const inactiveTabs = tabsToRestore.filter((t) => !t.active);
        const activeTabs = tabsToRestore.filter((t) => t.active);

        // Open inactive tabs first with preserveFocus: true
        for (const tab of inactiveTabs) {
          const fullPath = Path.isAbsolute(tab.filePath)
            ? tab.filePath
            : Path.resolve(Path.join(session?.workspaceRoot ?? "", tab.filePath));
          const openOpts: {
            preview?: boolean;
            pinned?: boolean;
            preserveFocus?: boolean;
            viewColumn?: number;
          } = { preserveFocus: true };
          if (typeof tab.preview === "boolean") openOpts.preview = tab.preview;
          if (typeof tab.pinned === "boolean") openOpts.pinned = tab.pinned;
          if (typeof tab.viewColumn === "number") openOpts.viewColumn = tab.viewColumn;
          this.controlChannel?.openFile(projectId, fullPath, openOpts);
          await new Promise((resolve) => setTimeout(resolve, 60));
        }

        // Open active tab last with preserveFocus: false
        for (const tab of activeTabs) {
          const fullPath = Path.isAbsolute(tab.filePath)
            ? tab.filePath
            : Path.resolve(Path.join(session?.workspaceRoot ?? "", tab.filePath));
          const openOpts: {
            preview?: boolean;
            pinned?: boolean;
            preserveFocus?: boolean;
            viewColumn?: number;
          } = { preserveFocus: false };
          if (typeof tab.preview === "boolean") openOpts.preview = tab.preview;
          if (typeof tab.pinned === "boolean") openOpts.pinned = tab.pinned;
          if (typeof tab.viewColumn === "number") openOpts.viewColumn = tab.viewColumn;
          this.controlChannel?.openFile(projectId, fullPath, openOpts);
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
        return;
      }

      // Fallback: if no persisted tab-list file exists, open lastFocusedPath if set
      if (!session?.lastFocusedPath) return;
      const fullFilePath = Path.resolve(Path.join(session.workspaceRoot, session.lastFocusedPath));
      this.controlChannel?.openFile(projectId, fullFilePath);
    });
  }

  async getState(): Promise<DesktopCodeHostState> {
    return { ...this.config.state };
  }

  async recreateSession(projectId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) return;

    session.entry = null;
    session.workspaceUri = null;
    session.runtimeStartPromise = null;
    session.lastLoadedUrl = null;
    session.desktopLoadPending = true;

    if (this.activeProjectId === projectId) {
      await this.loadSessionWhenVisible(session);
    }
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
    const desktopRuntime = this.config.runtime;
    const desktopConfigChannel = desktopRuntime
      ? `vscode:tabs-window-config:${Crypto.randomUUID()}`
      : null;
    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        partition,
        // Never throttle the workbench while the Code tab is hidden: a detached
        // view throttles timers, which stalls the workbench's startup lifecycle
        // (it can sit forever before "Restored"/"Eventually"), so extensions
        // gated on later activation phases never start and the editor resumes
        // half-initialized when the tab is shown again.
        backgroundThrottling: false,
        ...(desktopRuntime
          ? {
              preload: getRequiredCodeOssPath(
                desktopRuntime.vscodeRoot,
                CODE_OSS_DESKTOP_PRELOAD_RELATIVE_PATH,
              ),
              additionalArguments: [`--vscode-window-config=${desktopConfigChannel}`],
            }
          : null),
      },
    });
    this.registerNativeWebContents?.(view.webContents);
    view.setBackgroundColor("#141414");

    view.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      if (level >= 2) {
        console.error(`[code-oss webContents L${level}] ${message} (${sourceId}:${line})`);
      }
    });

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

    // Keep the embedded editor fully inside Tabs: never let Code-OSS spawn a
    // separate window (e.g. cmd+shift+n "New Window"). Deny every new-window
    // request; genuinely external links open in the system browser instead.
    view.webContents.setWindowOpenHandler(({ url }) => {
      const isInternal =
        url === "about:blank" || /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url);
      if (!isInternal && /^https?:\/\//i.test(url)) {
        void shell.openExternal(url).catch(() => {
          /* ignore */
        });
      }
      return { action: "deny" };
    });

    // Theme the embedded Code-OSS workbench to match the Tabs shell. We inject
    // our CSS host-side (no VS Code fork edits needed). `insertCSS` applies to
    // the desktop renderer webContents and remains the single source of truth.
    // insertCSS is cleared on navigation, so re-apply on every load.
    {
      // Inject the editor font FIRST, then the theme — both via insertCSS, which
      // applies as an Electron user stylesheet above the workbench's CSP (a plain
      // <link> to Google Fonts is blocked by that CSP, and Geist Mono isn't
      // installed on the host, so the font must be embedded; see
      // geistMonoFontCss.ts). insertCSS is cleared on navigation, so re-apply on
      // every load.
      const applyThemeCss = () => {
        void view.webContents.insertCSS?.(GEIST_MONO_FONT_CSS)?.catch(() => {
          /* view may have been torn down */
        });
        void view.webContents.insertCSS?.(CODE_OSS_THEME_CSS)?.catch(() => {
          /* view may have been torn down */
        });
        this.applyThemeToWebContents(view.webContents);
      };
      view.webContents.on("did-finish-load", applyThemeCss);
      view.webContents.on("dom-ready", applyThemeCss);
      applyThemeCss();
      // One-shot layout probe: record where each stock workbench part actually
      // sits (left/width/display) so "the chrome has a weird gap" reports are
      // diagnosable from ~/.tabs/userdata/layout-diagnostic.json instead of
      // guessing from screenshots.
      let layoutProbed = false;
      view.webContents.on("did-finish-load", () => {
        if (layoutProbed) return;
        layoutProbed = true;
        setTimeout(() => {
          void view.webContents
            .executeJavaScript(
              `(() => {
                 const m = (sel) => {
                   const el = document.querySelector(sel);
                   if (!el) return null;
                   const r = el.getBoundingClientRect();
                   const cs = getComputedStyle(el);
                   return { left: Math.round(r.left), width: Math.round(r.width), display: cs.display };
                 };
                 return JSON.stringify({
                   activitybar: m('.monaco-workbench .part.activitybar'),
                   sidebar: m('.monaco-workbench .part.sidebar'),
                   auxiliarybar: m('.monaco-workbench .part.auxiliarybar'),
                   statusbar: m('.monaco-workbench .part.statusbar'),
                   titlebar: m('.monaco-workbench .part.titlebar'),
                   banner: m('.monaco-workbench .part.banner'),
                 });
               })()`,
            )
            .then((result: unknown) => {
              try {
                FS.writeFileSync(
                  Path.join(DEFAULT_CODE_HOST_STATE_DIR, "layout-diagnostic.json"),
                  String(result),
                  "utf8",
                );
              } catch {
                /* ignore */
              }
            })
            .catch(() => undefined);
        }, 3000);
      });
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

    const cachedState = this.controlChannel?.getChromeState(session.projectId);
    if (cachedState && !window.isDestroyed()) {
      window.webContents.send(CODE_HOST_CHROME_STATE_CHANNEL, {
        projectId: session.projectId,
        state: cachedState,
      });
    }
  }

  hideActiveSession(): void {
    if (!this.activeProjectId) return;
    const session = this.sessions.get(this.activeProjectId);
    if (session && session.view) {
      this.detachSession(session);
    }
    this.activeProjectId = null;
  }

  /** Ask every connected embedded workbench to save its dirty editors before shutdown. */
  saveAllOpenSessions(): void {
    for (const projectId of this.sessions.keys()) {
      this.controlChannel?.runCommand(projectId, "workbench.action.files.saveAll");
    }
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
    const needsUpdate =
      session.lastFocusedPath !== normalizedRelativePath ||
      session.lastNavigationNonce !== input.navigationNonce;
    session.lastFocusedPath = normalizedRelativePath;
    session.lastNavigationNonce = input.navigationNonce;

    if (!needsUpdate) {
      return;
    }

    const fullFilePath = Path.resolve(Path.join(session.workspaceRoot, normalizedRelativePath));

    if (this.controlChannel) {
      const sent = this.controlChannel.openFile(input.projectId, fullFilePath);
      if (sent) {
        return;
      }
    }

    if (session.lastLoadedUrl === null) {
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

    const mainWindow = this.getWindow();
    const mainWebContents = mainWindow?.webContents as { getZoomFactor?: () => number } | undefined;
    const zoomFactor = typeof mainWebContents?.getZoomFactor === "function" ? mainWebContents.getZoomFactor() : 1.0;

    let x = Math.round(input.x * zoomFactor);
    let y = Math.round(input.y * zoomFactor);
    let width = Math.round(input.width * zoomFactor);
    let height = Math.round(input.height * zoomFactor);

    const isDestroyed = typeof mainWindow?.isDestroyed === "function" ? mainWindow.isDestroyed() : false;
    const getContentSize = typeof mainWindow?.getContentSize === "function" ? mainWindow.getContentSize.bind(mainWindow) : null;

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
      const viewWebContents = session.view.webContents as {
        getZoomFactor?: () => number;
        setZoomFactor?: (factor: number) => void;
      } | undefined;
      const currentZoom =
        typeof viewWebContents?.getZoomFactor === "function" ? viewWebContents.getZoomFactor() : 1.0;
      if (Math.abs(currentZoom - zoomFactor) > 0.001 && typeof viewWebContents?.setZoomFactor === "function") {
        viewWebContents.setZoomFactor(zoomFactor);
      }
    }

    console.log("[BOUNDS_INSTRUMENTATION_MAIN]", {
      input,
      zoomFactor,
      finalBounds: session.bounds,
    });

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

  async flushAndShutdownSessions(): Promise<void> {
    const { writeDesktopLogHeader } = require("./main");
    writeDesktopLogHeader("flushAndShutdownSessions: entering function");
    this.disposed = true;
    this.hideActiveSession();

    const sessions = Array.from(this.sessions.values());
    this.sessions.clear();

    writeDesktopLogHeader(`flushAndShutdownSessions: preparing to flush ${sessions.length} sessions`);
    await Promise.all(
      sessions.map(async (session) => {
        if (session.view && !session.view.webContents.isDestroyed()) {
          try {
            // Invoke Code-OSS's official IWorkbench.shutdown() path.
            //
            // The workbench entry point (workbench.ts) exposes a global
            // `window.__tabs_codehost_shutdown()` that calls the IDisposable
            // returned by `create()`. Disposing it triggers:
            //   IWorkbench.shutdown()
            //   → BrowserLifecycleService.shutdown()
            //   → storageService.flush(WillSaveStateReason.SHUTDOWN)
            //   → IndexedDB transactions are committed to LevelDB on disk.
            //
            // This is the correct flush path; a synthetic `beforeunload` event
            // would only hit onBeforeUnload() → doShutdown() which fires
            // storageService.flush() optimistically (fire-and-forget) and
            // cannot be awaited from the main process.
            writeDesktopLogHeader("flushAndShutdownSessions: invoking __tabs_codehost_shutdown via executeJavaScript");
            await session.view.webContents.executeJavaScript(
              `(async () => {
                const fn = window.__tabs_codehost_shutdown;
                if (typeof fn === 'function') {
                  const res = fn();
                  if (res instanceof Promise) {
                    await res;
                  }
                }
                return true;
              })()`,
            );
            writeDesktopLogHeader("flushAndShutdownSessions: __tabs_codehost_shutdown executed successfully");
          } catch (e: any) {
            writeDesktopLogHeader(`flushAndShutdownSessions: __tabs_codehost_shutdown failed: ${e?.message}`);
            /* best effort — if the webcontents crashes or the page hasn't loaded yet, continue */
          }

          try {
            // After Code-OSS has flushed its own storage, tell Chromium to
            // flush the partition's DOMStorage (localStorage) to disk too.
            // Note: flushStorageData() covers DOMStorage/localStorage only;
            // IndexedDB flushing is handled by the shutdown() call above.
            if (session.view.webContents.session) {
              writeDesktopLogHeader("flushAndShutdownSessions: flushing DOMStorage data");
              await session.view.webContents.session.flushStorageData();
              writeDesktopLogHeader("flushAndShutdownSessions: DOMStorage data flushed successfully");
            }
          } catch (e: any) {
            writeDesktopLogHeader(`flushAndShutdownSessions: DOMStorage data flush failed: ${e?.message}`);
            /* best effort */
          }

          try {
            session.view.webContents.close({ waitForBeforeUnload: false });
          } catch {
            /* best effort */
          }
        }

        this.disposeSessionConfigChannel(session);
      }),
    );
    writeDesktopLogHeader("flushAndShutdownSessions: successfully exited function");
  }

  dispose(): void {
    void this.flushAndShutdownSessions().catch(() => undefined);
  }

  disableEmbeddedHost(reason: string): void {
    this.hideActiveSession();
    for (const session of this.sessions.values()) {
      this.disposeSessionConfigChannel(session);
      session.view?.webContents.close({ waitForBeforeUnload: false });
    }
    this.sessions.clear();
    this.config.runtime = null;
    this.config.state.available = false;
    this.config.state.entry = null;
    this.config.state.reason = reason;
  }

  /**
   * Adopt a newly-resolved runtime/state (e.g. after the Code-OSS runtime
   * finished downloading on a thin install). Clears existing sessions and
   * mutates the held config in place so callers keep a valid reference.
   */
  reconfigure(config: CodeHostConfig): void {
    this.hideActiveSession();
    for (const session of this.sessions.values()) {
      this.disposeSessionConfigChannel(session);
      session.view?.webContents.close({ waitForBeforeUnload: false });
    }
    this.sessions.clear();
    this.config.runtime = config.runtime;
    this.config.state.available = config.state.available;
    this.config.state.mode = config.state.mode;
    this.config.state.entry = config.state.entry;
    this.config.state.reason = config.state.reason;
    if (config.rootDir) {
      this.config.rootDir = config.rootDir;
    }
  }

  private async loadSession(session: CodeSession): Promise<void> {
    const existing = this.loadPromiseByProjectId.get(session.projectId);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const runtime = await this.ensureSessionRuntime(session);
        if (!session.lastFocusedPath) {
          session.lastFocusedPath = findDefaultWorkspaceFile(session.workspaceRoot);
        }
        const nextUrl = buildDesktopSessionUrl(runtime.entry, session);
        if (session.lastLoadedUrl === nextUrl) {
          return;
        }
        const desktopRuntime = this.config.runtime;
        if (!desktopRuntime) {
          throw new Error("Desktop Code-OSS runtime is unavailable.");
        }
        this.ensureDesktopProtocol(session, desktopRuntime);
        session.desktopLoadPending = false;
        session.lastLoadedUrl = nextUrl;
        if (!session.view) {
          throw new Error("Embedded Code-OSS session view is unavailable.");
        }
        await session.view.webContents.loadURL(nextUrl);
      } finally {
        this.loadPromiseByProjectId.delete(session.projectId);
      }
    })();

    this.loadPromiseByProjectId.set(session.projectId, promise);
    return promise;
  }

  private async loadSessionWhenVisible(session: CodeSession): Promise<void> {
    const runtime = this.config.runtime;
    if (!runtime) {
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

    const runtime = this.config.runtime;
    if (!runtime) {
      throw new Error("Desktop Code-OSS runtime is unavailable.");
    }

    if (session.entry && session.workspaceUri) {
      return {
        kind: "desktop-renderer",
        entry: session.entry,
        workspaceUri: session.workspaceUri,
      };
    }

    if (session.runtimeStartPromise) {
      return session.runtimeStartPromise;
    }

    session.runtimeStartPromise = Promise.resolve(this.startDesktopRenderer(runtime, session))
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

  public focusSession(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session || !session.view) return;
    session.view.webContents.focus?.();
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
    if (!runtime) {
      return [session.workspaceRoot];
    }

    const sessionStateRoot = this.getDesktopSessionStateRoot(session.projectId, runtime.stateDir);
    return [
      runtime.vscodeRoot,
      Path.join(runtime.vscodeRoot, "extensions"),
      Path.join(runtime.vscodeRoot, ".build", "extensions"),
      session.workspaceRoot,
      sessionStateRoot,
      // Shared (user-global) extensions live outside the per-project session
      // root, so they must be allowlisted explicitly or the workbench can't load
      // installed extensions' icons/webview assets through the file protocol.
      this.getDesktopSharedExtensionsDir(runtime.stateDir),
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
    if (!session || !runtime || !session.view) {
      throw new Error("Desktop Code-OSS runtime is unavailable.");
    }

    const sessionStateRoot = this.getDesktopSessionStateRoot(projectId, runtime.stateDir);
    const sharedExtensionsDir = this.getDesktopSharedExtensionsDir(runtime.stateDir);
    const profileRoot = Path.join(sessionStateRoot, "profile");
    const profile = this.ensureDesktopUserDataProfile(profileRoot);
    const focusedFilePath = session.lastFocusedPath
      ? Path.join(session.workspaceRoot, session.lastFocusedPath)
      : null;
    const embedExtensionPath = getCodeOssEmbedExtensionPath(__dirname);
    const builtInExtensionsDir = Path.join(runtime.vscodeRoot, ".build", "extensions");

    FS.mkdirSync(Path.join(sessionStateRoot, "logs"), { recursive: true });
    FS.mkdirSync(Path.join(sessionStateRoot, "cache"), { recursive: true });
    FS.mkdirSync(sharedExtensionsDir, { recursive: true });

    const configuration: DesktopWindowConfiguration = {
      _: [],
      "folder-uri": [pathToFileURL(session.workspaceRoot).toString()],
      "disable-telemetry": true,
      "disable-updates": true,
      "skip-release-notes": true,
      "skip-welcome": true,
      "extensions-dir": sharedExtensionsDir,
      windowId: session.view.webContents.id,
      appRoot: runtime.vscodeRoot,
      userEnv: {
        VSCODE_CWD: session.workspaceRoot,
        // Identify this project's extension host on the shared control channel so
        // the native chrome routes commands to the right editor. Without it the
        // integration extension announces an empty projectId and the broker can't
        // match it, leaving every chrome button a silent no-op.
        TABS_PROJECT_ID: projectId,
        ...(process.env.TABS_CODE_CONTROL_URL
          ? { TABS_CODE_CONTROL_URL: process.env.TABS_CODE_CONTROL_URL }
          : null),
        // The extension prefers the live URL file (it survives a main-process
        // restart on a new port); forward it alongside the launch-time URL.
        ...(process.env.TABS_CODE_CONTROL_FILE
          ? { TABS_CODE_CONTROL_FILE: process.env.TABS_CODE_CONTROL_FILE }
          : null),
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

    // Ensure user settings file has window.customContextMenu and window.dialogStyle set on initial boot
    try {
      const userSettingsDir = Path.join(sessionStateRoot, "User");
      const userSettingsFile = Path.join(userSettingsDir, "settings.json");
      if (!FS.existsSync(userSettingsDir)) {
        FS.mkdirSync(userSettingsDir, { recursive: true });
      }
      let existingSettings: Record<string, unknown> = {};
      if (FS.existsSync(userSettingsFile)) {
        try {
          existingSettings = JSON.parse(FS.readFileSync(userSettingsFile, "utf8"));
        } catch {
          existingSettings = {};
        }
      }
      if (existingSettings["window.customContextMenu"] !== true || existingSettings["window.dialogStyle"] !== "custom") {
        existingSettings["window.customContextMenu"] = true;
        existingSettings["window.dialogStyle"] = "custom";
        FS.writeFileSync(userSettingsFile, JSON.stringify(existingSettings, null, 2), "utf8");
      }
    } catch {
      /* best-effort */
    }

    return configuration;
  }

  private getDesktopSessionStateRoot(projectId: string, stateDir: string): string {
    return Path.join(stateDir, "code-oss-desktop", projectId);
  }

  /**
   * Extensions install location, shared by every project window — mirrors real
   * VS Code, where the extensions dir is per-user, not per-folder. Lives beside
   * the per-project session roots so installing an extension in one project
   * makes it available in all of them (per-project enablement state still lives
   * in each project's userDataDir). This is deliberately NOT under a projectId.
   */
  private getDesktopSharedExtensionsDir(stateDir: string): string {
    return Path.join(stateDir, "code-oss-desktop", "extensions");
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
    try {
      const desktopSettingsPath = Path.join(location, "settings.json");
      writeMergedJsonFile(desktopSettingsPath, CODE_OSS_EMBED_DEFAULT_SETTINGS);
      // Verify in dev which profile dir the running session actually reads.
      console.log(`[code-oss] embed settings written (desktop-renderer) → ${desktopSettingsPath}`);
    } catch {
      // Non-fatal. The integration extension also enforces these settings.
    }

    try {
      const desktopKeybindingsPath = Path.join(location, "keybindings.json");
      writeKeybindingsJsonFile(desktopKeybindingsPath, [
        {
          key: "cmd+shift+n",
          command: "-workbench.action.newWindow",
        },
        {
          key: "cmd+shift+n",
          command: "tabs.openProjectTab",
        },
        {
          key: "ctrl+shift+n",
          command: "-workbench.action.newWindow",
        },
        {
          key: "ctrl+shift+n",
          command: "tabs.openProjectTab",
        },
      ]);
      console.log(
        `[code-oss] embed keybindings written (desktop-renderer) → ${desktopKeybindingsPath}`,
      );
    } catch {
      // Non-fatal.
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
    if (!runtime || !session.view) {
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
      try {
        FS.appendFileSync(
          "/Users/rushil.dev/.tabs/userdata/workbench-console.log",
          `[console] ${message} (${sourceId}:${line})\n`,
        );
      } catch (e) {}
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
    if (!runtime || !session.view) {
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
