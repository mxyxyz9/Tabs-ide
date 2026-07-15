import React, { useState, useEffect, useRef, useId } from "react";

/**
 * LoaderPaletteOptions — meme text + Solid Block dark-mode tone
 * ---------------------------------------------------------------
 * Two changes from the previous pass:
 *
 * 1. STATUS TEXT
 *    Replaced the generic "BUILDING WORKSPACE" style copy with
 *    actual dev-culture humor — the fake-progress-message genre
 *    popularized by things like SimCity's "Reticulating Splines."
 *    Each loader has its own curated list so switching between them
 *    still feels fresh.
 *
 * 2. SOLID BLOCK — DARK MODE TEXT COLOR
 *    Previously forced to pure white in both modes as a legibility
 *    fix. That fix was correct for LIGHT mode, but overcorrected for
 *    dark mode: the original (pre-fix) dark-mode text resolved to a
 *    near-black color, and against the *lightened* tile/word surface
 *    (white-tinted overlay on the indigo card) that near-black reads
 *    well — it was only broken where there was no lightened surface
 *    under it. So: Solid Block in dark mode now uses a deliberate
 *    near-black warm tone (`BLOCK_DARK_TEXT`) instead of white; Solid
 *    Block in light mode keeps white; Mono Quiet is untouched either
 *    way. If this isn't the exact tone you remembered, tell me and
 *    I'll adjust the hex directly rather than guess again.
 * ---------------------------------------------------------------
 */

const LOADERS = [
  { id: "glass", label: "Molten Glass" },
  { id: "solari", label: "Solari Grid" },
];
const PALETTES = [
  { id: "block", label: "Solid Block" },
  { id: "mono", label: "Mono Quiet" },
];
const MODES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

// Near-black with a warm/red undertone — used only for Solid Block
// text in dark mode. Not pure black: a touch of warmth keeps it from
// reading as flat/dead against the indigo.
const BLOCK_DARK_TEXT = "#1c0f0e";

function blockTone(mode) {
  return mode === "dark"
    ? { text: BLOCK_DARK_TEXT, captionOpacity: 0.85 }
    : { text: "#ffffff", captionOpacity: 0.75 };
}

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

function useLoopCycle(totalMs) {
  const [t, setT] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const tick = (now) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) % totalMs;
      setT(elapsed / totalMs);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [totalMs]);
  return t;
}

/* ============================ ROTATING STATUS LABEL ============================ */
function RotatingLabel({ messages, intervalMs = 2200, style }) {
  const [idx, setIdx] = useState(0);
  const [outgoing, setOutgoing] = useState(null);
  const idxRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const leaving = messages[idxRef.current];
      const next = (idxRef.current + 1) % messages.length;
      idxRef.current = next;
      setOutgoing(leaving);
      setIdx(next);
      const clearId = setTimeout(() => setOutgoing(null), 520);
      return () => clearTimeout(clearId);
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages, intervalMs]);

  return (
    <div className="rl-wrap" style={style}>
      {outgoing && (
        <span key={`out-${outgoing}`} className="rl-text rl-out">
          {outgoing}
        </span>
      )}
      <span key={`in-${messages[idx]}`} className="rl-text rl-in">
        {messages[idx]}
      </span>
    </div>
  );
}

/* ============================ MOLTEN GLASS ============================ */
function MoltenGlass({ mode, palette }) {
  const filterId = useId().replace(/:/g, "");
  const isBlock = palette === "block";
  const tone = isBlock ? blockTone(mode) : null;

  return (
    <div className={`stage mg-stage theme-${mode}`}>
      <div className={`mg-card ${isBlock ? "is-block" : ""}`}>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence type="fractalNoise" baseFrequency="0.02 0.09" numOctaves="2" seed="3" result="noise">
                <animate attributeName="baseFrequency" dur="6.75s" values="0.02 0.09;0.035 0.14;0.02 0.09" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>

        <div
          className="mg-word"
          style={{ filter: `url(#${filterId})`, color: isBlock ? tone.text : "var(--fg)" }}
        >
          TABS
        </div>

        <RotatingLabel
          messages={GLASS_MESSAGES}
          style={{
            color: isBlock ? tone.text : "var(--muted-fg)",
            opacity: isBlock ? tone.captionOpacity : 1,
          }}
        />
      </div>
    </div>
  );
}

