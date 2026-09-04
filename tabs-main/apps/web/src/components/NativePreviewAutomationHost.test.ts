import { describe, expect, it } from "vitest";

import { resolveAutomationViewport } from "./NativePreviewAutomationHost";

describe("resolveAutomationViewport", () => {
  it("preserves fill mode", () => {
    expect(resolveAutomationViewport({ mode: "fill" })).toEqual({ _tag: "fill" });
  });

  it("preserves exact freeform dimensions", () => {
    expect(resolveAutomationViewport({ mode: "freeform", width: 1234, height: 777 })).toEqual({
      _tag: "freeform",
      width: 1234,
      height: 777,
    });
  });

  it("resolves the Chrome device catalog and applies landscape orientation", () => {
    expect(
      resolveAutomationViewport({
        mode: "preset",
        preset: "iphone-12-pro",
        orientation: "landscape",
      }),
    ).toEqual({
      _tag: "preset",
      presetId: "iphone-12-pro",
      width: 844,
      height: 390,
    });
  });

  it("does not rotate a landscape-native preset twice", () => {
    expect(
      resolveAutomationViewport({
        mode: "preset",
        preset: "nest-hub-max",
        orientation: "landscape",
      }),
    ).toEqual({
      _tag: "preset",
      presetId: "nest-hub-max",
      width: 1280,
      height: 800,
    });
  });
});
