import { Effect, FileSystem, Layer, Path } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { CheckpointDiffQueryLive } from "./checkpointing/Layers/CheckpointDiffQuery";
import { CheckpointStoreLive } from "./checkpointing/Layers/CheckpointStore";
import { ServerConfig } from "./config";
import { OrchestrationCommandReceiptRepositoryLive } from "./persistence/Layers/OrchestrationCommandReceipts";
import { OrchestrationEventStoreLive } from "./persistence/Layers/OrchestrationEventStore";
import { ProviderSessionRuntimeRepositoryLive } from "./persistence/Layers/ProviderSessionRuntime";
import { OrchestrationEngineLive } from "./orchestration/Layers/OrchestrationEngine";
import { CheckpointReactorLive } from "./orchestration/Layers/CheckpointReactor";
import { OrchestrationReactorLive } from "./orchestration/Layers/OrchestrationReactor";
import { ProviderCommandReactorLive } from "./orchestration/Layers/ProviderCommandReactor";
import { OrchestrationProjectionPipelineLive } from "./orchestration/Layers/ProjectionPipeline";
import { OrchestrationProjectionSnapshotQueryLive } from "./orchestration/Layers/ProjectionSnapshotQuery";
import { ProviderRuntimeIngestionLive } from "./orchestration/Layers/ProviderRuntimeIngestion";
import { RuntimeReceiptBusLive } from "./orchestration/Layers/RuntimeReceiptBus";
import { ProviderAdapterRegistryLive } from "./provider/Layers/ProviderAdapterRegistry";
import { ProviderRegistryLive } from "./provider/Layers/ProviderRegistry";
import { layer as ProviderMaintenanceRunnerLive } from "./provider/providerMaintenanceRunner";
import { ProviderServiceLive } from "./provider/Layers/ProviderService";
import { ProviderSessionDirectoryLive } from "./provider/Layers/ProviderSessionDirectory";
import { ProviderSessionReaperLive } from "./provider/Layers/ProviderSessionReaper";
import { ProviderEventLoggersLive } from "./provider/Layers/ProviderEventLoggers";
import { ProviderInstanceRegistryHydrationLive } from "./provider/Layers/ProviderInstanceRegistryHydration";
import { OpenCodeRuntimeLive } from "./provider/opencodeRuntime";
import { ProviderService } from "./provider/Services/ProviderService";
import * as TextGeneration from "./textGeneration/TextGeneration";

import { TerminalManagerLive } from "./terminal/Layers/Manager";
import { KeybindingsLive } from "./keybindings";
import { GitManagerLive } from "./git/Layers/GitManager";
import { GitCoreLive } from "./git/Layers/GitCore";
import { GitHubCliLive } from "./git/Layers/GitHubCli";
import { PtyAdapter } from "./terminal/Services/PTY";
import { AnalyticsService } from "./telemetry/Services/AnalyticsService";

type RuntimePtyAdapterLoader = {
  layer: Layer.Layer<PtyAdapter, never, FileSystem.FileSystem | Path.Path>;
};

const runtimePtyAdapterLoaders = {
  bun: () => import("./terminal/Layers/BunPTY"),
  node: () => import("./terminal/Layers/NodePTY"),
} satisfies Record<string, () => Promise<RuntimePtyAdapterLoader>>;

const makeRuntimePtyAdapterLayer = () =>
  Effect.gen(function* () {
    const runtime = process.versions.bun !== undefined ? "bun" : "node";
    const loader = runtimePtyAdapterLoaders[runtime];
    const ptyAdapterModule = yield* Effect.promise<RuntimePtyAdapterLoader>(loader);
    return ptyAdapterModule.layer;
  }).pipe(Layer.unwrap);

