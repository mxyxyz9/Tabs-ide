/**
 * AgentBackground — animated anime wallpaper for the agent workspace.
 *
 * Implements the exact animation from the startup wizard (WelcomeWizard):
 * 1. Vibrant wallpaper with smooth crossfade & subtle mouse parallax
 * 2. Cinematic neutral vignette & depth mask (pure neutral black shadows)
 * 3. AnimatedHalftoneCanvas: dual-canvas system with:
 *    - Multiply blend: dark wave-modulated dot grid (3-wave liquid ripple)
 *    - Screen blend: neural spark clusters, Matrix data streams & diagonal scan sweep
 * 4. Interactive WallpaperTopBar controller floating above chat at bottom-right
 *    (full opacity, 100% clickable, previous/next, random dice, filmstrip shelf, gallery modal)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../lib/utils";
import { useTheme } from "../hooks/useTheme";
import {
  WALLPAPERS,
  type WallpaperOption,
  getInitialAgentWallpaper,
  saveAgentWallpaperPreference,
  getIsAgentWallpaperEnabled,
  saveIsAgentWallpaperEnabled,
  AGENT_WALLPAPER_CHANGE_EVENT,
  getAllAgentWallpapers,
  getThreadWallpaper,
  saveThreadWallpaper,
  clearThreadWallpaper,
  resolveWallpaperForThread,
} from "./onboarding/wallpapers";
import { WallpaperTopBar } from "./onboarding/WallpaperTopBar";
import { WallpaperGalleryModal } from "./onboarding/WallpaperGalleryModal";

const PARALLAX_SCALE = 1.05;
const MAX_PARALLAX_PX = 10;

// ─── Exact Animated Halftone Canvas from Startup Wizard ──────────────────────
// Dual-canvas animated halftone: dark wave-modulated dot grid (multiply) +
// neural sparks, data streams, and scan sweeps (screen / multiply).
function AnimatedHalftoneCanvas({ theme = "dark" }: { theme?: "light" | "dark" }) {
  const dotRef = useRef<HTMLCanvasElement | null>(null);
  const glowRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const dotCanvas = dotRef.current;
    const glowCanvas = glowRef.current;
    if (!dotCanvas || !glowCanvas) return;
    const dc = dotCanvas.getContext("2d");
    const gc = glowCanvas.getContext("2d");
    if (!dc || !gc) return;

    const GRID = 6; // px between dot centers
    let W = 0;
    let H = 0;

    const resize = () => {
      const parent = dotCanvas.parentElement;
      W = dotCanvas.width = glowCanvas.width = parent?.clientWidth ?? window.innerWidth;
      H = dotCanvas.height = glowCanvas.height = parent?.clientHeight ?? window.innerHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    if (dotCanvas.parentElement) ro.observe(dotCanvas.parentElement);
    window.addEventListener("resize", resize);

    // ── State types ──────────────────────────────────────────────────────────
    interface Spark {
      cx: number;
      cy: number;
      life: number;
      maxLife: number;
      r: number; // radius in dot-grid units
      hue: number;
    }
    interface DataStream {
      col: number;
      head: number; // fractional row of stream head
      speed: number; // rows/second
      length: number; // trail dot count
      hue: number;
    }

    const sparks: Spark[] = [];
    const streams: DataStream[] = [];
    let nextSpark = performance.now() + 500;
    let nextStream = performance.now() + 1400;
    let scanPos = -0.2;
    let scanActive = false;
    let nextScan = performance.now() + 4500;

    let last = performance.now();
    let animId: number;

    const SPARK_HUES = [195, 258, 145, 38] as const; // cyan, violet, green, amber
    const STREAM_HUES = [195, 258, 145] as const;

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const isLight = themeRef.current === "light";

      dc.clearRect(0, 0, W, H);
      gc.clearRect(0, 0, W, H);

      const cols = Math.ceil(W / GRID);
      const rows = Math.ceil(H / GRID);

      // ── Spawn / age sparks ───────────────────────────────────────────────
      if (now > nextSpark && sparks.length < 55) {
        sparks.push({
          cx: Math.floor(Math.random() * cols),
          cy: Math.floor(Math.random() * rows),
          life: 0,
          maxLife: 0.8 + Math.random() * 1.4,
          r: 2 + Math.random() * 6,
          hue: SPARK_HUES[Math.floor(Math.random() * SPARK_HUES.length)]!,
        });
        nextSpark = now + 160 + Math.random() * 500;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        sparks[i]!.life += dt;
        if (sparks[i]!.life >= sparks[i]!.maxLife) sparks.splice(i, 1);
      }

      // ── Spawn / age data streams ─────────────────────────────────────────
      if (now > nextStream && streams.length < 10) {
        streams.push({
          col: Math.floor(Math.random() * cols),
          head: 0,
          speed: 20 + Math.random() * 38,
          length: 10 + Math.floor(Math.random() * 18),
          hue: STREAM_HUES[Math.floor(Math.random() * STREAM_HUES.length)]!,
        });
        nextStream = now + 500 + Math.random() * 1000;
      }
      for (let i = streams.length - 1; i >= 0; i--) {
        streams[i]!.head += streams[i]!.speed * dt;
        if (streams[i]!.head - streams[i]!.length > rows) streams.splice(i, 1);
      }

      // ── Spawn / advance diagonal scan ───────────────────────────────────
      if (!scanActive && now > nextScan) {
        scanActive = true;
        scanPos = -0.15;
        nextScan = now + 6000 + Math.random() * 7000;
      }
      if (scanActive) {
        scanPos += dt * 0.44;
        if (scanPos > 1.25) scanActive = false;
      }

      // ── DOT CANVAS (mix-blend: multiply) — dark halftone grid ────────────
      // All dots drawn in a SINGLE beginPath call for GPU-batch efficiency.
      dc.beginPath();
      for (let row = 0; row < rows; row++) {
        const y = row * GRID + GRID / 2;
        for (let col = 0; col < cols; col++) {
          const x = col * GRID + GRID / 2;

          // 3-wave interference → flowing liquid-matrix ripple.
          // Two waves travel in perpendicular directions; a third moves diagonally.
          const w1 = Math.sin(col * 0.22 + t * 1.3) * Math.sin(row * 0.16 + t * 0.88);
          const w2 = Math.sin(col * 0.09 - row * 0.08 + t * 0.72);
          const w3 = Math.cos((col + row) * 0.07 + t * 1.08) * 0.5;
          const wave = w1 * 0.55 + w2 * 0.3 + w3 * 0.15; // ≈ –1..1

          const r = Math.max(0.35, Math.min(2.05, 0.88 + wave * 0.72));
          dc.moveTo(x + r, y);
          dc.arc(x, y, r, 0, Math.PI * 2);
        }
      }
      dc.fillStyle = isLight ? "rgba(100, 116, 139, 0.22)" : "rgba(0, 0, 0, 0.60)";
      dc.fill();

      // ── GLOW CANVAS (mix-blend: screen / soft-light) — luminance effects ──
      // Diagonal scan sweep: a narrow bright band that crosses the grid.
      if (scanActive) {
        const diagLen = W + H;
        const bandCenter = scanPos * diagLen;
        const band = 160;
        const gx0 = bandCenter - H - band;
        const gx1 = bandCenter - H + band;
        const scanGrd = gc.createLinearGradient(gx0, H, gx1, 0);
        scanGrd.addColorStop(0, "rgba(160, 230, 255, 0)");
        scanGrd.addColorStop(0.3, "rgba(160, 230, 255, 0)");
        scanGrd.addColorStop(0.5, isLight ? "rgba(56, 189, 248, 0.15)" : "rgba(210, 248, 255, 0.20)");
        scanGrd.addColorStop(0.7, "rgba(160, 230, 255, 0)");
        scanGrd.addColorStop(1, "rgba(160, 230, 255, 0)");
        gc.fillStyle = scanGrd;
        gc.fillRect(0, 0, W, H);
      }

      // Data streams — bright dots rain down random columns.
      for (const st of streams) {
        const headRow = Math.floor(st.head);

        // Trail dots (batched)
        gc.beginPath();
        for (let di = 1; di < st.length; di++) {
          const row = headRow - di;
          if (row < 0 || row >= rows) continue;
          const trailFrac = Math.pow(1 - di / st.length, 1.6);
          const dotR = Math.max(0.4, 1.3 * trailFrac);
          const x = st.col * GRID + GRID / 2;
          const y = row * GRID + GRID / 2;
          gc.moveTo(x + dotR, y);
          gc.arc(x, y, dotR, 0, Math.PI * 2);
        }
        gc.fillStyle = isLight
          ? `hsla(${st.hue}, 80%, 45%, 0.50)`
          : `hsla(${st.hue}, 90%, 75%, 0.72)`;
        gc.fill();

        // Head dot — extra bright (separate draw)
        if (headRow >= 0 && headRow < rows) {
          const x = st.col * GRID + GRID / 2;
          const y = headRow * GRID + GRID / 2;
          gc.fillStyle = isLight
            ? `hsla(${st.hue}, 90%, 35%, 0.75)`
            : `hsla(${st.hue}, 100%, 96%, 0.98)`;
          gc.beginPath();
          gc.arc(x, y, 2.1, 0, Math.PI * 2);
          gc.fill();
        }
      }

      // Neural sparks — clustered glowing dot explosions.
      for (const sp of sparks) {
        const prog = sp.life / sp.maxLife;
        const alpha = Math.sin(prog * Math.PI); // rises and falls
        const cx = sp.cx * GRID + GRID / 2;
        const cy = sp.cy * GRID + GRID / 2;
        const glowR = sp.r * GRID + GRID * 1.5;

        // Soft ambient halo
        const grd = gc.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        grd.addColorStop(
          0,
          isLight
            ? `hsla(${sp.hue}, 80%, 55%, ${alpha * 0.35})`
            : `hsla(${sp.hue}, 95%, 78%, ${alpha * 0.55})`,
        );
        grd.addColorStop(
          0.5,
          isLight
            ? `hsla(${sp.hue}, 75%, 50%, ${alpha * 0.12})`
            : `hsla(${sp.hue}, 90%, 60%, ${alpha * 0.18})`,
        );
        grd.addColorStop(1, `hsla(${sp.hue}, 90%, 50%, 0)`);
        gc.fillStyle = grd;
        gc.beginPath();
        gc.arc(cx, cy, glowR, 0, Math.PI * 2);
        gc.fill();

        // Core bright dots within the spark cluster
        const coreR = sp.r * 0.65;
        const intR = Math.ceil(coreR);
        gc.beginPath();
        for (let dy = -intR; dy <= intR; dy++) {
          for (let dx = -intR; dx <= intR; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > coreR) continue;
            const col = sp.cx + dx;
            const row = sp.cy + dy;
            if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
            const x = col * GRID + GRID / 2;
            const y = row * GRID + GRID / 2;
            const dotR = Math.max(0.5, 1.7 * (1 - dist / (coreR + 0.01)));
            gc.moveTo(x + dotR, y);
            gc.arc(x, y, dotR, 0, Math.PI * 2);
          }
        }
        gc.fillStyle = isLight
          ? `hsla(${sp.hue}, 85%, 45%, ${alpha * 0.70})`
          : `hsla(${sp.hue}, 100%, 92%, ${alpha * 0.92})`;
        gc.fill();
      }
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  const canvasClass = "pointer-events-none absolute inset-0 h-full w-full z-[2]";
  const isLight = theme === "light";

  return (
    <>
      {/* Dark halftone dot grid — multiply blend */}
      <canvas ref={dotRef} className={canvasClass} style={{ mixBlendMode: "multiply" }} />
      {/* Neural glow effects — screen blend in dark mode, soft-light in light mode */}
      <canvas
        ref={glowRef}
        className={canvasClass}
        style={{
          mixBlendMode: isLight ? "soft-light" : "screen",
          opacity: isLight ? 0.75 : 1,
        }}
      />
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface AgentBackgroundProps {
  readonly enabled?: boolean;
  readonly threadId?: string | null;
  readonly children?: ReactNode;
}

