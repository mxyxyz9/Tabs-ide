import { useCallback, useEffect, useSyncExternalStore } from "react";
import { evaluateThemeTokens } from "@tabs/shared/themeDerivation";
import {
  DEFAULT_CUSTOM_THEME,
  DEFAULT_FONT_PREFERENCES,
  DEFAULT_THEME_ID,
  THEME_DEFINITIONS,
  getOptimalPrimaryForeground,
  type CustomThemeConfig,
  type FontPreferences,
  type ThemeDefinition,
  type ThemeId,
  type ThemePreference,
} from "../lib/themes";

type ThemeSnapshot = {
  theme: ThemePreference;
  systemDark: boolean;
};

const STORAGE_KEY = "tabs:theme";
const CUSTOM_STORAGE_KEY = "tabs:custom-theme";
const FONT_PREFERENCES_STORAGE_KEY = "tabs:font-preferences";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let listeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let lastDesktopTheme: string | null = null;

function emitChange() {
  for (const listener of listeners) listener();
}

function getSystemDark(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

export function getStoredFontPreferences(): FontPreferences {
  try {
    const raw = localStorage.getItem(FONT_PREFERENCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          uiFont: parsed.uiFont || DEFAULT_FONT_PREFERENCES.uiFont,
          headingFont: parsed.headingFont || parsed.uiFont || DEFAULT_FONT_PREFERENCES.headingFont,
          editorFont: parsed.editorFont || DEFAULT_FONT_PREFERENCES.editorFont,
        };
      }
    }
    const customConfig = getStoredCustomThemeConfig();
    if (customConfig && customConfig.fonts) {
      return {
        uiFont: customConfig.fonts.uiFont || DEFAULT_FONT_PREFERENCES.uiFont,
        headingFont: customConfig.fonts.uiFont || DEFAULT_FONT_PREFERENCES.headingFont,
        editorFont: customConfig.fonts.editorFont || DEFAULT_FONT_PREFERENCES.editorFont,
      };
    }
  } catch (err) {
    // Ignore JSON errors
  }
  return DEFAULT_FONT_PREFERENCES;
}

export function getStoredCustomThemeConfig(): CustomThemeConfig {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.colors && parsed.fonts) {
        return {
          baseVariant: parsed.baseVariant === "light" ? "light" : "dark",
          colors: {
            background: parsed.colors.background || DEFAULT_CUSTOM_THEME.colors.background,
            foreground: parsed.colors.foreground || DEFAULT_CUSTOM_THEME.colors.foreground,
            card: parsed.colors.card || DEFAULT_CUSTOM_THEME.colors.card,
            border: parsed.colors.border || DEFAULT_CUSTOM_THEME.colors.border,
            primary: parsed.colors.primary || DEFAULT_CUSTOM_THEME.colors.primary,
          },
          fonts: {
            uiFont: parsed.fonts.uiFont || DEFAULT_CUSTOM_THEME.fonts.uiFont,
            editorFont: parsed.fonts.editorFont || DEFAULT_CUSTOM_THEME.fonts.editorFont,
          },
        };
      }
    }
  } catch (err) {
    // Ignore JSON errors
  }
  return DEFAULT_CUSTOM_THEME;
}

function getStoredPreference(): ThemePreference {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return "system";
  if (raw === "system") return "system";
  if (raw === "light") return "tabs-light";
  if (raw === "dark") return "tabs-dark";
  if (raw === "custom" || raw in THEME_DEFINITIONS) return raw as ThemeId;
  return "system";
}

export function resolveActiveThemeId(preference: ThemePreference): ThemeId {
  if (preference === "system") {
    return getSystemDark() ? "tabs-dark" : "tabs-light";
  }
  if (preference === "custom" || preference in THEME_DEFINITIONS) {
    return preference;
  }
  return DEFAULT_THEME_ID;
}

