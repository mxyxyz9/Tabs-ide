# Notification Overlay Architecture & Implementation Handoff

## Executive Summary

Tabs uses Electron native `WebContentsView` child views to host Code-OSS (`CodeHostManager`), Browser (`BrowserHostManager`), Testing widgets, and custom embedded browsers. Because WebContentsViews composite natively above any HTML elements rendered in the primary React renderer, standard CSS `z-index` cannot place HTML notifications above native code or web surfaces.

Previously, a workaround in `apps/web/src/nativeSurfaceOverlay.ts` classified toast elements as blocking overlays. Whenever a toast was displayed, MutationObservers triggered `hideCodeSession()`, `hideBrowserSession()`, or detached native views. This caused:
- Black or blank editor/browser views during notifications.
- Interrupted loading/navigation in Code-OSS and Browser tabs.
- Loss of focus and scroll state.
- Potential race conditions between React DOM updates and native session lifecycle.

We have designed, implemented, and validated a dedicated **topmost notification overlay `WebContentsView`** managed by the Electron main process, backed by a unified `NativeViewStackCoordinator`. Notifications render above all native surfaces without detaching, hiding, or interrupting active Code or Browser sessions.

---

## Architecture & Lifecycle

### 1. Unified Native View Stacking Coordinator
- **Location:** `apps/desktop/src/nativeViewStackCoordinator.ts`
- **Responsibilities:**
  - Manages deterministic layering of all native child views attached to `window.contentView`:
    1. `PRIMARY_RENDERER` (layer 0)
    2. `TOOL_SURFACE` (layer 10 - Code-OSS, Browser, Testing, Custom Browser)
    3. `MODAL_SURFACE` (layer 20 - Automation/Auth modals)
    4. `NOTIFICATION_OVERLAY` (layer 30 - Topmost notification overlay)
  - Eliminates uncoordinated calls to `contentView.addChildView()` across managers.
  - Automatically re-asserts the notification overlay to the topmost index whenever a tool or modal surface is attached or activated (`contentView.addChildView(view)` without second argument reorders existing views to topmost in Electron 44).

### 2. Dedicated Notification Overlay Manager
- **Location:** `apps/desktop/src/notificationOverlayManager.ts`
- **Responsibilities:**
  - Creates exactly one overlay `WebContentsView` per `BaseWindow`.
  - Configures a transparent background (`#00000000`).
  - Strict security: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, using an isolated preload bridge (`apps/desktop/src/notificationPreload.ts`).
  - Prevents passive notification focus stealing: `preventPassiveFocusStealing: true`.
  - Subscribes to window resize, zoom factor changes, and close lifecycle events.
  - Slices measured toast stack bounds and sets overlay view bounds clamped to the window, respecting titlebar window controls (`TOP_OFFSET = 56`, `MARGIN_RIGHT = 16`). When no notifications are active, view bounds are collapsed to `{ x: 0, y: 0, width: 0, height: 0 }`.
  - Cleans up all listeners and child views upon window close or disposal.

### 3. Lightweight Overlay HTML & Preload Bridge
- **Location:** `apps/desktop/resources/notification-overlay.html`, `apps/desktop/src/notificationPreload.ts`
- **Features:**
  - Self-contained, lightweight DOM and CSS (dark and light themes via CSS custom properties, matching Tabs theme tokens).
  - Dynamic stacking and animation with `prefers-reduced-motion` compliance.
  - Accessible semantics: `role="status"` for info/loading/success, `role="alert"` for error/warning, `aria-live="polite"`.
  - Interactive actions (e.g. Retry, Copy, Dismiss) with keyboard focus management and Esc key dismissal.
  - `ResizeObserver` measures exact DOM bounding box and dispatches `{ width, height }` via IPC to the main process.
  - No access to filesystem, shell, tokens, cookies, or arbitrary IPC capabilities in the overlay renderer.

### 4. Typed IPC Protocol
- **Location:** `packages/contracts/src/notificationOverlay.ts`, `packages/contracts/src/ipc.ts`
- **Channels & Contracts:**
  - `syncNotificationOverlay(payload: NotificationOverlaySyncPayload)`: Synchronizes notification stack, theme (`light` | `dark`), zoom factor, and reduced-motion preference.
  - `onNotificationOverlayAction(handler: (toastId: string, actionId: string) => void)`: Dispatches user clicks on toast action buttons back to the primary renderer.
  - `onNotificationOverlayDismiss(handler: (toastId: string) => void)`: Dispatches dismissals back to the primary renderer.

### 5. Web Toast Adapter & Workaround Removal
- **Location:** `apps/web/src/components/ui/notificationOverlayAdapter.ts`, `apps/web/src/components/ui/toast.tsx`, `apps/web/src/nativeSurfaceOverlay.ts`
- **Key Changes:**
  - `useNotificationOverlayAdapter`: Subscribes to the existing `toastManager` store. When running under Electron (`window.desktopBridge.syncNotificationOverlay`), toasts are serialized and forwarded via typed IPC. Action and dismiss callbacks invoke the existing `toast.action.onClick()` and `toastManager.dismiss()`.
  - In-DOM Fallback: When `desktopBridge` is not present (browser dev/test environments), toasts render directly into the DOM as before.
  - **Removed Detach Workaround:**
    - Removed `[data-slot='toast-root']`, `[data-slot='toast-popup']`, and `[data-slot='toast-action']` from `BLOCKING_NATIVE_SURFACE_OVERLAY_SELECTORS` in `apps/web/src/nativeSurfaceOverlay.ts`.
    - Consolidated duplicate MutationObserver boilerplate across `WorkspaceShell.tsx` (CodeHost, BrowserHost, CustomBrowser) into a reusable `useNativeSurfaceOverlaySuspension` hook.
    - Dialogs, popups, and genuine blocking overlays remain fully functional without affecting passive or interactive toasts.

