import { useMemo } from "react";
import { useAtomValue } from "@effect/atom-react";
import type { ServerProviderUsageSnapshot } from "@tabs/contracts";
import { providerUsageSnapshotsAtom } from "../../../state/usage";
import { serverSettingsAtom } from "../../../state/settings";
import { ProviderQuotaCard } from "./ProviderQuotaCard";
import { InfoIcon, LoaderIcon } from "lucide-react";

const ALL_ACP_PROVIDERS = [
  "codex",
  "claudeAgent",
  "cursor",
  "copilot",
  "grok",
  "gemini",
  "opencode",
  "droid",
  "kilo",
  "antigravity",
  "openrouter",
] as const;

export function LimitsTab() {
  const snapshotsState = useAtomValue(providerUsageSnapshotsAtom);
  const serverSettings = useAtomValue(serverSettingsAtom);

  const snapshots = snapshotsState.data ?? [];
  const snapshotsByProvider = useMemo(() => {
    const map = new Map<string, ServerProviderUsageSnapshot>();
    for (const snap of snapshots) {
      map.set(snap.provider, snap);
    }
    return map;
  }, [snapshots]);

  // Providers list ordered by standard ACP list with connected providers prioritized
  const providerCards = useMemo(() => {
    const cards = ALL_ACP_PROVIDERS.map((provider) => {
      const existing = snapshotsByProvider.get(provider);
      const isEnabled = (serverSettings.providers as any)?.[provider]?.enabled !== false;

      if (existing) {
        return { snapshot: existing, isEnabled };
      }

      // Default fallback snapshot for unprobed / newly added provider
      const fallback: ServerProviderUsageSnapshot = {
        provider: provider as any,
        updatedAt: new Date().toISOString(),
        source: "local",
        status: "ok",
        planName: undefined,
        limits: [],
        usageLines: [],
      };
      return { snapshot: fallback, isEnabled };
    });

    return [...cards].sort((a, b) => {
      const aConnected =
        a.snapshot.status === "ok" &&
        (a.snapshot.limits.length > 0 || a.snapshot.planName || a.snapshot.email);
      const bConnected =
        b.snapshot.status === "ok" &&
        (b.snapshot.limits.length > 0 || b.snapshot.planName || b.snapshot.email);
      if (aConnected && !bConnected) return -1;
      if (!aConnected && bConnected) return 1;

      const aAuth = a.snapshot.status !== "needs-auth" && a.snapshot.status !== "error";
      const bAuth = b.snapshot.status !== "needs-auth" && b.snapshot.status !== "error";
      if (aAuth && !bAuth) return -1;
      if (!aAuth && bAuth) return 1;

      if (a.isEnabled && !b.isEnabled) return -1;
      if (!a.isEnabled && b.isEnabled) return 1;

      return 0;
    });
  }, [snapshotsByProvider, serverSettings.providers]);

  return (
    <div className="space-y-6">
      {snapshotsState.loading && snapshots.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <LoaderIcon className="size-6 animate-spin" />
          <span className="text-sm">Fetching live provider quotas and limits...</span>
        </div>
      ) : (
        <>
          {/* Quota Cards Stack */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {providerCards.map(({ snapshot, isEnabled }) => (
              <ProviderQuotaCard
                key={snapshot.provider}
                snapshot={snapshot}
                isEnabled={isEnabled}
              />
            ))}
          </div>

          {/* Footer Note */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground backdrop-blur-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="leading-relaxed">
              Usage is read locally from each provider CLI&apos;s stored credentials and fetched
              directly from the provider. Short-lived tokens are refreshed through the provider&apos;s
              own CLI or official token endpoint.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
