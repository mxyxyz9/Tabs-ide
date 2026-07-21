import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowUpCircleIcon,
  BotIcon,
  ChevronDownIcon,
  DownloadIcon,
  FolderIcon,
  GripVerticalIcon,
  InfoIcon,
  KeyboardIcon,
  LoaderIcon,
  LogInIcon,
  MinusIcon,
  PinIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Undo2Icon,
  XIcon,
  GitBranchIcon,
  Link2Icon,
  MonitorPlayIcon,
  SaveIcon,
  SearchIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UnifiedSettings } from "@tabs/contracts/settings";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { applyCustomModelOrdering, resetModelOrder, updateModelOrder } from "../modelOrdering";
import { getPinnedModels, isPinnedModel, togglePinnedModel } from "../modelPinning";
import { getProviderModels } from "../providerModels";
import {
  type DesktopUpdateState,
  type KeybindingRule,
  type ModelSelection,
  type ModelSlug,
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ResolvedKeybindingsConfig,
  type ServerProvider,
  type ServerProviderModel,
  ThreadId,
} from "@tabs/contracts";
import {
  type DesktopUpdateButtonAction,
  getDesktopUpdateActionError,
  getDesktopUpdateButtonTooltip,
  isDesktopUpdateButtonDisabled,
  resolveDesktopUpdateButtonAction,
} from "../components/desktopUpdate.logic";
import { createModelSelection, normalizeModelSlug } from "@tabs/shared/model";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { toastManager } from "../components/ui/toast";
import {
  deriveProviderInstanceEntries,
  applyProviderInstanceSettings,
  sortProviderInstanceEntries,
} from "../providerInstances";
import { SettingsProviderModelPicker } from "../components/chat/SettingsProviderModelPicker";
import { TraitsPicker } from "../components/chat/TraitsPicker";
import {
  ClaudeAI,
  CursorIcon,
  GrokIcon,
  type Icon,
  OpenAI,
  OpenCodeIcon,
} from "../components/Icons";

const PROVIDER_ICONS_BY_KIND: Record<string, Icon> = {
  codex: OpenAI,
  claudeAgent: ClaudeAI,
  cursor: CursorIcon,
  grok: GrokIcon,
  opencode: OpenCodeIcon,
};
import { Badge } from "../components/ui/badge";
import {
  getCustomModelOptionsByInstance,
  MAX_CUSTOM_MODEL_LENGTH,
  resolveAppModelSelectionState,
} from "../modelSelection";
import { APP_VERSION } from "../branding";
import { KeybindingsSettings } from "../components/settings/KeybindingsSettings";
import ThreadTerminalDrawer from "../components/ThreadTerminalDrawer";
import { DEFAULT_THREAD_TERMINAL_HEIGHT, DEFAULT_THREAD_TERMINAL_ID } from "../types";
import { Button } from "../components/ui/button";
import { Collapsible, CollapsibleContent } from "../components/ui/collapsible";
import {
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogViewport,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../components/ui/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Switch } from "../components/ui/switch";
import { ProjectWorkspaceSettingsSection } from "../components/ProjectWorkspaceSettingsSection";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { resolveAndPersistPreferredEditor } from "../editorPreferences";
import { isElectron } from "../env";
import { useTheme } from "../hooks/useTheme";
import { serverConfigQueryOptions, serverQueryKeys } from "../lib/serverReactQuery";
import { cn } from "../lib/utils";
import { formatRelativeTime } from "../timestampFormat";
import { ensureNativeApi, readNativeApi } from "../nativeApi";
import { DEFAULT_DESKTOP_ICON_THEME, DEFAULT_UNIFIED_SETTINGS } from "@tabs/contracts/settings";
import { SourceControlSettingsPanel } from "../components/settings/SourceControlSettings";
import { ConnectionsSettings } from "../components/settings/ConnectionsSettings";
import { Equal } from "effect";
import { refreshServerConfig, useServerConfig } from "../state/settings";
import { SplashScreen } from "../components/SplashScreen";
import { CloseScreen } from "../components/CloseScreen";
import { useConfirm } from "~/hooks/useConfirm";
import { createPortal } from "react-dom";
import { useZoomFactor, ZOOM_SNAP_POINTS } from "../state/zoom";
import { useWorkspaceActiveProjectId } from "../state/workspaceShell";

export function SettingsHeaderPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    setTarget(document.getElementById("settings-header-actions"));
  }, []);
  if (!target) return null;
  return createPortal(children, target);
}

const TABS_RELEASES_URL = "https://github.com/mxyxyz9/Tabs-ide/releases";

const THEME_OPTIONS = [
  {
    value: "system",
    label: "System",
    description: "Match your OS appearance setting.",
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme.",
  },
] as const;

const ZOOM_PRESETS = [
  { value: "0.5", label: "50%" },
  { value: "0.75", label: "75%" },
  { value: "0.9", label: "90%" },
  { value: "1", label: "100% (Default)" },
  { value: "1.1", label: "110%" },
  { value: "1.25", label: "125%" },
  { value: "1.5", label: "150%" },
  { value: "1.75", label: "175%" },
  { value: "2", label: "200%" },
] as const;

const SPLASH_LOADER_STYLE_OPTIONS = [
  {
    value: "glass",
    label: "Molten Glass",
    description: "Fluid, distorted text effect with rotating status.",
  },
  {
    value: "solari",
    label: "Solari Grid",
    description: "Mechanical split-flap display effect.",
  },
] as const;

const SPLASH_LOADER_PALETTE_OPTIONS = [
  {
    value: "block",
    label: "Solid Block",
    description: "Vibrant indigo background.",
  },
  {
    value: "mono",
    label: "Mono Quiet",
    description: "Minimalist, theme-matching background.",
  },
] as const;

const DESKTOP_ICON_OPTIONS = [
  {
    value: "system",
    label: "System",
    description: "Follows your OS appearance.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Uses the dark background icon.",
  },
  {
    value: "light",
    label: "Light",
    description: "Uses the white icon variant.",
  },
] as const;

const TIMESTAMP_FORMAT_LABELS = {
  locale: "System",
  "12-hour": "12h",
  "24-hour": "24h",
} as const;

const EMPTY_SERVER_PROVIDERS: ReadonlyArray<ServerProvider> = [];
const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];

type ProviderSettingsKey = "codex" | "claudeAgent" | "cursor" | "grok" | "opencode";

type InstallProviderSettings = {
  provider: ProviderSettingsKey;
  title: string;
  icon: Icon;
  binaryPlaceholder: string;
  binaryDescription: ReactNode;
  installCommand?: string;
  homePathKey?: "codexHomePath";
  homePlaceholder?: string;
  homeDescription?: ReactNode;
};

const PROVIDER_SETTINGS: readonly InstallProviderSettings[] = [
  {
    provider: "codex",
    title: "Codex",
    icon: OpenAI,
    binaryPlaceholder: "Codex binary path",
    binaryDescription: "Path to the Codex binary",
    installCommand: "npm install -g @openai/codex",
    homePathKey: "codexHomePath",
    homePlaceholder: "CODEX_HOME",
    homeDescription: "Optional custom Codex home and config directory.",
  },
  {
    provider: "claudeAgent",
    title: "Claude",
    icon: ClaudeAI,
    binaryPlaceholder: "Claude binary path",
    binaryDescription: "Path to the Claude binary",
    installCommand: "npm install -g @anthropic-ai/claude-code",
  },
  {
    provider: "cursor",
    title: "Cursor",
    icon: CursorIcon,
    binaryPlaceholder: "Cursor Agent binary path",
    binaryDescription: "Path to the Cursor Agent binary",
    installCommand: "curl https://cursor.com/install -fsS | bash",
  },
  {
    provider: "grok",
    title: "Grok",
    icon: GrokIcon,
    binaryPlaceholder: "Grok binary path",
    binaryDescription: "Path to the Grok CLI binary",
    installCommand: "npm install -g @vibe-kit/grok-cli",
  },
  {
    provider: "opencode",
    title: "OpenCode",
    icon: OpenCodeIcon,
    binaryPlaceholder: "OpenCode binary path",
    binaryDescription: "Path to the OpenCode binary",
    installCommand: "npm install -g opencode-ai",
  },
];

// Per-provider sign-in command. The server reports the auth *status* but not a
// structured login command, so map the known CLI auth commands here.
const PROVIDER_LOGIN_COMMAND: Partial<Record<ProviderSettingsKey, string>> = {
  codex: "codex login",
  claudeAgent: "claude login",
  cursor: "cursor-agent login",
  grok: "grok login",
  opencode: "opencode auth login",
};

type SettingsSectionId =
  | "general"
  | "workspace"
  | "providers"
  | "source-control"
  | "connections"
  | "startup-animation"
  | "keybindings"
  | "about";

const SETTINGS_NAV: ReadonlyArray<{
  id: SettingsSectionId;
  label: string;
  icon: typeof SlidersHorizontalIcon;
}> = [
  { id: "general", label: "General", icon: SlidersHorizontalIcon },
  { id: "startup-animation", label: "Animations", icon: MonitorPlayIcon },
  { id: "providers", label: "Providers", icon: BotIcon },
  { id: "source-control", label: "Source Control", icon: GitBranchIcon },
  { id: "connections", label: "Connections", icon: Link2Icon },
  { id: "workspace", label: "Workspace", icon: FolderIcon },
  { id: "keybindings", label: "Keybindings", icon: KeyboardIcon },
  { id: "about", label: "About", icon: InfoIcon },
];

const PROVIDER_STATUS_STYLES = {
  disabled: {
    dot: "bg-amber-400",
    badge: "warning" as const,
  },
  error: {
    dot: "bg-destructive",
    badge: "error" as const,
  },
  ready: {
    dot: "bg-success",
    badge: "success" as const,
  },
  warning: {
    dot: "bg-warning",
    badge: "warning" as const,
  },
} as const;

