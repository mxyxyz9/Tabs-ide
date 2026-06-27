"use strict";

const vscode = require("vscode");

const PANEL_VIEW_TYPE = "tabs.shell";
const TOOL_IDS = ["code", "agents", "server", "git", "browser"];
const EMBEDDED_TOOL_IDS = new Set(["agents", "server", "browser"]);
const EMBED_CHROME_DEFAULTS = {
  // Suppress every piece of stock VS Code chrome — Tabs renders its own native
  // React rail / header / status bar around this embedded view, so the editor
  // surface must read as a custom IDE, not a reskinned VS Code (see Section 2 of
  // the embed-UI spec; cosmetic restyling lives in codeOssThemeCss.ts).
  "workbench.activityBar.location": "hidden",
  "workbench.activityBar.visible": false,
  // The native status bar stays VISIBLE: it is the only surface that can render
  // extension-contributed status items (Live Server "Go Live", Prettier, ESLint,
  // …) — VS Code exposes no API to mirror those into the React chrome. It is
  // themed to match the app in codeOssThemeCss.ts, so it reads as custom.
  "workbench.statusBar.visible": true,
  "window.menuBarVisibility": "hidden",
  "window.titleBarStyle": "custom",
  "window.customTitleBarVisibility": "never",
  "workbench.layoutControl.enabled": false,
  "window.commandCenter": false,
  "workbench.startupEditor": "none",
  "workbench.welcomePage.walkthroughs.openOnInstall": false,
  "workbench.welcome.enabled": false,
  // No watermark / key-tips in the empty editor: the native chrome already
  // signals state, and the spec requires the VS Code logo/watermark gone with no
  // trace (codeOssThemeCss.ts also hides it as a CSS backstop).
  "workbench.tips.enabled": false,
  "workbench.editor.empty.hint": "hidden",
  "security.workspace.trust.enabled": false,
  // Don't nag about recommended extensions inside the embed.
  "extensions.ignoreRecommendations": true,
  // Editor tab bar: shrink tabs, close button on the right (the React header owns
  // window controls), no breadcrumbs / secondary side bar.
  "workbench.editor.showTabs": "multiple",
  "workbench.editor.tabActionLocation": "right",
  "workbench.editor.tabSizing": "shrink",
  "breadcrumbs.enabled": false,
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  // Keep view-header actions (Explorer's new file / new folder / refresh /
  // collapse, etc.) always visible rather than hover-only, so the sidebar is
  // easier to work with (matches the Cursor reference).
  "workbench.view.alwaysShowHeaderActions": true,
  // Editor surface: Tabs typography + a thin accent line cursor, calm minimap,
  // thin scrollbars, smooth scrolling everywhere.
  "editor.fontFamily": '"Geist Mono", "Fira Code", monospace',
  "editor.fontSize": 13,
  "editor.lineHeight": 1.6,
  "editor.cursorStyle": "line",
  "editor.cursorWidth": 2,
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.smoothScrolling": true,
  "workbench.list.smoothScrolling": true,
  "editor.minimap.autohide": true,
  "editor.minimap.scale": 1,
  "editor.scrollbar.verticalScrollbarSize": 4,
  "editor.scrollbar.horizontalScrollbarSize": 4,
  "editor.renderLineHighlight": "gutter",
  "editor.overviewRulerBorder": false,
  "editor.hideCursorInOverviewRuler": true,
};

