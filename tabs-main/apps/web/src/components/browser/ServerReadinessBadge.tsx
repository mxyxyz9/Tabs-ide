import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  RadioIcon,
  RefreshCwIcon,
  ServerIcon,
  WifiOffIcon,
} from "lucide-react";
import type { EnvironmentId } from "@tabs/contracts";
import { isLoopbackHost } from "@tabs/shared/preview";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { useDiscoveredLocalServers } from "./useDiscoveredLocalServers";

export type ServerReadinessState = "ready" | "probing" | "offline" | "not_local";

export interface ServerProbeResult {
  state: ServerReadinessState;
  latencyMs?: number;
  httpStatus?: number;
  lastProbedAt?: string;
  error?: string;
}

export async function probeServerReadiness(
  url: string,
  timeoutMs = 2500,
): Promise<ServerProbeResult> {
  try {
    const parsed = new URL(url);
    if (!isLoopbackHost(parsed.hostname)) {
      return { state: "not_local" };
    }

    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(parsed.origin, {
        method: "HEAD",
        signal: controller.signal,
        mode: "no-cors",
      });
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);
      return {
        state: "ready",
        latencyMs,
        httpStatus: res.status || 200,
        lastProbedAt: new Date().toISOString(),
      };
    } catch (cause) {
      clearTimeout(timer);
      return {
        state: "offline",
        lastProbedAt: new Date().toISOString(),
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  } catch {
    return { state: "not_local" };
  }
}

interface ServerReadinessBadgeProps {
  currentUrl?: string | undefined;
  environmentId?: EnvironmentId | null | undefined;
  onNavigateToUrl?: (url: string) => void;
  onReload?: () => void;
}

export function ServerReadinessBadge({
  currentUrl,
  environmentId = null,
  onNavigateToUrl,
  onReload,
}: ServerReadinessBadgeProps) {
  const [probeResult, setProbeResult] = useState<ServerProbeResult>({ state: "probing" });
  const [autoReload, setAutoReload] = useState(true);
  const [probing, setProbing] = useState(false);
  const previousStateRef = useRef<ServerReadinessState>("probing");

  const discoveredServers = useDiscoveredLocalServers({
    environmentId: environmentId ?? null,
    configuredUrls: currentUrl ? [currentUrl] : [],
  });

  const parsedUrl = (() => {
    try {
      return currentUrl ? new URL(currentUrl) : null;
    } catch {
      return null;
    }
  })();

  const isLocal = Boolean(parsedUrl && isLoopbackHost(parsedUrl.hostname));
  const currentPort = parsedUrl?.port || (parsedUrl?.protocol === "https:" ? "443" : "80");

  const runProbe = useCallback(async () => {
    if (!currentUrl || !isLocal) {
      setProbeResult({ state: "not_local" });
      return;
    }

    setProbing(true);
    const res = await probeServerReadiness(currentUrl);
    setProbeResult(res);
    setProbing(false);

    // If server just became ready and autoReload is active, reload page
    if (previousStateRef.current === "offline" && res.state === "ready" && autoReload) {
      onReload?.();
    }
    previousStateRef.current = res.state;
  }, [currentUrl, isLocal, autoReload, onReload]);

  useEffect(() => {
    if (!isLocal) return;
    void runProbe();

    // Poll every 4 seconds when offline or probing, or every 15 seconds when ready
    const intervalMs = probeResult.state === "ready" ? 15000 : 4000;
    const timer = setInterval(() => {
      void runProbe();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isLocal, currentUrl, probeResult.state, runProbe]);

  // Don't render badge if not on loopback and no local servers discovered
  if (!isLocal && discoveredServers.length === 0) {
    return null;
  }

  const badgeVariant =
    probeResult.state === "ready"
      ? "outline"
      : probeResult.state === "probing" || probing
        ? "secondary"
        : "destructive";

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-[11px] font-medium"
            title={`Local dev server on port ${currentPort}: ${probeResult.state}. Click to inspect servers.`}
          >
            {probeResult.state === "ready" ? (
              <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono">{currentPort}</span>
              </span>
            ) : probeResult.state === "probing" || probing ? (
              <span className="flex items-center gap-1 text-amber-500">
                <RadioIcon className="size-3 animate-spin" />
                <span className="font-mono">{currentPort}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-500">
                <WifiOffIcon className="size-3" />
                <span className="font-mono">{currentPort}</span>
              </span>
            )}
          </Button>
        }
      />
      <MenuPopup align="start" className="w-80 p-1 text-xs">
        <div className="flex items-center justify-between border-b px-2 py-1.5 pb-2">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ServerIcon className="size-3.5 text-primary" />
            <span>Local Server Status</span>
          </div>
          <Badge variant={badgeVariant} className="text-[10px] capitalize">
            {probing ? "probing..." : probeResult.state}
          </Badge>
        </div>

        <div className="space-y-1.5 p-2 text-[11px] text-muted-foreground">
          <div className="flex justify-between">
            <span>Target Host:</span>
            <span className="font-mono font-medium text-foreground">
              {parsedUrl ? `${parsedUrl.hostname}:${currentPort}` : "none"}
            </span>
          </div>
          {probeResult.latencyMs !== undefined && (
            <div className="flex justify-between">
              <span>Readiness Latency:</span>
              <span className="font-mono text-emerald-500">{probeResult.latencyMs} ms</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span>Auto-reload on connect:</span>
            <input
              type="checkbox"
              checked={autoReload}
              onChange={(e) => setAutoReload(e.target.checked)}
              className="size-3.5 rounded accent-primary"
            />
          </div>
        </div>

        {discoveredServers.length > 0 && (
          <>
            <MenuSeparator />
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Discovered Project Servers
            </div>
            {discoveredServers.map((server) => {
              const isCurrent = server.port === Number(currentPort);
              return (
                <MenuItem
                  key={`${server.host}:${server.port}`}
                  onClick={() => onNavigateToUrl?.(server.requestedUrl || server.url)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2Icon
                      className={`size-3 ${isCurrent ? "text-primary" : "opacity-0"}`}
                    />
                    <span className="font-mono font-medium">{server.port}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({server.processName || "server"}
                      {server.pid ? ` · pid ${server.pid}` : ""})
                    </span>
                  </div>
                  <ExternalLinkIcon className="size-3 text-muted-foreground" />
                </MenuItem>
              );
            })}
          </>
        )}

        <MenuSeparator />
        <div className="flex items-center justify-between gap-1 p-1">
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="h-6 w-full text-[11px]"
            onClick={() => void runProbe()}
            disabled={probing}
          >
            <RefreshCwIcon className={`mr-1 size-3 ${probing ? "animate-spin" : ""}`} />
            Probe Now
          </Button>
          {onReload && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="h-6 w-full text-[11px]"
              onClick={() => onReload()}
            >
              Reload Tab
            </Button>
          )}
        </div>
      </MenuPopup>
    </Menu>
  );
}
