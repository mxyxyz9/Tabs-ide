const BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS = [
  "[data-slot='menu-positioner']",
  "[data-slot='popover-positioner']",
  "[data-slot='dialog-backdrop']",
  "[data-slot='dialog-popup']",
  "[data-slot='alert-dialog-backdrop']",
  "[data-slot='alert-dialog-popup']",
  "[data-slot='command-dialog-backdrop']",
  "[data-slot='command-dialog-popup']",
  // Electron WebContentsViews are composited above the React renderer. Hide
  // the active native surface while a toast is mounted so notifications remain
  // visible and interactive over Code, Browser, and Testing views.
  "[data-slot='toast-root']",
  "[data-slot='toast-popup']",
  "[data-slot='code-resize-overlay']",
] as const;

/**
 * Native WebContentsViews sit above renderer CSS, so overlays that must remain
 * readable or interactive temporarily suspend the active native surface.
 */
export const NATIVE_SURFACE_BLOCKING_OVERLAY_SELECTOR =
  BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS.join(", ");

export function isNativeSurfaceBlockingOverlaySlot(slot: string): boolean {
  return BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS.some(
    (selector) => selector === `[data-slot='${slot}']`,
  );
}
