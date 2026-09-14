/**
 * Unified settings hook.
 *
 * Abstracts the split between server-authoritative settings (persisted in
 * `settings.json` on the server, fetched via `server.getConfig`) and
 * client-only settings (persisted in localStorage).
 *
 * Consumers use `useSettings(selector)` to read, and `useUpdateSettings()` to
 * write. The hook transparently routes reads/writes to the correct backing
 * store.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ServerSettings,
  ServerSettingsPatch,
  ModelSelection,
  ThreadEnvMode,
} from "@tabs/contracts";
import { DEFAULT_SERVER_SETTINGS } from "@tabs/contracts";
import {
  type ClientSettings,
  DEFAULT_DESKTOP_ICON_THEME,
  DEFAULT_UNIFIED_SETTINGS,
  DesktopIconTheme,
  SidebarProjectSortOrder,
  SidebarThreadSortOrder,
  TimestampFormat,
  UnifiedSettings,
} from "@tabs/contracts/settings";
import { ensureNativeApi } from "~/nativeApi";
import { makeAppModelSelection, normalizeCustomModelSlugs } from "~/modelSelection";
import { Predicate, Schema, Struct } from "effect";
import { DeepMutable } from "effect/Types";
import { deepMerge } from "@tabs/shared/Struct";
import {
  patchServerSettings,
  refreshServerConfig,
  rollbackServerSettings,
  serverConfigAtom,
  setSettingsPersistence,
  updateClientSettings,
  updateSettingsPersistence,
  useClientSettings,
  useServerSettings,
  useSettingsPersistence,
  type SettingsPersistenceState,
  type SettingsSaveStatus,
} from "../state/settings";
import { appAtomRegistry } from "../state/atomRegistry";

const CLIENT_SETTINGS_STORAGE_KEY = "tabs:client-settings:v1";
const OLD_SETTINGS_KEY = "tabs:app-settings:v1";

// ── Key sets for routing patches ─────────────────────────────────────

const SERVER_SETTINGS_KEYS = new Set<string>(Struct.keys(ServerSettings.fields));

function mergeServerSettingsPatch(
  current: ServerSettings,
  patch: ServerSettingsPatch,
): ServerSettings {
  const {
    usageLimitSources: usageLimitSourcesPatch,
    usagePriceOverrides: usagePriceOverridesPatch,
    ...restPatch
  } = patch;
  let next = deepMerge(current, restPatch as any);

  if (usageLimitSourcesPatch) {
    const updatedSources = { ...next.usageLimitSources };
    for (const [id, value] of Object.entries(usageLimitSourcesPatch)) {
      if (value === null) {
        delete (updatedSources as any)[id];
      } else if (value !== undefined) {
        (updatedSources as any)[id] = value;
      }
    }
    next = {
      ...next,
      usageLimitSources: updatedSources as any,
    };
  }

  if (usagePriceOverridesPatch) {
    const updatedOverrides = { ...next.usagePriceOverrides };
    for (const [id, value] of Object.entries(usagePriceOverridesPatch)) {
      if (value === null) {
        delete (updatedOverrides as any)[id];
      } else if (value !== undefined) {
        (updatedOverrides as any)[id] = value;
      }
    }
    next = {
      ...next,
      usagePriceOverrides: updatedOverrides as any,
    };
  }

  const selectionPatch = patch.textGenerationModelSelection;
  if (!selectionPatch) {
    return next;
  }

  const hasProvider = "instanceId" in selectionPatch && selectionPatch.instanceId !== undefined;
  const hasModel = "model" in selectionPatch && selectionPatch.model !== undefined;
  const hasOptions = "options" in selectionPatch;

  if (hasProvider || hasModel) {
    return {
      ...next,
      textGenerationModelSelection: makeAppModelSelection(
        selectionPatch.instanceId ?? current.textGenerationModelSelection.instanceId,
        selectionPatch.model ?? current.textGenerationModelSelection.model,
        hasOptions
          ? (selectionPatch.options ?? null)
          : current.textGenerationModelSelection.options,
      ) as unknown as ServerSettings["textGenerationModelSelection"],
    };
  }

  if (hasOptions) {
    return {
      ...next,
      textGenerationModelSelection: {
        ...current.textGenerationModelSelection,
        ...(selectionPatch.options
          ? {
              options: deepMerge(
                current.textGenerationModelSelection.options ?? {},
                selectionPatch.options,
              ),
            }
          : {}),
      } as ServerSettings["textGenerationModelSelection"],
    };
  }

  return next;
}

function splitPatch(patch: Partial<UnifiedSettings>): {
  serverPatch: ServerSettingsPatch;
  clientPatch: Partial<ClientSettings>;
} {
  const serverPatch: Record<string, unknown> = {};
  const clientPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (SERVER_SETTINGS_KEYS.has(key)) {
      serverPatch[key] = value;
    } else {
      clientPatch[key] = value;
    }
  }
  return {
    serverPatch: serverPatch as ServerSettingsPatch,
    clientPatch: clientPatch as Partial<ClientSettings>,
  };
}

// ── Hooks ────────────────────────────────────────────────────────────

/**
 * Read merged settings. Selector narrows the subscription so components
 * only re-render when the slice they care about changes.
 */

