import { useCallback, useState } from "react";
import {
  CameraIcon,
  Columns2Icon,
  CopyIcon,
  ExternalLinkIcon,
  LaptopIcon,
  LayersIcon,
  Link2Icon,
  Link2OffIcon,
  RefreshCwIcon,
  Rows2Icon,
  SmartphoneIcon,
  TabletIcon,
  UserCheckIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { toastManager } from "~/components/ui/toast";

export type ComparisonMode = "responsive" | "profiles" | "routes";

export interface ViewportPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: "mobile" | "tablet" | "desktop";
}

export const COMPARISON_VIEWPORTS: readonly ViewportPreset[] = [
  { id: "mobile-sm", name: "iPhone SE", width: 375, height: 667, icon: "mobile" },
  { id: "mobile-md", name: "iPhone 14", width: 390, height: 844, icon: "mobile" },
  { id: "mobile-lg", name: "Pixel 7", width: 412, height: 915, icon: "mobile" },
  { id: "tablet-md", name: "iPad Mini", width: 768, height: 1024, icon: "tablet" },
  { id: "tablet-lg", name: "iPad Pro", width: 1024, height: 1366, icon: "tablet" },
  { id: "desktop-sm", name: "Laptop (1366)", width: 1366, height: 768, icon: "desktop" },
  { id: "desktop-md", name: "Desktop (1080p)", width: 1920, height: 1080, icon: "desktop" },
];

export interface BrowserComparisonViewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sessionId?: string | undefined;
  primaryUrl: string;
  primaryProfileId?: string | undefined;
}

