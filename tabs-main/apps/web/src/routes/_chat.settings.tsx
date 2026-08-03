import { CustomThemeStudioModal } from "../components/CustomThemeStudioModal";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowUpCircleIcon,
  BotIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FolderIcon,
  GripVerticalIcon,
  InfoIcon,
  KeyboardIcon,
  LoaderIcon,
  LogInIcon,
  MinusIcon,
  PaletteIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  Undo2Icon,
  XIcon,
  GitBranchIcon,
  Link2Icon,
  MonitorPlayIcon,
  CopyIcon,
  PipetteIcon,
  SaveIcon,
  SearchIcon,
  ShuffleIcon,
  Trash2Icon,
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
  GoogleGemini,
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
  gemini: GoogleGemini,
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
import {
  DEFAULT_CUSTOM_THEME,
  DEFAULT_CUSTOM_THEME_LIGHT,
  DEFAULT_FONT_PREFERENCES,
  EDITOR_FONT_OPTIONS,
  FONT_COMBOS,
  HEADING_FONT_OPTIONS,
  THEME_DEFINITIONS,
  UI_FONT_OPTIONS,
  calculateContrastRatio,
  calculateLuminance,
  getActiveFontCombo,
  getOptimalPrimaryForeground,
  hexToHsv,
  hsvToHex,
  hexToRgb,
  rgbToHex,
  type CustomThemeConfig,
  type ThemePreference,
} from "../lib/themes";
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
  | "themes"
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
  { id: "themes", label: "Themes", icon: PaletteIcon },
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
              className="w-full max-w-xl p-0 overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl isolate my-auto"
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
  const { fontPreferences } = useTheme();
  const activeFontCombo = useMemo(
    () => getActiveFontCombo(fontPreferences),
    [fontPreferences],
  );

  return (
    <section className={cn("space-y-3", activeFontCombo.isNeutral ? "pt-2" : "pt-0 -mt-2")}>
      <div className="flex items-center justify-between">
        {activeFontCombo.isNeutral ? (
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h3>
        ) : (
          <h2
            className={cn("text-[18px] leading-relaxed text-foreground/80", activeFontCombo.serifClass)}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h2>
        )}
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
  const { fontPreferences } = useTheme();
  const activeFontCombo = useMemo(
    () => getActiveFontCombo(fontPreferences),
    [fontPreferences],
  );

  return (
    <div
      className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5"
      data-slot="settings-row"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-h-5 items-center gap-1.5">
            <h3
              className="text-[14.5px] font-bold text-foreground flex items-center gap-2"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {title}
            </h3>
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

export interface SavedCustomPreset {
  id: string;
  name: string;
  config: CustomThemeConfig;
  createdAt: number;
}

const SAVED_PRESETS_KEY = "tabs:saved-custom-presets";

function getStoredSavedPresets(): SavedCustomPreset[] {
  try {
    const raw = localStorage.getItem(SAVED_PRESETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {}
  return [];
}

function saveSavedPresetsToStorage(presets: SavedCustomPreset[]) {
  try {
    localStorage.setItem(SAVED_PRESETS_KEY, JSON.stringify(presets));
  } catch (err) {}
}

export type RandomStyleMode = "balanced" | "pastel" | "vivid" | "minimal" | "cyberpunk" | "warm";

export const RANDOM_STYLE_OPTIONS: { id: RandomStyleMode; label: string }[] = [
  { id: "pastel", label: "Pastel Soft" },
  { id: "vivid", label: "Vivid Electric" },
  { id: "minimal", label: "Minimal Mono" },
  { id: "cyberpunk", label: "Cyberpunk Neon" },
  { id: "warm", label: "Warm Earthy" },
  { id: "balanced", label: "Harmonized (Default)" },
];

const AESTHETIC_PREFIXES = [
  "Tokyo", "Cyber", "Aesthetic", "Midnight", "Matcha", "Sakura", "Velvet",
  "Obsidian", "Pixel", "Lunar", "Vibe", "Neon", "Ghost", "Solar", "Chai",
  "Cosmic", "Electric", "Retro", "Emerald", "Twilight", "Solstice", "Oasis",
  "Zenith", "Nebula", "Monaco", "Kyoto", "Mochi", "Indigo", "Lumina"
];

const AESTHETIC_SUFFIXES = [
  "Drift", "Haze", "Glow", "Pulse", "Check", "Bloom", "Latte", "Signal",
  "Wave", "Dust", "Aura", "Flare", "Syntax", "Shift", "Echo", "Mirage",
  "Vibes", "Mist", "Realm", "Matrix", "Chroma", "Radiance", "Spark"
];

export function generateAestheticThemeName(): string {
  const p = AESTHETIC_PREFIXES[Math.floor(Math.random() * AESTHETIC_PREFIXES.length)];
  const s = AESTHETIC_SUFFIXES[Math.floor(Math.random() * AESTHETIC_SUFFIXES.length)];
  return `${p} ${s}`;
}

const CURATED_PASTEL_HARMONIES = [
  { bg: "#faf4f6", card: "#ffffff", border: "#f3dbe3", fg: "#2d1b22", primary: "#d9658b" }, // Sakura Bloom
  { bg: "#f5f7f3", card: "#ffffff", border: "#dbe4d5", fg: "#182615", primary: "#4f8045" }, // Matcha Latte
  { bg: "#f6f5fa", card: "#ffffff", border: "#e0dcf2", fg: "#1d162d", primary: "#6c56ce" }, // Lavender Haze
  { bg: "#faf5f3", card: "#ffffff", border: "#f5dfd6", fg: "#2e1c15", primary: "#d46b50" }, // Peach Fizz
  { bg: "#f4f7fb", card: "#ffffff", border: "#d9e4f5", fg: "#122033", primary: "#3174ed" }, // Sky Cloud
  { bg: "#1a1721", card: "#231f2d", border: "#352e45", fg: "#ebdff7", primary: "#b388ff" }, // Muted Lilac
  { bg: "#151a17", card: "#1d2420", border: "#2c3831", fg: "#dcf2e6", primary: "#70c497" }, // Sage Twilight
];

const CURATED_VIVID_HARMONIES = [
  { bg: "#090d16", card: "#111827", border: "#1f2937", fg: "#f9fafb", primary: "#6366f1" }, // Vibe Check (Indigo)
  { bg: "#06111e", card: "#0b1d32", border: "#143254", fg: "#f0f9ff", primary: "#06b6d4" }, // Electric Cyan
  { bg: "#130a10", card: "#20101b", border: "#381a2f", fg: "#fdf2f8", primary: "#f43f5e" }, // Hot Coral
  { bg: "#041410", card: "#08241d", border: "#104236", fg: "#ecfdf5", primary: "#10b981" }, // Emerald Pulse
  { bg: "#161108", card: "#241c0e", border: "#3f3018", fg: "#fffbeb", primary: "#f59e0b" }, // Amber Gold
];

const CURATED_MINIMAL_HARMONIES = [
  { bg: "#0f172a", card: "#1e293b", border: "#334155", fg: "#f8fafc", primary: "#38bdf8" }, // Slate Blue
  { bg: "#121212", card: "#1e1e1e", border: "#2d2d2d", fg: "#ededed", primary: "#f5f5f5" }, // Pure Charcoal
  { bg: "#fafafa", card: "#ffffff", border: "#e5e5e5", fg: "#171717", primary: "#2563eb" }, // Minimal Studio Light
];

const CURATED_CYBERPUNK_HARMONIES = [
  { bg: "#080711", card: "#100e20", border: "#221c3d", fg: "#f3f0ff", primary: "#d946ef" }, // Cyber Haze
  { bg: "#0d021a", card: "#190533", border: "#340a66", fg: "#fae8ff", primary: "#00f0ff" }, // Neon Synthwave
  { bg: "#020d07", card: "#051a0e", border: "#0b381d", fg: "#dcffe4", primary: "#00ff66" }, // Matrix Terminal
  { bg: "#0a0e1a", card: "#12192e", border: "#1e294d", fg: "#e0e8ff", primary: "#7aa2f7" }, // Tokyo Night
];

const CURATED_WARM_HARMONIES = [
  { bg: "#18120e", card: "#251c16", border: "#3c2d24", fg: "#f7ede8", primary: "#e07a5f" }, // Chai Midnight
  { bg: "#120e0b", card: "#1c1612", border: "#30261f", fg: "#f4eae1", primary: "#d4a373" }, // Espresso Dark
  { bg: "#fcf8f5", card: "#ffffff", border: "#f0dfd5", fg: "#2c1a11", primary: "#c85a32" }, // Terracotta Sunset
  { bg: "#fdfbf7", card: "#ffffff", border: "#f2e9d8", fg: "#241c10", primary: "#b58900" }, // Golden Oat
];

function generateHarmonizedPalette(
  baseVariant: "dark" | "light",
  styleMode: RandomStyleMode = "pastel",
): CustomThemeConfig["colors"] {
  let pool: typeof CURATED_PASTEL_HARMONIES;

  switch (styleMode) {
    case "pastel":
      pool = CURATED_PASTEL_HARMONIES;
      break;
    case "vivid":
      pool = CURATED_VIVID_HARMONIES;
      break;
    case "minimal":
      pool = CURATED_MINIMAL_HARMONIES;
      break;
    case "cyberpunk":
      pool = CURATED_CYBERPUNK_HARMONIES;
      break;
    case "warm":
      pool = CURATED_WARM_HARMONIES;
      break;
    default:
      pool = [...CURATED_PASTEL_HARMONIES, ...CURATED_VIVID_HARMONIES, ...CURATED_WARM_HARMONIES];
      break;
  }

  // Filter pool matching baseVariant if necessary
  const matched = pool.filter((p) => {
    const isDarkBg = calculateLuminance(p.bg) < 0.2;
    return baseVariant === "dark" ? isDarkBg : !isDarkBg;
  });

  const selected = matched.length > 0
    ? matched[Math.floor(Math.random() * matched.length)]!
    : pool[Math.floor(Math.random() * pool.length)]!;

  let fg = selected.fg;
  let bg = selected.bg;

  // Guarantee WCAG AA contrast (>= 4.5:1)
  let ratio = calculateContrastRatio(fg, bg).ratio;
  if (ratio < 4.5) {
    fg = baseVariant === "dark" ? "#f8fafc" : "#0f172a";
  }

  return {
    background: bg,
    foreground: fg,
    card: selected.card,
    border: selected.border,
    primary: selected.primary,
  };
}

function ThemePickerGrid({
  activeTheme,
  customConfig,
  savedPresets,
  onSelectTheme,
  onOpenStudio,
  onDeletePreset,
  onRenamePreset,
  onEditPresetInStudio,
}: {
  activeTheme: ThemePreference;
  customConfig: CustomThemeConfig;
  savedPresets: SavedCustomPreset[];
  onSelectTheme: (theme: ThemePreference, customOverride?: CustomThemeConfig) => void;
  onOpenStudio: () => void;
  onDeletePreset: (presetId: string) => void;
  onRenamePreset: (presetId: string, newName: string) => void;
  onEditPresetInStudio?: (preset: SavedCustomPreset) => void;
}) {
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingNameInput, setEditingNameInput] = useState("");

  const curatedThemes = [
    {
      id: "system" as const,
      name: "System Auto",
      description: "Match OS color scheme",
      baseVariant: "auto",
      badge: "AUTO",
      bg: "linear-gradient(135deg, #141414 50%, #f6f5f2 50%)",
      card: "#181818",
      accent: "#366ffb",
      border: "rgba(255,255,255,0.15)",
      codeKeyword: "#38bdf8",
      codeString: "#a7f3d0",
    },
    ...Object.values(THEME_DEFINITIONS)
      .filter((t) => t.id !== "custom")
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        baseVariant: t.baseVariant,
        badge: t.id === "true-black" ? "OLED" : t.baseVariant.toUpperCase(),
        bg: t.colors.background,
        card: t.colors.card,
        accent: t.colors.codeOss.accent || t.colors.primary,
        border: t.colors.border,
        codeKeyword: t.colors.primary,
        codeString: t.colors.accentForeground || t.colors.foreground,
      })),
  ];

  return (
    <div className="p-5 sm:p-6 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5 w-full">
        {/* Curated Themes */}
        {curatedThemes.map((t) => {
          const isSelected = activeTheme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-theme-id={t.id}
              aria-label={`Theme: ${t.name}`}
              onClick={() => onSelectTheme(t.id)}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-300 cursor-pointer select-none",
                isSelected
                  ? "border-foreground/50 bg-card/90 shadow-md"
                  : "border-border/60 bg-card/40 backdrop-blur-md hover:border-border hover:bg-card/70 hover:shadow-lg hover:-translate-y-0.5",
              )}
            >
              <div
                className="relative h-24 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10 shadow-xs transition-transform duration-300 group-hover:scale-[1.02]"
                style={{ background: t.bg }}
              >
                <div
                  className="flex items-center justify-between px-2.5 py-1.5 border-b border-black/10 dark:border-white/10"
                  style={{ backgroundColor: t.card }}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full" style={{ backgroundColor: t.accent }} />
                    <div className="size-1.5 rounded-full opacity-40" style={{ backgroundColor: t.accent }} />
                    <div className="size-1.5 rounded-full opacity-20" style={{ backgroundColor: t.accent }} />
                  </div>
                  <div className="h-1.5 w-10 rounded-full opacity-50 bg-foreground" />
                </div>

                <div className="flex h-full">
                  <div
                    className="w-7 border-r border-black/10 dark:border-white/10 p-1 flex flex-col gap-1"
                    style={{ backgroundColor: t.card }}
                  >
                    <div className="h-1 w-full rounded-sm opacity-40 bg-foreground" />
                    <div className="h-1 w-3/4 rounded-sm opacity-20 bg-foreground" />
                    <div className="h-1 w-1/2 rounded-sm opacity-20 bg-foreground" />
                  </div>

                  <div className="flex-1 p-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1">
                      <div className="h-1 w-6 rounded-full opacity-80" style={{ backgroundColor: t.codeKeyword }} />
                      <div className="h-1 w-10 rounded-full opacity-50 bg-foreground" />
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-1 w-4 rounded-full opacity-30 bg-foreground" />
                      <div className="h-1 w-12 rounded-full opacity-70" style={{ backgroundColor: t.codeString }} />
                    </div>
                    <div className="h-1 w-8 rounded-full opacity-90" style={{ backgroundColor: t.accent }} />
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex items-end justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold tracking-tight text-foreground block truncate">
                    {t.name}
                  </span>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 font-normal">
                    {t.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider",
                    isSelected
                      ? "bg-foreground/10 text-foreground border border-foreground/20"
                      : "bg-muted text-muted-foreground border border-border/40",
                  )}
                >
                  {t.badge}
                </span>
              </div>
            </button>
          );
        })}

        {/* User Saved Presets */}
        {savedPresets.map((preset) => {
          const isSelected =
            activeTheme === "custom" &&
            JSON.stringify(customConfig.colors) === JSON.stringify(preset.config.colors);
          const isEditing = editingPresetId === preset.id;

          return (
            <div
              key={preset.id}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-300 select-none",
                isSelected
                  ? "border-foreground/50 bg-card/90 shadow-md"
                  : "border-border/60 bg-card/40 backdrop-blur-md hover:border-border hover:bg-card/70 hover:shadow-lg hover:-translate-y-0.5",
              )}
            >
              {/* Edit in Studio / Rename / Delete Buttons on Hover */}
              {!isEditing && (
                <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-0.5 rounded-xl border border-border/80 bg-background/95 p-1 shadow-lg backdrop-blur-md">
                  <button
                    type="button"
                    title="Edit Theme in Studio"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPresetInStudio?.(preset);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <SlidersHorizontalIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Rename Preset"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPresetId(preset.id);
                      setEditingNameInput(preset.name);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <PencilIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete Saved Preset"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePreset(preset.id);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Card Click target */}
              <button
                type="button"
                onClick={() => !isEditing && onSelectTheme("custom", preset.config)}
                className="w-full text-left flex flex-col justify-between h-full"
              >
                <div
                  className="relative h-24 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10 shadow-xs transition-transform duration-300 group-hover:scale-[1.02]"
                  style={{ background: preset.config.colors.background }}
                >
                  <div
                    className="flex items-center justify-between px-2.5 py-1.5 border-b border-black/10 dark:border-white/10"
                    style={{ backgroundColor: preset.config.colors.card }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full" style={{ backgroundColor: preset.config.colors.primary }} />
                    </div>
                    <div className="h-1.5 w-10 rounded-full opacity-50 bg-foreground" />
                  </div>

                  <div className="flex h-full p-2 flex-col gap-1.5">
                    <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: preset.config.colors.primary }} />
                    <div className="h-1.5 w-20 rounded-full opacity-70" style={{ backgroundColor: preset.config.colors.foreground }} />
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Input
                      autoFocus
                      value={editingNameInput}
                      onChange={(e) => setEditingNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenamePreset(preset.id, editingNameInput);
                          setEditingPresetId(null);
                        } else if (e.key === "Escape") {
                          setEditingPresetId(null);
                        }
                      }}
                      className="h-7 text-xs rounded-lg bg-background border-border/80 text-foreground px-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onRenamePreset(preset.id, editingNameInput);
                        setEditingPresetId(null);
                      }}
                      className="p-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
                    >
                      <CheckIcon className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-3.5 flex items-end justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold tracking-tight text-foreground block truncate">
                        {preset.name}
                      </span>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 font-normal">
                        User Saved Preset
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border/80">
                      SAVED
                    </span>
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* Option B: Studio Launcher Card */}
        <button
          type="button"
          onClick={onOpenStudio}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-dashed border-border/70 bg-card/20 p-3.5 text-left transition-all duration-300 hover:border-foreground/40 hover:bg-card/40 cursor-pointer select-none"
        >
          <div className="relative flex h-24 w-full flex-col items-center justify-center rounded-xl border border-border/40 bg-muted/20 gap-2 group-hover:bg-muted/40 transition-colors">
            <PaletteIcon className="size-5 text-foreground transition-transform group-hover:scale-110" />
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
              Launch Studio Drawer
            </span>
          </div>

          <div className="mt-3.5 flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold tracking-tight text-foreground block truncate">
                Custom Theme Studio
              </span>
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 font-normal">
                Build & randomize custom palettes
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground border border-border/40">
              STUDIO
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

