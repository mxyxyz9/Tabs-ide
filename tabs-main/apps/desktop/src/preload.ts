import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "@tabs/contracts";

const PICK_FOLDER_CHANNEL = "desktop:pick-folder";
const CLONE_REPOSITORY_CHANNEL = "desktop:clone-repository";
const PICK_FILE_CHANNEL = "desktop:pick-file";
const CONFIRM_CHANNEL = "desktop:confirm";
const SET_THEME_CHANNEL = "desktop:set-theme";
const SET_ICON_THEME_CHANNEL = "desktop:set-icon-theme";
const SET_AI_PROVIDER_CHANNEL = "desktop:set-ai-provider";
const SET_ZOOM_FACTOR_CHANNEL = "desktop:set-zoom-factor";
const CONTEXT_MENU_CHANNEL = "desktop:context-menu";
const OPEN_EXTERNAL_CHANNEL = "desktop:open-external";
const MENU_ACTION_CHANNEL = "desktop:menu-action";
const APP_CLOSING_CHANNEL = "desktop:app-closing";
const QUIT_CONFIRMATION_REQUEST_CHANNEL = "desktop:quit-confirmation-request";
const QUIT_CONFIRMATION_RESPONSE_CHANNEL = "desktop:quit-confirmation-response";
const GET_CONFIRM_BEFORE_QUIT_CHANNEL = "desktop:get-confirm-before-quit";
const SET_CONFIRM_BEFORE_QUIT_CHANNEL = "desktop:set-confirm-before-quit";
const APP_CLEANUP_DONE_CHANNEL = "desktop:app-cleanup-done";
const APP_READY_TO_EXIT_CHANNEL = "desktop:app-ready-to-exit";
const UPDATE_STATE_CHANNEL = "desktop:update-state";
const UPDATE_GET_STATE_CHANNEL = "desktop:update-get-state";
const UPDATE_DOWNLOAD_CHANNEL = "desktop:update-download";
const UPDATE_INSTALL_CHANNEL = "desktop:update-install";
const GET_WS_URL_CHANNEL = "desktop:get-ws-url";
const GET_LOCAL_ENVIRONMENT_BOOTSTRAPS_CHANNEL = "desktop:get-local-environment-bootstraps";
const GET_CONNECTION_CATALOG_CHANNEL = "desktop:get-connection-catalog";
const SET_CONNECTION_CATALOG_CHANNEL = "desktop:set-connection-catalog";
const CLEAR_CONNECTION_CATALOG_CHANNEL = "desktop:clear-connection-catalog";
const DISCOVER_SSH_HOSTS_CHANNEL = "desktop:discover-ssh-hosts";
const ENSURE_SSH_ENVIRONMENT_CHANNEL = "desktop:ensure-ssh-environment";
const DISCONNECT_SSH_ENVIRONMENT_CHANNEL = "desktop:disconnect-ssh-environment";
const FETCH_SSH_ENVIRONMENT_DESCRIPTOR_CHANNEL = "desktop:fetch-ssh-environment-descriptor";
const BOOTSTRAP_SSH_BEARER_SESSION_CHANNEL = "desktop:bootstrap-ssh-bearer-session";
const FETCH_SSH_SESSION_STATE_CHANNEL = "desktop:fetch-ssh-session-state";
const ISSUE_SSH_WEBSOCKET_TOKEN_CHANNEL = "desktop:issue-ssh-websocket-token";
const SSH_PASSWORD_PROMPT_CHANNEL = "desktop:ssh-password-prompt";
const RESOLVE_SSH_PASSWORD_PROMPT_CHANNEL = "desktop:resolve-ssh-password-prompt";
const SYSTEM_RESUME_CHANNEL = "desktop:system-resume";
const HOST_POWER_GET_CHANNEL = "desktop:host-power:get";
const HOST_POWER_CHANGED_CHANNEL = "desktop:host-power:changed";
const CODE_HOST_GET_STATE_CHANNEL = "desktop:code-host:get-state";
const CODE_HOST_ENSURE_SESSION_CHANNEL = "desktop:code-host:ensure-session";
const CODE_HOST_ACTIVATE_SESSION_CHANNEL = "desktop:code-host:activate-session";
const CODE_HOST_HIDE_SESSION_CHANNEL = "desktop:code-host:hide-session";
const CODE_HOST_OPEN_FILE_CHANNEL = "desktop:code-host:open-file";
const CODE_HOST_SET_BOUNDS_CHANNEL = "desktop:code-host:set-bounds";
const CODE_HOST_SYNC_SESSIONS_CHANNEL = "desktop:code-host:sync-sessions";
const CODE_HOST_RUN_COMMAND_CHANNEL = "vscode:tabs-code-host:run-command";
const CODE_HOST_GET_CHROME_STATE_CHANNEL = "desktop:code-host:get-chrome-state";
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
const BROWSER_HOST_AUTOMATION_CHANNEL = "desktop:browser-host:automation";
const BROWSER_HOST_CAPTURE_SCREENSHOT_CHANNEL = "desktop:browser-host:capture-screenshot";
const BROWSER_HOST_MEDIA_SOURCE_CHANNEL = "desktop:browser-host:media-source";
const BROWSER_HOST_SAVE_RECORDING_CHANNEL = "desktop:browser-host:save-recording";
const BROWSER_HOST_REVEAL_ARTIFACT_CHANNEL = "desktop:browser-host:reveal-artifact";
const BROWSER_HOST_COPY_ARTIFACT_CHANNEL = "desktop:browser-host:copy-artifact";
const BROWSER_HOST_SET_BOUNDS_CHANNEL = "desktop:browser-host:set-bounds";
const BROWSER_HOST_SYNC_SESSIONS_CHANNEL = "desktop:browser-host:sync-sessions";
const BROWSER_HOST_SESSION_STATE_CHANNEL = "desktop:browser-host:session-state";
const CODE_HOST_RECREATE_SESSION_CHANNEL = "desktop:code-host:recreate-session";
const BROWSER_HOST_RECREATE_SESSION_CHANNEL = "desktop:browser-host:recreate-session";
const BROWSER_HOST_CLEAR_PROFILE_DATA_CHANNEL = "desktop:browser-host:clear-profile-data";
const BROWSER_HOST_OPEN_PROFILE_LOGIN_WINDOW_CHANNEL =
  "desktop:browser-host:open-profile-login-window";
