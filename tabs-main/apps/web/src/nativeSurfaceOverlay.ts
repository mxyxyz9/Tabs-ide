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
  // Interactive notifications with actions, buttons, or confirmations temporarily
  // suspend the active native view so users can interact with them. Passive toasts
  // do not suspend the view.
  "[data-slot='toast-root'][data-interactive='true']",
  "[data-slot='toast-popup'][data-interactive='true']",
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
  options?: { interactive?: boolean },
): boolean {
  if (slot === "toast-root" || slot === "toast-popup") {
    return options?.interactive ?? false;
  }
  return BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS.some(
    (selector) => selector === `[data-slot='${slot}']` || selector.startsWith(`[data-slot='${slot}']`),
  );
}

export function shouldSuspendNativeSurfaceForOverlay(
  surfaceReady: boolean,
  overlayOpen: boolean,
): boolean {
  return surfaceReady && overlayOpen;
}
