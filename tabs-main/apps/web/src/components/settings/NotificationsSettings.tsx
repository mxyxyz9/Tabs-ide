import React, { useState, useCallback, useEffect } from "react";
import {
  BellIcon,
  BellOffIcon,
  CheckCheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  HelpCircleIcon,
  InfoIcon,
  LoaderCircleIcon,
  SendIcon,
  SparklesIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import {
  clearNotificationHistory,
  fireSystemNotification,
  getOsNotificationsEnabled,
  markAllNotificationsRead,
  markNotificationRead,
  requestOsNotificationPermission,
  setOsNotificationCategory,
  setOsNotificationsEnabled,
  useNotificationEntries,
  useOsNotificationCategories,
  useOsNotificationsEnabled,
  type NotificationSeverity,
  type OsNotificationCategory,
} from "~/stores/notificationStore";
import {
  SettingsSection,
  SettingsSectionHeader,
  SettingsRow,
} from "~/components/settings/SettingsLayout";
import { toastManager } from "~/components/ui/toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const deltaSec = Math.floor((Date.now() - timestamp) / 1000);
  if (deltaSec < 5) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  return `${Math.floor(deltaHr / 24)}d ago`;
}

const SEVERITY_ICONS: Record<NotificationSeverity, React.FC<{ className?: string }>> = {
  success: CircleCheckIcon,
  info: InfoIcon,
  warning: TriangleAlertIcon,
  error: CircleAlertIcon,
  loading: LoaderCircleIcon,
};

const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  error: "text-destructive",
  loading: "text-muted-foreground",
};

const SEVERITY_BG: Record<NotificationSeverity, string> = {
  success: "bg-success/10 border-success/20",
  info: "bg-info/10 border-info/20",
  warning: "bg-warning/10 border-warning/20",
  error: "bg-destructive/10 border-destructive/20",
  loading: "bg-muted/40 border-border",
};

// ─── OS Notification Categories Configuration ─────────────────────────────────

