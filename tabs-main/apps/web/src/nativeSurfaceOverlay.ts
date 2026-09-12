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
  // Electron WebContentsViews are composited above renderer CSS. Every toast,
  // including passive status notifications, must suspend the active native
  // view or it will be visually hidden behind Code, Browser, and Testing.
  "[data-slot='toast-root']",
  "[data-slot='toast-popup']",
  "[data-slot='toast-action']",
] as const;

/**
 * Native WebContentsViews sit above renderer CSS, so overlays that must remain
 * readable or interactive temporarily suspend the active native surface.
 */
export const NATIVE_SURFACE_BLOCKING_OVERLAY_SELECTOR =
  BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS.join(", ");

export function isNativeSurfaceBlockingOverlaySlot(
  slot: string,
  _options?: { interactive?: boolean },
): boolean {
  return BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS.some(
    (selector) => selector === `[data-slot='${slot}']`,
  );
}

export function shouldSuspendNativeSurfaceForOverlay(
  surfaceReady: boolean,
  overlayOpen: boolean,
): boolean {
  return surfaceReady && overlayOpen;
}
