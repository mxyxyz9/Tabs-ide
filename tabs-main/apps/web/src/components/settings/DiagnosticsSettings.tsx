import type {
  BackgroundActivityProfile,
  ServerProcessDiagnosticsResult,
  ServerProcessResourceHistoryResult,
  ServerTraceDiagnosticsResult,
} from "@tabs/contracts";
import * as Option from "effect/Option";
import { ActivityIcon, DownloadIcon, RefreshCwIcon } from "lucide-react";
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
  const [traces, setTraces] = useState<ServerTraceDiagnosticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backgroundProfile, setBackgroundProfile] = useState<BackgroundActivityProfile>("balanced");
  const [exporting, setExporting] = useState(false);

  const exportSupportBundle = useCallback(async () => {
    setExporting(true);
    try {
      const bundle = await ensureNativeApi().server.createSupportBundle();
      const url = URL.createObjectURL(new Blob([bundle.content], { type: bundle.mediaType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = bundle.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The support bundle could not be created.");
    } finally {
      setExporting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = ensureNativeApi();
      const [nextProcesses, nextHistory, nextTraces, settings] = await Promise.all([
        api.server.getProcessDiagnostics(),
        api.server.getProcessResourceHistory({ windowMs: 15 * 60_000, bucketMs: 30_000 }),
        api.server.getTraceDiagnostics(),
        api.server.getSettings(),
      ]);
      setProcesses(nextProcesses);
      setHistory(nextHistory);
      setTraces(nextTraces);
      setBackgroundProfile(
        settings.backgroundActivity.profile === "custom"
          ? (settings.backgroundActivity.baseProfile ?? "balanced")
          : settings.backgroundActivity.profile,
      );
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
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={exporting}
              onClick={() => void exportSupportBundle()}
            >
              <DownloadIcon className="mr-1 size-3.5" />
              {exporting ? "Exporting…" : "Export support bundle"}
            </Button>
            <Button size="xs" variant="outline" disabled={loading} onClick={() => void refresh()}>
              <RefreshCwIcon className={`mr-1 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
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

      <SettingsSection title="Background activity">
        <p className="mb-3 text-xs text-muted-foreground">
          Balance provider checks and repository refreshes against power consumption for this
          environment.
        </p>
        <div role="group" aria-label="Background activity profile" className="flex flex-wrap gap-2">
          {(["battery-saver", "balanced", "performance"] as const).map((profile) => (
            <Button
              key={profile}
              size="sm"
              variant={backgroundProfile === profile ? "default" : "outline"}
              aria-pressed={backgroundProfile === profile}
              onClick={async () => {
                await ensureNativeApi().server.updateSettings({
                  backgroundActivity: { schemaVersion: 1, profile, overrides: {} },
                  backgroundActivityProfile: profile,
                });
                setBackgroundProfile(profile);
              }}
            >
              {profile === "battery-saver"
                ? "Battery saver"
                : profile[0]!.toUpperCase() + profile.slice(1)}
            </Button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Structured traces">
        <p className="mb-3 break-all text-xs text-muted-foreground">
          {traces?.traceFilePath ?? "Trace storage is loading…"}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
          <Metric label="Spans" value={String(traces?.recordCount ?? "—")} />
          <Metric label="Failures" value={String(traces?.failureCount ?? "—")} />
          <Metric label="Interruptions" value={String(traces?.interruptionCount ?? "—")} />
          <Metric label="Slow spans" value={String(traces?.slowSpanCount ?? "—")} />
        </div>
        {traces && Option.isSome(traces.error) ? (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {traces.error.value.message}
          </p>
        ) : null}
        {traces && Option.isSome(traces.partialFailure) ? (
          <p role="status" className="mt-3 text-xs text-warning">
            Some rotated trace files could not be read, so these diagnostics are incomplete.
          </p>
        ) : null}
        {traces && traces.topSpansByCount.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Most frequent structured trace spans</caption>
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Span
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Count
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Failures
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Average
                  </th>
                </tr>
              </thead>
              <tbody>
                {traces.topSpansByCount.map((span) => (
                  <tr key={span.name} className="border-t border-border/50">
                    <td className="px-3 py-2 font-mono">{span.name}</td>
                    <td className="px-3 py-2 tabular-nums">{span.count}</td>
                    <td className="px-3 py-2 tabular-nums">{span.failureCount}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {span.averageDurationMs.toFixed(1)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  Owner
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
                  <td className="px-3 py-2">
                    <span
                      className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
                      title={process.attribution}
                    >
                      {process.category}
                    </span>
                  </td>
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
