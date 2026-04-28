"use strict";

const vscode = require("vscode");

const PANEL_VIEW_TYPE = "tabs.shell";
const TOOL_IDS = ["code", "agents", "server", "git", "browser"];
const EMBEDDED_TOOL_IDS = new Set(["agents", "server", "browser"]);

/** @type {vscode.WebviewPanel | null} */
let shellPanel = null;
/** @type {ReturnType<typeof createShellController> | null} */
let shellController = null;

function activate(context) {
  shellController = createShellController(context);
  context.subscriptions.push(shellController);
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

  void shellController.show(readStoredTool(context));
}

function deactivate() {}

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
        if (message.type === "setTool" && typeof message.tool === "string" && TOOL_IDS.includes(message.tool)) {
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

    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => update()),
    );

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
