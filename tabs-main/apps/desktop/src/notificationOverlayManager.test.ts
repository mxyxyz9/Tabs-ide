import { describe, expect, it, vi } from "vitest";
import { NotificationOverlayManager } from "./notificationOverlayManager";
import { NativeViewStackCoordinator } from "./nativeViewStackCoordinator";

const { MockWebContentsView } = vi.hoisted(() => {
  const mockWebContents = {
    loadFile: vi.fn(async () => {}),
    on: vi.fn(),
    send: vi.fn(),
    getZoomFactor: vi.fn(() => 1.0),
    setZoomFactor: vi.fn(),
    isDestroyed: vi.fn(() => false),
    close: vi.fn(),
    focus: vi.fn(),
  };

  class MockWebContentsView {
    public webContents = { ...mockWebContents };
    public bounds = { x: 0, y: 0, width: 0, height: 0 };
    public visible = false;
    public backgroundColor = "";

    setBounds = vi.fn((bounds) => {
      this.bounds = bounds;
    });
    setVisible = vi.fn((visible) => {
      this.visible = visible;
    });
    setBackgroundColor = vi.fn((color) => {
      this.backgroundColor = color;
    });
  }

  return { MockWebContentsView };
});

vi.mock("electron", () => ({
  WebContentsView: MockWebContentsView,
}));

type MockWebContentsViewInstance = InstanceType<typeof MockWebContentsView>;

function createMockWindow() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const children: unknown[] = [];

  return {
    isDestroyed: vi.fn(() => false),
    getContentSize: vi.fn(() => [1200, 800]),
    contentView: {
      children,
      addChildView: vi.fn((view: unknown, index?: number) => {
        const existing = children.indexOf(view);
        if (existing !== -1) children.splice(existing, 1);
        if (typeof index === "number") children.splice(index, 0, view);
        else children.push(view);
      }),
      removeChildView: vi.fn((view: unknown) => {
        const idx = children.indexOf(view);
        if (idx !== -1) children.splice(idx, 1);
      }),
    },
    webContents: {
      getZoomFactor: vi.fn(() => 1.25),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    }),
    removeListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = listeners.get(event);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    }),
    emit: (event: string, ...args: unknown[]) => {
      const list = listeners.get(event) ?? [];
      for (const fn of list) fn(...args);
    },
  } as unknown as Electron.BrowserWindow & { emit: (event: string, ...args: unknown[]) => void };
}