function SortableModelRowItem({
  id,
  children,
}: {
  id: string;
  children: (handle: Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-70")}
    >
      {children({ attributes, listeners })}
    </div>
  );
}

function getProviderSummary(provider: ServerProvider | undefined): {
  readonly headline: string;
  readonly detail: string | null;
} {
  if (!provider) {
    return {
      headline: "Checking provider status",
      detail: "Waiting for the server to report installation and authentication details.",
    };
  }
  if (!provider.enabled) {
    return {
      headline: "Disabled",
      detail:
        provider.message ?? "This provider is installed but disabled for new sessions in Tabs.",
    };
  }
  if (!provider.installed) {
    return {
      headline: "Not found",
      detail: provider.message ?? "CLI not detected on PATH.",
    };
  }
  if (provider.auth.status === "authenticated") {
    return {
      headline: "Authenticated",
      detail: provider.message ?? null,
    };
  }
  if (provider.auth.status === "unauthenticated") {
    return {
      headline: "Not authenticated",
      detail: provider.message ?? null,
    };
  }
  if (provider.status === "warning") {
    return {
      headline: "Needs attention",
      detail:
        provider.message ?? "The provider is installed, but the server could not fully verify it.",
    };
  }
  if (provider.status === "error") {
    return {
      headline: "Unavailable",
      detail: provider.message ?? "The provider failed its startup checks.",
    };
  }
  return {
    headline: "Available",
    detail: provider.message ?? "Installed and ready, but authentication could not be verified.",
  };
}

function getProviderVersionLabel(version: string | null | undefined): string | null {
  if (!version) return null;
  return version.startsWith("v") ? version : `v${version}`;
}

function PinModelCommandPalette({
  serverProviders,
  settings,
  updateSettings,
  providerCards,
}: {
  serverProviders: ReadonlyArray<ServerProvider>;
  settings: Partial<UnifiedSettings> | null | undefined;
  updateSettings: (next: Partial<UnifiedSettings>) => void;
  providerCards: ReadonlyArray<{ provider: string; title: string }>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeProviderFilter, setActiveProviderFilter] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const pinnedEntries = getPinnedModels(settings);

  const allModels = useMemo(() => {
    const items: Array<{
      provider: string;
      providerName: string;
      model: ServerProviderModel;
    }> = [];

    for (const card of providerCards) {
      const providerName =
        PROVIDER_DISPLAY_NAMES[card.provider as keyof typeof PROVIDER_DISPLAY_NAMES] ?? card.title;
      const models = getProviderModels(serverProviders, card.provider);
      for (const m of models) {
        items.push({
          provider: card.provider,
          providerName,
          model: m,
        });
      }
    }
    return items;
  }, [providerCards, serverProviders]);

  const filteredModels = useMemo(() => {
    return allModels.filter((item: { provider: string; providerName: string; model: ServerProviderModel }) => {
      if (activeProviderFilter && item.provider !== activeProviderFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.model.name.toLowerCase().includes(q) ||
        item.model.slug.toLowerCase().includes(q) ||
        item.providerName.toLowerCase().includes(q)
      );
    });
  }, [allModels, activeProviderFilter, searchQuery]);

  if (allModels.length === 0) return null;

  return (
    <>
      <Button
        size="xs"
        variant="outline"
        className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <PlusIcon className="size-3.5" />
        Pin Model
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogViewport>
            <DialogPopup
              showCloseButton={false}
              className="w-full max-w-xl p-0 overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl isolate dark:bg-[#18181b] dark:border-white/10 my-auto"
            >
              {/* Search Header */}
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 bg-muted/20">
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models to pin across all providers..."
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  autoFocus
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-muted-foreground/60 hover:text-foreground p-1 rounded cursor-pointer"
                  >
                    <XIcon className="size-4" />
                  </button>
                ) : null}
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground select-none">
                  ESC
                </kbd>
              </div>

              {/* Provider Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-b border-border/40 bg-muted/10 [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setActiveProviderFilter(null)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap cursor-pointer",
                    activeProviderFilter === null
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  All Providers
                </button>
                {providerCards.map((card) => {
                  const providerName =
                    PROVIDER_DISPLAY_NAMES[card.provider as keyof typeof PROVIDER_DISPLAY_NAMES] ??
                    card.title;
                  const isSelected = activeProviderFilter === card.provider;
                  return (
                    <button
                      key={card.provider}
                      type="button"
                      onClick={() => setActiveProviderFilter(isSelected ? null : card.provider)}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap cursor-pointer",
                        isSelected
                          ? "bg-foreground text-background font-semibold shadow-xs"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                    >
                      {providerName}
                    </button>
                  );
                })}
              </div>

              {/* Model Results List */}
              <div className="max-h-96 overflow-y-auto p-2 divide-y divide-border/20">
                {filteredModels.length === 0 ? (
                  <div className="py-12 px-4 text-center select-none">
                    <SearchIcon className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                    <div className="text-sm font-medium text-foreground">No Matching Models</div>
                    <div className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      No models match "{searchQuery}"
                    </div>
                  </div>
                ) : (
                  filteredModels.map((item: { provider: string; providerName: string; model: ServerProviderModel }) => {
                    const IconComponent = PROVIDER_ICONS_BY_KIND[item.provider] ?? BotIcon;
                    const caps = item.model.capabilities;
                    const capLabels: string[] = [];
                    if (caps?.supportsFastMode) capLabels.push("Fast");
                    if (caps?.supportsThinkingToggle) capLabels.push("Thinking");
                    if (caps?.reasoningEffortLevels && caps.reasoningEffortLevels.length > 0)
                      capLabels.push("Reasoning");

                    const isPinned = isPinnedModel(pinnedEntries, item.provider, item.model.slug);

                    return (
                      <div
                        key={`${item.provider}:${item.model.slug}`}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all group cursor-pointer"
                        onClick={() => {
                          const nextPinned = togglePinnedModel(
                            settings,
                            item.provider,
                            item.model.slug,
                          );
                          updateSettings({ pinnedModels: nextPinned as any });
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:text-foreground group-hover:bg-muted">
                            <IconComponent className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-sm font-medium text-foreground truncate">
                                {item.model.name}
                              </span>
                              <span className="text-xs font-mono text-muted-foreground/60 shrink-0">
                                ({item.providerName})
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-mono text-muted-foreground/50 truncate">
                                {item.model.slug}
                              </span>
                              {capLabels.map((label) => (
                                <span
                                  key={label}
                                  className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/50 text-muted-foreground/70 shrink-0 border border-border/30"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {isPinned ? (
                          <Button
                            size="xs"
                            variant="secondary"
                            className="h-7 gap-1 px-2.5 text-xs font-medium text-foreground bg-muted/80 hover:bg-muted cursor-pointer shrink-0"
                          >
                            <PinIcon className="size-3.5 fill-current" />
                            Pinned
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-7 gap-1 px-2.5 text-xs font-medium text-muted-foreground group-hover:text-foreground group-hover:bg-accent cursor-pointer shrink-0"
                          >
                            <PlusIcon className="size-3.5" />
                            Pin
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
    </>
  );
}

interface ProviderUpdatePrompt {
  readonly headline: string;
  readonly detail: string | null;
  readonly command: string | null;
}

/**
 * Presentation for a provider's CLI version advisory. Returns an update prompt
 * only when the server reports the installed CLI is behind the latest release.
 */
function getProviderUpdatePrompt(
  advisory: ServerProvider["versionAdvisory"] | undefined,
): ProviderUpdatePrompt | null {
  if (!advisory || advisory.status !== "behind_latest") {
    return null;
  }
  const latest = getProviderVersionLabel(advisory.latestVersion);
  const current = getProviderVersionLabel(advisory.currentVersion);
  const headline = latest ? `Update available — ${latest}` : "Update available";
  const detail =
    advisory.message ?? (current && latest ? `Installed ${current}, latest ${latest}.` : null);
  return { headline, detail, command: advisory.updateCommand };
}

/** Returns a timestamp that updates on an interval, forcing re-renders to keep relative times fresh. */
function useRelativeTimeTick(intervalMs = 1_000): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function SettingsSection({
  title,
  headerAction,
  children,
}: {
  title: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
          {title}
        </h3>
        {headerAction}
      </div>
      <div className="relative overflow-hidden rounded-2xl border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  title,
  description,
  status,
  resetAction,
  control,
  children,
}: {
  title: string;
  description: string;
  status?: ReactNode;
  resetAction?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5"
      data-slot="settings-row"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-h-5 items-center gap-1.5">
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {resetAction}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {status ? <div className="pt-1 text-[11px] text-muted-foreground">{status}</div> : null}
        </div>
        {control ? (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {control}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SettingResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Reset ${label} to default`}
            className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            <Undo2Icon className="size-3" />
          </Button>
        }
      />
      <TooltipPopup side="top">Reset to default</TooltipPopup>
    </Tooltip>
  );
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

function ClosePreviewOverlay({ loader, palette, theme, onClose }: any) {
  const [phase, setPhase] = useState<any>("idle");

  useEffect(() => {
    // Hold idle for a short bit to show the "idle" text
    const t = setTimeout(() => {
      setPhase("closing");
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[99999]">
      <CloseScreen
        loader={loader}
        palette={palette}
        theme={theme}
        phase={phase}
        onIntroEnd={onClose}
      />
    </div>
  );
}

function SettingsRouteView() {
  const { confirm, confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [zoomFactor, updateZoom] = useZoomFactor();
  const activeProjectId = useWorkspaceActiveProjectId();
  const settings = useSettings();
  const { updateSettings, resetSettings } = useUpdateSettings();
  const { copyToClipboard } = useCopyToClipboard<{ providerName: string }>({
    onCopy: ({ providerName }) => {
      toastManager.add({
        type: "success",
        title: `${providerName} command copied`,
        description: "Run it in a terminal to finish.",
      });
    },
  });
  const serverConfig = useServerConfig();
  const [isOpeningKeybindings, setIsOpeningKeybindings] = useState(false);
  const [openKeybindingsError, setOpenKeybindingsError] = useState<string | null>(null);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>(() => {
    const saved = sessionStorage.getItem("tabs_active_settings_tab");
    return (saved as SettingsSectionId) || "general";
  });

  useEffect(() => {
    sessionStorage.setItem("tabs_active_settings_tab", activeSettingsSection);
  }, [activeSettingsSection]);
  const [openProviderDetails, setOpenProviderDetails] = useState<
    Partial<Record<ProviderSettingsKey, boolean>>
  >({
    codex: true,
  });
  const [customModelInputByProvider, setCustomModelInputByProvider] = useState<
    Partial<Record<ProviderSettingsKey, string>>
  >({});
  const [draftModelOrders, setDraftModelOrders] = useState<
    Partial<Record<ProviderSettingsKey, ReadonlyArray<string>>>
  >({});

  const handleSaveModelOrder = useCallback(
    (provider: ProviderSettingsKey) => {
      const pendingOrder = draftModelOrders[provider];
      if (pendingOrder) {
        const nextPrefs = updateModelOrder(
          settings.providerModelPreferences,
          provider,
          [...pendingOrder],
        );
        updateSettings({ providerModelPreferences: nextPrefs as any });
        setDraftModelOrders((existing) => {
          const next = { ...existing };
          delete next[provider];
          return next;
        });
      }
    },
    [draftModelOrders, settings.providerModelPreferences, updateSettings],
  );

  const [previewStyle, setPreviewStyle] = useState(settings.splashLoaderStyle);
  const [previewPalette, setPreviewPalette] = useState(settings.splashLoaderPalette);
  const [previewTheme, setPreviewTheme] = useState<"system" | "dark" | "light">(
    settings.splashLoaderTheme,
  );

  const [closePreviewStyle, setClosePreviewStyle] = useState(settings.closeLoaderStyle);
  const [closePreviewPalette, setClosePreviewPalette] = useState(settings.closeLoaderPalette);
  const [closePreviewTheme, setClosePreviewTheme] = useState<"system" | "dark" | "light">(
    settings.closeLoaderTheme,
  );
  const [closeReplayKey, setCloseReplayKey] = useState(0);

  const [animationTab, setAnimationTab] = useState<"startup" | "close">("startup");
  const [fullscreenClosePreview, setFullscreenClosePreview] = useState(false);

  const effectivePreviewTheme = previewTheme === "system" ? theme : previewTheme;
  const effectiveClosePreviewTheme = closePreviewTheme === "system" ? theme : closePreviewTheme;

  const activeStyle = animationTab === "startup" ? previewStyle : closePreviewStyle;
  const setActiveStyle = animationTab === "startup" ? setPreviewStyle : setClosePreviewStyle;

  const activePalette = animationTab === "startup" ? previewPalette : closePreviewPalette;
  const setActivePalette = animationTab === "startup" ? setPreviewPalette : setClosePreviewPalette;

  const activeTheme = animationTab === "startup" ? previewTheme : closePreviewTheme;
  const setActiveTheme = animationTab === "startup" ? setPreviewTheme : setClosePreviewTheme;

  const activeEffectiveTheme =
    animationTab === "startup" ? effectivePreviewTheme : effectiveClosePreviewTheme;

  useEffect(() => {
    setPreviewStyle(settings.splashLoaderStyle);
    setPreviewPalette(settings.splashLoaderPalette);
    setPreviewTheme(settings.splashLoaderTheme);

    setClosePreviewStyle(settings.closeLoaderStyle);
    setClosePreviewPalette(settings.closeLoaderPalette);
    setClosePreviewTheme(settings.closeLoaderTheme);
  }, [
    settings.splashLoaderStyle,
    settings.splashLoaderPalette,
    settings.splashLoaderTheme,
    settings.closeLoaderStyle,
    settings.closeLoaderPalette,
    settings.closeLoaderTheme,
  ]);
  const [customModelErrorByProvider, setCustomModelErrorByProvider] = useState<
    Partial<Record<ProviderSettingsKey, string | null>>
  >({});
  const [isRefreshingProviders, setIsRefreshingProviders] = useState(false);
  const refreshingRef = useRef(false);
  const queryClient = useQueryClient();
  useRelativeTimeTick();

  const refreshProviders = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshingProviders(true);
    const api = ensureNativeApi();
    api.server
      .refreshProviders()
      .then(() => {
        void refreshServerConfig();
        void queryClient.invalidateQueries({ queryKey: serverQueryKeys.config() });
        void queryClient.invalidateQueries({ queryKey: ["source-control-discovery"] });
      })
      .catch((error: unknown) => {
        console.warn("Failed to refresh providers", error);
      })
      .finally(() => {
        refreshingRef.current = false;
        setIsRefreshingProviders(false);
      });
  }, [queryClient]);

  // Provider Install / Update / Sign in all run in an embedded PTY terminal
  // docked at the bottom of the settings page, rather than as a headless server
  // child process. The PTY spawns the user's real login shell, so it inherits a
  // full PATH (npm / brew / curl resolve) and the CLI's OAuth browser redirect
  // works. The session is keyed by a synthetic, settings-scoped thread id (the
  // server treats threadId as an opaque session key).
  type ProviderActionKind = "login" | "install" | "update";
  const [providerActionSession, setProviderActionSession] = useState<{
    provider: ProviderSettingsKey;
    providerName: string;
    command: string;
    kind: ProviderActionKind;
    threadId: ThreadId;
  } | null>(null);
  // Guards the one-time auto-run of the command per session: we write it once the
  // PTY emits its first output/started event (shell is ready).
  const providerActionCommandSentRef = useRef<string | null>(null);

  const startProviderAction = useCallback(
    (input: {
      provider: ProviderSettingsKey;
      providerName: string;
      command: string;
      kind: ProviderActionKind;
    }) => {
      if (input.command.trim().length === 0) return;
      providerActionCommandSentRef.current = null;
      setProviderActionSession({
        provider: input.provider,
        providerName: input.providerName,
        command: input.command,
        kind: input.kind,
        threadId: ThreadId.makeUnsafe(`settings-${input.kind}-${input.provider}-${Date.now()}`),
      });
    },
    [],
  );

  const closeProviderAction = useCallback(() => {
    setProviderActionSession((current) => {
      if (current) {
        const api = readNativeApi();
        void api?.terminal.close({ threadId: current.threadId }).catch(() => undefined);
      }
      return null;
    });
    providerActionCommandSentRef.current = null;
    // Re-read provider status so a completed install/update/sign-in is reflected
    // (version bump, installed/authenticated) and the action button clears.
    refreshProviders();
  }, [refreshProviders]);

  // Auto-run the command once the embedded terminal session is live. The
  // TerminalViewport opens the PTY itself, so we listen for its first runtime
  // event rather than racing the open call.
  useEffect(() => {
    if (!providerActionSession) return;
    const api = readNativeApi();
    if (!api) return;
    const { threadId, command } = providerActionSession;
    const sendOnce = () => {
      if (providerActionCommandSentRef.current === threadId) return;
      providerActionCommandSentRef.current = threadId;
      setTimeout(() => {
        const api = readNativeApi();
        if (!api) return;
        void api.terminal
          .write({ threadId, terminalId: DEFAULT_THREAD_TERMINAL_ID, data: `${command}\r` })
          .catch(() => undefined);
      }, 750);
    };
    const unsubscribe = api.terminal.onEvent((event) => {
      if (event.threadId !== threadId || event.terminalId !== DEFAULT_THREAD_TERMINAL_ID) return;
      if (event.type === "output" || event.type === "started" || event.type === "restarted") {
        sendOnce();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [providerActionSession]);

  const modelListRefs = useRef<Partial<Record<ProviderSettingsKey, HTMLDivElement | null>>>({});

  // Desktop software-update state (Electron only). The main process auto-checks
  // on launch and pushes state changes; we mirror it here for the About section.
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

  const codexHomePath = settings.providers.codex.homePath;
  const keybindingsConfigPath = serverConfig?.keybindingsConfigPath ?? null;
  const loginCwd = serverConfig?.cwd ?? null;
  const availableEditors = serverConfig?.availableEditors;
  const serverProviders = serverConfig?.providers ?? EMPTY_SERVER_PROVIDERS;

  const textGenerationModelSelection = resolveAppModelSelectionState(settings, serverProviders);
  const textGenInstanceId = textGenerationModelSelection.instanceId;
  const textGenModel = textGenerationModelSelection.model;
  const textGenModelOptions = textGenerationModelSelection.options;

  const gitModelInstanceEntries = sortProviderInstanceEntries(
    applyProviderInstanceSettings(deriveProviderInstanceEntries(serverProviders), settings),
  );
  const textGenInstanceEntry = gitModelInstanceEntries.find(
    (entry) => entry.instanceId === textGenInstanceId,
  );
  const textGenProvider = textGenInstanceEntry?.driverKind ?? "codex";
  const gitModelOptionsByInstance = getCustomModelOptionsByInstance(
    settings,
    serverProviders,
    textGenInstanceId,
    textGenModel,
  );
  const areProviderSettingsDirty = PROVIDER_SETTINGS.some((providerSettings) => {
    const currentSettings = settings.providers[providerSettings.provider];
    const defaultSettings = DEFAULT_UNIFIED_SETTINGS.providers[providerSettings.provider];
    return !Equal.equals(currentSettings, defaultSettings);
  });
  const isGitWritingModelDirty = !Equal.equals(
    settings.textGenerationModelSelection ?? null,
    DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection ?? null,
  );
  const changedSettingLabels = [
    ...(theme !== "system" ? ["Theme"] : []),
    ...(settings.timestampFormat !== DEFAULT_UNIFIED_SETTINGS.timestampFormat
      ? ["Time format"]
      : []),
    ...(settings.diffWordWrap !== DEFAULT_UNIFIED_SETTINGS.diffWordWrap
      ? ["Diff line wrapping"]
      : []),
    ...(settings.enableAssistantStreaming !== DEFAULT_UNIFIED_SETTINGS.enableAssistantStreaming
      ? ["Assistant output"]
      : []),
    ...(settings.alwaysCreateTasks !== DEFAULT_UNIFIED_SETTINGS.alwaysCreateTasks
      ? ["Always create tasks"]
      : []),
    ...(settings.defaultThreadEnvMode !== DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode
      ? ["New thread mode"]
      : []),
    ...(settings.confirmThreadDelete !== DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete
      ? ["Delete confirmation"]
      : []),
    ...(settings.confirmTabClose !== DEFAULT_UNIFIED_SETTINGS.confirmTabClose
      ? ["Confirm tab close"]
      : []),
    ...(isGitWritingModelDirty ? ["Git writing model"] : []),
    ...(areProviderSettingsDirty ? ["Providers"] : []),
  ];

  const resolvedKeybindings = serverConfig?.keybindings ?? EMPTY_KEYBINDINGS;

  const applyKeybindingMutation = useCallback(
    (run: Promise<unknown>) =>
      run
        .then(() => {
          void refreshServerConfig();
          return queryClient.invalidateQueries({ queryKey: serverQueryKeys.config() });
        })
        .catch((error: unknown) => {
          toastManager.add({
            type: "error",
            title: "Couldn't update keybinding",
            description: error instanceof Error ? error.message : "Please try again.",
          });
        }),
    [queryClient],
  );

  const handleUpsertKeybinding = useCallback(
    (rule: KeybindingRule) =>
      applyKeybindingMutation(ensureNativeApi().server.upsertKeybinding(rule)),
    [applyKeybindingMutation],
  );

  const handleRemoveKeybinding = useCallback(
    (rule: KeybindingRule) =>
      applyKeybindingMutation(ensureNativeApi().server.removeKeybinding(rule)),
    [applyKeybindingMutation],
  );

  const openKeybindingsFile = useCallback(() => {
    if (!keybindingsConfigPath) return;
    setOpenKeybindingsError(null);
    setIsOpeningKeybindings(true);
    const api = ensureNativeApi();
    const editor = resolveAndPersistPreferredEditor(availableEditors ?? []);
    if (!editor) {
      setOpenKeybindingsError("No available editors found.");
      setIsOpeningKeybindings(false);
      return;
    }
    void api.shell
      .openInEditor(keybindingsConfigPath, editor)
      .catch((error) => {
        setOpenKeybindingsError(
          error instanceof Error ? error.message : "Unable to open keybindings file.",
        );
      })
      .finally(() => {
        setIsOpeningKeybindings(false);
      });
  }, [availableEditors, keybindingsConfigPath]);

  const addCustomModel = useCallback(
    (provider: ProviderSettingsKey) => {
      const customModelInput = customModelInputByProvider[provider];
      const customModels = settings.providers[provider].customModels;
      const normalized = normalizeModelSlug(customModelInput, provider);
      if (!normalized) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "Enter a model slug.",
        }));
        return;
      }
      if (
        serverProviders
          .find((candidate) => candidate.instanceId === provider)
          ?.models.some((option) => !option.isCustom && option.slug === normalized)
      ) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "That model is already built in.",
        }));
        return;
      }
      if (normalized.length > MAX_CUSTOM_MODEL_LENGTH) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: `Model slugs must be ${MAX_CUSTOM_MODEL_LENGTH} characters or less.`,
        }));
        return;
      }
      if (customModels.includes(normalized)) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "That custom model is already saved.",
        }));
        return;
      }

      updateSettings({
        providers: {
          ...settings.providers,
          [provider]: {
            ...settings.providers[provider],
            customModels: [...customModels, normalized],
          },
        },
      });
      setCustomModelInputByProvider((existing) => ({
        ...existing,
        [provider]: "",
      }));
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));
      // Watch for DOM changes (server may push updated model list) and scroll to bottom
      const el = modelListRefs.current[provider];
      if (el) {
        const scrollToEnd = () => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        // Immediate scroll for the optimistic update
        requestAnimationFrame(scrollToEnd);
        // Also observe mutations for when the server pushes an updated list
        const observer = new MutationObserver(() => {
          scrollToEnd();
          observer.disconnect();
        });
        observer.observe(el, { childList: true, subtree: true });
        // Clean up observer after a reasonable window
        setTimeout(() => observer.disconnect(), 2000);
      }
    },
    [customModelInputByProvider, serverProviders, settings, updateSettings],
  );

  const removeCustomModel = useCallback(
    (provider: ProviderSettingsKey, slug: string) => {
      const customModels = settings.providers[provider].customModels;
      updateSettings({
        providers: {
          ...settings.providers,
          [provider]: {
            ...settings.providers[provider],
            customModels: customModels.filter((model) => model !== slug),
          },
        },
      });
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));
    },
    [settings, updateSettings],
  );

  const providerCards = PROVIDER_SETTINGS.map((providerSettings) => {
    const liveProvider = serverProviders.find(
      (candidate) => candidate.instanceId === providerSettings.provider,
    );
    const providerConfig = settings.providers[providerSettings.provider];
    const defaultProviderConfig = DEFAULT_UNIFIED_SETTINGS.providers[providerSettings.provider];
    const statusKey = liveProvider?.status ?? (providerConfig.enabled ? "warning" : "disabled");
    const statusStyle = PROVIDER_STATUS_STYLES[statusKey];
    const summary = getProviderSummary(liveProvider);
    const baseModels =
      liveProvider?.models && liveProvider.models.length > 0
        ? liveProvider.models
        : getProviderModels(serverProviders, providerSettings.provider);
    const seenSlugs = new Set(baseModels.map((m: ServerProviderModel) => m.slug));
    const mergedModels: ServerProviderModel[] = [...baseModels];
    for (const customSlug of providerConfig.customModels ?? []) {
      if (!seenSlugs.has(customSlug)) {
        seenSlugs.add(customSlug);
        mergedModels.push({
          slug: customSlug,
          name: customSlug,
          isCustom: true,
          capabilities: null,
        });
      }
    }
    const customOrder =
      draftModelOrders[providerSettings.provider] ??
      settings.providerModelPreferences?.[providerSettings.provider as any]?.modelOrder;
    const models = applyCustomModelOrdering(mergedModels, customOrder, providerSettings.provider);
    const hasPendingOrderChanges = Boolean(
      draftModelOrders[providerSettings.provider] &&
        !Equal.equals(
          draftModelOrders[providerSettings.provider],
          settings.providerModelPreferences?.[providerSettings.provider as any]?.modelOrder ?? [],
        ),
    );
    const binaryPathValue = providerConfig.binaryPath;
    const isDirty = !Equal.equals(providerConfig, defaultProviderConfig);

    return {
      provider: providerSettings.provider,
      title: providerSettings.title,
      icon: providerSettings.icon,
      badgeLabel: liveProvider?.badgeLabel ?? null,
      binaryPlaceholder: providerSettings.binaryPlaceholder,
      binaryDescription: providerSettings.binaryDescription,
      homePathKey: providerSettings.homePathKey,
      homePlaceholder: providerSettings.homePlaceholder,
      homeDescription: providerSettings.homeDescription,
      binaryPathValue,
      isDirty,
      hasPendingOrderChanges,
      liveProvider,
      models,
      providerConfig,
      statusKey,
      statusStyle,
      summary,
      versionLabel: getProviderVersionLabel(liveProvider?.version),
      updatePrompt: getProviderUpdatePrompt(liveProvider?.versionAdvisory),
      needsInstall: liveProvider ? !liveProvider.installed : false,
      installCommand: providerSettings.installCommand,
      needsAuth: liveProvider?.installed === true && liveProvider.auth.status === "unauthenticated",
      loginCommand: PROVIDER_LOGIN_COMMAND[providerSettings.provider] ?? null,
    };
  });

  async function restoreDefaults() {
    if (changedSettingLabels.length === 0) return;

    const api = readNativeApi();
    const confirmed = await confirm(
      ["Restore default settings?", `This will reset: ${changedSettingLabels.join(", ")}.`].join(
        "\n",
      ),
    );
    if (!confirmed) return;

    setTheme("system");
    resetSettings();
    setOpenProviderDetails({
      codex: false,
      claudeAgent: false,
    });
    setCustomModelInputByProvider({
      codex: "",
      claudeAgent: "",
    });
    setCustomModelErrorByProvider({});
  }

  return (
    <div className="isolate flex h-full min-h-0 min-w-0 flex-col overflow-hidden overscroll-y-none bg-background text-foreground">
      {fullscreenClosePreview && (
        <ClosePreviewOverlay
          key={closeReplayKey}
          loader={closePreviewStyle}
          palette={closePreviewPalette}
          theme={effectiveClosePreviewTheme}
          onClose={() => setFullscreenClosePreview(false)}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {!isElectron && (
          <header className="border-b border-border px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <Button size="xs" variant="ghost" onClick={() => void navigate({ to: "/" })}>
                <ArrowLeftIcon className="size-3.5" />
                Back
              </Button>
              <span className="text-sm font-medium text-foreground">Settings</span>
              <div id="settings-header-actions" className="ms-auto flex items-center gap-2"></div>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <Button
              size="xs"
              variant="ghost"
              className="no-drag"
              onClick={() => void navigate({ to: "/" })}
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
            <span className="ml-2 text-xs font-medium tracking-wide text-muted-foreground/70">
              Settings
            </span>
            <div id="settings-header-actions" className="ms-auto flex items-center gap-2"></div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full w-full gap-6 px-6 sm:px-10 lg:px-16">
            <nav className="w-44 shrink-0 space-y-0.5 py-6">
              {SETTINGS_NAV.map((item) => {
                const NavIcon = item.icon;
                const active = activeSettingsSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSettingsSection(item.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <NavIcon className="size-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto overscroll-y-contain py-6">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
                {activeSettingsSection === "general" ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">
                            General
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Customize appearance, assistant behavior, display settings, and workspace preferences.
                          </p>
                        </div>
                        <SettingsHeaderPortal>
                          <Button
                            size="xs"
                            variant="outline"
                            className="no-drag"
                            onClick={async () => {
                              const confirmed = await confirm(
                                "Restore default settings?\n\nThis will reset: Theme, Time format, Diff wrapping, Assistant output, New threads, and Confirmations.",
                              );
                              if (confirmed) {
                                setTheme("system");
                                updateSettings({
                                  timestampFormat: DEFAULT_UNIFIED_SETTINGS.timestampFormat,
                                  diffWordWrap: DEFAULT_UNIFIED_SETTINGS.diffWordWrap,
                                  enableAssistantStreaming:
                                    DEFAULT_UNIFIED_SETTINGS.enableAssistantStreaming,
                                  defaultThreadEnvMode: DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode,
                                  confirmThreadDelete: DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete,
                                  confirmTabClose: DEFAULT_UNIFIED_SETTINGS.confirmTabClose,
                                });
                              }
                            }}
                          >
                            <RotateCcwIcon className="size-3.5 mr-1" />
                            Restore defaults
                          </Button>
                        </SettingsHeaderPortal>
                      </div>
                      <div className="h-px w-full bg-border/80 dark:bg-white/15 my-4" />
                    </div>

                    {/* Group 1: Appearance & Interface */}
                    <SettingsSection title="Appearance & Interface">
                      <SettingsRow
                        title="Theme"
                        description="Choose how Tabs looks across the app."
                        resetAction={
                          theme !== "system" ? (
                            <SettingResetButton label="theme" onClick={() => setTheme("system")} />
                          ) : null
                        }
                        control={
                          <div className="flex gap-0.5 rounded-lg bg-muted p-1">
                            {THEME_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setTheme(option.value)}
                                aria-label={`Theme: ${option.label}`}
                                className={cn(
                                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                  theme === option.value
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        }
                      />

                      <SettingsRow
                        title="Zoom & Scale"
                        description="Adjust interface zoom level. Drag slider or use Cmd + / Cmd -."
                        resetAction={
                          zoomFactor !== 1.0 ? (
                            <SettingResetButton label="zoom" onClick={() => updateZoom(1.0)} />
                          ) : null
                        }
                        control={
                          (() => {
                            const currentIndex = Math.max(
                              0,
                              ZOOM_SNAP_POINTS.findIndex((pt) => Math.abs(zoomFactor - pt) < 0.01)
                            );
                            return (
                              <div className="flex flex-col gap-2 w-full sm:w-72">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground/70 font-medium">Scale Range</span>
                                  <span className="font-mono font-bold text-foreground bg-accent/60 px-2.5 py-0.5 rounded-md text-xs shadow-xs border border-border/50">
                                    {Math.round(zoomFactor * 100)}%
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() => updateZoom(ZOOM_SNAP_POINTS[Math.max(0, currentIndex - 1)] ?? 1.0)}
                                    title="Zoom Out (Cmd -)"
                                    aria-label="Zoom Out"
                                  >
                                    <MinusIcon className="h-3.5 w-3.5" />
                                  </Button>

                                  <div className="relative flex-1 flex items-center px-1">
                                    <input
                                      type="range"
                                      min="0"
                                      max={ZOOM_SNAP_POINTS.length - 1}
                                      step="1"
                                      value={currentIndex}
                                      onChange={(e) =>
                                        updateZoom(ZOOM_SNAP_POINTS[parseInt(e.target.value, 10)] ?? 1.0)
                                      }
                                      aria-label="Zoom level slider"
                                      className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer focus:outline-none relative z-10"
                                    />
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() =>
                                      updateZoom(
                                        ZOOM_SNAP_POINTS[
                                          Math.min(ZOOM_SNAP_POINTS.length - 1, currentIndex + 1)
                                        ] ?? 1.0
                                      )
                                    }
                                    title="Zoom In (Cmd +)"
                                    aria-label="Zoom In"
                                  >
                                    <PlusIcon className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                <div className="flex justify-between px-8 text-[10px] font-mono text-muted-foreground/60 select-none">
                                  {ZOOM_SNAP_POINTS.map((pt) => (
                                    <button
                                      key={pt}
                                      type="button"
                                      onClick={() => updateZoom(pt)}
                                      className={cn(
                                        "hover:text-foreground transition-colors cursor-pointer text-center w-8 -mx-1",
                                        Math.abs(zoomFactor - pt) < 0.01 ? "text-primary font-bold" : ""
                                      )}
                                    >
                                      {Math.round(pt * 100)}%
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()
                        }
                      />

                      {isElectron ? (
                        <SettingsRow
                          title="Desktop icon"
                          description="Choose which icon variant Tabs uses in the desktop shell and dock."
                          resetAction={
                            settings.desktopIconTheme !== DEFAULT_DESKTOP_ICON_THEME ? (
                              <SettingResetButton
                                label="desktop icon"
                                onClick={() =>
                                  updateSettings({
                                    desktopIconTheme: DEFAULT_DESKTOP_ICON_THEME,
                                  })
                                }
                              />
                            ) : null
                          }
                          control={
                            <div className="flex gap-0.5 rounded-lg bg-muted p-1">
                              {DESKTOP_ICON_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    if (option.value !== "dark" && option.value !== "light" && option.value !== "system") return;
                                    updateSettings({ desktopIconTheme: option.value as "dark" | "light" });
                                  }}
                                  aria-label={`Desktop icon: ${option.label}`}
                                  className={cn(
                                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                    settings.desktopIconTheme === option.value
                                      ? "bg-background text-foreground shadow-xs"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          }
                        />
                      ) : null}

                      <SettingsRow
                        title="Time format"
                        description="System default follows your browser or OS clock preference."
                        resetAction={
                          settings.timestampFormat !== DEFAULT_UNIFIED_SETTINGS.timestampFormat ? (
                            <SettingResetButton
                              label="time format"
                              onClick={() =>
                                updateSettings({
                                  timestampFormat: DEFAULT_UNIFIED_SETTINGS.timestampFormat,
                                })
                              }
                            />
                          ) : null
                        }
                        control={
                          <div className="flex gap-0.5 rounded-lg bg-muted p-1">
                            {(["locale", "12-hour", "24-hour"] as const).map((fmt) => (
                              <button
                                key={fmt}
                                type="button"
                                onClick={() => updateSettings({ timestampFormat: fmt })}
                                aria-label={`Time format: ${TIMESTAMP_FORMAT_LABELS[fmt]}`}
                                className={cn(
                                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                  settings.timestampFormat === fmt
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {TIMESTAMP_FORMAT_LABELS[fmt]}
                              </button>
                            ))}
                          </div>
                        }
                      />
                    </SettingsSection>

                    {/* Group 2: Assistant & Code Generation */}
                    <SettingsSection title="Assistant & Code Generation">
                      <SettingsRow
                        title="Assistant output"
                        description="Show token-by-token output while a response is in progress."
                        resetAction={
                          settings.enableAssistantStreaming !==
                          DEFAULT_UNIFIED_SETTINGS.enableAssistantStreaming ? (
                            <SettingResetButton
                              label="assistant output"
                              onClick={() =>
                                updateSettings({
                                  enableAssistantStreaming:
                                    DEFAULT_UNIFIED_SETTINGS.enableAssistantStreaming,
                                })
                              }
                            />
                          ) : null
                        }
                        control={
                          <Switch
                            checked={settings.enableAssistantStreaming}
                            onCheckedChange={(checked) =>
                              updateSettings({
                                enableAssistantStreaming: Boolean(checked),
                              })
                            }
                            aria-label="Stream assistant messages"
                          />
                        }
                      />

                      <SettingsRow
                        title="Always create tasks"
                        description="Synthesize task progress for providers that do not emit native task events."
                        resetAction={
                          settings.alwaysCreateTasks !==
                          DEFAULT_UNIFIED_SETTINGS.alwaysCreateTasks ? (
                            <SettingResetButton
                              label="always create tasks"
                              onClick={() =>
                                updateSettings({
                                  alwaysCreateTasks: DEFAULT_UNIFIED_SETTINGS.alwaysCreateTasks,
                                })
                              }
                            />
                          ) : null
                        }
                        control={
                          <Switch
                            checked={settings.alwaysCreateTasks}
                            onCheckedChange={(checked) =>
                              updateSettings({
                                alwaysCreateTasks: Boolean(checked),
                              })
                            }
                            aria-label="Always create tasks"
                          />
                        }
                      />

                      <SettingsRow
                        title="Text generation model"
                        description="Configure the model used for text generation (commit messages, PR content etc.)"
                        resetAction={
                          JSON.stringify(settings.textGenerationModelSelection ?? null) !==
                          JSON.stringify(
                            DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection ?? null,
                          ) ? (
                            <SettingResetButton
                              label="text generation model"
                              onClick={() => {
                                updateSettings({
                                  textGenerationModelSelection:
                                    DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection,
                                });
                              }}
                            />
                          ) : null
                        }
                        control={
                          <div className="flex w-full flex-wrap items-center justify-end gap-2">
                            <SettingsProviderModelPicker
                              activeInstanceId={textGenInstanceId}
                              model={textGenModel}
                              instanceEntries={gitModelInstanceEntries}
                              modelOptionsByInstance={gitModelOptionsByInstance}
                              triggerVariant="outline"
                              triggerClassName="min-w-0 max-w-none shrink-0"
                              onInstanceModelChange={(instanceId, model) => {
                                updateSettings({
                                  textGenerationModelSelection: resolveAppModelSelectionState(
                                    {
                                      ...settings,
                                      textGenerationModelSelection: createModelSelection(
                                        instanceId,
                                        model,
                                      ),
                                    },
                                    serverProviders,
                                  ),
                                });
                              }}
                            />
                            <TraitsPicker
                              provider={textGenProvider as any}
                              models={textGenInstanceEntry?.models ?? []}
                              model={textGenModel}
                              prompt=""
                              onPromptChange={() => {}}
                              modelOptions={textGenModelOptions}
                              allowPromptInjectedEffort={false}
                              triggerVariant="outline"
                              triggerClassName="min-w-0 max-w-none shrink-0"
                              onModelOptionsChange={(nextOptions) => {
                                updateSettings({
                                  textGenerationModelSelection: resolveAppModelSelectionState(
                                    {
                                      ...settings,
                                      textGenerationModelSelection: createModelSelection(
                                        textGenInstanceId,
                                        textGenModel,
                                        nextOptions,
                                      ),
                                    },
                                    serverProviders,
                                  ),
                                });
                              }}
                            />
                          </div>
                        }
                      />
                    </SettingsSection>

                    {/* Group 3: Diff & Display */}
                    <SettingsSection title="Diff & Display">
                      <SettingsRow
                        title="Diff line wrapping"
                        description="Set the default wrap state when the diff panel opens. The in-panel wrap toggle only affects the current diff session."
                        resetAction={
                          settings.diffWordWrap !== DEFAULT_UNIFIED_SETTINGS.diffWordWrap ? (
                            <SettingResetButton
                              label="diff line wrapping"
                              onClick={() =>
                                updateSettings({
                                  diffWordWrap: DEFAULT_UNIFIED_SETTINGS.diffWordWrap,
                                })
                              }
                            />
                          ) : null
                        }
                        control={
                          <Switch
                            checked={settings.diffWordWrap}
                            onCheckedChange={(checked) =>
                              updateSettings({
                                diffWordWrap: Boolean(checked),
                              })
                            }
                            aria-label="Wrap diff lines by default"
                          />
                        }
                      />

                      <SettingsRow
                        title="Colorize permissions"
                        description="Apply distinct semantic colors to the different permission levels in the composer."
                        resetAction={
                          !settings.colorizePermissions ? (
                            <SettingResetButton
                              label="colorize permissions"
                              onClick={() =>
                                updateSettings({
                                  colorizePermissions: true,
                                })
                              }
                            />
                          ) : null
                        }
                        control={
                          <Switch
                            checked={settings.colorizePermissions}
                            onCheckedChange={(checked) => {
                              updateSettings({ colorizePermissions: checked });
                            }}
                            aria-label="Colorize permissions"
                          />
                        }
                      />
                    </SettingsSection>

                    {/* Group 4: Workspace & Confirmations */}
                    <SettingsSection title="Workspace & Confirmations">
                      <SettingsRow
                        title="New threads"
                        description="Pick the default workspace mode for newly created draft threads."
                        resetAction={
                          settings.defaultThreadEnvMode !==
                          DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode ? (
                            <SettingResetButton
                              label="new threads"
                              onClick={() =>
                                updateSettings({
                                  defaultThreadEnvMode: DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode,
                                })
                              }
                            />
                          ) : null
                        }
                        control={
                          <Select
                            value={settings.defaultThreadEnvMode}
                            onValueChange={(value) => {
                              if (value !== "local" && value !== "worktree") return;
                              updateSettings({
                                defaultThreadEnvMode: value,
                              });
                            }}
                          >
                            <SelectTrigger
                              className="w-full sm:w-44"
                              aria-label="Default thread mode"
                            >
                              <SelectValue>
                                {settings.defaultThreadEnvMode === "worktree"
                                  ? "New worktree"
                                  : "Local"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectPopup align="end" alignItemWithTrigger={false}>
                              <SelectItem hideIndicator value="local">
                                Local
                              </SelectItem>
                              <SelectItem hideIndicator value="worktree">
                                New worktree
                              </SelectItem>
                            </SelectPopup>
                          </Select>
                        }
                      />

                      <SettingsRow
                        title="Delete confirmation"
                        description="Ask before deleting a thread and its chat history."
                        resetAction={
                          settings.confirmThreadDelete !==
                          DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete ? (
                            <SettingResetButton
                              label="delete confirmation"
                              onClick={() =>
                                updateSettings({
                                  confirmThreadDelete: DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete,
                                })
                              }
                            />
                          ) : null
                        }
                        control={
                          <Switch
                            checked={settings.confirmThreadDelete}
                            onCheckedChange={(checked) =>
                              updateSettings({
                                confirmThreadDelete: Boolean(checked),
                              })
                            }
                            aria-label="Confirm thread deletion"
                          />
                        }
                      />

                      <SettingsRow
                        title="Confirm tab close"
                        description="Ask before closing a project tab (cmd/ctrl+W or the tab's × button)."
                        resetAction={
                          settings.confirmTabClose !== DEFAULT_UNIFIED_SETTINGS.confirmTabClose ? (
                            <SettingResetButton
                              label="confirm tab close"
                              onClick={() =>
                                updateSettings({
                                  confirmTabClose: DEFAULT_UNIFIED_SETTINGS.confirmTabClose,
                                })
                              }
                            />
                          ) : null
                        }
                        control={
                          <Switch
                            checked={settings.confirmTabClose}
                            onCheckedChange={(checked) =>
                              updateSettings({
                                confirmTabClose: Boolean(checked),
                              })
                            }
                            aria-label="Confirm before closing a tab"
                          />
                        }
                      />
                    </SettingsSection>

                    <SettingsSection title="Troubleshooting & Recovery">
                      <SettingsRow
                        title="Reload Embedded Code OSS"
                        description="If the embedded editor visual state becomes corrupted, click reload to recreate the editor view without restarting Tabs."
                        control={
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={!isElectron || !activeProjectId}
                            onClick={async () => {
                              if (!activeProjectId) return;
                              try {
                                const bridge = window.desktopBridge;
                                if (bridge) {
                                  await bridge.recreateCodeSession({ projectId: activeProjectId });
                                  toastManager.add({
                                    type: "success",
                                    title: "Code OSS reloaded",
                                    description: "Re-created the Code OSS BrowserView successfully.",
                                  });
                                }
                              } catch (e) {
                                toastManager.add({
                                  type: "error",
                                  title: "Reload failed",
                                  description: String(e),
                                });
                              }
                            }}
                          >
                            Reload Code OSS
                          </Button>
                        }
                      />
                      
                      <SettingsRow
                        title="Reload Embedded Browser Previews"
                        description="If browser previews or custom embeds fail to synchronize, click reload to recreate the browser preview view."
                        control={
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={!isElectron || !activeProjectId}
                            onClick={async () => {
                              if (!activeProjectId) return;
                              try {
                                const bridge = window.desktopBridge;
                                if (bridge) {
                                  await bridge.recreateBrowserSession({ projectId: activeProjectId });
                                  toastManager.add({
                                    type: "success",
                                    title: "Browser Preview reloaded",
                                    description: "Re-created the Browser Preview BrowserView successfully.",
                                  });
                                }
                              } catch (e) {
                                toastManager.add({
                                  type: "error",
                                  title: "Reload failed",
                                  description: String(e),
                                });
                              }
                            }}
                          >
                            Reload Browser Preview
                          </Button>
                        }
                      />
                    </SettingsSection>
                  </div>
                ) : null}
                {activeSettingsSection === "startup-animation" ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">
                            Animations
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Customize interactive UI transitions and startup animation preferences.
                          </p>
                        </div>
                        <SettingsHeaderPortal>
                          <Button
                            size="xs"
                            variant="outline"
                            className="no-drag"
                            onClick={async () => {
                              const confirmed = await confirm(
                                "Restore default settings?\n\nThis will reset the animation toggles.",
                              );
                              if (confirmed) {
                                updateSettings({
                                  sliderAnimationsEnabled:
                                    DEFAULT_UNIFIED_SETTINGS.sliderAnimationsEnabled,
                                  animatedTrackFillEnabled:
                                    DEFAULT_UNIFIED_SETTINGS.animatedTrackFillEnabled,
                                });
                              }
                            }}
                          >
                            <RotateCcwIcon className="size-3.5 mr-1" />
                            Restore defaults
                          </Button>
                        </SettingsHeaderPortal>
                      </div>
                      <div className="h-px w-full bg-border/80 dark:bg-white/15 my-4" />
                    </div>

                    <SettingsSection title="Animation Controls">
                    <div className="flex flex-col gap-10">
                      {/* ANIMATION CONTROLS (Toggled) */}
                      <div className="flex flex-col gap-5">
                        <div className="px-4 sm:px-5 pt-4 sm:pt-5 flex items-center justify-between">
                          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            {animationTab === "startup" ? "Startup Animation" : "Close Animation"}
                          </h2>
                          <div className="flex bg-muted p-1 rounded-lg gap-1">
                            <button
                              onClick={() => setAnimationTab("startup")}
                              className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                animationTab === "startup"
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                              )}
                            >
                              Startup
                            </button>
                            <button
                              onClick={() => setAnimationTab("close")}
                              className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                animationTab === "close"
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                              )}
                            >
                              Close
                            </button>
                          </div>
                        </div>

                        {/* Live Preview Container */}
                        <div className="px-4 sm:px-5">
                          <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border shadow-sm">
                            <div
                              className={cn(
                                "aspect-video w-full relative overflow-hidden flex items-center justify-center transition-colors duration-300",
                                activeEffectiveTheme === "dark" ? "bg-[#09090b]" : "bg-white",
                              )}
                            >
                              {/* Wrap in fixed 1280x720 scaled to 50% */}
                              <div
                                className="absolute"
                                style={{
                                  width: "1280px",
                                  height: "720px",
                                  transform: "scale(0.5)",
                                }}
                              >
                                {animationTab === "startup" ? (
                                  <SplashScreen
                                    loader={activeStyle}
                                    palette={activePalette}
                                    theme={activeTheme}
                                  />
                                ) : (
                                  <CloseScreen
                                    key={closeReplayKey}
                                    loader={activeStyle}
                                    palette={activePalette}
                                    theme={activeTheme}
                                    phase="closing"
                                    onIntroEnd={() => {}}
                                  />
                                )}
                              </div>
                            </div>
                            <div className="bg-muted px-4 py-3 flex items-center justify-between border-t border-border">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground mr-2">
                                  Preview Theme:
                                </span>
                                <div className="flex bg-background/80 rounded-md p-1 gap-0.5 shadow-inner border border-black/5 dark:border-white/5">
                                  {["system", "dark", "light"].map((t) => (
                                    <button
                                      key={t}
                                      onClick={() => setActiveTheme(t as any)}
                                      className={cn(
                                        "px-3 py-1 text-xs font-medium rounded transition-colors capitalize",
                                        activeTheme === t
                                          ? "bg-background text-foreground shadow-sm"
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
                                    >
                                      {t === "system" ? "Auto" : t}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  updateSettings({
                                    splashLoaderStyle: previewStyle,
                                    splashLoaderPalette: previewPalette,
                                    splashLoaderTheme: previewTheme,
                                    closeLoaderStyle: closePreviewStyle,
                                    closeLoaderPalette: closePreviewPalette,
                                    closeLoaderTheme: closePreviewTheme,
                                  });
                                  if (animationTab === "startup") {
                                    setTimeout(() => window.location.reload(), 150);
                                  } else {
                                    setCloseReplayKey((k) => k + 1);
                                    setFullscreenClosePreview(true);
                                  }
                                }}
                              >
                                {animationTab === "startup" ? (
                                  <>
                                    <RefreshCwIcon className="mr-1.5 size-3" /> Reload App
                                  </>
                                ) : (
                                  <>
                                    <MonitorPlayIcon className="mr-1.5 size-3" /> Preview Fullscreen
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <SettingsRow
                          title="Style"
                          description={`Choose the visual aesthetic for the ${animationTab} animation.`}
                          control={
                            <div className="flex bg-muted p-1 rounded-lg gap-1">
                              {[
                                { value: "glass", label: "Molten Glass" },
                                { value: "solari", label: "Solari Grid" },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setActiveStyle(option.value as any)}
                                  className={cn(
                                    "px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
                                    activeStyle === option.value
                                      ? "bg-background text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                                  )}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          }
                        />

                        <SettingsRow
                          title="Color palette"
                          description={`Choose the color palette for the ${animationTab} animation.`}
                          control={
                            <div className="flex bg-muted p-1 rounded-lg gap-1">
                              {[
                                { value: "block", label: "Solid Block" },
                                { value: "mono", label: "Monochrome" },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setActivePalette(option.value as any)}
                                  className={cn(
                                    "px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
                                    activePalette === option.value
                                      ? "bg-background text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                                  )}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          }
                        />
                      </div>

                      {(previewStyle !== settings.splashLoaderStyle ||
                        previewPalette !== settings.splashLoaderPalette ||
                        previewTheme !== settings.splashLoaderTheme ||
                        closePreviewStyle !== settings.closeLoaderStyle ||
                        closePreviewPalette !== settings.closeLoaderPalette ||
                        closePreviewTheme !== settings.closeLoaderTheme) && (
                        <div className="flex justify-end p-4 sm:p-5 border-t border-border">
                          <Button
                            onClick={() =>
                              updateSettings({
                                splashLoaderStyle: previewStyle,
                                splashLoaderPalette: previewPalette,
                                splashLoaderTheme: previewTheme,
                                closeLoaderStyle: closePreviewStyle,
                                closeLoaderPalette: closePreviewPalette,
                                closeLoaderTheme: closePreviewTheme,
                              })
                            }
                            className="gap-2"
                          >
                            <SaveIcon className="size-4" />
                            Save Settings
                          </Button>
                        </div>
                      )}

                      {/* INTERFACE GROUP */}
                      <div className="flex flex-col gap-5 pt-4 sm:pt-5 border-t border-border">
                        <h2 className="px-4 sm:px-5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Interface
                        </h2>
                        <SettingsRow
                          title="Slider animations"
                          description="Smoothly animate the model picker's reasoning-effort slider."
                          resetAction={
                            settings.sliderAnimationsEnabled !==
                            DEFAULT_UNIFIED_SETTINGS.sliderAnimationsEnabled ? (
                              <SettingResetButton
                                label="slider animations"
                                onClick={() =>
                                  updateSettings({
                                    sliderAnimationsEnabled:
                                      DEFAULT_UNIFIED_SETTINGS.sliderAnimationsEnabled,
                                  })
                                }
                              />
                            ) : null
                          }
                          control={
                            <Switch
                              checked={settings.sliderAnimationsEnabled}
                              onCheckedChange={(checked) =>
                                updateSettings({
                                  sliderAnimationsEnabled: Boolean(checked),
                                })
                              }
                              aria-label="Slider animations"
                            />
                          }
                        />

                        <SettingsRow
                          title="Animated slider fill"
                          description="Smoothly animate the fill color of sliders when value changes."
                          resetAction={
                            settings.animatedTrackFillEnabled !==
                            DEFAULT_UNIFIED_SETTINGS.animatedTrackFillEnabled ? (
                              <SettingResetButton
                                label="animated slider fill"
                                onClick={() =>
                                  updateSettings({
                                    animatedTrackFillEnabled:
                                      DEFAULT_UNIFIED_SETTINGS.animatedTrackFillEnabled,
                                  })
                                }
                              />
                            ) : null
                          }
                          control={
                            <Switch
                              checked={settings.animatedTrackFillEnabled}
                              onCheckedChange={(checked) =>
                                updateSettings({ animatedTrackFillEnabled: Boolean(checked) })
                              }
                              aria-label="Animated slider fill"
                            />
                          }
                        />
                      </div>
                    </div>
                  </SettingsSection>
                </div>
                ) : null}
                {activeSettingsSection === "workspace" ? <ProjectWorkspaceSettingsSection /> : null}
                {activeSettingsSection === "source-control" ? (
                  <SourceControlSettingsPanel
                    startProviderAction={startProviderAction}
                    providerActionBusy={providerActionSession !== null}
                  />
                ) : null}
                {activeSettingsSection === "connections" ? <ConnectionsSettings /> : null}
                {activeSettingsSection === "providers" ? (
                  <div className="space-y-6">
                    <div>
                      <div className="space-y-1.5">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">
                          Providers
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Manage AI providers, API keys, custom model endpoints, and status checks.
                        </p>
                      </div>
                      <div className="h-px w-full bg-border/80 dark:bg-white/15 my-4" />
                    </div>

                    {/* 📌 Pinned Models Section */}
                    {(() => {
                      const pinnedEntries = getPinnedModels(settings);
                      return (
                        <div className="rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5 space-y-3.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="flex size-7 items-center justify-center rounded-lg bg-muted/80 text-foreground">
                                <PinIcon className="size-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-semibold text-foreground">Pinned Models</h3>
                                  <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                                    {pinnedEntries.length}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Quick access models pinned across all providers. Appears at the top of FusedModelPicker.
                                </p>
                              </div>
                            </div>

                            {/* Cockpit Command Palette for Pinning Models */}
                            <PinModelCommandPalette
                              serverProviders={serverProviders}
                              settings={settings}
                              updateSettings={updateSettings}
                              providerCards={providerCards}
                            />
                          </div>

                          {pinnedEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 py-6 px-4 text-center">
                              <PinIcon className="size-6 text-muted-foreground/40 mb-1.5" />
                              <div className="text-xs font-medium text-foreground">No Pinned Models Yet</div>
                              <div className="text-[11px] text-muted-foreground max-w-sm mt-0.5">
                                Click "+ Pin Model" above or the pin icon next to any model in your provider lists below to pin it.
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {pinnedEntries.map((entry) => {
                                const providerName =
                                  PROVIDER_DISPLAY_NAMES[
                                    entry.provider as keyof typeof PROVIDER_DISPLAY_NAMES
                                  ] ?? entry.provider;
                                const IconComponent =
                                  PROVIDER_ICONS_BY_KIND[entry.provider] ?? BotIcon;

                                const providerModels = getProviderModels(
                                  serverProviders,
                                  entry.provider,
                                );
                                const matchedModel = providerModels.find(
                                  (m) => m.slug === entry.model,
                                );
                                const displayName = matchedModel?.name ?? entry.model;

                                return (
                                  <div
                                    key={`${entry.provider}:${entry.model}`}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 transition-all hover:bg-muted/40 hover:border-border"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60">
                                        <IconComponent className="size-3.5 text-muted-foreground" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="text-xs font-semibold text-foreground truncate">
                                            {displayName}
                                          </span>
                                          <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                                            ({providerName})
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <Button
                                            size="icon-xs"
                                            variant="ghost"
                                            className="size-6 shrink-0 rounded text-foreground/80 hover:text-muted-foreground hover:bg-muted/50 cursor-pointer"
                                            onClick={() => {
                                              const nextPinned = togglePinnedModel(
                                                settings.pinnedModels,
                                                entry.provider,
                                                entry.model,
                                              );
                                              updateSettings({ pinnedModels: nextPinned as any });
                                            }}
                                            aria-label={`Unpin ${displayName}`}
                                          >
                                            <PinIcon className="size-3.5 fill-current" />
                                          </Button>
                                        }
                                      />
                                      <TooltipPopup side="top">Unpin model</TooltipPopup>
                                    </Tooltip>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between pb-1">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                        Configured Providers
                      </div>
                      <div className="flex items-center gap-1.5">
                        {serverProviders.length > 0 ? (
                          <span className="text-[11px] text-muted-foreground/60">
                            {(() => {
                              const rel = formatRelativeTime(
                                serverProviders.reduce(
                                  (latest, provider) =>
                                    provider.checkedAt > latest ? provider.checkedAt : latest,
                                  serverProviders[0]!.checkedAt,
                                ),
                              );
                              return rel.suffix ? (
                                <>
                                  Checked{" "}
                                  <span className="font-mono tabular-nums">{rel.value}</span>{" "}
                                  {rel.suffix}
                                </>
                              ) : (
                                <>Checked {rel.value}</>
                              );
                            })()}
                          </span>
                        ) : null}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                disabled={isRefreshingProviders}
                                onClick={() => void refreshProviders()}
                                aria-label="Refresh provider status"
                              >
                                {isRefreshingProviders ? (
                                  <LoaderIcon className="size-3 animate-spin" />
                                ) : (
                                  <RefreshCwIcon className="size-3" />
                                )}
                              </Button>
                            }
                          />
                          <TooltipPopup side="top">Refresh provider status</TooltipPopup>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {providerCards.map((providerCard) => {
                        const customModelInput = customModelInputByProvider[providerCard.provider];
                        const customModelError =
                          customModelErrorByProvider[providerCard.provider] ?? null;
                        const providerDisplayName =
                          PROVIDER_DISPLAY_NAMES[
                            providerCard.provider as keyof typeof PROVIDER_DISPLAY_NAMES
                          ] ?? providerCard.title;
                        const RowIcon = providerCard.icon;
                        // A provider action terminal is already open (this row or another).
                        const providerActionBusy = providerActionSession !== null;

                        return (
                          <div
                            key={providerCard.provider}
                            className="rounded-xl border border-border bg-card p-0 overflow-hidden shadow-2xs hover:border-border/90 transition-all"
                            data-slot="settings-row"
                          >
                            <div className="px-4 py-4 sm:px-5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex min-h-5 items-center gap-1.5">
                                    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
                                      <RowIcon
                                        aria-hidden="true"
                                        className={cn(
                                          "size-4",
                                          providerCard.provider === "claudeAgent"
                                            ? "text-[#d97757]"
                                            : "text-muted-foreground/85",
                                        )}
                                      />
                                      <span
                                        className={cn(
                                          "absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ring-2 ring-background",
                                          providerCard.statusStyle.dot,
                                        )}
                                      />
                                    </span>
                                    <h3 className="text-sm font-medium text-foreground">
                                      {providerDisplayName}
                                    </h3>
                                    {providerCard.versionLabel ? (
                                      <code className="text-xs text-muted-foreground">
                                        {providerCard.versionLabel}
                                      </code>
                                    ) : null}
                                    {providerCard.updatePrompt ? (
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <button
                                              type="button"
                                              aria-label={`${providerDisplayName} update available`}
                                              className="inline-flex size-4 shrink-0 items-center justify-center rounded text-amber-500 hover:text-amber-400"
                                              onClick={() =>
                                                providerCard.updatePrompt?.command &&
                                                copyToClipboard(providerCard.updatePrompt.command, {
                                                  providerName: providerDisplayName,
                                                })
                                              }
                                            >
                                              <ArrowUpCircleIcon className="size-3.5" />
                                            </button>
                                          }
                                        />
                                        <TooltipPopup side="top">
                                          Update available: click to copy installer command
                                        </TooltipPopup>
                                      </Tooltip>
                                    ) : null}
                                    {providerCard.isDirty ? (
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateSettings({
                                                  providers: {
                                                    ...settings.providers,
                                                    [providerCard.provider]:
                                                      DEFAULT_UNIFIED_SETTINGS.providers[
                                                        providerCard.provider
                                                      ],
                                                  },
                                                })
                                              }
                                              className="inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/65 hover:text-foreground"
                                              aria-label={`Reset ${providerDisplayName} to default settings`}
                                            >
                                              <Undo2Icon className="size-3.5" />
                                            </button>
                                          }
                                        />
                                        <TooltipPopup side="top">
                                          Reset provider settings to defaults
                                        </TooltipPopup>
                                      </Tooltip>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                    <span className="text-muted-foreground">
                                      {providerCard.summary.headline}
                                      {providerCard.summary.detail
                                        ? ` — ${providerCard.summary.detail}`
                                        : null}
                                    </span>
                                    {providerCard.badgeLabel ? (
                                      <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                                        {providerCard.badgeLabel}
                                      </span>
                                    ) : null}
                                  </div>

                                  {providerCard.updatePrompt ? (
                                    <div className="pt-1">
                                      {providerCard.installCommand ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 gap-1.5 px-2.5 text-xs"
                                            disabled={providerActionBusy}
                                            onClick={() =>
                                              startProviderAction({
                                                provider: providerCard.provider,
                                                providerName: providerDisplayName,
                                                command: providerCard.installCommand!,
                                                kind: "update",
                                              })
                                            }
                                          >
                                            <ArrowUpCircleIcon className="size-3.5" />
                                            Update
                                          </Button>
                                          <span className="text-[11px] text-muted-foreground/70">
                                            Opens a terminal below and runs the command.
                                          </span>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {providerCard.needsAuth && providerCard.loginCommand ? (
                                    <div className="pt-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 gap-1.5 px-2.5 text-xs"
                                          disabled={providerActionBusy}
                                          onClick={() =>
                                            startProviderAction({
                                              provider: providerCard.provider,
                                              providerName: providerDisplayName,
                                              command: providerCard.loginCommand ?? "",
                                              kind: "login",
                                            })
                                          }
                                        >
                                          <LogInIcon className="size-3.5" />
                                          Sign in
                                        </Button>
                                        <span className="text-[11px] text-muted-foreground/70">
                                          Opens a terminal below and runs the command.
                                        </span>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                    onClick={() =>
                                      setOpenProviderDetails((existing) => {
                                        const isCurrentlyOpen = Boolean(existing[providerCard.provider]);
                                        if (isCurrentlyOpen) {
                                          return {};
                                        }
                                        return {
                                          [providerCard.provider]: true,
                                        };
                                      })
                                    }
                                    aria-label={`Toggle ${providerDisplayName} details`}
                                  >
                                    <ChevronDownIcon
                                      className={cn(
                                        "size-3.5 transition-transform duration-200",
                                        openProviderDetails[providerCard.provider] && "rotate-180",
                                      )}
                                    />
                                  </Button>
                                  <Switch
                                    checked={providerCard.providerConfig.enabled}
                                    onCheckedChange={(checked) => {
                                      const isDisabling = !checked;
                                      // When disabling the provider that's currently used for
                                      // text generation, clear the selection so it falls back to
                                      // the next available provider's default model.
                                      const shouldClearModelSelection =
                                        isDisabling && textGenInstanceId === providerCard.provider;
                                      updateSettings({
                                        providers: {
                                          ...settings.providers,
                                          [providerCard.provider]: {
                                            ...settings.providers[providerCard.provider],
                                            enabled: Boolean(checked),
                                          },
                                        },
                                        ...(shouldClearModelSelection
                                          ? {
                                              textGenerationModelSelection:
                                                DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection,
                                            }
                                          : {}),
                                      });
                                    }}
                                    aria-label={`Enable ${providerDisplayName}`}
                                  />
                                </div>
                              </div>
                            </div>

                            <Collapsible
                              open={Boolean(openProviderDetails[providerCard.provider])}
                              onOpenChange={(open) =>
                                setOpenProviderDetails((existing) => {
                                  const isCurrentlyOpen = Boolean(existing[providerCard.provider]);
                                  if (open && !isCurrentlyOpen) {
                                    return { [providerCard.provider]: true };
                                  }
                                  if (!open && isCurrentlyOpen) {
                                    return {};
                                  }
                                  return existing;
                                })
                              }
                            >
                              <CollapsibleContent>
                                <div className="space-y-0">
                                  {/* Binary path */}
                                  <div className="border-t border-border/60 px-4 py-3 sm:px-5">
                                    <label
                                      htmlFor={`provider-install-${providerCard.provider}-binary-path`}
                                      className="block"
                                    >
                                      <span className="text-xs font-medium text-foreground">
                                        {providerDisplayName} binary path
                                      </span>
                                      <Input
                                        id={`provider-install-${providerCard.provider}-binary-path`}
                                        className="mt-1.5"
                                        value={providerCard.binaryPathValue}
                                        onChange={(event) =>
                                          updateSettings({
                                            providers: {
                                              ...settings.providers,
                                              [providerCard.provider]: {
                                                ...settings.providers[providerCard.provider],
                                                binaryPath: event.target.value,
                                              },
                                            },
                                          })
                                        }
                                        placeholder={providerCard.binaryPlaceholder}
                                        spellCheck={false}
                                      />
                                      <span className="mt-1 block text-xs text-muted-foreground">
                                        {providerCard.binaryDescription}
                                      </span>
                                    </label>
                                  </div>

                                  {/* Home path (Codex only) */}
                                  {providerCard.homePathKey ? (
                                    <div className="border-t border-border/60 px-4 py-3 sm:px-5">
                                      <label
                                        htmlFor={`provider-install-${providerCard.homePathKey}`}
                                        className="block"
                                      >
                                        <span className="text-xs font-medium text-foreground">
                                          CODEX_HOME path
                                        </span>
                                        <Input
                                          id={`provider-install-${providerCard.homePathKey}`}
                                          className="mt-1.5"
                                          value={codexHomePath}
                                          onChange={(event) =>
                                            updateSettings({
                                              providers: {
                                                ...settings.providers,
                                                codex: {
                                                  ...settings.providers.codex,
                                                  homePath: event.target.value,
                                                },
                                              },
                                            })
                                          }
                                          placeholder={providerCard.homePlaceholder}
                                          spellCheck={false}
                                        />
                                        {providerCard.homeDescription ? (
                                          <span className="mt-1 block text-xs text-muted-foreground">
                                            {providerCard.homeDescription}
                                          </span>
                                        ) : null}
                                      </label>
                                    </div>
                                  ) : null}

                                  {/* Models Section */}
                                  <div className="border-t border-border/60 px-4 py-4 sm:px-5">
                                    <div className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden shadow-2xs">
                                      {/* Section Header */}
                                      <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/20 border-b border-border/40">
                                        <div>
                                          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                            Models
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                              {providerCard.models.length}
                                            </Badge>
                                          </div>
                                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                                            Drag handles to reorder model preference.
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {providerCard.hasPendingOrderChanges ? (
                                            <Button
                                              size="xs"
                                              variant="default"
                                              className="h-6 gap-1 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 font-medium cursor-pointer shadow-xs"
                                              onClick={() => handleSaveModelOrder(providerCard.provider)}
                                              title="Save model order changes"
                                            >
                                              <SaveIcon className="size-3" />
                                              Save Order
                                            </Button>
                                          ) : null}
                                          {settings.providerModelPreferences?.[providerCard.provider as any]?.modelOrder?.length ? (
                                            <Button
                                              size="xs"
                                              variant="ghost"
                                              className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                                              onClick={() => {
                                                setDraftModelOrders((existing) => {
                                                  const next = { ...existing };
                                                  delete next[providerCard.provider];
                                                  return next;
                                                });
                                                const nextPrefs = resetModelOrder(
                                                  settings.providerModelPreferences,
                                                  providerCard.provider,
                                                );
                                                updateSettings({ providerModelPreferences: nextPrefs as any });
                                              }}
                                              title="Restore default model order"
                                            >
                                              <RotateCcwIcon className="size-3" />
                                              Restore Default Order
                                            </Button>
                                          ) : null}
                                        </div>
                                      </div>

                                      {/* Sortable Model List */}
                                      <div
                                        ref={(el) => {
                                          modelListRefs.current[providerCard.provider] = el;
                                        }}
                                        className="divide-y divide-border/30 p-1"
                                      >
                                        <DndContext
                                          collisionDetection={closestCenter}
                                          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                                          onDragEnd={(event: DragEndEvent) => {
                                            const { active, over } = event;
                                            if (!over || active.id === over.id) return;
                                            const oldIndex = providerCard.models.findIndex(
                                              (m: ServerProviderModel) => m.slug === active.id,
                                            );
                                            const newIndex = providerCard.models.findIndex(
                                              (m: ServerProviderModel) => m.slug === over.id,
                                            );
                                            if (oldIndex !== -1 && newIndex !== -1) {
                                              const reordered = arrayMove(
                                                [...providerCard.models],
                                                oldIndex,
                                                newIndex,
                                              );
                                              const newOrder = reordered.map((m: ServerProviderModel) => m.slug);
                                              setDraftModelOrders((existing) => ({
                                                ...existing,
                                                [providerCard.provider]: newOrder,
                                              }));
                                            }
                                          }}
                                        >
                                          <SortableContext
                                            items={providerCard.models.map((m: ServerProviderModel) => m.slug)}
                                            strategy={verticalListSortingStrategy}
                                          >
                                            {providerCard.models.map((model: ServerProviderModel) => {
                                              const caps = model.capabilities;
                                              const capLabels: string[] = [];
                                              if (caps?.supportsFastMode) capLabels.push("Fast");
                                              if (caps?.supportsThinkingToggle) capLabels.push("Thinking");
                                              if (
                                                caps?.reasoningEffortLevels &&
                                                caps.reasoningEffortLevels.length > 0
                                              )
                                                capLabels.push("Reasoning");
                                              const isPinned = isPinnedModel(
                                                getPinnedModels(settings),
                                                providerCard.provider,
                                                model.slug,
                                              );

                                              return (
                                                <SortableModelRowItem
                                                  key={`${providerCard.provider}:${model.slug}`}
                                                  id={model.slug}
                                                >
                                                  {(handle) => (
                                                    <div className="group/modelrow flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-accent/40 transition-all">
                                                      <div className="flex items-center gap-2 min-w-0">
                                                        <button
                                                          type="button"
                                                          className="cursor-grab active:cursor-grabbing text-muted-foreground/30 group-hover/modelrow:opacity-100 opacity-0 hover:text-foreground transition-all p-0.5 rounded"
                                                          aria-label={`Reorder ${model.name}`}
                                                          {...handle.attributes}
                                                          {...handle.listeners}
                                                        >
                                                          <GripVerticalIcon className="size-3.5" />
                                                        </button>
                                                        <span className="min-w-0 truncate text-xs font-medium text-foreground/90">
                                                          {model.name}
                                                        </span>
                                                        {capLabels.map((label) => (
                                                          <span
                                                            key={label}
                                                            className="text-[9px] font-mono px-1.2 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border/30 shrink-0"
                                                          >
                                                            {label}
                                                          </span>
                                                        ))}
                                                      </div>

                                                      <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                          type="button"
                                                          aria-label={
                                                            isPinned
                                                              ? `Unpin ${model.name}`
                                                              : `Pin ${model.name}`
                                                          }
                                                          className={cn(
                                                            "size-6 p-1 rounded-md flex items-center justify-center transition-all cursor-pointer",
                                                            isPinned
                                                              ? "text-amber-500 hover:text-amber-600 bg-amber-500/10"
                                                              : "text-muted-foreground/40 opacity-0 group-hover/modelrow:opacity-100 hover:text-foreground hover:bg-muted",
                                                          )}
                                                          onClick={() => {
                                                            const nextPinned = togglePinnedModel(
                                                              settings,
                                                              providerCard.provider,
                                                              model.slug,
                                                            );
                                                            updateSettings({ pinnedModels: nextPinned as any });
                                                          }}
                                                        >
                                                          <PinIcon className="size-3.5 fill-current" />
                                                        </button>

                                                        {model.name !== model.slug ? (
                                                          <Tooltip>
                                                            <TooltipTrigger
                                                              render={
                                                                <button
                                                                  type="button"
                                                                  className="size-6 p-1 rounded-md flex items-center justify-center text-muted-foreground/40 transition-colors hover:text-muted-foreground hover:bg-muted"
                                                                  aria-label={`Details for ${model.name}`}
                                                                >
                                                                  <InfoIcon className="size-3.5" />
                                                                </button>
                                                              }
                                                            />
                                                            <TooltipPopup side="top" className="max-w-56">
                                                              <code className="text-[11px] text-foreground">
                                                                {model.slug}
                                                              </code>
                                                            </TooltipPopup>
                                                          </Tooltip>
                                                        ) : null}

                                                        {model.isCustom ? (
                                                          <div className="flex items-center gap-1 pl-1">
                                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 font-normal">
                                                              custom
                                                            </Badge>
                                                            <button
                                                              type="button"
                                                              className="size-5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                                                              aria-label={`Remove ${model.slug}`}
                                                              onClick={() =>
                                                                removeCustomModel(
                                                                  providerCard.provider,
                                                                  model.slug,
                                                                )
                                                              }
                                                            >
                                                              <XIcon className="size-3" />
                                                            </button>
                                                          </div>
                                                        ) : null}
                                                      </div>
                                                    </div>
                                                  )}
                                                </SortableModelRowItem>
                                              );
                                            })}
                                          </SortableContext>
                                        </DndContext>
                                      </div>

                                      {/* Custom Model Input Footer */}
                                      <div className="p-2.5 bg-muted/20 border-t border-border/40">
                                        <div className="flex items-center gap-2">
                                          <Input
                                            value={customModelInput ?? ""}
                                            onChange={(event) =>
                                              setCustomModelInputByProvider((existing) => ({
                                                ...existing,
                                                [providerCard.provider]: event.target.value,
                                              }))
                                            }
                                            placeholder="gpt-6.7-codex-ultra-preview"
                                            className="h-8 text-xs font-mono bg-background"
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter") {
                                                event.preventDefault();
                                                addCustomModel(providerCard.provider);
                                              }
                                            }}
                                          />
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 gap-1 text-xs shrink-0 cursor-pointer"
                                            onClick={() => addCustomModel(providerCard.provider)}
                                          >
                                            <PlusIcon className="size-3.5" />
                                            Add
                                          </Button>
                                        </div>
                                        {customModelError ? (
                                          <div className="mt-1.5 text-[11px] font-medium text-destructive">
                                            {customModelError}
                                          </div>
                                        ) : null}
                                      </div>

                                      {/* Save Order Footer Bar */}
                                      {providerCard.hasPendingOrderChanges ? (
                                        <div className="flex items-center justify-between p-2.5 bg-primary/10 border-t border-primary/20">
                                          <span className="text-xs text-primary font-medium">
                                            Model preference order changed.
                                          </span>
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="h-7 gap-1.5 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                                            onClick={() => handleSaveModelOrder(providerCard.provider)}
                                          >
                                            <SaveIcon className="size-3.5" />
                                            Save Order
                                          </Button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {activeSettingsSection === "keybindings" ? (
                  <KeybindingsSettings
                    keybindings={resolvedKeybindings}
                    onUpsert={handleUpsertKeybinding}
                    onRemove={handleRemoveKeybinding}
                    keybindingsConfigPath={keybindingsConfigPath}
                    availableEditors={availableEditors}
                  />
                ) : null}
                {activeSettingsSection === "about" ? (
                  <div className="space-y-6">
                    <div>
                      <div className="space-y-1.5">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">
                          About
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Application build details, software updates, and diagnostic information.
                        </p>
                      </div>
                      <div className="h-px w-full bg-border/80 dark:bg-white/15 my-4" />
                    </div>

                    <SettingsSection title="Application Details">
                      <SettingsRow
                        title="Version"
                        description="The version of Tabs currently installed."
                        control={
                          <code className="text-xs font-medium text-muted-foreground">
                            {APP_VERSION}
                          </code>
                        }
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
                                  style={{ width: `${Math.floor(updateState.downloadPercent)}%` }}
                                />
                              </div>
                            ) : null
                          }
                          control={(() => {
                            const action = resolveDesktopUpdateButtonAction(updateState);
                            if (action === "none") {
                              if (
                                updateState.status === "disabled" ||
                                updateState.status === "error"
                              ) {
                                return (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() =>
                                      void window.desktopBridge?.openExternal(TABS_RELEASES_URL)
                                    }
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
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {providerActionSession && loginCwd ? (
          <div className="flex shrink-0 flex-col border-t border-border bg-background">
            <div className="flex items-center gap-2 px-4 py-1.5 sm:px-5">
              {providerActionSession.kind === "install" ? (
                <DownloadIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : providerActionSession.kind === "update" ? (
                <ArrowUpCircleIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <LogInIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="shrink-0 text-xs font-medium text-foreground">
                {providerActionSession.kind === "install"
                  ? `Installing ${providerActionSession.providerName}`
                  : providerActionSession.kind === "update"
                    ? `Updating ${providerActionSession.providerName}`
                    : `Signing in to ${providerActionSession.providerName}`}
              </span>
              <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {providerActionSession.command}
              </code>
              <Button
                size="xs"
                variant="ghost"
                className="ms-auto h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={closeProviderAction}
              >
                <XIcon className="size-3.5" />
                Close
              </Button>
            </div>
            <ThreadTerminalDrawer
              variant="drawer"
              showControls={false}
              threadId={providerActionSession.threadId}
              cwd={loginCwd}
              height={DEFAULT_THREAD_TERMINAL_HEIGHT}
              terminalIds={[DEFAULT_THREAD_TERMINAL_ID]}
              activeTerminalId={DEFAULT_THREAD_TERMINAL_ID}
              terminalGroups={[{ id: "action", terminalIds: [DEFAULT_THREAD_TERMINAL_ID] }]}
              activeTerminalGroupId="action"
              focusRequestId={0}
              terminalLabels={{
                [DEFAULT_THREAD_TERMINAL_ID]: providerActionSession.providerName,
              }}
              onSplitTerminal={() => {}}
              onNewTerminal={() => {}}
              onActiveTerminalChange={() => {}}
              onCloseTerminal={closeProviderAction}
              onHeightChange={() => {}}
              onAddTerminalContext={() => {}}
            />
          </div>
        ) : null}
      </div>
      {confirmDialog}
    </div>
  );
}

export const Route = createFileRoute("/_chat/settings")({
  component: SettingsRouteView,
});
