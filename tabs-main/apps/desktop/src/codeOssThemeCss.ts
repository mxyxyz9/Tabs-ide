/**
 * Custom CSS injected into the embedded Code-OSS workbench (via
 * `webContents.insertCSS`) so EVERY visible surface inside the editor reads as a
 * cohesive, built-for-Tabs IDE rather than a reskinned VS Code. We re-map VS
 * Code's own `--vscode-*` design tokens (so colour cascades coherently) and then
 * restyle each surface — editor, editor tabs, sidebar, bottom panel, popups /
 * menus, notifications, the command palette, and the source-control view — with
 * Tabs' design language: near-black neutral surfaces, hairline white borders,
 * soft radii, generous spacing, and the app's blue primary accent.
 *
 * Palette is derived from the shell's dark tokens (apps/web/src/index.css):
 *   background ≈ neutral-950@95% (#141414)   foreground neutral-100 (#f5f5f5)
 *   card/popover ≈ background +2% white        border white/6%   radius 10px
 * The embed's accent is the app's own primary blue — oklch(0.588 0.217 264) ≈
 * #366ffb (see `--primary` in apps/web/src/index.css), so the editor reads as the
 * same product as the surrounding React shell rather than a separate cyan theme.
 * It is the single `--tabs-accent*` token group below, so retheming is one edit.
 *
 * Reliability note: VS Code's trees/lists (explorer, quick-open results) are
 * virtualised — row positions are computed in JS from a known row height — so we
 * deliberately do NOT hard-set row `height` from CSS (that desyncs the absolute
 * `top` offsets and overlaps rows). Row *density* is shaped via the matching
 * workbench settings instead (see `EMBED_CHROME_DEFAULTS` in the integration
 * extension); CSS here only restyles colour, spacing, icons and chrome.
 */