describe("NotificationOverlayManager", () => {
  it("creates a single WebContentsView with transparent background and isolated sandbox", () => {
    const mockWindow = createMockWindow();
    const coordinator = new NativeViewStackCoordinator({ getWindow: () => mockWindow });
    const manager = new NotificationOverlayManager({
      getWindow: () => mockWindow,
      stackCoordinator: coordinator,
    });

    const view = manager.ensureOverlay() as unknown as MockWebContentsViewInstance;
    expect(view).toBeTruthy();
    expect(view.setBackgroundColor).toHaveBeenCalledWith("#00000000");
    expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 0, width: 0, height: 0 });
    expect(view.setVisible).toHaveBeenCalledWith(false);

    // Repeated call returns the exact same instance (no duplicate views)
    const view2 = manager.ensureOverlay();
    expect(view2).toBe(view);
  });

  it("never steals focus for passive notifications", () => {
    const mockWindow = createMockWindow();
    const coordinator = new NativeViewStackCoordinator({ getWindow: () => mockWindow });
    const manager = new NotificationOverlayManager({
      getWindow: () => mockWindow,
      stackCoordinator: coordinator,
    });

    manager.setToasts([
      {
        id: "toast-1",
        type: "info",
        title: "File saved",
        createdAt: Date.now(),
      },
    ]);

    const view = manager.getOverlayView() as unknown as MockWebContentsViewInstance;
    expect(view.webContents.focus).not.toHaveBeenCalled();
  });

  it("sets empty bounds and hides view when toast count is zero", () => {
    const mockWindow = createMockWindow();
    const coordinator = new NativeViewStackCoordinator({ getWindow: () => mockWindow });
    const manager = new NotificationOverlayManager({
      getWindow: () => mockWindow,
      stackCoordinator: coordinator,
    });

    manager.setToasts([]);
    const view = manager.getOverlayView() as unknown as MockWebContentsViewInstance;
    expect(view.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(view.visible).toBe(false);
  });

  it("updates and clamps bounds to the window top-right corner when toasts are reported", () => {
    const mockWindow = createMockWindow();
    const coordinator = new NativeViewStackCoordinator({ getWindow: () => mockWindow });
    const manager = new NotificationOverlayManager({
      getWindow: () => mockWindow,
      stackCoordinator: coordinator,
    });

    manager.setToasts([
      {
        id: "toast-1",
        type: "error",
        title: "Compile Error",
        description: "Syntax error on line 42",
        createdAt: Date.now(),
      },
    ]);

    // Simulate overlay DOM reporting its measured size
    manager.handleReportBounds({ width: 360, height: 120 });

    const view = manager.getOverlayView() as unknown as MockWebContentsViewInstance;
    // Window width is 1200, margin-right is 16 => x = 1200 - 360 - 16 = 824. y = 56
    expect(view.bounds).toEqual({
      x: 824,
      y: 56,
      width: 360,
      height: 120,
    });
    expect(view.visible).toBe(true);
    expect(coordinator.isTopmost(view as unknown as Electron.WebContentsView)).toBe(true);
  });

  it("recalculates bounds and synchronizes zoom factor on window resize", () => {
    const mockWindow = createMockWindow();
    const coordinator = new NativeViewStackCoordinator({ getWindow: () => mockWindow });
    const manager = new NotificationOverlayManager({
      getWindow: () => mockWindow,
      stackCoordinator: coordinator,
    });

    manager.setToasts([
      {
        id: "toast-1",
        type: "info",
        title: "Test",
        createdAt: Date.now(),
      },
    ]);
    manager.handleReportBounds({ width: 300, height: 80 });

    // Resize window from 1200 to 1600
    (mockWindow.getContentSize as ReturnType<typeof vi.fn>).mockReturnValue([1600, 900]);
    mockWindow.emit("resize");

    const view = manager.getOverlayView() as unknown as MockWebContentsViewInstance;
    // x = 1600 - 300 - 16 = 1284
    expect(view.bounds.x).toBe(1284);
    expect(view.webContents.setZoomFactor).toHaveBeenCalledWith(1.25);
  });

  it("handles interactive actions, invokes callback, and restores active focus", () => {
    const mockWindow = createMockWindow();
    const coordinator = new NativeViewStackCoordinator({ getWindow: () => mockWindow });
    const actionSpy = vi.fn();
    const restoreFocusSpy = vi.fn();

    const manager = new NotificationOverlayManager({
      getWindow: () => mockWindow,
      stackCoordinator: coordinator,
      onAction: actionSpy,
      restoreActiveFocus: restoreFocusSpy,
    });

    manager.handleAction("toast-1", "action-retry");

    expect(actionSpy).toHaveBeenCalledWith("toast-1", "action-retry");
    expect(restoreFocusSpy).toHaveBeenCalled();
  });

  it("handles toast dismissal, invokes callback, and restores active focus", () => {
    const mockWindow = createMockWindow();
    const coordinator = new NativeViewStackCoordinator({ getWindow: () => mockWindow });
    const dismissSpy = vi.fn();
    const restoreFocusSpy = vi.fn();

    const manager = new NotificationOverlayManager({
      getWindow: () => mockWindow,
      stackCoordinator: coordinator,
      onDismiss: dismissSpy,
      restoreActiveFocus: restoreFocusSpy,
    });

    manager.handleDismiss("toast-1");

    expect(dismissSpy).toHaveBeenCalledWith("toast-1");
    expect(restoreFocusSpy).toHaveBeenCalled();
  });

  it("cleans up listeners and closes webContents on window closed", () => {
    const mockWindow = createMockWindow();
    const coordinator = new NativeViewStackCoordinator({ getWindow: () => mockWindow });
    const manager = new NotificationOverlayManager({
      getWindow: () => mockWindow,
      stackCoordinator: coordinator,
    });

    manager.ensureOverlay();
    const view = manager.getOverlayView() as unknown as MockWebContentsViewInstance;
    expect(view).toBeTruthy();

    // Trigger window close event
    mockWindow.emit("closed");

    expect(view.webContents.close).toHaveBeenCalled();
    expect(manager.getOverlayView()).toBeNull();
  });
});
