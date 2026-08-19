import {
  type CopilotSettings,
  type ModelCapabilities,
  ProviderDriverKind,
  type ServerProvider,
  type ServerProviderModel,
} from "@tabs/contracts";
import type * as EffectAcpSchema from "effect-acp/schema";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Scope from "effect/Scope";
import { HttpClient } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { createModelCapabilities } from "@tabs/shared/model";

import {
  buildServerProvider,
  detailFromResult,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  spawnAndCollect,
  type ServerProviderDraft,
} from "../providerSnapshot";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  type ProviderMaintenanceCapabilities,
} from "../providerMaintenance";
import {
  makeCopilotAcpRuntime,
  resolveCopilotAcpBaseModelId,
} from "../acp/CopilotAcpSupport";

export const COPILOT_PRESENTATION = {
  displayName: "GitHub Copilot",
  badgeLabel: "ACP",
  showInteractionModeToggle: true,
  requiresNewThreadForModelChange: false,
} as const;

export const COPILOT_DRIVER_KIND = "copilot" as ProviderDriverKind;

const DEFAULT_COPILOT_MODEL_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const VERSION_PROBE_TIMEOUT_MS = 4_000;
const COPILOT_ACP_PROBE_TIMEOUT_MS = 8_000;

export function buildInitialCopilotProviderSnapshot(
  copilotSettings: CopilotSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = copilotModelsFromSettings(copilotSettings.customModels, []);

    if (!copilotSettings.enabled) {
      return buildServerProvider({
        presentation: COPILOT_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "GitHub Copilot is disabled in Tabs settings.",
        },
      });
    }

    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Checking GitHub Copilot CLI availability...",
      },
    });
  });
}

export function copilotModelsFromSettings(
  customModels: ReadonlyArray<string> | undefined,
  discoveredModels: ReadonlyArray<ServerProviderModel> = [],
): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings(
    discoveredModels,
    COPILOT_DRIVER_KIND,
    customModels ?? [],
    DEFAULT_COPILOT_MODEL_CAPABILITIES,
  );
}

export function formatCopilotModelName(slug: string): string {
  const normalized = slug.trim();
  switch (normalized.toLowerCase()) {
    case "gpt-5-mini":
      return "GPT-5-Mini";
    case "gpt-4o":
      return "GPT-4o";
    case "gpt-4.1":
      return "GPT-4.1";
    case "gpt-4o-mini":
      return "GPT-4o mini";
    case "claude-sonnet-4.6":
      return "Claude Sonnet 4.6";
    case "claude-haiku-4.5":
      return "Claude Haiku 4.5";
    case "claude-3-5-sonnet":
      return "Claude 3.5 Sonnet";
    case "claude-3-7-sonnet":
      return "Claude 3.7 Sonnet";
    case "o3-mini":
      return "o3-mini";
    case "o1":
      return "o1";
    case "o1-mini":
      return "o1-mini";
    case "o1-preview":
      return "o1-preview";
    default:
      return normalized
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

export function parseCopilotDiscoveredModelsFromProbe(
  probeOutput: unknown,
): ReadonlyArray<ServerProviderModel> {
  if (!probeOutput) {
    return [];
  }

  const rawCandidates: string[] = [];

  if (typeof probeOutput === "object") {
    const errObj = probeOutput as any;
    const data = errObj.data ?? errObj.error?.data;
    if (Array.isArray(data?.models)) {
      rawCandidates.push(...data.models.map((m: any) => (typeof m === "string" ? m : m.modelId || m.id || m.slug)));
    } else if (Array.isArray(data?.availableModels)) {
      rawCandidates.push(...data.availableModels.map((m: any) => (typeof m === "string" ? m : m.modelId || m.id || m.slug)));
    } else if (Array.isArray(data?.validModels)) {
      rawCandidates.push(...data.validModels.map((m: any) => (typeof m === "string" ? m : m.modelId || m.id || m.slug)));
    }

    const msg =
      typeof errObj.message === "string"
        ? errObj.message
        : typeof errObj.error?.message === "string"
          ? errObj.error.message
          : JSON.stringify(errObj);
    if (msg) {
      const modelRegex = /\b((?:gpt|claude|o[13]|gemini)-[a-z0-9.-]+|o1)\b/gi;
      let match: RegExpExecArray | null;
      while ((match = modelRegex.exec(msg)) !== null) {
        if (!match[1].toLowerCase().includes("__tabs_probe_invalid__")) {
          rawCandidates.push(match[1]);
        }
      }
    }
  } else if (typeof probeOutput === "string") {
    const modelRegex = /\b((?:gpt|claude|o[13]|gemini)-[a-z0-9.-]+|o1)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = modelRegex.exec(probeOutput)) !== null) {
      if (!match[1].toLowerCase().includes("__tabs_probe_invalid__")) {
        rawCandidates.push(match[1]);
      }
    }
  }

  const seen = new Set<string>();
  const models: ServerProviderModel[] = [];

  for (const raw of rawCandidates) {
    if (!raw || typeof raw !== "string") continue;
    const slug = resolveCopilotAcpBaseModelId(raw);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    models.push({
      slug,
      name: formatCopilotModelName(slug),
      isCustom: false,
      capabilities: DEFAULT_COPILOT_MODEL_CAPABILITIES,
    });
  }

  return models;
}

