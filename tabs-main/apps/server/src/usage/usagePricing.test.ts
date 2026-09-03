import { describe, expect, it } from "vitest";

import { cacheSavingsUsd, lookupRate, parseRateTable, priceUsage } from "./usagePricing.ts";

const totals = {
  uncachedInputTokens: 100,
  cachedInputTokens: 1_000,
  cacheCreationTokens: 10,
  outputTokens: 50,
  reasoningTokens: 0,
};

describe("usage pricing", () => {
  it("does not collapse conflicting provider rates into a bare alias", () => {
    const table = parseRateTable({
      "provider-a/model": { input_cost_per_token: 1, output_cost_per_token: 5 },
      "provider-b/model": { input_cost_per_token: 2, output_cost_per_token: 10 },
    });

    expect(lookupRate(table, "model")).toBeNull();
    expect(lookupRate(table, "provider-a/model")?.inputCostPerToken).toBe(1);
  });

  it("uses the provider-reported total when available", () => {
    expect(priceUsage(new Map(), "unknown", totals, 2.5)).toEqual({
      costUsd: 2.5,
      costSource: "providerReported",
    });
  });

  it("calculates cached-token savings from the model rates", () => {
    const table = parseRateTable({
      model: {
        input_cost_per_token: 4e-6,
        output_cost_per_token: 20e-6,
        cache_read_input_token_cost: 0.4e-6,
        cache_creation_input_token_cost: 5e-6,
      },
    });

    expect(priceUsage(table, "model", totals, null).costUsd).toBeCloseTo(0.00185, 9);
    expect(cacheSavingsUsd(table, "model", totals)).toBeCloseTo(0.0036, 9);
  });
});
