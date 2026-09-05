import { BrowserWindow, nativeTheme, type WebContents } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { rootCertificates } from "node:tls";
import { pathToFileURL } from "node:url";
import * as Path from "node:path";
import * as OS from "node:os";

import { loadNativeCodeHostStorage, saveNativeCodeHostStorage } from "./nativeCodeHostStorage";

type NativeCodeHostModules = {
  registerContextMenuListener(
    resolvePopupContext?: (event: { sender: WebContents }) =>
      | {
          window?: BrowserWindow;
          offsetX?: number;
          offsetY?: number;
        }
      | undefined,
  ): void;
  ElectronIPCServer: new () => {
    registerChannel(name: string, channel: unknown): void;
    dispose(): void;
  };
  ProxyChannel: {
    fromService(service: unknown, disposables: unknown): unknown;
  };
  DisposableStore: new () => {
    add<T>(value: T): T;
    dispose(): void;
  };
  Emitter: new () => {
    event: unknown;
    fire(value: unknown): void;
    dispose(): void;
  };
  EventNone: unknown;
  NullLogService: new () => unknown;
  NullLoggerService: new () => unknown;
  NullTelemetryService: unknown;
  ExtensionHostStarter: new (...args: unknown[]) => {
    dispose(): void;
  };
  DiskFileSystemProvider: new (...args: unknown[]) => {
    dispose(): void;
  };
  DiskFileSystemProviderChannel: new (...args: unknown[]) => {
    dispose(): void;
  };
  FileService: new (...args: unknown[]) => {
    registerProvider(scheme: string, provider: unknown): { dispose(): void };
    dispose(): void;
  };
  WebviewMainService: new (...args: unknown[]) => {
    dispose(): void;
  };
  UtilityProcessWorkerMainService: new (...args: unknown[]) => {
    dispose(): void;
  };
  extensionHostChannelName: string;
  localFileSystemChannelName: string;
  utilityProcessWorkerChannelName: string;
  ElectronPtyHostStarter: new (...args: unknown[]) => { dispose(): void };
  PtyHostService: new (...args: unknown[]) => { dispose(): void };
  TerminalLocalPtyChannelName: string;
  ExternalTerminalService: new () => unknown;
  NativeMcpDiscoveryHelperService: new () => unknown;
  NativeMcpDiscoveryHelperChannelName: string;
  URI: { file(path: string): unknown };
  SharedProcess: new (...args: unknown[]) => {
    connect(payload?: unknown): Promise<unknown>;
    dispose(): void;
  };
  MessagePortClient: new (
    port: unknown,
    id: string,
  ) => {
    registerChannel(name: string, channel: unknown): void;
    dispose(): void;
  };
  EncryptionMainService: new (...args: unknown[]) => unknown;
};

type ServerChannel = {
  listen(context: unknown, event: string, arg?: unknown): unknown;
  call(context: unknown, command: string, arg?: unknown): Promise<unknown>;
};

function passiveChannel(
  eventNone: unknown,
  call: (command: string, arg: unknown) => unknown,
): ServerChannel {
  return {
    listen() {
      return eventNone;
    },
    async call(_context, command, arg) {
      return call(command, arg);
    },
  };
}

export interface NativeCodeHostMainBackend {
  registerWindow(window: BrowserWindow): void;
  registerWebContents(webContents: WebContents, getBounds?: () => Electron.Rectangle | null): void;
  unregisterWindow(windowId: number): void;
  dispose(): void;
}

function moduleUrl(vscodeRoot: string, relativePath: string): string {
  return pathToFileURL(Path.join(vscodeRoot, "out", relativePath)).href;
}

