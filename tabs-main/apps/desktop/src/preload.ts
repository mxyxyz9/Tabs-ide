import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "@tabs/contracts";

const PICK_FOLDER_CHANNEL = "desktop:pick-folder";
const CONFIRM_CHANNEL = "desktop:confirm";
const SET_THEME_CHANNEL = "desktop:set-theme";
const SET_ICON_THEME_CHANNEL = "desktop:set-icon-theme";
const CONTEXT_MENU_CHANNEL = "desktop:context-menu";
const OPEN_EXTERNAL_CHANNEL = "desktop:open-external";
const MENU_ACTION_CHANNEL = "desktop:menu-action";
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
const BROWSER_HOST_SESSION_STATE_CHANNEL = "desktop:browser-host:session-state";

contextBridge.exposeInMainWorld("desktopBridge", {
  getWsUrl: () => {
    const result = ipcRenderer.sendSync(GET_WS_URL_CHANNEL);
    return typeof result === "string" ? result : null;
  },
  pickFolder: () => ipcRenderer.invoke(PICK_FOLDER_CHANNEL),
  confirm: (message) => ipcRenderer.invoke(CONFIRM_CHANNEL, message),
  setTheme: (theme) => ipcRenderer.invoke(SET_THEME_CHANNEL, theme),
  setIconTheme: (theme) => ipcRenderer.invoke(SET_ICON_THEME_CHANNEL, theme),
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
  getBrowserHostState: () => ipcRenderer.invoke(BROWSER_HOST_GET_STATE_CHANNEL),
  getBrowserSessionState: (input) => ipcRenderer.invoke(BROWSER_HOST_GET_SESSION_STATE_CHANNEL, input),
  ensureBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_ENSURE_SESSION_CHANNEL, input),
  activateBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_ACTIVATE_SESSION_CHANNEL, input),
  hideBrowserSession: () => ipcRenderer.invoke(BROWSER_HOST_HIDE_SESSION_CHANNEL),
  navigateBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_NAVIGATE_SESSION_CHANNEL, input),
  reloadBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_RELOAD_SESSION_CHANNEL, input),
  goBackBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_BACK_SESSION_CHANNEL, input),
  goForwardBrowserSession: (input) => ipcRenderer.invoke(BROWSER_HOST_FORWARD_SESSION_CHANNEL, input),
  toggleBrowserDevTools: (input) => ipcRenderer.invoke(BROWSER_HOST_TOGGLE_DEVTOOLS_CHANNEL, input),
  setBrowserBounds: (input) => ipcRenderer.invoke(BROWSER_HOST_SET_BOUNDS_CHANNEL, input),
  syncBrowserSessions: (projectIds) =>
    ipcRenderer.invoke(BROWSER_HOST_SYNC_SESSIONS_CHANNEL, projectIds),
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
} satisfies DesktopBridge);
