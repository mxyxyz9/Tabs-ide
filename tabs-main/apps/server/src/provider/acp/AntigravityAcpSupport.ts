import {
  ANTIGRAVITY_DEFAULT_MODEL,
  type AntigravityAuthMethod,
  type RuntimeMode,
} from "@tabs/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import * as EffectAcpErrors from "effect-acp/errors";
import type * as EffectAcpSchema from "effect-acp/schema";

import {
  buildAntigravityAcpSpawnInput,
  makeAntigravityStderrHandler,
  makeAntigravityStdoutTransform,
  prepareAntigravityProfile,
} from "../antigravityAuthSupport";
import {
  AcpSessionRuntime,
  type AcpSessionRuntimeOptions,
  type AcpSessionRuntimeShape,
} from "./AcpSessionRuntime";
import { getProviderSecret } from "../ProviderSecretStore";

export type AntigravityAcpRuntimeSettings = Partial<
  Pick<
    import("@tabs/contracts").AntigravitySettings,
    "binaryPath" | "authMethod" | "gcpProject" | "gcpLocation"
  >
>;

export interface AntigravityAcpRuntimeInput extends Omit<
  AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "onStderr" | "spawn" | "transformStdout"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly antigravitySettings?: AntigravityAcpRuntimeSettings;
  readonly environment?: NodeJS.ProcessEnv;
  readonly profileDirectory?: string;
  readonly onAuthorizationUrl?: (url: string) => Effect.Effect<void, EffectAcpErrors.AcpError>;
  readonly clientFileSystem?: boolean;
  readonly authMethod?: AntigravityAuthMethod;
}

/**
 * Creates a native, resumable ACP runtime around Google's Antigravity agent.
 * Normal chat launches reject interactive browser login; the settings login flow
 * opts in by providing `onAuthorizationUrl`.
 */
export const makeAntigravityAcpRuntime = Effect.fn("makeAntigravityAcpRuntime")(function* (
  input: AntigravityAcpRuntimeInput,
): Effect.fn.Return<
  AcpSessionRuntimeShape,
  EffectAcpErrors.AcpError,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> {
  const path = yield* Path.Path;
  const executablePath = input.antigravitySettings?.binaryPath?.trim() || "agy_acp_server.par";
  const apiKey = yield* Effect.tryPromise(() => getProviderSecret("antigravity.api-key")).pipe(
    Effect.mapError(
      (cause) =>
        new EffectAcpErrors.AcpTransportError({
          detail: "Failed to read the Antigravity API key from secure storage.",
          cause,
        }),
    ),
  );
  const auth = {
    authMethod: input.authMethod ?? input.antigravitySettings?.authMethod ?? "oauth-personal",
    apiKey: apiKey?.trim() ?? "",
    gcpProject: input.antigravitySettings?.gcpProject?.trim() ?? "",
    gcpLocation: input.antigravitySettings?.gcpLocation?.trim() ?? "",
  };
  const profile = yield* prepareAntigravityProfile({
    profileDirectory:
      input.profileDirectory ?? path.join(input.cwd, ".tabs", "antigravity-profile"),
    ...(input.environment ? { baseEnv: input.environment } : {}),
    auth,
  }).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
  );
  const spawn = buildAntigravityAcpSpawnInput({
    installation: {
      executablePath,
      harnessPath: path.join(
        path.dirname(executablePath),
        process.platform === "win32" ? "localharness_external.exe" : "localharness_external",
      ),
    },
    profile,
    cwd: input.cwd,
    ...(input.environment ? { baseEnv: input.environment } : {}),
    auth,
  });
  const context = yield* Layer.build(
    AcpSessionRuntime.layer({
      ...input,
      spawn,
      authMethodId: auth.authMethod,
      clientCapabilities: {
        fs: {
          readTextFile: input.clientFileSystem === true,
          writeTextFile: input.clientFileSystem === true,
        },
        terminal: false,
      },
      transformStdout: makeAntigravityStdoutTransform(
        input.onAuthorizationUrl ? { onAuthorizationUrl: input.onAuthorizationUrl } : {},
      ),
      onStderr: makeAntigravityStderrHandler(
        input.onAuthorizationUrl ? { onAuthorizationUrl: input.onAuthorizationUrl } : {},
      ),
    }).pipe(
      Layer.provide(
        Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
      ),
    ),
  );
  return yield* Effect.service(AcpSessionRuntime).pipe(Effect.provide(context));
});

