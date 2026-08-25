import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { type DroidSettings, type ServerProvider } from "@tabs/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  buildServerProvider,
  DEFAULT_TIMEOUT_MS,
  parseGenericCliVersion,
  spawnAndCollect,
} from "../providerSnapshot";

function hasCachedFactoryPairing(environment: NodeJS.ProcessEnv): boolean {
  const candidateHomes = [
    environment.FACTORY_HOME?.trim(),
    environment.DROID_HOME?.trim(),
    join(homedir(), ".factory"),
    join(homedir(), ".droid"),
    join(homedir(), ".config", "factory"),
    join(homedir(), ".config", "droid"),
  ].filter((p): p is string => Boolean(p));
  return candidateHomes.some((home) =>
    ["auth.json", "session.json", "credentials.json", "device-pairing.json"].some((name) =>
      existsSync(join(home, name)),
    ),
  );
}

export const checkDroidProviderStatus = Effect.fn("checkDroidProviderStatus")(function* (
  settings: DroidSettings,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const checkedAt = DateTime.formatIso(yield* DateTime.now);
  const binary = settings.binaryPath?.trim() || "droid";
  const command = ChildProcess.make(binary, ["--version"], { env: environment });
  const probe = yield* spawnAndCollect(binary, command).pipe(
    Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
    Effect.result,
  );
  if (Result.isFailure(probe) || Option.isNone(probe.success)) {
    return buildServerProvider({
      presentation: { displayName: "Factory Droid" },
      enabled: settings.enabled,
      checkedAt,
      models: [],
      probe: {
        installed: false,
        version: null,
        status: "error",
        auth: { status: "unauthenticated" },
        message: "Factory Droid CLI (`droid`) is not installed or failed to run.",
      },
    });
  }
  const result = probe.success.value;
  const apiKey = settings.apiKey.trim() || environment.FACTORY_API_KEY?.trim();
  const authenticated = Boolean(apiKey) || hasCachedFactoryPairing(environment);
  return buildServerProvider({
    presentation: { displayName: "Factory Droid" },
    enabled: settings.enabled,
    checkedAt,
    models: [],
    probe: {
      installed: result.code === 0,
      version: parseGenericCliVersion(`${result.stdout}\n${result.stderr}`),
      status: authenticated ? "ready" : "warning",
      auth: {
        status: authenticated ? "authenticated" : "unauthenticated",
        ...(apiKey ? { type: "apiKey", label: "Factory API Key" } : {}),
      },
      ...(authenticated
        ? {}
        : {
            message:
              "Factory Droid is not authenticated. Run `droid` to pair this device or configure FACTORY_API_KEY.",
          }),
    },
  });
});

export const makePendingDroidProvider = (
  settings: DroidSettings,
): Effect.Effect<ServerProvider, never, ChildProcessSpawner.ChildProcessSpawner> =>
  checkDroidProviderStatus(settings) as any;
