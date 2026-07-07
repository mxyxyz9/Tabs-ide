import { useEffect, useState } from "react";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { SettingsSection } from "~/routes/_chat.settings";
import { Link2Icon, MonitorIcon, ShieldCheckIcon } from "lucide-react";

interface TailscaleStatus {
  available: boolean;
  running: boolean;
  magicDnsName: string | null;
  ipv4: string | null;
}

export function ConnectionsSettings() {
  const isDesktop = typeof window !== "undefined" && !!window.desktopBridge;
  const [networkAccess, setNetworkAccess] = useState(false);
  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus>({
    available: false,
    running: false,
    magicDnsName: null,
    ipv4: null,
  });
  const [isLoadingTailscale, setIsLoadingTailscale] = useState(true);

  // Initialize network access toggle
  useEffect(() => {
    const val = localStorage.getItem("networkAccessEnabled");
    setNetworkAccess(val === "true");
  }, []);

  // Load Tailscale status
  useEffect(() => {
    const fetchTailscale = async () => {
      if (!isDesktop) {
        setIsLoadingTailscale(false);
        return;
      }
      try {
        const status = await window.desktopBridge!.getTailscaleStatus();
        setTailscaleStatus(status);
      } catch {
        // Keep default state
      } finally {
        setIsLoadingTailscale(false);
      }
    };

    fetchTailscale();
    const interval = setInterval(fetchTailscale, 10000);
    return () => clearInterval(interval);
  }, [isDesktop]);

  const handleNetworkAccessChange = (checked: boolean) => {
    if (!isDesktop) return;
    setNetworkAccess(checked);
    localStorage.setItem("networkAccessEnabled", String(checked));
  };

  const renderTailscaleStatus = () => {
    if (isLoadingTailscale) {
      return <span className="text-xs text-muted-foreground">Checking status...</span>;
    }
    if (!tailscaleStatus.available) {
      return (
        <span className="text-xs text-muted-foreground">
          Install Tailscale to enable HTTPS access.
        </span>
      );
    }
    if (!tailscaleStatus.running) {
      return (
        <span className="text-xs text-muted-foreground">
          Start Tailscale to set up HTTPS access through MagicDNS.
        </span>
      );
    }
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-success font-medium flex items-center gap-1">
          <ShieldCheckIcon className="size-3.5 text-success" />
          Connected to Tailnet
        </span>
        {tailscaleStatus.magicDnsName && (
          <code className="text-[11px] text-muted-foreground mt-0.5 block bg-muted px-1.5 py-0.5 rounded w-fit">
            {tailscaleStatus.magicDnsName}
          </code>
        )}
      </div>
    );
  };

  const toggleSwitch = (
    <Switch
      checked={networkAccess}
      onCheckedChange={handleNetworkAccessChange}
      disabled={!isDesktop}
    />
  );

  return (
    <div className="space-y-6">
      <SettingsSection title="This Environment">
        {/* Network Access Row */}
        <div className="border-t border-border/60 px-4 py-4 first:border-t-0 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
                  <MonitorIcon className="size-4.5 text-foreground/80" />
                </span>
                <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                  Network Access
                </span>
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed max-w-xl">
                {networkAccess
                  ? "Environment is visible to other devices on your local network."
                  : "Limited to this machine."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isDesktop ? (
                <Tooltip>
                  <TooltipTrigger render={toggleSwitch} />
                  <TooltipPopup side="top">Only available on desktop</TooltipPopup>
                </Tooltip>
              ) : (
                toggleSwitch
              )}
            </div>
          </div>
        </div>

        {/* Tailscale Row */}
        <div className="border-t border-border/60 px-4 py-4 first:border-t-0 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
                  <Link2Icon className="size-4.5 text-foreground/80" />
                </span>
                <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                  Tailscale HTTPS
                </span>
              </div>
              <div className="pt-0.5">{renderTailscaleStatus()}</div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Remote Environments">
        <div className="px-6 py-12 text-center border-t border-border/60 first:border-t-0">
          <div className="mx-auto max-w-sm space-y-3">
            <h3 className="text-sm font-semibold text-foreground">No saved remote environments</h3>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Connect to remote servers, virtual machines, or other instances of the editor running
              in different environments.
            </p>
            <div className="pt-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button size="sm" variant="outline" disabled className="text-xs h-8">
                      Add environment
                    </Button>
                  }
                />
                <TooltipPopup side="top">Coming soon</TooltipPopup>
              </Tooltip>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