export function AgentBackground({
  enabled = true,
  threadId = null,
  children,
}: AgentBackgroundProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";

  const [isWallpaperEnabled, setIsWallpaperEnabled] = useState<boolean>(
    () => enabled && getIsAgentWallpaperEnabled(),
  );

  const [wallpaper, setWallpaper] = useState<WallpaperOption>(() =>
    resolveWallpaperForThread(threadId),
  );
  const [prevWallpaper, setPrevWallpaper] = useState<WallpaperOption | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });
  const currentTranslate = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  // Check if current wallpaper is specifically assigned to this thread
  const hasThreadSpecific = Boolean(threadId && getThreadWallpaper(threadId));

  // Sync wallpaper when threadId changes or when storage / custom events fire
  useEffect(() => {
    setWallpaper(resolveWallpaperForThread(threadId));
  }, [threadId]);

  useEffect(() => {
    const handleUpdate = () => {
      setIsWallpaperEnabled(getIsAgentWallpaperEnabled());
      setWallpaper(resolveWallpaperForThread(threadId));
    };
    window.addEventListener(AGENT_WALLPAPER_CHANGE_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(AGENT_WALLPAPER_CHANGE_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [threadId]);

  // Parallax tracking relative to the chat area container
  useEffect(() => {
    if (!isWallpaperEnabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      mousePos.current = {
        x: Math.max(0, Math.min(1, relX)),
        y: Math.max(0, Math.min(1, relY)),
      };
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    const animate = () => {
      const targetX = (mousePos.current.x - 0.5) * -MAX_PARALLAX_PX * 2;
      const targetY = (mousePos.current.y - 0.5) * -MAX_PARALLAX_PX * 2;

      currentTranslate.current.x += (targetX - currentTranslate.current.x) * 0.04;
      currentTranslate.current.y += (targetY - currentTranslate.current.y) * 0.04;

      if (parallaxRef.current) {
        parallaxRef.current.style.transform = `scale(${PARALLAX_SCALE}) translate3d(${currentTranslate.current.x}px, ${currentTranslate.current.y}px, 0)`;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isWallpaperEnabled]);

  const changeWallpaper = useCallback(
    (next: WallpaperOption, targetScope: "global" | "thread" = "global") => {
      if (next.url === wallpaper.url && !targetScope) return;
      setPrevWallpaper(wallpaper);
      setIsTransitioning(true);
      setWallpaper(next);

      if (targetScope === "thread" && threadId) {
        saveThreadWallpaper(threadId, next.url);
      } else {
        saveAgentWallpaperPreference(next.url);
      }

      setTimeout(() => {
        setPrevWallpaper(null);
        setIsTransitioning(false);
      }, 750);
    },
    [wallpaper, threadId],
  );

  const handleClearThreadWallpaper = useCallback(() => {
    if (!threadId) return;
    clearThreadWallpaper(threadId);
    setWallpaper(resolveWallpaperForThread(threadId));
  }, [threadId]);

  const handleDisableWallpaper = useCallback(() => {
    saveIsAgentWallpaperEnabled(false);
    setIsWallpaperEnabled(false);
  }, []);

  // If wallpaper is turned off, render purely children with zero extra icons or pills
  if (!isWallpaperEnabled) {
    return <>{children}</>;
  }

  const allAvailableWallpapers = getAllAgentWallpapers();

  return (
    <div
      ref={containerRef}
      data-agent-wallpaper="active"
      data-theme={resolvedTheme}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        isLight ? "theme-wallpaper-light" : "theme-wallpaper-dark",
      )}
    >
      {/* ── Layer 1: Base Wallpaper Image with Crossfade & Parallax (z-0) ── */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {prevWallpaper && (
          <div
            className={cn(
              "absolute inset-0 bg-cover bg-center transition-opacity duration-700",
              isTransitioning ? "opacity-0" : "opacity-100",
            )}
            style={{
              backgroundImage: `url(${prevWallpaper.url})`,
              transform: `scale(${PARALLAX_SCALE})`,
            }}
          />
        )}
        <div
          ref={parallaxRef}
          className="absolute inset-0 bg-cover bg-center will-change-transform"
          style={{
            backgroundImage: `url(${wallpaper.url})`,
            transform: `scale(${PARALLAX_SCALE})`,
          }}
        />
      </div>

      {/* ── Layer 2: Aesthetic Scrim Gradient (z-1) ── */}
      {/* Light Mode: Artwork visible at top, gently washing down into pure white canvas */}
      {/* Dark Mode: Deep neutral black vignette & depth mask */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-500"
        style={{
          background: isLight
            ? `
              radial-gradient(ellipse at 50% 25%, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.50) 45%, rgba(255, 255, 255, 0.92) 80%, #ffffff 100%),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.22) 25%, rgba(255, 255, 255, 0.88) 72%, #ffffff 100%)
            `
            : `
              radial-gradient(ellipse at 50% 45%, rgba(10, 12, 18, 0.65) 0%, rgba(5, 6, 10, 0.85) 100%),
              linear-gradient(to bottom, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.35) 45%, rgba(0, 0, 0, 0.80) 100%)
            `,
        }}
        aria-hidden="true"
      />

      {/* ── Layer 3: Animated Halftone Canvas from Startup Wizard (z-2) ──── */}
      <AnimatedHalftoneCanvas theme={resolvedTheme} />

      {/* ── Layer 3.5: Contrast Enhancement Veil for 100% Text Legibility (z-[3]) ── */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background: isLight ? "rgba(255, 255, 255, 0.18)" : "rgba(8, 10, 15, 0.28)",
          backdropFilter: "blur(0.5px)",
        }}
        aria-hidden="true"
      />

      {/* ── Layer 4: Chat Content (z-10) ─────────────────────────────────── */}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {/* ── Layer 5: WallpaperTopBar Controller (z-40) ────────── */}
      <div className="pointer-events-auto absolute bottom-3.5 right-4 z-40">
        <WallpaperTopBar
          activeWallpaperUrl={wallpaper.url}
          onSelectWallpaper={(wp) => changeWallpaper(wp, hasThreadSpecific ? "thread" : "global")}
          onOpenGallery={() => setIsGalleryOpen(true)}
          onDisableWallpaper={handleDisableWallpaper}
          isThreadSpecific={hasThreadSpecific}
          onClearThreadWallpaper={handleClearThreadWallpaper}
          theme={resolvedTheme}
          wallpapers={allAvailableWallpapers}
          dropDirection="up"
          showFilmstrip={false}
        />
      </div>

      {/* ── Full Wallpaper Gallery Modal (Portaled to document.body) ─────────── */}
      <WallpaperGalleryModal
        isOpen={isGalleryOpen}
        activeWallpaperUrl={wallpaper.url}
        threadId={threadId}
        isThreadSpecific={hasThreadSpecific}
        theme={resolvedTheme}
        onSelectWallpaper={(wp, scope) => {
          changeWallpaper(wp, scope);
          setIsGalleryOpen(false);
        }}
        onClearThreadWallpaper={handleClearThreadWallpaper}
        onDisableWallpaper={handleDisableWallpaper}
        onClose={() => setIsGalleryOpen(false)}
        wallpapers={allAvailableWallpapers}
      />
    </div>
  );
}
