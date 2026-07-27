import React, { useState, useEffect, useRef, useId } from "react";
import { useTheme } from "../hooks/useTheme";
import { cn } from "~/lib/utils";
import "./loaders.css";

const GLASS_MESSAGES = [
  "COMPILING VIBES",
  "MELTING NODE_MODULES",
  "NEGOTIATING WITH THE LINTER",
  "BRIBING THE GARBAGE COLLECTOR",
  "RETICULATING SPLINES",
  "ALMOST READY (PROBABLY)",
];

const SOLARI_MESSAGES = [
  "BOARDING NODE_MODULES",
  "HERDING SEMICOLONS",
  "RESOLVING MERGE CONFLICTS",
  "DOWNLOADING MORE RAM",
  "BLAMING THE CACHE",
  "ALMOST READY (PROBABLY)",
];

const SOLARI_WORD = "TABS IDE";

const SOLARI_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ".split("");

function RotatingLabel({
  messages,
  intervalMs = 2200,
  className,
}: {
  messages: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    let clearId: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      const leaving = messages[idxRef.current];
      if (leaving === undefined) return;
      const next = (idxRef.current + 1) % messages.length;
      idxRef.current = next;
      setOutgoing(leaving);
      setIdx(next);
      clearId = setTimeout(() => setOutgoing(null), 520);
    }, intervalMs);
    return () => {
      clearInterval(id);
      if (clearId) clearTimeout(clearId);
    };
  }, [messages, intervalMs]);

  return (
    <div
      className={cn("relative z-10 h-[14px] w-full text-center loader-respect-motion", className)}
    >
      {outgoing && (
        <span
          key={`out-${outgoing}`}
          className="rl-out absolute inset-x-0 whitespace-nowrap text-[11px] font-semibold tracking-[0.22em] uppercase"
        >
          {outgoing}
        </span>
      )}
      <span
        key={`in-${messages[idx]}`}
        className="rl-in absolute inset-x-0 whitespace-nowrap text-[11px] font-semibold tracking-[0.22em] uppercase"
      >
        {messages[idx]}
      </span>
    </div>
  );
}

function MoltenGlass({ palette, isDark }: { palette: "block" | "mono"; isDark: boolean }) {
  const filterId = useId().replace(/:/g, "");
  const isBlock = palette === "block";
  const animateRef = useRef<SVGAnimationElement>(null);

  useEffect(() => {
    const triggerAnimation = () => {
      if (animateRef.current) {
        try {
          (animateRef.current as any).beginElement();
        } catch (e) {}
      }
    };

    const frame = requestAnimationFrame(triggerAnimation);

    // Chromium sometimes drops SMIL feTurbulence animations after one cycle
    // even with repeatCount="indefinite". Restart it explicitly right before it ends.
    const intervalId = setInterval(triggerAnimation, 6700);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="relative z-10 flex min-h-[300px] w-full max-w-[560px] items-center justify-center p-6 loader-respect-motion">
      <div className="relative flex w-full flex-col items-center justify-center gap-[22px]">
        <svg
          width="1"
          height="1"
          style={{ position: "absolute", opacity: 0.001, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <defs>
            <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.02 0.09"
                numOctaves="2"
                seed="3"
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
                in="SourceGraphic"
                in2="noise"
                scale="12"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>

        <div
          className={cn(
            "relative z-10 text-[80px] font-[800] tracking-[-0.02em]",
            isBlock
              ? "text-primary-foreground"
              : "text-foreground",
          )}
          style={{ filter: `url(#${filterId})` }}
        >
          TABS
        </div>

        <RotatingLabel
          messages={GLASS_MESSAGES}
          className={
            isBlock
              ? "text-primary-foreground/80"
              : "text-muted-foreground"
          }
        />
      </div>
    </div>
  );
}

function SolariTile({
  target,
  index,
  isBlock,
  isDark,
}: {
  target: string;
  index: number;
  isBlock: boolean;
  isDark: boolean;
}) {
  const [ch, setCh] = useState(target);
  const [justSettled, setJustSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const settleAt = 400 + index * 280;
    const iv = setInterval(() => {
      if (!cancelled) setCh(SOLARI_CHARS[Math.floor(Math.random() * SOLARI_CHARS.length)]!);
    }, 70);
    const to = setTimeout(() => {
      cancelled = true;
      clearInterval(iv);
      setCh(target);
      setJustSettled(true);
    }, settleAt);

    return () => {
      cancelled = true;
      clearInterval(iv);
      clearTimeout(to);
    };
  }, [target, index]);

  return (
    <span
      className={cn(
        "inline-block w-[0.72em] text-center font-mono font-bold tracking-tight transition-transform duration-200",
        justSettled && "scale-105",
      )}
    >
      {ch}
    </span>
  );
}

function SolariGrid({ palette, isDark }: { palette: "block" | "mono"; isDark: boolean }) {
  const isBlock = palette === "block";
  const word = SOLARI_WORD.split("");

  return (
    <div className="relative z-10 flex min-h-[300px] w-full max-w-[560px] items-center justify-center p-6 loader-respect-motion">
      <div className="relative flex w-full flex-col items-center justify-center gap-[22px]">
        <div
          className={cn(
            "flex items-center justify-center text-[54px] sm:text-[68px] font-bold tracking-wider",
            isBlock
              ? "text-primary-foreground"
              : "text-foreground",
          )}
        >
          {word.map((ch, i) => (
            <SolariTile key={i} target={ch!} index={i} isBlock={isBlock} isDark={isDark} />
          ))}
        </div>
        <RotatingLabel
          messages={SOLARI_MESSAGES}
          className={
            isBlock
              ? "text-primary-foreground/80"
              : "text-muted-foreground"
          }
        />
      </div>
    </div>
  );
}

export interface SplashScreenProps {
  loader: "glass" | "solari" | string;
  palette: "block" | "mono" | string;
  theme?: "light" | "dark" | "system";
}

export function SplashScreen({ loader, palette, theme: overrideTheme }: SplashScreenProps) {
  const { resolvedTheme } = useTheme();
  const theme = overrideTheme && overrideTheme !== "system" ? overrideTheme : resolvedTheme;
  const isDark =
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : theme?.includes("dark");
  const isBlock = palette === "block";
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center",
        isBlock ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
      )}
    >
      {loader === "solari" ? (
        <SolariGrid palette={palette as any} isDark={isDark} />
      ) : (
        <MoltenGlass palette={palette as any} isDark={isDark} />
      )}
    </div>
  );
}