export function useSettings<T = UnifiedSettings>(selector?: (s: UnifiedSettings) => T): T {
  const serverSettings = useServerSettings();
  const clientSettings = useClientSettings();

  const merged = useMemo<UnifiedSettings>(
    () => ({
      ...clientSettings,
      ...serverSettings,
    }),
    [serverSettings, clientSettings],
  );

  return useMemo(
    () => (selector ? selector(merged) : (merged as unknown as T)),
    [merged, selector],
  );
}

let latestServerUpdateSequence = 0;
let savedTimeoutId: ReturnType<typeof setTimeout> | null = null;
let serverUpdateQueue: Promise<void> = Promise.resolve();

/**
 * Applies a settings patch directly to the appropriate backing store (server via RPC,
 * client via localStorage) with optimistic update, rollback on server rejection,
 * and out-of-order sequence protection.
 */
export function applySettingsUpdate(patch: Record<string, any>): Promise<boolean> {
  const { serverPatch, clientPatch } = splitPatch(patch);
  const hasServerPatch = Object.keys(serverPatch).length > 0;
  const hasClientPatch = Object.keys(clientPatch).length > 0;

  if (hasClientPatch) {
    try {
      updateClientSettings((current) => ({ ...current, ...clientPatch }));
      if (!hasServerPatch) {
        setSettingsPersistence({
          status: "saved",
          error: null,
          lastSavedAt: Date.now(),
          failedPatch: null,
          retry: null,
        });
        if (savedTimeoutId) clearTimeout(savedTimeoutId);
        savedTimeoutId = setTimeout(() => {
          updateSettingsPersistence((prev) =>
            prev.status === "saved" ? { ...prev, status: "idle" } : prev,
          );
        }, 3000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to save client settings";
      setSettingsPersistence({
        status: "failed",
        error: errorMsg,
        lastSavedAt: null,
        failedPatch: patch,
        retry: () => applySettingsUpdate(patch),
      });
      return Promise.resolve(false);
    }
  }

  if (hasServerPatch) {
    const currentSeq = ++latestServerUpdateSequence;
    const currentConfig = appAtomRegistry.get(serverConfigAtom);
    const previousSettings = currentConfig?.settings ?? DEFAULT_SERVER_SETTINGS;

    patchServerSettings(serverPatch, (current) => mergeServerSettingsPatch(current, serverPatch));

    setSettingsPersistence({
      status: "saving",
      error: null,
      lastSavedAt: null,
      failedPatch: null,
      retry: null,
    });

    const serverUpdate = serverUpdateQueue.then(() =>
      ensureNativeApi().server.updateSettings(serverPatch),
    );
    serverUpdateQueue = serverUpdate.then(
      () => undefined,
      () => undefined,
    );

    return serverUpdate
      .then(async () => {
        if (currentSeq === latestServerUpdateSequence) {
          await refreshServerConfig();
          setSettingsPersistence({
            status: "saved",
            error: null,
            lastSavedAt: Date.now(),
            failedPatch: null,
            retry: null,
          });
          if (savedTimeoutId) clearTimeout(savedTimeoutId);
          savedTimeoutId = setTimeout(() => {
            if (latestServerUpdateSequence === currentSeq) {
              updateSettingsPersistence((prev) =>
                prev.status === "saved" ? { ...prev, status: "idle" } : prev,
              );
            }
          }, 3000);
        }
        return true;
      })
      .catch(async (err) => {
        if (currentSeq === latestServerUpdateSequence) {
          const refreshedConfig = await refreshServerConfig();
          if (!refreshedConfig) {
            rollbackServerSettings(previousSettings);
          }
          const errorMsg =
            err instanceof Error ? err.message : String(err ?? "Failed to save settings");
          setSettingsPersistence({
            status: "failed",
            error: errorMsg,
            lastSavedAt: null,
            failedPatch: serverPatch,
            retry: () => applySettingsUpdate(serverPatch),
          });
        }
        return false;
      });
  }

  return Promise.resolve(true);
}

/**
 * Returns an updater that routes each key to the correct backing store.
 *
 * Server keys are optimistically patched in the local state, then
 * persisted via RPC. If the RPC fails, the change is rolled back and the failure
 * is surfaced with a retry callback. Client keys go directly to localStorage.
 */
export function useUpdateSettings() {
  const updateSettings = useCallback(
    (patch: Record<string, any>): Promise<boolean> => applySettingsUpdate(patch),
    [],
  );

  const resetSettings = useCallback(() => {
    return applySettingsUpdate(DEFAULT_UNIFIED_SETTINGS);
  }, []);

  return {
    updateSettings,
    resetSettings,
  };
}

/**
 * Controller for debouncing rapid settings updates (e.g. text fields or sliders)
 * and flushing pending changes on demand.
 */
export function createDebouncedSettingsUpdater(
  updater: (patch: Record<string, any>) => Promise<boolean> = applySettingsUpdate,
  delay = 300,
) {
  let pendingPatch: Record<string, any> = {};
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): Promise<boolean> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const patch = { ...pendingPatch };
    if (Object.keys(patch).length > 0) {
      pendingPatch = {};
      return updater(patch);
    }
    return Promise.resolve(true);
  };

  const queueUpdate = (patch: Record<string, any>) => {
    pendingPatch = {
      ...pendingPatch,
      ...patch,
    };
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pendingPatch = {};
  };

  return {
    updateSettings: queueUpdate,
    flush,
    cancel,
    getPendingPatch: () => pendingPatch,
  };
}