// Allowlist of workbench commands the native Tabs chrome (activity rail /
// header / status bar) may trigger over the loopback control channel. Keep in
// sync with CODE_CHROME_COMMAND_ALLOWLIST in packages/shared/src/codeChrome.ts.
// This ships as plain JS (no bundler) so the list is mirrored here rather than
// imported. Restricting to this fixed set means a compromised renderer can only
// run these navigation/layout commands, never arbitrary VS Code commands.
const CHROME_COMMAND_ALLOWLIST = new Set([
  "workbench.view.explorer",
  "workbench.view.search",
  "workbench.view.scm",
  "workbench.view.debug",
  "workbench.view.extensions",
  "workbench.action.showCommands",
  "workbench.action.toggleSidebarVisibility",
  "workbench.action.togglePanel",
  "workbench.action.terminal.toggleTerminal",
  "workbench.action.toggleMaximizedPanel",
  "workbench.action.toggleAuxiliaryBar",
  "workbench.action.quickOpen",
  "workbench.action.openSettings",
  "workbench.action.tasks.runTask",
  // Native status-bar pickers (language / indentation / EOL / encoding). Mirror
  // of CODE_STATUS_BAR_COMMANDS in packages/shared/src/codeChrome.ts.
  "workbench.action.editor.changeLanguageMode",
  "editor.action.indentationToSpaces",
  "workbench.action.editor.changeEOL",
  "workbench.action.editor.changeEncoding",
  // Application menu-bar commands (the native ≡ menu in the rail). Mirror of
  // CODE_MENU_COMMAND_IDS in packages/shared/src/codeChrome.ts — keep in sync.
  "workbench.action.files.newUntitledFile",
  "welcome.showNewFileEntries",
  "workbench.action.newWindow",
  "workbench.action.duplicateWorkspaceInNewWindow",
  "workbench.action.toggleAutoSave",
  "workbench.action.files.openFileFolder",
  "workbench.action.files.openFolder",
  "workbench.action.openWorkspace",
  "workbench.action.openRecent",
  "workbench.action.addRootFolder",
  "workbench.action.saveWorkspaceAs",
  "workbench.action.files.save",
  "workbench.action.files.saveAs",
  "workbench.action.files.saveAll",
  "workbench.action.files.revert",
  "workbench.action.closeActiveEditor",
  "workbench.action.closeFolder",
  "undo",
  "redo",
  "editor.action.clipboardCutAction",
  "editor.action.clipboardCopyAction",
  "editor.action.clipboardPasteAction",
  "actions.find",
  "editor.action.startFindReplaceAction",
  "editor.action.commentLine",
  "editor.action.blockComment",
  "editor.action.selectAll",
  "editor.action.smartSelect.expand",
  "editor.action.smartSelect.shrink",
  "editor.action.copyLinesUpAction",
  "editor.action.copyLinesDownAction",
  "editor.action.moveLinesUpAction",
  "editor.action.moveLinesDownAction",
  "editor.action.insertCursorAbove",
  "editor.action.insertCursorBelow",
  "workbench.action.openView",
  "workbench.actions.view.problems",
  "workbench.action.output.toggleOutput",
  "editor.action.toggleWordWrap",
  "workbench.action.navigateBack",
  "workbench.action.navigateForward",
  "workbench.action.showAllSymbols",
  "workbench.action.gotoSymbol",
  "editor.action.revealDefinition",
  "workbench.action.gotoLine",
  "workbench.action.debug.start",
  "workbench.action.debug.run",
  "workbench.action.debug.stop",
  "workbench.action.debug.restart",
  "workbench.action.debug.configure",
  "debug.addConfiguration",
  "editor.debug.action.toggleBreakpoint",
  "workbench.action.terminal.new",
  "workbench.action.terminal.split",
  "workbench.action.tasks.runTask",
  "workbench.action.tasks.build",
  "workbench.action.tasks.configureTaskRunner",
  "workbench.action.openWalkthrough",
  "workbench.action.openDocumentationUrl",
  "workbench.action.toggleDevTools",
  "workbench.action.openProcessExplorer",
  "workbench.action.showAboutDialog",
]);

// Map view-reveal commands → the activity-rail view id, so we can report which
// view is active after we switch it (VS Code exposes no public "active viewlet"
// API; since its own activity bar is hidden in the Tabs embed, the rail is the
// only switcher, making this tracking accurate in practice).
const VIEW_COMMAND_TO_ID = {
  "workbench.view.explorer": "explorer",
  "workbench.view.search": "search",
  "workbench.view.scm": "scm",
  "workbench.view.debug": "debug",
  "workbench.view.extensions": "extensions",
};

const registeredViewContainerCommands = new Set();
const commandToContainerId = new Map();
const BUILTIN_ACTIVITY_CONTAINERS = new Set([
  "workbench.view.explorer",
  "workbench.view.search",
  "workbench.view.scm",
  "workbench.view.debug",
  "workbench.view.extensions",
  "explorer",
  "search",
  "scm",
  "debug",
  "extensions",
]);

/** @type {vscode.WebviewPanel | null} */
let shellPanel = null;
/** @type {ReturnType<typeof createShellController> | null} */
let shellController = null;

/**
 * Last-resort trace channel for diagnosing this extension inside the remote
 * extension host, where console output is captured into the desktop main
 * process's in-memory ring and the workbench UI is hard to reach. Best-effort.
 */
function trace(message) {
  try {
    require("node:fs").appendFileSync(
      require("node:path").join(require("node:os").tmpdir(), "tabs-ext-trace.log"),
      `${new Date().toISOString()} [${process.pid}] ${message}\n`,
    );
  } catch {
    /* ignore */
  }
}

