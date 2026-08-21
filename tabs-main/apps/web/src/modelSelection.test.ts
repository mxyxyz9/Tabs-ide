import { describe, expect, it } from "vitest";
import { DEFAULT_UNIFIED_SETTINGS } from "@tabs/contracts/settings";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@tabs/contracts";

import { getAppModelOptions } from "./modelSelection";
import { getDefaultServerModel, getProviderModels } from "./providerModels";

const copilotProvider: ServerProvider = {
  instanceId: ProviderInstanceId.makeUnsafe("copilot"),
  driver: ProviderDriverKind.make("copilot"),
  displayName: "GitHub Copilot",
  enabled: true,
  installed: true,
  version: "1.0.80",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-08-21T00:00:00.000Z",
  catalogStatus: "ready",
  catalogSource: "copilot.models.list",
  catalogCheckedAt: "2026-08-21T00:00:00.000Z",
  models: [
    {
      slug: "account-advertised-model",
      name: "Account Advertised Model",
      isCustom: false,
      capabilities: null,
    },
  ],
  slashCommands: [],
  skills: [],
};

describe("Copilot model selection", () => {
  it("uses only the live account catalog", () => {
    const settings = {
      ...DEFAULT_UNIFIED_SETTINGS,
      providers: {
        ...DEFAULT_UNIFIED_SETTINGS.providers,
        copilot: {
          ...DEFAULT_UNIFIED_SETTINGS.providers.copilot,
          customModels: ["saved-arbitrary-model"],
        },
      },
    };

    expect(
      getAppModelOptions(
        settings,
        [copilotProvider],
        "copilot",
        "removed-or-undiscovered-model",
      ).map((model) => model.slug),
    ).toEqual(["account-advertised-model"]);
  });
});

describe.each(["claudeAgent", "cursor", "grok"] as const)(
  "%s authoritative model catalog",
  (provider) => {
    it("does not replace or augment an empty live catalog", () => {
      const snapshot: ServerProvider = {
        ...copilotProvider,
        instanceId: ProviderInstanceId.makeUnsafe(provider),
        driver: ProviderDriverKind.make(provider),
        displayName: provider,
        catalogStatus: "failed",
        models: [],
      };
      const settings = {
        ...DEFAULT_UNIFIED_SETTINGS,
        providers: {
          ...DEFAULT_UNIFIED_SETTINGS.providers,
          [provider]: {
            ...DEFAULT_UNIFIED_SETTINGS.providers[provider],
            customModels: ["configured-model"],
          },
        },
      };

      expect(getProviderModels([snapshot], provider)).toEqual([]);
      expect(getAppModelOptions(settings, [snapshot], provider, "previous-model")).toEqual([]);
      expect(getDefaultServerModel([snapshot], provider)).toBe("");
    });
  },
);
