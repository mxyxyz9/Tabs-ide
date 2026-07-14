import {
  type ModelSlug,
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
import { ClaudeAI, CursorIcon, Gemini, GrokIcon, Icon, OpenAI, OpenCodeIcon } from "../Icons";
import { cn } from "~/lib/utils";
import { getProviderModels, getProviderSnapshot } from "../../providerModels";
import { AVAILABLE_PROVIDER_OPTIONS, type ProviderPickerKind } from "../../session-logic";

// ─────────────────────────────────────────────────────────────────────────
// NOTHING in this file hardcodes a model name, a count of "stops", or a
// fixed set of descriptor ids (besides the one deliberate exception below:
// `fastMode`, which is a real, stable field on ModelCapabilities/descriptor
// id used across providers as the "lever" semantic). Everything else is
// derived at render time from `caps.optionDescriptors`, so a new model or a
// new descriptor showing up server-side requires zero changes here.
// ─────────────────────────────────────────────────────────────────────────

const PROVIDER_ICON_BY_PROVIDER: Record<ProviderPickerKind, Icon> = {
  codex: OpenAI,
  claudeAgent: ClaudeAI,
  cursor: CursorIcon,
  grok: GrokIcon,
  opencode: OpenCodeIcon,
};

const THEME_HEX = ["#fbbf24", "#34d399", "#e879f9", "#60a5fa", "#f97316"];

interface FusedModelPickerProps {
  provider: ProviderPickerKind;
  model: ModelSlug;
  lockedProvider: ProviderPickerKind | null;
  providers: ReadonlyArray<ServerProvider>;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  modelOptions?: ReadonlyArray<ProviderOptionSelection> | null;
  onProviderModelChange: (provider: ProviderPickerKind, model: ModelSlug) => void;
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

  const setModel = useCallback(
    (provider: ProviderPickerKind, slug: string) => {
      props.onProviderModelChange(provider, slug);
      // Switching model can invalidate the previous descriptor selections
      // (different option ids/values) — clear them and let defaults resolve.
      props.onModelOptionsChange(undefined);
    },
    [props],
  );

  const descriptors = useMemo(
    () =>
      activeModel
        ? getProviderOptionDescriptors({
            caps: activeModel.capabilities ?? {
              reasoningEffortLevels: [],
              supportsFastMode: false,
              supportsThinkingToggle: false,
              promptInjectedEffortLevels: [],
            },
            selections: props.modelOptions,
          })
        : [],
    [activeModel, props.modelOptions],
  );

  const selectDescriptors = descriptors.filter(
    (d): d is Extract<ProviderOptionDescriptor, { type: "select" }> => d.type === "select",
  );
  const booleanDescriptors = descriptors.filter(
    (d): d is Extract<ProviderOptionDescriptor, { type: "boolean" }> => d.type === "boolean",
  );
  // The one named exception: "fastMode" gets the vertical lever treatment
  // because it's the one boolean id with lever-like semantics across every
  // provider we've seen (Claude, Codex, Cursor). Every other boolean —
  // "thinking", or whatever a future provider ships — renders as a plain
  // inline switch instead of being forced into the lever shape.
  const leverDescriptor = booleanDescriptors.find((d) => d.id === "fastMode") ?? null;
  const isUltra = leverDescriptor?.currentValue === true;

  const commitDescriptors = useCallback(
    (next: ReadonlyArray<ProviderOptionDescriptor>) => {
      props.onModelOptionsChange(buildProviderOptionSelectionsFromDescriptors(next));
    },
    [props],
  );

  const handleSelectChange = useCallback(
    (descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>, optionId: string) => {
      if (descriptor.promptInjectedValues?.includes(optionId)) {
        // Special-cased on purpose: this option doesn't set a param, it
        // mutates the prompt text (Claude's "Ultrathink:" prefix hack).
        props.onPromptChange(applyClaudePromptEffortPrefix(props.prompt, optionId));
        return;
      }
      commitDescriptors(
        descriptors.map((d) => (d.id === descriptor.id ? { ...d, currentValue: optionId } : d)),
      );
    },
    [commitDescriptors, descriptors, props],
  );

  const handleBooleanChange = useCallback(
    (descriptor: Extract<ProviderOptionDescriptor, { type: "boolean" }>, value: boolean) => {
      commitDescriptors(
        descriptors.map((d) => (d.id === descriptor.id ? { ...d, currentValue: value } : d)),
      );
    },
    [commitDescriptors, descriptors],
  );

  const triggerLabel = useMemo(() => {
    if (!activeModel) return "Select model";
    const parts = [activeModel.name];
    if (leverDescriptor?.currentValue === true) {
      parts.push("Fast");
    } else if (selectDescriptors[0]) {
      const value = getProviderOptionCurrentValue(selectDescriptors[0]);
      const label = selectDescriptors[0].options.find((o) => o.id === value)?.label;
      if (label) parts.push(label);
    }
    return parts.join(" · ");
  }, [activeModel, leverDescriptor, selectDescriptors]);

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
      <MenuPopup align="start" className="w-auto p-0">
        <style>{COSMIC_KEYFRAMES}</style>
        <div
          className={cn(
            "flex gap-4 rounded-3xl p-4 transition-shadow",
            isUltra && "shadow-[0_0_35px_-10px_var(--fmp-ultra-glow)]",
          )}
          style={isUltra ? ({ "--fmp-ultra-glow": THEME_HEX[Math.max(0, models.findIndex((m) => m.slug === activeModel?.slug)) % THEME_HEX.length] } as React.CSSProperties) : undefined}
        >
          {providerOptions.length > 1 && (
            <div className="flex flex-col gap-2 border-r border-border/40 pr-4">
              {providerOptions.map((option) => {
                const OptionIcon = PROVIDER_ICON_BY_PROVIDER[option.value];
                const snapshot = getProviderSnapshot(props.providers, option.value);
                const disabled = snapshot ? snapshot.status !== "ready" : false;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    disabled={disabled}
                    onClick={() => {
                      const nextModels = getProviderModels(props.providers, option.value);
                      const fallback = nextModels.find((m) => !m.isCustom) ?? nextModels[0];
                      if (fallback) setModel(option.value, fallback.slug);
                    }}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors",
                      option.value === activeProvider
                        ? "border-border/60 bg-foreground/10 text-foreground"
                        : "hover:bg-foreground/5 hover:text-foreground",
                      disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <OptionIcon aria-hidden="true" className="size-5" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex min-w-[22rem] flex-col gap-3">
            {models.map((model, index) => (
              <ModelRow
                key={model.slug}
                model={model}
                isActive={model.slug === activeModel?.slug}
                ultra={model.slug === activeModel?.slug && isUltra}
                themeHex={THEME_HEX[index % THEME_HEX.length]}
                selections={model.slug === activeModel?.slug ? props.modelOptions : undefined}
                onSelect={() => setModel(activeProvider, model.slug)}
                onSelectChange={handleSelectChange}
                onBooleanChange={handleBooleanChange}
              />
            ))}
          </div>

          {leverDescriptor && (
            <Lever
              label={leverDescriptor.label}
              engaged={isUltra}
              themeHex={THEME_HEX[Math.max(0, models.findIndex((m) => m.slug === activeModel?.slug)) % THEME_HEX.length]}
              onChange={(value) => handleBooleanChange(leverDescriptor, value)}
            />
          )}
        </div>
      </MenuPopup>
    </Menu>
  );
});

// ── Row: one model, N stacked tracks (one per select descriptor) + N inline
// switches (one per non-fastMode boolean). Row count and control count are
// both purely a function of `model.capabilities.optionDescriptors.length`.
const ModelRow = memo(function ModelRow(props: {
  model: ServerProviderModel;
  isActive: boolean;
  ultra: boolean;
  themeHex: string;
  selections: ReadonlyArray<ProviderOptionSelection> | null | undefined;
  onSelect: () => void;
  onSelectChange: (
    descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>,
    optionId: string,
  ) => void;
  onBooleanChange: (
    descriptor: Extract<ProviderOptionDescriptor, { type: "boolean" }>,
    value: boolean,
  ) => void;
}) {
  const descriptors = getProviderOptionDescriptors({
    caps: props.model.capabilities ?? {
      reasoningEffortLevels: [],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      promptInjectedEffortLevels: [],
    },
    selections: props.isActive ? props.selections : undefined,
  });
  const selects = descriptors.filter(
    (d): d is Extract<ProviderOptionDescriptor, { type: "select" }> => d.type === "select",
  );
  const booleans = descriptors
    .filter((d): d is Extract<ProviderOptionDescriptor, { type: "boolean" }> => d.type === "boolean")
    .filter((d) => d.id !== "fastMode");

  return (
    <div
      onClick={props.onSelect}
      className={cn(
        "relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-2xl px-3 py-2.5 transition-colors",
        props.isActive ? "bg-foreground/5" : "hover:bg-foreground/[0.03]",
      )}
    >
      {props.ultra && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, #fff 1px, transparent 1.5px), radial-gradient(circle at center, rgba(255,255,255,0.8) 1.5px, transparent 2px)",
            backgroundSize: "40px 40px, 30px 30px",
            backgroundPosition: "0 0, 15px 15px",
            animation: "fmp-cosmic-flow 15s linear infinite",
          }}
        />
      )}
      <div
        className="relative text-sm font-semibold transition-colors"
        style={{
          color: props.isActive ? props.themeHex : undefined,
          textShadow: props.ultra ? `0 0 8px ${props.themeHex}99` : undefined,
        }}
      >
        {props.model.name}
      </div>

      {selects.length === 0 && booleans.length === 0 && (
        <div className="relative text-xs italic text-muted-foreground/60">
          No configurable parameters
        </div>
      )}

      {selects.map((descriptor) => (
        <SelectTrack
          key={descriptor.id}
          descriptor={descriptor}
          themeHex={props.themeHex}
          ultra={props.ultra}
          onChange={(optionId) => props.onSelectChange(descriptor, optionId)}
        />
      ))}

      {booleans.map((descriptor) => (
        <InlineSwitch
          key={descriptor.id}
          label={descriptor.label}
          value={descriptor.currentValue === true}
          onChange={(value) => props.onBooleanChange(descriptor, value)}
        />
      ))}
    </div>
  );
});

// ── One horizontal track for one "select" descriptor. Dot count and labels
// come entirely from `descriptor.options` — never a fixed 5-stop scale.
const SelectTrack = memo(function SelectTrack(props: {
  descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>;
  themeHex: string;
  ultra: boolean;
  onChange: (optionId: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { options } = props.descriptor;
  const currentValue = getProviderOptionCurrentValue(props.descriptor);
  const currentIndex = Math.max(
    0,
    options.findIndex((o) => o.id === currentValue),
  );
  const restingPercent = options.length > 1 ? currentIndex / (options.length - 1) : 0;

  // Drag state lives locally so the pointer/thumb can follow the cursor at
  // full frame rate without forcing the parent (and its descriptor list) to
  // re-render on every pixel of movement. The parent only hears about a
  // change — via props.onChange — when the dragged position actually crosses
  // into a new stop, same as before; the difference is *how often we look*.
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  const rafId = useRef<number | null>(null);
  const pendingClientX = useRef<number | null>(null);
  const lastCommittedId = useRef(currentValue);

  const flush = useCallback(() => {
    rafId.current = null;
    const el = trackRef.current;
    if (el == null || pendingClientX.current == null) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(pendingClientX.current - rect.left - 16, rect.width - 32));
    const pct = rect.width > 32 ? x / (rect.width - 32) : 0;
    setDragPercent(pct);
    const idx = Math.round(pct * Math.max(1, options.length - 1));
    const option = options[idx];
    if (option && option.id !== lastCommittedId.current) {
      lastCommittedId.current = option.id;
      props.onChange(option.id);
    }
  }, [options, props]);

  const scheduleFlush = useCallback(
    (clientX: number) => {
      pendingClientX.current = clientX;
      if (rafId.current == null) {
        rafId.current = requestAnimationFrame(flush);
      }
    },
    [flush],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    lastCommittedId.current = currentValue;
    scheduleFlush(e.clientX);
    const onMove = (moveEvent: MouseEvent) => scheduleFlush(moveEvent.clientX);
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      setDragPercent(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const isDragging = dragPercent !== null;
  const percent = dragPercent ?? restingPercent;
  const fillStyle: React.CSSProperties = props.ultra
    ? {
        width: `calc(8px + (100% - 16px) * ${percent})`,
        backgroundImage: `linear-gradient(90deg, ${props.themeHex}55, ${props.themeHex}, #fff)`,
        backgroundSize: "200% 100%",
        animation: "fmp-cosmic-gradient 3s linear infinite",
      }
    : { width: `calc(8px + (100% - 16px) * ${percent})`, backgroundColor: props.themeHex };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between px-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
        {options.map((option) => (
          <span key={option.id}>{option.label}</span>
        ))}
      </div>
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        className="relative h-10 cursor-pointer rounded-full bg-foreground/5 px-4"
      >
        <div
          className={cn("absolute inset-y-1.5 left-1 rounded-full", !isDragging && "transition-all duration-200")}
          style={fillStyle}
        />
        <div
          className={cn(
            "absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-white shadow-md",
            !isDragging && "transition-all duration-200",
          )}
          style={{ left: `calc(8px + (100% - 16px) * ${percent} - 12px)` }}
        />
        <div className="pointer-events-none absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between">
          {options.map((option) => (
            <div key={option.id} className="size-1.5 rounded-full bg-foreground/20" />
          ))}
        </div>
      </div>
    </div>
  );
});

const InlineSwitch = memo(function InlineSwitch(props: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        props.onChange(!props.value);
      }}
      className="flex items-center justify-between rounded-full px-4 py-1.5 text-xs text-muted-foreground/80 hover:bg-foreground/[0.04]"
    >
      <span>{props.label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          props.value ? "bg-white" : "bg-foreground/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-black shadow transition-transform",
            props.value ? "left-4" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
});

// ── Vertical lever for the "fastMode" boolean of the currently active model.
// Track geometry is fixed by the `h-32`/`size-8` Tailwind classes below —
// TRACK_PX/THUMB_PX/PAD_PX mirror those so the pixel math for the thumb's
// resting/dragged position stays in sync with the rendered box.
const TRACK_PX = 128; // h-32
const THUMB_PX = 32; // size-8
const PAD_PX = 4;
const RANGE_PX = TRACK_PX - THUMB_PX - PAD_PX * 2;

const Lever = memo(function Lever(props: {
  label: string;
  engaged: boolean;
  themeHex: string;
  onChange: (value: boolean) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Continuous 0..1 position while actively dragging; null once released, at
  // which point the thumb springs to the resting engaged/disengaged slot.
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const rafId = useRef<number | null>(null);
  const pendingClientY = useRef<number | null>(null);
  const lastEngaged = useRef(props.engaged);

  const flush = useCallback(() => {
    rafId.current = null;
    const el = trackRef.current;
    if (el == null || pendingClientY.current == null) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min((pendingClientY.current - rect.top) / rect.height, 1));
    setDragProgress(pct);
    if (pct > 0.6 && !lastEngaged.current) {
      lastEngaged.current = true;
      props.onChange(true);
    } else if (pct < 0.4 && lastEngaged.current) {
      lastEngaged.current = false;
      props.onChange(false);
    }
  }, [props]);

  const scheduleFlush = useCallback(
    (clientY: number) => {
      pendingClientY.current = clientY;
      if (rafId.current == null) {
        rafId.current = requestAnimationFrame(flush);
      }
    },
    [flush],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    lastEngaged.current = props.engaged;
    scheduleFlush(e.clientY);
    const onMove = (moveEvent: MouseEvent) => scheduleFlush(moveEvent.clientY);
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      setDragProgress(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const isDragging = dragProgress !== null;
  const progress = dragProgress ?? (props.engaged ? 1 : 0);
  const thumbTopPx = PAD_PX + progress * RANGE_PX;

  return (
    <div className="flex w-20 flex-col items-center border-l border-border/40 pl-4">
      <div
        className="mb-3 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70 transition-colors"
        style={{
          color: props.engaged ? props.themeHex : undefined,
          textShadow: props.engaged ? `0 0 10px ${props.themeHex}99` : undefined,
        }}
      >
        {props.label}
      </div>
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        className={cn(
          "relative h-32 w-9 cursor-pointer overflow-hidden rounded-full bg-black/40 shadow-inner transition-shadow",
          props.engaged && "shadow-[0_0_20px_-4px_var(--fmp-lever-glow)]",
        )}
        style={props.engaged ? ({ "--fmp-lever-glow": props.themeHex } as React.CSSProperties) : undefined}
      >
        {props.engaged && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundColor: props.themeHex,
              maskImage:
                "repeating-linear-gradient(180deg, transparent 0 6px, #000 6px 12px)",
              WebkitMaskImage:
                "repeating-linear-gradient(180deg, transparent 0 6px, #000 6px 12px)",
              animation: "fmp-cosmic-flow 3s linear infinite",
            }}
          />
        )}
        <div
          className={cn(
            "absolute left-1/2 size-8 -translate-x-1/2 rounded-full shadow-lg",
            !isDragging && "transition-all duration-300",
          )}
          style={{
            top: `${thumbTopPx}px`,
            background: props.engaged
              ? `radial-gradient(circle at 35% 35%, #fff, ${props.themeHex})`
              : "radial-gradient(circle at 35% 35%, #ff5b5b, #b90000)",
            boxShadow: props.engaged ? `0 0 20px ${props.themeHex}` : undefined,
          }}
        />
      </div>
    </div>
  );
});

const COSMIC_KEYFRAMES = `
@keyframes fmp-cosmic-gradient {
  0% { background-position: 100% 0%; }
  100% { background-position: -100% 0%; }
}
@keyframes fmp-cosmic-flow {
  0% { background-position: 0 0; }
  100% { background-position: 0 400px; }
}
`;