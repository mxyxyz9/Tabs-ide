import {
  type ModelSlug,
  type ProviderOptionChoice,
  type ProviderOptionDescriptor,
  type ProviderOptionSelection,
  type ServerProvider,
  type ServerProviderModel,
} from "@tabs/contracts";
import {
  applyClaudePromptEffortPrefix,
  buildProviderOptionSelectionsFromDescriptors,
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
} from "@tabs/shared/model";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, StarIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";
import { ClaudeAI, CursorIcon, GrokIcon, type Icon, OpenAI, OpenCodeIcon } from "../Icons";
import { cn } from "~/lib/utils";
import { getProviderModels, getProviderSnapshot } from "../../providerModels";
import { PROVIDER_OPTIONS, type ProviderPickerKind } from "../../session-logic";
import { useSettings, useUpdateSettings } from "../../hooks/useSettings";

// ─────────────────────────────────────────────────────────────────────────
// FusedModelPicker — AI Cockpit Matrix design (Aligned Columns & Compact Rows)
// Integrates left-sidebar provider selector, core tracks representing
// reasoning effort levels aligned to global header columns, inline sub-control
// pills (context size, open-code variant, and booleans), and a vertical lever
// on the right side for fastMode (Ultra).
// ─────────────────────────────────────────────────────────────────────────

const PROVIDER_ICON_BY_PROVIDER: Record<ProviderPickerKind, Icon> = {
  codex: OpenAI,
  claudeAgent: ClaudeAI,
  cursor: CursorIcon,
  grok: GrokIcon,
  opencode: OpenCodeIcon,
};

const AVAILABLE_PROVIDER_OPTIONS = PROVIDER_OPTIONS.filter(
  (option): option is typeof option & { available: true } => option.available,
);

const THEME_COLORS = [
  { hex: "#fbbf24", rgb: "251, 191, 38" },
  { hex: "#34d399", rgb: "52, 211, 153" },
  { hex: "#e879f9", rgb: "232, 121, 249" },
  { hex: "#60a5fa", rgb: "96, 165, 250" },
  { hex: "#f97316", rgb: "249, 115, 22" },
];

const EMPTY_CAPABILITIES = {
  reasoningEffortLevels: [],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  promptInjectedEffortLevels: [],
};

const TRACK_PX = 128; // h-32
const THUMB_PX = 32; // size-8
const PAD_PX = 4;
const RANGE_PX = TRACK_PX - THUMB_PX - PAD_PX * 2;

const getStandardOrderForProvider = (provider: string): string[] => {
  if (provider === "claudeAgent") {
    return ["low", "medium", "high", "xhigh", "max", "ultracode", "ultrathink"];
  }
  if (provider === "codex" || provider === "cursor") {
    return ["low", "medium", "high", "xhigh", "max", "ultra"];
  }
  return ["none", "low", "medium", "high", "xhigh", "max"];
};

const FALLBACK_LABELS: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
  max: "Max",
  ultra: "Ultra",
  ultracode: "Ultra Code",
  ultrathink: "Ultra Think",
};

const getModelScore = (name: string): number => {
  const lower = name.toLowerCase();
  let familyScore = 0;

  if (lower.includes("fable")) familyScore = 10000;
  else if (lower.includes("opus")) familyScore = 8000;
  else if (lower.includes("sonnet")) familyScore = 6000;
  else if (lower.includes("haiku")) familyScore = 4000;
  else if (lower.includes("sol")) familyScore = 10000;
  else if (lower.includes("terra")) familyScore = 8000;
  else if (lower.includes("luna")) familyScore = 6000;

  const match = name.match(/\d+(\.\d+)?/);
  const version = match ? parseFloat(match[0]) : 0;
  const miniPenalty = lower.includes("mini") ? -100 : 0;

  return familyScore + version * 10 + miniPenalty;
};

interface FusedModelPickerProps {
  provider: ProviderPickerKind;
  model: ModelSlug;
  lockedProvider: ProviderPickerKind | null;
  providers: ReadonlyArray<ServerProvider>;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  modelOptions?: ReadonlyArray<ProviderOptionSelection> | null | undefined;
  onProviderModelChange: (
    provider: ProviderPickerKind,
    model: ModelSlug,
    options?: ReadonlyArray<ProviderOptionSelection>,
  ) => void;
  onModelOptionsChange: (options: ReadonlyArray<ProviderOptionSelection> | undefined) => void;
  /** Optional ref to anchor the popup to a specific element (e.g. the composer card) instead of the trigger */
  popupAnchorRef?: React.RefObject<HTMLElement | null>;
  triggerClassName?: string;
}