interface CategoryConfigItem {
  key: OsNotificationCategory;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const CATEGORY_ITEMS: CategoryConfigItem[] = [
  {
    key: "error",
    title: "Errors & Failures",
    description: "Alerts for crashed processes, failed runs, and critical errors.",
    icon: CircleAlertIcon,
  },
  {
    key: "warning",
    title: "Warnings",
    description: "Alerts for warnings, resource limits, and non-fatal issues.",
    icon: TriangleAlertIcon,
  },
  {
    key: "agent-waiting-input",
    title: "Agent Questions & Input Needed",
    description: "Alerts when an agent needs user input, confirmation, or answers.",
    icon: HelpCircleIcon,
  },
  {
    key: "agent-turn-complete",
    title: "Task Completed",
    description: "Alerts when a background agent completes its turn or task.",
    icon: SparklesIcon,
  },
  {
    key: "info",
    title: "Informational",
    description: "Alerts for routine background activity and general updates.",
    icon: InfoIcon,
  },
  {
    key: "success",
    title: "Success",
    description: "Alerts for successful file writes and completed actions.",
    icon: CircleCheckIcon,
  },
];

function OsNotificationsSection() {
  const enabled = useOsNotificationsEnabled();
  const categories = useOsNotificationCategories();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const handleToggleMaster = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        setOsNotificationsEnabled(false);
        return;
      }
      if (permission === "unsupported" || permission === "denied") {
        toastManager.add({
          type: "warning",
          title: "Notifications blocked",
          description:
            "Enable notifications for Tabs in your OS/browser notification settings first.",
        });
        return;
      }
      const granted = await requestOsNotificationPermission();
      setPermission(Notification.permission as NotificationPermission);
      if (!granted) {
        toastManager.add({
          type: "warning",
          title: "Permission not granted",
          description: "Notification permission was not granted by your system.",
        });
      }
    },
    [permission],
  );

  const handleSendTest = useCallback(() => {
    fireSystemNotification({
      title: "Tabs Notification Test",
      description: "Desktop alerts and notification history are operating properly!",
      category: "info",
      recordInHistory: true,
    });
    toastManager.add({
      type: "success",
      title: "Test notification dispatched",
      description: "A desktop notification was triggered and added to history.",
    });
  }, []);

  return (
    <>
      <SettingsRow
        title="System notifications"
        description="Show OS-level desktop notifications when Tabs or agents require attention, even when Tabs is running in the background."
        control={
          permission === "unsupported" ? (
            <span className="text-xs text-muted-foreground">Not supported here</span>
          ) : (
            <div className="flex items-center gap-2">
              {permission === "denied" && (
                <span className="text-[11px] text-warning font-medium">Blocked by OS</span>
              )}
              <Switch
                checked={enabled && permission === "granted"}
                onCheckedChange={handleToggleMaster}
                aria-label="Enable system notifications"
                disabled={permission === "denied"}
              />
            </div>
          )
        }
      />

      {enabled && permission === "granted" && (
        <div className="space-y-3 px-4 py-3 bg-muted/20 border-t border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Alert Categories</p>
              <p className="text-[11px] text-muted-foreground">
                Select which event categories send desktop notifications to your system.
              </p>
            </div>
            <Button
              size="xs"
              variant="outline"
              onClick={handleSendTest}
              className="gap-1.5 cursor-pointer text-xs"
              type="button"
            >
              <SendIcon className="size-3" />
              Send test alert
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {CATEGORY_ITEMS.map((item) => {
              const Icon = item.icon;
              const isChecked = Boolean(categories[item.key]);
              return (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-3 p-2.5 rounded-xl border border-border/60 bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 rounded-md bg-muted p-1 text-muted-foreground shrink-0">
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-foreground leading-tight">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isChecked}
                    onCheckedChange={(checked) => setOsNotificationCategory(item.key, checked)}
                    aria-label={`Toggle ${item.title}`}
                    className="shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterType = "all" | NotificationSeverity;

const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: "all", label: "All" },
  { value: "error", label: "Errors" },
  { value: "warning", label: "Warnings" },
  { value: "success", label: "Success" },
  { value: "info", label: "Info" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export function NotificationsSettings() {
  const entries = useNotificationEntries();
  const [filter, setFilter] = useState<FilterType>("all");
  // Tick every 30s to refresh relative timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.type === filter);
  const unreadCount = entries.filter((e) => !e.read).length;

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title="Notifications"
        description="View and manage your notification history. Configure how and when Tabs alerts you."
      />

      {/* ── Settings Section ─────────────────────────────────────── */}
      <SettingsSection title="Notification Settings">
        <OsNotificationsSection />
        <SettingsRow
          title="Auto-dismiss"
          description="Success and info notifications automatically dismiss after 7 seconds. Errors and warnings stay until manually dismissed."
          control={
            <span className="text-xs text-muted-foreground font-medium rounded-full bg-muted px-2.5 py-1">
              7s for success &amp; info
            </span>
          }
        />
      </SettingsSection>

      {/* ── History Section ──────────────────────────────────────── */}
      <SettingsSection title="Notification History">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
          {/* Filter chips */}
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_OPTIONS.map((opt) => {
              const count =
                opt.value === "all"
                  ? entries.length
                  : entries.filter((e) => e.type === opt.value).length;
              if (opt.value !== "all" && count === 0) return null;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                    filter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {opt.label}
                  <span
                    className={cn(
                      "tabular-nums text-[10px]",
                      filter === opt.value ? "opacity-80" : "opacity-60",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          {entries.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => markAllNotificationsRead()}
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                  type="button"
                >
                  <CheckCheckIcon className="size-3.5" />
                  Mark all read
                </Button>
              )}
              <Button
                size="xs"
                variant="ghost"
                onClick={() => clearNotificationHistory()}
                className="text-muted-foreground hover:text-destructive gap-1.5"
                type="button"
              >
                <TrashIcon className="size-3.5" />
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
              {entries.length === 0 ? (
                <BellIcon className="size-5 text-muted-foreground" />
              ) : (
                <BellOffIcon className="size-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {entries.length === 0
                  ? "No notification history"
                  : `No ${filter} notifications`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entries.length === 0
                  ? "Toasts and system alerts will be recorded here."
                  : "Try selecting a different filter above."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((entry) => {
              const Icon = SEVERITY_ICONS[entry.type];
              const iconColor = SEVERITY_COLORS[entry.type];
              const bgClass = SEVERITY_BG[entry.type];

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "group relative flex items-start gap-3.5 px-4 py-3.5 transition-colors",
                    !entry.read && "bg-primary/[0.02]",
                    "hover:bg-accent/40",
                  )}
                >
                  {/* Unread indicator */}
                  {!entry.read && (
                    <span
                      className="absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary"
                      title="Unread"
                    />
                  )}

                  {/* Severity icon badge */}
                  <div
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
                      bgClass,
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-3.5",
                        iconColor,
                        entry.type === "loading" && "animate-spin",
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-semibold leading-tight",
                          entry.read ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {entry.title || "(no title)"}
                      </span>
                      <span className="rounded-full bg-muted/80 px-1.5 py-0.2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        {entry.type}
                      </span>
                    </div>

                    {entry.description && (
                      <p className="text-xs leading-relaxed text-muted-foreground break-words">
                        {entry.description}
                      </p>
                    )}
                  </div>

                  {/* Timestamp & actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <time
                      className="text-[11px] tabular-nums text-muted-foreground/60"
                      dateTime={new Date(entry.timestamp).toISOString()}
                      title={new Date(entry.timestamp).toLocaleString()}
                    >
                      {formatRelativeTime(entry.timestamp)}
                    </time>

                    {!entry.read && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(entry.id)}
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-primary hover:underline transition-opacity cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
