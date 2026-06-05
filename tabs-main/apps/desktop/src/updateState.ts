import type { DesktopUpdateState } from "@tabs/contracts";

export function shouldBroadcastDownloadProgress(
  currentState: DesktopUpdateState,
  nextPercent: number,
): boolean {
  if (currentState.status !== "downloading") {
    return true;
  }

  const currentPercent = currentState.downloadPercent;
  if (currentPercent === null) {
    return true;
  }

  const previousStep = Math.floor(currentPercent / 10);
  const nextStep = Math.floor(nextPercent / 10);
  return nextStep !== previousStep || nextPercent === 100;
}

export function nextStatusAfterDownloadFailure(
  currentState: DesktopUpdateState,
): DesktopUpdateState["status"] {
  return currentState.availableVersion ? "available" : "error";
}

export function getCanRetryAfterDownloadFailure(currentState: DesktopUpdateState): boolean {
  return currentState.availableVersion !== null;
}

export function getAutoUpdateDisabledReason(args: {
  isDevelopment: boolean;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  appImage?: string | undefined;
  disabledByEnv: boolean;
  /**
   * Whether macOS auto-updates are supported. Squirrel.Mac requires the running
   * app and the update to be code-signed with a Developer ID; an unsigned build
   * cannot install an auto-update (and electron-updater 404s without the signed
   * feed), so macOS auto-update is disabled by default. Opt in via
   * TABS_ENABLE_MAC_AUTO_UPDATE once a signed build ships.
   */
  macUpdatesSupported?: boolean;
}): string | null {
  if (args.isDevelopment || !args.isPackaged) {
    return "Automatic updates are only available in packaged production builds.";
  }
  if (args.disabledByEnv) {
    return "Automatic updates are disabled by the TABS_DISABLE_AUTO_UPDATE setting.";
  }
  if (args.platform === "darwin" && !args.macUpdatesSupported) {
    return "Automatic updates on macOS require a code-signed build. Download new versions from GitHub instead.";
  }
  if (args.platform === "linux" && !args.appImage) {
    return "Automatic updates on Linux require running the AppImage build.";
  }
  return null;
}
