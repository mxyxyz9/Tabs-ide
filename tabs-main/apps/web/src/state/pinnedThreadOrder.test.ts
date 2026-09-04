import { describe, expect, it } from "vitest";

import { pinOrderKeyBetween, sortPinnedThreads } from "./pinnedThreadOrder";

describe("pinned thread ordering", () => {
  it("creates keys before, between, and after existing keys", () => {
    const middle = pinOrderKeyBetween(null, null)!;
    expect(pinOrderKeyBetween(null, middle)! < middle).toBe(true);
    expect(pinOrderKeyBetween(middle, null)! > middle).toBe(true);
    const close = pinOrderKeyBetween("g", "h")!;
    expect(close > "g" && close < "h").toBe(true);
  });

  it("sorts keyed threads before legacy keyless pins", () => {
    const sorted = sortPinnedThreads([
      { id: "legacy", createdAt: "2026-01-03T00:00:00.000Z", pinOrderKey: null },
      { id: "second", createdAt: "2026-01-01T00:00:00.000Z", pinOrderKey: "t" },
      { id: "first", createdAt: "2026-01-02T00:00:00.000Z", pinOrderKey: "g" },
    ]);
    expect(sorted.map((thread) => thread.id)).toEqual(["first", "second", "legacy"]);
  });
});