export function resolveAntigravityAcpBaseModelId(
  model: string | null | undefined,
): string | undefined {
  const trimmed = model?.trim();
  return trimmed && trimmed !== ANTIGRAVITY_DEFAULT_MODEL ? trimmed : undefined;
}

export function currentAntigravityModelIdFromSessionSetup(
  result:
    | EffectAcpSchema.LoadSessionResponse
    | EffectAcpSchema.NewSessionResponse
    | EffectAcpSchema.ResumeSessionResponse,
): string | undefined {
  const config = result.configOptions?.find((option) => option.id === "model");
  return config?.type === "select" ? config.currentValue : result.models?.currentModelId?.trim();
}

export function discoverAntigravityAcpModels(
  runtime: Pick<AcpSessionRuntimeShape, "getConfigOptions">,
) {
  return Effect.map(runtime.getConfigOptions, (configOptions) => ({
    models: antigravityModelOptions(configOptions).map((model) => ({
      slug: model.value,
      name: model.name,
    })),
    source: "antigravity-acp",
    cached: false,
  }));
}

export function antigravityPermissionMode(runtimeMode: RuntimeMode): string {
  switch (runtimeMode) {
    case "full-access":
      return "yolo";
    case "auto-accept-edits":
      return "auto_edit";
    case "approval-required":
      return "default";
  }
}

export function antigravityModelOptions(
  configOptions: ReadonlyArray<EffectAcpSchema.SessionConfigOption>,
) {
  const model = configOptions.find((option) => option.id === "model");
  if (model?.type !== "select") return [];
  return model.options.flatMap((entry) => ("value" in entry ? [entry] : entry.options));
}

export function resolveAntigravityModel(input: {
  readonly configOptions: ReadonlyArray<EffectAcpSchema.SessionConfigOption>;
  readonly model: string | null | undefined;
  readonly defaultModel?: string;
}): string | undefined {
  const modelConfig = input.configOptions.find((option) => option.id === "model");
  const current = modelConfig?.type === "select" ? modelConfig.currentValue : undefined;
  if (input.model && input.model !== ANTIGRAVITY_DEFAULT_MODEL) return input.model;
  const options = antigravityModelOptions(input.configOptions);
  return input.defaultModel && options.some((option) => option.value === input.defaultModel)
    ? input.defaultModel
    : current;
}

/** Reapplies an explicit selection after resume without overwriting it with a cold default. */
export const applyAntigravityAcpModelSelection = Effect.fn("applyAntigravityAcpModelSelection")(
  function* <E>(input: {
    readonly runtime: Pick<AcpSessionRuntimeShape, "getConfigOptions" | "setModel">;
    readonly model: string | null | undefined;
    readonly defaultModel?: string;
    readonly mapError: (cause: EffectAcpErrors.AcpError) => E;
  }): Effect.fn.Return<string | undefined, E> {
    const configOptions = yield* input.runtime.getConfigOptions;
    const modelConfig = configOptions.find((option) => option.id === "model");
    const current = modelConfig?.type === "select" ? modelConfig.currentValue : undefined;
    const resolved = resolveAntigravityModel({
      configOptions,
      model: input.model,
      ...(input.defaultModel ? { defaultModel: input.defaultModel } : {}),
    });
    const explicit = Boolean(input.model) && input.model !== ANTIGRAVITY_DEFAULT_MODEL;
    if (resolved === undefined || (!explicit && resolved === current)) return current;
    const options = antigravityModelOptions(configOptions);
    if (!options.some((option) => option.value === resolved)) {
      return yield* Effect.fail(
        input.mapError(
          EffectAcpErrors.AcpRequestError.invalidParams(
            `Antigravity model '${resolved}' is unavailable for this Google account. Select an available model.`,
          ),
        ),
      );
    }
    yield* input.runtime.setModel(resolved).pipe(Effect.mapError(input.mapError));
    return resolved;
  },
);