export function buildCopilotDiscoveredModelsFromSessionSetup(
  sessionSetupResult:
    | EffectAcpSchema.LoadSessionResponse
    | EffectAcpSchema.NewSessionResponse
    | EffectAcpSchema.ResumeSessionResponse
    | null
    | undefined,
): ReadonlyArray<ServerProviderModel> {
  if (!sessionSetupResult) {
    return [];
  }

  // 1. Direct models.availableModels (standard ACP spec)
  const directModels = sessionSetupResult.models?.availableModels;
  if (Array.isArray(directModels) && directModels.length > 0) {
    const seen = new Set<string>();
    return directModels
      .map((model): ServerProviderModel | undefined => {
        const slug = resolveCopilotAcpBaseModelId(model.modelId);
        if (!slug || seen.has(slug)) {
          return undefined;
        }
        seen.add(slug);
        return {
          slug,
          name: model.name?.trim() || formatCopilotModelName(slug),
          isCustom: false,
          capabilities: DEFAULT_COPILOT_MODEL_CAPABILITIES,
        };
      })
      .filter((model): model is ServerProviderModel => model !== undefined);
  }

  // 2. Models from configOptions (e.g. { id: "model", type: "select", options: [...] })
  const configOptions = sessionSetupResult.configOptions;
  if (Array.isArray(configOptions)) {
    const modelConfig = configOptions.find(
      (opt: any) => opt?.id === "model" && Array.isArray(opt?.options),
    );
    if (modelConfig && Array.isArray(modelConfig.options) && modelConfig.options.length > 0) {
      const seen = new Set<string>();
      return modelConfig.options
        .map((opt: any): ServerProviderModel | undefined => {
          const rawId = opt.value ?? opt.id;
          const slug = resolveCopilotAcpBaseModelId(rawId);
          if (!slug || seen.has(slug)) {
            return undefined;
          }
          seen.add(slug);
          return {
            slug,
            name: opt.name?.trim() || opt.label?.trim() || formatCopilotModelName(slug),
            isCustom: false,
            capabilities: DEFAULT_COPILOT_MODEL_CAPABILITIES,
          };
        })
        .filter((model): model is ServerProviderModel => model !== undefined);
    }
  }

  return [];
}

export function buildCopilotDiscoveredModelsFromSessionModelState(
  modelState: EffectAcpSchema.SessionModelState | null | undefined,
): ReadonlyArray<ServerProviderModel> {
  return buildCopilotDiscoveredModelsFromSessionSetup(
    modelState ? ({ models: modelState } as any) : null,
  );
}