function activate(context) {
  void applyEmbedChromeDefaults();
  // Tabs renders its own Agents surface; close VS Code's auxiliary bar (the
  // stock Chat / "Build with Agent" panel) if a previously persisted layout
  // restored it open — the disableAIFeatures setting only prevents NEW chat UI.
  void vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar").then(
    () => undefined,
    () => undefined,
  );
  shellController = createShellController(context);
  context.subscriptions.push(shellController);
  try {
    startCodeControlChannel(context);
  } catch (error) {
    trace(`activate: control channel threw: ${error && error.stack ? error.stack : error}`);
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("tabs.openShell", () => shellController.show("agents")),
    vscode.commands.registerCommand("tabs.openAgents", () => shellController.show("agents")),
    vscode.commands.registerCommand("tabs.openServer", () => shellController.show("server")),
    vscode.commands.registerCommand("tabs.openBrowser", () => shellController.show("browser")),
    vscode.commands.registerCommand("tabs.focusCode", async () => {
      await vscode.commands.executeCommand("workbench.view.explorer");
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }),
    vscode.commands.registerCommand("tabs.focusGit", async () => {
      await vscode.commands.executeCommand("workbench.view.scm");
    }),
  );

  // The in-editor "Tabs" webview panel is the legacy Code-OSS-first shell. In
  // the current architecture the Tabs React app is the shell and renders native
  // chrome around the embedded editor, so the panel must NOT auto-open in the
  // managed-server runtime — only the control channel (started above) runs
  // there. The desktop-renderer fallback sets TABS_CODE_OSS_PRIMARY_SHELL=1 to
  // keep its original panel-shell behavior.
  if (process.env.TABS_CODE_OSS_PRIMARY_SHELL === "1") {
    void shellController.show(readStoredTool(context));
  }
}

function deactivate() {}

async function applyEmbedChromeDefaults() {
  const config = vscode.workspace.getConfiguration();
  await Promise.all(
    Object.entries(EMBED_CHROME_DEFAULTS).map(async ([key, value]) => {
      try {
        if (config.get(key) !== value) {
          await config.update(key, value, vscode.ConfigurationTarget.Global);
        }
      } catch {
        /* best-effort */
      }
    }),
  );
}

/**
 * Connect to the Electron main process's loopback control channel (URL provided
 * via TABS_CODE_CONTROL_URL) so the native Tabs chrome can drive this workbench
 * (run allowlisted commands) and receive live state (active view / panel /
 * dirty editors / branch). Best-effort: if the global WebSocket or the URL is
 * unavailable the editor still works, the chrome's buttons simply no-op.
 */
