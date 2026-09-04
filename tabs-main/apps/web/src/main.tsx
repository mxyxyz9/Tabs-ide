import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { ClerkProvider as ElectronClerkProvider } from "@clerk/electron/react";
import { passkeys } from "@clerk/electron/passkeys";
import { createHashHistory, createBrowserHistory } from "@tanstack/react-router";

import "@xterm/xterm/css/xterm.css";
import "@vscode/codicons/dist/codicon.css";
import "./localFonts.css";
import "./index.css";

import { isElectron } from "./env";
import { getRouter } from "./router";
import { APP_DISPLAY_NAME } from "./branding";
import { AppRoot } from "./AppRoot";
import { ManagedRelayAuthProvider } from "./cloud/managedAuth";
import { hasCloudPublicConfig, resolveCloudPublicConfig } from "./cloud/publicConfig";

// Electron loads the app from a file-backed shell, so hash history avoids path resolution issues.
const history = isElectron ? createHashHistory() : createBrowserHistory();

const router = getRouter(history);

document.title = APP_DISPLAY_NAME;

import { initializeComposerDraftsState } from "./state/composerDrafts";
import { initializeWorkspaceShellState } from "./state/workspaceShell";

// Hydrate and subscribe atoms to Zustand stores before mounting React.
initializeComposerDraftsState();
initializeWorkspaceShellState();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {hasCloudPublicConfig() ? (
      isElectron ? (
        <ElectronClerkProvider
          publishableKey={resolveCloudPublicConfig().clerkPublishableKey!}
          passkeys={passkeys}
        >
          <ManagedRelayAuthProvider>
            <AppRoot router={router} />
          </ManagedRelayAuthProvider>
        </ElectronClerkProvider>
      ) : (
        <ClerkProvider publishableKey={resolveCloudPublicConfig().clerkPublishableKey!}>
          <ManagedRelayAuthProvider>
            <AppRoot router={router} />
          </ManagedRelayAuthProvider>
        </ClerkProvider>
      )
    ) : (
      <AppRoot router={router} />
    )}
  </React.StrictMode>,
);
