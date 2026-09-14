import type { BrowserWindow, WebContentsView } from "electron";

export interface NativeViewStackCoordinatorOptions {
  getWindow: () => BrowserWindow | null;
}

/**
 * NativeViewStackCoordinator ensures deterministic child-view stacking
 * order across all native WebContentsViews attached to the window's contentView.
 *
 * Layers:
 * - Bottom: Active tool surfaces (CodeHost sessions, BrowserHost sessions, comparisons)
 * - Middle: Automation and transient modal surfaces
 * - Topmost: Notification overlay view
 *
 * Invariant: The notification overlay view is ALWAYS at the highest index in
 * `window.contentView.children`, preventing native tool surfaces from ever
 * covering application notifications or requiring native view detaches.
 */
export class NativeViewStackCoordinator {
  private readonly getWindow: () => BrowserWindow | null;
  private notificationOverlayView: WebContentsView | null = null;
  private readonly toolViews = new Set<WebContentsView>();
  private readonly automationViews = new Set<WebContentsView>();

  constructor(options: NativeViewStackCoordinatorOptions) {
    this.getWindow = options.getWindow;
  }

  /**
   * Attach or activate a tool view (Code session, Browser session, etc.)
   * ensuring it is positioned below the notification overlay.
   */
  public attachToolView(view: WebContentsView): void {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;

    this.toolViews.add(view);

    const children = window.contentView.children;
    const overlay = this.notificationOverlayView;

    if (!children.includes(view)) {
      if (overlay && children.includes(overlay)) {
        const overlayIndex = children.indexOf(overlay);
        window.contentView.addChildView(view, overlayIndex);
      } else {
        window.contentView.addChildView(view);
      }
    } else if (overlay && children.includes(overlay)) {
      // Re-assert overlay sits above this view
      this.ensureTopmost();
    }
  }

  /**
   * Detach a tool view from the window's contentView.
   */
  public detachToolView(view: WebContentsView): void {
    this.toolViews.delete(view);
    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;

    if (window.contentView.children.includes(view)) {
      window.contentView.removeChildView(view);
    }
  }

  /**
   * Attach an automation or transient surface (e.g. screenshot capture)
   * below the notification overlay.
   */
  public attachAutomationView(view: WebContentsView, index = 0): void {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;

    this.automationViews.add(view);
    const children = window.contentView.children;
    const overlay = this.notificationOverlayView;

    if (!children.includes(view)) {
      if (overlay && children.includes(overlay)) {
        const targetIndex = Math.min(index, children.indexOf(overlay));
        window.contentView.addChildView(view, targetIndex);
      } else {
        window.contentView.addChildView(view, index);
      }
    }

    if (overlay && children.includes(overlay)) {
      this.ensureTopmost();
    }
  }

  /**
   * Detach an automation view.
   */
  public detachAutomationView(view: WebContentsView): void {
    this.automationViews.delete(view);
    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;

    if (window.contentView.children.includes(view)) {
      window.contentView.removeChildView(view);
    }
  }

  /**
   * Set or update the dedicated notification overlay view.
   * Calling this guarantees the notification view is placed topmost.
   */
  public setNotificationOverlayView(view: WebContentsView): void {
    this.notificationOverlayView = view;
    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;

    // In Electron, addChildView reorders an already-attached child view to the top
    window.contentView.addChildView(view);
  }

  /**
   * Remove the notification overlay view from contentView.
   */
  public removeNotificationOverlayView(): void {
    const view = this.notificationOverlayView;
    this.notificationOverlayView = null;
    if (!view) return;

    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;

    if (window.contentView.children.includes(view)) {
      window.contentView.removeChildView(view);
    }
  }

  /**
   * Get the registered notification overlay view.
   */
  public getNotificationOverlayView(): WebContentsView | null {
    return this.notificationOverlayView;
  }

  /**
   * Re-asserts that the notification overlay view sits at the highest index in
   * `contentView.children`.
   */
  public ensureTopmost(): void {
    const overlay = this.notificationOverlayView;
    if (!overlay) return;

    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;

    const children = window.contentView.children;
    if (children.length === 0) return;

    // Only re-add if it's already a child and not already the last (topmost) element
    if (children.includes(overlay) && children[children.length - 1] !== overlay) {
      window.contentView.addChildView(overlay);
    }
  }

  /**
   * Check if a specific view is currently topmost.
   */
  public isTopmost(view: WebContentsView): boolean {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) return false;
    const children = window.contentView.children;
    return children.length > 0 && children[children.length - 1] === view;
  }

  /**
   * Clean up all references.
   */
  public destroy(): void {
    this.removeNotificationOverlayView();
    this.toolViews.clear();
    this.automationViews.clear();
  }
}
