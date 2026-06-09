"use strict";

const vscode = require("vscode");

const PANEL_VIEW_TYPE = "tabs.shell";
const TOOL_IDS = ["code", "agents", "server", "git", "browser"];
const EMBEDDED_TOOL_IDS = new Set(["agents", "server", "browser"]);
const EMBED_CHROME_DEFAULTS = {
  "workbench.activityBar.location": "hidden",
  "workbench.activityBar.visible": false,
  "workbench.statusBar.visible": false,
  "window.menuBarVisibility": "hidden",
  "window.titleBarStyle": "native",
  "window.customTitleBarVisibility": "never",
  "workbench.layoutControl.enabled": false,
  "window.commandCenter": false,
  "workbench.startupEditor": "none",
  "workbench.welcomePage.walkthroughs.openOnInstall": false,
  "workbench.welcome.enabled": false,
  "workbench.tips.enabled": false,
  "workbench.editor.empty.hint": "hidden",
  "security.workspace.trust.enabled": false,
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
  "workbench.action.quickOpen",
  "workbench.action.openSettings",
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

/** @type {vscode.WebviewPanel | null} */
let shellPanel = null;
/** @type {ReturnType<typeof createShellController> | null} */
let shellController = null;

function activate(context) {
  void applyEmbedChromeDefaults();
  shellController = createShellController(context);
  context.subscriptions.push(shellController);
  startCodeControlChannel(context);
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
  const url = process.env.TABS_CODE_CONTROL_URL;
  const WS = globalThis.WebSocket;
  // Diagnostics surface in the remote ext host log; prefixed for grep-ability.
  const log = (message) => console.error(`[tabs-control] ${message}`);
  if (!url) {
    log("no TABS_CODE_CONTROL_URL in env; chrome control channel disabled");
    return;
  }
  if (typeof WS !== "function") {
    log("globalThis.WebSocket unavailable; chrome control channel disabled");
    return;
  }
  log(`starting control channel → ${url.replace(/token=[^&]+/, "token=…")}`);

  /** @type {{ activeViewId: string | null, panelOpen: boolean, dirtyCount: number, branch: string | null }} */
  const state = { activeViewId: null, panelOpen: false, dirtyCount: 0, branch: null };
  let socket = null;
  let disposed = false;
  let reconnectTimer = null;
  let reconnectDelay = 1000;

  const send = (message) => {
    if (socket && socket.readyState === 1 /* OPEN */) {
      try {
        socket.send(JSON.stringify(message));
      } catch {
        /* ignore */
      }
    }
  };
  const pushState = () => send({ type: "chromeState", state: { ...state } });

  const computeDirtyCount = () =>
    vscode.workspace.textDocuments.filter((doc) => doc.isDirty).length;

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

  const runCommand = async (commandId) => {
    if (!CHROME_COMMAND_ALLOWLIST.has(commandId)) {
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
    } else if (commandId === "workbench.action.toggleSidebarVisibility") {
      state.activeViewId = state.activeViewId === null ? "explorer" : null;
    } else if (
      commandId === "workbench.action.togglePanel" ||
      commandId === "workbench.action.terminal.toggleTerminal"
    ) {
      state.panelOpen = !state.panelOpen;
    }
    pushState();
  };

  const connect = () => {
    if (disposed) return;
    let ws;
    try {
      ws = new WS(url);
    } catch {
      scheduleReconnect();
      return;
    }
    socket = ws;
    ws.addEventListener("open", () => {
      reconnectDelay = 1000;
      log("control channel connected");
      refreshBranch();
      state.dirtyCount = computeDirtyCount();
      send({ type: "hello" });
      pushState();
    });
    ws.addEventListener("message", (event) => {
      let parsed;
      try {
        parsed = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
      } catch {
        return;
      }
      if (parsed && parsed.type === "runCommand" && typeof parsed.commandId === "string") {
        log(`runCommand ${parsed.commandId}`);
        void runCommand(parsed.commandId);
      }
    });
    ws.addEventListener("close", () => {
      socket = null;
      scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 15000);
  };

  // Keep derived state fresh from editor / save / git activity.
  const recomputeDirty = () => {
    const next = computeDirtyCount();
    if (next !== state.dirtyCount) {
      state.dirtyCount = next;
      pushState();
    }
  };
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(recomputeDirty),
    vscode.workspace.onDidSaveTextDocument(recomputeDirty),
    vscode.workspace.onDidOpenTextDocument(recomputeDirty),
    vscode.workspace.onDidCloseTextDocument(recomputeDirty),
  );
  try {
    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (gitExtension) {
      void gitExtension.activate().then(() => {
        refreshBranch();
        pushState();
        try {
          const api = gitExtension.exports.getAPI(1);
          const repo = api && api.repositories && api.repositories[0];
          if (repo && typeof repo.state.onDidChange === "function") {
            context.subscriptions.push(
              repo.state.onDidChange(() => {
                refreshBranch();
                pushState();
              }),
            );
          }
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* ignore */
  }

  context.subscriptions.push({
    dispose() {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        socket = null;
      }
    },
  });

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
};