interface CopilotAcpProbeResult {
  readonly models: ReadonlyArray<ServerProviderModel>;
  readonly currentModelId?: string;
  readonly initializeResult?: EffectAcpSchema.InitializeResponse;
}

export const discoverCopilotModelsViaAcp = (
  copilotSettings: CopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
): Effect.Effect<CopilotAcpProbeResult, unknown, Scope.Scope | ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* () {
    const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const acp = yield* makeCopilotAcpRuntime({
      copilotSettings,
      environment,
      childProcessSpawner,
      cwd: process.cwd(),
      clientInfo: { name: "tabs-ide-copilot-probe", version: "0.0.0" },
    });
    const started = yield* acp.start();
    let models = buildCopilotDiscoveredModelsFromSessionSetup(started.sessionSetupResult);

    // If models were not in sessionSetupResult, probe with deliberately invalid modelId
    if (models.length === 0) {
      const probeResultExit = yield* Effect.exit(
        acp.setSessionModel("__tabs_probe_invalid__"),
      );
      if (Exit.isFailure(probeResultExit)) {
        const errorCause = Cause.unannotate(probeResultExit.cause);
        const failure = Cause.failureOption(errorCause);
        if (Option.isSome(failure)) {
          models = parseCopilotDiscoveredModelsFromProbe(failure.value);
        } else {
          models = parseCopilotDiscoveredModelsFromProbe(Cause.pretty(errorCause));
        }
      } else {
        models = parseCopilotDiscoveredModelsFromProbe(probeResultExit.value);
      }
    }

    return {
      models,
      currentModelId: started.sessionSetupResult.models?.currentModelId,
      initializeResult: started.initializeResult,
    };
  });

const runCopilotVersionCommand = (
  copilotSettings: CopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
) => {
  const command = copilotSettings.binaryPath || "copilot";
  return spawnAndCollect(
    command,
    ChildProcess.make(command, ["--version"], {
      env: environment,
      shell: process.platform === "win32",
    }),
  );
};

