import React from "react";
import ReactDOM from "react-dom/client";
import { createHashHistory, createBrowserHistory } from "@tanstack/react-router";

import "@xterm/xterm/css/xterm.css";
import "@vscode/codicons/dist/codicon.css";
import "./localFonts.css";
import "./index.css";

import { isElectron } from "./env";
import { getRouter } from "./router";
import { APP_DISPLAY_NAME } from "./branding";
import { AppRoot } from "./AppRoot";
import { hasCloudPublicConfig, resolveCloudPublicConfig } from "./cloud/publicConfig";
import { initializeComposerDraftsState } from "./state/composerDrafts";
import { initializeWorkspaceShellState } from "./state/workspaceShell";

const history = isElectron ? createHashHistory() : createBrowserHistory();
const router = getRouter(history);
document.title = APP_DISPLAY_NAME;

initializeComposerDraftsState();
initializeWorkspaceShellState();

const publishableKey = resolveCloudPublicConfig().clerkPublishableKey;
const managedAuthShellModule =
  publishableKey && hasCloudPublicConfig()
    ? isElectron
      ? import("./components/auth/ElectronManagedAuthShell")
      : import("./components/auth/BrowserManagedAuthShell")
    : null;

export const startup = Promise.all([
  managedAuthShellModule?.then((module) => module.default) ?? null,
  router.load(),
]).then(([ManagedAuthShell]) => {
  const app = <AppRoot router={router} />;
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      {ManagedAuthShell && publishableKey ? (
        <ManagedAuthShell publishableKey={publishableKey}>{app}</ManagedAuthShell>
      ) : (
        app
      )}
    </React.StrictMode>,
  );
});
