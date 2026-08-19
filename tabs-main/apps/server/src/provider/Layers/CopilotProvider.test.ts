import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CopilotSettings } from "@tabs/contracts";

import {
  buildCopilotDiscoveredModelsFromSessionModelState,
  buildCopilotDiscoveredModelsFromSessionSetup,
  buildInitialCopilotProviderSnapshot,
  checkCopilotProviderStatus,
  formatCopilotModelName,
  parseCopilotDiscoveredModelsFromProbe,
} from "./CopilotProvider";

const decodeCopilotSettings = Schema.decodeSync(CopilotSettings);

describe("buildInitialCopilotProviderSnapshot", () => {
  it.effect("returns a disabled snapshot when settings.enabled is false", () =>
    Effect.gen(function* () {
      const snapshot = yield* buildInitialCopilotProviderSnapshot(
        decodeCopilotSettings({ enabled: false }),
      );
      expect(snapshot.enabled).toBe(false);
      expect(snapshot.status).toBe("disabled");
      expect(snapshot.installed).toBe(false);
      expect(snapshot.message).toContain("disabled");
      expect(snapshot.models).toHaveLength(0);
    }),
  );

  it.effect("returns a pending snapshot with empty model list by default (Decision 1)", () =>
    Effect.gen(function* () {
      const snapshot = yield* buildInitialCopilotProviderSnapshot(
        decodeCopilotSettings({ enabled: true }),
      );
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.installed).toBe(true);
      expect(snapshot.status).toBe("warning");
      expect(snapshot.version).toBeNull();
      expect(snapshot.models).toHaveLength(0);
      expect(snapshot.requiresNewThreadForModelChange).toBe(false);
    }),
  );
});

describe("buildCopilotDiscoveredModelsFromSessionSetup", () => {
  it("extracts and normalizes models from live ACP session state models", () => {
    const models = buildCopilotDiscoveredModelsFromSessionSetup({
      sessionId: "test-session-id",
      models: {
        availableModels: [
          { modelId: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
          { modelId: "gpt-5.4", name: "GPT 5.4" },
          { modelId: "claude-opus-4.6", name: "Claude Opus 4.6" },
        ],
        currentModelId: "claude-sonnet-4.6",
      },
    });

    expect(models).toHaveLength(3);
    expect(models[0]?.slug).toBe("claude-sonnet-4.6");
    expect(models[0]?.name).toBe("Claude Sonnet 4.6");
    expect(models[1]?.slug).toBe("gpt-5.4");
    expect(models[2]?.slug).toBe("claude-opus-4.6");
  });

  it("extracts models from configOptions when present", () => {
    const models = buildCopilotDiscoveredModelsFromSessionSetup({
      sessionId: "test-session-id",
      configOptions: [
        {
          id: "model",
          type: "select",
          name: "Model",
          options: [
            { value: "claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
            { value: "gpt-4o", name: "GPT-4o" },
          ],
        },
      ],
    } as any);

    expect(models).toHaveLength(2);
    expect(models[0]?.slug).toBe("claude-sonnet-4.6");
    expect(models[1]?.slug).toBe("gpt-4o");
  });

  it("returns empty array when sessionSetup contains no dynamic models (no static fallback)", () => {
    const models = buildCopilotDiscoveredModelsFromSessionSetup({
      sessionId: "test-session-id",
      configOptions: [
        { id: "mode", type: "select", options: [] },
      ],
    } as any);

    expect(models).toHaveLength(0);
  });

  it("handles null/undefined gracefully", () => {
    expect(buildCopilotDiscoveredModelsFromSessionSetup(null)).toHaveLength(0);
    expect(buildCopilotDiscoveredModelsFromSessionSetup(undefined)).toHaveLength(0);
  });
});

describe("parseCopilotDiscoveredModelsFromProbe", () => {
  it("parses models from error data array", () => {
    const models = parseCopilotDiscoveredModelsFromProbe({
      error: {
        code: -32602,
        message: "Invalid model",
        data: {
          validModels: ["gpt-5-mini", "gpt-4o", "claude-sonnet-4.6", "o3-mini"],
        },
      },
    });

    expect(models).toHaveLength(4);
    expect(models.map((m) => m.slug)).toEqual([
      "gpt-5-mini",
      "gpt-4o",
      "claude-sonnet-4.6",
      "o3-mini",
    ]);
    expect(models[0]?.name).toBe("GPT-5-Mini");
  });

  it("parses models from error message regex", () => {
    const errorMsg =
      "Error: Model '__tabs_probe_invalid__' is invalid. Supported models for this account: gpt-5-mini, gpt-4o, gpt-4.1, claude-sonnet-4.6, claude-haiku-4.5, o3-mini";
    const models = parseCopilotDiscoveredModelsFromProbe(errorMsg);

    expect(models.length).toBeGreaterThanOrEqual(6);
    expect(models.map((m) => m.slug)).toContain("gpt-5-mini");
    expect(models.map((m) => m.slug)).toContain("gpt-4o");
    expect(models.map((m) => m.slug)).toContain("claude-sonnet-4.6");
    expect(models.map((m) => m.slug)).toContain("o3-mini");
  });

  it("returns empty array for non-parseable probe output (fail-closed)", () => {
    expect(parseCopilotDiscoveredModelsFromProbe(null)).toHaveLength(0);
    expect(parseCopilotDiscoveredModelsFromProbe({})).toHaveLength(0);
    expect(parseCopilotDiscoveredModelsFromProbe("generic internal error")).toHaveLength(0);
  });
});

it.layer(NodeServices.layer)("checkCopilotProviderStatus", (it) => {
  it.effect("reports the binary as missing when binary path does not resolve", () =>
    Effect.gen(function* () {
      const snapshot = yield* checkCopilotProviderStatus(
        decodeCopilotSettings({
          enabled: true,
          binaryPath: "/definitely/not/installed/copilot-binary-path",
        }),
      );
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.installed).toBe(false);
      expect(snapshot.status).toBe("error");
      expect(snapshot.models).toHaveLength(0);
      expect(snapshot.message).toMatch(/not installed|not on PATH|Failed to execute/);
    }),
  );
});