export const checkCopilotProviderStatus = Effect.fn("checkCopilotProviderStatus")(function* (
  copilotSettings: CopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
): Effect.fn.Return<ServerProviderDraft, never, ChildProcessSpawner.ChildProcessSpawner> {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const emptyFallbackModels = copilotModelsFromSettings(copilotSettings.customModels, []);

  if (!copilotSettings.enabled) {
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: false,
      checkedAt,
      models: emptyFallbackModels,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "GitHub Copilot is disabled in Tabs settings.",
      },
    });
  }

  // 1. Version probe / binary installation check
  const versionResult = yield* runCopilotVersionCommand(copilotSettings, environment).pipe(
    Effect.timeoutOption(VERSION_PROBE_TIMEOUT_MS),
    Effect.result,
  );

  if (Result.isFailure(versionResult)) {
    const error = versionResult.failure;
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: emptyFallbackModels,
      probe: {
        installed: !isCommandMissingCause(error),
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: isCommandMissingCause(error)
          ? "GitHub Copilot CLI (`copilot`) is not installed or not on PATH."
          : `Failed to execute Copilot CLI health check: ${error instanceof Error ? error.message : String(error)}.`,
      },
    });
  }

  if (Option.isNone(versionResult.success)) {
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: emptyFallbackModels,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: "GitHub Copilot CLI is installed but timed out while running `copilot --version`.",
      },
    });
  }

  const versionOutput = versionResult.success.value;
  const version = parseGenericCliVersion(`${versionOutput.stdout}\n${versionOutput.stderr}`);
  if (versionOutput.code !== 0) {
    const detail = detailFromResult(versionOutput);
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: emptyFallbackModels,
      probe: {
        installed: true,
        version,
        status: "error",
        auth: { status: "unknown" },
        message: detail
          ? `GitHub Copilot CLI is installed but failed to run. ${detail}`
          : "GitHub Copilot CLI is installed but failed to run.",
      },
    });
  }

  // 2. Dynamic ACP probe and Entitlement check
  const discoveryExit = yield* discoverCopilotModelsViaAcp(copilotSettings, environment).pipe(
    Effect.scoped,
    Effect.timeoutOption(COPILOT_ACP_PROBE_TIMEOUT_MS),
    Effect.exit,
  );

  if (Exit.isFailure(discoveryExit)) {
    const detail = Cause.pretty(discoveryExit.cause);
    yield* Effect.logWarning("GitHub Copilot ACP model discovery failed", { cause: detail });
    const isAuthError =
      detail.toLowerCase().includes("auth") ||
      detail.toLowerCase().includes("login") ||
      detail.toLowerCase().includes("unauthorized") ||
      detail.toLowerCase().includes("forbidden") ||
      detail.toLowerCase().includes("-32001");

    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: emptyFallbackModels,
      probe: {
        installed: true,
        version,
        status: "error",
        auth: { status: isAuthError ? "unauthenticated" : "unknown" },
        message:
          "GitHub Copilot CLI is installed but Tabs couldn't start an ACP session. " +
          "Sign in with `copilot login` (or configure GitHub token), then retry.",
      },
    });
  }

  if (Option.isNone(discoveryExit.value)) {
    yield* Effect.logWarning(
      `GitHub Copilot ACP discovery timed out after ${COPILOT_ACP_PROBE_TIMEOUT_MS}ms.`,
    );
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: emptyFallbackModels,
      probe: {
        installed: true,
        version,
        status: "error",
        auth: { status: "unauthenticated" },
        message:
          `GitHub Copilot CLI is installed but ACP startup timed out after ${COPILOT_ACP_PROBE_TIMEOUT_MS}ms, ` +
          "which usually means it isn't signed in. Run `copilot login` (or configure GitHub token), then retry.",
      },
    });
  }

  const probeResult = discoveryExit.value.value;
  const discoveredModels = probeResult.models;

  // 3. Entitlement evaluation:
  // If discovery completed without error, but 0 models are available:
  // Account is connected/logged in, but has no active Copilot seat/subscription.
  if (discoveredModels.length === 0) {
    return buildServerProvider({
      presentation: COPILOT_PRESENTATION,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: emptyFallbackModels,
      probe: {
        installed: true,
        version,
        status: "warning",
        auth: { status: "authenticated_unentitled" },
        message: "GitHub account connected, but no active Copilot seat was found.",
      },
    });
  }

  // Active entitlement confirmed — models available
  const models = copilotModelsFromSettings(copilotSettings.customModels, discoveredModels);

  return buildServerProvider({
    presentation: COPILOT_PRESENTATION,
    enabled: copilotSettings.enabled,
    checkedAt,
    models,
    probe: {
      installed: true,
      version,
      status: "ready",
      auth: { status: "authenticated" },
    },
  });
});

export const enrichCopilotSnapshot = (input: {
  readonly snapshot: ServerProvider;
  readonly maintenanceCapabilities: ProviderMaintenanceCapabilities;
  readonly publishSnapshot: (snapshot: ServerProvider) => Effect.Effect<void>;
  readonly httpClient: HttpClient.HttpClient;
}): Effect.Effect<void> => {
  const { snapshot, publishSnapshot } = input;

  return enrichProviderSnapshotWithVersionAdvisory(snapshot, input.maintenanceCapabilities).pipe(
    Effect.provideService(HttpClient.HttpClient, input.httpClient),
    Effect.flatMap((enrichedSnapshot) => publishSnapshot(enrichedSnapshot)),
    Effect.catchCause((cause) =>
      Effect.logWarning("GitHub Copilot version advisory enrichment failed", {
        cause: Cause.pretty(cause),
      }),
    ),
    Effect.asVoid,
  );
};