async function loadNativeCodeHostModules(vscodeRoot: string): Promise<NativeCodeHostModules> {
  const [
    electronIpc,
    contextMenu,
    ipc,
    lifecycle,
    events,
    log,
    telemetry,
    extensionHostStarter,
    extensionHostStarterContract,
    diskProvider,
    diskProviderChannel,
    diskProviderClient,
    fileService,
    webviewMainService,
    utilityProcessWorker,
    utilityProcessWorkerContract,
    electronPtyHostStarter,
    ptyHostService,
    terminalContract,
    externalTerminal,
    nativeMcpDiscoveryHelper,
    nativeMcpDiscoveryContract,
    uri,
    sharedProcess,
    messagePortIpc,
    encryptionMain,
  ] = await Promise.all([
    import(moduleUrl(vscodeRoot, "vs/base/parts/ipc/electron-main/ipc.electron.js")),
    import(moduleUrl(vscodeRoot, "vs/base/parts/contextmenu/electron-main/contextmenu.js")),
    import(moduleUrl(vscodeRoot, "vs/base/parts/ipc/common/ipc.js")),
    import(moduleUrl(vscodeRoot, "vs/base/common/lifecycle.js")),
    import(moduleUrl(vscodeRoot, "vs/base/common/event.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/log/common/log.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/telemetry/common/telemetryUtils.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/extensions/electron-main/extensionHostStarter.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/extensions/common/extensionHostStarter.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/files/node/diskFileSystemProvider.js")),
    import(
      moduleUrl(vscodeRoot, "vs/platform/files/electron-main/diskFileSystemProviderServer.js")
    ),
    import(moduleUrl(vscodeRoot, "vs/platform/files/common/diskFileSystemProviderClient.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/files/common/fileService.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/webview/electron-main/webviewMainService.js")),
    import(
      moduleUrl(
        vscodeRoot,
        "vs/platform/utilityProcess/electron-main/utilityProcessWorkerMainService.js",
      )
    ),
    import(
      moduleUrl(vscodeRoot, "vs/platform/utilityProcess/common/utilityProcessWorkerService.js")
    ),
    import(moduleUrl(vscodeRoot, "vs/platform/terminal/electron-main/electronPtyHostStarter.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/terminal/node/ptyHostService.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/terminal/common/terminal.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/externalTerminal/node/externalTerminalService.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/mcp/node/nativeMcpDiscoveryHelperService.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/mcp/common/nativeMcpDiscoveryHelper.js")),
    import(moduleUrl(vscodeRoot, "vs/base/common/uri.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/sharedProcess/electron-main/sharedProcess.js")),
    import(moduleUrl(vscodeRoot, "vs/base/parts/ipc/electron-main/ipc.mp.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/encryption/electron-main/encryptionMainService.js")),
  ]);

  return {
    registerContextMenuListener: contextMenu.registerContextMenuListener,
    ElectronIPCServer: electronIpc.Server,
    ProxyChannel: ipc.ProxyChannel,
    DisposableStore: lifecycle.DisposableStore,
    Emitter: events.Emitter,
    EventNone: events.Event.None,
    NullLogService: log.NullLogService,
    NullLoggerService: log.NullLoggerService,
    NullTelemetryService: telemetry.NullTelemetryService,
    ExtensionHostStarter: extensionHostStarter.ExtensionHostStarter,
    DiskFileSystemProvider: diskProvider.DiskFileSystemProvider,
    DiskFileSystemProviderChannel: diskProviderChannel.DiskFileSystemProviderChannel,
    FileService: fileService.FileService,
    WebviewMainService: webviewMainService.WebviewMainService,
    UtilityProcessWorkerMainService: utilityProcessWorker.UtilityProcessWorkerMainService,
    extensionHostChannelName: extensionHostStarterContract.ipcExtensionHostStarterChannelName,
    localFileSystemChannelName: diskProviderClient.LOCAL_FILE_SYSTEM_CHANNEL_NAME,
    utilityProcessWorkerChannelName:
      utilityProcessWorkerContract.ipcUtilityProcessWorkerChannelName,
    ElectronPtyHostStarter: electronPtyHostStarter.ElectronPtyHostStarter,
    PtyHostService: ptyHostService.PtyHostService,
    TerminalLocalPtyChannelName: terminalContract.TerminalIpcChannels.LocalPty,
    ExternalTerminalService:
      process.platform === "win32"
        ? externalTerminal.WindowsExternalTerminalService
        : process.platform === "darwin"
          ? externalTerminal.MacExternalTerminalService
          : externalTerminal.LinuxExternalTerminalService,
    NativeMcpDiscoveryHelperService: nativeMcpDiscoveryHelper.NativeMcpDiscoveryHelperService,
    NativeMcpDiscoveryHelperChannelName:
      nativeMcpDiscoveryContract.NativeMcpDiscoveryHelperChannelName,
    URI: uri.URI,
    SharedProcess: sharedProcess.SharedProcess,
    MessagePortClient: messagePortIpc.Client,
    EncryptionMainService: encryptionMain.EncryptionMainService,
  };
}

