import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { AntigravitySettings, ServerProviderModel } from "@tabs/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { compareSemverVersions } from "@tabs/shared/semver";
import { createModelCapabilities } from "@tabs/shared/model";
import {
  AUTH_PROBE_TIMEOUT_MS,
  buildServerProvider,
  DEFAULT_TIMEOUT_MS,
  parseGenericCliVersion,
  spawnAndCollect,
} from "../providerSnapshot";

const MINIMUM_VERSION = "1.0.12";

export function getGeminiOsAuth(environment: NodeJS.ProcessEnv = process.env): {
  authenticated: boolean;
  email?: string;
} {
  const home = homedir();
  const geminiHome = environment.GEMINI_CONFIG_DIR?.trim() || join(home, ".gemini");
  const candidatePaths = [
    join(geminiHome, "antigravity-cli", "antigravity-oauth-token"),
    join(geminiHome, "antigravity-cli", "oauth_creds.json"),
    join(geminiHome, "oauth_creds.json"),
    join(home, ".gemini", "antigravity-cli", "antigravity-oauth-token"),
    join(home, ".gemini", "antigravity-cli", "oauth_creds.json"),
    join(home, ".gemini", "oauth_creds.json"),
    join(home, ".config", "gemini", "oauth_creds.json"),
  ];

  for (const filePath of candidatePaths) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf8");
        const parsed = JSON.parse(content);
        const record = parsed && typeof parsed === "object" ? parsed : {};
        const tokenRecord =
          record.token && typeof record.token === "object" ? record.token : record;
        const accessToken =
          tokenRecord.access_token || record.access_token || tokenRecord.key || record.key;
        const refreshToken = tokenRecord.refresh_token || record.refresh_token;
        const email = tokenRecord.email || record.email || tokenRecord.user || record.user;
        if (accessToken || refreshToken) {
          return { authenticated: true, ...(email ? { email: String(email) } : {}) };
        }
      } catch {}
    }
  }
  return { authenticated: false };
}
export function parseAntigravityModels(output: string) {
  const seen = new Set<string>();
  return output.split(/\r?\n/u).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("Fetching")) return [];
    const [rawSlug, rawName] = line.split("\t", 2);
    const slug = rawSlug?.trim() ?? "";
    if (!slug || seen.has(slug)) return [];
    seen.add(slug);
    return [
      {
        slug,
        name: rawName?.trim().replace(/\s+\([^)]*\)$/u, "") || slug,
        isCustom: false,
        capabilities: createModelCapabilities({
          optionDescriptors: [
            {
              id: "reasoningEffort",
              type: "select",
              label: "Reasoning",
              currentValue: "high",
              options: [
                { id: "low", label: "Low" },
                { id: "medium", label: "Medium" },
                { id: "high", label: "High" },
              ],
            },
          ],
        }),
      },
    ];
  });
}

const resolveBinary = (settings: AntigravitySettings) => settings.binaryPath?.trim() || "agy";

const run = (settings: AntigravitySettings, args: ReadonlyArray<string>, env: NodeJS.ProcessEnv) => {
  const binary = resolveBinary(settings);
  return spawnAndCollect(binary, ChildProcess.make(binary, [...args], { env }));
};

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

    const osAuth = getGeminiOsAuth(environment);

    const modelProbe = yield* run(settings, ["models"], environment).pipe(
      Effect.timeoutOption(AUTH_PROBE_TIMEOUT_MS),
      Effect.result,
    );

    const modelProbeSucceeded =
      Result.isSuccess(modelProbe) &&
      Option.isSome(modelProbe.success) &&
      modelProbe.success.value.code === 0;

    const models: ReadonlyArray<ServerProviderModel> = modelProbeSucceeded
      ? parseAntigravityModels(modelProbe.success.value.stdout)
      : [];

    // Unauthenticated: OS credential check failed and live probe produced no models.
    if (!osAuth.authenticated && models.length === 0) {
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

    // Authenticated (OS credentials found) but live model probe returned nothing.
    // Surface a real status rather than substituting fake model slugs.
    if (osAuth.authenticated && models.length === 0) {
      return buildServerProvider({
        presentation: { displayName: "Antigravity" },
        enabled: settings.enabled,
        checkedAt,
        models: [],
        catalogStatus: "failed",
        catalogSource: "agy-models",
        catalogCheckedAt: checkedAt,
        probe: {
          installed: true,
          version,
          status: "warning",
          auth: {
            status: "authenticated",
            ...(osAuth.email ? { email: osAuth.email } : {}),
          },
          message:
            "Authenticated — model list unavailable. Run `agy models` in a terminal to retry, or check your network connection.",
        },
      });
    }

    // Authenticated with a live model list.
    return buildServerProvider({
      presentation: { displayName: "Antigravity" },
      enabled: settings.enabled,
      checkedAt,
      models,
      catalogStatus: "ready",
      catalogSource: "agy-models",
      catalogCheckedAt: checkedAt,
      probe: {
        installed: true,
        version,
        status: "ready",
        auth: {
          status: "authenticated",
          ...(osAuth.email ? { email: osAuth.email } : {}),
        },
      },
    });
  },
);
