import * as NodeServices from "@effect/platform-node/NodeServices";
import { DEFAULT_SERVER_SETTINGS, ServerSettingsPatch, ProviderInstanceId } from "@tabs/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Schema } from "effect";
import { ServerConfig } from "./config";
import { ServerSettingsLive, ServerSettingsService } from "./serverSettings";

const makeServerSettingsLayer = () =>
  ServerSettingsLive.pipe(
    Layer.provideMerge(
      Layer.fresh(
        ServerConfig.layerTest(process.cwd(), {
          prefix: "tabs-server-settings-test-",
        }),
      ),
    ),
  );

it.layer(NodeServices.layer)("server settings", (it) => {
  it.effect("decodes nested settings patches", () =>
    Effect.sync(() => {
      const decodePatch = Schema.decodeUnknownSync(ServerSettingsPatch);

      assert.deepEqual(decodePatch({ providers: { codex: { binaryPath: "/tmp/codex" } } }), {
        providers: { codex: { binaryPath: "/tmp/codex" } },
      });

      assert.deepEqual(
        decodePatch({
          textGenerationModelSelection: {
            options: [{ id: "fastMode", value: false }],
          },
        }),
        {
          textGenerationModelSelection: {
            // Legacy object option payloads decode to the canonical
            // `ProviderOptionSelections` array shape.
            options: [{ id: "fastMode", value: false }],
          },
        },
      );
    }),
  );

  it.effect("deep merges nested settings updates without dropping siblings", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      yield* serverSettings.updateSettings({
        providers: {
          codex: {
            binaryPath: "/usr/local/bin/codex",
            homePath: "/Users/julius/.codex",
          },
          claudeAgent: {
            binaryPath: "/usr/local/bin/claude",
            customModels: ["claude-custom"],
          },
        },
        textGenerationModelSelection: {
          instanceId: ProviderInstanceId.makeUnsafe("codex"),
          model: DEFAULT_SERVER_SETTINGS.textGenerationModelSelection.model,
          options: [
            { id: "reasoningEffort", value: "high" },
            { id: "fastMode", value: true },
          ],
        },
      });

      const next = yield* serverSettings.updateSettings({
        providers: {
          codex: {
            binaryPath: "/opt/homebrew/bin/codex",
          },
        },
        textGenerationModelSelection: {
          options: [{ id: "fastMode", value: false }],
        },
      });

      assert.deepEqual(next.providers.codex, {
        enabled: true,
        binaryPath: "/opt/homebrew/bin/codex",
        homePath: "/Users/julius/.codex",
        shadowHomePath: "",
        customModels: [],
      });
      assert.deepEqual(next.providers.claudeAgent, {
        enabled: true,
        binaryPath: "/usr/local/bin/claude",
        homePath: "",
        customModels: ["claude-custom"],
        launchArgs: "",
      });
      // Option selections are replaced wholesale (not deep-merged) under the
      // canonical array shape, so the prior reasoningEffort is dropped.
      assert.deepEqual(next.textGenerationModelSelection, {
        instanceId: ProviderInstanceId.makeUnsafe("codex"),
        model: DEFAULT_SERVER_SETTINGS.textGenerationModelSelection.model,
        options: [{ id: "fastMode", value: false }],
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("replaces text generation selection when provider or model changes", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      yield* serverSettings.updateSettings({
        textGenerationModelSelection: {
          instanceId: ProviderInstanceId.makeUnsafe("codex"),
          model: DEFAULT_SERVER_SETTINGS.textGenerationModelSelection.model,
          options: [{ id: "reasoningEffort", value: "high" }],
        },
      });

      const next = yield* serverSettings.updateSettings({
        textGenerationModelSelection: {
          instanceId: ProviderInstanceId.makeUnsafe("claudeAgent"),
          model: "claude-sonnet-4-5",
        },
      });

      assert.deepEqual(next.textGenerationModelSelection, {
        instanceId: ProviderInstanceId.makeUnsafe("claudeAgent"),
        model: "claude-sonnet-4-5",
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("clears stale text generation options when a full selection omits them", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      yield* serverSettings.updateSettings({
        textGenerationModelSelection: {
          instanceId: ProviderInstanceId.makeUnsafe("codex"),
          model: DEFAULT_SERVER_SETTINGS.textGenerationModelSelection.model,
          options: [{ id: "reasoningEffort", value: "high" }],
        },
      });

      const next = yield* serverSettings.updateSettings({
        textGenerationModelSelection: {
          instanceId: ProviderInstanceId.makeUnsafe("codex"),
          model: "gpt-5.4",
        },
      });

      assert.deepEqual(next.textGenerationModelSelection, {
        instanceId: ProviderInstanceId.makeUnsafe("codex"),
        model: "gpt-5.4",
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("trims provider path settings when updates are applied", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      const next = yield* serverSettings.updateSettings({
        providers: {
          codex: {
            binaryPath: "  /opt/homebrew/bin/codex  ",
            homePath: "   ",
          },
          claudeAgent: {
            binaryPath: "  /opt/homebrew/bin/claude  ",
          },
        },
      });

      assert.deepEqual(next.providers.codex, {
        enabled: true,
        binaryPath: "/opt/homebrew/bin/codex",
        homePath: "",
        shadowHomePath: "",
        customModels: [],
      });
      assert.deepEqual(next.providers.claudeAgent, {
        enabled: true,
        binaryPath: "/opt/homebrew/bin/claude",
        homePath: "",
        customModels: [],
        launchArgs: "",
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("defaults blank binary paths to provider executables", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      const next = yield* serverSettings.updateSettings({
        providers: {
          codex: {
            binaryPath: "   ",
          },
          claudeAgent: {
            binaryPath: "",
          },
        },
      });

      assert.equal(next.providers.codex.binaryPath, "codex");
      assert.equal(next.providers.claudeAgent.binaryPath, "claude");
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("writes only non-default server settings to disk", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;
      const serverConfig = yield* ServerConfig;
      const fileSystem = yield* FileSystem.FileSystem;
      const next = yield* serverSettings.updateSettings({
        providers: {
          codex: {
            binaryPath: "/opt/homebrew/bin/codex",
          },
        },
      });

      assert.equal(next.providers.codex.binaryPath, "/opt/homebrew/bin/codex");

      const raw = yield* fileSystem.readFileString(serverConfig.settingsPath);
      assert.deepEqual(JSON.parse(raw), {
        providers: {
          codex: {
            binaryPath: "/opt/homebrew/bin/codex",
          },
        },
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );
});