function startCodeControlChannel(context) {
  const fs = require("node:fs");
  const net = require("node:net");
  const path = require("node:path");
  // Diagnostics: extension-host console output is hard to reach from outside,
  // so also append to a logfile next to the control-URL file (the one location
  // both sides of the channel already share).
  const controlFile = process.env.TABS_CODE_CONTROL_FILE;
  const logFile = controlFile ? path.join(path.dirname(controlFile), "code-control-ext.log") : null;
  const log = (message) => {
    console.error(`[tabs-control] ${message}`);
    trace(`control: ${message}`);
    if (logFile) {
      try {
        fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
      } catch {
        /* ignore */
      }
    }
  };

  // Resolve the *current* control target on every (re)connect rather than
  // trusting a launch-time value. The Electron main process writes its live
  // `tcp://127.0.0.1:<port>/?token=<token>` URL to TABS_CODE_CONTROL_FILE;
  // reading it fresh each attempt lets a long-lived workbench reconnect to a
  // main process that restarted on a new port (common in dev, where the main
  // process hot-restarts but this server is reused). Falls back to the env URL.
  // The channel is raw TCP + newline-delimited JSON, deliberately NOT
  // WebSocket: the extension host's proxy patch makes WebSocket connects to
  // loopback hang indefinitely.
  const resolveControlTarget = () => {
    const candidates = [];
    if (process.env.TABS_CODE_CONTROL_FILE) {
      try {
        const parsed = JSON.parse(fs.readFileSync(process.env.TABS_CODE_CONTROL_FILE, "utf8"));
        if (parsed && typeof parsed.url === "string") {
          candidates.push(parsed.url);
        }
      } catch {
        /* fall through to env */
      }
    }
    if (process.env.TABS_CODE_CONTROL_URL) {
      candidates.push(process.env.TABS_CODE_CONTROL_URL);
    }
    for (const candidate of candidates) {
      try {
        const url = new URL(candidate);
        const port = Number.parseInt(url.port, 10);
        const token = url.searchParams.get("token") || "";
        if (Number.isFinite(port) && port > 0 && token) {
          return { port, token };
        }
      } catch {
        /* try next candidate */
      }
    }
    return null;
  };

  if (!process.env.TABS_CODE_CONTROL_FILE && !process.env.TABS_CODE_CONTROL_URL) {
    log("no control URL/file in env; chrome control channel disabled");
    return;
  }
  log("starting control channel");

  // Identifies this workbench on the shared control channel so the broker routes
  // commands/state to the right editor when multiple projects are open.
  const projectId = process.env.TABS_PROJECT_ID || "";

  /** @type {{ activeViewId: string | null, panelOpen: boolean, panelMaximized: boolean, dirtyCount: number, branch: string | null, activityBarItems: any[], autoSaveEnabled: boolean }} */
  const state = {
    activeViewId: null,
    panelOpen: false,
    panelMaximized: false,
    dirtyCount: 0,
    branch: null,
    activityBarItems: [],
    autoSaveEnabled: false,
  };
  let socket = null;
  let disposed = false;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  // Gates all outbound messages except `hello` until the handshake completes.
  // Without this, event watchers (fs.watch, VS Code subscriptions) can fire
  // `pushState()` in the window between TCP connect and the async
  // `refreshContainers().then(…)` that sends `hello` — the server sees a
  // `chromeState` as the first message, fails auth, and destroys the socket.
  let authenticated = false;

  const send = (message) => {
    if (!socket || socket.destroyed || !socket.writable) return;
    // Block all messages except hello until the handshake completes.
    if (!authenticated && message.type !== "hello") return;
    try {
      socket.write(`${JSON.stringify(message)}\n`);
    } catch {
      /* ignore */
    }
  };
  const pushState = () => send({ type: "chromeState", projectId, state: { ...state } });

  const computeDirtyCount = () =>
    vscode.workspace.textDocuments.filter((doc) => doc.isDirty).length;

  // Mirror `files.autoSave` so the rail's Auto Save menu entry can show a live
  // checkmark. Any value other than "off" counts as enabled.
  const computeAutoSaveEnabled = () => {
    try {
      return vscode.workspace.getConfiguration("files").get("autoSave") !== "off";
    } catch {
      return false;
    }
  };

  const refreshBranch = () => {
    try {
      const gitExtension = vscode.extensions.getExtension("vscode.git");
      const api = gitExtension && gitExtension.isActive ? gitExtension.exports.getAPI(1) : null;
      const repo = api && api.repositories && api.repositories[0];
      const head = repo && repo.state && repo.state.HEAD;
      state.branch = head && head.name ? head.name : null;
    } catch {
      state.branch = null;
    }
  };

  // Extension-contributed container icons are local files (SVG/PNG) shipped
  // inside the extension, addressed by absolute fsPath. The native Tabs rail
  // lives on the web-app origin — a *different* origin than this Code server
  // and with no connection token — so it can't fetch `/vscode-remote-resource`.
  // Resolve the files to base64 data URIs here (the extension host has `fs`)
  // and ship those instead, so the rail's <img>/mask renders on any origin
  // with no token. Codicon (`themeIcon`) icons are fonts, not files, so they
  // pass through untouched and are rendered with the codicon font web-side.
  const ICON_MIME_BY_EXT = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  // Container icons are tiny; cap reads so a pathological file can't bloat the
  // newline-delimited JSON control channel.
  const MAX_ICON_BYTES = 256 * 1024;
  const iconDataUriCache = new Map();
  const resolveIconFileToDataUri = (fsPath) => {
    if (typeof fsPath !== "string" || !fsPath) return null;
    if (iconDataUriCache.has(fsPath)) return iconDataUriCache.get(fsPath);
    let dataUri = null;
    try {
      const mime = ICON_MIME_BY_EXT[path.extname(fsPath).toLowerCase()];
      if (mime && fs.statSync(fsPath).size <= MAX_ICON_BYTES) {
        dataUri = `data:${mime};base64,${fs.readFileSync(fsPath).toString("base64")}`;
      }
    } catch {
      dataUri = null;
    }
    iconDataUriCache.set(fsPath, dataUri);
    return dataUri;
  };
  const resolveContainerIcon = (icon) => {
    if (!icon || typeof icon !== "object") return undefined;
    if (icon.type === "themeIcon") {
      return icon.value ? { type: "themeIcon", value: icon.value } : undefined;
    }
    if (icon.type === "uri") {
      const dataUri = resolveIconFileToDataUri(icon.value);
      return dataUri ? { type: "uri", value: dataUri } : undefined;
    }
    if (icon.type === "themeUri") {
      const light = resolveIconFileToDataUri(icon.light || icon.value);
      const dark = resolveIconFileToDataUri(icon.dark || icon.value);
      if (light || dark) {
        return { type: "themeUri", light: light || dark, dark: dark || light };
      }
      return undefined;
    }
    return undefined;
  };

  let lastRegistryCacheKey = "";
  const refreshContainers = async () => {
    try {
      const containers = await vscode.commands.executeCommand("_tabs.getViewContainers");
      if (!Array.isArray(containers)) return;

      const customContainers = containers.filter(
        (c) => c && c.id && !BUILTIN_ACTIVITY_CONTAINERS.has(c.id),
      );

      const cacheKey = customContainers
        .map((c) => `${c.id}:${c.commandId}:${c.order || 0}`)
        .join("|");
      if (cacheKey === lastRegistryCacheKey) {
        return;
      }
      lastRegistryCacheKey = cacheKey;

      registeredViewContainerCommands.clear();
      commandToContainerId.clear();

      const activityBarItems = [];

      for (const c of customContainers) {
        registeredViewContainerCommands.add(c.commandId);
        commandToContainerId.set(c.commandId, c.id);

        // Fall back to the generic "extensions" codicon when the contributed
        // icon is missing or its file can't be read, so the entry stays visible.
        const icon = resolveContainerIcon(c.icon) ?? { type: "themeIcon", value: "extensions" };

        activityBarItems.push({
          id: c.id,
          label: c.title,
          commandId: c.commandId,
          icon,
          order: c.order,
        });
      }

      state.activityBarItems = activityBarItems;
      pushState();
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      // "Canceled" is VS Code's expected response when the command is superseded
      // (workbench busy / shutting down) — the interval re-runs it, so don't log
      // it as an error.
      if (message === "Canceled" || message === "Cancelled") {
        trace(`control: refreshContainers canceled (will retry)`);
      } else {
        log(`refreshContainers error: ${message}`);
      }
    }
  };

  let activeWatcher = null;
  const watchActiveContainerFile = () => {
    const userdataDir = process.env.TABS_CODE_CONTROL_FILE
      ? path.dirname(process.env.TABS_CODE_CONTROL_FILE)
      : "/Users/rushil.dev/.tabs/userdata";
    const activeContainerFile = path.join(userdataDir, "active-container.json");

    const readAndApplyActiveContainer = () => {
      try {
        if (fs.existsSync(activeContainerFile)) {
          const content = fs.readFileSync(activeContainerFile, "utf8");
          // The writer is non-atomic, so fs.watch can fire mid-write and hand us
          // empty or truncated content. Skip it silently rather than logging a
          // bogus "Unexpected end of JSON input" — the watcher fires again once
          // the complete file lands.
          const trimmed = content.trim();
          if (!trimmed) return;
          let data;
          try {
            data = JSON.parse(trimmed);
          } catch {
            return;
          }
          if (data && typeof data.id === "string") {
            const newActiveId = data.id || null;
            let mappedId = newActiveId;
            if (newActiveId === "workbench.view.explorer") mappedId = "explorer";
            else if (newActiveId === "workbench.view.search") mappedId = "search";
            else if (newActiveId === "workbench.view.scm") mappedId = "scm";
            else if (newActiveId === "workbench.view.debug") mappedId = "debug";
            else if (newActiveId === "workbench.view.extensions") mappedId = "extensions";

            if (state.activeViewId !== mappedId) {
              state.activeViewId = mappedId;
              pushState();
            }
          }
        }
      } catch (err) {
        log(`readAndApplyActiveContainer error: ${err && err.message ? err.message : err}`);
      }
    };

    // Initial query
    vscode.commands
      .executeCommand("_tabs.getActiveViewContainer")
      .then((activeId) => {
        if (activeId && typeof activeId === "string") {
          let mappedId = activeId;
          if (activeId === "workbench.view.explorer") mappedId = "explorer";
          else if (activeId === "workbench.view.search") mappedId = "search";
          else if (activeId === "workbench.view.scm") mappedId = "scm";
          else if (activeId === "workbench.view.debug") mappedId = "debug";
          else if (activeId === "workbench.view.extensions") mappedId = "extensions";

          if (state.activeViewId !== mappedId) {
            state.activeViewId = mappedId;
            pushState();
          }
        }
      })
      .catch(() => {});

    readAndApplyActiveContainer();

    try {
      if (fs.existsSync(userdataDir)) {
        activeWatcher = fs.watch(userdataDir, (eventType, filename) => {
          if (filename === "active-container.json") {
            readAndApplyActiveContainer();
          }
        });
      }
    } catch (err) {
      log(`fs.watch active-container.json error: ${err && err.message ? err.message : err}`);
    }
  };

  watchActiveContainerFile();

  const runCommand = async (commandId) => {
    const isStaticAllowed = CHROME_COMMAND_ALLOWLIST.has(commandId);
    const isDynamicAllowed = registeredViewContainerCommands.has(commandId);

    if (!isStaticAllowed && !isDynamicAllowed) {
      return;
    }
    try {
      await vscode.commands.executeCommand(commandId);
    } catch {
      return;
    }
    // Track derived UI state from the command we just ran (VS Code exposes no
    // public active-viewlet / panel-visibility API).
    if (Object.prototype.hasOwnProperty.call(VIEW_COMMAND_TO_ID, commandId)) {
      state.activeViewId = VIEW_COMMAND_TO_ID[commandId];
    } else if (commandToContainerId.has(commandId)) {
      state.activeViewId = commandToContainerId.get(commandId);
    } else if (commandId === "workbench.action.toggleSidebarVisibility") {
      state.activeViewId = state.activeViewId === null ? "explorer" : null;
    } else if (
      commandId === "workbench.action.togglePanel" ||
      commandId === "workbench.action.terminal.toggleTerminal"
    ) {
      state.panelOpen = !state.panelOpen;
      // Closing the panel also exits its maximised state.
      if (!state.panelOpen) {
        state.panelMaximized = false;
      }
    } else if (commandId === "workbench.action.toggleMaximizedPanel") {
      // Maximising opens the panel if it was closed; restoring keeps it open.
      state.panelMaximized = !state.panelMaximized;
      state.panelOpen = true;
    }
    pushState();
  };

  const connect = () => {
    if (disposed) return;
    const target = resolveControlTarget();
    if (!target) {
      log("no control target resolvable; will retry");
      scheduleReconnect();
      return;
    }
    // Dial the broker on a guaranteed-unpatched socket. @vscode/proxy-agent
    // mutates `net`, and in practice the stashed `net.__vscodeOriginal.connect`
    // ALSO deferred the dial behind system-certificate loading — the socket sat
    // `pending` forever with no connect/error event (confirmed via lsof: broker
    // LISTENing, ext host alive, yet no ESTABLISHED connection). Constructing a
    // bare `net.Socket` and invoking `Socket.prototype.connect` on the instance
    // bypasses the module-level patch.
    let sock;
    try {
      sock = new net.Socket();
      net.Socket.prototype.connect.call(sock, { host: "127.0.0.1", port: target.port });
      trace(`control: dialing via Socket.prototype.connect, pending=${sock.pending}`);
    } catch (error) {
      log(`connect failed: ${error && error.message ? error.message : error}`);
      scheduleReconnect();
      return;
    }

    socket = sock;
    sock.setNoDelay(true);
    let buffer = "";
    // `settled` keeps the timeout from racing a connect/error that already
    // resolved this dial.
    let settled = false;

    // Hard cap on the dial: the failure we hit was a silent indefinite hang
    // (no connect, no error). If neither fires within 5s, tear the socket down
    // and retry rather than wedging forever.
    const connectTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      log("connect timed out after 5s; destroying socket and retrying");
      try {
        sock.destroy();
      } catch {
        /* ignore */
      }
      if (socket === sock) socket = null;
      scheduleReconnect();
    }, 5000);

    sock.on("connect", () => {
      settled = true;
      clearTimeout(connectTimeout);
      reconnectDelay = 1000;
      authenticated = false;
      log(`control channel connected (port=${target.port})`);
      refreshBranch();
      state.dirtyCount = computeDirtyCount();
      state.autoSaveEnabled = computeAutoSaveEnabled();
      void refreshContainers().then(() => {
        send({ type: "hello", projectId, token: target.token });
        authenticated = true;
        pushState();
      });
    });
    sock.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
        if (!line) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }
        if (parsed && parsed.type === "runCommand" && typeof parsed.commandId === "string") {
          log(`runCommand ${parsed.commandId}`);
          void runCommand(parsed.commandId);
        }
      }
    });
    sock.on("close", () => {
      clearTimeout(connectTimeout);
      settled = true;
      authenticated = false;
      if (socket === sock) {
        socket = null;
      }
      log("control channel closed");
      scheduleReconnect();
    });
    sock.on("error", (error) => {
      clearTimeout(connectTimeout);
      // EPIPE/ECONNREFUSED/ECONNRESET/ETIMEDOUT are the EXPECTED shape of the
      // broker (Electron main) restarting or the socket tearing down — the
      // channel reconnects on its own (scheduleReconnect below). Log those at
      // trace level so they don't masquerade as real errors in the console; only
      // genuinely unexpected failures go to the error log.
      const code = error && error.code;
      const expected =
        code === "EPIPE" ||
        code === "ECONNREFUSED" ||
        code === "ECONNRESET" ||
        code === "ETIMEDOUT";
      const message = error && error.message ? error.message : "unknown";
      if (expected) {
        trace(`control: channel disconnected (${message}); will reconnect`);
      } else {
        log(`control channel error: ${message}`);
      }
      try {
        sock.destroy();
      } catch {
        /* ignore */
      }
      if (!settled) {
        settled = true;
        if (socket === sock) socket = null;
        scheduleReconnect();
      }
    });
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    // Cap at 5s so a workbench recovers reasonably fast after the main process
    // restarts on a new port (it re-reads the URL file on each attempt).
    reconnectDelay = Math.min(reconnectDelay * 2, 5000);
  };

  // Keep derived state fresh from editor / save / git activity.
  const recomputeDirty = () => {
    const next = computeDirtyCount();
    if (next !== state.dirtyCount) {
      state.dirtyCount = next;
      pushState();
    }
  };

  const containerInterval = setInterval(() => {
    void refreshContainers();
  }, 5000);

  const extensionChangeSub = vscode.extensions.onDidChange(() => {
    void refreshContainers();
  });

  const configChangeSub = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("files.autoSave")) {
      const next = computeAutoSaveEnabled();
      if (next !== state.autoSaveEnabled) {
        state.autoSaveEnabled = next;
        pushState();
      }
    }
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(recomputeDirty),
    vscode.workspace.onDidSaveTextDocument(recomputeDirty),
    vscode.workspace.onDidOpenTextDocument(recomputeDirty),
    vscode.workspace.onDidCloseTextDocument(recomputeDirty),
    extensionChangeSub,
    configChangeSub,
    {
      dispose() {
        clearInterval(containerInterval);
        if (activeWatcher) {
          try {
            activeWatcher.close();
          } catch {
            /* ignore */
          }
          activeWatcher = null;
        }
      },
    },
  );

  connect();
}