function applyTheme(
  preference: ThemePreference,
  suppressTransitions = false,
  customConfigOverride?: CustomThemeConfig,
  fontPreferencesOverride?: FontPreferences,
) {
  if (suppressTransitions) {
    document.documentElement.classList.add("no-transitions");
  }

  const fonts = fontPreferencesOverride ?? getStoredFontPreferences();
  const rootStyle = document.documentElement?.style;
  if (rootStyle) {
    rootStyle.setProperty("--font-sans", fonts.uiFont);
    rootStyle.setProperty("--font-display", fonts.headingFont || fonts.uiFont);
    rootStyle.setProperty("--font-mono", fonts.editorFont);
  }

  const activeThemeId = resolveActiveThemeId(preference);

  let config: CustomThemeConfig;
  if (activeThemeId === "custom") {
    config = customConfigOverride ?? getStoredCustomThemeConfig();
  } else {
    const def = THEME_DEFINITIONS[activeThemeId] ?? THEME_DEFINITIONS[DEFAULT_THEME_ID];
    config = {
      baseVariant: def.baseVariant,
      colors: {
        background: def.colors.background,
        foreground: def.colors.foreground,
        card: def.colors.card,
        border: def.colors.border,
        primary: def.colors.primary,
      },
      fonts: getStoredFontPreferences(),
    };
  }

  const isDark = config.baseVariant === "dark";
  const evaluatedTokens = evaluateThemeTokens(config);

  const background = evaluatedTokens["editor.background"] || config.colors.background;
  const cardBg = evaluatedTokens["app.cardBackground"] || config.colors.card;
  const cardFg = evaluatedTokens["app.cardForeground"] || config.colors.foreground;
  const foreground = evaluatedTokens["foreground"] || config.colors.foreground;
  const border = evaluatedTokens["sideBar.border"] || config.colors.border;
  const primary = evaluatedTokens["app.primaryBackground"] || config.colors.primary;
  const primaryFg = evaluatedTokens["app.primaryForeground"] || getOptimalPrimaryForeground(primary);

  const secondaryBg = evaluatedTokens["app.secondaryBackground"] || cardBg;
  const secondaryFg = evaluatedTokens["app.secondaryForeground"] || foreground;
  const accentBg = evaluatedTokens["app.accentBackground"] || cardBg;
  const accentFg = evaluatedTokens["app.accentForeground"] || foreground;
  const popoverBg = evaluatedTokens["app.popoverBackground"] || cardBg;
  const popoverFg = evaluatedTokens["app.popoverForeground"] || foreground;
  const mutedBg = evaluatedTokens["app.mutedBackground"] || cardBg;
  const mutedFg = evaluatedTokens["app.mutedForeground"] || foreground;
  const destructiveBg = evaluatedTokens["app.destructiveBackground"] || "#dc2626";
  const destructiveFg = evaluatedTokens["app.destructiveForeground"] || "#ffffff";

  document.documentElement?.classList?.toggle("dark", isDark);
  document.documentElement?.setAttribute?.("data-theme", activeThemeId);

  const style = document.documentElement?.style;
  if (style) {
    const accentWashBg = `color-mix(in srgb, ${primary} 12%, transparent)`;
    const accentWashBorder = `color-mix(in srgb, ${primary} 32%, transparent)`;

    // App shell core tokens
    style.setProperty("--background", background);
    style.setProperty("--app-chrome-background", background);
    style.setProperty("--foreground", foreground);
    style.setProperty("--card", cardBg);
    style.setProperty("--card-foreground", cardFg);
    style.setProperty("--popover", popoverBg);
    style.setProperty("--popover-foreground", popoverFg);
    style.setProperty("--muted", mutedBg);
    style.setProperty("--muted-foreground", mutedFg);
    style.setProperty("--secondary", secondaryBg);
    style.setProperty("--secondary-foreground", secondaryFg);
    style.setProperty("--accent", accentBg);
    style.setProperty("--accent-foreground", accentFg);
    style.setProperty("--border", border);
    style.setProperty("--input", border);
    style.setProperty("--ring", primary);
    style.setProperty("--primary", primary);
    style.setProperty("--primary-foreground", primaryFg);
    style.setProperty("--destructive", destructiveBg);
    style.setProperty("--destructive-foreground", destructiveFg);
    style.setProperty("--accent-wash-bg", accentWashBg);
    style.setProperty("--accent-wash-border", accentWashBorder);

    // Inject all evaluated token variables onto root style so components can read them
    Object.entries(evaluatedTokens).forEach(([key, val]) => {
      const cssVarName = `--vscode-${key.replace(/\./g, "-")}`;
      style.setProperty(cssVarName, val);
    });

    // Text opacity scale
    [90, 80, 60, 50, 40, 30, 20, 10].forEach((pct) => {
      style.setProperty(`--fg-${pct}`, `color-mix(in srgb, ${foreground} ${pct}%, transparent)`);
    });

    // Sidebar tokens
    style.setProperty("--sidebar-background", cardBg);
    style.setProperty("--sidebar-foreground", foreground);
    style.setProperty("--sidebar-border", border);
    style.setProperty("--sidebar-accent", accentBg);
    style.setProperty("--sidebar-accent-foreground", accentFg);
    style.setProperty("--sidebar-primary", primary);
    style.setProperty("--sidebar-primary-foreground", primaryFg);

    // Code-OSS tokens
    style.setProperty("--tabs-bg", background);
    style.setProperty("--tabs-bg-sidebar", cardBg);
    style.setProperty("--tabs-bg-elevated", cardBg);
    style.setProperty("--tabs-bg-popover", popoverBg);
    style.setProperty("--tabs-input-bg", cardBg);
    style.setProperty("--tabs-text", foreground);
    style.setProperty("--tabs-text-muted", mutedFg);
    style.setProperty("--tabs-accent", primary);
    style.setProperty("--tabs-accent-strong", primary);
    style.setProperty("--tabs-accent-soft", `color-mix(in srgb, ${primary} 15%, transparent)`);

    style.setProperty("--code-oss-bg", background);
    style.setProperty("--code-oss-bg-sidebar", cardBg);
    style.setProperty("--code-oss-bg-elevated", cardBg);
    style.setProperty("--code-oss-bg-popover", popoverBg);
    style.setProperty("--code-oss-input-bg", cardBg);
    style.setProperty("--code-oss-text", foreground);
    style.setProperty("--code-oss-text-muted", mutedFg);
    style.setProperty("--code-oss-accent", primary);
  }

  syncDesktopTheme(activeThemeId, activeThemeId === "custom" ? config : undefined, fonts);

  if (typeof document !== "undefined" && document.documentElement) {
    // Synchronous layout reflow to flush DOM style recalculation
    void document.documentElement.offsetHeight;
    if (document.body) {
      void document.body.offsetHeight;
    }
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event("resize"));
    }
  }

  if (suppressTransitions && typeof document !== "undefined" && document.documentElement) {
    requestAnimationFrame(() => {
      if (typeof document !== "undefined" && document.documentElement) {
        void document.documentElement.offsetHeight;
      }
      document.documentElement?.classList?.remove("no-transitions");
    });
  }
}

