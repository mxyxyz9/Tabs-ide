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
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";
import { ClaudeAI, CursorIcon, GrokIcon, type Icon, OpenAI, OpenCodeIcon } from "../Icons";
import { cn } from "~/lib/utils";
import { getProviderModels, getProviderSnapshot } from "../../providerModels";
import { PROVIDER_OPTIONS, type ProviderPickerKind } from "../../session-logic";
import { useSettings } from "../../hooks/useSettings";

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
  triggerClassName?: string;
}

export const FusedModelPicker = memo(function FusedModelPicker(props: FusedModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeProvider = props.lockedProvider ?? props.provider;
  const providerOptions = props.lockedProvider
    ? AVAILABLE_PROVIDER_OPTIONS.filter((o) => o.value === props.lockedProvider)
    : AVAILABLE_PROVIDER_OPTIONS;

  const models = getProviderModels(props.providers, activeProvider);
  const activeModel = models.find((m) => m.slug === props.model) ?? models[0];

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
    const standardOrder = getStandardOrderForProvider(activeProvider);
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
      if (!standardOrder.includes(id)) {
        finalStops.push(opt);
      }
    }

    return finalStops;
  }, [models, activeProvider]);

  // Group models hierarchically by subProvider, sorting them based on reasoning availability
  const groupedModels = useMemo(() => {
    const groups: Array<{ name: string | null; items: Array<ServerProviderModel> }> = [];
    const standardOrder = getStandardOrderForProvider(activeProvider);
    
    const sortedList = [...models].sort((a, b) => {
      const descA = getProviderOptionDescriptors({
        caps: a.capabilities ?? EMPTY_CAPABILITIES,
        selections: undefined,
      }).filter((d) => d.id !== "agent");
      const primaryA = descA.find((d) => d.id === "reasoningEffort" || d.id === "effort") ?? descA[0];
      const hasReasoningA = primaryA && primaryA.type === "select" && primaryA.options.length > 0;

      const descB = getProviderOptionDescriptors({
        caps: b.capabilities ?? EMPTY_CAPABILITIES,
        selections: undefined,
      }).filter((d) => d.id !== "agent");
      const primaryB = descB.find((d) => d.id === "reasoningEffort" || d.id === "effort") ?? descB[0];
      const hasReasoningB = primaryB && primaryB.type === "select" && primaryB.options.length > 0;

      if (hasReasoningA && !hasReasoningB) return -1;
      if (!hasReasoningA && hasReasoningB) return 1;

      if (hasReasoningA && hasReasoningB) {
        let maxIdxA = -1;
        for (const opt of (primaryA as Extract<ProviderOptionDescriptor, { type: "select" }>).options) {
          const idx = standardOrder.indexOf(opt.id);
          if (idx > maxIdxA) maxIdxA = idx;
        }

        let maxIdxB = -1;
        for (const opt of (primaryB as Extract<ProviderOptionDescriptor, { type: "select" }>).options) {
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
  }, [models, activeProvider]);

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

  return (
    <Menu open={isOpen} onOpenChange={setIsOpen}>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "min-w-0 max-w-56 justify-start gap-2 overflow-hidden whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80",
              props.triggerClassName,
            )}
          />
        }
      >
        <ActiveIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
      </MenuTrigger>
      <MenuPopup align="start" className="w-auto p-0 border-0 bg-transparent shadow-none">
        <style>{COSMIC_KEYFRAMES}</style>
        <div
          className="flex gap-6 rounded-[24px] border border-white/8 bg-[#18181b]/85 p-6 backdrop-blur-[24px] transition-all duration-300 select-none text-white animate-in fade-in zoom-in-95 duration-150"
          style={panelStyle}
        >
          {/* Provider Sidebar navigation on Left */}
          {providerOptions.length > 1 && (
            <div className="flex flex-col gap-3 border-r border-white/8 pr-6">
              {providerOptions.map((option) => {
                const OptionIcon = PROVIDER_ICON_BY_PROVIDER[option.value];
                const snapshot = getProviderSnapshot(props.providers, option.value);
                const disabled = snapshot ? snapshot.status !== "ready" : false;
                const isActive = option.value === activeProvider;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    disabled={disabled}
                    onClick={() => {
                      const nextModels = getProviderModels(props.providers, option.value);
                      const fallback = nextModels.find((m) => !m.isCustom) ?? nextModels[0];
                      if (fallback) setModelAndOptions(option.value, fallback.slug);
                    }}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl bg-white/3 border border-transparent text-zinc-400 hover:bg-white/8 hover:text-white transition-all",
                      isActive && "bg-white/10 border-white/20 text-white shadow-md",
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
          <div className="flex min-w-[32rem] flex-col justify-center">
            {/* Header labels aligned absolutely to the global columns */}
            {globalStops.length > 0 && (
              <div className="relative h-6 mb-1.5 select-none w-full">
                {globalStops.map((stop, idx) => {
                  const cleanedLabel = stop.label
                    .replace(/([a-z])([A-Z])/g, "$1 $2")
                    .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
                    .replace("Ultracode", "Ultra Code")
                    .replace("Ultrathink", "Ultra Think");
                  return (
                    <div
                      key={stop.id}
                      className="absolute -translate-x-1/2 w-12 text-center text-[8px] font-bold uppercase tracking-wider text-zinc-400/80 transition-colors break-words leading-[1.15]"
                      style={{
                        left: `calc(128px + 20px + (100% - 128px - 40px) * ${idx / (globalStops.length - 1)})`,
                      }}
                    >
                      {cleanedLabel}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {groupedModels.map((group) => (
                <div key={group.name ?? "default"} className="flex flex-col gap-1.5">
                  {group.name && (
                    <div className="px-4 pt-2 pb-1 text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 border-t border-white/5 mt-2 first:mt-0 first:border-t-0">
                      {group.name}
                    </div>
                  )}
                  {group.items.map((model) => (
                    <ModelRow
                      key={model.slug}
                      model={model}
                      isActive={model.slug === activeModel?.slug}
                      ultra={model.slug === activeModel?.slug && isUltra}
                      themeColor={
                        THEME_COLORS[
                          models.findIndex((m) => m.slug === model.slug) % THEME_COLORS.length
                        ] ?? THEME_COLORS[0]!
                      }
                      selections={model.slug === activeModel?.slug ? props.modelOptions : undefined}
                      globalStops={globalStops}
                      prompt={props.prompt}
                      onPromptChange={props.onPromptChange}
                      onSelect={(nextOptions) =>
                        setModelAndOptions(activeProvider, model.slug, nextOptions)
                      }
                      onSelectChange={handleSelectChange}
                      onBooleanChange={handleBooleanChange}
                    />
                  ))}
                </div>
              ))}
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

// ── ModelRow Component: aligned stops layout with compact dynamic heights
const ModelRow = memo(function ModelRow(props: {
  model: ServerProviderModel;
  isActive: boolean;
  ultra: boolean;
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
        props.isActive ? "bg-white/5 h-13" : "hover:bg-white/[0.03] cursor-pointer h-9",
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
      <div className="w-32 pl-4 flex flex-col justify-center leading-none">
        <span
          className="text-[13px] font-semibold transition-colors"
          style={{
            color: props.isActive ? props.themeColor.hex : "#a1a1aa",
            textShadow: props.ultra ? `0 0 8px ${props.themeColor.hex}99` : undefined,
          }}
        >
          {props.model.name}
        </span>

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
                  className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-black/45 border border-white/5 text-zinc-300 hover:text-white hover:bg-white/8 transition-all"
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
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-black/40 border-white/5 text-zinc-400 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isTrue ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-zinc-600",
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
            <div className="absolute top-1/2 -translate-y-1/2 h-5 left-2.5 right-2.5 bg-white/5 rounded-full overflow-hidden pointer-events-none">
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
                    isSupported ? "bg-zinc-600" : "border border-white/15 bg-transparent",
                    isDotActive && isSupported && "bg-white/30",
                  )}
                />
              );
            })}
          </div>

          {/* Draggable thumb */}
          {props.isActive && (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 size-7 bg-white rounded-full shadow-lg z-20 pointer-events-none",
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
        <div className="flex-1 text-[11px] text-zinc-500/70 font-semibold pl-8 pointer-events-none select-none italic tracking-wider">
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
    <div className="flex w-20 flex-col items-center border-l border-white/8 pl-6">
      <div
        className="mb-4 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 transition-colors leading-[1.2]"
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
          "relative h-32 w-9 cursor-pointer overflow-hidden rounded-full bg-black/40 shadow-inner border border-white/5 transition-all duration-300",
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
          className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none opacity-30"
          style={{
            animation: isEngaged ? "fmp-pulse-chevron 1.5s infinite" : undefined,
          }}
        >
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              className="size-3 text-white"
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