function readStoredTool(context) {
  const stored = context.workspaceState.get("tabs.activeTool");
  return typeof stored === "string" && TOOL_IDS.includes(stored) ? stored : "agents";
}

function createShellController(context) {
  /** @type {"code" | "agents" | "server" | "git" | "browser"} */
  let activeTool = readStoredTool(context);

  const update = () => {
    if (!shellPanel) {
      return;
    }
    shellPanel.title = "Tabs";
    shellPanel.webview.html = renderShellHtml(shellPanel.webview, {
      activeTool,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
      appUrl: resolveAppUrl(),
      wsUrl: resolveWsUrl(),
    });
  };

  const handleNativeTool = async (tool) => {
    if (tool === "code") {
      await vscode.commands.executeCommand("tabs.focusCode");
      return;
    }
    if (tool === "git") {
      await vscode.commands.executeCommand("tabs.focusGit");
    }
  };

  const ensurePanel = (tool) => {
    if (shellPanel) {
      return shellPanel;
    }

    shellPanel = vscode.window.createWebviewPanel(
      PANEL_VIEW_TYPE,
      "Tabs",
      {
        preserveFocus: true,
        viewColumn: vscode.ViewColumn.Beside,
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    shellPanel.onDidDispose(
      () => {
        shellPanel = null;
      },
      null,
      context.subscriptions,
    );

    shellPanel.webview.onDidReceiveMessage(
      async (message) => {
        if (!message || typeof message !== "object") {
          return;
        }
        if (
          message.type === "setTool" &&
          typeof message.tool === "string" &&
          TOOL_IDS.includes(message.tool)
        ) {
          activeTool = /** @type {any} */ (message.tool);
          await context.workspaceState.update("tabs.activeTool", activeTool);
          if (!EMBEDDED_TOOL_IDS.has(activeTool)) {
            await handleNativeTool(activeTool);
          }
          update();
          return;
        }
        if (message.type === "openFolder") {
          await vscode.commands.executeCommand("workbench.action.files.openFolder");
        }
      },
      null,
      context.subscriptions,
    );

    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => update()));

    activeTool = tool;
    update();
    return shellPanel;
  };

  return {
    show(tool) {
      activeTool = TOOL_IDS.includes(tool) ? tool : activeTool;
      context.workspaceState.update("tabs.activeTool", activeTool);
      const panel = ensurePanel(activeTool);
      panel.reveal(vscode.ViewColumn.Beside, true);
      if (!EMBEDDED_TOOL_IDS.has(activeTool)) {
        void handleNativeTool(activeTool);
      }
      update();
    },
    dispose() {
      if (shellPanel) {
        shellPanel.dispose();
        shellPanel = null;
      }
    },
  };
}

