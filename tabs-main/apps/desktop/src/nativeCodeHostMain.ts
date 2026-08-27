import { BrowserWindow, type WebContents } from "electron";
import { pathToFileURL } from "node:url";
import * as Path from "node:path";
import * as OS from "node:os";

type NativeCodeHostModules = {
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
  URI: { file(path: string): unknown };
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
  registerWebContents(webContents: WebContents): void;
  unregisterWindow(windowId: number): void;
  dispose(): void;
}

function moduleUrl(vscodeRoot: string, relativePath: string): string {
  return pathToFileURL(Path.join(vscodeRoot, "out", relativePath)).href;
}

async function loadNativeCodeHostModules(vscodeRoot: string): Promise<NativeCodeHostModules> {
  const [
    electronIpc,
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
    utilityProcessWorker,
    utilityProcessWorkerContract,
    electronPtyHostStarter,
    ptyHostService,
    terminalContract,
    externalTerminal,
    uri,
  ] = await Promise.all([
    import(moduleUrl(vscodeRoot, "vs/base/parts/ipc/electron-main/ipc.electron.js")),
    import(moduleUrl(vscodeRoot, "vs/base/parts/ipc/common/ipc.js")),
    import(moduleUrl(vscodeRoot, "vs/base/common/lifecycle.js")),
    import(moduleUrl(vscodeRoot, "vs/base/common/event.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/log/common/log.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/telemetry/common/telemetryUtils.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/extensions/electron-main/extensionHostStarter.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/extensions/common/extensionHostStarter.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/files/node/diskFileSystemProvider.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/files/electron-main/diskFileSystemProviderServer.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/files/common/diskFileSystemProviderClient.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/utilityProcess/electron-main/utilityProcessWorkerMainService.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/utilityProcess/common/utilityProcessWorkerService.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/terminal/electron-main/electronPtyHostStarter.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/terminal/node/ptyHostService.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/terminal/common/terminal.js")),
    import(moduleUrl(vscodeRoot, "vs/platform/externalTerminal/node/externalTerminalService.js")),
    import(moduleUrl(vscodeRoot, "vs/base/common/uri.js")),
  ]);

  return {
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
    URI: uri.URI,
  };
}

export async function createNativeCodeHostMainBackend(
  vscodeRoot: string,
): Promise<NativeCodeHostMainBackend> {
  const modules = await loadNativeCodeHostModules(vscodeRoot);
  const disposables = new modules.DisposableStore();
  const ipcServer = new modules.ElectronIPCServer();
  const logService = new modules.NullLogService();
  const onWillShutdown = new modules.Emitter();
  const onWillLoadWindow = new modules.Emitter();
  const windows = new Map<
    number,
    { webContents: WebContents; isDestroyed(): boolean }
  >();

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
    args: {},
    isBuilt: false,
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

  ipcServer.registerChannel(
    modules.extensionHostChannelName,
    modules.ProxyChannel.fromService(extensionHostStarter, disposables),
  );
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

  const storage = new Map<string, string>();
  ipcServer.registerChannel(
    "logger",
    passiveChannel(modules.EventNone, (command, arg) => {
      if (command === "consoleLog" && Array.isArray(arg)) {
        const values = Array.isArray(arg[1]) ? arg[1] : [];
        console.log("[code-oss]", ...values);
      }
      return undefined;
    }),
  );
  ipcServer.registerChannel(
    "storage",
    passiveChannel(modules.EventNone, (command, arg) => {
      if (command === "getItems") {
        return Array.from(storage.entries());
      }
      if (command === "updateItems" && arg && typeof arg === "object") {
        const update = arg as { insert?: Array<[string, string]>; delete?: string[] };
        for (const [key, value] of update.insert ?? []) storage.set(key, value);
        for (const key of update.delete ?? []) storage.delete(key);
      }
      if (command === "isUsed") return false;
      return undefined;
    }),
  );
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
  ipcServer.registerChannel(
    "nativeHost",
    passiveChannel(modules.EventNone, (command) => {
      if (command === "getWindowCount") return windows.size;
      if (command === "getWindows") {
        return Array.from(windows.keys(), (id) => ({ id, pid: process.pid }));
      }
      if (command === "getActiveWindowId") return BrowserWindow.getFocusedWindow()?.id;
      if (command === "getOSStatistics") {
        return { totalmem: 0, freemem: 0, loadavg: [0, 0, 0] };
      }
      if (command === "getOSProperties") {
        return { type: process.platform, release: "", arch: process.arch, cpus: [] };
      }
      if (command === "getOSVirtualMachineHint") return 0;
      if (command === "getOSColorScheme") return { dark: true, highContrast: false };
      if (command === "isAdmin") return false;
      return undefined;
    }),
  );

  return {
    registerWindow(window) {
      windows.set(window.webContents.id, window);
      window.once("closed", () => windows.delete(window.webContents.id));
    },
    registerWebContents(webContents) {
      windows.set(webContents.id, {
        webContents,
        isDestroyed: () => webContents.isDestroyed(),
      });
      webContents.once("destroyed", () => windows.delete(webContents.id));
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
      ptyHostService.dispose();
      (loggerService as { dispose(): void }).dispose();
      utilityProcessWorkerService.dispose();
      diskFileSystemProviderChannel.dispose();
      diskFileSystemProvider.dispose();
      extensionHostStarter.dispose();
      disposables.dispose();
      ipcServer.dispose();
      onWillLoadWindow.dispose();
      onWillShutdown.dispose();
    },
  };
}