export function BrowserComparisonView({
  isOpen,
  onOpenChange,
  projectId,
  sessionId,
  primaryUrl,
  primaryProfileId = "default",
}: BrowserComparisonViewProps) {
  const bridge = window.desktopBridge;

  // Comparison State
  const [mode, setMode] = useState<ComparisonMode>("responsive");
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [syncScroll, setSyncScroll] = useState(true);

  // Pane A (Left/Top)
  const [urlA, setUrlA] = useState(primaryUrl);
  const [viewportA, setViewportA] = useState<ViewportPreset>(COMPARISON_VIEWPORTS[1]!); // iPhone 14
  const [profileA, setProfileA] = useState(primaryProfileId);

  // Pane B (Right/Bottom)
  const [urlB, setUrlB] = useState(primaryUrl);
  const [viewportB, setViewportB] = useState<ViewportPreset>(COMPARISON_VIEWPORTS[5]!); // Laptop
  const [profileB, setProfileB] = useState("guest");

  const [reloadKey, setReloadKey] = useState(0);
  const [capturing, setCapturing] = useState(false);

  const swapPanes = useCallback(() => {
    setUrlA(urlB);
    setUrlB(urlA);
    setViewportA(viewportB);
    setViewportB(viewportA);
    setProfileA(profileB);
    setProfileB(profileA);
  }, [urlA, urlB, viewportA, viewportB, profileA, profileB]);

  const reloadBoth = useCallback(() => {
    setReloadKey((k) => k + 1);
    toastManager.add({
      type: "info",
      title: "Reloading comparison panes",
      description: "Both comparison views are refreshing.",
    });
  }, []);

  const captureComparison = useCallback(async () => {
    if (!bridge) return;
    setCapturing(true);
    try {
      const artifact = await bridge.captureBrowserScreenshot({ projectId, sessionId });
      if (artifact?.path) {
        await bridge.copyBrowserArtifactToClipboard(artifact.path);
        toastManager.add({
          type: "success",
          title: "Comparison captured & copied",
          description: "Saved comparison screenshot to clipboard.",
        });
      }
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not capture screenshot",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCapturing(false);
    }
  }, [bridge, projectId, sessionId]);

  const renderIcon = (iconType: ViewportPreset["icon"]) => {
    switch (iconType) {
      case "mobile":
        return <SmartphoneIcon className="size-3" />;
      case "tablet":
        return <TabletIcon className="size-3" />;
      case "desktop":
        return <LaptopIcon className="size-3" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <Columns2Icon className="size-4 text-primary" />
            <DialogTitle className="text-sm font-semibold">Side-by-Side Browser Comparison</DialogTitle>
            <Badge variant="outline" className="text-[11px] capitalize">
              {mode}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mode selection buttons */}
            <div className="flex rounded-md border bg-background/50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("responsive")}
                className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                  mode === "responsive" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <SmartphoneIcon className="size-3" />
                <span>Responsive</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("profiles")}
                className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                  mode === "profiles" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UsersIcon className="size-3" />
                <span>Multi-Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("routes")}
                className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                  mode === "routes" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayersIcon className="size-3" />
                <span>Routes</span>
              </button>
            </div>

            {/* Split orientation */}
            <div className="flex rounded-md border bg-background/50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setOrientation("horizontal")}
                className={`p-1 rounded ${orientation === "horizontal" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Side-by-side (columns)"
              >
                <Columns2Icon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOrientation("vertical")}
                className={`p-1 rounded ${orientation === "vertical" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Stacked (rows)"
              >
                <Rows2Icon className="size-3.5" />
              </button>
            </div>

            {/* Sync toggle */}
            <Button
              type="button"
              size="xs"
              variant={syncScroll ? "secondary" : "outline"}
              onClick={() => setSyncScroll(!syncScroll)}
              className="gap-1 text-xs"
              title="Synchronize scrolling between panes"
            >
              {syncScroll ? <Link2Icon className="size-3 text-primary" /> : <Link2OffIcon className="size-3" />}
              <span>Sync</span>
            </Button>

            {/* Reload button */}
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={reloadBoth}
              title="Refresh both panes"
            >
              <RefreshCwIcon className="size-3.5" />
            </Button>

            {/* Capture button */}
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={capturing}
              onClick={() => void captureComparison()}
              className="gap-1 text-xs"
            >
              <CameraIcon className="size-3.5" />
              <span>Snapshot</span>
            </Button>

            <DialogClose
              render={
                <Button type="button" size="icon-xs" variant="ghost">
                  <XIcon className="size-4" />
                </Button>
              }
            />
          </div>
        </div>

        {/* Viewport comparison area */}
        <div
          className={`flex-1 min-h-0 grid gap-2 p-3 bg-muted/20 ${
            orientation === "horizontal" ? "grid-cols-2" : "grid-rows-2"
          }`}
        >
          {/* Pane A */}
          <div className="flex flex-col rounded-lg border bg-background overflow-hidden shadow-xs">
            <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/40 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
                  Pane A
                </Badge>
                {mode === "responsive" && (
                  <select
                    className="h-6 rounded border bg-background px-1.5 text-[11px]"
                    value={viewportA.id}
                    onChange={(e) => {
                      const v = COMPARISON_VIEWPORTS.find((vp) => vp.id === e.target.value);
                      if (v) setViewportA(v);
                    }}
                  >
                    {COMPARISON_VIEWPORTS.map((vp) => (
                      <option key={vp.id} value={vp.id}>
                        {vp.name} ({vp.width}x{vp.height})
                      </option>
                    ))}
                  </select>
                )}
                {mode === "profiles" && (
                  <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                    <UserCheckIcon className="size-2.5 text-emerald-500" />
                    <span>Profile: {profileA}</span>
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <span>{viewportA.width}x{viewportA.height}</span>
              </div>
            </div>

            {/* Address bar for Pane A (editable in routes mode) */}
            {mode === "routes" && (
              <div className="border-b px-2 py-1">
                <Input
                  className="h-6 font-mono text-[11px]"
                  value={urlA}
                  onChange={(e) => setUrlA(e.target.value)}
                  placeholder="URL for Pane A"
                />
              </div>
            )}

            {/* Preview Frame A */}
            <div className="flex-1 min-h-0 bg-muted/10 flex items-center justify-center p-2 overflow-auto">
              <div
                style={{
                  width: mode === "responsive" ? `${viewportA.width}px` : "100%",
                  height: mode === "responsive" ? `${viewportA.height}px` : "100%",
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
                className="relative rounded border bg-background shadow-xs overflow-hidden flex flex-col"
              >
                <div className="h-4 bg-muted/60 border-b flex items-center gap-1 px-2">
                  <span className="size-1.5 rounded-full bg-red-400" />
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-[9px] text-muted-foreground truncate">
                    {urlA}
                  </span>
                </div>
                <iframe
                  key={`pane-a-${reloadKey}`}
                  src={urlA}
                  title="Comparison Pane A"
                  className="w-full flex-1 border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                />
              </div>
            </div>
          </div>

          {/* Pane B */}
          <div className="flex flex-col rounded-lg border bg-background overflow-hidden shadow-xs">
            <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/40 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
                  Pane B
                </Badge>
                {mode === "responsive" && (
                  <select
                    className="h-6 rounded border bg-background px-1.5 text-[11px]"
                    value={viewportB.id}
                    onChange={(e) => {
                      const v = COMPARISON_VIEWPORTS.find((vp) => vp.id === e.target.value);
                      if (v) setViewportB(v);
                    }}
                  >
                    {COMPARISON_VIEWPORTS.map((vp) => (
                      <option key={vp.id} value={vp.id}>
                        {vp.name} ({vp.width}x{vp.height})
                      </option>
                    ))}
                  </select>
                )}
                {mode === "profiles" && (
                  <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                    <UsersIcon className="size-2.5 text-primary" />
                    <span>Profile: {profileB}</span>
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <span>{viewportB.width}x{viewportB.height}</span>
              </div>
            </div>

            {/* Address bar for Pane B (editable in routes mode) */}
            {mode === "routes" && (
              <div className="border-b px-2 py-1">
                <Input
                  className="h-6 font-mono text-[11px]"
                  value={urlB}
                  onChange={(e) => setUrlB(e.target.value)}
                  placeholder="URL for Pane B"
                />
              </div>
            )}

            {/* Preview Frame B */}
            <div className="flex-1 min-h-0 bg-muted/10 flex items-center justify-center p-2 overflow-auto">
              <div
                style={{
                  width: mode === "responsive" ? `${viewportB.width}px` : "100%",
                  height: mode === "responsive" ? `${viewportB.height}px` : "100%",
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
                className="relative rounded border bg-background shadow-xs overflow-hidden flex flex-col"
              >
                <div className="h-4 bg-muted/60 border-b flex items-center gap-1 px-2">
                  <span className="size-1.5 rounded-full bg-red-400" />
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-[9px] text-muted-foreground truncate">
                    {urlB}
                  </span>
                </div>
                <iframe
                  key={`pane-b-${reloadKey}`}
                  src={urlB}
                  title="Comparison Pane B"
                  className="w-full flex-1 border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer controls & info */}
        <div className="flex items-center justify-between border-t px-4 py-2 bg-muted/30 text-xs shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <span>Mode: <strong>{mode}</strong></span>
            <span>·</span>
            <span>
              {mode === "responsive"
                ? `Comparing ${viewportA.name} vs ${viewportB.name}`
                : mode === "profiles"
                  ? `Comparing profile "${profileA}" vs "${profileB}"`
                  : `Comparing routes side-by-side`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={swapPanes}
              className="text-xs"
            >
              Swap Panes
            </Button>
            <DialogClose
              render={
                <Button type="button" size="xs" variant="default">
                  Done
                </Button>
              }
            />
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