function createSharedProcessProfile(modules: NativeCodeHostModules, stateDir: string) {
  const profileRoot = Path.join(stateDir, "code-oss-desktop", "shared-profile");
  const location = Path.join(profileRoot, "default");
  const resource = (name: string) => modules.URI.file(Path.join(location, name));
  return {
    home: modules.URI.file(Path.join(profileRoot, "profiles")),
    profile: {
      id: "default",
      isDefault: true,
      name: "Default",
      location: modules.URI.file(location),
      globalStorageHome: resource("globalStorage"),
      settingsResource: resource("settings.json"),
      keybindingsResource: resource("keybindings.json"),
      tasksResource: resource("tasks.json"),
      snippetsHome: resource("snippets"),
      promptsHome: resource("prompts"),
      extensionsResource: resource("extensions.json"),
      mcpResource: resource("mcp.json"),
      languageModelsResource: resource("chatLanguageModels.json"),
      agentPluginsHome: resource("agent-plugins"),
      cacheHome: modules.URI.file(Path.join(profileRoot, "cache")),
    },
  };
}

export async function createNativeCodeHostMainBackend(
  vscodeRoot: string,
  stateDir: string,
): Promise<NativeCodeHostMainBackend> {
  const vsceSignEntry = [
    Path.join(vscodeRoot, "node_modules", "@vscode", "vsce-sign", "src", "main.js"),
    Path.join(vscodeRoot, "build", "node_modules", "@vscode", "vsce-sign", "src", "main.js"),
  ].find((candidate) => existsSync(candidate));
  if (!process.env.TABS_VSCE_SIGN_MODULE_PATH && vsceSignEntry) {
    process.env.TABS_VSCE_SIGN_MODULE_PATH = pathToFileURL(vsceSignEntry).href;
  }

  const modules = await loadNativeCodeHostModules(vscodeRoot);
  const disposables = new modules.DisposableStore();
  const ipcServer = new modules.ElectronIPCServer();
  const logService = new modules.NullLogService();
  const onWillShutdown = new modules.Emitter();
  const onWillLoadWindow = new modules.Emitter();
  const windows = new Map<
    number,
    {
      webContents: WebContents;
      isDestroyed(): boolean;
      on(event: string, listener: () => void): unknown;
    }
  >();
  const embeddedBounds = new Map<number, () => Electron.Rectangle | null>();

  // The stock Code-OSS main process installs this application-level IPC
  // listener during startup. Tabs replaces that main process, so embedded
  // workbenches otherwise send native menu requests into an unhandled channel.
  // Code-OSS reports coordinates relative to its WebContentsView; native menus
  // need coordinates relative to the owning Tabs window.
  modules.registerContextMenuListener((event) => {
    const bounds = embeddedBounds.get(event.sender.id)?.();
    if (!bounds) return undefined;
    const ownerWindow =
      BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow();

    return {
      ...(ownerWindow ? { window: ownerWindow } : null),
      offsetX: bounds.x,
      offsetY: bounds.y,
    };
  });

  Object.assign(globalThis, {
    _VSCODE_FILE_ROOT: pathToFileURL(Path.join(vscodeRoot, "out") + Path.sep).href,
  });

  const lifecycleService = {
    onWillShutdown: onWillShutdown.event,
    onWillLoadWindow: onWillLoadWindow.event,
  };
  const windowsService = {
    getWindowById(windowId: number) {
      const win = windows.get(windowId);
      return win ? { id: windowId, win } : undefined;
    },
  };
  const configurationService = {
    onDidChangeConfiguration: modules.EventNone,
    getValue(key?: string) {
      if (key === "terminal.integrated.persistentSessionScrollback") return 100;
      return undefined;
    },
  };
  const environmentService = {
    args: {
      _: [],
      "disable-telemetry": true,
      "disable-updates": true,
      "extensions-dir": Path.join(stateDir, "code-oss-desktop", "extensions"),
      "user-data-dir": Path.join(stateDir, "code-oss-desktop", "shared-process"),
    },
    isBuilt: false,
    codeCachePath: Path.join(stateDir, "code-oss-desktop", "shared-process", "cache"),
    logsHome: modules.URI.file(Path.join(OS.tmpdir(), "tabs-code-oss-logs")),
    unsetSnapExportedVariables() {},
    restoreSnapExportedVariables() {},
  };

  const extensionHostStarter = new modules.ExtensionHostStarter(
    logService,
    lifecycleService,
    windowsService,
    modules.NullTelemetryService,
    configurationService,
  );
  const diskFileSystemProvider = new modules.DiskFileSystemProvider(logService);
  const fileService = new modules.FileService(logService);
  const fileProviderRegistration = fileService.registerProvider("file", diskFileSystemProvider);
  const diskFileSystemProviderChannel = new modules.DiskFileSystemProviderChannel(
    diskFileSystemProvider,
    logService,
    environmentService,
  );
  const utilityProcessWorkerService = new modules.UtilityProcessWorkerMainService(
    logService,
    windowsService,
    modules.NullTelemetryService,
    lifecycleService,
  );
  const loggerService = new modules.NullLoggerService();
  const ptyHostStarter = new modules.ElectronPtyHostStarter(
    { graceTime: 60_000, shortGraceTime: 6_000, scrollback: 100 },
    configurationService,
    environmentService,
    lifecycleService,
    logService,
  );
  const ptyHostService = new modules.PtyHostService(
    ptyHostStarter,
    configurationService,
    logService,
    loggerService,
  );
  const externalTerminalService = new modules.ExternalTerminalService();
  const nativeMcpDiscoveryHelperService = new modules.NativeMcpDiscoveryHelperService();
  const encryptionService = new modules.EncryptionMainService(logService);
  const webviewMainService = new modules.WebviewMainService(fileService, windowsService);
  const sharedProfile = createSharedProcessProfile(modules, stateDir);
  const storagePath = Path.join(
    stateDir,
    "code-oss-desktop",
    "shared-profile",
    "default",
    "globalStorage",
    "storage.json",
  );
  const storage = loadNativeCodeHostStorage(storagePath);
  const storageChannel = passiveChannel(modules.EventNone, (command, arg) => {
    if (command === "getItems") {
      return Array.from(storage.entries());
    }
    if (command === "updateItems" && arg && typeof arg === "object") {
      const update = arg as { insert?: Array<[string, string]>; delete?: string[] };
      for (const [key, value] of update.insert ?? []) storage.set(key, value);
      for (const key of update.delete ?? []) storage.delete(key);
      saveNativeCodeHostStorage(storagePath, storage);
    }
    if (command === "isUsed") return false;
    return undefined;
  });
  const loggerChannel = passiveChannel(modules.EventNone, (command, arg) => {
    if (command === "consoleLog" && Array.isArray(arg)) {
      const values = Array.isArray(arg[1]) ? arg[1] : [];
      console.log("[code-oss]", ...values);
    }
    return undefined;
  });

  for (const pathname of [
    environmentService.args["extensions-dir"],
    environmentService.args["user-data-dir"],
    environmentService.codeCachePath,
    Path.join(stateDir, "code-oss-desktop", "shared-profile", "default", "agent-plugins"),
  ]) {
    await import("node:fs/promises").then((fs) => fs.mkdir(pathname, { recursive: true }));
  }

  ipcServer.registerChannel(
    modules.extensionHostChannelName,
    modules.ProxyChannel.fromService(extensionHostStarter, disposables),
  );

  const userDataProfilesChannel = modules.ProxyChannel.fromService(
    {
      onDidChangeProfiles: modules.EventNone,
      onDidResetWorkspaces: modules.EventNone,
      profilesHome: sharedProfile.home,
      profiles: [sharedProfile.profile],
      defaultProfile: sharedProfile.profile,
      async createProfile() {
        return sharedProfile.profile;
      },
      async updateProfile() {
        return sharedProfile.profile;
      },
      async removeProfile() {},
      async setProfileForWorkspace() {},
      async unsetWorkspace() {},
      async resetWorkspaces() {},
      async cleanUp() {},
      async cleanUpTransientProfiles() {},
    },
    disposables,
  );
  ipcServer.registerChannel("userDataProfiles", userDataProfilesChannel);
  ipcServer.registerChannel(
    "encryption",
    modules.ProxyChannel.fromService(encryptionService, disposables),
  );
  ipcServer.registerChannel(
    "extensionhostdebugservice",
    passiveChannel(modules.EventNone, () => undefined),
  );
  ipcServer.registerChannel(
    "nativeManagedSettings",
    passiveChannel(modules.EventNone, (command) => {
      if (command === "getManagedSettings" || command === "updatePolicyDefinitions") {
        return {};
      }
      return undefined;
    }),
  );
  ipcServer.registerChannel(
    "fileManagedSettings",
    passiveChannel(modules.EventNone, (command) => {
      if (command === "getRawManagedSettings" || command === "getManagedSettings") {
        return {};
      }
      return undefined;
    }),
  );

  const sharedProcess = new modules.SharedProcess(
    "tabs-machine",
    "tabs-sqm",
    "tabs-device",
    environmentService,
    {
      profilesHome: sharedProfile.home,
      profiles: [sharedProfile.profile],
    },
    lifecycleService,
    logService,
    {
      getLogLevel: () => 2,
      getGlobalLoggers: () => [],
    },
    { serialize: () => ({}) },
  );

  const sharedProcessMainClient = sharedProcess.connect().then((port) => {
    const client = new modules.MessagePortClient(port, "main");
    client.registerChannel(modules.localFileSystemChannelName, diskFileSystemProviderChannel);
    client.registerChannel("userDataProfiles", userDataProfilesChannel);
    client.registerChannel("logger", loggerChannel);
    client.registerChannel(
      "policy",
      passiveChannel(modules.EventNone, () => ({})),
    );
    client.registerChannel(
      "nativeHost",
      passiveChannel(modules.EventNone, () => undefined),
    );
    client.registerChannel("storage", storageChannel);
    client.registerChannel(
      "meteredConnection",
      passiveChannel(modules.EventNone, () => false),
    );
    client.registerChannel(
      "browserElements",
      passiveChannel(modules.EventNone, () => undefined),
    );
    return client;
  });
  ipcServer.registerChannel(modules.localFileSystemChannelName, diskFileSystemProviderChannel);
  ipcServer.registerChannel(
    modules.utilityProcessWorkerChannelName,
    modules.ProxyChannel.fromService(utilityProcessWorkerService, disposables),
  );
  ipcServer.registerChannel(
    modules.TerminalLocalPtyChannelName,
    modules.ProxyChannel.fromService(ptyHostService, disposables),
  );
  ipcServer.registerChannel(
    "externalTerminal",
    modules.ProxyChannel.fromService(externalTerminalService, disposables),
  );
  ipcServer.registerChannel(
    modules.NativeMcpDiscoveryHelperChannelName,
    modules.ProxyChannel.fromService(nativeMcpDiscoveryHelperService, disposables),
  );

  // These channels are always present in the stock Electron main process. The
  // embedded workbench does not own a second application window or native
  // menubar, so Tabs provides the subset that is meaningful inside a tool.
  const recentWorkspaces: unknown[] = [];
  ipcServer.registerChannel(
    "workspaces",
    modules.ProxyChannel.fromService(
      {
        onDidChangeRecentlyOpened: modules.EventNone,
        async enterWorkspace() {
          return undefined;
        },
        async createUntitledWorkspace(folders: unknown[] = []) {
          const configPath = modules.URI.file(
            Path.join(OS.tmpdir(), "tabs-code-workspaces", `${randomUUID()}.code-workspace`),
          );
          return { id: randomUUID(), configPath, folders };
        },
        async deleteUntitledWorkspace() {},
        async getWorkspaceIdentifier(workspaceUri: { toString(): string }) {
          return {
            id: createHash("md5").update(workspaceUri.toString()).digest("hex"),
            configPath: workspaceUri,
          };
        },
        async addRecentlyOpened(recents: unknown[]) {
          recentWorkspaces.push(...recents);
        },
        async removeRecentlyOpened() {},
        async clearRecentlyOpened() {
          recentWorkspaces.length = 0;
        },
        async getRecentlyOpened() {
          return { workspaces: recentWorkspaces, files: [] };
        },
        async getDirtyWorkspaces() {
          return [];
        },
      },
      disposables,
    ),
  );
  ipcServer.registerChannel(
    "menubar",
    modules.ProxyChannel.fromService({ async updateMenubar() {} }, disposables),
  );
  ipcServer.registerChannel(
    "webview",
    modules.ProxyChannel.fromService(webviewMainService, disposables),
  );

  ipcServer.registerChannel("logger", loggerChannel);
  ipcServer.registerChannel("storage", storageChannel);
  ipcServer.registerChannel(
    "keyboardLayout",
    passiveChannel(modules.EventNone, (command) =>
      command === "getKeyboardLayoutData"
        ? { keyboardLayoutInfo: null, keyboardMapping: null }
        : undefined,
    ),
  );
  ipcServer.registerChannel(
    "policy",
    passiveChannel(modules.EventNone, (command) =>
      command === "updatePolicyDefinitions" ? {} : undefined,
    ),
  );
  ipcServer.registerChannel(
    "update",
    passiveChannel(modules.EventNone, (command) => {
      if (command === "_getInitialState") return { type: "disabled", reason: "disabled" };
      if (command === "isLatestVersion") return true;
      return undefined;
    }),
  );
  const nativeHostChannel = passiveChannel(modules.EventNone, async (command, arg) => {
    const args = Array.isArray(arg) ? arg : [];
    const windowId = typeof args[0] === "number" ? args[0] : undefined;
    const embeddedWindow = windowId === undefined ? undefined : windows.get(windowId);
    const webContents = embeddedWindow?.webContents;
    if (command === "getWindowCount") return windows.size;
    if (command === "getWindows") {
      return Array.from(windows.keys(), (id) => ({ id, pid: process.pid }));
    }
    if (command === "getActiveWindowId") return BrowserWindow.getFocusedWindow()?.id;
    if (command === "getOSStatistics") {
      return { totalmem: OS.totalmem(), freemem: OS.freemem(), loadavg: OS.loadavg() };
    }
    if (command === "getOSProperties") {
      return {
        type: OS.type(),
        release: OS.release(),
        arch: OS.arch(),
        cpus: OS.cpus(),
      };
    }
    if (command === "getOSVirtualMachineHint") return 0;
    if (command === "getOSColorScheme") {
      return {
        dark: nativeTheme.shouldUseDarkColors,
        highContrast: nativeTheme.shouldUseHighContrastColors,
      };
    }
    if (command === "isAdmin") return false;
    if (command === "syncSystemWideKeybindings") return { failed: [] };
    if (command === "resolveProxy") {
      const url = typeof args[1] === "string" ? args[1] : undefined;
      return url && webContents && !webContents.isDestroyed()
        ? webContents.session.resolveProxy(url)
        : undefined;
    }
    if (command === "loadCertificates") return [...rootCertificates];
    if (command === "lookupAuthorization" || command === "lookupKerberosAuthorization") {
      return undefined;
    }
    return undefined;
  });
  ipcServer.registerChannel("nativeHost", nativeHostChannel);
  ipcServer.registerChannel(
    "meteredConnection",
    passiveChannel(modules.EventNone, (command) =>
      command === "IsConnectionMetered" ? false : undefined,
    ),
  );

  return {
    registerWindow(window) {
      windows.set(window.webContents.id, window);
      window.once("closed", () => windows.delete(window.webContents.id));
    },
    registerWebContents(webContents, getBounds) {
      const embeddedWindow = Object.assign(new EventEmitter(), {
        webContents,
        isDestroyed: () => webContents.isDestroyed(),
      });
      windows.set(webContents.id, embeddedWindow);
      if (getBounds) embeddedBounds.set(webContents.id, getBounds);
      webContents.once("destroyed", () => {
        embeddedWindow.emit("closed");
        windows.delete(webContents.id);
        embeddedBounds.delete(webContents.id);
      });
    },
    unregisterWindow(windowId) {
      windows.delete(windowId);
    },
    dispose() {
      onWillShutdown.fire({
        reason: 1,
        join: (_id: string, promise: Promise<void>) => void promise.catch(() => undefined),
      });
      windows.clear();
      embeddedBounds.clear();
      ptyHostService.dispose();
      (loggerService as { dispose(): void }).dispose();
      utilityProcessWorkerService.dispose();
      webviewMainService.dispose();
      fileProviderRegistration.dispose();
      fileService.dispose();
      diskFileSystemProviderChannel.dispose();
      diskFileSystemProvider.dispose();
      extensionHostStarter.dispose();
      void sharedProcessMainClient.then((client) => client.dispose()).catch(() => undefined);
      sharedProcess.dispose();
      disposables.dispose();
      ipcServer.dispose();
      onWillLoadWindow.dispose();
      onWillShutdown.dispose();
    },
  };
}
