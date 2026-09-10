import { describe, expect, it } from "vitest";

import { isNativeSurfaceBlockingOverlaySlot } from "./nativeSurfaceOverlay";

describe("native surface overlay policy", () => {
  it("suspends native surfaces for blocking menus and dialogs", () => {
    expect(isNativeSurfaceBlockingOverlaySlot("menu-positioner")).toBe(true);
    expect(isNativeSurfaceBlockingOverlaySlot("dialog-popup")).toBe(true);
    expect(isNativeSurfaceBlockingOverlaySlot("code-resize-overlay")).toBe(true);
  });

  it("does not blank native surfaces for passive notifications", () => {
    expect(isNativeSurfaceBlockingOverlaySlot("toast-root")).toBe(false);
    expect(isNativeSurfaceBlockingOverlaySlot("toast-popup")).toBe(false);
  });
});