/* ============================ SOLARI GRID ============================ */
const SOLARI_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ".split("");
function SolariTile({ target, index, isBlock, blockText }) {
  const [ch, setCh] = useState(target);
  const [justSettled, setJustSettled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const settleAt = 900 + index * 70;
    const iv = setInterval(() => { if (!cancelled) setCh(SOLARI_CHARS[Math.floor(Math.random() * SOLARI_CHARS.length)]); }, 70);
    const to = setTimeout(() => {
      clearInterval(iv);
      if (cancelled) return;
      setCh(target);
      setJustSettled(true);
      setTimeout(() => !cancelled && setJustSettled(false), 420);
    }, settleAt);
    return () => { cancelled = true; clearInterval(iv); clearTimeout(to); };
  }, [target, index]);

  const tileStyle = isBlock
    ? {
        background: justSettled ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
        color: blockText,
        borderColor: justSettled ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.24)",
        boxShadow: justSettled ? "0 0 0 1px rgba(255,255,255,0.9)" : "none",
      }
    : {
        background: "var(--tile-bg)",
        color: "var(--fg)",
        borderColor: justSettled ? "var(--primary)" : "var(--border)",
        boxShadow: justSettled ? "0 0 0 1px var(--primary)" : "none",
      };

  return (
    <div className="sg-tile" style={tileStyle}>
      {ch === " " ? "\u00A0" : ch}
    </div>
  );
}
function SolariGrid({ mode, palette }) {
  const t = useLoopCycle(3600);
  const cycleKey = Math.floor(t * 1.4);
  const word = "TABS IDE".padEnd(8, " ").split("");
  const isBlock = palette === "block";
  const tone = isBlock ? blockTone(mode) : null;

  return (
    <div className={`stage sg-stage theme-${mode}`}>
      <div className={`sg-card ${isBlock ? "is-block" : ""}`}>
        <div className="sg-grid" key={cycleKey}>
          {word.map((ch, i) => (
            <SolariTile key={i} target={ch} index={i} isBlock={isBlock} blockText={tone ? tone.text : undefined} />
          ))}
        </div>
        <RotatingLabel
          messages={SOLARI_MESSAGES}
          style={{
            color: isBlock ? tone.text : "var(--muted-fg)",
            opacity: isBlock ? tone.captionOpacity : 1,
          }}
        />
      </div>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');

  .root { position:relative; width:100%; min-height:600px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0a0a0b; overflow:hidden; border-radius:24px; font-family:'DM Sans Variable','DM Sans', ui-sans-serif, system-ui, sans-serif; padding:32px 16px; box-sizing:border-box; }

  .switcher-row { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:12px; }
  .pill { font-family: ui-monospace,'JetBrains Mono',monospace; font-size:11px; letter-spacing:.04em; color:#8a8a92; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); padding:7px 13px; border-radius:999px; cursor:pointer; transition: all .25s cubic-bezier(0.16, 1, 0.3, 1); }
  .pill:hover { color:#f2f2f5; border-color:rgba(255,255,255,.3); background:rgba(255,255,255,.08); }
  .pill.active { color:#0a0a0b; background:#f2f2f5; border-color:transparent; }
  .pill.group { font-size:12px; padding:9px 18px; }
  .pill.mode { font-size:10px; padding:5px 11px; }
  .spacer { height:12px; }

  .stage { position:relative; z-index:1; width:100%; max-width:560px; min-height:300px; display:flex; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; }

  /* theme tokens — mirrors the oklch/hex values from index.css */
  .theme-light { --bg:#ffffff; --card:#ffffff; --fg:#262626; --muted-fg:#6b6b6d; --border:rgba(0,0,0,.08); --shadow:0 18px 48px -20px rgb(0 0 0 / 28%); --primary: oklch(0.488 0.217 264); --tile-bg:rgba(0,0,0,.03); }
  .theme-dark { --bg:#0e0e11; --card:#131316; --fg:#f5f5f5; --muted-fg:#8f8f95; --border:rgba(255,255,255,.06); --shadow:0 18px 48px -20px rgb(0 0 0 / 60%); --primary: oklch(0.588 0.217 264); --tile-bg:rgba(255,255,255,.04); }

  /* MOLTEN GLASS */
  .mg-card { position:relative; width:100%; padding:56px 40px; border-radius:20px; overflow:hidden; background: var(--card); border:1px solid var(--border); box-shadow: var(--shadow); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; }
  .mg-card.is-block { background: var(--primary); border-color:transparent; }
  .mg-word { position:relative; z-index:1; font-weight:800; font-size:80px; letter-spacing:-.02em; }

  /* SOLARI GRID */
  .sg-card { position:relative; width:100%; padding:40px; border-radius:20px; overflow:hidden; background: var(--card); border:1px solid var(--border); box-shadow: var(--shadow); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; }
  .sg-card.is-block { background: var(--primary); border-color:transparent; }
  .sg-grid { position:relative; z-index:1; display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; }
  .sg-tile { position:relative; width:52px; height:64px; border:1px solid; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:700; transition: box-shadow .3s ease, border-color .3s ease, background .3s ease, color .3s ease; }
  .sg-tile::before { content:""; position:absolute; left:0; right:0; top:50%; height:1px; background: rgba(0,0,0,0.35); }

  /* ROTATING STATUS LABEL */
  .rl-wrap { position:relative; z-index:1; height:14px; width:100%; text-align:center; }
  .rl-text { position:absolute; left:0; right:0; font-size:11px; font-weight:600; letter-spacing:.22em; text-transform:uppercase; white-space:nowrap; }
  .rl-in { animation: rl-in .5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .rl-out { animation: rl-out .5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  @keyframes rl-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
  @keyframes rl-out { from { opacity:1; transform: translateY(0); } to { opacity:0; transform: translateY(-8px); } }

  @media (prefers-reduced-motion: reduce) {
    .root * { animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
  }
`;

export default function LoaderPaletteOptions() {
  const [loader, setLoader] = useState("glass");
  const [palette, setPalette] = useState("block");
  const [mode, setMode] = useState("dark");

  return (
    <div className="root">
      <style>{CSS}</style>

      <div className="switcher-row">
        {LOADERS.map((l) => (
          <button key={l.id} className={`pill group ${loader === l.id ? "active" : ""}`} onClick={() => setLoader(l.id)}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="switcher-row">
        {PALETTES.map((p) => (
          <button key={p.id} className={`pill ${palette === p.id ? "active" : ""}`} onClick={() => setPalette(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="switcher-row">
        {MODES.map((m) => (
          <button key={m.id} className={`pill mode ${mode === m.id ? "active" : ""}`} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="spacer" />

      {loader === "glass" && <MoltenGlass mode={mode} palette={palette} />}
      {loader === "solari" && <SolariGrid mode={mode} palette={palette} />}
    </div>
  );
}