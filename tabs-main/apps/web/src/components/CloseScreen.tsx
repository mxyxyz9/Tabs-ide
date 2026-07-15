import React, { useState, useEffect, useRef, useId, useCallback } from "react";
import { useTheme } from "../hooks/useTheme";
import { cn } from "~/lib/utils";
import "./close-animation.css";
import "./loaders.css";

export type ClosePhase = "idle" | "closing" | "holding";

const GLASS_WORD = "TABS";
const SOLARI_WORD = "TABS IDE";

const CLOSE_GLASS_MESSAGES = [
  "SAVING YOUR EXCUSES",
  "TELLING THE CPU TO TAKE A NAP",
  "ARCHIVING ABANDONED SIDE PROJECTS",
  "YEETING TEMPORARY FILES",
  "PACKING UP SEMICOLONS",
  "WRITING YOUR FAREWELL TODO",
];

const CLOSE_SOLARI_MESSAGES = [
  "RETURNING BORROWED STACK FRAMES",
  "SAYING GOODBYE TO NODE_MODULES",
  "DEFRAGMENTING YOUR MOTIVATION",
  "FILING BUG REPORTS FOR NEXT TIME",
  "BLAMING THE LAST COMMIT",
  "SHUTTING DOWN (PROBABLY)",
];

/* ── Rotating Label (reuses loaders.css rl-in/rl-out keyframes) ─────── */