---

## Old Detach / Hide Paths Removed

1. **`apps/web/src/nativeSurfaceOverlay.ts`**:
   - Removed all toast selector patterns (`[data-slot='toast-root']`, `[data-slot='toast-popup']`, `[data-slot='toast-action']`).
   - Active toasts no longer match `hasBlockingNativeSurfaceOverlay()` and will NEVER trigger suspension of native surfaces.
2. **`apps/web/src/components/WorkspaceShell.tsx`**:
   - Replaced multiple independent MutationObserver implementations that previously called `hideCodeSession()` and `hideBrowserSession()` with a single consolidated `useNativeSurfaceOverlaySuspension` hook that ignores toasts.
3. **`apps/desktop/src/codeHostManager.ts` & `browserHostManager.ts`**:
   - Replaced scattered `contentView.addChildView` calls with `NativeViewStackCoordinator.registerSurface()`, guaranteeing deterministic stacking and eliminating race conditions.

---

## Corrections to the Diagnostic Report

1. **`setIgnoreMouseEvents` on Electron 44.1.0:**
   - *Diagnostic report hypothesis:* Suggested exploring full-window transparent overlays using `setIgnoreMouseEvents({ forward: true })` on the overlay `WebContentsView`.
   - *Correction / Reality:* In Electron 44.1.0, `setIgnoreMouseEvents` is implemented strictly on `BaseWindow` / `BrowserWindow`, **NOT** on `WebContentsView` or `View`. Calling it on a `WebContentsView` results in a runtime TypeError.
   - *Resolution:* Implemented the preferred, robust measured rectangular bounds design. The overlay `WebContentsView` is sized strictly to the bounding box reported by `ResizeObserver` inside the overlay HTML (with bounds clamped to the window and empty `{ width: 0, height: 0 }` when no toasts are visible). This guarantees zero pointer interception outside the toast stack.

2. **Stack Reordering API:**
   - In Electron 44.1.0, re-adding an existing child via `contentView.addChildView(view)` moves it to the top of `contentView.children`. The `NativeViewStackCoordinator` uses this property reliably to guarantee that the notification overlay view remains at the highest index whenever any tool or modal surface is activated.

---

## Validation & Test Results

### 1. Automated Test Suites
- **`packages/contracts`**:
  - Command: `bun run --cwd packages/contracts test`
  - Result: 34 files passed, 471 tests passed (0 failures).
- **`apps/desktop`**:
  - Command: `bun run --cwd apps/desktop test`
  - Result: 39 files passed, 348 tests passed (0 failures).
  - Includes `nativeViewStackCoordinator.test.ts` (7 tests), `notificationOverlayManager.test.ts` (8 tests), and `notificationOverlayIntegration.test.ts` (18 tests covering all 18 required scenarios).
- **`apps/web`**:
  - Command: `bun run --cwd apps/web test`
  - Result: 176 files passed, 1300 tests passed (0 failures).
  - Includes `nativeSurfaceOverlay.test.ts` (3 tests) and `notificationOverlayAdapter.test.ts` (10 tests).
- **`apps/web build`**:
  - Command: `bun run --cwd apps/web build`
  - Result: Built production bundle successfully in 16.20s.
- **`vp check` & `vp run typecheck`**:
  - `vp check`: 0 errors in 1815 files.
  - `vp run typecheck`: 12 packages typechecked successfully with 0 errors.

### 2. Live Electron Verification (CDP)
- Verified via live Electron runner with Chrome DevTools Protocol (`scratch/verify-live-overlay.ts`):
  - Primary renderer called `desktopBridge.syncNotificationOverlay`.
  - Notification overlay `WebContentsView` received the IPC message and rendered toast DOM nodes with `role="status"` and correct title/description.
  - Toast measured bounds were reported back to main process.
  - Toast dismissal event was routed back to the primary renderer.
  - Verified context isolation: `window.desktopBridge` is completely undefined inside the overlay WebContents (`overlay-bridge-isolated` verified).
  - Clean termination: all processes exited cleanly with zero orphans.

---

## Known Limitations & Considerations

1. **Titlebar Overlap Guard:**
   - To avoid overlapping the macOS window traffic lights and custom title bar controls, the overlay stack applies a minimum top offset (`56px`). If a custom window layout requires dynamic titlebar heights, the top offset can be passed via `NotificationOverlayBoundsOptions`.
2. **Multiple Displays / Mixed DPI:**
   - Electron converts DIP bounds automatically on macOS/Windows. Window zoom factor changes are subscribed to and handled cleanly.