const BROWSER_HOST_GET_PROFILE_DOMAINS_CHANNEL = "desktop:browser-host:get-profile-domains";
const BROWSER_HOST_CLEAR_PROFILE_DOMAIN_CHANNEL = "desktop:browser-host:clear-profile-domain";
const BROWSER_HOST_PROFILE_DATA_CHANGED_CHANNEL = "desktop:browser-host:profile-data-changed";

// Persistence channels
const GET_PERSISTED_ITEM_CHANNEL = "desktop:get-persisted-item";
const SET_PERSISTED_ITEM_CHANNEL = "desktop:set-persisted-item";
const REMOVE_PERSISTED_ITEM_CHANNEL = "desktop:remove-persisted-item";

contextBridge.exposeInMainWorld("desktopBridge", {
  getClientPlatform: () => process.platform,
  getLocalEnvironmentBootstraps: () => {
    const result = ipcRenderer.sendSync(GET_LOCAL_ENVIRONMENT_BOOTSTRAPS_CHANNEL);
    return Array.isArray(result) ? result : [];
  },
  getConnectionCatalog: () => ipcRenderer.invoke(GET_CONNECTION_CATALOG_CHANNEL),
  setConnectionCatalog: (catalog: string) =>
    ipcRenderer.invoke(SET_CONNECTION_CATALOG_CHANNEL, catalog),
  clearConnectionCatalog: () => ipcRenderer.invoke(CLEAR_CONNECTION_CATALOG_CHANNEL),
  discoverSshHosts: () => ipcRenderer.invoke(DISCOVER_SSH_HOSTS_CHANNEL),
  ensureSshEnvironment: async (target, options) => {
    const result = await ipcRenderer.invoke(ENSURE_SSH_ENVIRONMENT_CHANNEL, {
      target,
      options,
    });
    if (result?.type === "ssh-password-prompt-cancelled") {
      throw new Error(result.message ?? "SSH authentication cancelled.");
    }
    return result;
  },
  disconnectSshEnvironment: (target) =>
    ipcRenderer.invoke(DISCONNECT_SSH_ENVIRONMENT_CHANNEL, target),
  fetchSshEnvironmentDescriptor: (httpBaseUrl) =>
    ipcRenderer.invoke(FETCH_SSH_ENVIRONMENT_DESCRIPTOR_CHANNEL, {
      httpBaseUrl,
    }),
  bootstrapSshBearerSession: (httpBaseUrl, credential) =>
    ipcRenderer.invoke(BOOTSTRAP_SSH_BEARER_SESSION_CHANNEL, {
      httpBaseUrl,
      credential,
    }),
  fetchSshSessionState: (httpBaseUrl, bearerToken) =>
    ipcRenderer.invoke(FETCH_SSH_SESSION_STATE_CHANNEL, {
      httpBaseUrl,
      bearerToken,
    }),
  issueSshWebSocketTicket: (httpBaseUrl, bearerToken) =>
    ipcRenderer.invoke(ISSUE_SSH_WEBSOCKET_TOKEN_CHANNEL, {
      httpBaseUrl,
      bearerToken,
    }),
  onSshPasswordPrompt: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, request: unknown) => {
      if (typeof request === "object" && request !== null) {
        listener(request as Parameters<typeof listener>[0]);
      }
    };
    ipcRenderer.on(SSH_PASSWORD_PROMPT_CHANNEL, wrapped);
    return () => ipcRenderer.removeListener(SSH_PASSWORD_PROMPT_CHANNEL, wrapped);
  },
  resolveSshPasswordPrompt: (requestId, password) =>
    ipcRenderer.invoke(RESOLVE_SSH_PASSWORD_PROMPT_CHANNEL, {
      requestId,
      password,
    }),
  onSystemResume: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on(SYSTEM_RESUME_CHANNEL, wrapped);
    return () => ipcRenderer.removeListener(SYSTEM_RESUME_CHANNEL, wrapped);
  },
  getHostPowerSnapshot: () => ipcRenderer.invoke(HOST_POWER_GET_CHANNEL),
  onHostPowerSnapshot: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, snapshot: unknown) =>
      listener(snapshot as Parameters<typeof listener>[0]);
    ipcRenderer.on(HOST_POWER_CHANGED_CHANNEL, wrapped);
    return () => ipcRenderer.removeListener(HOST_POWER_CHANGED_CHANNEL, wrapped);
  },
  getWsUrl: () => {
    const result = ipcRenderer.sendSync(GET_WS_URL_CHANNEL);
    return typeof result === "string" ? result : null;
  },
  pickFolder: (options) => ipcRenderer.invoke(PICK_FOLDER_CHANNEL, options),
  cloneRepository: (input) => ipcRenderer.invoke(CLONE_REPOSITORY_CHANNEL, input),
  pickFile: (options) => ipcRenderer.invoke(PICK_FILE_CHANNEL, options),
  confirm: (message) => ipcRenderer.invoke(CONFIRM_CHANNEL, message),
  setTheme: (theme) => ipcRenderer.invoke(SET_THEME_CHANNEL, theme),
  setIconTheme: (theme) => ipcRenderer.invoke(SET_ICON_THEME_CHANNEL, theme),
  setAiProvider: (provider) => ipcRenderer.invoke(SET_AI_PROVIDER_CHANNEL, provider),
  setZoomFactor: (factor) => ipcRenderer.invoke(SET_ZOOM_FACTOR_CHANNEL, factor),
  showContextMenu: (items, position) => ipcRenderer.invoke(CONTEXT_MENU_CHANNEL, items, position),
  openExternal: (url: string) => ipcRenderer.invoke(OPEN_EXTERNAL_CHANNEL, url),
  onMenuAction: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, action: unknown) => {
      if (typeof action !== "string") return;
      listener(action);
    };

    ipcRenderer.on(MENU_ACTION_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(MENU_ACTION_CHANNEL, wrappedListener);
    };
  },
  getUpdateState: () => ipcRenderer.invoke(UPDATE_GET_STATE_CHANNEL),
  downloadUpdate: () => ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL),
  installUpdate: () => ipcRenderer.invoke(UPDATE_INSTALL_CHANNEL),
  getCodeHostState: () => ipcRenderer.invoke(CODE_HOST_GET_STATE_CHANNEL),
  ensureCodeSession: (input) => ipcRenderer.invoke(CODE_HOST_ENSURE_SESSION_CHANNEL, input),
  activateCodeSession: (input) => ipcRenderer.invoke(CODE_HOST_ACTIVATE_SESSION_CHANNEL, input),
  hideCodeSession: () => ipcRenderer.invoke(CODE_HOST_HIDE_SESSION_CHANNEL),
  openCodeFile: (input) => ipcRenderer.invoke(CODE_HOST_OPEN_FILE_CHANNEL, input),
  setCodeBounds: (input) => ipcRenderer.invoke(CODE_HOST_SET_BOUNDS_CHANNEL, input),
  syncCodeSessions: (projectIds) => ipcRenderer.invoke(CODE_HOST_SYNC_SESSIONS_CHANNEL, projectIds),
  recreateCodeSession: (input) => ipcRenderer.invoke(CODE_HOST_RECREATE_SESSION_CHANNEL, input),
  runCodeCommand: (projectId: string, commandId: string) =>
    ipcRenderer.invoke(CODE_HOST_RUN_COMMAND_CHANNEL, { projectId, commandId }),
  getCodeChromeState: (input: { projectId: string }) =>
    ipcRenderer.invoke(CODE_HOST_GET_CHROME_STATE_CHANNEL, input),
  onCodeChromeState: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      if (typeof state !== "object" || state === null) return;
      listener(state as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(CODE_HOST_CHROME_STATE_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(CODE_HOST_CHROME_STATE_CHANNEL, wrappedListener);
    };
  },
  getBrowserHostState: () => ipcRenderer.invoke(BROWSER_HOST_GET_STATE_CHANNEL),
  getBrowserSessionState: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_GET_SESSION_STATE_CHANNEL, input),
  ensureBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_ENSURE_SESSION_CHANNEL, input),
  activateBrowserSession: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_ACTIVATE_SESSION_CHANNEL, input),
  hideBrowserSession: () => ipcRenderer.invoke(BROWSER_HOST_HIDE_SESSION_CHANNEL),
  navigateBrowserSession: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_NAVIGATE_SESSION_CHANNEL, input),
  reloadBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_RELOAD_SESSION_CHANNEL, input),
  goBackBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_BACK_SESSION_CHANNEL, input),
  goForwardBrowserSession: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_FORWARD_SESSION_CHANNEL, input),
  toggleBrowserDevTools: (input) => ipcRenderer.invoke(BROWSER_HOST_TOGGLE_DEVTOOLS_CHANNEL, input),
  runBrowserAutomation: (input) => ipcRenderer.invoke(BROWSER_HOST_AUTOMATION_CHANNEL, input),
  captureBrowserScreenshot: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_CAPTURE_SCREENSHOT_CHANNEL, input),
  getBrowserMediaSourceId: (input) => ipcRenderer.invoke(BROWSER_HOST_MEDIA_SOURCE_CHANNEL, input),
  saveBrowserRecording: (input) => ipcRenderer.invoke(BROWSER_HOST_SAVE_RECORDING_CHANNEL, input),
  revealBrowserArtifact: (path) => ipcRenderer.invoke(BROWSER_HOST_REVEAL_ARTIFACT_CHANNEL, path),
  copyBrowserArtifactToClipboard: (path) =>
    ipcRenderer.invoke(BROWSER_HOST_COPY_ARTIFACT_CHANNEL, path),
  setBrowserBounds: (input) => ipcRenderer.invoke(BROWSER_HOST_SET_BOUNDS_CHANNEL, input),
  syncBrowserSessions: (projectIds) =>
    ipcRenderer.invoke(BROWSER_HOST_SYNC_SESSIONS_CHANNEL, projectIds),
  recreateBrowserSession: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_RECREATE_SESSION_CHANNEL, input),
  clearBrowserProfileData: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_CLEAR_PROFILE_DATA_CHANNEL, input),
  openBrowserProfileLoginWindow: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_OPEN_PROFILE_LOGIN_WINDOW_CHANNEL, input),
  getBrowserProfileDomains: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_GET_PROFILE_DOMAINS_CHANNEL, input),
  clearBrowserProfileDomain: (input) =>
    ipcRenderer.invoke(BROWSER_HOST_CLEAR_PROFILE_DOMAIN_CHANNEL, input),
  onBrowserProfileDataChanged: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, profileId: unknown) => {
      if (typeof profileId === "string") listener(profileId);
    };
    ipcRenderer.on(BROWSER_HOST_PROFILE_DATA_CHANGED_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(BROWSER_HOST_PROFILE_DATA_CHANGED_CHANNEL, wrappedListener);
    };
  },
  onBrowserSessionState: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      if (typeof state !== "object" || state === null) return;
      listener(state as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(BROWSER_HOST_SESSION_STATE_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(BROWSER_HOST_SESSION_STATE_CHANNEL, wrappedListener);
    };
  },
  onUpdateState: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      if (typeof state !== "object" || state === null) return;
      listener(state as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(UPDATE_STATE_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(UPDATE_STATE_CHANNEL, wrappedListener);
    };
  },

  // Persistence methods
  getPersistedItem: (key: string) => {
    return ipcRenderer.invoke(GET_PERSISTED_ITEM_CHANNEL, key);
  },

  setPersistedItem: (key: string, value: string) => {
    return ipcRenderer.invoke(SET_PERSISTED_ITEM_CHANNEL, key, value);
  },

  removePersistedItem: (key: string) => {
    return ipcRenderer.invoke(REMOVE_PERSISTED_ITEM_CHANNEL, key);
  },

  getTailscaleStatus: () => {
    return ipcRenderer.invoke("get-tailscale-status");
  },
  onAppClosing: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on(APP_CLOSING_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(APP_CLOSING_CHANNEL, wrapped);
    };
  },
  getConfirmBeforeQuit: () => ipcRenderer.invoke(GET_CONFIRM_BEFORE_QUIT_CHANNEL),
  setConfirmBeforeQuit: (value: boolean) =>
    ipcRenderer.invoke(SET_CONFIRM_BEFORE_QUIT_CHANNEL, value),
  onQuitConfirmationRequested: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on(QUIT_CONFIRMATION_REQUEST_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(QUIT_CONFIRMATION_REQUEST_CHANNEL, wrapped);
    };
  },
  respondToQuitConfirmation: (choice) => {
    ipcRenderer.send(QUIT_CONFIRMATION_RESPONSE_CHANNEL, choice);
  },
  onAppCleanupDone: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on(APP_CLEANUP_DONE_CHANNEL, wrapped);
    return () => {
      ipcRenderer.removeListener(APP_CLEANUP_DONE_CHANNEL, wrapped);
    };
  },
  notifyReadyToExit: () => {
    ipcRenderer.send(APP_READY_TO_EXIT_CHANNEL);
    return Promise.resolve();
  },
} satisfies DesktopBridge);
