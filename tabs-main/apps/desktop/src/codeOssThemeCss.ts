/**
 * Custom CSS injected into the embedded Code-OSS workbench (via
 * `webContents.insertCSS`) so the editor reads as a custom, built-for-Tabs
 * surface rather than stock VS Code. We re-map VS Code's own `--vscode-*`
 * design tokens (so colour cascades coherently) and then restyle the chrome —
 * activity bar, sidebar, editor tabs, status bar, lists, inputs — with Tabs'
 * design language: near-black neutral surfaces, hairline white borders, soft
 * 10px radii, generous spacing, and cyan/sky accents. The code editor's own
 * typography and layout are intentionally left alone.
 *
 * Palette (apps/web/src/index.css dark tokens):
 *   bg ≈ neutral-950@95% (#141414)   text neutral-100 (#f5f5f5)
 *   border white/6%      radius 10px  accent cyan #22d3ee / sky #0ea5e9
 */
export const CODE_OSS_THEME_CSS = /* css */ `
/* ============================================================= TOKENS === */
.monaco-workbench {
  --tabs-bg: #141414;
  --tabs-bg-elevated: #1b1b1b;
  --tabs-bg-editor: #121212;
  --tabs-hairline: rgba(255,255,255,0.06);
  --tabs-hairline-strong: rgba(255,255,255,0.10);
  --tabs-text: #ececec;
  --tabs-text-muted: #8a8a8a;
  --tabs-accent: #22d3ee;
  --tabs-accent-strong: #0ea5e9;
  --tabs-accent-soft: rgba(34,211,238,0.14);

  --vscode-font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;

  --vscode-foreground: var(--tabs-text);
  --vscode-editor-background: var(--tabs-bg-editor);
  --vscode-editor-foreground: var(--tabs-text);
  --vscode-sideBar-background: var(--tabs-bg);
  --vscode-sideBarSectionHeader-background: transparent;
  --vscode-sideBarTitle-foreground: var(--tabs-text-muted);
  --vscode-activityBar-background: var(--tabs-bg);
  --vscode-activityBar-foreground: var(--tabs-text);
  --vscode-activityBar-inactiveForeground: #5f5f5f;
  --vscode-panel-background: var(--tabs-bg);
  --vscode-statusBar-background: var(--tabs-bg);
  --vscode-statusBar-foreground: var(--tabs-text-muted);
  --vscode-statusBar-noFolderBackground: var(--tabs-bg);
  --vscode-titleBar-activeBackground: var(--tabs-bg);
  --vscode-titleBar-inactiveBackground: var(--tabs-bg);
  --vscode-titleBar-activeForeground: var(--tabs-text);
  --vscode-editorGroupHeader-tabsBackground: var(--tabs-bg);
  --vscode-editorGroupHeader-noTabsBackground: var(--tabs-bg);
  --vscode-tab-inactiveBackground: transparent;
  --vscode-tab-activeBackground: var(--tabs-bg-elevated);
  --vscode-tab-hoverBackground: rgba(255,255,255,0.04);
  --vscode-tab-activeForeground: var(--tabs-text);
  --vscode-tab-inactiveForeground: var(--tabs-text-muted);
  --vscode-breadcrumb-background: var(--tabs-bg);
  --vscode-menu-background: #181818;
  --vscode-quickInput-background: #181818;
  --vscode-dropdown-background: #1c1c1c;
  --vscode-input-background: #1c1c1c;
  --vscode-editorWidget-background: #181818;
  --vscode-peekViewEditor-background: var(--tabs-bg-editor);

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

  --vscode-focusBorder: var(--tabs-accent);
  --vscode-activityBarBadge-background: var(--tabs-accent-strong);
  --vscode-activityBarBadge-foreground: #04151c;
  --vscode-button-background: var(--tabs-accent-strong);
  --vscode-button-hoverBackground: #38bdf8;
  --vscode-button-foreground: #04151c;
  --vscode-progressBar-background: var(--tabs-accent);
  --vscode-textLink-foreground: #38bdf8;
  --vscode-textLink-activeForeground: #7dd3fc;
  --vscode-list-activeSelectionBackground: var(--tabs-accent-soft);
  --vscode-list-activeSelectionForeground: var(--tabs-text);
  --vscode-list-inactiveSelectionBackground: rgba(255,255,255,0.05);
  --vscode-list-hoverBackground: rgba(255,255,255,0.04);
  --vscode-list-focusOutline: transparent;
  --vscode-pickerGroup-foreground: #38bdf8;
  --vscode-statusBarItem-remoteBackground: transparent;
  --vscode-statusBarItem-remoteForeground: var(--tabs-accent);
  --vscode-statusBarItem-hoverBackground: rgba(255,255,255,0.06);
  --vscode-selection-background: rgba(34,211,238,0.28);
  --vscode-scrollbarSlider-background: rgba(255,255,255,0.06);
  --vscode-scrollbarSlider-hoverBackground: rgba(255,255,255,0.12);
  --vscode-scrollbarSlider-activeBackground: rgba(34,211,238,0.22);
}

/* UI chrome uses the UI font; the code editor keeps its own mono font. */
.monaco-workbench .part:not(.editor) {
  font-family: var(--vscode-font-family);
}

/* ===================================================== ACTIVITY BAR === */
/* The stock activity bar, title bar and status bar are hidden via workbench
   settings (see ensureCodeOssWebServerDefaultSettings) because Tabs renders its
   own native React chrome (activity rail / header / status bar) in the gutters
   around this embedded view. Defensive CSS in case a future VS Code build still
   paints a sliver: collapse them so they can never leave a gap beside the React
   chrome. */
.monaco-workbench .part.activitybar,
.monaco-workbench .part.titlebar,
.monaco-workbench .part.statusbar {
  display: none !important;
}

/* Backstop for the reserved-grid-column gap: when a settings race leaves the
   activity-bar column allocated, display:none alone does not reclaim the cell.
   Force the part to zero width so the sidebar is not pushed right by an empty
   48px gutter. NOTE: the authoritative reclaim is the
   workbench.activityBar.location=hidden setting applying once the workbench
   boots cleanly; this only papers over the gap if that races. */
.monaco-workbench .part.activitybar {
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  overflow: hidden !important;
}
/* Collapse the secondary (auxiliary) side bar — Tabs renders no chat panel. */
.monaco-workbench .part.auxiliarybar {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
}
/* Pull the sidebar flush-left in case the grid kept the activity-bar offset.
   (If this misaligns the sidebar against the editor, it is the first rule to
   drop — the real fix is the boot/settings path, not CSS.) */
.monaco-workbench .part.sidebar {
  left: 0 !important;
}

/* ============================================================ SIDEBAR === */
.monaco-workbench .part.sidebar {
  /* The native React rail sits to the left of this view, so the sidebar reads as
     the first column — give it a touch more breathing room at the top. */
  padding-top: 6px;
}
.monaco-workbench .pane-header {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tabs-text-muted);
}
.monaco-workbench .pane-header .title {
  font-weight: 600;
}
/* Clean, full-width rows: soft cyan fill + a thin left accent on selection.
   (No harsh outline ring.) */
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
  box-shadow: inset 2px 0 0 0 var(--tabs-accent) !important;
}
.monaco-workbench .part.sidebar .monaco-list:focus .monaco-list-row.focused {
  background: rgba(255,255,255,0.04);
}

/* ======================================================= EDITOR TABS === */
.monaco-workbench .editor-group-container > .title {
  border-bottom: 1px solid var(--tabs-hairline);
}
.monaco-workbench .tabs-container > .tab {
  margin: 4px 2px 4px 0;
  padding: 0 14px;
  border-radius: 9px;
  border: none !important;
}
.monaco-workbench .tabs-container > .tab.active {
  box-shadow: inset 0 0 0 1px var(--tabs-hairline-strong);
}
.monaco-workbench .tabs-container > .tab.active::after {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 3px;
  height: 2px;
  border-radius: 2px;
  background: var(--tabs-accent);
}
.monaco-workbench .tabs-container > .tab .tab-label {
  font-size: 12.5px;
}

/* The stock status bar is hidden (settings + the collapse rule above); Tabs
   renders its own native status bar below the embedded view. The status-bar
   token mappings near the top are kept so any transient status surfaces (e.g.
   notifications anchored to it) still read in-palette. */

/* ============================================ INPUTS / WIDGETS / MENUS === */
.monaco-workbench .quick-input-widget,
.monaco-workbench .monaco-editor .suggest-widget,
.monaco-workbench .editor-widget.find-widget,
.monaco-workbench .notification-toast,
.monaco-workbench .monaco-hover,
.monaco-workbench .context-view .monaco-menu-container,
.monaco-workbench .quick-input-list .monaco-list {
  border-radius: 12px !important;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
}
.monaco-workbench .monaco-inputbox,
.monaco-workbench .monaco-select-box,
.monaco-workbench .monaco-button,
.monaco-workbench .monaco-text-button {
  border-radius: 9px !important;
}
.monaco-workbench .monaco-list-row {
  border-radius: 6px;
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
  background: rgba(255,255,255,0.08);
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
  border-radius: 9px !important;
  font-weight: 600;
}

/* =============================================================== MISC === */
/* Thin, calm scrollbars. */
.monaco-workbench .monaco-scrollable-element > .scrollbar > .slider {
  border-radius: 6px;
}
/* Soften the editor's separator lines into hairlines. */
.monaco-workbench .monaco-editor .editor-widget,
.monaco-workbench .split-view-view {
  --separator-border: var(--tabs-hairline);
}
`;
