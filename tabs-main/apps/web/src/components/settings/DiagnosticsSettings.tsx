import type {
  ServerProcessDiagnosticsResult,
  ServerProcessResourceHistoryResult,
} from "@tabs/contracts";
import * as Option from "effect/Option";
import { ActivityIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ensureNativeApi } from "../../nativeApi";
import { Button } from "../ui/button";
import { SettingsHeaderPortal, SettingsSection } from "../../routes/_chat.settings";

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  if (value < 1_073_741_824) return `${(value / 1_048_576).toFixed(1)} MB`;
  return `${(value / 1_073_741_824).toFixed(2)} GB`;
}

export function DiagnosticsSettings() {
  const [processes, setProcesses] = useState<ServerProcessDiagnosticsResult | null>(null);
  const [history, setHistory] = useState<ServerProcessResourceHistoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = ensureNativeApi();
      const [nextProcesses, nextHistory] = await Promise.all([
        api.server.getProcessDiagnostics(),
        api.server.getProcessResourceHistory({ windowMs: 15 * 60_000, bucketMs: 30_000 }),
      ]);
      setProcesses(nextProcesses);
      setHistory(nextHistory);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Diagnostics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-[28px] font-bold leading-relaxed text-foreground">Diagnostics</h2>
        <p className="text-sm text-muted-foreground">
          Inspect resource use by the active environment and its provider or terminal processes.
        </p>
        <SettingsHeaderPortal>
          <Button size="xs" variant="outline" disabled={loading} onClick={() => void refresh()}>
            <RefreshCwIcon className={`mr-1 size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </SettingsHeaderPortal>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <SettingsSection title="Backend resources">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
          <Metric label="Processes" value={String(processes?.processCount ?? "—")} />
          <Metric
            label="Total CPU"
            value={processes ? `${processes.totalCpuPercent.toFixed(1)}%` : "—"}
          />
          <Metric
            label="Total memory"
            value={processes ? formatBytes(processes.totalRssBytes) : "—"}
          />
          <Metric label="Samples" value={String(history?.retainedSampleCount ?? "—")} />
        </div>
        {processes && Option.isSome(processes.error) ? (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {processes.error.value.message}
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Process tree">
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Tabs backend process resource usage</caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Process
                </th>
                <th scope="col" className="px-3 py-2">
                  PID
                </th>
                <th scope="col" className="px-3 py-2">
                  CPU
                </th>
                <th scope="col" className="px-3 py-2">
                  Memory
                </th>
                <th scope="col" className="px-3 py-2">
                  Elapsed
                </th>
              </tr>
            </thead>
            <tbody>
              {processes?.processes.map((process) => (
                <tr key={process.pid} className="border-t border-border/50">
                  <td
                    className="max-w-[32rem] truncate px-3 py-2 font-mono"
                    style={{ paddingInlineStart: `${12 + process.depth * 16}px` }}
                    title={process.command}
                  >
                    {process.command}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{process.pid}</td>
                  <td className="px-3 py-2 tabular-nums">{process.cpuPercent.toFixed(1)}%</td>
                  <td className="px-3 py-2 tabular-nums">{formatBytes(process.rssBytes)}</td>
                  <td className="px-3 py-2 tabular-nums">{process.elapsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ActivityIcon className="size-3" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