/**
 * Hook for debouncing rapid settings updates (e.g. text fields or sliders)
 * and automatically flushing pending changes on blur or window unload.
 */
export function useDebouncedSettingsUpdate(delay = 300) {
  const { updateSettings } = useUpdateSettings();
  const updaterRef = useRef<ReturnType<typeof createDebouncedSettingsUpdater> | null>(null);
  if (!updaterRef.current) {
    updaterRef.current = createDebouncedSettingsUpdater(updateSettings, delay);
  }

  useEffect(() => {
    const handleBeforeUnload = () => {
      void updaterRef.current?.flush();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        void updaterRef.current?.flush();
      };
    }
    return () => {
      void updaterRef.current?.flush();
    };
  }, []);

  return {
    updateSettings: updaterRef.current.updateSettings,
    flush: updaterRef.current.flush,
    pendingPatch: updaterRef.current.getPendingPatch(),
  };
}

export { useSettingsPersistence, type SettingsPersistenceState, type SettingsSaveStatus };

// ── One-time migration from localStorage ─────────────────────────────

export function buildLegacyServerSettingsMigrationPatch(
  legacySettings: Record<string, unknown>,
): ServerSettingsPatch {
  const patch: DeepMutable<ServerSettingsPatch> = {};

  if (Predicate.isBoolean(legacySettings.enableAssistantStreaming)) {
    patch.enableAssistantStreaming = legacySettings.enableAssistantStreaming;
  }

  if (Schema.is(ThreadEnvMode)(legacySettings.defaultThreadEnvMode)) {
    patch.defaultThreadEnvMode = legacySettings.defaultThreadEnvMode;
  }

  if (Schema.is(ModelSelection)(legacySettings.textGenerationModelSelection)) {
    patch.textGenerationModelSelection =
      legacySettings.textGenerationModelSelection as unknown as NonNullable<
        (typeof patch)["textGenerationModelSelection"]
      >;
  }

  if (typeof legacySettings.codexBinaryPath === "string") {
    patch.providers ??= {};
    patch.providers.codex ??= {};
    patch.providers.codex.binaryPath = legacySettings.codexBinaryPath;
  }

  if (typeof legacySettings.codexHomePath === "string") {
    patch.providers ??= {};
    patch.providers.codex ??= {};
    patch.providers.codex.homePath = legacySettings.codexHomePath;
  }

  if (Array.isArray(legacySettings.customCodexModels)) {
    patch.providers ??= {};
    patch.providers.codex ??= {};
    patch.providers.codex.customModels = normalizeCustomModelSlugs(
      legacySettings.customCodexModels,
      new Set<string>(),
      "codex",
    );
  }

  if (Predicate.isString(legacySettings.claudeBinaryPath)) {
    patch.providers ??= {};
    patch.providers.claudeAgent ??= {};
    patch.providers.claudeAgent.binaryPath = legacySettings.claudeBinaryPath;
  }

  if (Array.isArray(legacySettings.customClaudeModels)) {
    patch.providers ??= {};
    patch.providers.claudeAgent ??= {};
    patch.providers.claudeAgent.customModels = normalizeCustomModelSlugs(
      legacySettings.customClaudeModels,
      new Set<string>(),
      "claudeAgent",
    );
  }

  if (Array.isArray(legacySettings.favorites)) {
    patch.favorites = legacySettings.favorites as NonNullable<(typeof patch)["favorites"]>;
  }

  return patch;
}