// CustomThemeStudioModal imported from components/CustomThemeStudioModal.tsx

const CURATED_STUDIO_SWATCHES = [
  "#6366F1", "#06B6D4", "#10B981", "#F43F5E",
  "#F59E0B", "#A855F7", "#EC4899", "#3B82F6",
  "#1E293B", "#F8FAFC"
];

function StudioColorPickerPopover({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
}) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [format, setFormat] = useState<"hex" | "rgb">("hex");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const satValRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHsv(hexToHsv(value));
  }, [value]);

  const updateColorFromHsv = (h: number, s: number, v: number) => {
    const newHex = hsvToHex(h, s, v);
    setHsv({ h, s, v });
    onChange(newHex);
  };

  const handleSatValPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!satValRef.current) return;
    const rect = satValRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const s = x / rect.width;
    const v = 1 - y / rect.height;
    updateColorFromHsv(hsv.h, s, v);
  };

  const handleHuePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const h = Math.round((x / rect.width) * 360);
    updateColorFromHsv(h, hsv.s, hsv.v);
  };

  const handleEyedropper = async () => {
    if ("EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          onChange(result.sRGBHex);
        }
      } catch (err) {}
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const contrastInfo = calculateContrastRatio(value, "#141414");
  const currentRgb = hexToRgb(value);
  const pureHueHex = hsvToHex(hsv.h, 1, 1);

  return (
    <div
      ref={containerRef}
      className="absolute top-full right-0 z-50 mt-2 w-72 rounded-3xl border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
    >
      {/* 2D Saturation / Value Canvas */}
      <div
        ref={satValRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleSatValPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handleSatValPointer(e);
        }}
        className="relative h-36 w-full rounded-2xl cursor-crosshair overflow-hidden shadow-inner select-none"
        style={{ backgroundColor: pureHueHex }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

        {/* Handle Ring */}
        <div
          className="pointer-events-none absolute size-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-xl ring-2 ring-primary/80 transition-transform active:scale-125"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: value,
          }}
        />
      </div>

      {/* Controls Row: Eyedropper, Swatch, Hue Slider */}
      <div className="mt-3.5 flex items-center gap-3">
        {"EyeDropper" in window ? (
          <button
            type="button"
            onClick={handleEyedropper}
            title="Pick color from screen"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
          >
            <PipetteIcon className="size-4" />
          </button>
        ) : (
          <div className="size-8 shrink-0 rounded-xl border border-border shadow-xs" style={{ backgroundColor: value }} />
        )}

        {/* Custom Hue Track */}
        <div
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleHuePointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handleHuePointer(e);
          }}
          className="relative flex-1 h-3.5 rounded-full cursor-pointer overflow-hidden select-none shadow-xs"
          style={{
            background:
              "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-background shadow-md ring-1 ring-black/20"
            style={{ left: `${(hsv.h / 360) * 100}%` }}
          />
        </div>
      </div>

      {/* Inputs & Format Toggle */}
      <div className="mt-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setFormat("hex")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer",
                format === "hex" ? "bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:bg-accent dark:border dark:border-primary dark:shadow-[0_0_15px_var(--color-primary)] dark:ring-0" : "text-muted-foreground hover:text-foreground"
              )}
            >
              HEX
            </button>
            <button
              type="button"
              onClick={() => setFormat("rgb")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer",
                format === "rgb" ? "bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:bg-accent dark:border dark:border-primary dark:shadow-[0_0_15px_var(--color-primary)] dark:ring-0" : "text-muted-foreground hover:text-foreground"
              )}
            >
              RGB
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded-full border",
                contrastInfo.isLowContrast
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                  : "border-border/80 bg-muted/60 text-muted-foreground"
              )}
            >
              {contrastInfo.ratio}:1
            </span>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy hex code"
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              {copied ? <CheckIcon className="size-3.5 text-primary" /> : <CopyIcon className="size-3.5" />}
            </button>
          </div>
        </div>

        {format === "hex" ? (
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-mono font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 uppercase"
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase block text-center">R</span>
              <input
                type="number"
                min={0}
                max={255}
                value={currentRgb.r}
                onChange={(e) => onChange(rgbToHex(Number(e.target.value), currentRgb.g, currentRgb.b))}
                className="w-full rounded-lg border border-border/80 bg-background py-1 text-center text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase block text-center">G</span>
              <input
                type="number"
                min={0}
                max={255}
                value={currentRgb.g}
                onChange={(e) => onChange(rgbToHex(currentRgb.r, Number(e.target.value), currentRgb.b))}
                className="w-full rounded-lg border border-border/80 bg-background py-1 text-center text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase block text-center">B</span>
              <input
                type="number"
                min={0}
                max={255}
                value={currentRgb.b}
                onChange={(e) => onChange(rgbToHex(currentRgb.r, currentRgb.g, Number(e.target.value)))}
                className="w-full rounded-lg border border-border/80 bg-background py-1 text-center text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick Swatches Bar */}
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
        {CURATED_STUDIO_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => onChange(swatch)}
            className={cn(
              "size-4.5 rounded-full border border-black/20 shadow-xs transition-transform hover:scale-125 cursor-pointer",
              value.toLowerCase() === swatch.toLowerCase() && "ring-2 ring-primary ring-offset-1 ring-offset-card"
            )}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
    </div>
  );
}

function ColorPickerRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={popoverRef} className="relative flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/50 p-3 transition-all hover:border-border">
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-foreground block truncate">{label}</span>
        <p className="text-[11px] text-muted-foreground truncate">{description}</p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center justify-center size-8 rounded-xl border border-border/80 shadow-xs overflow-hidden transition-transform hover:scale-105 cursor-pointer ring-offset-background focus:ring-2 focus:ring-primary/40"
          style={{ backgroundColor: value }}
        >
          <div className="absolute inset-0 bg-black/5 opacity-0 hover:opacity-100 transition-opacity" />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => setIsOpen(true)}
          className="w-24 rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs font-mono font-medium text-foreground uppercase focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {isOpen && (
        <StudioColorPickerPopover
          value={value}
          onChange={onChange}
          onClose={() => setIsOpen(false)}
        />
      )}
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

function StartupPreviewOverlay({ loader, palette, theme, fontComboId, customFont, onClose }: any) {
  const [isExiting, setIsExiting] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 4000);

    return () => clearTimeout(exitTimer);
  }, []);

  useEffect(() => {
    if (isExiting) {
      const closeTimer = setTimeout(() => {
        onCloseRef.current();
      }, 700);
      return () => clearTimeout(closeTimer);
    }
  }, [isExiting]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[99999] cursor-pointer will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isExiting ? "-translate-y-full" : "translate-y-0",
      )}
      onClick={() => setIsExiting(true)}
    >
      <SplashScreen
        loader={loader}
        palette={palette}
        theme={theme}
        fontComboId={fontComboId}
        customFont={customFont}
      />
    </div>
  );
}