// Provider runtime, rebuilt on t3code's driver/instance architecture.
//
// `ProviderInstanceRegistryHydrationLive` is the routing keystone: it
// materializes one `ProviderInstance` per configured driver from
// `BUILT_IN_DRIVERS` + `ServerSettings`. `ProviderAdapterRegistryLive` is now a
// facade resolving driver kind → adapter off that registry, and
// `ProviderEventLoggersLive` owns the shared native/canonical NDJSON writers
// consumed by both `ProviderService` and the per-instance drivers.
// `ProviderInstanceRegistry` is the routing keystone: it materializes one
// `ProviderInstance` per configured driver from `BUILT_IN_DRIVERS` +
// `ServerSettings`. It must be provided as an INNER layer so the snapshot
// registry, adapter-registry facade, and per-driver text generation all
// resolve `ProviderInstanceId` through it. Requires the driver env
// (ChildProcessSpawner/FileSystem/Path via NodeServices, ServerConfig,
// ServerSettingsService) which the outer composition supplies.
export function makeProviderInstanceRegistryLayer() {
  return ProviderInstanceRegistryHydrationLive.pipe(
    Layer.provideMerge(ProviderEventLoggersLive),
    Layer.provideMerge(OpenCodeRuntimeLive),
    Layer.provideMerge(FetchHttpClient.layer),
  );
}

// Provider service surface that depends on (but does NOT provide) the instance
// registry. `ProviderAdapterRegistryLive` is a facade resolving driver kind →
// adapter off the instance registry; `ProviderRegistryLive` builds snapshots
// off it too. The instance registry is provided by the outer composition.
export function makeServerProviderLayer() {
  const providerSessionDirectoryLayer = ProviderSessionDirectoryLive.pipe(
    Layer.provide(ProviderSessionRuntimeRepositoryLive),
  );
  return Layer.mergeAll(
    ProviderServiceLive.pipe(Layer.provide(ProviderAdapterRegistryLive)),
    ProviderRegistryLive,
  ).pipe(Layer.provideMerge(providerSessionDirectoryLayer));
}

export function makeServerRuntimeServicesLayer() {
  const textGenerationLayer = TextGeneration.layer;
  const checkpointStoreLayer = CheckpointStoreLive.pipe(Layer.provide(GitCoreLive));

  const orchestrationLayer = OrchestrationEngineLive.pipe(
    Layer.provide(OrchestrationProjectionPipelineLive),
    Layer.provide(OrchestrationEventStoreLive),
    Layer.provide(OrchestrationCommandReceiptRepositoryLive),
  );

  const checkpointDiffQueryLayer = CheckpointDiffQueryLive.pipe(
    Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
    Layer.provideMerge(checkpointStoreLayer),
  );

  const runtimeServicesLayer = Layer.mergeAll(
    orchestrationLayer,
    OrchestrationProjectionSnapshotQueryLive,
    checkpointStoreLayer,
    checkpointDiffQueryLayer,
    RuntimeReceiptBusLive,
  );
  const runtimeIngestionLayer = ProviderRuntimeIngestionLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
  );
  const providerCommandReactorLayer = ProviderCommandReactorLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
    Layer.provideMerge(GitCoreLive),
    Layer.provideMerge(textGenerationLayer),
  );
  const checkpointReactorLayer = CheckpointReactorLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
  );
  const orchestrationReactorLayer = OrchestrationReactorLive.pipe(
    Layer.provideMerge(runtimeIngestionLayer),
    Layer.provideMerge(providerCommandReactorLayer),
    Layer.provideMerge(checkpointReactorLayer),
  );

  const terminalLayer = TerminalManagerLive.pipe(Layer.provide(makeRuntimePtyAdapterLayer()));

  const gitManagerLayer = GitManagerLive.pipe(
    Layer.provideMerge(GitCoreLive),
    Layer.provideMerge(GitHubCliLive),
    Layer.provideMerge(textGenerationLayer),
  );

  // The session reaper needs ProjectionSnapshotQuery (orchestration) alongside
  // ProviderService/ProviderSessionDirectory (provided by the provider layer in
  // the outer composition), so it lives here with the orchestration services.
  const providerSessionReaperLayer = ProviderSessionReaperLive.pipe(
    Layer.provideMerge(runtimeServicesLayer),
  );

  // NodeServices (FileSystem/Path/ChildProcessSpawner) is provided once, at the
  // innermost level of the main composition, so the instance-registry drivers
  // (which sit below this layer) can also see it.
  return Layer.mergeAll(
    orchestrationReactorLayer,
    providerSessionReaperLayer,
    GitCoreLive,
    gitManagerLayer,
    terminalLayer,
    KeybindingsLive,
    ProviderMaintenanceRunnerLive,
  );
}
