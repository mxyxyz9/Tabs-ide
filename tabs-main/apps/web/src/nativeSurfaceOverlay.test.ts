import { describe, expect, it } from "vitest";

import { isNativeSurfaceBlockingOverlaySlot } from "./nativeSurfaceOverlay";

describe("native surface overlay policy", () => {
  it("suspends native surfaces for blocking menus and dialogs", () => {
    expect(isNativeSurfaceBlockingOverlaySlot("menu-positioner")).toBe(true);
    expect(isNativeSurfaceBlockingOverlaySlot("dialog-popup")).toBe(true);
    expect(isNativeSurfaceBlockingOverlaySlot("code-resize-overlay")).toBe(true);
  });

  it("suspends native surfaces while notifications are visible", () => {
    expect(isNativeSurfaceBlockingOverlaySlot("toast-root")).toBe(true);
    expect(isNativeSurfaceBlockingOverlaySlot("toast-popup")).toBe(true);
  });
});