function ClosePreviewOverlay({ loader, palette, theme, fontComboId, customFont, onClose }: any) {
  const [phase, setPhase] = useState<any>("idle");
  const [isExiting, setIsExiting] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase("closing");
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  const handleIntroEnd = () => {
    setIsExiting(true);
    setTimeout(() => {
      onCloseRef.current();
    }, 700);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[99999] cursor-pointer will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isExiting ? "-translate-y-full" : "translate-y-0",
      )}
      onClick={() => setIsExiting(true)}
    >
      <CloseScreen
        loader={loader}
        palette={palette}
        theme={theme}
        phase={phase}
        fontComboId={fontComboId}
        customFont={customFont}
        onIntroEnd={handleIntroEnd}
      />
    </div>
  );
}

const TOOLBAR_STYLES = [
  { id: "solid", label: "Elevated Solid", description: "Pure high-contrast accent block with a soft elastic slide." },
  { id: "ghost-mesh", label: "Ambient Mesh", description: "Soft radial gradient mesh fading elegantly from the bottom edge." },
  { id: "spotlight", label: "Edge Illumination", description: "Directional light emitting smoothly from the top boundary." },
  { id: "dot", label: "Minimal Indicator", description: "Ultra-minimal glowing indicator tracking below the active tab." },
  { id: "refraction", label: "Frosted Lens", description: "Physical glass effect distorting a micro-dot matrix track." },
  { id: "titanium", label: "Brushed Titanium", description: "Metallic machined finish with an animated sweeping glare." },
] as const;