function syncDesktopTheme(
  themeId: string,
  customConfig?: CustomThemeConfig,
  fontPreferences?: FontPreferences,
) {
  const bridge = window.desktopBridge;
  if (!bridge) {
    return;
  }

  const fonts = fontPreferences ?? getStoredFontPreferences();
  const payload =
    themeId === "custom" && customConfig
      ? { themeId, customConfig, fontPreferences: fonts }
      : { themeId, fontPreferences: fonts };
  lastDesktopTheme = themeId;
  void bridge.setTheme(payload as any).catch(() => {
    if (lastDesktopTheme === themeId) {
      lastDesktopTheme = null;
    }
  });
}

// Apply immediately on module load to prevent flash
applyTheme(getStoredPreference());

function getSnapshot(): ThemeSnapshot {
  const theme = getStoredPreference();
  const systemDark = theme === "system" ? getSystemDark() : false;

  if (lastSnapshot && lastSnapshot.theme === theme && lastSnapshot.systemDark === systemDark) {
    return lastSnapshot;
  }

  lastSnapshot = { theme, systemDark };
  return lastSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);

  // Listen for system preference changes
  const mq = window.matchMedia(MEDIA_QUERY);
  const handleChange = () => {
    if (getStoredPreference() === "system") applyTheme("system", true);
    emitChange();
  };
  mq.addEventListener("change", handleChange);

  // Listen for storage changes from other tabs
  const handleStorage = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEY ||
      e.key === CUSTOM_STORAGE_KEY ||
      e.key === FONT_PREFERENCES_STORAGE_KEY
    ) {
      applyTheme(getStoredPreference(), true);
      emitChange();
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners = listeners.filter((l) => l !== listener);
    mq.removeEventListener("change", handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const theme = snapshot.theme;

  const activeThemeId = resolveActiveThemeId(theme);
  const themeDef = THEME_DEFINITIONS[activeThemeId] ?? THEME_DEFINITIONS[DEFAULT_THEME_ID];
  const resolvedTheme: "light" | "dark" = themeDef.baseVariant;

  const setTheme = useCallback((next: ThemePreference | "light" | "dark") => {
    const normalized: ThemePreference =
      next === "light" ? "tabs-light" : next === "dark" ? "tabs-dark" : next;
    localStorage.setItem(STORAGE_KEY, normalized);
    applyTheme(normalized, true);
    emitChange();
  }, []);

  const setCustomThemeConfig = useCallback((config: CustomThemeConfig) => {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(config));
    applyTheme("custom", true, config);
    emitChange();
  }, []);

  const setFontPreferences = useCallback(
    (next: FontPreferences | ((prev: FontPreferences) => FontPreferences)) => {
      const current = getStoredFontPreferences();
      const updated = typeof next === "function" ? next(current) : next;
      localStorage.setItem(FONT_PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
      applyTheme(getStoredPreference(), true, undefined, updated);
      emitChange();
    },
    [],
  );

  // Keep DOM in sync on mount/change
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    activeThemeId,
    themeDef,
    resolvedTheme,
    customThemeConfig: getStoredCustomThemeConfig(),
    setCustomThemeConfig,
    fontPreferences: getStoredFontPreferences(),
    setFontPreferences,
  } as const;
}

