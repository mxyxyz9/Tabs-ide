import { describe, expect, it } from "vitest";

import { resolveAntigravityCliModel } from "./AntigravityAdapter.ts";

describe("resolveAntigravityCliModel", () => {
  it("maps a grouped Gemini model and its selected effort to the exact CLI variant", () => {
    expect(
      resolveAntigravityCliModel("gemini-3.7-flash", [{ id: "reasoningEffort", value: "medium" }]),
    ).toBe("gemini-3.7-flash-medium");
    expect(
      resolveAntigravityCliModel("gemini-3.1-pro", [{ id: "reasoningEffort", value: "high" }]),
    ).toBe("gemini-3.1-pro-high");
  });

  it("preserves fixed model slugs that do not expose an effort selector", () => {
    expect(resolveAntigravityCliModel("claude-opus-4-6-thinking", undefined)).toBe(
      "claude-opus-4-6-thinking",
    );
    expect(resolveAntigravityCliModel("gpt-oss-120b-medium", undefined)).toBe(
      "gpt-oss-120b-medium",
    );
  });
});