function ToolbarPreview({ styleId }: { styleId: string }) {
  const [activeTab, setActiveTab] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackRef.current || !pillRef.current) return;
    const timeoutId = setTimeout(() => {
      const tabs = trackRef.current?.querySelectorAll<HTMLButtonElement>('.nav-tab');
      if (!tabs) return;
      const targetTab = tabs[activeTab];
      if (!targetTab) return;

      const targetLeft = targetTab.offsetLeft;
      const targetWidth = targetTab.offsetWidth;

      if (pillRef.current) {
        pillRef.current.style.transform = `translateX(${targetLeft}px)`;
        pillRef.current.style.width = `${targetWidth}px`;
      }
    }, 10);
    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  return (
    <div 
      className="flex items-center justify-center p-4 bg-background/50 rounded-xl border border-border/40 my-2"
      onClick={(e) => {
        // prevent clicks from bubbling
        e.stopPropagation();
      }}
    >
      <div ref={trackRef} className={cn("nav-track", `design-${styleId}`)}>
        <div ref={pillRef} className="active-pill" />
        {['Code', 'Agents', 'Browser'].map((label, i) => (
          <button 
            key={label}
            type="button" 
            className={cn("nav-tab", activeTab === i && "active")}
            onClick={() => setActiveTab(i)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsRouteView() {
  const { confirm, confirmDialog } = useConfirm();
  const navigate = useNavigate();
  const {
    theme,
    setTheme,
    customThemeConfig,
    setCustomThemeConfig,
    fontPreferences,
    setFontPreferences,
  } = useTheme();

  const activeFontCombo = useMemo(
    () => getActiveFontCombo(fontPreferences),
    [fontPreferences],
  );
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
  >({});
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
  const [startupReplayKey, setStartupReplayKey] = useState(0);

  const [animationTab, setAnimationTab] = useState<"startup" | "close">("startup");
  /* Startup Animation Font State */
  const [savedStartupAnimationFontComboId, setSavedStartupAnimationFontComboId] = useState<string>(() => {
    try {
      return (
        window.localStorage?.getItem("tabs.startupAnimationFontComboId") ??
        window.localStorage?.getItem("tabs.animationFontComboId") ??
        "app-default"
      );
    } catch {
      return "app-default";
    }
  });
  const [savedStartupCustomAnimationFont, setSavedStartupCustomAnimationFont] = useState<string>(() => {
    try {
      return (
        window.localStorage?.getItem("tabs.startupCustomAnimationFont") ??
        window.localStorage?.getItem("tabs.customAnimationFont") ??
        "'Inter', sans-serif"
      );
    } catch {
      return "'Inter', sans-serif";
    }
  });

  const [previewStartupAnimationFontComboId, setPreviewStartupAnimationFontComboId] =
    useState<string>(savedStartupAnimationFontComboId);
  const [previewStartupCustomAnimationFont, setPreviewStartupCustomAnimationFont] =
    useState<string>(savedStartupCustomAnimationFont);

  /* Close Animation Font State */
  const [savedCloseAnimationFontComboId, setSavedCloseAnimationFontComboId] = useState<string>(() => {
    try {
      return (
        window.localStorage?.getItem("tabs.closeAnimationFontComboId") ??
        window.localStorage?.getItem("tabs.animationFontComboId") ??
        "app-default"
      );
    } catch {
      return "app-default";
    }
  });
  const [savedCloseCustomAnimationFont, setSavedCloseCustomAnimationFont] = useState<string>(() => {
    try {
      return (
        window.localStorage?.getItem("tabs.closeCustomAnimationFont") ??
        window.localStorage?.getItem("tabs.customAnimationFont") ??
        "'Inter', sans-serif"
      );
    } catch {
      return "'Inter', sans-serif";
    }
  });

  const [previewCloseAnimationFontComboId, setPreviewCloseAnimationFontComboId] =
    useState<string>(savedCloseAnimationFontComboId);
  const [previewCloseCustomAnimationFont, setPreviewCloseCustomAnimationFont] =
    useState<string>(savedCloseCustomAnimationFont);

  const activeFontComboId =
    animationTab === "startup" ? previewStartupAnimationFontComboId : previewCloseAnimationFontComboId;
  const setActiveFontComboId =
    animationTab === "startup" ? setPreviewStartupAnimationFontComboId : setPreviewCloseAnimationFontComboId;

  const activeCustomFont =
    animationTab === "startup" ? previewStartupCustomAnimationFont : previewCloseCustomAnimationFont;
  const setActiveCustomFont =
    animationTab === "startup" ? setPreviewStartupCustomAnimationFont : setPreviewCloseCustomAnimationFont;

  const [alwaysAnimateGitLoader, setAlwaysAnimateGitLoader] = useState<boolean>(() => {
    try {
      return window.localStorage?.getItem("tabs.alwaysAnimateGitLoader") === "true";
    } catch {
      return false;
    }
  });
  const [fullscreenClosePreview, setFullscreenClosePreview] = useState(false);
  const [fullscreenStartupPreview, setFullscreenStartupPreview] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isCustomFontMode, setIsCustomFontMode] = useState(false);
  const [editingStudioPresetName, setEditingStudioPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState<SavedCustomPreset[]>(() => getStoredSavedPresets());

  const handleSavePreset = useCallback((name: string, config: CustomThemeConfig) => {
    const newPreset: SavedCustomPreset = {
      id: `custom-saved-${Date.now()}`,
      name,
      config,
      createdAt: Date.now(),
    };
    setSavedPresets((prev) => {
      const next = [newPreset, ...prev];
      saveSavedPresetsToStorage(next);
      return next;
    });
    setCustomThemeConfig(config);
    setTheme("custom");
    setIsStudioOpen(false);
    toastManager.add({
      type: "success",
      title: "Preset Saved",
      description: `Preset "${name}" saved cleanly.`,
    });
  }, [setCustomThemeConfig, setTheme]);

  const handleDeletePreset = useCallback((presetId: string) => {
    const confirmed = confirm("Are you sure you want to delete this custom preset?");
    if (!confirmed) return;

    setSavedPresets((prev) => {
      const next = prev.filter((p) => p.id !== presetId);
      saveSavedPresetsToStorage(next);
      return next;
    });
    toastManager.add({
      type: "info",
      title: "Preset Deleted",
      description: "Custom theme preset removed.",
    });
  }, [confirm]);

  const handleRenamePreset = useCallback((presetId: string, newName: string) => {
    if (!newName.trim()) return;
    setSavedPresets((prev) => {
      const next = prev.map((p) => (p.id === presetId ? { ...p, name: newName.trim() } : p));
      saveSavedPresetsToStorage(next);
      return next;
    });
    toastManager.add({
      type: "success",
      title: "Preset Renamed",
      description: `Preset renamed to "${newName.trim()}".`,
    });
  }, []);

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

    setPreviewStartupAnimationFontComboId(savedStartupAnimationFontComboId);
    setPreviewStartupCustomAnimationFont(savedStartupCustomAnimationFont);
    setPreviewCloseAnimationFontComboId(savedCloseAnimationFontComboId);
    setPreviewCloseCustomAnimationFont(savedCloseCustomAnimationFont);
  }, [
    settings.splashLoaderStyle,
    settings.splashLoaderPalette,
    settings.splashLoaderTheme,
    settings.closeLoaderStyle,
    settings.closeLoaderPalette,
    settings.closeLoaderTheme,
    savedStartupAnimationFontComboId,
    savedStartupCustomAnimationFont,
    savedCloseAnimationFontComboId,
    savedCloseCustomAnimationFont,
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
      .then((res: any) => {
        try {
          localStorage.setItem("tabs_last_models_refresh_time", String(Date.now()));
        } catch {}
        void refreshServerConfig();
        void queryClient.invalidateQueries({ queryKey: serverQueryKeys.config() });
        void queryClient.invalidateQueries({ queryKey: ["source-control-discovery"] });

        const providersList: ReadonlyArray<ServerProvider> = res?.providers ?? [];
        if (providersList.length > 0) {
          const readyCount = providersList.filter(
            (p) => p.status === "ready" || p.auth.status === "authenticated",
          ).length;
          const failedProviders = providersList
            .filter((p) => p.status === "error")
            .map((p) => PROVIDER_DISPLAY_NAMES[p.driver as keyof typeof PROVIDER_DISPLAY_NAMES] ?? p.driver);

          if (failedProviders.length > 0) {
            toastManager.add({
              type: "warning",
              title: "Providers refreshed with warnings",
              description: `${readyCount} of ${providersList.length} providers refreshed — ${failedProviders.join(", ")} failed.`,
            });
          } else {
            toastManager.add({
              type: "success",
              title: "Models refreshed",
              description: `${providersList.length} of ${providersList.length} providers refreshed successfully.`,
            });
          }
        } else {
          toastManager.add({
            type: "success",
            title: "Models refreshed",
            description: "Provider model discovery refresh completed.",
          });
        }
      })
      .catch((error: unknown) => {
        console.warn("Failed to refresh providers", error);
        toastManager.add({
          type: "error",
          title: "Refresh failed",
          description: error instanceof Error ? error.message : "Failed to query provider model endpoints.",
        });
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
    setOpenProviderDetails({});
    setCustomModelInputByProvider({
      codex: "",
      claudeAgent: "",
    });
    setCustomModelErrorByProvider({});
  }

  return (
    <div className="isolate flex h-full min-h-0 min-w-0 flex-col overflow-hidden overscroll-y-none bg-background text-foreground">
      {fullscreenStartupPreview && (
        <StartupPreviewOverlay
          key={startupReplayKey}
          loader={previewStyle}
          palette={previewPalette}
          theme={effectivePreviewTheme}
          fontComboId={previewStartupAnimationFontComboId}
          customFont={previewStartupCustomAnimationFont}
          onClose={() => setFullscreenStartupPreview(false)}
        />
      )}
      {fullscreenClosePreview && (
        <ClosePreviewOverlay
          key={closeReplayKey}
          loader={closePreviewStyle}
          palette={closePreviewPalette}
          theme={effectiveClosePreviewTheme}
          fontComboId={previewCloseAnimationFontComboId}
          customFont={previewCloseCustomAnimationFont}
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
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm leading-normal pb-0.5 transition-colors",
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <NavIcon className="size-4 shrink-0" />
                    <span className="capitalize">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto overscroll-y-contain py-6">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-12">
                {activeSettingsSection === "general" ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <h2
                            className={cn("text-[28px] leading-relaxed pb-1 text-foreground mb-2 font-bold", activeFontCombo.sansClass)}
                            style={{ fontFamily: "var(--font-sans)", textTransform: "capitalize" }}
                          >
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
                      <div className="h-[5px] w-full my-5 rounded-full dark:block hidden" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.25), transparent)' }} />
                      <div className="h-[5px] w-full my-5 rounded-full dark:hidden block" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)' }} />
                    </div>

                    {/* Group 1: Appearance & Interface */}
                    <SettingsSection title="Appearance & Interface">

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
                                      ? "bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:bg-accent dark:border dark:border-primary dark:shadow-[0_0_15px_var(--color-primary)] dark:ring-0"
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
                                    ? "bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:bg-accent dark:border dark:border-primary dark:shadow-[0_0_15px_var(--color-primary)] dark:ring-0"
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
                {activeSettingsSection === "themes" ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <h2
                            className={cn("text-[28px] leading-relaxed pb-1 text-foreground mb-2 font-bold", activeFontCombo.sansClass)}
                            style={{ fontFamily: "var(--font-sans)", textTransform: "capitalize" }}
                          >
                            Themes
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Choose from curated palettes or build a fully personalized custom color and typography theme.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setFontPreferences(DEFAULT_FONT_PREFERENCES);
                              toastManager.add({
                                type: "info",
                                title: "Fonts Reset",
                                description: "Typography preferences restored to defaults.",
                              });
                            }}
                            className="gap-2 rounded-xl text-xs px-3.5 py-2 font-medium shadow-xs text-muted-foreground hover:text-foreground"
                          >
                            <RotateCcwIcon className="size-3.5" />
                            Reset to Defaults
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsStudioOpen(true)}
                            className="gap-2 rounded-xl text-xs px-3.5 py-2 font-medium shadow-xs"
                          >
                            <PaletteIcon className="size-4 text-foreground" />
                            Open Custom Studio
                          </Button>
                        </div>
                      </div>
                      <div className="h-[5px] w-full my-5 rounded-full dark:block hidden" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.25), transparent)' }} />
                      <div className="h-[5px] w-full my-5 rounded-full dark:hidden block" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)' }} />
                    </div>

                    <SettingsSection title="App Themes & Styling">
                      <ThemePickerGrid
                        activeTheme={theme}
                        customConfig={customThemeConfig}
                        savedPresets={savedPresets}
                        onSelectTheme={(t, overrideConfig) => {
                          if (overrideConfig) {
                            setCustomThemeConfig(overrideConfig);
                            setTheme("custom");
                          } else {
                            setTheme(t);
                          }
                        }}
                        onOpenStudio={() => {
                          setEditingStudioPresetName("");
                          setIsStudioOpen(true);
                        }}
                        onDeletePreset={handleDeletePreset}
                        onRenamePreset={handleRenamePreset}
                        onEditPresetInStudio={(preset) => {
                          setCustomThemeConfig(preset.config);
                          setEditingStudioPresetName(preset.name);
                          setTheme("custom");
                          setIsStudioOpen(true);
                        }}
                      />
                    </SettingsSection>

                    <SettingsSection
                      title="Typography & Fonts"
                      headerAction={
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setFontPreferences(DEFAULT_FONT_PREFERENCES);
                            toastManager.add({
                              type: "info",
                              title: "Fonts Reset",
                              description: "Typography preferences restored to defaults.",
                            });
                          }}
                          className="gap-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer h-6 px-2.5"
                        >
                          <RotateCcwIcon className="size-3" />
                          Reset to Defaults
                        </Button>
                      }
                    >
                      {/* Neutral Defaults + Custom Pick pill row */}
                      {(() => {
                        const isCustomSelection = !FONT_COMBOS.some(
                          (combo) =>
                            combo.id !== "custom" &&
                            fontPreferences.uiFont === combo.uiFont &&
                            fontPreferences.headingFont === combo.headingFont,
                        );
                        const showCustomMixer = isCustomFontMode || isCustomSelection;

                        return (
                          <>
                            <div className="px-4 pt-4 pb-2 flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mr-1">Defaults</span>
                              {FONT_COMBOS.filter((c) => c.isNeutral).map((combo) => {
                                const isCustomCombo = combo.id === "custom";
                                const isActive = isCustomCombo
                                  ? showCustomMixer
                                  : !showCustomMixer &&
                                    fontPreferences.uiFont === combo.uiFont &&
                                    fontPreferences.headingFont === combo.headingFont;

                                return (
                                  <button
                                    key={combo.id}
                                    type="button"
                                    onClick={() => {
                                      if (isCustomCombo) {
                                        setIsCustomFontMode(true);
                                      } else {
                                        setIsCustomFontMode(false);
                                        setFontPreferences((prev) => ({
                                          ...prev,
                                          uiFont: combo.uiFont,
                                          headingFont: combo.headingFont,
                                        }));
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-200 cursor-pointer",
                                      isActive
                                        ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
                                        : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                                    )}
                                    style={{ fontFamily: combo.uiFont !== "custom" ? combo.uiFont : undefined }}
                                  >
                                    {isActive && (
                                      <svg className="size-2.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M2 6l3 3 5-5" />
                                      </svg>
                                    )}
                                    {combo.name}
                                    <span className={cn(
                                      "text-[8px] font-bold tracking-widest px-1 py-0.5 rounded border",
                                      isActive ? "border-primary/30 text-primary/70 bg-primary/5" : "border-border/50 text-muted-foreground/50",
                                    )}>
                                      {combo.tag}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Divider */}
                            <div className="mx-4 border-t border-border/40 mb-0" />

                            {/* 10 Personality Cards — split-word specimen */}
                            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                              {FONT_COMBOS.filter((c) => !c.isNeutral).map((combo) => {
                                const isActive =
                                  !showCustomMixer &&
                                  fontPreferences.uiFont === combo.uiFont &&
                                  fontPreferences.headingFont === combo.headingFont;

                                return (
                                  <button
                                    key={combo.id}
                                    type="button"
                                    onClick={() => {
                                      setIsCustomFontMode(false);
                                      setFontPreferences((prev) => ({
                                        ...prev,
                                        uiFont: combo.uiFont,
                                        headingFont: combo.headingFont,
                                      }));
                                    }}
                                    className={cn(
                                      "group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer overflow-hidden",
                                      isActive
                                        ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_4px_20px_hsl(var(--primary)/0.15)]"
                                        : "border-border/70 bg-card hover:border-border hover:shadow-md hover:scale-[1.02]",
                                    )}
                                  >
                                    {/* Selected checkmark dot */}
                                    {isActive && (
                                      <div className="absolute top-2.5 right-2.5 size-4 rounded-full bg-primary flex items-center justify-center shadow-[0_0_8px_hsl(var(--primary)/0.6)]">
                                        <svg className="size-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M2 6l3 3 5-5" />
                                        </svg>
                                      </div>
                                    )}

                                    {/* ── Split-word specimen ── */}
                                    <div className="mb-3 leading-none">
                                      {/* sansText — heavy UI font, lowercase, tight */}
                                      <span
                                        className={cn("text-[28px] leading-none", combo.sansClass)}
                                        style={{
                                          fontFamily: combo.uiFont,
                                          color: "inherit",
                                        }}
                                      >
                                        {combo.sansText}
                                      </span>
                                      {/* serifText — pairing/accent font, italic */}
                                      <span
                                        className={cn("text-[28px] leading-none", combo.serifClass)}
                                        style={{
                                          fontFamily: combo.headingFont,
                                          color: "inherit",
                                        }}
                                      >
                                        {combo.serifText}
                                      </span>
                                      {/* sansText2 — back to heavy UI font */}
                                      {combo.sansText2 && (
                                        <span
                                          className={cn("text-[28px] leading-none", combo.sansClass)}
                                          style={{
                                            fontFamily: combo.uiFont,
                                            color: "inherit",
                                          }}
                                        >
                                          {combo.sansText2}
                                        </span>
                                      )}
                                    </div>

                                    {/* Bottom: name + tag */}
                                    <div className="mt-auto w-full">
                                      <div
                                        className={cn(
                                          "text-[11px] font-semibold leading-tight truncate",
                                          isActive ? "text-primary" : "text-foreground",
                                        )}
                                        style={{ fontFamily: combo.uiFont }}
                                      >
                                        {combo.name}
                                      </div>
                                      <div className="flex items-center justify-between mt-1 gap-1">
                                        <span className="text-[9.5px] text-muted-foreground/60 leading-none truncate">
                                          {combo.desc}
                                        </span>
                                        <span
                                          className={cn(
                                            "text-[7.5px] font-bold tracking-widest px-1.5 py-0.5 rounded border shrink-0",
                                            isActive
                                              ? "border-primary/40 text-primary bg-primary/10"
                                              : "border-border/50 text-muted-foreground/50",
                                          )}
                                        >
                                          {combo.tag}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Custom Mix Dropdowns Panel when Custom Pick is selected */}
                            {showCustomMixer && (
                              <div className="mx-4 my-2 p-4 rounded-xl border border-primary/40 bg-primary/5 space-y-3 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                    Custom Typography Mixer
                                  </h4>
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    Mix &amp; match any UI, heading, or editor font
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                  {/* Interface Font */}
                                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-card/60 p-3">
                                    <label className="text-xs font-semibold text-foreground block">
                                      Interface Font
                                    </label>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                                      UI labels, buttons, navigation
                                    </p>
                                    <Select
                                      value={fontPreferences.uiFont}
                                      onValueChange={(val) =>
                                        val && setFontPreferences((prev) => ({ ...prev, uiFont: val }))
                                      }
                                    >
                                      <SelectTrigger className="w-full text-xs rounded-lg bg-background border-border/80">
                                        <SelectValue placeholder="Select Interface Font" />
                                      </SelectTrigger>
                                      <SelectPopup align="start">
                                        {UI_FONT_OPTIONS.map((f) => (
                                          <SelectItem key={f.value} value={f.value} className="text-xs">
                                            {f.label}
                                          </SelectItem>
                                        ))}
                                      </SelectPopup>
                                    </Select>
                                  </div>

                                  {/* Heading Font */}
                                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-card/60 p-3">
                                    <label className="text-xs font-semibold text-foreground block">
                                      Heading Font
                                    </label>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                                      Headings, section titles, headers
                                    </p>
                                    <Select
                                      value={fontPreferences.headingFont}
                                      onValueChange={(val) =>
                                        val && setFontPreferences((prev) => ({ ...prev, headingFont: val }))
                                      }
                                    >
                                      <SelectTrigger className="w-full text-xs rounded-lg bg-background border-border/80">
                                        <SelectValue placeholder="Select Heading Font" />
                                      </SelectTrigger>
                                      <SelectPopup align="start">
                                        {HEADING_FONT_OPTIONS.map((f) => (
                                          <SelectItem key={f.value} value={f.value} className="text-xs">
                                            {f.label}
                                          </SelectItem>
                                        ))}
                                      </SelectPopup>
                                    </Select>
                                  </div>

                                  {/* Editor Font */}
                                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-card/60 p-3">
                                    <label className="text-xs font-semibold text-foreground block">
                                      Editor Font
                                    </label>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                                      Monospace code, terminals, inputs
                                    </p>
                                    <Select
                                      value={fontPreferences.editorFont}
                                      onValueChange={(val) =>
                                        val && setFontPreferences((prev) => ({ ...prev, editorFont: val }))
                                      }
                                    >
                                      <SelectTrigger className="w-full text-xs rounded-lg bg-background border-border/80">
                                        <SelectValue placeholder="Select Editor Font" />
                                      </SelectTrigger>
                                      <SelectPopup align="start">
                                        {EDITOR_FONT_OPTIONS.map((f) => (
                                          <SelectItem key={f.value} value={f.value} className="text-xs">
                                            {f.label}
                                          </SelectItem>
                                        ))}
                                      </SelectPopup>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Editor (mono) Font — power-user row when not in custom mixer */}
                            {!showCustomMixer && (
                              <div className="border-t border-border/60 px-4 py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-medium text-foreground">Editor Font</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">Monospace font for code, terminals, and diff views.</p>
                                  </div>
                                  <div className="shrink-0 w-full sm:w-52">
                                    <Select
                                      value={fontPreferences.editorFont}
                                      onValueChange={(val) =>
                                        val && setFontPreferences((prev) => ({ ...prev, editorFont: val }))
                                      }
                                    >
                                      <SelectTrigger className="w-full text-xs rounded-xl bg-background border-border/80">
                                        <SelectValue placeholder="Select Editor Font" />
                                      </SelectTrigger>
                                      <SelectPopup align="end">
                                        {EDITOR_FONT_OPTIONS.map((f) => (
                                          <SelectItem key={f.value} value={f.value} className="text-xs">
                                            {f.label}
                                          </SelectItem>
                                        ))}
                                      </SelectPopup>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </SettingsSection>

                    <SettingsSection title="Toolbar Style">
                      <div className="flex flex-col gap-8 p-4 sm:p-5">
                        {/* Top Stage: Live Interactive Preview */}
                        <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border shadow-sm">
                          <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background opacity-80" />
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />
                          <div className="relative flex flex-col items-center justify-center p-8 pt-14 pb-10 min-h-[260px] gap-6">
                            <h3 className="absolute top-5 left-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
                              Preview Stage
                            </h3>
                            <div className="flex-1 flex items-center justify-center">
                              <ToolbarPreview styleId={settings.toolbarStyle} />
                            </div>
                            
                            {(() => {
                              const activeStyle = TOOLBAR_STYLES.find((s) => s.id === settings.toolbarStyle) ?? TOOLBAR_STYLES[0];
                              return (
                                <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <h4 className="font-medium text-[15px] tracking-tight text-foreground">
                                      {activeStyle?.label}
                                    </h4>
                                    <span className="bg-muted text-foreground border border-border px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider">
                                      Active
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
                                    {activeStyle?.description}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Grid Selector for Styles */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                          {TOOLBAR_STYLES.map((style) => {
                            const isSelected = settings.toolbarStyle === style.id;
                            return (
                              <button
                                key={style.id}
                                type="button"
                                onClick={() => updateSettings({ toolbarStyle: style.id })}
                                className={cn(
                                  "group relative flex flex-col items-start p-4 rounded-xl border transition-all duration-300 text-left overflow-hidden",
                                  isSelected
                                    ? "bg-card border-foreground/30 shadow-xs"
                                    : "bg-transparent border-border/40 hover:bg-card/50 hover:border-border/80"
                                )}
                              >
                                <div className="relative flex items-center justify-between w-full mb-1.5">
                                  <span className="font-semibold text-sm transition-colors text-foreground">
                                    {style.label}
                                  </span>
                                  {isSelected && (
                                    <div className="size-2 rounded-full bg-foreground/90 shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                                  )}
                                </div>
                                <p className="relative text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
                                  {style.description}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </SettingsSection>

                    {/* Redesigned Custom Theme Studio Modal */}
                    <CustomThemeStudioModal
                      isOpen={isStudioOpen}
                      onClose={() => setIsStudioOpen(false)}
                      config={customThemeConfig}
                      initialPresetName={editingStudioPresetName}
                      onChange={(next) => {
                        setCustomThemeConfig(next);
                        if (theme !== "custom") {
                          setTheme("custom");
                        }
                      }}
                      onSavePreset={handleSavePreset}
                    />
                  </div>
                ) : null}
                {activeSettingsSection === "startup-animation" ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <h2
                            className={cn("text-[28px] leading-relaxed pb-1 text-foreground mb-2 font-bold", activeFontCombo.sansClass)}
                            style={{ fontFamily: "var(--font-sans)", textTransform: "capitalize" }}
                          >
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
                      <div className="h-[5px] w-full my-5 rounded-full dark:block hidden" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.25), transparent)' }} />
                      <div className="h-[5px] w-full my-5 rounded-full dark:hidden block" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)' }} />
                    </div>

                    <SettingsSection title="Animation Controls">
                    <div className="flex flex-col gap-10">
                      {/* ANIMATION CONTROLS (Toggled) */}
                      <div className="flex flex-col gap-5">
                        <div className="px-4 sm:px-5 pt-4 sm:pt-5 flex items-center justify-between">
                          {activeFontCombo.isNeutral ? (
                            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                              {animationTab === "startup" ? "Startup Animation" : "Close Animation"}
                            </h2>
                          ) : (
                            <h2
                              className={cn("text-[18px] leading-relaxed pb-1 text-foreground/80 mb-3", activeFontCombo.serifClass)}
                              style={{ fontFamily: "var(--font-display)" }}
                            >
                              {animationTab === "startup" ? "Startup Animation" : "Close Animation"}
                            </h2>
                          )}
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
                                    key={startupReplayKey}
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
                                    setStartupReplayKey((k) => k + 1);
                                    setFullscreenStartupPreview(true);
                                  } else {
                                    setCloseReplayKey((k) => k + 1);
                                    setFullscreenClosePreview(true);
                                  }
                                }}
                              >
                                <MonitorPlayIcon className="mr-1.5 size-3" /> Preview Fullscreen
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

                        {/* ── Animation Font Combos ── */}
                        <div className="pt-2">
                          <div className="px-4 py-2 border-t border-border/40">
                            <h4 className="text-sm font-semibold text-foreground">Animation Typography & Font</h4>
                            <p className="text-xs text-muted-foreground">
                              Select a dedicated font combo for startup and close loader animations.
                            </p>
                          </div>

                          {/* Default Pills */}
                          <div className="px-4 py-2 flex items-center gap-2 flex-wrap bg-muted/20">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mr-1">Defaults</span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFontComboId("app-default");
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-200 cursor-pointer",
                                activeFontComboId === "app-default"
                                  ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
                                  : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                              )}
                            >
                              {activeFontComboId === "app-default" && (
                                <svg className="size-2.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 6l3 3 5-5" />
                                </svg>
                              )}
                              App Theme Font
                              <span className="text-[8px] font-bold tracking-widest px-1 py-0.5 rounded border border-primary/30 text-primary/70 bg-primary/5">
                                DEFAULT
                              </span>
                            </button>

                            {FONT_COMBOS.filter((c) => c.isNeutral).map((combo) => {
                              const isActive = activeFontComboId === combo.id;
                              return (
                                <button
                                  key={combo.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveFontComboId(combo.id);
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-200 cursor-pointer",
                                    isActive
                                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
                                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                                  )}
                                  style={{ fontFamily: combo.uiFont !== "custom" ? combo.uiFont : undefined }}
                                >
                                  {isActive && (
                                    <svg className="size-2.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M2 6l3 3 5-5" />
                                    </svg>
                                  )}
                                  {combo.name}
                                  <span className={cn(
                                    "text-[8px] font-bold tracking-widest px-1 py-0.5 rounded border",
                                    isActive ? "border-primary/30 text-primary/70 bg-primary/5" : "border-border/50 text-muted-foreground/50",
                                  )}>
                                    {combo.tag}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Custom Pick Config UI Panel */}
                          {activeFontComboId === "custom" && (
                            <div className="px-4 py-3.5 bg-muted/30 border-y border-border/60 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="text-xs font-semibold text-foreground">Custom Animation Display Font</h5>
                                  <p className="text-[10px] text-muted-foreground">Select a custom typography font for startup and close loader animations.</p>
                                </div>
                                <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 uppercase">
                                  CUSTOM
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5 rounded-lg border border-border/60 bg-card p-3">
                                  <label className="text-xs font-semibold text-foreground block">
                                    Animation Display Font
                                  </label>
                                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                                    Main title, Solari cards & status messages
                                  </p>
                                  <Select
                                    value={activeCustomFont}
                                    onValueChange={(val) => {
                                      if (!val) return;
                                      setActiveCustomFont(val);
                                    }}
                                  >
                                    <SelectTrigger className="w-full text-xs rounded-lg bg-background border-border/80">
                                      <SelectValue placeholder="Select Display Font" />
                                    </SelectTrigger>
                                    <SelectPopup align="start">
                                      {UI_FONT_OPTIONS.map((f) => (
                                        <SelectItem key={f.value} value={f.value} className="text-xs">
                                          {f.label}
                                        </SelectItem>
                                      ))}
                                    </SelectPopup>
                                  </Select>
                                </div>

                                <div className="space-y-1.5 rounded-lg border border-border/60 bg-card p-3">
                                  <label className="text-xs font-semibold text-foreground block">
                                    Quick Display Picks
                                  </label>
                                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                                    One-click font presets for splash loader
                                  </p>
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {[
                                      { name: "Syne", font: "'Syne', sans-serif" },
                                      { name: "Unbounded", font: "'Unbounded', sans-serif" },
                                      { name: "Outfit", font: "'Outfit', sans-serif" },
                                      { name: "Space Grotesk", font: "'Space Grotesk', sans-serif" },
                                      { name: "JetBrains Mono", font: "'JetBrains Mono', monospace" },
                                    ].map((preset) => (
                                      <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => {
                                          setActiveCustomFont(preset.font);
                                        }}
                                        className={cn(
                                          "px-2 py-1 text-[10px] font-semibold rounded border transition-all cursor-pointer",
                                          activeCustomFont === preset.font
                                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                            : "border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border",
                                        )}
                                        style={{ fontFamily: preset.font }}
                                      >
                                        {preset.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 10 Personality Specimen Cards */}
                          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 border-t border-border/40">
                            {FONT_COMBOS.filter((c) => !c.isNeutral).map((combo) => {
                              const isActive = activeFontComboId === combo.id;
                              return (
                                <button
                                  key={combo.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveFontComboId(combo.id);
                                  }}
                                  className={cn(
                                    "group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer overflow-hidden",
                                    isActive
                                      ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_4px_20px_hsl(var(--primary)/0.15)]"
                                      : "border-border/70 bg-card hover:border-border hover:shadow-md hover:scale-[1.02]",
                                  )}
                                >
                                  {isActive && (
                                    <div className="absolute top-2.5 right-2.5 size-4 rounded-full bg-primary flex items-center justify-center shadow-[0_0_8px_hsl(var(--primary)/0.6)]">
                                      <svg className="size-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M2 6l3 3 5-5" />
                                      </svg>
                                    </div>
                                  )}

                                  <div className="mb-3 leading-none">
                                    <span
                                      className={cn("text-[26px] leading-none", combo.sansClass)}
                                      style={{
                                        fontFamily: combo.uiFont !== "custom" ? combo.uiFont : undefined,
                                      }}
                                    >
                                      {combo.sansText}
                                    </span>
                                    <span
                                      className={cn("text-[26px] leading-none", combo.serifClass)}
                                      style={{
                                        fontFamily: combo.headingFont !== "custom" ? combo.headingFont : undefined,
                                      }}
                                    >
                                      {combo.serifText}
                                    </span>
                                    {"sansText2" in combo && combo.sansText2 ? (
                                      <span
                                        className={cn("text-[26px] leading-none block", combo.sansClass)}
                                        style={{
                                          fontFamily: combo.uiFont !== "custom" ? combo.uiFont : undefined,
                                        }}
                                      >
                                        {combo.sansText2}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="mt-auto w-full pt-1 border-t border-border/30 flex items-center justify-between">
                                    <div>
                                      <div className={cn("text-xs font-bold leading-tight", isActive ? "text-primary" : "text-foreground")}>
                                        {combo.name}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground/70 leading-tight">
                                        {combo.desc}
                                      </div>
                                    </div>
                                    <span className={cn(
                                      "text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ml-1",
                                      isActive ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-muted/40 text-muted-foreground",
                                    )}>
                                      {combo.tag}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {(previewStyle !== settings.splashLoaderStyle ||
                        previewPalette !== settings.splashLoaderPalette ||
                        previewTheme !== settings.splashLoaderTheme ||
                        closePreviewStyle !== settings.closeLoaderStyle ||
                        closePreviewPalette !== settings.closeLoaderPalette ||
                        closePreviewTheme !== settings.closeLoaderTheme ||
                        previewStartupAnimationFontComboId !== savedStartupAnimationFontComboId ||
                        (previewStartupAnimationFontComboId === "custom" &&
                          previewStartupCustomAnimationFont !== savedStartupCustomAnimationFont) ||
                        previewCloseAnimationFontComboId !== savedCloseAnimationFontComboId ||
                        (previewCloseAnimationFontComboId === "custom" &&
                          previewCloseCustomAnimationFont !== savedCloseCustomAnimationFont)) && (
                        <div className="flex justify-end p-4 sm:p-5 border-t border-border">
                          <Button
                            onClick={() => {
                              updateSettings({
                                splashLoaderStyle: previewStyle,
                                splashLoaderPalette: previewPalette,
                                splashLoaderTheme: previewTheme,
                                closeLoaderStyle: closePreviewStyle,
                                closeLoaderPalette: closePreviewPalette,
                                closeLoaderTheme: closePreviewTheme,
                              });
                              try {
                                window.localStorage?.setItem("tabs.startupAnimationFontComboId", previewStartupAnimationFontComboId);
                                window.localStorage?.setItem("tabs.startupCustomAnimationFont", previewStartupCustomAnimationFont);
                                window.localStorage?.setItem("tabs.closeAnimationFontComboId", previewCloseAnimationFontComboId);
                                window.localStorage?.setItem("tabs.closeCustomAnimationFont", previewCloseCustomAnimationFont);
                                window.localStorage?.setItem("tabs.animationFontComboId", previewStartupAnimationFontComboId);
                                window.localStorage?.setItem("tabs.customAnimationFont", previewStartupCustomAnimationFont);
                              } catch {}
                              setSavedStartupAnimationFontComboId(previewStartupAnimationFontComboId);
                              setSavedStartupCustomAnimationFont(previewStartupCustomAnimationFont);
                              setSavedCloseAnimationFontComboId(previewCloseAnimationFontComboId);
                              setSavedCloseCustomAnimationFont(previewCloseCustomAnimationFont);
                              toastManager.add({
                                type: "success",
                                title: "Settings Saved",
                                description: "Animation settings and font preferences updated.",
                              });
                            }}
                            className="gap-2"
                          >
                            <SaveIcon className="size-4" />
                            Save Settings
                          </Button>
                        </div>
                      )}

                      {/* INTERFACE GROUP */}
                      <div className="flex flex-col gap-5 pt-4 sm:pt-5 border-t border-border">
                        {activeFontCombo.isNeutral ? (
                          <h2 className="px-4 sm:px-5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            Interface
                          </h2>
                        ) : (
                          <h2
                            className={cn("px-4 sm:px-5 text-[18px] leading-relaxed pb-1 text-foreground/80 mb-3", activeFontCombo.serifClass)}
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            Interface
                          </h2>
                        )}
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

                        <SettingsRow
                          title="Always show Git loading animation"
                          description="Play Mercury Chrome loading animation every time Git tab is selected. When disabled, animation plays once on initial load and subsequent tab switches load instantly."
                          control={
                            <Switch
                              checked={alwaysAnimateGitLoader}
                              onCheckedChange={(checked) => {
                                const val = Boolean(checked);
                                setAlwaysAnimateGitLoader(val);
                                try {
                                  window.localStorage?.setItem("tabs.alwaysAnimateGitLoader", String(val));
                                } catch {}
                              }}
                              aria-label="Always show Git loading animation"
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
                      <div className="flex items-start justify-between">
                        <div className="space-y-1.5">
                          <h2
                            className={cn("text-[28px] leading-relaxed pb-1 text-foreground mb-2 font-bold", activeFontCombo.sansClass)}
                            style={{ fontFamily: "var(--font-sans)", textTransform: "capitalize" }}
                          >
                            Providers
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Manage AI providers, API keys, custom model endpoints, and status checks.
                          </p>
                        </div>
                        <SettingsHeaderPortal>
                          <Button
                            size="xs"
                            variant="outline"
                            className="no-drag gap-1.5 cursor-pointer"
                            disabled={isRefreshingProviders}
                            onClick={() => refreshProviders()}
                          >
                            {isRefreshingProviders ? (
                              <LoaderIcon className="size-3.5 animate-spin text-primary" />
                            ) : (
                              <RefreshCwIcon className="size-3.5" />
                            )}
                            {isRefreshingProviders ? "Refreshing..." : "Refresh models"}
                          </Button>
                        </SettingsHeaderPortal>
                      </div>
                      <div className="h-[5px] w-full my-5 rounded-full dark:block hidden" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.25), transparent)' }} />
                      <div className="h-[5px] w-full my-5 rounded-full dark:hidden block" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)' }} />
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
                                </div>

                                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                                  {providerCard.updatePrompt && providerCard.installCommand ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1.5 px-2.5 text-xs cursor-pointer"
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
                                  ) : null}

                                  {providerCard.needsAuth && providerCard.loginCommand ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1.5 px-2.5 text-xs cursor-pointer"
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
                                  ) : null}

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
                    keybindingsConfigPath={keybindingsConfigPath as string}
                    availableEditors={(availableEditors as any) ?? []}
                  />
                ) : null}
                {activeSettingsSection === "about" ? (
                  <div className="space-y-6">
                    <div>
                      <div className="space-y-1.5">
                        <h2
                          className={cn("text-[28px] leading-relaxed pb-1 text-foreground mb-2 font-bold", activeFontCombo.sansClass)}
                          style={{ fontFamily: "var(--font-sans)", textTransform: "capitalize" }}
                        >
                          About
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Application build details, software updates, and diagnostic information.
                        </p>
                      </div>
                      <div className="h-[5px] w-full my-5 rounded-full dark:block hidden" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.25), transparent)' }} />
                      <div className="h-[5px] w-full my-5 rounded-full dark:hidden block" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.12), transparent)' }} />
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