function resolveAppUrl() {
  const explicit = process.env.TABS_WEB_APP_URL;
  if (explicit && explicit.length > 0) {
    return explicit.replace(/\/+$/, "");
  }
  const httpOrigin = process.env.TABS_DESKTOP_HTTP_URL;
  if (httpOrigin && httpOrigin.length > 0) {
    return httpOrigin.replace(/\/+$/, "");
  }
  return "";
}

function resolveWsUrl() {
  const explicit = process.env.TABS_DESKTOP_WS_URL;
  return explicit && explicit.length > 0 ? explicit : "";
}

function buildEmbeddedToolUrl({ appUrl, tool, workspaceRoot, wsUrl }) {
  if (!appUrl) {
    return "";
  }
  const url = new URL(appUrl);
  url.searchParams.set("embed", "1");
  url.searchParams.set("tool", tool);
  if (workspaceRoot) {
    url.searchParams.set("workspaceRoot", workspaceRoot);
  }
  if (wsUrl) {
    url.searchParams.set("tabsWsUrl", wsUrl);
  }
  return url.toString();
}

function renderShellHtml(_webview, state) {
  const iframeSrc = EMBEDDED_TOOL_IDS.has(state.activeTool)
    ? buildEmbeddedToolUrl({
        appUrl: state.appUrl,
        tool: state.activeTool,
        workspaceRoot: state.workspaceRoot,
        wsUrl: state.wsUrl,
      })
    : "";

  const noWorkspace = state.workspaceRoot.length === 0;
  const noAppUrl = state.appUrl.length === 0;
  const content = noAppUrl
    ? `
      <div class="empty">
        <h2>Tabs panel unavailable</h2>
        <p>The embedded Tabs app URL was not provided to the Code-OSS integration layer.</p>
      </div>
    `
    : noWorkspace
      ? `
        <div class="empty">
          <h2>Open a folder to start</h2>
          <p>Code-OSS is now the primary shell. Open a workspace folder, then the Tabs panel will attach to it.</p>
          <button class="primary" data-action="openFolder">Open Folder</button>
        </div>
      `
      : EMBEDDED_TOOL_IDS.has(state.activeTool)
        ? `<iframe class="frame" src="${escapeHtmlAttribute(iframeSrc)}" allow="clipboard-read; clipboard-write"></iframe>`
        : `
          <div class="empty">
            <h2>${state.activeTool === "code" ? "Native Code view active" : "Native Git view active"}</h2>
            <p>${
              state.activeTool === "code"
                ? "The main workbench is now the real Code-OSS editor. Use the native editor and explorer in the main window."
                : "Git now uses VS Code Source Control as the default experience."
            }</p>
          </div>
        `;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src http: https:; img-src data: https: http:;" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        :root {
          color-scheme: dark light;
          font-family: var(--vscode-font-family);
        }
        body {
          margin: 0;
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
        }
        .shell {
          display: flex;
          min-height: 100vh;
          flex-direction: column;
        }
        .tabs {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-bottom: 1px solid var(--vscode-panel-border);
          background: color-mix(in srgb, var(--vscode-sideBar-background) 85%, transparent);
        }
        .tab {
          border: 1px solid transparent;
          background: transparent;
          color: var(--vscode-foreground);
          border-radius: 999px;
          padding: 6px 12px;
          cursor: pointer;
          font: inherit;
        }
        .tab:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }
        .tab[data-active="true"] {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
        .content {
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .frame {
          border: 0;
          width: 100%;
          min-height: 0;
          flex: 1;
          background: var(--vscode-editor-background);
        }
        .empty {
          display: flex;
          flex: 1;
          min-height: 0;
          padding: 32px;
          gap: 12px;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
        }
        .empty h2 {
          margin: 0;
          font-size: 20px;
        }
        .empty p {
          margin: 0;
          max-width: 52ch;
          line-height: 1.5;
          color: var(--vscode-descriptionForeground);
        }
        .primary {
          border: 0;
          border-radius: 8px;
          padding: 8px 14px;
          cursor: pointer;
          font: inherit;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="tabs">
          ${TOOL_IDS.map(
            (tool) => `
              <button class="tab" data-tool="${tool}" data-active="${tool === state.activeTool ? "true" : "false"}">
                ${tool[0].toUpperCase()}${tool.slice(1)}
              </button>
            `,
          ).join("")}
        </div>
        <div class="content">${content}</div>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        document.querySelectorAll("[data-tool]").forEach((button) => {
          button.addEventListener("click", () => {
            vscode.postMessage({ type: "setTool", tool: button.getAttribute("data-tool") });
          });
        });
        document.querySelectorAll("[data-action='openFolder']").forEach((button) => {
          button.addEventListener("click", () => {
            vscode.postMessage({ type: "openFolder" });
          });
        });
      </script>
    </body>
  </html>`;
}

function escapeHtmlAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = {
  activate,
  deactivate,
  registeredViewContainerCommands,
  commandToContainerId,
};