export const CODE_OSS_THEME_CSS =
  /* css */ `
/* ============================================================= TOKENS === */
.monaco-workbench {
  /* Neutral surfaces + the white-overlay scale below are the DARK defaults; the
     .monaco-workbench.vs block further down flips just these tokens to light
     values, so the editor follows the app's light/dark mode. Accent (blue) and
     every structural rule reference these tokens, so theming is data-only. */
  --tabs-bg: #141414;             /* shell background — editor surface */
  --tabs-bg-sidebar: #1a1a1a;     /* 2–3% lighter than the editor */
  --tabs-bg-elevated: #1f1f1f;    /* active tab / cards */
  --tabs-bg-popover: #181818;     /* menus, widgets, quick input */
  --tabs-input-bg: #1c1c1c;       /* inputs / select boxes */
  /* Overlay scale — white tints in dark mode (named by their dark alpha). */
  --tabs-ov-015: rgba(255,255,255,0.015);
  --tabs-ov-02: rgba(255,255,255,0.02);
  --tabs-ov-025: rgba(255,255,255,0.025);
  --tabs-ov-03: rgba(255,255,255,0.03);
  --tabs-ov-04: rgba(255,255,255,0.04);
  --tabs-ov-05: rgba(255,255,255,0.05);
  --tabs-ov-06: rgba(255,255,255,0.06);
  --tabs-ov-08: rgba(255,255,255,0.08);
  --tabs-ov-10: rgba(255,255,255,0.10);
  --tabs-ov-12: rgba(255,255,255,0.12);
  --tabs-ov-14: rgba(255,255,255,0.14);
  --tabs-ov-20: rgba(255,255,255,0.20);
  --tabs-ov-30: rgba(255,255,255,0.30);
  --tabs-hairline: var(--tabs-ov-06);
  --tabs-hairline-strong: var(--tabs-ov-10);
  --tabs-text: #ececec;
  --tabs-text-muted: #8a8a8a;
  --tabs-accent: #366ffb;        /* app --primary (oklch 0.588 0.217 264) */
  --tabs-accent-strong: #366ffb; /* primary button fill */
  --tabs-accent-soft: rgba(54,111,251,0.15);

  --vscode-font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;

  /* --- Editor / foreground --------------------------------------------- */
  --vscode-foreground: var(--tabs-text);
  --vscode-editor-background: var(--tabs-bg);
  --vscode-editor-foreground: var(--tabs-text);
  --vscode-editorLineNumber-foreground: var(--tabs-text-muted);
  --vscode-editorLineNumber-activeForeground: var(--tabs-text);
  --vscode-editorIndentGuide-background1: var(--tabs-hairline);
  --vscode-editorIndentGuide-activeBackground1: var(--tabs-hairline-strong);
  --vscode-editorCursor-foreground: var(--tabs-accent);
  --vscode-editor-lineHighlightBackground: var(--tabs-ov-03);
  --vscode-editor-lineHighlightBorder: transparent;
  --vscode-editor-selectionBackground: rgba(54,111,251,0.20);
  --vscode-editor-inactiveSelectionBackground: rgba(54,111,251,0.10);

  /* --- Surfaces --------------------------------------------------------- */
  --vscode-sideBar-background: var(--tabs-bg-sidebar);
  --vscode-sideBarSectionHeader-background: transparent;
  --vscode-sideBarTitle-foreground: var(--tabs-text-muted);
  --vscode-activityBar-background: var(--tabs-bg);
  --vscode-activityBar-foreground: var(--tabs-text);
  --vscode-activityBar-inactiveForeground: #5f5f5f;
  --vscode-panel-background: var(--tabs-bg-sidebar);
  --vscode-panelSectionHeader-background: transparent;
  --vscode-terminal-background: transparent;
  --vscode-statusBar-background: var(--tabs-bg);
  --vscode-statusBar-foreground: var(--tabs-text-muted);
  --vscode-statusBar-noFolderBackground: var(--tabs-bg);
  --vscode-titleBar-activeBackground: var(--tabs-bg);
  --vscode-titleBar-inactiveBackground: var(--tabs-bg);
  --vscode-titleBar-activeForeground: var(--tabs-text);
  --vscode-editorGroupHeader-tabsBackground: transparent;
  --vscode-editorGroupHeader-noTabsBackground: transparent;
  --vscode-tab-inactiveBackground: transparent;
  --vscode-tab-activeBackground: var(--tabs-bg-elevated);
  --vscode-tab-hoverBackground: var(--tabs-ov-04);
  --vscode-tab-activeForeground: var(--tabs-text);
  --vscode-tab-inactiveForeground: var(--tabs-text-muted);
  --vscode-breadcrumb-background: transparent;
  --vscode-menu-background: var(--tabs-bg-popover);
  --vscode-menu-foreground: var(--tabs-text);
  --vscode-quickInput-background: var(--tabs-bg-popover);
  --vscode-dropdown-background: var(--tabs-bg-popover);
  --vscode-input-background: var(--tabs-input-bg);
  --vscode-editorWidget-background: var(--tabs-bg-popover);
  --vscode-notifications-background: var(--tabs-bg-popover);
  --vscode-peekViewEditor-background: var(--tabs-bg);

  /* --- Borders ---------------------------------------------------------- */
  --vscode-sideBar-border: var(--tabs-hairline);
  --vscode-panel-border: var(--tabs-hairline);
  --vscode-activityBar-border: var(--tabs-hairline);
  --vscode-statusBar-border: var(--tabs-hairline);
  --vscode-titleBar-border: var(--tabs-hairline);
  --vscode-editorGroupHeader-tabsBorder: var(--tabs-hairline);
  --vscode-tab-border: transparent;
  --vscode-contrastBorder: transparent;
  --vscode-widget-border: var(--tabs-hairline-strong);
  --vscode-input-border: var(--tabs-hairline-strong);
  --vscode-menu-border: var(--tabs-hairline-strong);
  --vscode-editorWidget-border: var(--tabs-hairline-strong);
  --vscode-notifications-border: var(--tabs-hairline-strong);

  /* --- Accent / interaction -------------------------------------------- */
  --vscode-focusBorder: var(--tabs-accent);
  --vscode-inputOption-activeBorder: var(--tabs-accent);
  --vscode-activityBarBadge-background: var(--tabs-accent-strong);
  --vscode-activityBarBadge-foreground: #ffffff;
  --vscode-button-background: var(--tabs-accent-strong);
  --vscode-button-hoverBackground: #5189ff;
  --vscode-button-foreground: #ffffff;
  --vscode-progressBar-background: var(--tabs-accent);
  --vscode-textLink-foreground: #5189ff;
  --vscode-textLink-activeForeground: #88a9ff;
  --vscode-list-activeSelectionBackground: var(--tabs-accent-soft);
  --vscode-list-activeSelectionForeground: var(--tabs-text);
  --vscode-list-inactiveSelectionBackground: var(--tabs-ov-05);
  --vscode-list-hoverBackground: var(--tabs-ov-04);
  --vscode-list-focusOutline: transparent;
  --vscode-pickerGroup-foreground: #5189ff;
  --vscode-statusBarItem-remoteBackground: transparent;
  --vscode-statusBarItem-remoteForeground: var(--tabs-accent);
  --vscode-statusBarItem-hoverBackground: var(--tabs-ov-06);
  --vscode-statusBarItem-activeBackground: var(--tabs-ov-10);
  --vscode-statusBarItem-prominentForeground: var(--tabs-text);
  --vscode-statusBarItem-prominentBackground: var(--tabs-ov-08);
  --vscode-statusBarItem-prominentHoverBackground: var(--tabs-ov-14);
  --vscode-selection-background: rgba(54,111,251,0.28);

  /* --- Scrollbars ------------------------------------------------------- */
  --vscode-scrollbar-shadow: transparent;
  --vscode-scrollbarSlider-background: var(--tabs-ov-12);
  --vscode-scrollbarSlider-hoverBackground: var(--tabs-ov-20);
  --vscode-scrollbarSlider-activeBackground: var(--tabs-ov-30);
}

/* --- Per-Theme Token Overrides ------------------------------------ */
[data-theme="tabs-dark"] .monaco-workbench,
.monaco-workbench[data-theme="tabs-dark"],
html[data-theme="tabs-dark"] .monaco-workbench,
body[data-theme="tabs-dark"] .monaco-workbench {
  --tabs-bg: #141414;
  --tabs-bg-sidebar: #181818;
  --tabs-bg-elevated: #1f1f1f;
  --tabs-bg-popover: #181818;
  --tabs-input-bg: #1c1c1c;
  --tabs-text: #f5f5f5;
  --tabs-text-muted: #a3a3a3;
  --tabs-accent: #366ffb;
  --tabs-accent-strong: #366ffb;
}

[data-theme="true-black"] .monaco-workbench,
.monaco-workbench[data-theme="true-black"],
html[data-theme="true-black"] .monaco-workbench,
body[data-theme="true-black"] .monaco-workbench {
  --tabs-bg: #000000;
  --tabs-bg-sidebar: #050505;
  --tabs-bg-elevated: #0d0d0d;
  --tabs-bg-popover: #0a0a0a;
  --tabs-input-bg: #0f0f0f;
  --tabs-text: #ffffff;
  --tabs-text-muted: #888888;
  --tabs-accent: #366ffb;
  --tabs-accent-strong: #366ffb;
}

[data-theme="tabs-light"] .monaco-workbench,
.monaco-workbench[data-theme="tabs-light"],
html[data-theme="tabs-light"] .monaco-workbench,
body[data-theme="tabs-light"] .monaco-workbench {
  --tabs-bg: #ffffff;
  --tabs-bg-sidebar: #f6f5f2;
  --tabs-bg-elevated: #ffffff;
  --tabs-bg-popover: #ffffff;
  --tabs-input-bg: #f0eee9;
  --tabs-text: #3a3936;
  --tabs-text-muted: #73726d;
  --tabs-accent: #366ffb;
  --tabs-accent-strong: #366ffb;
}

[data-theme="abyss"] .monaco-workbench,
.monaco-workbench[data-theme="abyss"],
html[data-theme="abyss"] .monaco-workbench,
body[data-theme="abyss"] .monaco-workbench {
  --tabs-bg: #000c18;
  --tabs-bg-sidebar: #001122;
  --tabs-bg-elevated: #041930;
  --tabs-bg-popover: #041930;
  --tabs-input-bg: #072240;
  --tabs-text: #bec8da;
  --tabs-text-muted: #667898;
  --tabs-accent: #007acc;
  --tabs-accent-strong: #007acc;
}

[data-theme="dracula"] .monaco-workbench,
.monaco-workbench[data-theme="dracula"],
html[data-theme="dracula"] .monaco-workbench,
body[data-theme="dracula"] .monaco-workbench {
  --tabs-bg: #282a36;
  --tabs-bg-sidebar: #21222c;
  --tabs-bg-elevated: #343746;
  --tabs-bg-popover: #343746;
  --tabs-input-bg: #44475a;
  --tabs-text: #f8f8f2;
  --tabs-text-muted: #6272a4;
  --tabs-accent: #bd93f9;
  --tabs-accent-strong: #bd93f9;
}

[data-theme="deep-blue"] .monaco-workbench,
.monaco-workbench[data-theme="deep-blue"],
html[data-theme="deep-blue"] .monaco-workbench,
body[data-theme="deep-blue"] .monaco-workbench {
  --tabs-bg: #0f172a;
  --tabs-bg-sidebar: #0b1120;
  --tabs-bg-elevated: #1e293b;
  --tabs-bg-popover: #1e293b;
  --tabs-input-bg: #334155;
  --tabs-text: #f8fafc;
  --tabs-text-muted: #64748b;
  --tabs-accent: #38bdf8;
  --tabs-accent-strong: #38bdf8;
}

[data-theme="solarized-light"] .monaco-workbench,
.monaco-workbench[data-theme="solarized-light"],
html[data-theme="solarized-light"] .monaco-workbench,
body[data-theme="solarized-light"] .monaco-workbench {
  --tabs-bg: #fdf6e3;
  --tabs-bg-sidebar: #eee8d5;
  --tabs-bg-elevated: #fdf6e3;
  --tabs-bg-popover: #eee8d5;
  --tabs-input-bg: #eee8d5;
  --tabs-text: #657b83;
  --tabs-text-muted: #93a1a1;
  --tabs-accent: #2aa198;
  --tabs-accent-strong: #2aa198;
}

[data-theme="custom"] .monaco-workbench,
.monaco-workbench[data-theme="custom"],
html[data-theme="custom"] .monaco-workbench,
body[data-theme="custom"] .monaco-workbench {
  --tabs-bg-popover: var(--tabs-bg-elevated, var(--tabs-bg-sidebar, #181818));
  --tabs-input-bg: var(--tabs-bg-elevated, var(--tabs-bg-sidebar, #1c1c1c));
  --tabs-text-muted: color-mix(in srgb, var(--tabs-text, #ffffff) 65%, transparent);
  --tabs-accent-strong: var(--tabs-accent, #366ffb);
}

/* ===================================================== LIGHT THEME === */
/* When the embedded workbench is in a light color theme (VS Code marks the
   workbench with the .vs class; dark is .vs-dark), flip ONLY the neutral
   surface + overlay tokens to light values. Every --vscode-* mapping and every
   structural rule references these tokens, so the whole editor follows the app's
   light mode with this one block — the accent (blue) stays shared. */
.monaco-workbench.vs {
  --tabs-bg: #ffffff;
  --tabs-bg-sidebar: #f6f6f6;
  --tabs-bg-elevated: #ffffff;
  --tabs-bg-popover: #ffffff;
  --tabs-input-bg: #ffffff;
  --tabs-ov-015: rgba(0,0,0,0.03);
  --tabs-ov-02: rgba(0,0,0,0.035);
  --tabs-ov-025: rgba(0,0,0,0.04);
  --tabs-ov-03: rgba(0,0,0,0.04);
  --tabs-ov-04: rgba(0,0,0,0.05);
  --tabs-ov-05: rgba(0,0,0,0.06);
  --tabs-ov-06: rgba(0,0,0,0.08);
  --tabs-ov-08: rgba(0,0,0,0.09);
  --tabs-ov-10: rgba(0,0,0,0.12);
  --tabs-ov-12: rgba(0,0,0,0.14);
  --tabs-ov-14: rgba(0,0,0,0.16);
  --tabs-ov-20: rgba(0,0,0,0.22);
  --tabs-ov-30: rgba(0,0,0,0.32);
  --tabs-text: #262626;
  --tabs-text-muted: #5f5f5f;
  --vscode-textLink-foreground: #2563eb;
  --vscode-textLink-activeForeground: #1d4ed8;
  --vscode-pickerGroup-foreground: #2563eb;
  --vscode-activityBar-inactiveForeground: #8a8a8a;
}
/* Editor glows/selections that hardcode blue alpha read fine on white, but the
   cursor glow + line-highlight want the light overlay; those already use tokens.
   A couple of shadows are softened so popovers don't look heavy on white. */
.monaco-workbench.vs .quick-input-widget,
.monaco-workbench.vs .monaco-dialog-box,
.monaco-workbench.vs .notifications-center,
.monaco-workbench.vs .notifications-toasts .notification-toast,
.monaco-workbench.vs .context-view .monaco-menu-container,
.monaco-workbench.vs .monaco-editor .suggest-widget,
.monaco-workbench.vs .monaco-editor .monaco-hover {
  box-shadow: 0 8px 28px rgba(0,0,0,0.14) !important;
}

/* UI chrome uses the UI font; the code editor keeps its own mono font. */
.monaco-workbench .part:not(.editor) {
  font-family: var(--vscode-font-family);
}

/* ===================================================== ACTIVITY BAR === */
/* The stock activity bar and title bar are hidden via workbench settings (see
   EMBED_CHROME_DEFAULTS) because Tabs renders its own native React chrome
   (activity rail / header) in the gutters around this embedded view. The native
   STATUS BAR is intentionally kept (and themed below) so extension-contributed
   items can render. Defensive CSS in case a future VS Code build still paints a
   sliver: collapse them so they can never leave a gap beside the React chrome. */
.monaco-workbench .part.activitybar,
.monaco-workbench .part.titlebar,
.monaco-workbench .part.banner {
  display: none !important;
}

/* Backstop for the reserved-grid-column gap: when a settings race leaves the
   activity-bar column allocated, display:none alone does not reclaim the cell.
   Force the part to zero width so the sidebar is not pushed right by an empty
   48px gutter. The authoritative reclaim is the
   workbench.activityBar.location=hidden setting once the workbench boots; this
   only papers over the gap if that races. */
.monaco-workbench .part.activitybar {
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  overflow: hidden !important;
}
/* Collapse the secondary (auxiliary) side bar entirely — Tabs renders its OWN
   native React AI side chat (a compact Agents chat) to the right of the editor,
   so VS Code's auxiliary bar (which would host GitHub Copilot's "Build with
   Agent" panel) must never paint. */
.monaco-workbench .part.auxiliarybar {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
}
/* Pull the sidebar flush-left in case the grid kept the activity-bar offset. */
.monaco-workbench .part.sidebar {
  left: 0 !important;
}

/* ========================================================= STATUS BAR === */
/* The native status bar is kept visible (it hosts extension-contributed items
   like Live Server's "Go Live"); theme it to match the app — a quiet hairline
   strip with rounded, hover-revealed items in the app's muted palette. */
.monaco-workbench .part.statusbar {
  border-top: 1px solid var(--tabs-hairline) !important;
  background: var(--tabs-bg) !important;
  font-size: 12px;
}
.monaco-workbench .statusbar .statusbar-item > a,
.monaco-workbench .statusbar .statusbar-item > span {
  border-radius: 5px;
}
.monaco-workbench .statusbar .statusbar-item a.statusbar-item-label:hover {
  border-radius: 5px;
}
/* The remote/host indicator (left edge) is just text in our palette, no pill. */
.monaco-workbench .statusbar .statusbar-item.has-background-color {
  border-radius: 5px;
}

/* ====================================================== EDITOR AREA === */
/* Tabs editor typography (the font itself is set via editor.fontFamily so Monaco
   measures glyphs correctly; this keeps line-height in sync defensively). */
.monaco-workbench .part.editor .monaco-editor,
.monaco-workbench .part.editor .monaco-editor .view-lines {
  --vscode-editorCodeLens-lineHeight: 1.6;
}
/* Thin 1.5px accent line cursor. */
.monaco-workbench .monaco-editor .cursor {
  width: 1.5px !important;
  background: var(--tabs-accent) !important;
  border-color: var(--tabs-accent) !important;
  box-shadow: 0 0 6px rgba(54,111,251,0.4);
}
/* Muted, low-contrast line numbers. */
.monaco-workbench .monaco-editor .margin-view-overlays .line-numbers {
  opacity: 0.35;
}
.monaco-workbench .monaco-editor .margin-view-overlays .line-numbers.active-line-number {
  opacity: 0.7;
}
/* Very subtle current-line highlight (no hard border). */
.monaco-workbench .monaco-editor .view-overlays .current-line,
.monaco-workbench .monaco-editor .margin-view-overlays .current-line-margin {
  background: var(--tabs-ov-03) !important;
  border: none !important;
}
/* Soft-glow selection rather than a harsh block. */
.monaco-workbench .monaco-editor .selected-text {
  background: rgba(54,111,251,0.18) !important;
  border-radius: 2px;
}
/* Quiet indent guides. */
.monaco-workbench .monaco-editor .core-guide-indent,
.monaco-workbench .monaco-editor .indent-guide {
  opacity: 0.15;
}
.monaco-workbench .monaco-editor .core-guide-indent.indent-active {
  opacity: 0.4;
}
/* Calm minimap: dimmed, borderless. */
.monaco-workbench .monaco-editor .minimap {
  opacity: 0.4;
}
.monaco-workbench .monaco-editor .minimap,
.monaco-workbench .monaco-editor .minimap-shadow-visible,
.monaco-workbench .monaco-editor .minimap-decorations-layer {
  border: none !important;
  box-shadow: none !important;
}
/* The VS Code logo / key-tips watermark in an empty editor group — gone. */
.monaco-workbench .editor-group-watermark,
.monaco-workbench .editor-group-container > .editor-group-watermark {
  display: none !important;
}

/* ======================================================= EDITOR TABS === */
/* Modern, separated "card" tabs (Cursor/Linear-style): each tab is a fully
   rounded pill floating on a transparent bar; the active one lifts with an
   elevated surface, a hairline ring and a thin accent top edge. */
.monaco-workbench .editor-group-container > .title {
  background: transparent !important;
  border-bottom: 1px solid var(--tabs-hairline);
  padding: 0 4px;
  overflow: visible !important;
}
.monaco-workbench .breadcrumbs-control,
.monaco-workbench .editor-group-container > .title .monaco-breadcrumbs {
  display: none !important;
}
/* Each tab item container */
.monaco-workbench .tabs-container > .tab {
  position: relative !important;
  margin: 0 2px 0 0 !important;
  padding: 0 14px !important;
  height: calc(100% - 2px) !important;
  min-height: 27px !important;
  border-radius: 6px 6px 0 0 !important;
  border: none !important;
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
  border-bottom: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: center !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  --vscode-tab-activeBorderTop: transparent !important;
  --vscode-tab-activeBorder: transparent !important;
  transition:
    background 120ms ease,
    opacity 120ms ease,
    box-shadow 120ms ease;
}
/* Inactive tabs: flat background, quiet muted text, no outline or shadow */
.monaco-workbench .tabs-container > .tab:not(.active) {
  background: transparent !important;
  border-radius: 6px 6px 0 0 !important;
  border: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.monaco-workbench .tabs-container > .tab:not(.active) .tab-label {
  opacity: 0.55 !important;
  font-weight: 500 !important;
}
.monaco-workbench .tabs-container > .tab:not(.active) .monaco-icon-label::before {
  opacity: 0.65 !important;
}
.monaco-workbench .tabs-container > .tab:not(.active):hover {
  background: var(--tabs-ov-04) !important;
  border-radius: 6px 6px 0 0 !important;
}
.monaco-workbench .tabs-container > .tab:not(.active):hover .tab-label {
  opacity: 0.85 !important;
}
/* Active tab: raised card pill with 8px rounded top corners and upward shadow */
.monaco-workbench .tabs-container > .tab.active {
  margin: 0 2px 0 0 !important;
  height: 100% !important;
  border-radius: 8px 8px 0 0 !important;
  background: var(--tabs-bg-elevated) !important;
  border: none !important;
  border-color: transparent !important;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3) !important;
  z-index: 2 !important;
}
.monaco-workbench.vs .tabs-container > .tab.active {
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08) !important;
}
.monaco-workbench .tabs-container > .tab.active .tab-label {
  opacity: 1 !important;
  font-weight: 500 !important;
  color: var(--tabs-text) !important;
}
.monaco-workbench .tabs-container > .tab.active .monaco-icon-label::before {
  opacity: 1 !important;
}
/* Completely suppress top blue accent borders, corner cutouts, and indicators across all VS Code tab states */
.monaco-workbench .tabs-container > .tab .tab-border-top,
.monaco-workbench .tabs-container > .tab > .tab-border-top,
.monaco-workbench .tabs-container > .tab .tab-border-bottom,
.monaco-workbench .tabs-container > .tab > .tab-border-bottom,
.monaco-workbench .tabs-container > .tab::before,
.monaco-workbench .tabs-container > .tab::after,
.monaco-workbench .tabs-container > .tab:hover::before,
.monaco-workbench .tabs-container > .tab:hover::after,
.monaco-workbench .tabs-container > .tab.active::before,
.monaco-workbench .tabs-container > .tab.active::after,
.monaco-workbench .tabs-container > .tab .monaco-icon-label-container::after {
  display: none !important;
  height: 0 !important;
  opacity: 0 !important;
  visibility: hidden !important;
  background: transparent !important;
  border: none !important;
  content: none !important;
  box-shadow: none !important;
}

/* Tab text and file icon vertical alignment inside the tab pill. */
.monaco-workbench .tabs-container > .tab .tab-label,
.monaco-workbench .tabs-container > .tab .monaco-icon-label,
.monaco-workbench .tabs-container > .tab .monaco-icon-label-container {
  display: flex !important;
  align-items: center !important;
  height: 100% !important;
  line-height: 1 !important;
  margin: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  font-size: 12.5px !important;
}
.monaco-workbench .tabs-container > .tab .monaco-icon-label::before {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 100% !important;
  line-height: 1 !important;
  margin-right: 6px !important;
  vertical-align: middle !important;
}
.monaco-workbench .tabs-container > .tab .monaco-icon-label .label-name {
  display: inline-flex !important;
  align-items: center !important;
  line-height: 1 !important;
  height: 100% !important;
}

/* Close button container & action icon alignment inside tab pill. */
.monaco-workbench .tabs-container > .tab .tab-actions {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 100% !important;
  position: relative !important;
  top: 0 !important;
  bottom: 0 !important;
  margin-left: 4px !important;
  opacity: 0;
  transition: opacity 120ms ease;
}
.monaco-workbench .tabs-container > .tab:hover .tab-actions,
.monaco-workbench .tabs-container > .tab.active .tab-actions,
.monaco-workbench .tabs-container > .tab.dirty .tab-actions {
  opacity: 1;
}
.monaco-workbench .tabs-container > .tab .tab-actions .monaco-action-bar,
.monaco-workbench .tabs-container > .tab .tab-actions .actions-container,
.monaco-workbench .tabs-container > .tab .tab-actions .action-item {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}
.monaco-workbench .tabs-container > .tab .tab-actions .action-label {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 18px !important;
  height: 18px !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: 4px !important;
  font-size: 12px !important;
  line-height: 1 !important;
  box-sizing: border-box !important;
  text-align: center !important;
  position: relative !important;
}
.monaco-workbench .tabs-container > .tab .tab-actions .action-label::before {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  height: 100% !important;
  line-height: 1 !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Tab SCM modification indicators ("M", "U", "D") and suffix alignment */
.monaco-workbench .tabs-container > .tab .monaco-icon-label-container > .monaco-icon-suffix-container,
.monaco-workbench .tabs-container > .tab .monaco-icon-label-container > .monaco-icon-suffix-container > .label-suffix,
.monaco-workbench .tabs-container > .tab .monaco-icon-label-container > .monaco-icon-description-container > .label-description,
.monaco-workbench .tabs-container > .tab .monaco-icon-label::after,
.monaco-workbench .tabs-container > .tab .monaco-icon-label-container::after {
  display: inline-flex !important;
  align-items: center !important;
  height: 100% !important;
  line-height: 1 !important;
  margin: 0 0 0 5px !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  vertical-align: middle !important;
}

/* Tab count badge / decoration positioning fix (Issue D) */
.monaco-workbench .tabs-container > .tab .monaco-count-badge,
.monaco-workbench .tabs-container > .tab .badge,
.monaco-workbench .tabs-container > .tab .tab-badge {
  position: static !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  align-self: center !important;
  margin-left: 6px !important;
  margin-right: 2px !important;
  height: 16px !important;
  min-width: 16px !important;
  line-height: 1 !important;
  font-size: 10px !important;
  font-weight: 600 !important;
  padding: 1px 5px !important;
  border-radius: 999px !important;
  background: var(--vscode-badge-background) !important;
  color: var(--vscode-badge-foreground) !important;
  border: none !important;
  box-sizing: border-box !important;
}

/* ============================================================ SIDEBAR === */
/* NOTE: Do NOT add padding or margin to .part.sidebar itself — VS Code's JS
   layout computes the content area from the allocated grid height and never
   reads CSS box-model properties. Padding/margin would push content outside
   the JS-allocated clip area. Visual spacing goes on CHILD elements. */
/* Section headers (EXPLORER, SEARCH, …) — match the shell's section-label style. */
.monaco-workbench .pane-header {
  text-transform: uppercase;
}
.monaco-workbench .pane-header .title {
  font-size: 10px;
  letter-spacing: 0.12em;
  font-weight: 600;
  opacity: 0.45;
  color: var(--tabs-text);
}
/* Defensive rule for the viewlet title bar ("EXPLORER" / "SEARCH" / ...).
   In the current embed configuration, .part.sidebar > .title is NOT rendered
   (the sidebar has hasTitle = false). This rule is kept as a defensive
   fallback in case a future VS Code build re-enables the title element. */
.monaco-workbench .part.sidebar > .title {
  height: 35px;
  padding-top: 6px;
}
.monaco-workbench .part.sidebar > .title > .title-label h2 {
  font-size: 11px;
  letter-spacing: 0.08em;
  opacity: 0.5;
}
/* Explorer header as TWO rows, Cursor-style: the action toolbar (new file / new
   folder / refresh / collapse) is a CENTERED row on top, the folder name below,
   then the file tree. The action row is ABSOLUTELY positioned (taken out of the
   flex flow) and the header reserves space for it with padding-top — so the
   bottom row (chevron + folder name) is a normal single line that truncates,
   rather than flex-wrapping the chevron onto its own line for long workspace
   names. Auto height is safe because .pane is a flex column with .pane-body
   { flex: 1 } (the tree just shrinks). */
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header {
  position: relative;
  height: auto !important;
  min-height: 52px;
  align-items: center;
  padding: 30px 8px 4px;
}
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .actions {
  position: absolute !important;
  top: 5px;
  left: 0;
  right: 0;
  margin: 0 !important;
  display: flex !important;
  justify-content: center !important;
}
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .actions .monaco-action-bar {
  width: auto;
}
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .actions .actions-container {
  display: flex !important;
  justify-content: center !important;
  gap: 18px;
}
/* Second row = [collapse chevron] + [folder name]. The chevron (twistie) and the
   title must share ONE line: the title is flex:1 with min-width:0 so it shrinks
   and ellipsises in place instead of wrapping the chevron onto its own line (the
   bug with long workspace names). The view icon next to the name is hidden — like
   Cursor, the row is just a chevron + the folder name. */
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .monaco-twistie,
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .twisty-container,
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .codicon {
  flex: 0 0 auto;
}
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .icon {
  display: none !important;
}
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  opacity: 0.7;
}
/* Centered, slightly larger action icons in the explorer's top toolbar row. */
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .actions .action-label {
  border-radius: 6px;
  padding: 5px;
}
.monaco-workbench .part.sidebar .pane:has(.explorer-folders-view) > .pane-header > .actions .action-label.codicon {
  font-size: 17px;
}
/* Single-view explorer (Outline + Timeline deselected via the "…" menu): VS Code
   MERGES the folder view into the sidebar's composite title — the folder name
   with the action toolbar inline, and NO "EXPLORER" label or bottom gap. This is
   the cleanest layout; space + size its icons to match the multi-view row so the
   two states look consistent. */
.monaco-workbench .part.sidebar > .title .title-actions .actions-container {
  gap: 16px;
}
.monaco-workbench .part.sidebar > .title .title-actions .action-label {
  border-radius: 6px;
  padding: 5px;
}
.monaco-workbench .part.sidebar > .title .title-actions .action-label.codicon {
  font-size: 17px;
}
/* Smaller, calmer file/folder icons in the tree. */
.monaco-workbench .part.sidebar .monaco-icon-label::before {
  font-size: 14px;
  width: 14px;
  height: 16px;
  background-size: 14px;
}
/* Clean, full-width rows: soft cyan fill + a thin left accent on selection. */
.monaco-workbench .part.sidebar .monaco-list-row {
  border-radius: 0;
}
.monaco-workbench .part.sidebar .monaco-list .monaco-list-row.selected,
.monaco-workbench .part.sidebar .monaco-list .monaco-list-row.focused {
  box-shadow: none !important;
  outline: none !important;
}
.monaco-workbench .part.sidebar .monaco-list .monaco-list-row.selected {
  background: var(--tabs-accent-soft);
  color: var(--tabs-text);
  box-shadow: inset 2px 0 0 0 var(--tabs-accent) !important;
}
.monaco-workbench .part.sidebar .monaco-list:focus .monaco-list-row.focused {
  background: var(--tabs-ov-04);
}

/* ====================================================== BOTTOM PANEL === */
/* Terminal / output / problems: same surface as the sidebar, tabs styled like
   the editor tabs, transparent terminal, hairline resize sash. */
.monaco-workbench .part.panel > .title {
  background: transparent !important;
  border-bottom: 1px solid var(--tabs-hairline);
}
.monaco-workbench .part.panel .tabs-container > .tab,
.monaco-workbench .part.panel .panel-switcher-container .action-item {
  border-radius: 8px 8px 0 0;
  border: none !important;
}
.monaco-workbench .part.panel .tabs-container > .tab.active,
.monaco-workbench .part.panel .panel-switcher-container .action-item.checked {
  box-shadow: inset 0 1.5px 0 0 var(--tabs-accent);
}
.monaco-workbench .part.panel .terminal-outer-container,
.monaco-workbench .part.panel .terminal-wrapper,
.monaco-workbench .part.panel .xterm-viewport {
  background: transparent !important;
}
/* Barely-visible 1px panel resize handle. */
.monaco-workbench .monaco-sash.horizontal,
.monaco-workbench .monaco-sash.vertical {
  --vscode-sash-hoverBorder: var(--tabs-accent);
}
.monaco-workbench .part.panel > .composite.title + .monaco-sash,
.monaco-workbench .monaco-sash:not(:hover):not(.active)::before {
  opacity: 0.4;
}

/* ============================================ INPUTS / WIDGETS / MENUS === */
/* Popups, dropdowns and context menus: shell popover surface, hairline border,
   8px radius, soft elevation. */
.monaco-workbench .monaco-menu .monaco-action-bar.vertical,
.monaco-workbench .context-view .monaco-menu-container,
.monaco-workbench .monaco-hover,
.monaco-workbench .editor-widget.find-widget,
.monaco-workbench .monaco-editor .suggest-widget {
  border-radius: 8px !important;
  overflow: hidden;
  border: 1px solid var(--tabs-hairline-strong) !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.monaco-workbench .context-view .monaco-menu-container .action-item:hover .action-label,
.monaco-workbench .context-view .monaco-menu-container .action-item.focused .action-label {
  background: var(--tabs-accent-soft) !important;
  color: var(--tabs-text) !important;
  border-radius: 6px;
}
.monaco-workbench .monaco-inputbox,
.monaco-workbench .monaco-select-box,
.monaco-workbench .monaco-button,
.monaco-workbench .monaco-text-button {
  border-radius: 8px !important;
}
.monaco-workbench .monaco-list-row {
  border-radius: 6px;
}

/* Notifications / toasts: match the shell card — 10px radius, hairline, blur. */
.monaco-workbench .notifications-toasts .notification-toast,
.monaco-workbench .notifications-list-container .notification-list-item {
  border-radius: 10px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  background: color-mix(in srgb, var(--tabs-bg-popover) 86%, transparent) !important;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  overflow: hidden;
}

/* Command palette / quick open: a centered modal overlay matching the shell's
   dialog — widened, rounded, elevated. (Row heights are left to VS Code's own
   virtualisation; see the reliability note at the top of this file.) */
.monaco-workbench .quick-input-widget {
  width: 620px !important;
  max-width: 82vw !important;
  margin-left: -310px !important;
  left: 50% !important;
  top: 96px !important;
  border-radius: 12px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  overflow: hidden;
}
.monaco-workbench .quick-input-widget .quick-input-box .monaco-inputbox {
  border-radius: 8px !important;
  font-family: var(--vscode-font-family);
}
.monaco-workbench .quick-input-list .monaco-list-row {
  border-radius: 8px;
}
.monaco-workbench .quick-input-list .monaco-list-row.focused {
  background: var(--tabs-accent-soft) !important;
  color: var(--tabs-text) !important;
}

/* ===================================== SOURCE CONTROL (GIT) VIEW === */
/* Rounded, card-like commit message box with a clear focus ring. */
.monaco-workbench .scm-view .scm-editor-container {
  border-radius: 10px;
  border: 1px solid var(--tabs-hairline-strong);
  background: var(--tabs-bg-elevated);
  padding: 2px 4px;
}
.monaco-workbench .scm-view .scm-editor-container.synthetic-focus,
.monaco-workbench .scm-view .scm-editor-container:focus-within {
  border-color: var(--tabs-accent);
}
/* Resource group headers (Staged / Changes): quieter, uppercase, with a pill count. */
.monaco-workbench .scm-view .scm-provider > .header,
.monaco-workbench .scm-view .resource-group > .monaco-list-row .name {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 11px;
  color: var(--tabs-text-muted);
}
.monaco-workbench .scm-view .monaco-count-badge {
  background: var(--tabs-ov-08);
  color: var(--tabs-text);
  border-radius: 999px;
  padding: 0 7px;
}
/* Change rows: roomier with a soft cyan selection (consistent with the tree). */
.monaco-workbench .scm-view .monaco-list-row {
  border-radius: 6px;
}
.monaco-workbench .scm-view .monaco-list .monaco-list-row.selected {
  background: var(--tabs-accent-soft);
  box-shadow: inset 2px 0 0 0 var(--tabs-accent) !important;
}
/* The primary Commit button reads as a Tabs accent button. */
.monaco-workbench .scm-view .monaco-button.monaco-text-button {
  border-radius: 8px !important;
  font-weight: 600;
}

/* ============================================ EXTRA TOKENS === */
/* Second token pass for the deeper surfaces (settings editor, extensions,
   dropdowns, checkboxes, badges) so they cascade in-palette before the
   structural rules below refine them. */
.monaco-workbench {
  --vscode-dropdown-foreground: var(--tabs-text);
  --vscode-dropdown-border: var(--tabs-hairline-strong);
  --vscode-dropdown-listBackground: var(--tabs-bg-popover);
  --vscode-checkbox-background: var(--tabs-input-bg);
  --vscode-checkbox-foreground: var(--tabs-accent);
  --vscode-checkbox-border: var(--tabs-hairline-strong);
  --vscode-checkbox-selectBackground: var(--tabs-accent-soft);
  --vscode-checkbox-selectBorder: var(--tabs-accent);
  --vscode-settings-headerForeground: var(--tabs-text);
  --vscode-settings-headerBorder: var(--tabs-hairline);
  --vscode-settings-rowHoverBackground: var(--tabs-ov-02);
  --vscode-settings-focusedRowBackground: var(--tabs-ov-03);
  --vscode-settings-focusedRowBorder: var(--tabs-accent);
  --vscode-settings-modifiedItemIndicator: var(--tabs-accent);
  --vscode-settings-dropdownBackground: var(--tabs-bg-popover);
  --vscode-settings-dropdownBorder: var(--tabs-hairline-strong);
  --vscode-settings-checkboxBackground: var(--tabs-input-bg);
  --vscode-settings-checkboxBorder: var(--tabs-hairline-strong);
  --vscode-settings-textInputBackground: var(--tabs-input-bg);
  --vscode-settings-textInputBorder: var(--tabs-hairline-strong);
  --vscode-settings-numberInputBackground: var(--tabs-input-bg);
  --vscode-settings-numberInputBorder: var(--tabs-hairline-strong);
  --vscode-keybindingLabel-background: var(--tabs-ov-06);
  --vscode-keybindingLabel-foreground: var(--tabs-text);
  --vscode-keybindingLabel-border: var(--tabs-hairline);
  --vscode-keybindingLabel-bottomBorder: var(--tabs-hairline);
  --vscode-badge-background: var(--tabs-ov-08);
  --vscode-badge-foreground: var(--tabs-text);
  --vscode-extensionButton-prominentBackground: var(--tabs-accent-strong);
  --vscode-extensionButton-prominentForeground: #ffffff;
  --vscode-extensionButton-background: var(--tabs-ov-06);
  --vscode-extensionButton-foreground: var(--tabs-text);
  --vscode-extensionBadge-remoteBackground: var(--tabs-accent-strong);
  --vscode-toolbar-hoverBackground: var(--tabs-ov-06);
  --vscode-toolbar-activeBackground: var(--tabs-ov-10);
  --vscode-welcomePage-tileBackground: var(--tabs-bg-elevated);
  --vscode-welcomePage-tileHoverBackground: #242424;
  --vscode-welcomePage-tileBorder: var(--tabs-hairline);
  --vscode-walkThrough-embeddedEditorBackground: var(--tabs-bg);
  --vscode-textBlockQuote-background: var(--tabs-ov-03);
  --vscode-textBlockQuote-border: var(--tabs-accent);
  --vscode-textCodeBlock-background: var(--tabs-ov-05);
  --vscode-editorHoverWidget-background: var(--tabs-bg-popover);
  --vscode-editorHoverWidget-border: var(--tabs-hairline-strong);
  --vscode-editorSuggestWidget-background: var(--tabs-bg-popover);
  --vscode-editorSuggestWidget-border: var(--tabs-hairline-strong);
  --vscode-editorSuggestWidget-selectedBackground: var(--tabs-accent-soft);
  --vscode-editorSuggestWidget-selectedForeground: var(--tabs-accent);
  --vscode-editorSuggestWidget-highlightForeground: var(--tabs-accent);
  --vscode-peekViewTitle-background: var(--tabs-bg-elevated);
  --vscode-peekViewResult-background: var(--tabs-bg-sidebar);
  --vscode-peekViewResult-selectionBackground: var(--tabs-accent-soft);
  --vscode-peekView-border: var(--tabs-accent);
  --vscode-editorStickyScroll-background: var(--tabs-bg);
  --vscode-editorGutter-background: var(--tabs-bg);
  --vscode-editorWidget-foreground: var(--tabs-text);
  --vscode-debugToolBar-background: var(--tabs-bg-popover);
  --vscode-debugToolBar-border: var(--tabs-hairline-strong);
}

/* ============================================ FORM CONTROLS === */
/* Dropdowns / select boxes — rounded, hairline, accent focus; their popup list
   matches the menu surface. */
.monaco-workbench .monaco-select-box,
.monaco-workbench select.monaco-select-box {
  border-radius: 8px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  background: var(--tabs-input-bg) !important;
  color: var(--tabs-text) !important;
  padding: 0 8px;
}
.monaco-workbench .monaco-select-box-dropdown-container {
  border-radius: 8px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  background: var(--tabs-bg-popover) !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  overflow: hidden;
}
.monaco-workbench .monaco-select-box-dropdown-container .monaco-list-row.focused {
  background: var(--tabs-accent-soft) !important;
  color: var(--tabs-text) !important;
}
/* Checkboxes / toggles — accent fill when checked, hairline otherwise. */
.monaco-workbench .monaco-custom-toggle {
  border-radius: 5px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
}
.monaco-workbench .monaco-custom-toggle.checked {
  background: var(--tabs-accent-soft) !important;
  border-color: var(--tabs-accent) !important;
  color: var(--tabs-accent) !important;
}
.monaco-workbench .monaco-custom-toggle.monaco-checkbox {
  outline-offset: 1px;
}
/* Text / number inputs — rounded, hairline, accent focus ring. */
.monaco-workbench .monaco-inputbox {
  border-radius: 8px !important;
}
.monaco-workbench .monaco-inputbox.synthetic-focus,
.monaco-workbench .monaco-inputbox:focus-within {
  outline: 1px solid var(--tabs-accent) !important;
  outline-offset: -1px;
  border-color: var(--tabs-accent) !important;
}
/* Buttons — soft radius; secondary buttons read as hairline ghosts. */
.monaco-workbench .monaco-button {
  border-radius: 8px !important;
  font-weight: 600;
}
.monaco-workbench .monaco-button.secondary {
  background: var(--tabs-ov-06) !important;
  color: var(--tabs-text) !important;
}
/* Keybinding chips (settings / keybindings editor) read as small key caps. */
.monaco-workbench .monaco-keybinding-key {
  border-radius: 5px !important;
  border: 1px solid var(--tabs-hairline) !important;
  background: var(--tabs-ov-06) !important;
  box-shadow: none !important;
}

/* ============================================ SETTINGS EDITOR === */
/* VS Code's own settings CSS uses deep, high-specificity selectors
   (".settings-editor > .settings-body .settings-tree-container …"), so every
   override here is forced with !important to win — otherwise the page reverts to
   stock (26px shouty headers, amber indicators, square controls). */
.monaco-workbench .settings-editor,
.monaco-workbench .settings-editor > .settings-body {
  background: var(--tabs-bg) !important;
}
/* Header: search box reads as a shell input; scope tabs get a hairline rule. */
.monaco-workbench .settings-editor .settings-header {
  background: var(--tabs-bg) !important;
  border-bottom: 1px solid var(--tabs-hairline) !important;
}
.monaco-workbench .settings-editor .suggest-input-container .monaco-inputbox {
  border-radius: 10px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  background: var(--tabs-input-bg) !important;
}
.monaco-workbench .settings-editor .settings-tabs-widget .monaco-action-bar .action-item {
  margin-right: 4px !important;
}
.monaco-workbench .settings-editor .settings-tabs-widget .action-item .action-label {
  border-radius: 6px !important;
  border: 1px solid var(--tabs-hairline) !important;
  background: var(--tabs-ov-03) !important;
  color: var(--tabs-text-muted) !important;
  padding: 4px 10px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  transition: all 120ms ease !important;
  outline: none !important;
  box-shadow: none !important;
}
.monaco-workbench .settings-editor .settings-tabs-widget .action-item .action-label:hover {
  background: var(--tabs-ov-06) !important;
  color: var(--tabs-text) !important;
  border-color: var(--tabs-hairline-strong) !important;
}
.monaco-workbench .settings-editor .settings-tabs-widget .action-item .action-label.checked {
  background: var(--tabs-bg-elevated) !important;
  color: var(--tabs-text) !important;
  border-color: var(--tabs-hairline-strong) !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2) !important;
}
.monaco-workbench .settings-editor .settings-tabs-widget .action-item .action-label:focus,
.monaco-workbench .settings-editor .settings-tabs-widget .action-item:focus {
  outline: none !important;
  border-color: var(--tabs-accent) !important;
}

/* General count badges (file tree badges, search count badges, open editor count badges) */
.monaco-workbench .monaco-count-badge {
  background: var(--vscode-badge-background) !important;
  color: var(--vscode-badge-foreground) !important;
  border-radius: 999px !important;
  border: none !important;
  font-weight: 500 !important;
  padding: 2px 6px !important;
}
.monaco-workbench .monaco-list-row.selected .monaco-count-badge,
.monaco-workbench .monaco-list-row.focused .monaco-count-badge {
  background: var(--tabs-accent-soft) !important;
  color: var(--tabs-text) !important;
}
/* Table-of-contents rail (left): tighter, quieter, accent selection. */
.monaco-workbench .settings-editor .settings-toc-container .monaco-list-row {
  border-radius: 8px !important;
  font-size: 12px !important;
}
.monaco-workbench .settings-editor .settings-toc-container .monaco-list-row.selected {
  background: var(--tabs-accent-soft) !important;
  color: var(--tabs-text) !important;
  box-shadow: inset 2px 0 0 0 var(--tabs-accent) !important;
}
/* Settings sidebar table of contents twistie / chevron icon (Issue A) */
.monaco-workbench .settings-editor .settings-toc-container .monaco-tl-twistie,
.monaco-workbench .settings-editor .settings-toc-container .monaco-tl-twistie.codicon {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  opacity: 0.75 !important;
  color: var(--tabs-text) !important;
  font-size: 12px !important;
  width: 16px !important;
  height: 100% !important;
  visibility: visible !important;
}
.monaco-workbench .settings-editor .settings-toc-container .monaco-list-row:hover .monaco-tl-twistie,
.monaco-workbench .settings-editor .settings-toc-container .monaco-list-row.selected .monaco-tl-twistie {
  opacity: 1 !important;
  color: var(--tabs-text) !important;
}
/* Tame the giant category header (level-1 is 26px stock) into a clean heading. */
.monaco-workbench .settings-editor .settings-group-title-label,
.monaco-workbench .settings-editor .settings-group-title-label.settings-group-level-1,
.monaco-workbench .settings-editor .settings-group-title-label.settings-group-level-2,
.monaco-workbench .settings-editor .settings-group-title-label.settings-group-level-3 {
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  color: var(--tabs-text) !important;
  padding: 18px 15px 6px !important;
}
/* Each setting renders as a subtle hairline card with breathing room. */
.monaco-workbench .settings-editor .setting-item-contents {
  border-radius: 10px !important;
  border: 1px solid transparent !important;
  padding: 12px 14px !important;
  transition: border-color 120ms ease, background 120ms ease;
}
.monaco-workbench .settings-editor .setting-item:hover .setting-item-contents,
.monaco-workbench .settings-editor .setting-item-contents:hover {
  background: var(--tabs-ov-025) !important;
  border-color: var(--tabs-hairline) !important;
}
.monaco-workbench .settings-editor .setting-item-contents.is-configured {
  background: var(--tabs-ov-015) !important;
}
/* The "modified" left indicator reads as the app's blue accent (was amber). */
.monaco-workbench .settings-editor .setting-item-modified-indicator {
  border-left-color: var(--tabs-accent) !important;
  border-radius: 2px;
}
/* Title / category / description typography. */
.monaco-workbench .settings-editor .setting-item-title .setting-item-label {
  font-weight: 600 !important;
  color: var(--tabs-text) !important;
}
.monaco-workbench .settings-editor .setting-item-title .setting-item-category {
  color: var(--tabs-text-muted) !important;
}
.monaco-workbench .settings-editor .setting-item-description,
.monaco-workbench .settings-editor .setting-item-markdown {
  color: var(--tabs-text-muted) !important;
}
/* Controls (enum dropdowns, text/number inputs) match the form-control system. */
.monaco-workbench .settings-editor .setting-item-control .monaco-select-box,
.monaco-workbench .settings-editor .setting-item-control .monaco-inputbox {
  border-radius: 8px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  background: var(--tabs-input-bg) !important;
}
.monaco-workbench .settings-editor .setting-item-control .monaco-inputbox.synthetic-focus,
.monaco-workbench .settings-editor .setting-item-control .monaco-inputbox:focus-within {
  border-color: var(--tabs-accent) !important;
}

/* ============================================ EXTENSIONS VIEW === */
.monaco-workbench .extensions-viewlet > .header .monaco-inputbox {
  border-radius: 10px !important;
}
.monaco-workbench .extension-list-item {
  border-radius: 10px;
  border: 1px solid transparent;
}
.monaco-workbench .extension-list-item:hover {
  background: var(--tabs-ov-02);
  border-color: var(--tabs-hairline);
}
.monaco-workbench .extension-list-item .name {
  font-weight: 600;
  color: var(--tabs-text);
}
.monaco-workbench .extension-list-item .publisher,
.monaco-workbench .extension-list-item .description {
  color: var(--tabs-text-muted);
}
.monaco-workbench .extension-editor {
  background: var(--tabs-bg) !important;
}
.monaco-workbench .extension-bookmark .recommendation,
.monaco-workbench .extension-list-item .monaco-button {
  border-radius: 8px !important;
}

/* ============================================ WELCOME / WALKTHROUGH === */
/* Should normally be suppressed (startupEditor=none + the rules below), but if a
   user opens it explicitly, keep it in-palette rather than stock. */
.monaco-workbench .gettingStartedContainer {
  background: var(--tabs-bg) !important;
}
.monaco-workbench .gettingStartedContainer .category,
.monaco-workbench .gettingStartedContainer .getting-started-category {
  border-radius: 12px !important;
  border: 1px solid var(--tabs-hairline) !important;
  background: var(--tabs-bg-elevated) !important;
}
.monaco-workbench .gettingStartedContainer .button-link,
.monaco-workbench .gettingStartedContainer .monaco-button {
  border-radius: 8px !important;
}

/* ============================================ EDITOR WIDGETS === */
/* Hover, suggest, parameter hints, peek, sticky scroll, debug toolbar — all on
   the popover surface with hairline borders and soft elevation. */
.monaco-workbench .monaco-editor .monaco-hover,
.monaco-workbench .monaco-editor .parameter-hints-widget,
.monaco-workbench .monaco-editor .suggest-widget,
.monaco-workbench .monaco-editor .suggest-details-container {
  border-radius: 10px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  overflow: hidden;
}
.monaco-workbench .monaco-editor .suggest-widget .monaco-list-row.focused {
  background: var(--tabs-accent-soft) !important;
}
/* Peek view (references / definitions): accent rail, rounded title. */
.monaco-workbench .monaco-editor .peekview-widget {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.monaco-workbench .monaco-editor .peekview-widget .peekview-title {
  background: var(--tabs-bg-elevated) !important;
}
/* Sticky scroll: transparent over the editor with a hairline underline. */
.monaco-workbench .monaco-editor .sticky-widget {
  background: color-mix(in srgb, var(--tabs-bg) 92%, transparent) !important;
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--tabs-hairline);
}
/* Floating debug toolbar reads as a popover pill. */
.monaco-workbench .debug-toolbar {
  border-radius: 10px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  overflow: hidden;
}

/* ============================================ SIDE PANES (OUTLINE/TIMELINE) === */
/* The VS Code Outline and Timeline panes serve no purpose in the Tabs embed
   and steal file-tree space. VS Code's JS SplitView sets inline height/top on
   each .split-view-view, so display:none alone is not enough -- the explorer's
   inline height stays at its JS-allocated value (total - outline - timeline).
   Fix: hide every split-view-view except the first (explorer is always first)
   and force the explorer to fill 100% of the container height. */
.monaco-workbench .part.sidebar .split-view-container > .split-view-view:not(:first-child) {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
}
.monaco-workbench .part.sidebar .split-view-container > .split-view-view:first-child {
  height: 100% !important;
}

/* ============================================ MODAL DIALOGS === */
/* The centred confirmation dialogs (Save?, Discard?, …) — shell card treatment. */
.monaco-workbench .monaco-dialog-box {
  border-radius: 14px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  background: var(--tabs-bg-popover) !important;
  box-shadow: 0 20px 60px rgba(0,0,0,0.55) !important;
  overflow: hidden;
}
.monaco-workbench .monaco-dialog-box .dialog-buttons-row .monaco-button {
  border-radius: 8px !important;
}
.monaco-workbench .dialog-shadow,
.monaco-workbench .dialog-modal-block {
  background: rgba(0,0,0,0.45) !important;
}

/* ============================================ NOTIFICATIONS CENTRE === */
.monaco-workbench .notifications-center {
  border-radius: 12px !important;
  border: 1px solid var(--tabs-hairline-strong) !important;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  overflow: hidden;
}
.monaco-workbench .notifications-center .notifications-center-header {
  background: var(--tabs-bg-elevated) !important;
}

/* ============================================ DIFF / MINIMAP SLIDER === */
.monaco-workbench .monaco-editor .minimap-slider .minimap-slider-horizontal {
  background: var(--tabs-ov-08) !important;
}
.monaco-workbench .monaco-diff-editor .diffViewport {
  border-radius: 6px;
}

/* ============================================ ARTEFACT SUPPRESSION === */
/* The "Get Started" walkthrough / welcome page (startupEditor=none is the
   primary fix; this is the CSS backstop), the GitHub Copilot "Build with Agent"
   panel, and any "sign in to sync" banners must leave no trace in the embed. */
.monaco-workbench .welcomePageContainer,
.monaco-workbench .editor-instance .welcomePage {
  display: none !important;
}
.monaco-workbench [id*="github.copilot"],
.monaco-workbench [id*="GitHub.copilot"] {
  display: none !important;
}
.monaco-workbench .part.banner,
.monaco-workbench .monaco-workbench-banner {
  display: none !important;
}

/* =============================================================== MISC === */
/* Thin, calm, hover-revealed scrollbars over a transparent track. */
.monaco-workbench .monaco-scrollable-element > .scrollbar > .slider {
  border-radius: 6px;
}
.monaco-workbench .monaco-scrollable-element > .scrollbar {
  background: transparent !important;
}
.monaco-workbench .monaco-scrollable-element > .scrollbar > .slider {
  opacity: 0;
  transition: opacity 160ms ease;
}
.monaco-workbench .monaco-scrollable-element:hover > .scrollbar > .slider,
.monaco-workbench .monaco-scrollable-element > .scrollbar:hover > .slider,
.monaco-workbench .monaco-scrollable-element > .scrollbar > .slider.active {
  opacity: 1;
}
/* Soften the editor's separator lines into hairlines. */
.monaco-workbench .monaco-editor .editor-widget,
.monaco-workbench .split-view-view {
  --separator-border: var(--tabs-hairline);
}
`;
