import { type DroidSettings, ProviderDriverKind } from "@tabs/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import { ChildProcessSpawner } from "effect/unstable/process";
import * as EffectAcpErrors from "effect-acp/errors";
import type * as EffectAcpSchema from "effect-acp/schema";

import {
  AcpSessionRuntime,
  type AcpSessionRuntimeOptions,
  type AcpSessionRuntimeShape,
  type AcpSpawnInput,
} from "./AcpSessionRuntime";
import { getProviderSecret } from "../ProviderSecretStore";

export const DROID_DEFAULT_AUTH_METHOD_ID = "droid-login";
export const DROID_DRIVER_KIND = "droid" as ProviderDriverKind;

export type DroidAcpRuntimeDroidSettings = Partial<Pick<DroidSettings, "binaryPath" | "apiKey">>;

export interface DroidAcpRuntimeInput extends Omit<
  AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly droidSettings: DroidAcpRuntimeDroidSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
}

export function buildDroidEnvironment(
  droidSettings: DroidAcpRuntimeDroidSettings | null | undefined,
  baseEnv?: NodeJS.ProcessEnv,
  secureToken?: string | null,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...(baseEnv ?? process.env) };

  // Explicit token injection from the OS credential store (no settings-file or parent leakage).
  const configuredToken = secureToken?.trim();
  if (configuredToken) {
    env.FACTORY_API_KEY = configuredToken;
  }

  return env;
}

export function buildDroidAcpSpawnInput(
  droidSettings: DroidAcpRuntimeDroidSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
  secureToken?: string | null,
): AcpSpawnInput {
  return {
    command: droidSettings?.binaryPath || "droid",
    args: ["exec", "--output-format", "acp"],
    cwd,
    env: buildDroidEnvironment(droidSettings, environment, secureToken),
  };
}

export interface DroidTerminalAuthMetadata {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly label?: string;
}

export function resolveDroidTerminalAuthCommand(
  advertisedMeta: unknown,
  gheHost?: string | null | undefined,
): DroidTerminalAuthMetadata {
  const meta = advertisedMeta as
    | { "terminal-auth"?: { command?: string; args?: string[]; label?: string } }
    | undefined;
  const terminalAuth = meta?.["terminal-auth"];
  const baseCommand = terminalAuth?.command || "droid";
  const baseArgs =
    Array.isArray(terminalAuth?.args) && terminalAuth.args.length > 0
      ? [...terminalAuth.args]
      : ["login"];
  const label = terminalAuth?.label || "Droid Login";

  // If a GitHub Enterprise host is specified, append --host to the login command
  const host = gheHost?.trim();
  if (host && !baseArgs.includes("--host")) {
    baseArgs.push("--host", host);
  }

  return {
    command: baseCommand,
    args: baseArgs,
    label,
  };
}

export function resolveDroidAuthMethodId(
  initializeResult: EffectAcpSchema.InitializeResponse | undefined,
  droidSettings?: DroidAcpRuntimeDroidSettings | null | undefined,
): string {
  const methods = initializeResult?.authMethods;
  if (Array.isArray(methods) && methods.length > 0) {
    const firstMethod = methods[0];
    if (firstMethod && typeof firstMethod.id === "string" && firstMethod.id.trim().length > 0) {
      return firstMethod.id.trim();
    }
  }

  return DROID_DEFAULT_AUTH_METHOD_ID;
}

export const makeDroidAcpRuntime = (
  input: DroidAcpRuntimeInput,
): Effect.Effect<AcpSessionRuntimeShape, EffectAcpErrors.AcpError, Scope.Scope> =>
  Effect.gen(function* () {
    const secureToken = yield* Effect.tryPromise(() => getProviderSecret("droid.api-key")).pipe(
      Effect.mapError(
        (cause) =>
          new EffectAcpErrors.AcpTransportError({
            detail: "Failed to read the Factory API key from secure storage.",
            cause,
          }),
      ),
    );
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildDroidAcpSpawnInput(
          input.droidSettings,
          input.cwd,
          input.environment,
          secureToken,
        ),
        authMethodId: resolveDroidAuthMethodId(undefined, input.droidSettings),
      }).pipe(
        Layer.provide(
          Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
        ),
      ),
    );
    return yield* Effect.service(AcpSessionRuntime).pipe(Effect.provide(acpContext));
  });

export function resolveDroidAcpBaseModelId(model: string | null | undefined): string | undefined {
  const trimmed = model?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function currentDroidModelIdFromSessionSetup(
  sessionSetupResult:
    | EffectAcpSchema.LoadSessionResponse
    | EffectAcpSchema.NewSessionResponse
    | EffectAcpSchema.ResumeSessionResponse,
): string | undefined {
  return sessionSetupResult.models?.currentModelId?.trim() || undefined;
}

export function applyDroidAcpModelSelection<E>(input: {
  readonly runtime: Pick<AcpSessionRuntimeShape, "setSessionModel">;
  readonly currentModelId: string | undefined;
  readonly requestedModelId: string | undefined;
  readonly mapError: (cause: EffectAcpErrors.AcpError) => E;
}): Effect.Effect<string | undefined, E> {
  const shouldSwitchModel =
    input.requestedModelId !== undefined && input.requestedModelId !== input.currentModelId;
  if (!shouldSwitchModel) {
    return Effect.succeed(input.currentModelId);
  }
  return input.runtime
    .setSessionModel(input.requestedModelId)
    .pipe(Effect.mapError(input.mapError), Effect.as(input.requestedModelId));
}
