import { GeminiSettings, ProviderDriverKind, validateServerProviderModelList, type ServerProvider } from "@tabs/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { makeGeminiTextGeneration } from "../../textGeneration/GeminiTextGeneration";
import { ProviderAdapterRequestError, ProviderDriverError } from "../Errors";
import type { ProviderAdapterShape } from "../Services/ProviderAdapter";
import { makeManagedServerProvider } from "../makeManagedServerProvider";
import {
  defaultProviderContinuationIdentity,
  type ProviderDriver,
  type ProviderInstance,
} from "../ProviderDriver";
import { buildServerProvider } from "../providerSnapshot";
import { makeManualOnlyProviderMaintenanceCapabilities } from "../providerMaintenance";

const decodeGeminiSettings = Schema.decodeSync(GeminiSettings);

const DRIVER_KIND = "gemini" as ProviderDriverKind;
const SNAPSHOT_REFRESH_INTERVAL = Duration.minutes(5);

const GEMINI_BUILT_IN_MODELS = validateServerProviderModelList([
  {
    slug: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    isCustom: false,
  },
  {
    slug: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    isCustom: false,
  },
  {
    slug: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    isCustom: false,
  },
]);

const withInstanceIdentity =
  (input: {
    readonly instanceId: ProviderInstance["instanceId"];
    readonly displayName: string | undefined;
    readonly accentColor: string | undefined;
    readonly continuationGroupKey: string;
  }) =>
  (snapshot: ReturnType<typeof buildServerProvider>): ServerProvider => ({
    ...snapshot,
    instanceId: input.instanceId,
    driver: DRIVER_KIND,
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(input.accentColor ? { accentColor: input.accentColor } : {}),
    continuation: { groupKey: input.continuationGroupKey },
  });

export const GeminiDriver: ProviderDriver<GeminiSettings, never> = {
  driverKind: DRIVER_KIND,
  metadata: {
    displayName: "Google Gemini",
    supportsMultipleInstances: true,
  },
  configSchema: GeminiSettings,
  defaultConfig: (): GeminiSettings => decodeGeminiSettings({}),
  create: ({ instanceId, displayName, accentColor, enabled, config }) =>
    Effect.gen(function* () {
      const continuationIdentity = defaultProviderContinuationIdentity({
        driverKind: DRIVER_KIND,
        instanceId,
      });
      const stampIdentity = withInstanceIdentity({
        instanceId,
        displayName,
        accentColor,
        continuationGroupKey: continuationIdentity.continuationKey,
      });
      const effectiveConfig = { ...config, enabled } satisfies GeminiSettings;
      const maintenanceCapabilities = makeManualOnlyProviderMaintenanceCapabilities({
        provider: DRIVER_KIND,
        packageName: null,
      });

      const textGeneration = yield* makeGeminiTextGeneration(effectiveConfig);

      const hasApiKey = Boolean(effectiveConfig.apiKey?.trim());

      const checkProvider = Effect.succeed(
        stampIdentity(
          buildServerProvider({
            presentation: { displayName: displayName || "Google Gemini" },
            enabled: effectiveConfig.enabled,
            checkedAt: new Date().toISOString(),
            models: GEMINI_BUILT_IN_MODELS,
            probe: {
              installed: true,
              version: "2.5",
              status: hasApiKey ? "ready" : "warning",
              auth: {
                status: hasApiKey ? "authenticated" : "unauthenticated",
              },
              ...(hasApiKey ? {} : { message: "Gemini API key is not configured." }),
            },
          }),
        ),
      );

      const snapshot = yield* makeManagedServerProvider<GeminiSettings>({
        maintenanceCapabilities,
        getSettings: Effect.succeed(effectiveConfig),
        streamSettings: Stream.never,
        haveSettingsChanged: () => false,
        initialSnapshot: () => checkProvider,
        checkProvider,
        enrichSnapshot: ({ snapshot: currentSnapshot }) => Effect.succeed(currentSnapshot),
        refreshInterval: SNAPSHOT_REFRESH_INTERVAL,
      }).pipe(
        Effect.mapError(
          (cause) =>
            new ProviderDriverError({
              driver: DRIVER_KIND,
              instanceId,
              detail: `Failed to build Gemini snapshot: ${cause.message ?? String(cause)}`,
              cause,
            }),
        ),
      );

      // Gemini is a text-generation-only provider (Code Review). It does NOT
      // support interactive Agent Chat sessions. Every agent-protocol method
      // returns a typed ProviderAdapterRequestError so the error bubbles
      // through ProviderService cleanly instead of producing a
      // `yield* undefined` TypeError that crashes the turn handler.
      const geminiUnsupportedError = (method: string) =>
        new ProviderAdapterRequestError({
          provider: DRIVER_KIND,
          method,
          detail:
            "Google Gemini does not support interactive Agent Chat. " +
            "Select a different provider in the Agents tab. " +
            "Gemini is available for Git Code Review text generation only.",
        });

      const geminiAdapter = {
        provider: DRIVER_KIND,
        capabilities: {
          sessionModelSwitch: "unsupported" as const,
          agentChat: "unsupported" as const,
        },
        streamEvents: Stream.empty,
        startSession: () => Effect.fail(geminiUnsupportedError("startSession")),
        sendTurn: () => Effect.fail(geminiUnsupportedError("sendTurn")),
        interruptTurn: () => Effect.fail(geminiUnsupportedError("interruptTurn")),
        respondToRequest: () => Effect.fail(geminiUnsupportedError("respondToRequest")),
        respondToUserInput: () => Effect.fail(geminiUnsupportedError("respondToUserInput")),
        stopSession: () => Effect.void,
        listSessions: () => Effect.succeed([] as const),
        hasSession: () => Effect.succeed(false),
        readThread: () => Effect.fail(geminiUnsupportedError("readThread")),
        rollbackThread: () => Effect.fail(geminiUnsupportedError("rollbackThread")),
        stopAll: () => Effect.void,
      } satisfies ProviderAdapterShape<ProviderAdapterRequestError>;

      return {
        instanceId,
        driverKind: DRIVER_KIND,
        continuationIdentity,
        displayName,
        accentColor,
        enabled,
        snapshot,
        adapter: geminiAdapter,
        textGeneration,
      } satisfies ProviderInstance;
    }),
};
