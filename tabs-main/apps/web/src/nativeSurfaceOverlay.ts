const BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS = [
  "[data-slot='menu-positioner']",
  "[data-slot='popover-positioner']",
  "[data-slot='dialog-backdrop']",
  "[data-slot='dialog-popup']",
  "[data-slot='alert-dialog-backdrop']",
  "[data-slot='alert-dialog-popup']",
  "[data-slot='command-dialog-backdrop']",
  "[data-slot='command-dialog-popup']",
  "[data-slot='code-resize-overlay']",
] as const;

/**
 * Native WebContentsViews sit above renderer CSS. Only interaction-blocking
 * overlays should temporarily suspend them. Passive notifications deliberately
 * stay out of this list so a toast cannot blank the editor or browser surface.
 */
export const NATIVE_SURFACE_BLOCKING_OVERLAY_SELECTOR =
  BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS.join(", ");

export function isNativeSurfaceBlockingOverlaySlot(slot: string): boolean {
  return BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS.some(
    (selector) => selector === `[data-slot='${slot}']`,
  );
}
