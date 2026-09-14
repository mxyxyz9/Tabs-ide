import { useCallback, useEffect, useState } from "react";
import type { DesktopUpdateState } from "@tabs/contracts";
import {
  type DesktopUpdateButtonAction,
  getDesktopUpdateActionError,
  getDesktopUpdateButtonTooltip,
  isDesktopUpdateButtonDisabled,
  resolveDesktopUpdateButtonAction,
} from "../desktopUpdate.logic";
import { isElectron } from "../../env";
import { APP_VERSION } from "../../branding";
import { Button } from "../ui/button";
import { SettingsRow, SettingsSection, SettingsSectionHeader } from "./SettingsLayout";

const TABS_RELEASES_URL = "https://github.com/mxyxyz9/Tabs-ide/releases";

type DesktopOsKind = "mac" | "windows" | "linux" | "unknown";

function detectDesktopOs(): DesktopOsKind {
  if (typeof navigator === "undefined") return "unknown";
  const ua = `${navigator.userAgent} ${navigator.platform ?? ""}`.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "unknown";
}

function uninstallInstructions(os: DesktopOsKind): string[] {
  switch (os) {
    case "mac":
      return [
        "Quit Tabs.",
        "Open Finder → Applications and drag Tabs to the Trash.",
        "Optional: delete ~/.tabs to remove the cached editor runtime (~1.6 GB).",
      ];
    case "windows":
      return [
        "Quit Tabs.",
        "Open Settings → Apps → Installed apps, find Tabs and choose Uninstall.",
        "Optional: delete %USERPROFILE%\\.tabs to remove the cached editor runtime.",
      ];
    case "linux":
      return [
        "Quit Tabs.",
        "Delete the AppImage you downloaded (or remove the package via your package manager).",
        "Optional: delete ~/.tabs to remove the cached editor runtime.",
      ];
    default:
      return [
        "Quit Tabs, then remove the application using your operating system's standard uninstall flow.",
        "Optional: delete the ~/.tabs folder to remove the cached editor runtime.",
      ];
  }
}

function describeDesktopUpdate(state: DesktopUpdateState): string {
  switch (state.status) {
    case "disabled":
      return "Automatic updates are disabled for this build.";
    case "checking":
      return "Checking for updates…";
    case "up-to-date":
      return "Tabs is up to date.";
    case "available":
      return `Version ${state.availableVersion ?? ""} is available to download.`.trim();
    case "downloading":
      return `Downloading update${
        typeof state.downloadPercent === "number" ? ` (${Math.floor(state.downloadPercent)}%)` : ""
      }…`;
    case "downloaded":
      return `Version ${
        state.downloadedVersion ?? state.availableVersion ?? ""
      } is ready. Restart to install.`.trim();
    case "error":
      return state.message ?? "The last update attempt failed.";
    default:
      return "Tabs is up to date.";
  }
}

function desktopUpdateButtonLabel(action: DesktopUpdateButtonAction): string {
  if (action === "install") return "Restart & install";
  if (action === "download") return "Download update";
  return "";
}

export function AboutSettings() {
  const [updateState, setUpdateState] = useState<DesktopUpdateState | null>(null);
  const [updateActionError, setUpdateActionError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    let cancelled = false;
    void bridge.getUpdateState().then((next) => {
      if (!cancelled) setUpdateState(next);
    });
    const unsubscribe = bridge.onUpdateState((next) => {
      if (!cancelled) setUpdateState(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const runUpdateAction = useCallback((action: DesktopUpdateButtonAction) => {
    const bridge = window.desktopBridge;
    if (!bridge || action === "none") return;
    setUpdateActionError(null);
    const run = action === "install" ? bridge.installUpdate() : bridge.downloadUpdate();
    void run
      .then((result) => {
        setUpdateState(result.state);
        setUpdateActionError(getDesktopUpdateActionError(result));
      })
      .catch((error: unknown) => {
        setUpdateActionError(error instanceof Error ? error.message : "Update action failed.");
      });
  }, []);

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title="About"
        description="Application build details, software updates, and diagnostic information."
      />

      <SettingsSection title="Application Details">
        <SettingsRow
          title="Version"
          description="The version of Tabs currently installed."
          control={<code className="text-xs font-medium text-muted-foreground">{APP_VERSION}</code>}
        />

        {isElectron && updateState ? (
          <SettingsRow
            title="Software update"
            description={describeDesktopUpdate(updateState)}
            status={
              updateActionError ? (
                <span className="text-destructive">{updateActionError}</span>
              ) : updateState.status === "downloading" &&
                typeof updateState.downloadPercent === "number" ? (
                <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{
                      width: `${Math.floor(updateState.downloadPercent)}%`,
                    }}
                  />
                </div>
              ) : null
            }
            control={(() => {
              const action = resolveDesktopUpdateButtonAction(updateState);
              if (action === "none") {
                if (updateState.status === "disabled" || updateState.status === "error") {
                  return (
                    <Button
                      size="xs"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => void window.desktopBridge?.openExternal(TABS_RELEASES_URL)}
                    >
                      View releases
                    </Button>
                  );
                }
                return (
                  <span className="text-xs text-muted-foreground">
                    {updateState.status === "checking" ? "Checking…" : "Up to date"}
                  </span>
                );
              }
              return (
                <Button
                  size="xs"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={isDesktopUpdateButtonDisabled(updateState)}
                  title={getDesktopUpdateButtonTooltip(updateState)}
                  onClick={() => runUpdateAction(action)}
                >
                  {desktopUpdateButtonLabel(action)}
                </Button>
              );
            })()}
          />
        ) : null}

        {isElectron ? (
          <SettingsRow
            title="Uninstall Tabs"
            description="Remove Tabs from this computer."
            status={
              <ol className="ms-4 list-decimal space-y-0.5">
                {uninstallInstructions(detectDesktopOs()).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            }
          />
        ) : null}
      </SettingsSection>
    </div>
  );
}

export default AboutSettings;