export const FusedModelPicker = memo(function FusedModelPicker(props: FusedModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ProviderPickerKind | "favorites" | null>(null);

  const activeTab = selectedTab ?? (props.lockedProvider ?? props.provider);
  const activeProvider = props.lockedProvider ?? props.provider;
  const providerOptions = props.lockedProvider
    ? AVAILABLE_PROVIDER_OPTIONS.filter((o) => o.value === props.lockedProvider)
    : AVAILABLE_PROVIDER_OPTIONS;

  const settings = useSettings();
  const { updateSettings } = useUpdateSettings();
  const favorites = useMemo(() => settings.favorites ?? [], [settings.favorites]);

  const [leftCollisionPadding, setLeftCollisionPadding] = useState(16);

  useEffect(() => {
    // When anchored to the composer card, we don't need aggressive left padding —
    // the card is already positioned correctly relative to the sidebar.
    if (props.popupAnchorRef) return;
    if (!isOpen) return;

    const measureLeftBoundary = () => {
      const rail = document.querySelector<HTMLElement>(
        '[data-slot="sidebar-wrapper"], [data-sidebar="sidebar"], aside, .sidebar-rail, .code-activity-rail',
      );
      if (rail) {
        const rect = rail.getBoundingClientRect();
        if (rect.right > 0 && rect.width > 0) {
          setLeftCollisionPadding(Math.max(16, rect.right + 12));
          return;
        }
      }
      setLeftCollisionPadding(16);
    };

    measureLeftBoundary();
    window.addEventListener("resize", measureLeftBoundary);
    return () => window.removeEventListener("resize", measureLeftBoundary);
  }, [isOpen, props.popupAnchorRef]);

  const collisionPadding = useMemo(
    () =>
      props.popupAnchorRef
        ? { top: 12, right: 12, bottom: 12, left: 12 }
        : { top: 12, right: 12, bottom: 12, left: leftCollisionPadding },
    [leftCollisionPadding, props.popupAnchorRef],
  );

  const isModelFavorite = useCallback(
    (providerId: string, modelSlug: string) => {
      return favorites.some(
        (f) => (f.provider === providerId || f.provider === "") && f.model === modelSlug,
      );
    },
    [favorites],
  );

  const handleToggleFavorite = useCallback(
    (providerId: string, modelSlug: string) => {
      const exists = favorites.some(
        (f) => (f.provider === providerId || f.provider === "") && f.model === modelSlug,
      );
      const nextFavorites = exists
        ? favorites.filter(
            (f) => !((f.provider === providerId || f.provider === "") && f.model === modelSlug),
          )
        : [...favorites, { provider: providerId as any, model: modelSlug }];
      updateSettings({ favorites: nextFavorites });
    },
    [favorites, updateSettings],
  );

  // Aggregated models with provider attribution across all providers
  const allProviderModels = useMemo(() => {
    const result: Array<ServerProviderModel & { providerId: string; providerName: string }> = [];
    for (const providerOption of providerOptions) {
      const providerSnapshot = getProviderSnapshot(props.providers, providerOption.value);
      const providerModels = getProviderModels(props.providers, providerOption.value);
      const name = providerSnapshot?.displayName ?? providerOption.label;
      for (const m of providerModels) {
        result.push({
          ...m,
          providerId: providerOption.value,
          providerName: name,
        });
      }
    }
    return result;
  }, [providerOptions, props.providers]);

  const favoriteModels = useMemo(() => {
    return allProviderModels.filter((m) =>
      favorites.some(
        (f) =>
          (f.provider === m.providerId || f.provider === "") &&
          f.model === m.slug,
      ),
    );
  }, [allProviderModels, favorites]);

  const models = useMemo(() => {
    if (activeTab === "favorites") {
      return favoriteModels;
    }
    return getProviderModels(props.providers, activeTab);
  }, [activeTab, favoriteModels, props.providers]);

  const activeModel = useMemo(() => {
    if (activeTab === "favorites") {
      return (
        favoriteModels.find(
          (m) => m.providerId === props.provider && m.slug === props.model,
        ) ??
        favoriteModels[0] ??
        getProviderModels(props.providers, props.provider).find((m) => m.slug === props.model)
      );
    }
    const provModels = getProviderModels(props.providers, activeTab);
    return provModels.find((m) => m.slug === props.model) ?? provModels[0];
  }, [activeTab, favoriteModels, props.providers, props.provider, props.model]);

  const setModelAndOptions = useCallback(
    (
      provider: ProviderPickerKind,
      slug: string,
      nextOptions?: ReadonlyArray<ProviderOptionSelection>,
    ) => {
      props.onProviderModelChange(provider, slug, nextOptions);
    },
    [props],
  );

  const descriptors = useMemo(
    () =>
      activeModel
        ? getProviderOptionDescriptors({
            caps: activeModel.capabilities ?? EMPTY_CAPABILITIES,
            selections: props.modelOptions,
          }).filter((d) => d.id !== "agent")
        : [],
    [activeModel, props.modelOptions],
  );

  const selectDescriptors = descriptors.filter(
    (d): d is Extract<ProviderOptionDescriptor, { type: "select" }> => d.type === "select",
  );
  const booleanDescriptors = descriptors.filter(
    (d): d is Extract<ProviderOptionDescriptor, { type: "boolean" }> => d.type === "boolean",
  );

  const leverDescriptor = booleanDescriptors.find((d) => d.id === "fastMode") ?? null;
  const isUltra = leverDescriptor?.currentValue === true;

  const commitDescriptors = useCallback(
    (next: ReadonlyArray<ProviderOptionDescriptor>) => {
      const selections = buildProviderOptionSelectionsFromDescriptors(next);
      props.onModelOptionsChange(selections);
    },
    [props],
  );

  const handleSelectChange = useCallback(
    (descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>, optionId: string) => {
      if (descriptor.id === "effort" || descriptor.id === "reasoningEffort") {
        props.onPromptChange(applyClaudePromptEffortPrefix(props.prompt, optionId));
      }
      commitDescriptors(
        descriptors.map((d) =>
          d.id === descriptor.id && d.type === "select" ? { ...d, currentValue: optionId } : d,
        ),
      );
    },
    [commitDescriptors, descriptors, props],
  );

  const handleBooleanChange = useCallback(
    (descriptor: Extract<ProviderOptionDescriptor, { type: "boolean" }>, value: boolean) => {
      commitDescriptors(
        descriptors.map((d) =>
          d.id === descriptor.id && d.type === "boolean" ? { ...d, currentValue: value } : d,
        ),
      );
    },
    [commitDescriptors, descriptors],
  );

  // Identify the primary select descriptor (reasoning effort)
  const activePrimarySelect = useMemo(
    () =>
      selectDescriptors.find((d) => d.id === "reasoningEffort" || d.id === "effort") ??
      selectDescriptors[0] ??
      null,
    [selectDescriptors],
  );

  // Build union of reasoning stops across all models of the provider to form the global columns
  const globalStops = useMemo(() => {
    const standardOrder = getStandardOrderForProvider(activeTab);
    const allOptionsMap = new Map<string, ProviderOptionChoice>();

    for (const m of models) {
      const caps = m.capabilities ?? EMPTY_CAPABILITIES;
      const desc = getProviderOptionDescriptors({ caps, selections: undefined }).filter(
        (d) => d.id !== "agent",
      );
      const primary = desc.find((d) => d.id === "reasoningEffort" || d.id === "effort") ?? desc[0];
      if (primary && primary.type === "select") {
        for (const opt of primary.options) {
          if (!allOptionsMap.has(opt.id)) {
            allOptionsMap.set(opt.id, opt);
          }
        }
      }
    }

    if (activeTab === "favorites") {
      const finalStops: ProviderOptionChoice[] = [];
      for (const id of standardOrder) {
        const opt = allOptionsMap.get(id);
        if (opt) {
          finalStops.push(opt);
        }
      }

      for (const [id, opt] of allOptionsMap.entries()) {
        if (!standardOrder.includes(id) && !finalStops.some((s) => s.id === id)) {
          finalStops.push(opt);
        }
      }

      return finalStops;
    }

    let maxStandardIndex = -1;
    for (const id of allOptionsMap.keys()) {
      const idx = standardOrder.indexOf(id);
      if (idx > maxStandardIndex) {
        maxStandardIndex = idx;
      }
    }

    const finalStops: ProviderOptionChoice[] = [];
    if (maxStandardIndex >= 0) {
      for (let i = 0; i <= maxStandardIndex; i++) {
        const id = standardOrder[i]!;
        const opt = allOptionsMap.get(id);
        if (opt) {
          finalStops.push(opt);
        } else {
          finalStops.push({ id, label: FALLBACK_LABELS[id] ?? id });
        }
      }
    }

    for (const [id, opt] of allOptionsMap.entries()) {
      if (!standardOrder.includes(id) && !finalStops.some((s) => s.id === id)) {
        finalStops.push(opt);
      }
    }

    return finalStops;
  }, [models, activeTab]);

  const matrixMinWidthClass =
    globalStops.length >= 8
      ? "min-w-[38rem]"
      : globalStops.length >= 7
        ? "min-w-[36rem]"
        : globalStops.length >= 6
          ? "min-w-[34rem]"
          : "min-w-[32rem]";

  // Group models hierarchically by subProvider or provider name
  const groupedModels = useMemo(() => {
    const groups: Array<{ name: string | null; items: Array<ServerProviderModel & { providerId?: string }> }> = [];

    if (activeTab === "favorites") {
      for (const model of favoriteModels) {
        const groupName = model.providerName ?? model.subProvider ?? "Favorites";
        let group = groups.find((g) => g.name === groupName);
        if (!group) {
          group = { name: groupName, items: [] };
          groups.push(group);
        }
        group.items.push(model);
      }
      return groups;
    }

    const standardOrder = getStandardOrderForProvider(activeTab);

    const sortedList = [...models].sort((a, b) => {
      const isAutoA = a.slug === "auto" || a.name.toLowerCase() === "auto";
      const isAutoB = b.slug === "auto" || b.name.toLowerCase() === "auto";
      if (isAutoA && !isAutoB) return -1;
      if (!isAutoA && isAutoB) return 1;

      const descA = getProviderOptionDescriptors({
        caps: a.capabilities ?? EMPTY_CAPABILITIES,
        selections: undefined,
      }).filter((d) => d.id !== "agent");
      const primaryA =
        descA.find((d) => d.id === "reasoningEffort" || d.id === "effort") ?? descA[0];
      const hasReasoningA = primaryA && primaryA.type === "select" && primaryA.options.length > 0;

      const descB = getProviderOptionDescriptors({
        caps: b.capabilities ?? EMPTY_CAPABILITIES,
        selections: undefined,
      }).filter((d) => d.id !== "agent");
      const primaryB =
        descB.find((d) => d.id === "reasoningEffort" || d.id === "effort") ?? descB[0];
      const hasReasoningB = primaryB && primaryB.type === "select" && primaryB.options.length > 0;

      if (hasReasoningA && !hasReasoningB) return -1;
      if (!hasReasoningA && hasReasoningB) return 1;

      if (hasReasoningA && hasReasoningB) {
        let maxIdxA = -1;
        for (const opt of (primaryA as Extract<ProviderOptionDescriptor, { type: "select" }>)
          .options) {
          const idx = standardOrder.indexOf(opt.id);
          if (idx > maxIdxA) maxIdxA = idx;
        }

        let maxIdxB = -1;
        for (const opt of (primaryB as Extract<ProviderOptionDescriptor, { type: "select" }>)
          .options) {
          const idx = standardOrder.indexOf(opt.id);
          if (idx > maxIdxB) maxIdxB = idx;
        }

        if (maxIdxA !== maxIdxB) {
          return maxIdxB - maxIdxA;
        }
      }

      // Tie-break by hierarchy/version descending
      return getModelScore(b.name) - getModelScore(a.name);
    });

    for (const model of sortedList) {
      const groupName = model.subProvider ?? null;
      let group = groups.find((g) => g.name === groupName);
      if (!group) {
        group = { name: groupName, items: [] };
        groups.push(group);
      }
      group.items.push(model);
    }
    return groups;
  }, [activeTab, favoriteModels, models]);

  const triggerLabel = useMemo(() => {
    if (!activeModel) return "Select model";
    const parts = [activeModel.name];
    if (leverDescriptor?.currentValue === true) {
      parts.push("Fast");
    } else if (activePrimarySelect) {
      const value = getProviderOptionCurrentValue(activePrimarySelect);
      const label = activePrimarySelect.options.find((o) => o.id === value)?.label;
      if (label) parts.push(label);
    }
    return parts.join(" · ");
  }, [activeModel, leverDescriptor, activePrimarySelect]);

  const activeColorIndex = useMemo(
    () =>
      Math.max(
        0,
        models.findIndex((m) => m.slug === activeModel?.slug),
      ),
    [models, activeModel],
  );
  const activeColor = THEME_COLORS[activeColorIndex % THEME_COLORS.length] ?? THEME_COLORS[0]!;

  const panelStyle = isUltra
    ? ({
        "--dynamic-ultra-hex": activeColor.hex,
        "--dynamic-ultra-rgb": activeColor.rgb,
        borderColor: `rgba(${activeColor.rgb}, 0.35)`,
        boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 30px rgba(${activeColor.rgb}, 0.15), inset 0 0 20px rgba(${activeColor.rgb}, 0.08)`,
      } as React.CSSProperties)
    : undefined;

  const ActiveIcon = PROVIDER_ICON_BY_PROVIDER[activeProvider];

  const isExpandedPicker = Boolean(leverDescriptor) || globalStops.length >= 8;

  return (
    <Menu
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setSelectedTab(null);
        }
      }}
    >
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "min-w-0 max-w-72 justify-start gap-2 overflow-hidden whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80",
              props.triggerClassName,
            )}
          />
        }
      >
        <ActiveIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
      </MenuTrigger>
      <MenuPopup
        side="top"
        sideOffset={8}
        align={isExpandedPicker ? "center" : "start"}
        alignOffset={isExpandedPicker ? 0 : 8}
        anchor={props.popupAnchorRef}
        collisionPadding={collisionPadding}
        className="w-auto p-0 border-0 bg-transparent shadow-none before:hidden before:shadow-none dark:before:hidden [&>div]:p-0"
      >
        <style>{COSMIC_KEYFRAMES}</style>
        <div
          className="relative flex gap-6 rounded-[24px] overflow-hidden isolate border border-border bg-popover text-popover-foreground p-6 shadow-2xl transition-all duration-300 select-none animate-in fade-in zoom-in-95 duration-150 dark:bg-[#18181b] dark:border-white/8 dark:text-white"
          style={panelStyle}
        >
          {/* Provider Sidebar navigation on Left */}
          {providerOptions.length > 1 && (
            <div className="flex flex-col gap-2.5 border-r border-border pr-6 dark:border-white/8">
              {/* ⭐ Favorites Tab */}
              <button
                key="favorites"
                type="button"
                title="Favorites"
                onClick={() => setSelectedTab("favorites")}
                className={cn(
                  "flex size-11 items-center justify-center rounded-xl bg-muted/40 border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all relative dark:bg-white/3 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-white",
                  activeTab === "favorites" &&
                    "bg-accent border-border text-foreground shadow-xs dark:bg-white/10 dark:border-white/20 dark:text-white dark:shadow-md",
                )}
              >
                <StarIcon
                  aria-hidden="true"
                  className={cn(
                    "size-5 transition-colors",
                    activeTab === "favorites"
                      ? "text-foreground dark:text-white"
                      : "text-muted-foreground dark:text-zinc-400",
                  )}
                />
                {favoriteModels.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-muted border border-border text-[9px] font-bold text-muted-foreground dark:bg-white/10 dark:border-white/20 dark:text-zinc-300">
                    {favoriteModels.length}
                  </span>
                )}
              </button>

              <div className="h-px w-full bg-border my-0.5 dark:bg-white/8" />

              {providerOptions.map((option) => {
                const OptionIcon = PROVIDER_ICON_BY_PROVIDER[option.value];
                const snapshot = getProviderSnapshot(props.providers, option.value);
                const disabled = snapshot ? snapshot.status !== "ready" : false;
                const isActive = option.value === activeTab;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedTab(option.value);
                      const nextModels = getProviderModels(props.providers, option.value);
                      const fallback = nextModels.find((m) => !m.isCustom) ?? nextModels[0];
                      if (fallback) setModelAndOptions(option.value, fallback.slug);
                    }}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl bg-muted/40 border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all dark:bg-white/3 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-white",
                      isActive &&
                        "bg-accent border-border text-foreground shadow-xs dark:bg-white/10 dark:border-white/20 dark:text-white dark:shadow-md",
                      disabled && "cursor-not-allowed opacity-30",
                    )}
                  >
                    <OptionIcon aria-hidden="true" className="size-5" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Matrix Core containing model rows with horizontal aligned tracks */}
          <div className={cn("flex flex-col justify-center overflow-x-hidden", matrixMinWidthClass)}>
            <div className="flex flex-col max-h-[380px] overflow-y-auto pr-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/15 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/30 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
              {/* Header labels aligned absolutely to the global columns */}
              {globalStops.length > 0 && (
                <div className="sticky top-0 z-30 h-14 mb-2 select-none w-full bg-popover border-b border-border/60 pt-2 pb-3 dark:bg-[#18181b] dark:border-white/5">
                  {globalStops.map((stop, idx) => {
                    const cleanedLabel = stop.label
                      .replace(/([a-z])([A-Z])/g, "$1 $2")
                      .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
                      .replace("Ultracode", "Ultra Code")
                      .replace("Ultrathink", "Ultra Think");
                    return (
                      <div
                        key={stop.id}
                        className="absolute top-2 -translate-x-1/2 w-12 text-center text-[8px] font-bold uppercase tracking-wider text-muted-foreground/80 dark:text-zinc-400/80 transition-colors break-words leading-[1.1]"
                        style={{
                          left: `calc(176px + 20px + (100% - 176px - 40px) * ${idx / (globalStops.length - 1)})`,
                        }}
                      >
                        {cleanedLabel}
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "favorites" && favoriteModels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none">
                  <StarIcon className="size-8 text-muted-foreground/40 mb-2.5" />
                  <div className="text-xs font-semibold text-foreground">No Favorites Yet</div>
                  <div className="text-[11px] text-muted-foreground max-w-52 mt-1 leading-normal">
                    Click the star icon next to any model to add it to your favorites list.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {groupedModels.map((group) => (
                    <div key={group.name ?? "default"} className="flex flex-col gap-1.5">
                      {group.name && (
                        <div className="px-4 pt-2 pb-1 text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/70 dark:text-zinc-500 border-t border-border/40 dark:border-white/5 mt-2 first:mt-0 first:border-t-0">
                          {group.name}
                        </div>
                      )}
                      {group.items.map((model) => {
                        const modelProvider = (model as { providerId?: string }).providerId ?? activeProvider;
                        const isFav = isModelFavorite(modelProvider, model.slug);
                        const isCurrentActive =
                          modelProvider === props.provider && model.slug === activeModel?.slug;
                        return (
                          <ModelRow
                            key={`${modelProvider}-${model.slug}`}
                            model={model}
                            isActive={isCurrentActive}
                            ultra={isCurrentActive && isUltra}
                            activeTab={activeTab}
                            isFavorite={isFav}
                            onToggleFavorite={() => handleToggleFavorite(modelProvider, model.slug)}
                            themeColor={
                              THEME_COLORS[
                                models.findIndex((m) => m.slug === model.slug) % THEME_COLORS.length
                              ] ?? THEME_COLORS[0]!
                            }
                            selections={isCurrentActive ? props.modelOptions : undefined}
                            globalStops={globalStops}
                            prompt={props.prompt}
                            onPromptChange={props.onPromptChange}
                            onSelect={(nextOptions) =>
                              setModelAndOptions(modelProvider as ProviderPickerKind, model.slug, nextOptions)
                            }
                            onSelectChange={handleSelectChange}
                            onBooleanChange={handleBooleanChange}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ultra lever module on the Right */}
          {leverDescriptor && (
            <Lever
              label={leverDescriptor.label}
              engaged={isUltra}
              themeColor={activeColor}
              onChange={(value) => handleBooleanChange(leverDescriptor, value)}
            />
          )}
        </div>
      </MenuPopup>
    </Menu>
  );
});

function getCleanModelName(
  name: string,
  activeTab: ProviderPickerKind | "favorites" | null,
): string {
  if (activeTab === "favorites" || activeTab === null) {
    return name;
  }
  const prefixes: Record<string, ReadonlyArray<string>> = {
    claudeAgent: ["Claude "],
    opencode: ["OpenCode ", "opencode/"],
    codex: ["Codex "],
    cursor: ["Cursor "],
    grok: ["Grok "],
  };
  const list = prefixes[activeTab];
  if (!list) return name;
  for (const prefix of list) {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

// ── ModelRow Component: aligned stops layout with compact dynamic heights
const ModelRow = memo(function ModelRow(props: {
  model: ServerProviderModel;
  isActive: boolean;
  ultra: boolean;
  activeTab?: ProviderPickerKind | "favorites" | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  themeColor: (typeof THEME_COLORS)[number];
  selections: ReadonlyArray<ProviderOptionSelection> | null | undefined;
  globalStops: ReadonlyArray<{ id: string; label: string }>;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSelect: (nextOptions?: ReadonlyArray<ProviderOptionSelection>) => void;
  onSelectChange: (
    descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>,
    optionId: string,
  ) => void;
  onBooleanChange: (
    descriptor: Extract<ProviderOptionDescriptor, { type: "boolean" }>,
    value: boolean,
  ) => void;
}) {
  const { sliderAnimationsEnabled, animatedTrackFillEnabled } = useSettings();
  const descriptors = getProviderOptionDescriptors({
    caps: props.model.capabilities ?? EMPTY_CAPABILITIES,
    selections: props.isActive ? props.selections : undefined,
  }).filter((d) => d.id !== "agent");

  const selects = descriptors.filter(
    (d): d is Extract<ProviderOptionDescriptor, { type: "select" }> => d.type === "select",
  );
  const booleans = descriptors
    .filter(
      (d): d is Extract<ProviderOptionDescriptor, { type: "boolean" }> => d.type === "boolean",
    )
    .filter((d) => d.id !== "fastMode");

  const primarySelect =
    selects.find((d) => d.id === "reasoningEffort" || d.id === "effort") ?? selects[0];
  const secondarySelects = primarySelect
    ? selects.filter((d) => d.id !== primarySelect.id)
    : selects;

  const allowedOptionIds = useMemo(
    () =>
      primarySelect && primarySelect.type === "select"
        ? primarySelect.options.map((o) => o.id)
        : [],
    [primarySelect],
  );

  const nearestAvailable = useCallback(
    (desiredIndex: number) => {
      let bestIndex = 0;
      let minDiff = Infinity;
      for (let i = 0; i < props.globalStops.length; i++) {
        const stop = props.globalStops[i];
        if (stop && allowedOptionIds.includes(stop.id)) {
          const diff = Math.abs(i - desiredIndex);
          if (diff < minDiff) {
            minDiff = diff;
            bestIndex = i;
          }
        }
      }
      return props.globalStops[bestIndex]?.id;
    },
    [allowedOptionIds, props.globalStops],
  );

  // Local drag index mapping to prevent lag/choppiness
  const [localStopIndex, setLocalStopIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // High-performance reactive drag/click loop to prevent stale React closures
  const latestRef = useRef({
    isActive: props.isActive,
    onSelect: props.onSelect,
    onSelectChange: props.onSelectChange,
    descriptors,
    primarySelect,
  });
  latestRef.current = {
    isActive: props.isActive,
    onSelect: props.onSelect,
    onSelectChange: props.onSelectChange,
    descriptors,
    primarySelect,
  };

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = e.currentTarget as HTMLDivElement;
    dragIndexRef.current = null;

    const update = (clientX: number) => {
      const { primarySelect: curPrimary } = latestRef.current;

      if (!curPrimary || curPrimary.type !== "select") return;

      const rect = container.getBoundingClientRect();
      const padding = 20;
      const trackWidth = rect.width - padding * 2;
      const x = Math.max(0, Math.min(clientX - rect.left - padding, trackWidth));
      const percentage = trackWidth > 0 ? x / trackWidth : 0;

      const rawLevel = Math.round(percentage * (props.globalStops.length - 1));
      const resolvedOptionId = nearestAvailable(rawLevel);

      if (resolvedOptionId) {
        const finalIdx = props.globalStops.findIndex((o) => o.id === resolvedOptionId);
        const nextIdx = finalIdx >= 0 ? finalIdx : null;
        dragIndexRef.current = nextIdx;
        setLocalStopIndex(nextIdx);
      }
    };

    update(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      update(moveEvent.clientX);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      const {
        isActive: curActive,
        onSelect: curSelect,
        onSelectChange: curSelectChange,
        descriptors: curDescriptors,
        primarySelect: curPrimary,
      } = latestRef.current;

      const finalStopIdx = dragIndexRef.current;
      dragIndexRef.current = null;
      setLocalStopIndex(null);

      if (!curPrimary || curPrimary.type !== "select") {
        curSelect(undefined);
        return;
      }

      // Read final stop computed during the mouseup step
      const finalIndex = finalStopIdx !== null ? finalStopIdx : currentStopIndex;
      const resolvedOptionId = props.globalStops[finalIndex]?.id;

      if (resolvedOptionId) {
        if (curPrimary.id === "effort" || curPrimary.id === "reasoningEffort") {
          props.onPromptChange(applyClaudePromptEffortPrefix(props.prompt, resolvedOptionId));
        }

        if (!curActive) {
          const nextDescriptors = curDescriptors.map((d) =>
            d.id === curPrimary.id && d.type === "select"
              ? { ...d, currentValue: resolvedOptionId }
              : d,
          );
          const selections = buildProviderOptionSelectionsFromDescriptors(nextDescriptors);
          curSelect(selections);
        } else {
          curSelectChange(curPrimary, resolvedOptionId);
        }
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const currentPrimaryVal = primarySelect ? getProviderOptionCurrentValue(primarySelect) : null;
  const currentStopIndex = props.globalStops.findIndex((o) => o.id === currentPrimaryVal);

  // Use local drag index if actively dragging, fallback to database state index
  const resolvedIndex = localStopIndex !== null ? localStopIndex : currentStopIndex;

  const percentage =
    props.globalStops.length > 1 && resolvedIndex >= 0
      ? (resolvedIndex / (props.globalStops.length - 1)) * 100
      : 0;

  const fillStyle: React.CSSProperties = props.ultra
    ? {
        width: `calc(20px + (100% - 40px) * ${percentage / 100})`,
        backgroundImage:
          "linear-gradient(90deg, var(--dynamic-ultra-hex)55, var(--dynamic-ultra-hex), #fff)",
        backgroundSize: "200% 100%",
        animation: "fmp-cosmic-gradient 3s linear infinite",
      }
    : animatedTrackFillEnabled
      ? {
          width: `calc(20px + (100% - 40px) * ${percentage / 100})`,
          backgroundColor: props.themeColor.hex,
          backgroundImage: `linear-gradient(90deg, transparent 0%, transparent 40%, rgba(255,255,255,0.03) 44%, rgba(255,255,255,0.08) 47%, rgba(255,255,255,0.16) 49%, rgba(255,255,255,0.28) 51%, rgba(255,255,255,0.16) 52%, rgba(255,255,255,0.06) 54%, transparent 58%, transparent 100%)`,
          backgroundSize: "300% 100%",
          animation: "fmp-cosmic-gradient 3s linear infinite",
        }
      : {
          width: `calc(20px + (100% - 40px) * ${percentage / 100})`,
          backgroundColor: props.themeColor.hex,
        };

  return (
    <div
      onClick={() => {
        if (props.isActive) {
          return;
        }
        props.onSelect(undefined);
      }}
      className={cn(
        "relative flex items-center rounded-full transition-all duration-200 select-none",
        props.isActive
          ? "bg-accent/80 border border-border/40 dark:bg-white/5 dark:border-transparent h-13"
          : "hover:bg-accent/40 dark:hover:bg-white/[0.03] cursor-pointer h-9",
      )}
    >
      {props.ultra && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay rounded-full overflow-hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, #fff 1px, transparent 1.5px), radial-gradient(circle at center, rgba(255,255,255,0.8) 1.5px, transparent 2px)",
            backgroundSize: "40px 40px, 30px 30px",
            backgroundPosition: "0 0, 15px 15px",
            animation: "fmp-cosmic-flow 15s linear infinite",
          }}
        />
      )}

      {/* Model Name + inline Segmented Sub-controls */}
      <div className="w-44 pl-3 flex flex-col justify-center leading-none">
        <div className="flex items-center gap-1 min-w-0">
          {props.onToggleFavorite && (
            <button
              type="button"
              title={props.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleFavorite?.();
              }}
              className="shrink-0 p-0.5 rounded-full hover:bg-muted transition-colors focus:outline-none dark:hover:bg-white/10"
            >
              <StarIcon
                className={cn(
                  "size-3.5 transition-all",
                  props.isFavorite
                    ? "fill-current text-foreground dark:text-white opacity-100 scale-100"
                    : "text-muted-foreground opacity-40 hover:opacity-100 hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300 scale-90",
                )}
              />
            </button>
          )}
          <span
            className="text-[13px] font-semibold transition-colors truncate"
            style={{
              color: props.isActive ? props.themeColor.hex : undefined,
              textShadow: props.ultra ? `0 0 8px ${props.themeColor.hex}99` : undefined,
            }}
          >
            {getCleanModelName(props.model.name, props.activeTab)}
          </span>
        </div>

        {props.isActive && (secondarySelects.length > 0 || booleans.length > 0) && (
          <div className="flex gap-2 mt-1 select-none">
            {secondarySelects.map((descriptor) => {
              const currentVal = getProviderOptionCurrentValue(descriptor);
              const nextIndex =
                (descriptor.options.findIndex((o) => o.id === currentVal) + 1) %
                descriptor.options.length;
              const nextOption = descriptor.options[nextIndex] ?? descriptor.options[0];
              const displayVal = descriptor.options.find((o) => o.id === currentVal)?.label ?? "";
              return (
                <button
                  key={descriptor.id}
                  type="button"
                  title={`${descriptor.label}: ${displayVal}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (nextOption) props.onSelectChange(descriptor, nextOption.id);
                  }}
                  className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-background/80 border border-border text-foreground hover:bg-accent transition-all dark:bg-black/45 dark:border-white/5 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-white/8"
                >
                  {displayVal}
                </button>
              );
            })}

            {booleans.map((descriptor) => {
              const isTrue = descriptor.currentValue === true;
              return (
                <button
                  key={descriptor.id}
                  type="button"
                  title={`${descriptor.label}: ${isTrue ? "On" : "Off"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onBooleanChange(descriptor, !isTrue);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-semibold transition-all",
                    isTrue
                      ? "bg-foreground/10 border-foreground/20 text-foreground dark:bg-white/10 dark:border-white/10 dark:text-white"
                      : "bg-background/80 border-border text-muted-foreground hover:text-foreground dark:bg-black/40 dark:border-white/5 dark:text-zinc-400 dark:hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isTrue ? "bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-muted-foreground/40 dark:bg-zinc-600",
                    )}
                  />
                  {descriptor.id === "thinking" ? "THINK" : descriptor.label.toUpperCase()}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Horizontal aligned track container */}
      {primarySelect ? (
        <div
          onMouseDown={handleTrackMouseDown}
          className="flex-1 relative h-full flex items-center px-5 cursor-grab active:cursor-grabbing"
        >
          {props.isActive && (
            <div className="absolute top-1/2 -translate-y-1/2 h-5 left-2.5 right-2.5 bg-foreground/5 dark:bg-white/5 rounded-full overflow-hidden pointer-events-none">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full overflow-hidden",
                  !props.ultra &&
                    sliderAnimationsEnabled &&
                    localStopIndex === null &&
                    "transition-all duration-200",
                )}
                style={fillStyle}
              >
                {!props.ultra && animatedTrackFillEnabled && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at center, #fff 1px, transparent 1.5px), radial-gradient(circle at center, rgba(255,255,255,0.8) 1.5px, transparent 2px)",
                      backgroundSize: "40px 40px, 30px 30px",
                      backgroundPosition: "0 0, 15px 15px",
                      animation: "fmp-cosmic-flow 15s linear infinite",
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Aligned stops: solid dots if supported, empty circles if not */}
          <div className="absolute top-1/2 -translate-y-1/2 left-5 right-5 flex justify-between pointer-events-none z-10">
            {props.globalStops.map((stop, oIdx) => {
              const isSupported = allowedOptionIds.includes(stop.id);
              const isDotActive = props.isActive && oIdx <= resolvedIndex;
              return (
                <div
                  key={stop.id}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    isSupported
                      ? "bg-foreground/30 dark:bg-zinc-600"
                      : "border border-border bg-transparent dark:border-white/15",
                    isDotActive && isSupported && "bg-foreground/60 dark:bg-white/30",
                  )}
                />
              );
            })}
          </div>

          {/* Draggable thumb */}
          {props.isActive && (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 size-7 bg-popover text-popover-foreground border border-border/60 rounded-full shadow-md z-20 pointer-events-none dark:bg-white dark:border-0 dark:shadow-lg",
                sliderAnimationsEnabled &&
                  localStopIndex === null &&
                  "transition-[left] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              )}
              style={{
                left: `calc(20px + (100% - 40px) * ${percentage / 100} - 14px)`,
                boxShadow: props.ultra ? `0 0 14px ${props.themeColor.hex}` : undefined,
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 text-[11px] text-muted-foreground/70 font-semibold pl-8 pointer-events-none select-none italic tracking-wider dark:text-zinc-500/70">
          Reasoning effort not supported by this model
        </div>
      )}
    </div>
  );
});

// ── Lever Component: Vertical switch that behaves exactly like the Ultra lever in the Cockpit design
const Lever = memo(function Lever(props: {
  label: string;
  engaged: boolean;
  themeColor: (typeof THEME_COLORS)[number];
  onChange: (value: boolean) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const lastEngaged = useRef(props.engaged);

  // Local engaged state to prevent drag lag
  const [localEngaged, setLocalEngaged] = useState<boolean | null>(null);

  const updateLever = useCallback((clientY: number) => {
    const el = trackRef.current;
    if (el == null) return;
    const rect = el.getBoundingClientRect();
    const padding = 4;
    const range = rect.height - 32 - padding * 2;
    const y = Math.max(0, Math.min(clientY - rect.top - 16, range));
    const pct = range > 0 ? y / range : 0;
    setDragProgress(pct);

    if (pct > 0.65) {
      setLocalEngaged(true);
      lastEngaged.current = true;
    } else if (pct < 0.35) {
      setLocalEngaged(false);
      lastEngaged.current = false;
    }
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    lastEngaged.current = props.engaged;
    setLocalEngaged(props.engaged);
    updateLever(e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateLever(moveEvent.clientY);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setDragProgress(null);

      const finalEngaged = lastEngaged.current;
      setLocalEngaged(null);
      props.onChange(finalEngaged);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const isDragging = dragProgress !== null;
  const progress = dragProgress ?? (props.engaged ? 1 : 0);
  const thumbTopPx = PAD_PX + progress * RANGE_PX;
  const isEngaged = localEngaged !== null ? localEngaged : props.engaged;

  return (
    <div className="flex w-20 flex-col items-center border-l border-border pl-6 dark:border-white/8">
      <div
        className="mb-4 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors leading-[1.2] dark:text-zinc-400"
        style={{
          color: isEngaged ? props.themeColor.hex : undefined,
          textShadow: isEngaged ? `0 0 10px ${props.themeColor.hex}aa` : undefined,
        }}
        dangerouslySetInnerHTML={{ __html: props.label.replace(" ", "<br>") }}
      />
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        className={cn(
          "relative h-32 w-9 cursor-pointer overflow-hidden rounded-full bg-muted/80 border border-border shadow-inner transition-all duration-300 dark:bg-black/40 dark:border-white/5",
          isEngaged && "shadow-[0_0_20px_-4px_var(--dynamic-ultra-hex)]",
        )}
      >
        {isEngaged && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundColor: props.themeColor.hex,
              maskImage: "repeating-linear-gradient(180deg, transparent 0 6px, #000 6px 12px)",
              WebkitMaskImage:
                "repeating-linear-gradient(180deg, transparent 0 6px, #000 6px 12px)",
              animation: "fmp-cosmic-flow 3s linear infinite",
            }}
          />
        )}
        {/* Chevron pulse indicators inside track */}
        <div
          className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none opacity-40 dark:opacity-30"
          style={{
            animation: isEngaged ? "fmp-pulse-chevron 1.5s infinite" : undefined,
          }}
        >
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              className="size-3 text-foreground dark:text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          ))}
        </div>

        <div
          className={cn(
            "absolute left-1/2 size-8 -translate-x-1/2 rounded-full shadow-lg",
            !isDragging && "transition-all duration-300",
          )}
          style={{
            top: `${thumbTopPx}px`,
            background: isEngaged
              ? `radial-gradient(circle at 35% 35%, #fff, ${props.themeColor.hex})`
              : "radial-gradient(circle at 35% 35%, #ff5b5b, #b90000)",
            boxShadow: isEngaged ? `0 0 20px ${props.themeColor.hex}` : undefined,
          }}
        />
      </div>
    </div>
  );
});

const COSMIC_KEYFRAMES = `
@keyframes fmp-cosmic-gradient {
  0% { background-position: 200% 0%; }
  100% { background-position: -100% 0%; }
}
@keyframes fmp-cosmic-flow {
  0% { background-position: 0 0; }
  100% { background-position: 0 400px; }
}
@keyframes fmp-pulse-chevron {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; filter: drop-shadow(0 0 5px var(--dynamic-ultra-hex)); }
}
`;