function RotatingLabel({
  messages,
  phase,
  intervalMs = 600,
  className,
}: {
  messages: string[];
  phase: ClosePhase;
  intervalMs?: number;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (phase === "holding") return;
    setIdx(Math.floor(Math.random() * messages.length));

    const id = setInterval(() => {
      setIdx((prev) => {
        let next = Math.floor(Math.random() * messages.length);
        while (next === prev && messages.length > 1) {
          next = Math.floor(Math.random() * messages.length);
        }
        return next;
      });
    }, intervalMs);
    
    return () => clearInterval(id);
  }, [messages, intervalMs, phase]);

  return (
    <div className={cn("relative z-10 h-[14px] w-full text-center loader-respect-motion", className)}>
      <span
        key={phase === "holding" ? "goodbye" : messages[idx]}
        className="absolute inset-x-0 whitespace-nowrap text-[11px] font-semibold tracking-[0.22em] uppercase transition-opacity duration-300"
      >
        {phase === "holding" ? "GOODBYE." : messages[idx]}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MOLTEN GLASS CLOSE
   ═══════════════════════════════════════════════════════════════════════ */

interface CloseAnimationProps {
  phase: ClosePhase;
  palette: "block" | "mono";
  isDark: boolean;
  onIntroEnd?: (() => void) | undefined;
}

function MoltenGlassClose({ phase, palette, isDark, onIntroEnd }: CloseAnimationProps) {
  const filterId = useId().replace(/:/g, "");
  const isBlock = palette === "block";
  const dispRef = useRef<SVGFEDisplacementMapElement>(null);
  const animateRef = useRef<SVGAnimationElement>(null);
  const rafRef = useRef<number | null>(null);

  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onIntroEndRef = useRef(onIntroEnd);
  useEffect(() => {
    onIntroEndRef.current = onIntroEnd;
  }, [onIntroEnd]);

  const runDrain = useCallback(() => {
    const start = performance.now();
    const duration = 800; // ms — displacement scale ramp

    const ramp = (now: DOMHighResTimeStamp) => {
      const t = Math.min(1, (now - start) / duration);
      if (dispRef.current) {
        dispRef.current.setAttribute("scale", (12 + t * 34).toFixed(1));
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(ramp);
      }
    };

    rafRef.current = requestAnimationFrame(ramp);

    // Whole intro sequence ends ~1400ms after trigger
    const holdTimer = setTimeout(() => {
      onIntroEndRef.current?.();
    }, 1400);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      clearTimeout(holdTimer);
    };
  }, []); // Remove onIntroEnd from dependencies

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (animateRef.current) {
        try {
          (animateRef.current as any).beginElement();
        } catch (e) {}
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (phase === "closing") {
      if (prefersReducedMotion) {
        onIntroEndRef.current?.();
        return;
      }
      const cleanup = runDrain();
      return cleanup;
    }
    // Reset displacement scale when replayed
    if (phase === "idle" && dispRef.current) {
      dispRef.current.setAttribute("scale", "12");
    }
  }, [phase, runDrain, prefersReducedMotion]);

  const animating = phase === "closing" || phase === "holding";

  return (
    <div className="close-screen relative z-10 flex min-h-[300px] w-full max-w-[560px] items-center justify-center p-6">
      {/* Hidden SVG for the displacement filter */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02 0.09"
              numOctaves={2}
              seed="7"
              result="noise"
            >
              <animate
                ref={animateRef}
                attributeName="baseFrequency"
                dur="6.75s"
                begin="indefinite"
                values="0.02 0.09;0.035 0.14;0.02 0.09"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              ref={dispRef}
              in="SourceGraphic"
              in2="noise"
              scale="12"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className="relative flex w-full flex-col items-center justify-center gap-[22px]">
        {/* Card with fade animation */}
        <div
          className={cn(
            "relative w-full flex flex-col items-center justify-center gap-[22px] transform-origin-center",
            animating && "cq-card-fade"
          )}
        >
          {/* Word with drain animation */}
          <div
            className={cn(
              "text-[72px] font-[800] tracking-[-0.02em] transform-origin-[center_bottom]",
              animating && "cq-word-drain",
              isBlock
                ? (isDark ? "text-[#1c0f0e]" : "text-white")
                : (isDark ? "text-[#f5f5f5]" : "text-[#18181b]")
            )}
            style={{ filter: `url(#${filterId})` }}
          >
            {GLASS_WORD}
          </div>

          {/* Caption */}
          <div
            className={cn(
              "text-[11px] font-semibold tracking-[0.25em] uppercase transition-opacity duration-300",
              animating && "cq-caption-hide",
              isBlock
                ? (isDark ? "text-[#1c0f0e]/85" : "text-white/75")
                : (isDark ? "text-[#8f8f95]" : "text-[#71717a]")
            )}
          >
            READY
          </div>
        </div>

        {/* Rotating status label — visible in all phases (closing + holding) */}
        <RotatingLabel
          messages={CLOSE_GLASS_MESSAGES}
          phase={phase}
          className={
            isBlock
              ? (isDark ? "text-[#1c0f0e]/85" : "text-white/75")
              : (isDark ? "text-[#a1a1aa]" : "text-[#71717a]")
          }
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SOLARI GRID CLOSE
   ═══════════════════════════════════════════════════════════════════════ */

function SolariGridClose({ phase, palette, isDark, onIntroEnd }: CloseAnimationProps) {
  const tiles = SOLARI_WORD.split("");
  const isBlock = palette === "block";

  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onIntroEndRef = useRef(onIntroEnd);
  useEffect(() => {
    onIntroEndRef.current = onIntroEnd;
  }, [onIntroEnd]);

  useEffect(() => {
    if (phase !== "closing") return;
    if (prefersReducedMotion) {
      onIntroEndRef.current?.();
      return;
    }
    const cascadeEnd = tiles.length * 70 + 260;
    const holdTimer = setTimeout(() => {
      onIntroEndRef.current?.();
    }, cascadeEnd + 800);
    return () => clearTimeout(holdTimer);
  }, [phase, tiles.length, prefersReducedMotion]);

  const animating = phase === "closing" || phase === "holding";

  return (
    <div className="close-screen relative z-10 flex min-h-[300px] w-full max-w-[560px] items-center justify-center p-6">
      <div className="relative flex w-full flex-col items-center justify-center gap-[20px]">
        {/* Card with collapse animation */}
        <div
          className={cn(
            "relative w-full flex flex-col items-center justify-center gap-[22px] transform-origin-center",
            "rounded-[16px] border py-[32px] px-[24px]",
            isBlock
              ? (isDark ? "border-[#1c0f0e]/10 bg-black/10" : "border-white/20 bg-white/10")
              : (isDark ? "border-white/10 bg-[#131316] shadow-2xl shadow-black/50" : "border-black/5 bg-white shadow-xl shadow-black/5"),
            animating && "cq-card-collapse"
          )}
        >
          {/* Tile grid */}
          <div
            className={cn(
              "relative z-10 grid grid-cols-4 gap-[6px]",
              isBlock
                ? (isDark ? "text-[#1c0f0e]" : "text-white")
                : (isDark ? "text-[#f5f5f5]" : "text-[#18181b]")
            )}
          >
            {tiles.map((ch, i) => (
              <div
                key={i}
                className={cn(
                  "relative flex h-[64px] w-[52px] items-center justify-center rounded-[6px] border text-[26px] font-bold transition-all duration-[280ms]",
                  animating && (isDark ? "cq-tile-dim" : "cq-tile-dim-light"),
                  isBlock
                    ? "border-white/24 bg-white/12"
                    : isDark
                      ? "border-white/6 bg-white/4"
                      : "border-black/8 bg-black/3"
                )}
                style={animating ? { transitionDelay: `${i * 70}ms` } : undefined}
              >
                <div className="absolute inset-x-0 top-1/2 h-px bg-black/35" />
                {ch === " " ? "\u00A0" : ch}
              </div>
            ))}
          </div>

          {/* Caption */}
          <div
            className={cn(
              "text-[11px] font-semibold tracking-[0.25em] uppercase",
              isBlock
                ? (isDark ? "text-[#1c0f0e]/85" : "text-white/75")
                : (isDark ? "text-[#8f8f95]" : "text-[#71717a]")
            )}
          >
            READY
          </div>
        </div>

        {/* Rotating status label — visible in closing + holding phases */}
        <RotatingLabel
          messages={CLOSE_SOLARI_MESSAGES}
          phase={phase}
          className={
            isBlock
              ? (isDark ? "text-[#1c0f0e]/85" : "text-white/75")
              : (isDark ? "text-[#a1a1aa]" : "text-[#71717a]")
          }
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════════ */

export interface CloseScreenProps {
  loader: "glass" | "solari" | string;
  palette: "block" | "mono" | string;
  theme?: "light" | "dark" | "system";
  phase?: ClosePhase;
  onIntroEnd?: () => void;
}

export function CloseScreen({
  loader,
  palette,
  theme: overrideTheme,
  phase = "closing",
  onIntroEnd,
}: CloseScreenProps) {
  const { resolvedTheme } = useTheme();
  const theme = overrideTheme && overrideTheme !== "system" ? overrideTheme : resolvedTheme;
  const isDark = theme === "dark";
  const isBlock = palette === "block";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center",
        isBlock ? "bg-primary" : (isDark ? "bg-[#09090b]" : "bg-white")
      )}
    >
      {loader === "solari" ? (
        <SolariGridClose
          phase={phase}
          palette={palette as "block" | "mono"}
          isDark={isDark}
          onIntroEnd={onIntroEnd}
        />
      ) : (
        <MoltenGlassClose
          phase={phase}
          palette={palette as "block" | "mono"}
          isDark={isDark}
          onIntroEnd={onIntroEnd}
        />
      )}
    </div>
  );
}