export function buildLegacyClientSettingsMigrationPatch(
  legacySettings: Record<string, unknown>,
): Partial<DeepMutable<ClientSettings>> {
  const patch: Partial<DeepMutable<ClientSettings>> = {};

  if (Predicate.isBoolean(legacySettings.confirmThreadDelete)) {
    patch.confirmThreadDelete = legacySettings.confirmThreadDelete;
  }

  if (Schema.is(DesktopIconTheme)(legacySettings.desktopIconTheme)) {
    patch.desktopIconTheme = legacySettings.desktopIconTheme;
  } else if (Predicate.isString(legacySettings.desktopIconTheme)) {
    patch.desktopIconTheme = DEFAULT_DESKTOP_ICON_THEME;
  }

  if (Predicate.isBoolean(legacySettings.diffWordWrap)) {
    patch.diffWordWrap = legacySettings.diffWordWrap;
  }

  if (Schema.is(SidebarProjectSortOrder)(legacySettings.sidebarProjectSortOrder)) {
    patch.sidebarProjectSortOrder = legacySettings.sidebarProjectSortOrder;
  }

  if (Schema.is(SidebarThreadSortOrder)(legacySettings.sidebarThreadSortOrder)) {
    patch.sidebarThreadSortOrder = legacySettings.sidebarThreadSortOrder;
  }

  if (Schema.is(TimestampFormat)(legacySettings.timestampFormat)) {
    patch.timestampFormat = legacySettings.timestampFormat;
  }

  return patch;
}

/**
 * Call once on app startup.
 * If the legacy localStorage key exists, migrate its values to the new server
 * and client storage formats, then remove the legacy key so this only runs once.
 */
export function migrateLocalSettingsToServer(): void {
  if (typeof window === "undefined") return;

  const raw = localStorage.getItem(OLD_SETTINGS_KEY);
  if (!raw) return;

  try {
    const old = JSON.parse(raw);
    if (!Predicate.isObject(old)) return;

    // Migrate server-relevant keys via RPC
    const serverPatch = buildLegacyServerSettingsMigrationPatch(old);
    if (Object.keys(serverPatch).length > 0) {
      const api = ensureNativeApi();
      void api.server.updateSettings(serverPatch);
    }

    // Migrate client-only keys to the new localStorage key
    const clientPatch = buildLegacyClientSettingsMigrationPatch(old);
    if (Object.keys(clientPatch).length > 0) {
      const existing = localStorage.getItem(CLIENT_SETTINGS_STORAGE_KEY);
      const current = existing ? (JSON.parse(existing) as Record<string, unknown>) : {};
      localStorage.setItem(
        CLIENT_SETTINGS_STORAGE_KEY,
        JSON.stringify({ ...current, ...clientPatch }),
      );
    }
  } catch (error) {
    console.error("[MIGRATION] Error migrating local settings:", error);
  } finally {
    // Remove the legacy key regardless to keep migration one-shot behavior.
    localStorage.removeItem(OLD_SETTINGS_KEY);
  }
}
