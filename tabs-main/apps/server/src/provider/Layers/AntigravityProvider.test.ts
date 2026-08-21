import { describe, expect, it } from "vitest";

import { parseAntigravityModels } from "./AntigravityProvider.ts";

describe("parseAntigravityModels", () => {
  it("normalizes the live agy catalog without adding fallback models", () => {
    expect(
      parseAntigravityModels(
        "gemini-2.5-pro\tGemini 2.5 Pro (High)\nclaude-sonnet\tClaude Sonnet\n",
      ),
    ).toMatchObject([
      { slug: "gemini-2.5-pro", name: "Gemini 2.5 Pro", isCustom: false },
      { slug: "claude-sonnet", name: "Claude Sonnet", isCustom: false },
    ]);
    expect(parseAntigravityModels("\n# unavailable\n")).toEqual([]);
  });
});
