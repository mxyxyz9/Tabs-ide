import { describe, expect, it } from "vitest";

import {
  isNativeSurfaceBlockingOverlaySlot,
  shouldSuspendNativeSurfaceForOverlay,
} from "./nativeSurfaceOverlay";

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

  it("does not abort a native surface that is still starting", () => {
    expect(shouldSuspendNativeSurfaceForOverlay(false, true)).toBe(false);
    expect(shouldSuspendNativeSurfaceForOverlay(true, true)).toBe(true);
    expect(shouldSuspendNativeSurfaceForOverlay(true, false)).toBe(false);
  });
});
