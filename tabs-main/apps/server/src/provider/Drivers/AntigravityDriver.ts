import { AntigravitySettings, ProviderDriverKind, type ServerProvider } from "@tabs/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ChildProcessSpawner } from "effect/unstable/process";

import { makeUnsupportedTextGeneration } from "../../textGeneration/UnsupportedTextGeneration";
import { ProviderAdapterRequestError, ProviderDriverError } from "../Errors";
import type { ProviderAdapterShape } from "../Services/ProviderAdapter";
import { makeManagedServerProvider } from "../makeManagedServerProvider";
import { checkAntigravityProviderStatus } from "../Layers/AntigravityProvider";
import {
  defaultProviderContinuationIdentity,
  makeProviderInstanceCapabilities,
  type ProviderDriver,
  type ProviderInstance,
} from "../ProviderDriver";
import { buildServerProvider } from "../providerSnapshot";
import { makeProviderMaintenanceCapabilities } from "../providerMaintenance";
import { mergeProviderInstanceEnvironment } from "../ProviderInstanceEnvironment";

const decodeAntigravitySettings = Schema.decodeSync(AntigravitySettings);

const DRIVER_KIND = "antigravity" as ProviderDriverKind;
const SNAPSHOT_REFRESH_INTERVAL = Duration.minutes(5);

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

export type AntigravityDriverEnv = ChildProcessSpawner.ChildProcessSpawner;

export const AntigravityDriver: ProviderDriver<AntigravitySettings, AntigravityDriverEnv> = {
  driverKind: DRIVER_KIND,
  metadata: {
    displayName: "Antigravity",
    supportsMultipleInstances: true,
  },
  configSchema: AntigravitySettings,
  defaultConfig: (): AntigravitySettings => decodeAntigravitySettings({}),
  create: ({ instanceId, displayName, accentColor, environment, enabled, config }) =>
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const processEnv = mergeProviderInstanceEnvironment(environment);
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
      const effectiveConfig = { ...config, enabled } satisfies AntigravitySettings;
      const maintenanceCapabilities = makeProviderMaintenanceCapabilities({
        provider: DRIVER_KIND,
        packageName: null,
        updateExecutable: "agy",
        updateArgs: ["update"],
        updateLockKey: "antigravity-native",
      });

      const textGeneration = makeUnsupportedTextGeneration("Antigravity");
      const checkProvider = checkAntigravityProviderStatus(effectiveConfig, processEnv).pipe(
        Effect.map(stampIdentity),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      );

      const snapshot = yield* makeManagedServerProvider<AntigravitySettings>({
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
              detail: `Failed to build Antigravity snapshot: ${cause.message ?? String(cause)}`,
              cause,
            }),
        ),
      );

      // Antigravity is a text-generation-only provider (Code Review). It does NOT
      // support interactive Agent Chat sessions. Every agent-protocol method
      // returns a typed ProviderAdapterRequestError so the error bubbles
      // through ProviderService cleanly instead of producing a
      // `yield* undefined` TypeError that crashes the turn handler.
      const antigravityUnsupportedError = (method: string) =>
        new ProviderAdapterRequestError({
          provider: DRIVER_KIND,
          method,
          detail:
            "Antigravity session support requires the Agent Gateway MCP injection point, which tabs-main does not currently expose.",
        });

      const antigravityAdapter = {
        provider: DRIVER_KIND,
        capabilities: {
          sessionModelSwitch: "unsupported" as const,
          agentChat: "unsupported" as const,
        },
        streamEvents: Stream.empty,
        startSession: () => Effect.fail(antigravityUnsupportedError("startSession")),
        sendTurn: () => Effect.fail(antigravityUnsupportedError("sendTurn")),
        interruptTurn: () => Effect.fail(antigravityUnsupportedError("interruptTurn")),
        respondToRequest: () => Effect.fail(antigravityUnsupportedError("respondToRequest")),
        respondToUserInput: () => Effect.fail(antigravityUnsupportedError("respondToUserInput")),
        stopSession: () => Effect.void,
        listSessions: () => Effect.succeed([] as const),
        hasSession: () => Effect.succeed(false),
        readThread: () => Effect.fail(antigravityUnsupportedError("readThread")),
        rollbackThread: () => Effect.fail(antigravityUnsupportedError("rollbackThread")),
        stopAll: () => Effect.void,
      } satisfies ProviderAdapterShape<ProviderAdapterRequestError>;

      return {
        instanceId,
        driverKind: DRIVER_KIND,
        continuationIdentity,
        displayName,
        accentColor,
        enabled,
        capabilities: makeProviderInstanceCapabilities({
          modelDiscovery: "runtime",
          textGeneration: "unsupported",
          structuredGeneration: "unsupported",
          login: "external",
          logout: "external",
          accountSwitch: "external",
        }),
        lifecycle: {
          actions: [
            { kind: "login", command: "agy", external: true },
            {
              kind: "install",
              command: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
              external: true,
            },
          ],
        },
        snapshot,
        adapter: antigravityAdapter,
        textGeneration,
      } satisfies ProviderInstance;
    }),
};
