import { useCallback, useEffect, useSyncExternalStore } from "react";
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

  if (activeThemeId === "custom") {
    const config = customConfigOverride ?? getStoredCustomThemeConfig();
    const isDark = config.baseVariant === "dark";
    const primaryFg = getOptimalPrimaryForeground(config.colors.primary);

    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.setAttribute("data-theme", "custom");

    // Live CSS variable injection for custom theme
    const style = document.documentElement.style;
    const mutedFg = isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(15, 23, 42, 0.65)";
    const mutedBg = `color-mix(in srgb, ${config.colors.foreground} 6%, ${config.colors.card})`;
    const accentBg = `color-mix(in srgb, ${config.colors.primary} 12%, transparent)`;
    const accentBorder = `color-mix(in srgb, ${config.colors.primary} 32%, transparent)`;

    style.setProperty("--background", config.colors.background);
    style.setProperty("--app-chrome-background", config.colors.background);
    style.setProperty("--foreground", config.colors.foreground);
    style.setProperty("--card", config.colors.card);
    style.setProperty("--card-foreground", config.colors.foreground);
    style.setProperty("--popover", config.colors.card);
    style.setProperty("--popover-foreground", config.colors.foreground);
    style.setProperty("--muted", mutedBg);
    style.setProperty("--muted-foreground", mutedFg);
    style.setProperty("--secondary", mutedBg);
    style.setProperty("--secondary-foreground", config.colors.foreground);
    style.setProperty("--accent", mutedBg);
    style.setProperty("--accent-foreground", config.colors.foreground);
    style.setProperty("--border", config.colors.border);
    style.setProperty("--input", config.colors.border);
    style.setProperty("--ring", config.colors.primary);
    style.setProperty("--primary", config.colors.primary);
    style.setProperty("--primary-foreground", primaryFg);
    style.setProperty("--accent-wash-bg", accentBg);
    style.setProperty("--accent-wash-border", accentBorder);

    style.setProperty("--sidebar-background", config.colors.card);
    style.setProperty("--sidebar-foreground", config.colors.foreground);
    style.setProperty("--sidebar-border", config.colors.border);
    style.setProperty("--sidebar-accent", mutedBg);
    style.setProperty("--sidebar-accent-foreground", config.colors.foreground);
    style.setProperty("--sidebar-primary", config.colors.primary);
    style.setProperty("--sidebar-primary-foreground", primaryFg);

    style.setProperty("--code-oss-bg", config.colors.background);
    style.setProperty("--code-oss-bg-sidebar", config.colors.card);
    style.setProperty("--code-oss-bg-elevated", config.colors.card);
    style.setProperty("--code-oss-bg-popover", config.colors.card);
    style.setProperty("--code-oss-input-bg", config.colors.card);
    style.setProperty("--code-oss-text", config.colors.foreground);
    style.setProperty("--code-oss-text-muted", mutedFg);
    style.setProperty("--code-oss-accent", config.colors.primary);

    syncDesktopTheme("custom", config, fonts);
  } else {
    // Clean up custom inline color CSS properties when switching back to curated themes
    const style = document.documentElement?.style;
    if (style && typeof style.removeProperty === "function") {
      [
        "--background",
        "--app-chrome-background",
        "--foreground",
        "--card",
        "--card-foreground",
        "--popover",
        "--popover-foreground",
        "--muted",
        "--muted-foreground",
        "--secondary",
        "--secondary-foreground",
        "--accent",
        "--accent-foreground",
        "--border",
        "--input",
        "--ring",
        "--primary",
        "--primary-foreground",
        "--accent-wash-bg",
        "--accent-wash-border",
        "--sidebar-background",
        "--sidebar-foreground",
        "--sidebar-border",
        "--sidebar-accent",
        "--sidebar-accent-foreground",
        "--sidebar-primary",
        "--sidebar-primary-foreground",
        "--code-oss-bg",
        "--code-oss-bg-sidebar",
        "--code-oss-bg-elevated",
        "--code-oss-bg-popover",
        "--code-oss-input-bg",
        "--code-oss-text",
        "--code-oss-text-muted",
        "--code-oss-accent",
      ].forEach((prop) => style.removeProperty(prop));
    }

    const definition: ThemeDefinition =
      THEME_DEFINITIONS[activeThemeId] ?? THEME_DEFINITIONS[DEFAULT_THEME_ID];
    const isDark = definition.baseVariant === "dark";

    document.documentElement?.classList?.toggle("dark", isDark);
    document.documentElement?.setAttribute?.("data-theme", activeThemeId);

    syncDesktopTheme(activeThemeId, undefined, fonts);
  }

  if (typeof document !== "undefined" && document.documentElement) {
    // Synchronous layout reflow to flush DOM style recalculation
    void document.documentElement.offsetHeight;
    if (document.body) {
      void document.body.offsetHeight;
    }
    // Invalidate Chromium GPU compositor backdrop-filter texture layers
    window.dispatchEvent(new Event("resize"));
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

