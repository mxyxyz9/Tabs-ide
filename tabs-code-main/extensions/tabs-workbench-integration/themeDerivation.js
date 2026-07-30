"use strict";

/**
 * CommonJS Theme Derivation Engine for Tabs Workbench Integration Extension.
 * Identical canonical spec as @tabs/shared/themeDerivation.
 */

function toHexColor(color) {
  if (!color || typeof color !== "string") return "#000000";
  let clean = color.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length >= 6) {
    return `#${clean.substring(0, 6)}`;
  }
  return "#000000";
}

function alpha(color, opacity) {
  const hex = toHexColor(color);
  const clampOp = Math.max(0, Math.min(1, opacity));
  const intOp = Math.round(clampOp * 255).toString(16).padStart(2, "0");
  return `${hex}${intOp}`;
}

function resolveSolidColor(colorHex, parentBgHex = "#121824") {
  if (!colorHex || typeof colorHex !== "string") return toHexColor(parentBgHex);
  const clean = colorHex.trim().replace(/^#/, "");
  if (clean.length === 8) {
    const fgR = parseInt(clean.substring(0, 2), 16);
    const fgG = parseInt(clean.substring(2, 4), 16);
    const fgB = parseInt(clean.substring(4, 6), 16);
    const opacity = parseInt(clean.substring(6, 8), 16) / 255;

    const baseHex = toHexColor(parentBgHex).replace("#", "");
    const bgR = parseInt(baseHex.substring(0, 2), 16);
    const bgG = parseInt(baseHex.substring(2, 4), 16);
    const bgB = parseInt(baseHex.substring(4, 6), 16);

    const r = Math.round(bgR + (fgR - bgR) * opacity);
    const g = Math.round(bgG + (fgG - bgG) * opacity);
    const b = Math.round(bgB + (fgB - bgB) * opacity);

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  return toHexColor(colorHex);
}

function calculateLuminance(hex) {
  const norm = toHexColor(hex).replace("#", "");
  const r = parseInt(norm.substring(0, 2), 16) / 255;
  const g = parseInt(norm.substring(2, 4), 16) / 255;
  const b = parseInt(norm.substring(4, 6), 16) / 255;

  const cal = (val) =>
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);

  return 0.2126 * cal(r) + 0.7152 * cal(g) + 0.0722 * cal(b);
}

function calculateContrastRatio(fgHex, bgHex, parentBgHex = "#121824") {
  const solidBg = resolveSolidColor(bgHex, parentBgHex);
  const solidFg = resolveSolidColor(fgHex, solidBg);

  const l1 = calculateLuminance(solidFg);
  const l2 = calculateLuminance(solidBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio: Math.round(ratio * 10) / 10,
    isLowContrast: ratio < 4.5,
  };
}

function ensureMinContrast(fgColor, bgColor, minRatio = 4.5, parentBgHex = "#121824") {
  const solidBg = resolveSolidColor(bgColor, parentBgHex);
  const fgHex = toHexColor(fgColor);

  const currentRatio = calculateContrastRatio(fgHex, solidBg).ratio;
  if (currentRatio >= minRatio) {
    return fgColor;
  }

  const bgLum = calculateLuminance(solidBg);
  const isBgDark = bgLum < 0.5;

  const cleanFg = fgHex.replace("#", "");
  const r = parseInt(cleanFg.substring(0, 2), 16);
  const g = parseInt(cleanFg.substring(2, 4), 16);
  const b = parseInt(cleanFg.substring(4, 6), 16);

  let bestHex = fgHex;
  let bestRatio = currentRatio;

  for (let step = 1; step <= 20; step++) {
    const t = step / 20;

    let nr, ng, nb;

    if (isBgDark) {
      nr = Math.round(r + (255 - r) * t);
      ng = Math.round(g + (255 - g) * t);
      nb = Math.round(b + (255 - b) * t);
    } else {
      nr = Math.round(r * (1 - t));
      ng = Math.round(g * (1 - t));
      nb = Math.round(b * (1 - t));
    }

    const hexCandidate = `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
    const candRatio = calculateContrastRatio(hexCandidate, solidBg).ratio;

    if (candRatio > bestRatio) {
      bestRatio = candRatio;
      bestHex = hexCandidate;
    }

    if (candRatio >= minRatio) {
      if (fgColor.trim().startsWith("#") && fgColor.trim().length === 9) {
        const alphaSuffix = fgColor.trim().substring(7, 9);
        return `${hexCandidate}${alphaSuffix}`;
      }
      return hexCandidate;
    }
  }

  const fallback = isBgDark ? "#f8fafc" : "#0f172a";
  if (fgColor.trim().startsWith("#") && fgColor.trim().length === 9) {
    const alphaSuffix = fgColor.trim().substring(7, 9);
    return `${fallback}${alphaSuffix}`;
  }
  return fallback;
}

function getOptimalPrimaryForeground(primaryHex) {
  const whiteRatio = calculateContrastRatio("#ffffff", primaryHex).ratio;
  const darkRatio = calculateContrastRatio("#0f172a", primaryHex).ratio;

  if (whiteRatio >= 4.5 && whiteRatio >= darkRatio) {
    return "#ffffff";
  }
  if (darkRatio >= 4.5) {
    return "#0f172a";
  }

  const choice = whiteRatio >= darkRatio ? "#ffffff" : "#0f172a";
  return ensureMinContrast(choice, primaryHex, 4.5);
}

function suggestAccessibleFg(fgHex, bgHex) {
  return ensureMinContrast(fgHex, bgHex, 4.5);
}

const VSCODE_TOKEN_REGISTRY = [
  // ── 0. Web App Shell Component Tokens ────────────────────────────────────
  { id: "app.primaryBackground", label: "App Primary Button Background", description: "Background for primary web app buttons (e.g. Save Preset)", category: "accents", isBg: true, deriveDefault: (c) => c.primary },
  { id: "app.primaryForeground", label: "App Primary Button Text (Save Preset)", description: "Foreground text color for primary buttons (Save Preset)", category: "accents", contrastPairId: "app.primaryBackground", deriveDefault: (c) => getOptimalPrimaryForeground(c.primary) },
  { id: "app.secondaryBackground", label: "App Secondary Button Background", description: "Background for secondary UI controls", category: "accents", isBg: true, deriveDefault: (c) => alpha(c.foreground, 0.08) },
  { id: "app.secondaryForeground", label: "App Secondary Button Text", description: "Text color for secondary UI controls", category: "accents", contrastPairId: "app.secondaryBackground", deriveDefault: (c) => c.foreground },
  { id: "app.accentBackground", label: "App Accent Highlight Background", description: "Background for interactive highlights", category: "accents", isBg: true, deriveDefault: (c) => alpha(c.primary, 0.15) },
  { id: "app.accentForeground", label: "App Accent Highlight Text", description: "Text color for interactive highlights", category: "accents", contrastPairId: "app.accentBackground", deriveDefault: (c) => c.foreground },
  { id: "app.cardBackground", label: "App Card / Dialog Surface", description: "Background for modal cards and settings drawers", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "app.cardForeground", label: "App Card / Dialog Text", description: "Text color for modal cards and settings drawers", category: "text", contrastPairId: "app.cardBackground", deriveDefault: (c) => c.foreground },
  { id: "app.popoverBackground", label: "App Popover / Dropdown Surface", description: "Background for floating tooltips and popovers", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "app.popoverForeground", label: "App Popover / Dropdown Text", description: "Text color for floating tooltips and popovers", category: "text", contrastPairId: "app.popoverBackground", deriveDefault: (c) => c.foreground },
  { id: "app.mutedBackground", label: "App Muted Surface", description: "Background for subtle containers", category: "surfaces", isBg: true, deriveDefault: (c) => alpha(c.foreground, 0.06) },
  { id: "app.mutedForeground", label: "App Muted Subtitle Text", description: "Text color for secondary subtitles and muted labels", category: "text", contrastPairId: "editor.background", deriveDefault: (c, isDark) => (isDark ? "#ffffffa6" : "#0f172aa6") },
  { id: "app.destructiveBackground", label: "App Destructive Button Background", description: "Background for destructive actions (e.g. Delete)", category: "accents", isBg: true, deriveDefault: () => "#b91c1c" },
  { id: "app.destructiveForeground", label: "App Destructive Button Text", description: "Text color inside destructive action buttons", category: "accents", contrastPairId: "app.destructiveBackground", deriveDefault: () => "#ffffff" },

  // ── 1. Surfaces & Containers ──────────────────────────────────────────────
  { id: "titleBar.activeBackground", label: "Title Bar Background", description: "Active window title bar background", category: "surfaces", isBg: true, deriveDefault: (c) => c.background },
  { id: "titleBar.inactiveBackground", label: "Title Bar Inactive Bg", description: "Inactive window title bar background", category: "surfaces", isBg: true, deriveDefault: (c) => c.background },
  { id: "activityBar.background", label: "Activity Bar Background", description: "Activity bar container background", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "activityBar.activeBackground", label: "Activity Bar Active Item", description: "Background of the active activity bar item", category: "surfaces", isBg: true, deriveDefault: (c) => alpha(c.primary, 0.1) },
  { id: "sideBar.background", label: "Side Bar Background", description: "Sidebar panel background color", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "sideBarSectionHeader.background", label: "Side Bar Section Header", description: "Sidebar section header background", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "editorGroupHeader.tabsBackground", label: "Tabs Header Background", description: "Tab bar row container background", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "editorGroupHeader.noTabsBackground", label: "No-Tabs Header Background", description: "Header background when tabs are disabled", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "tab.activeBackground", label: "Active Tab Background", description: "Background of the focused/active tab", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "tab.inactiveBackground", label: "Inactive Tab Background", description: "Background of unselected tabs", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "tab.hoverBackground", label: "Tab Hover Background", description: "Background of a tab when hovered", category: "surfaces", isBg: true, deriveDefault: (c) => alpha(c.foreground, 0.05) },
  { id: "editor.background", label: "Editor Background", description: "Main code editor canvas background", category: "surfaces", isBg: true, deriveDefault: (c) => c.background },
  { id: "panel.background", label: "Panel / Terminal Background", description: "Bottom panel background color", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "terminal.background", label: "Integrated Terminal Bg", description: "Integrated terminal container background", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "statusBar.background", label: "Status Bar Background", description: "Main status bar background color", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "statusBar.noFolderBackground", label: "Status Bar No-Folder Bg", description: "Status bar background when no folder is open", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "statusBar.debuggingBackground", label: "Status Bar Debugging Bg", description: "Status bar background during debug sessions", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "statusBarItem.prominentBackground", label: "Status Bar Item Prominent Bg", description: "Background of prominent status items", category: "surfaces", isBg: true, deriveDefault: (c) => c.card },
  { id: "statusBarItem.remoteBackground", label: "Status Bar Item Remote Bg", description: "Background of remote status items", category: "surfaces", isBg: true, deriveDefault: (c) => c.primary },

  // ── 2. Text & Typography ──────────────────────────────────────────────────
  { id: "foreground", label: "Global Text / Foreground", description: "Default body text color", category: "text", contrastPairId: "editor.background", deriveDefault: (c) => c.foreground },
  { id: "disabledForeground", label: "Disabled Text Color", description: "Text color for disabled UI controls", category: "text", contrastPairId: "editor.background", deriveDefault: (c) => alpha(c.foreground, 0.38) },
  { id: "descriptionForeground", label: "Description Muted Text", description: "Subtitles and secondary descriptions", category: "text", contrastPairId: "editor.background", deriveDefault: (c, isDark) => (isDark ? "#ffffffa6" : "#0f172aa6") },
  { id: "titleBar.activeForeground", label: "Title Bar Text", description: "Active window title text color", category: "text", contrastPairId: "titleBar.activeBackground", deriveDefault: (c) => c.foreground },
  { id: "titleBar.inactiveForeground", label: "Title Bar Inactive Text", description: "Inactive title bar text color", category: "text", contrastPairId: "titleBar.inactiveBackground", deriveDefault: (c) => alpha(c.foreground, 0.5) },
  { id: "activityBar.foreground", label: "Activity Bar Icon Color", description: "Active activity bar icon color", category: "text", contrastPairId: "activityBar.background", deriveDefault: (c) => c.primary },
  { id: "activityBar.inactiveForeground", label: "Activity Bar Inactive Icon", description: "Inactive activity bar icon color", category: "text", contrastPairId: "activityBar.background", deriveDefault: (c) => alpha(c.foreground, 0.5) },
  { id: "sideBar.foreground", label: "Side Bar Text Color", description: "General sidebar text color", category: "text", contrastPairId: "sideBar.background", deriveDefault: (c) => c.foreground },
  { id: "sideBarTitle.foreground", label: "Side Bar Title Text", description: "Sidebar main title text color", category: "text", contrastPairId: "sideBar.background", deriveDefault: (c) => c.foreground },
  { id: "sideBarSectionHeader.foreground", label: "Side Bar Header Text", description: "Sidebar section title text color", category: "text", contrastPairId: "sideBarSectionHeader.background", deriveDefault: (c) => c.foreground },
  { id: "tab.activeForeground", label: "Active Tab Text", description: "Foreground text color for active tab", category: "text", contrastPairId: "tab.activeBackground", deriveDefault: (c) => c.foreground },
  { id: "tab.inactiveForeground", label: "Inactive Tab Text", description: "Foreground text color for unselected tabs", category: "text", contrastPairId: "tab.inactiveBackground", deriveDefault: (c) => alpha(c.foreground, 0.55) },
  { id: "tab.hoverForeground", label: "Tab Hover Text", description: "Text color of a hovered tab", category: "text", contrastPairId: "tab.hoverBackground", deriveDefault: (c) => c.foreground },
  { id: "editor.foreground", label: "Editor Default Text", description: "Code editor text color", category: "text", contrastPairId: "editor.background", deriveDefault: (c) => c.foreground },
  { id: "panelTitle.activeForeground", label: "Panel Active Tab Text", description: "Active panel title text color", category: "text", contrastPairId: "panel.background", deriveDefault: (c) => c.foreground },
  { id: "panelTitle.inactiveForeground", label: "Panel Inactive Tab Text", description: "Inactive panel title text color", category: "text", contrastPairId: "panel.background", deriveDefault: (c) => alpha(c.foreground, 0.5) },
  { id: "terminal.foreground", label: "Terminal Text", description: "Default terminal text color", category: "text", contrastPairId: "terminal.background", deriveDefault: (c) => c.foreground },
  { id: "statusBar.foreground", label: "Status Bar Text", description: "Status bar text color (including OVR indicator)", category: "text", contrastPairId: "statusBar.background", deriveDefault: (c) => c.foreground },
  { id: "statusBar.noFolderForeground", label: "Status Bar No-Folder Text", description: "Status bar text when no folder open", category: "text", contrastPairId: "statusBar.noFolderBackground", deriveDefault: (c) => c.foreground },
  { id: "statusBar.debuggingForeground", label: "Status Bar Debugging Text", description: "Status bar text during debugging", category: "text", contrastPairId: "statusBar.debuggingBackground", deriveDefault: (c) => c.foreground },
  { id: "statusBarItem.prominentForeground", label: "Status Item Prominent Text", description: "Text color for prominent status items", category: "text", contrastPairId: "statusBarItem.prominentBackground", deriveDefault: (c) => c.foreground },
  { id: "statusBarItem.remoteForeground", label: "Status Item Remote Text", description: "Text color for remote status items", category: "text", contrastPairId: "statusBarItem.remoteBackground", deriveDefault: (c) => getOptimalPrimaryForeground(c.primary) },
  { id: "list.hoverForeground", label: "List Item Hover Text", description: "Text color of list items on hover", category: "text", contrastPairId: "list.hoverBackground", deriveDefault: (c) => c.foreground },
  { id: "list.activeSelectionForeground", label: "List Active Selected Text", description: "Text color of active list selections", category: "text", contrastPairId: "list.activeSelectionBackground", deriveDefault: (c) => c.foreground },
  { id: "list.inactiveSelectionForeground", label: "List Inactive Selected Text", description: "Text color of inactive list selections", category: "text", contrastPairId: "list.inactiveSelectionBackground", deriveDefault: (c) => c.foreground },
  { id: "list.focusForeground", label: "List Focused Text", description: "Text color of focused list items", category: "text", contrastPairId: "list.focusBackground", deriveDefault: (c) => c.foreground },

  // ── 3. Borders & Dividers ─────────────────────────────────────────────────
  { id: "focusBorder", label: "Focus Ring Border", description: "Border outline for focused interactive elements", category: "borders", deriveDefault: (c) => c.primary },
  { id: "widget.border", label: "Widget Outline Border", description: "Border outline around floating widgets", category: "borders", deriveDefault: (c) => c.border },
  { id: "widget.shadow", label: "Widget Shadow Color", description: "Shadow color for popups and widgets", category: "borders", deriveDefault: () => "#00000000" },
  { id: "titleBar.border", label: "Title Bar Divider", description: "Border under the window titlebar", category: "borders", deriveDefault: (c) => c.border },
  { id: "activityBar.border", label: "Activity Bar Border", description: "Border separating activity bar from sidebar", category: "borders", deriveDefault: (c) => c.border },
  { id: "sideBar.border", label: "Side Bar Border", description: "Border separating sidebar from editor", category: "borders", deriveDefault: (c) => c.border },
  { id: "sideBarSectionHeader.border", label: "Side Bar Header Border", description: "Border under sidebar section headers", category: "borders", deriveDefault: (c) => c.border },
  { id: "editorGroupHeader.tabsBorder", label: "Tab Bar Bottom Border", description: "Border under the tab bar row", category: "borders", deriveDefault: (c) => c.border },
  { id: "editorGroup.border", label: "Editor Split Group Border", description: "Border separating split editor panes", category: "borders", deriveDefault: (c) => c.border },
  { id: "tab.border", label: "Tab Border", description: "Border separating individual tabs", category: "borders", deriveDefault: () => "#00000000" },
  { id: "tab.activeBorder", label: "Active Tab Bottom Line", description: "Line indicator at bottom of active tab", category: "borders", deriveDefault: () => "#00000000" },
  { id: "tab.activeBorderTop", label: "Active Tab Top Line", description: "Line indicator at top of active tab", category: "borders", deriveDefault: () => "#00000000" },
  { id: "tab.unfocusedActiveBorder", label: "Unfocused Tab Line", description: "Active tab bottom line when window unfocused", category: "borders", deriveDefault: () => "#00000000" },
  { id: "tab.unfocusedActiveBorderTop", label: "Unfocused Tab Top Line", description: "Active tab top line when window unfocused", category: "borders", deriveDefault: () => "#00000000" },
  { id: "editorWidget.border", label: "Editor Widget Border", description: "Border around find/replace popups", category: "borders", deriveDefault: (c) => c.border },
  { id: "editorHoverWidget.border", label: "Hover Tooltip Border", description: "Border around hover tooltips", category: "borders", deriveDefault: (c) => c.border },
  { id: "panel.border", label: "Panel Top Border", description: "Border separating terminal panel from editor", category: "borders", deriveDefault: (c) => c.border },
  { id: "statusBar.border", label: "Status Bar Top Border", description: "Border separating status bar from main workbench", category: "borders", deriveDefault: (c) => c.border },
  { id: "input.border", label: "Input Box Border", description: "Border around text input boxes", category: "borders", deriveDefault: (c) => c.border },
  { id: "dropdown.border", label: "Dropdown Border", description: "Border around dropdown select menus", category: "borders", deriveDefault: (c) => c.border },
  { id: "checkbox.border", label: "Checkbox Border", description: "Border around checkbox inputs", category: "borders", deriveDefault: (c) => c.border },
  { id: "menu.border", label: "Menu Popup Border", description: "Border around context menus", category: "borders", deriveDefault: (c) => c.border },

  // ── 4. Accents & Interaction States ───────────────────────────────────────
  { id: "selection.background", label: "General Selection Bg", description: "Background for text selections in UI", category: "accents", deriveDefault: (c) => alpha(c.primary, 0.25) },
  { id: "icon.foreground", label: "Default Icon Color", description: "Color for icons across the interface", category: "accents", contrastPairId: "sideBar.background", deriveDefault: (c) => c.foreground },
  { id: "activityBarBadge.background", label: "Activity Badge Bg", description: "Badge background in activity bar", category: "accents", isBg: true, deriveDefault: (c) => c.primary },
  { id: "activityBarBadge.foreground", label: "Activity Badge Text", description: "Text color inside activity bar badges", category: "accents", contrastPairId: "activityBarBadge.background", deriveDefault: (c) => getOptimalPrimaryForeground(c.primary) },
  { id: "activityBar.activeBorder", label: "Activity Active Border", description: "Left accent bar on active activity icon", category: "accents", deriveDefault: (c) => c.primary },
  { id: "editorLineNumber.activeForeground", label: "Current Line Number", description: "Line number color for active line", category: "accents", contrastPairId: "editor.background", deriveDefault: (c) => c.primary },
  { id: "editorCursor.foreground", label: "Editor Cursor Color", description: "Color of the editor insertion caret", category: "accents", contrastPairId: "editor.background", deriveDefault: (c) => c.primary },
  { id: "editor.selectionBackground", label: "Editor Selected Text Bg", description: "Selection background in code editor", category: "accents", deriveDefault: (c) => alpha(c.primary, 0.2) },
  { id: "editor.selectionHighlightBackground", label: "Selection Matches Highlight", description: "Highlight color for matching selections", category: "accents", deriveDefault: (c) => alpha(c.primary, 0.12) },
  { id: "editor.inactiveSelectionBackground", label: "Inactive Selection Bg", description: "Editor selection when focus is lost", category: "accents", deriveDefault: (c) => alpha(c.primary, 0.1) },
  { id: "editor.lineHighlightBackground", label: "Active Line Background", description: "Background highlight behind active cursor line", category: "accents", deriveDefault: (c) => alpha(c.foreground, 0.04) },
  { id: "editor.lineHighlightBorder", label: "Active Line Border", description: "Border around active cursor line", category: "accents", deriveDefault: () => "#00000000" },
  { id: "panelTitle.activeBorder", label: "Panel Active Tab Line", description: "Active indicator line under panel tab", category: "accents", deriveDefault: (c) => c.primary },
  { id: "statusBarItem.hoverBackground", label: "Status Item Hover", description: "Background of status bar item on hover", category: "accents", deriveDefault: (c) => alpha(c.foreground, 0.08) },
  { id: "statusBarItem.activeBackground", label: "Status Item Click", description: "Background of status bar item when pressed", category: "accents", deriveDefault: (c) => alpha(c.foreground, 0.15) },
  { id: "list.hoverBackground", label: "List Hover Background", description: "Background of items in lists on hover", category: "accents", isBg: true, deriveDefault: (c) => alpha(c.primary, 0.1) },
  { id: "list.activeSelectionBackground", label: "List Selected Background", description: "Background of focused selected list item", category: "accents", isBg: true, deriveDefault: (c) => alpha(c.primary, 0.2) },
  { id: "list.inactiveSelectionBackground", label: "List Inactive Selected Bg", description: "Background of selected item when unfocused", category: "accents", isBg: true, deriveDefault: (c) => alpha(c.primary, 0.12) },
  { id: "list.focusBackground", label: "List Focus Background", description: "Background of item when focused in tree", category: "accents", isBg: true, deriveDefault: (c) => alpha(c.primary, 0.15) },
  { id: "list.highlightForeground", label: "List Search Match Highlight", description: "Text highlight color for search matches", category: "accents", contrastPairId: "list.hoverBackground", deriveDefault: (c) => c.primary },
  { id: "button.background", label: "Primary Button Bg", description: "Background color of primary action buttons", category: "accents", isBg: true, deriveDefault: (c) => c.primary },
  { id: "button.foreground", label: "Primary Button Text", description: "Text color inside primary action buttons", category: "accents", contrastPairId: "button.background", deriveDefault: (c) => getOptimalPrimaryForeground(c.primary) },
  { id: "button.hoverBackground", label: "Primary Button Hover", description: "Background color of primary button on hover", category: "accents", deriveDefault: (c) => alpha(c.primary, 0.85) },
  { id: "badge.background", label: "Badge Background", description: "Notification badge background color", category: "accents", isBg: true, deriveDefault: (c) => c.primary },
  { id: "badge.foreground", label: "Badge Text Color", description: "Text color inside notification badges", category: "accents", contrastPairId: "badge.background", deriveDefault: (c) => getOptimalPrimaryForeground(c.primary) },

  // ── 5. Editor Specific ───────────────────────────────────────────────────
  { id: "editorLineNumber.foreground", label: "Editor Line Numbers", description: "Code editor gutter line number color", category: "editor", contrastPairId: "editor.background", deriveDefault: (c) => alpha(c.foreground, 0.4) },
  { id: "editorIndentGuide.background", label: "Indent Guide Lines", description: "Vertical indent guide line color", category: "editor", deriveDefault: (c) => alpha(c.foreground, 0.08) },
  { id: "editorIndentGuide.activeBackground", label: "Active Indent Guide", description: "Indent guide color for active code block", category: "editor", deriveDefault: (c) => alpha(c.foreground, 0.16) },
  { id: "editorWhitespace.foreground", label: "Whitespace Characters", description: "Color for visible whitespace characters", category: "editor", deriveDefault: (c) => alpha(c.foreground, 0.1) },
  { id: "tree.indentGuidesStroke", label: "Tree View Indent Lines", description: "Indent lines in explorer tree views", category: "editor", deriveDefault: (c) => alpha(c.foreground, 0.1) },
  { id: "scrollbar.shadow", label: "Scrollbar Shadow", description: "Shadow cast by scrollbar containers", category: "editor", deriveDefault: () => "#00000000" },
  { id: "scrollbarSlider.background", label: "Scrollbar Thumb", description: "Scrollbar slider thumb background", category: "editor", deriveDefault: (c) => alpha(c.foreground, 0.12) },
  { id: "scrollbarSlider.hoverBackground", label: "Scrollbar Thumb Hover", description: "Scrollbar thumb color on hover", category: "editor", deriveDefault: (c) => alpha(c.foreground, 0.2) },
  { id: "scrollbarSlider.activeBackground", label: "Scrollbar Thumb Active", description: "Scrollbar thumb color when dragged", category: "editor", deriveDefault: (c) => alpha(c.foreground, 0.3) },

  // ── 6. Widgets & Overlays ─────────────────────────────────────────────────
  { id: "editorWidget.background", label: "Editor Widget Bg", description: "Background for floating editor popups", category: "widgets", isBg: true, deriveDefault: (c) => c.card },
  { id: "editorWidget.foreground", label: "Editor Widget Text", description: "Text color inside floating editor popups", category: "widgets", contrastPairId: "editorWidget.background", deriveDefault: (c) => c.foreground },
  { id: "editorSuggestWidget.background", label: "Suggest / Auto-complete Bg", description: "Background for code completion popover", category: "widgets", isBg: true, deriveDefault: (c) => c.card },
  { id: "editorSuggestWidget.border", label: "Suggest Popover Border", description: "Border around auto-complete popup", category: "widgets", deriveDefault: (c) => c.border },
  { id: "editorSuggestWidget.foreground", label: "Suggest Popover Text", description: "Text color inside auto-complete popup", category: "widgets", contrastPairId: "editorSuggestWidget.background", deriveDefault: (c) => c.foreground },
  { id: "editorSuggestWidget.selectedBackground", label: "Suggest Active Item Bg", description: "Background of selected item in suggest popover", category: "widgets", isBg: true, deriveDefault: (c) => alpha(c.primary, 0.15) },
  { id: "editorSuggestWidget.selectedForeground", label: "Suggest Active Item Text", description: "Text color of selected item in suggest popover", category: "widgets", contrastPairId: "editorSuggestWidget.selectedBackground", deriveDefault: (c) => c.foreground },
  { id: "editorHoverWidget.background", label: "Hover Tooltip Background", description: "Background color of hover tooltips", category: "widgets", isBg: true, deriveDefault: (c) => c.card },
  { id: "editorHoverWidget.foreground", label: "Hover Tooltip Text", description: "Text color of hover tooltips", category: "widgets", contrastPairId: "editorHoverWidget.background", deriveDefault: (c) => c.foreground },
  { id: "input.background", label: "Input Field Background", description: "Background color of text input boxes", category: "widgets", isBg: true, deriveDefault: (c) => c.background },
  { id: "input.foreground", label: "Input Field Text", description: "Text color inside text input boxes", category: "widgets", contrastPairId: "input.background", deriveDefault: (c) => c.foreground },
  { id: "input.placeholderForeground", label: "Input Placeholder Text", description: "Placeholder text color inside text inputs", category: "widgets", contrastPairId: "input.background", deriveDefault: (c) => alpha(c.foreground, 0.4) },
  { id: "dropdown.background", label: "Dropdown Select Bg", description: "Background color of dropdown select menus", category: "widgets", isBg: true, deriveDefault: (c) => c.card },
  { id: "dropdown.foreground", label: "Dropdown Select Text", description: "Text color inside dropdown menus", category: "widgets", contrastPairId: "dropdown.background", deriveDefault: (c) => c.foreground },
  { id: "checkbox.background", label: "Checkbox Background", description: "Background color of checkbox input", category: "widgets", isBg: true, deriveDefault: (c) => c.background },
  { id: "checkbox.foreground", label: "Checkbox Check Mark", description: "Check mark icon color in checkboxes", category: "widgets", contrastPairId: "checkbox.background", deriveDefault: (c) => c.foreground },
  { id: "menu.background", label: "Context Menu Background", description: "Background of context menus", category: "widgets", isBg: true, deriveDefault: (c) => c.card },
  { id: "menu.foreground", label: "Context Menu Text", description: "Text color inside context menus", category: "widgets", contrastPairId: "menu.background", deriveDefault: (c) => c.foreground },
  { id: "menu.selectionBackground", label: "Context Menu Selected Item", description: "Background of selected context menu item", category: "widgets", isBg: true, deriveDefault: (c) => alpha(c.primary, 0.15) },
  { id: "menu.selectionForeground", label: "Context Menu Selected Text", description: "Text of selected context menu item", category: "widgets", contrastPairId: "menu.selectionBackground", deriveDefault: (c) => c.foreground },
  { id: "quickInput.background", label: "Command Palette Bg", description: "Background of Quick Open / Command Palette", category: "widgets", isBg: true, deriveDefault: (c) => c.card },
  { id: "quickInput.foreground", label: "Command Palette Text", description: "Text color inside Command Palette", category: "widgets", contrastPairId: "quickInput.background", deriveDefault: (c) => c.foreground },
  { id: "quickInputList.focusBackground", label: "Command Palette Selection", description: "Selection background inside Command Palette", category: "widgets", deriveDefault: (c) => alpha(c.primary, 0.15) },
  { id: "notifications.background", label: "Notification Toast Bg", description: "Background of popup notification toasts", category: "widgets", isBg: true, deriveDefault: (c) => c.card },
  { id: "notifications.foreground", label: "Notification Toast Text", description: "Text inside popup notification toasts", category: "widgets", contrastPairId: "notifications.background", deriveDefault: (c) => c.foreground },
  { id: "notifications.border", label: "Notification Toast Border", description: "Border around popup notification toasts", category: "widgets", deriveDefault: (c) => c.border },
  { id: "errorForeground", label: "Global Error Red", description: "Color for error messages and indicators", category: "widgets", contrastPairId: "editor.background", deriveDefault: () => "#f87171" },

  // ── 7. Git & Status Decorators ───────────────────────────────────────────
  { id: "gitDecoration.modifiedResourceForeground", label: "Git Modified Color", description: "Tree view label color for modified files", category: "git", contrastPairId: "sideBar.background", deriveDefault: (_, isDark) => (isDark ? "#eab308" : "#ca8a04") },
  { id: "gitDecoration.deletedResourceForeground", label: "Git Deleted Color", description: "Tree view label color for deleted files", category: "git", contrastPairId: "sideBar.background", deriveDefault: (_, isDark) => (isDark ? "#f87171" : "#dc2626") },
  { id: "gitDecoration.addedResourceForeground", label: "Git Added Color", description: "Tree view label color for staged new files", category: "git", contrastPairId: "sideBar.background", deriveDefault: (_, isDark) => (isDark ? "#4ade80" : "#16a34a") },
  { id: "gitDecoration.untrackedResourceForeground", label: "Git Untracked Color", description: "Tree view label color for untracked files", category: "git", contrastPairId: "sideBar.background", deriveDefault: (_, isDark) => (isDark ? "#4ade80" : "#16a34a") },
  { id: "gitDecoration.conflictingResourceForeground", label: "Git Conflict Color", description: "Tree view label color for merge conflicts", category: "git", contrastPairId: "sideBar.background", deriveDefault: (_, isDark) => (isDark ? "#f97316" : "#ea580c") },
  { id: "gitDecoration.submoduleResourceForeground", label: "Git Submodule Color", description: "Tree view label color for git submodules", category: "git", contrastPairId: "sideBar.background", deriveDefault: (_, isDark) => (isDark ? "#a855f7" : "#9333ea") },
  { id: "gitDecoration.ignoredResourceForeground", label: "Git Ignored Color", description: "Tree view label color for .gitignore files", category: "git", contrastPairId: "sideBar.background", deriveDefault: (c) => alpha(c.foreground, 0.4) },
];

function getDerivedTokenValue(tokenId, colors, baseVariant = "dark") {
  const token = VSCODE_TOKEN_REGISTRY.find((t) => t.id === tokenId);
  if (token) {
    return token.deriveDefault(colors, baseVariant === "dark");
  }
  return "#000000";
}

function evaluateThemeTokens(config) {
  const isDark = config.baseVariant === "dark";
  const colors = config.colors;
  const overrides = config.tokenOverrides ?? {};

  const result = {};

  for (const token of VSCODE_TOKEN_REGISTRY) {
    const overrideVal = overrides[token.id];
    if (overrideVal && typeof overrideVal === "string" && overrideVal.trim().length > 0) {
      result[token.id] = overrideVal.trim();
    } else {
      result[token.id] = token.deriveDefault(colors, isDark);
    }
  }

  for (const token of VSCODE_TOKEN_REGISTRY) {
    if (token.contrastPairId && result[token.contrastPairId]) {
      const fgVal = result[token.id];
      const bgVal = result[token.contrastPairId];
      if (fgVal && bgVal) {
        let minRatio = 4.5;
        if (
          token.id.includes("disabled") ||
          token.id.includes("LineNumber") ||
          token.id.includes("ignored") ||
          token.id.includes("Whitespace")
        ) {
          minRatio = 3.0;
        } else if (
          token.id.includes("description") ||
          token.id.includes("placeholder") ||
          token.id.includes("inactive")
        ) {
          minRatio = 3.5;
        }
        result[token.id] = ensureMinContrast(fgVal, bgVal, minRatio, colors.background);
      }
    }
  }

  return result;
}

function runThemeWcagCheck(configOrTokens) {
  const resolvedTokens =
    "colors" in configOrTokens
      ? evaluateThemeTokens(configOrTokens)
      : configOrTokens;

  const canvasBg = resolvedTokens["editor.background"] || "#121824";

  const checkPairs = VSCODE_TOKEN_REGISTRY.filter((t) => Boolean(t.contrastPairId)).map(
    (t) => ({
      fgToken: t.id,
      bgToken: t.contrastPairId,
    })
  );

  const results = [];

  for (const pair of checkPairs) {
    const fgHex = toHexColor(resolvedTokens[pair.fgToken]);
    const bgHex = resolvedTokens[pair.bgToken] || canvasBg;

    const fgMeta = VSCODE_TOKEN_REGISTRY.find((t) => t.id === pair.fgToken);
    const bgMeta = VSCODE_TOKEN_REGISTRY.find((t) => t.id === pair.bgToken);

    let minRatio = 4.5;
    if (
      pair.fgToken.includes("disabled") ||
      pair.fgToken.includes("LineNumber") ||
      pair.fgToken.includes("ignored") ||
      pair.fgToken.includes("Whitespace")
    ) {
      minRatio = 3.0;
    } else if (
      pair.fgToken.includes("description") ||
      pair.fgToken.includes("placeholder") ||
      pair.fgToken.includes("inactive")
    ) {
      minRatio = 3.5;
    }

    const { ratio } = calculateContrastRatio(fgHex, bgHex, canvasBg);
    const isLowContrast = ratio < minRatio;

    results.push({
      fgToken: pair.fgToken,
      bgToken: pair.bgToken,
      fgLabel: fgMeta?.label ?? pair.fgToken,
      bgLabel: bgMeta?.label ?? pair.bgToken,
      fgHex,
      bgHex,
      ratio,
      isLowContrast,
      recommendedFg: isLowContrast ? ensureMinContrast(fgHex, bgHex, minRatio, canvasBg) : undefined,
    });
  }

  return results;
}

module.exports = {
  toHexColor,
  alpha,
  resolveSolidColor,
  calculateLuminance,
  calculateContrastRatio,
  ensureMinContrast,
  getOptimalPrimaryForeground,
  suggestAccessibleFg,
  VSCODE_TOKEN_REGISTRY,
  getDerivedTokenValue,
  evaluateThemeTokens,
  runThemeWcagCheck,
};
