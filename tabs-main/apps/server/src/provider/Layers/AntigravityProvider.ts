import type { AntigravitySettings } from "@tabs/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { compareSemverVersions } from "@tabs/shared/semver";
import { createModelCapabilities } from "@tabs/shared/model";
import {
  buildServerProvider,
  DEFAULT_TIMEOUT_MS,
  parseGenericCliVersion,
  spawnAndCollect,
} from "../providerSnapshot";

const MINIMUM_VERSION = "1.0.12";

export function parseAntigravityModels(output: string) {
  const seen = new Set<string>();
  return output.split(/\r?\n/u).flatMap((line) => {
    const [rawSlug, rawName] = line.split("\t", 2);
    const slug = rawSlug?.trim() ?? "";
    if (!slug || slug.startsWith("#") || seen.has(slug)) return [];
    seen.add(slug);
    return [
      {
        slug,
        name: rawName?.trim().replace(/\s+\([^)]*\)$/u, "") || slug,
        isCustom: false,
        capabilities: createModelCapabilities({ optionDescriptors: [] }),
      },
    ];
  });
}

const run = (settings: AntigravitySettings, args: ReadonlyArray<string>, env: NodeJS.ProcessEnv) =>
  spawnAndCollect(settings.binaryPath, ChildProcess.make(settings.binaryPath, [...args], { env }));

export const checkAntigravityProviderStatus = Effect.fn("checkAntigravityProviderStatus")(
  function* (settings: AntigravitySettings, environment: NodeJS.ProcessEnv = process.env) {
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    const versionProbe = yield* run(settings, ["--version"], environment).pipe(
      Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
      Effect.result,
    );
    if (Result.isFailure(versionProbe) || Option.isNone(versionProbe.success)) {
      return buildServerProvider({
        presentation: { displayName: "Antigravity" },
        enabled: settings.enabled,
        checkedAt,
        models: [],
        probe: {
          installed: false,
          version: null,
          status: "error",
          auth: { status: "unauthenticated" },
          message: "Antigravity CLI (`agy`) is not installed or failed to run.",
        },
      });
    }
    const versionResult = versionProbe.success.value;
    const version = parseGenericCliVersion(`${versionResult.stdout}\n${versionResult.stderr}`);
    if (version && compareSemverVersions(version, MINIMUM_VERSION) < 0) {
      return buildServerProvider({
        presentation: { displayName: "Antigravity" },
        enabled: settings.enabled,
        checkedAt,
        models: [],
        probe: {
          installed: true,
          version,
          status: "error",
          auth: { status: "unauthenticated" },
          message: `Antigravity CLI ${version} is too old. Upgrade to ${MINIMUM_VERSION} or newer.`,
        },
      });
    }
    const modelProbe = yield* run(settings, ["models"], environment).pipe(
      Effect.timeoutOption(DEFAULT_TIMEOUT_MS),
      Effect.result,
    );
    if (
      Result.isFailure(modelProbe) ||
      Option.isNone(modelProbe.success) ||
      modelProbe.success.value.code !== 0
    ) {
      return buildServerProvider({
        presentation: { displayName: "Antigravity" },
        enabled: settings.enabled,
        checkedAt,
        models: [],
        probe: {
          installed: true,
          version,
          status: "error",
          auth: { status: "unauthenticated" },
          message: "Antigravity is not authenticated. Authenticate with the `agy` CLI, then retry.",
        },
      });
    }
    const models = parseAntigravityModels(modelProbe.success.value.stdout);
    if (models.length === 0) {
      return buildServerProvider({
        presentation: { displayName: "Antigravity" },
        enabled: settings.enabled,
        checkedAt,
        models: [],
        probe: {
          installed: true,
          version,
          status: "error",
          auth: { status: "unauthenticated" },
          message: "Antigravity is not authenticated or returned no available models.",
        },
      });
    }
    return buildServerProvider({
      presentation: { displayName: "Antigravity" },
      enabled: settings.enabled,
      checkedAt,
      models,
      catalogStatus: "ready",
      catalogSource: "agy-models",
      catalogCheckedAt: checkedAt,
      probe: { installed: true, version, status: "ready", auth: { status: "authenticated" } },
    });
  },
);
