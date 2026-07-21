import { type ReactNode, useEffect, useState } from "react";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { SettingsSection, SettingsHeaderPortal } from "~/routes/_chat.settings";
import { toastManager } from "~/components/ui/toast";
import { useConfirm } from "~/hooks/useConfirm";
import {
  Link2Icon,
  MonitorIcon,
  ShieldCheckIcon,
  InfoIcon,
  LockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TerminalIcon,
  PlusIcon,
  TriangleAlertIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogClose,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

interface TailscaleStatus {
  available: boolean;
  running: boolean;
  magicDnsName: string | null;
  ipv4: string | null;
}

export function ConnectionsSettings() {
  const isDesktop = typeof window !== "undefined" && !!window.desktopBridge;
  const { confirm, confirmDialog } = useConfirm();
  const [networkAccess, setNetworkAccess] = useState(false);
  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus>({
    available: false,
    running: false,
    magicDnsName: null,
    ipv4: null,
  });
  const [isLoadingTailscale, setIsLoadingTailscale] = useState(true);

  // Wizard States
  const [guideStep, setGuideStep] = useState(1);
  const [httpsStep, setHttpsStep] = useState(1);

  // Add Environment Dialog Form States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"remote" | "ssh">("remote");
  const [remoteHost, setRemoteHost] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");

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

  const openUrl = (url: string) => {
    if (typeof window !== "undefined" && window.desktopBridge) {
      window.desktopBridge.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleAddEnvironment = () => {
    toastManager.add({
      type: "success",
      title: "Connecting to environment...",
      description:
        addMode === "remote"
          ? `Attempting connection to remote link at ${remoteHost}`
          : `Connecting via SSH to ${sshHost}:${sshPort}`,
    });
    setIsAddOpen(false);
    setRemoteHost("");
    setPairingCode("");
    setSshHost("");
  };

  const toggleSwitch = (
    <Switch
      checked={networkAccess}
      onCheckedChange={handleNetworkAccessChange}
      disabled={!isDesktop}
    />
  );

  const isTailscaleReady = tailscaleStatus.available && tailscaleStatus.running;

  return (
    <div className="space-y-6">
      {confirmDialog}

      <div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Connections
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure network access, Tailscale HTTPS tunnels, and remote environment connections.
          </p>
        </div>
        <div className="h-[5px] w-full my-5 rounded-full dark:block hidden" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.25), transparent)' }} />
        <div className="h-[5px] w-full my-5 rounded-full dark:hidden block" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)' }} />
      </div>

      <SettingsSection
        title="This Environment"
        headerAction={
          <SettingsHeaderPortal>
            <Button
              size="xs"
              variant="outline"
              className="no-drag"
              onClick={async () => {
                const confirmed = await confirm(
                  "Restore default settings?\n\nThis will reset: Network Access.",
                );
                if (confirmed) {
                  setNetworkAccess(false);
                  localStorage.setItem("networkAccessEnabled", "false");
                }
              }}
            >
              <RotateCcwIcon className="size-3.5 mr-1" />
              Restore defaults
            </Button>
          </SettingsHeaderPortal>
        }
      >
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
                <div className="flex min-w-0 items-center gap-2">
                  <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
                    <Link2Icon className="size-4.5 text-foreground/80" />
                  </span>
                  <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                    Tailscale HTTPS
                  </span>
                </div>
                <Dialog
                  onOpenChange={(open) => {
                    if (open) setHttpsStep(1);
                  }}
                >
                  <DialogTrigger
                    render={
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-foreground p-0 rounded-full flex items-center justify-center"
                      >
                        <InfoIcon className="size-4" />
                      </Button>
                    }
                  />
                  <DialogContent className="max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-[18px]">
                        <Link2Icon className="size-5 text-primary" />
                        Tailscale HTTPS
                      </DialogTitle>
                      <DialogDescription className="text-[13px]">
                        Concept Guide — Step {httpsStep} of 3
                      </DialogDescription>
                    </DialogHeader>
                    <DialogPanel className="space-y-6 pt-5 pb-3">
                      {httpsStep === 1 && (
                        <div className="space-y-4 text-center py-4">
                          <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                            <ShieldCheckIcon className="size-8" />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[16px] font-bold text-foreground">
                              1. Private Mesh Network (Tailnet)
                            </h4>
                            <p className="text-[13px] text-muted-foreground leading-relaxed px-6">
                              Tailscale links your devices together in a secure peer-to-peer virtual
                              private network. All connections are end-to-end encrypted using
                              WireGuard.
                            </p>
                          </div>
                        </div>
                      )}

                      {httpsStep === 2 && (
                        <div className="space-y-4 text-center py-4">
                          <div className="mx-auto size-16 rounded-full bg-info/10 flex items-center justify-center border border-info/20 text-info">
                            <MonitorIcon className="size-8" />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[16px] font-bold text-foreground">
                              2. MagicDNS Mapping
                            </h4>
                            <p className="text-[13px] text-muted-foreground leading-relaxed px-6">
                              MagicDNS automatically translates dynamic IP addresses into clean,
                              stable, human-readable hostnames (e.g.{" "}
                              <code className="bg-muted px-1.5 py-0.5 rounded text-[12px] font-mono text-foreground font-semibold">
                                my-server.ts.net
                              </code>
                              ).
                            </p>
                          </div>
                        </div>
                      )}

                      {httpsStep === 3 && (
                        <div className="space-y-4 text-center py-4">
                          <div className="mx-auto size-16 rounded-full bg-success/10 flex items-center justify-center border border-success/20 text-success">
                            <LockIcon className="size-8" />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[16px] font-bold text-foreground">
                              3. Private SSL Certificates
                            </h4>
                            <p className="text-[13px] text-muted-foreground leading-relaxed px-6">
                              Tailscale provisions trusted Let's Encrypt certificates directly for
                              your MagicDNS domain name. This enables fully verified, private HTTPS
                              inside your browser.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Navigation Controls */}
                      <div className="flex items-center justify-between pt-5 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setHttpsStep((s) => Math.max(1, s - 1))}
                          className={cn(
                            "text-xs h-8 gap-1 pl-1.5 pr-2.5",
                            httpsStep === 1 && "invisible",
                          )}
                        >
                          <ChevronLeftIcon className="size-4" />
                          Back
                        </Button>

                        {/* Pagination Dots */}
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3].map((step) => (
                            <span
                              key={step}
                              onClick={() => setHttpsStep(step)}
                              className={cn(
                                "size-1.5 rounded-full transition-all cursor-pointer",
                                httpsStep === step
                                  ? "bg-primary scale-125"
                                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                              )}
                            />
                          ))}
                        </div>

                        {httpsStep < 3 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setHttpsStep((s) => Math.min(3, s + 1))}
                            className="text-xs h-8 gap-1 pl-2.5 pr-1.5"
                          >
                            Next
                            <ChevronRightIcon className="size-4" />
                          </Button>
                        ) : (
                          <DialogClose
                            render={
                              <Button size="sm" variant="secondary" className="text-xs h-8">
                                Finish
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </DialogPanel>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed max-w-xl mt-1">
                {isLoadingTailscale
                  ? "Checking Tailscale status..."
                  : !tailscaleStatus.available
                    ? "Install Tailscale to enable secure peer-to-peer HTTPS access."
                    : !tailscaleStatus.running
                      ? "Start Tailscale to activate secure HTTPS routing."
                      : "Securely connected to Tailnet via MagicDNS. Domain: "}
                {tailscaleStatus.running && tailscaleStatus.magicDnsName && (
                  <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono font-semibold">
                    {tailscaleStatus.magicDnsName}
                  </code>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isLoadingTailscale ? (
                <span className="text-xs text-muted-foreground">Checking...</span>
              ) : !tailscaleStatus.available ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => openUrl("https://tailscale.com/download")}
                  className="text-xs h-7 px-3 font-semibold"
                >
                  Install Tailscale
                </Button>
              ) : !tailscaleStatus.running ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => openUrl("https://tailscale.com/download")}
                  className="text-xs h-7 px-3 font-semibold"
                >
                  Open Tailscale
                </Button>
              ) : (
                <span className="text-xs text-success font-semibold flex items-center gap-1 bg-success/10 border border-success/20 px-2.5 py-1 rounded-full">
                  <ShieldCheckIcon className="size-3.5 text-success" />
                  Connected
                </span>
              )}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Remote Environments"
        headerAction={
          <Dialog
            onOpenChange={(open) => {
              if (open) setGuideStep(1);
            }}
          >
            <DialogTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="size-5 text-muted-foreground hover:text-foreground"
                >
                  <InfoIcon className="size-3.5" />
                </Button>
              }
            />
            <DialogContent className="max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-[18px]">
                  <MonitorIcon className="size-5 text-primary" />
                  Connections Guide
                </DialogTitle>
                <DialogDescription className="text-[13px]">
                  Setup Steps — Step {guideStep} of 4
                </DialogDescription>
              </DialogHeader>
              <DialogPanel className="space-y-6 pt-5 pb-3">
                {guideStep === 1 && (
                  <div className="space-y-4 text-center py-4">
                    <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                      <MonitorIcon className="size-8" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[16px] font-bold text-foreground">
                        1. Expose Host Environment
                      </h4>
                      <p className="text-[13px] text-muted-foreground leading-relaxed px-6">
                        Navigate to the target remote server's settings panel, switch to{" "}
                        <strong>Connections</strong>, and enable the <strong>Network Access</strong>{" "}
                        toggle.
                      </p>
                    </div>
                  </div>
                )}

                {guideStep === 2 && (
                  <div className="space-y-4 text-center py-4">
                    <div className="mx-auto size-16 rounded-full bg-success/10 flex items-center justify-center border border-success/20 text-success">
                      <ShieldCheckIcon className="size-8" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[16px] font-bold text-foreground">
                        2. Configure Secure Mesh (Tailscale)
                      </h4>
                      <p className="text-[13px] text-muted-foreground leading-relaxed px-6">
                        Ensure Tailscale is installed and running on both devices to map a secure
                        encrypted connection without firewall modifications.
                      </p>
                    </div>
                  </div>
                )}

                {guideStep === 3 && (
                  <div className="space-y-4 text-center py-4">
                    <div className="mx-auto size-16 rounded-full bg-info/10 flex items-center justify-center border border-info/20 text-info">
                      <Link2Icon className="size-8" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[16px] font-bold text-foreground">
                        3. Connect on Client Editor
                      </h4>
                      <p className="text-[13px] text-muted-foreground leading-relaxed px-6">
                        On your local machine, choose <strong>Add environment</strong>, enter the
                        remote server IP or MagicDNS address, and press connect.
                      </p>
                    </div>
                  </div>
                )}

                {guideStep === 4 && (
                  <div className="space-y-4 text-center py-4">
                    <div className="mx-auto size-16 rounded-full bg-success/10 flex items-center justify-center border border-success/20 text-success">
                      <LockIcon className="size-8" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[16px] font-bold text-foreground">
                        4. Authorize Session
                      </h4>
                      <p className="text-[13px] text-muted-foreground leading-relaxed px-6">
                        Input the pairing authorization codes to complete credentials exchange.
                        Connections are end-to-end encrypted.
                      </p>
                    </div>
                  </div>
                )}

                {/* Navigation Controls */}
                <div className="flex items-center justify-between pt-5 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setGuideStep((s) => Math.max(1, s - 1))}
                    className={cn(
                      "text-xs h-8 gap-1 pl-1.5 pr-2.5",
                      guideStep === 1 && "invisible",
                    )}
                  >
                    <ChevronLeftIcon className="size-4" />
                    Back
                  </Button>

                  {/* Pagination Dots */}
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <span
                        key={step}
                        onClick={() => setGuideStep(step)}
                        className={cn(
                          "size-1.5 rounded-full transition-all cursor-pointer",
                          guideStep === step
                            ? "bg-primary scale-125"
                            : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                        )}
                      />
                    ))}
                  </div>

                  {guideStep < 4 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setGuideStep((s) => Math.min(4, s + 1))}
                      className="text-xs h-8 gap-1 pl-2.5 pr-1.5"
                    >
                      Next
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  ) : (
                    <DialogClose
                      render={
                        <Button size="sm" variant="secondary" className="text-xs h-8">
                          Finish
                        </Button>
                      }
                    />
                  )}
                </div>
              </DialogPanel>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="px-6 py-12 text-center border-t border-border/60 first:border-t-0">
          <div className="mx-auto max-w-sm space-y-3">
            <h3 className="text-sm font-semibold text-foreground">No saved remote environments</h3>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Connect to remote servers, virtual machines, or other instances of the editor running
              in different environments.
            </p>
            <div className="pt-2">
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger
                  render={
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 gap-1.5 font-semibold"
                    >
                      <PlusIcon className="size-3.5" />
                      Add environment
                    </Button>
                  }
                />
                <DialogContent className="max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-[18px]">
                      <MonitorIcon className="size-5 text-primary" />
                      Add Environment
                    </DialogTitle>
                    <DialogDescription className="text-[13px]">
                      {!isTailscaleReady
                        ? "Prerequisite Required"
                        : "Pair another environment to this client."}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogPanel className="space-y-6 pt-2 pb-3">
                    {!isTailscaleReady ? (
                      <div className="space-y-4 text-center py-4">
                        <div className="mx-auto size-16 rounded-full bg-warning/10 flex items-center justify-center border border-warning/20 text-warning">
                          <TriangleAlertIcon className="size-8 text-amber-500" />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-[16px] font-bold text-foreground">
                            Tailscale Connection Required
                          </h4>
                          <p className="text-[13px] text-muted-foreground leading-relaxed px-6">
                            Connecting to remote environments requires an active mesh network.
                            Please install and connect Tailscale under **This Environment** before
                            continuing.
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-4 border-t border-border/40 w-full">
                          <DialogClose
                            render={
                              <Button size="sm" variant="ghost" className="text-xs h-8">
                                Cancel
                              </Button>
                            }
                          />
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setIsAddOpen(false);
                              openUrl("https://tailscale.com/download");
                            }}
                            className="text-xs h-8 font-semibold bg-amber-500 hover:bg-amber-600 border-amber-600 text-white"
                          >
                            Get Tailscale
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Connection Type Toggle */}
                        <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 rounded-lg border border-border/60">
                          <button
                            type="button"
                            onClick={() => setAddMode("remote")}
                            className={cn(
                              "flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all",
                              addMode === "remote"
                                ? "bg-background text-foreground shadow-xs border border-border/40"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <Link2Icon className="size-3.5" />
                            Remote link
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddMode("ssh")}
                            className={cn(
                              "flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all",
                              addMode === "ssh"
                                ? "bg-background text-foreground shadow-xs border border-border/40"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <TerminalIcon className="size-3.5" />
                            SSH Connection
                          </button>
                        </div>

                        {/* Fields */}
                        {addMode === "remote" ? (
                          <div className="space-y-4 text-left">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-foreground">
                                Backend Host Address
                              </label>
                              <Input
                                value={remoteHost}
                                onChange={(e) => setRemoteHost(e.target.value)}
                                placeholder="e.g. https://my-server.tailnet.ts.net"
                                className="text-xs h-9 bg-background/50"
                              />
                              <span className="text-[11px] text-muted-foreground block mt-0.5">
                                Enter the URL or MagicDNS address of your remote editor instance.
                              </span>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-foreground">
                                Pairing Code
                              </label>
                              <Input
                                type="password"
                                value={pairingCode}
                                onChange={(e) => setPairingCode(e.target.value)}
                                placeholder="Enter pairing verification token"
                                className="text-xs h-9 bg-background/50"
                              />
                              <span className="text-[11px] text-muted-foreground block mt-0.5">
                                The access token shown in the host environment settings.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 text-left">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2 space-y-1">
                                <label className="text-xs font-semibold text-foreground">
                                  SSH Host / Alias
                                </label>
                                <Input
                                  value={sshHost}
                                  onChange={(e) => setSshHost(e.target.value)}
                                  placeholder="e.g. user@hostname"
                                  className="text-xs h-9 bg-background/50"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-foreground">
                                  Port
                                </label>
                                <Input
                                  value={sshPort}
                                  disabled
                                  placeholder="22"
                                  className="text-xs h-9 bg-background/50"
                                />
                              </div>
                            </div>
                            <span className="text-[11px] text-muted-foreground block">
                              Uses local SSH config files, credentials, and secure port-forwarding
                              tunnels.
                            </span>
                          </div>
                        )}

                        {/* Footer Actions */}
                        <div className="flex items-center justify-end gap-2 pt-5 border-t border-border/40">
                          <DialogClose
                            render={
                              <Button size="sm" variant="ghost" className="text-xs h-8">
                                Cancel
                              </Button>
                            }
                          />
                          <Button
                            size="sm"
                            variant="default"
                            onClick={handleAddEnvironment}
                            disabled={addMode === "remote" ? !remoteHost || !pairingCode : !sshHost}
                            className="text-xs h-8 font-semibold"
                          >
                            Add environment
                          </Button>
                        </div>
                      </>
                    )}
                  </DialogPanel>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </SettingsSection>

      <p className="text-xs text-muted-foreground/60 px-0.5">
        Remote environments let Tabs connect to other machines, VMs, or instances running the editor. Use Tailscale for secure encrypted access without port forwarding.
      </p>
    </div>
  );
}
