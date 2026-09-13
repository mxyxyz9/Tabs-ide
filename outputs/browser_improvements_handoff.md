# Tabs Embedded Browser Improvements: Comprehensive Handoff & Technical Architecture

## Executive Summary

This document details the architectural design, implementation, and verification of the embedded browser subsystem across all 5 milestones for Tabs IDE. Reference implementations from T3 Code (`t3code-main`) were analyzed, adapted, and hardened to ensure enterprise reliability, strict non-native UI adherence, privacy preservation, and deterministic automation.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            Tabs Desktop Electron Shell                           │
├──────────────────────────────┬───────────────────────────────────────────────────┤
│    Web Frontend (React/Vite) │          Main Process (Electron Host)             │
│                              │                                                   │
│  - WorkspaceShell            │  - BrowserHostManager                             │
│  - DesktopBrowserChrome      │    * WebContentsView Lifecycle & Partitioning     │
│  - BrowserComparisonView     │    * Session Ownership & ControlEpoch             │
│  - ServerReadinessBadge      │    * Recently Closed Tab Ring Buffer (size=20)    │
│  - RecordIssueDialog         │    * Task Assignment & Tab Affinity               │
│  - BrowserSecurityBadge      │                                                   │
│  - PermissionMediator Modal  │  - BrowserCdpCoordinator                          │
│                              │    * CDP Attach / Detach Arbitration              │
│                              │    * DevTools Cooperative Ownership               │
│                              │                                                   │
│                              │  - BrowserSessionImporter                         │
│                              │    * Chrome / Edge / Brave / Arc / Chromium DB    │
│                              │    * DPAPI / macOS Keychain / Linux SecretService │
│                              │                                                   │
│                              │  - BrowserAuthDiagnostics                         │
│                              │    * Redacted Origin & Summary Sanitization       │
└──────────────────────────────┴───────────────────────────────────────────────────┘
```

---

## Milestone Implementations

### Milestone 1: Authentication, Native User-Agent & Popup Handoff
- **Native User-Agent Preservation**: Replaced Electron default UA overrides with standard Chrome branding to prevent OAuth providers (Google, GitHub, Microsoft) from blocking logins as untrusted embedded browsers.
- **Window Open & Popup Navigation Handoff**: Intercepted `setWindowOpenHandler` in `BrowserHostManager`. OAuth popup flows are categorized via `authClassifier.ts` into in-page, transient popup, or loopback auth windows.
- **Strict Non-Native Dialogs**: Integrated `ConfirmDialog` and `PermissionMediator` ensuring zero native `window.alert`/`window.confirm` calls.
- **Commit**: `d23313417683c221b50eb27727dc50450a29f7c3` (`fix(browser): preserve native user agent and fix embedded login navigation`).

### Milestone 2: Profiles, Permissions, Passkeys & Session Importer
- **Profile-Scoped Website Permissions**: Partitioned sessions (`persist:tabs_profile_<id>`) with granular site permissions (geolocation, media, notifications, clipboard). Implemented non-native in-chrome permission prompts.
- **Passkey Capability Reporting**: Added `hasPasskeySupport()` reporting biometric and hardware security key capabilities across macOS (Touch ID), Windows Hello, and Linux FIDO2.
- **Real-Browser Session & Cookie Importer**:
  - Implemented `BrowserSessionImporter` supporting Google Chrome, Brave, Microsoft Edge, Arc, and Chromium.
  - Decrypts SQLite cookie databases using platform-specific cryptography:
    - **macOS**: Keychain-derived AES-CBC key (`security find-generic-password -s "Chrome Safe Storage"`).
    - **Windows**: Windows DPAPI `CryptUnprotectData` and v10 master key decryption.
    - **Linux**: Secret Service / GNOME Keyring / KWallet AES-CBC decryption.
  - Selective domain filtering (e.g. only importing cookies for `github.com` or local dev environments).
- **Commits**:
  - `83b1f2972dccb2781a1974d86079341a3ff379b9` (`feat(browser): add profile-scoped website permissions and passkey capability reporting`)
  - `52438b6d2d704a54b3fab635faec3fea26ad153a` (`feat(browser): implement real-browser session and cookie importer engine`)

### Milestone 3: Reliable Tabs, Human Preemption, CDP Arbitration & Crash Recovery
- **Task-to-Tab Ownership**: Enforced strict task ownership (`assignedTaskId`). If a browser tab is assigned to Task A, automated operations from Task B are rejected, preventing concurrent agent collisions.
- **Human Takeover Preemption via `controlEpoch`**:
  - Every human interaction increments `controlEpoch`.
  - Queued automated actions verify that `(session.controlEpoch ?? 0) === scheduledEpoch && session.controller === "agent"` immediately before running.
  - Actions scheduled before takeover are preempted without touching page elements.
- **CDP & DevTools Arbitration**:
  - Implemented `BrowserCdpCoordinator` with mutual exclusion between automation clients and Chrome DevTools.
  - Automatically detaches automation CDP sessions when the user requests "Inspect" (DevTools).
- **Crash Recovery & Closed Tab Restoration**:
  - Auto-reloads crashed sessions within rate limits (max 3 crashes per 60 seconds).
  - Maintained an in-memory ring buffer of recently closed tabs (`getRecentlyClosedTabs`, `restoreRecentlyClosedTab`), preserving URL, title, viewport, and profile.
- **Commit**: `95d4b65f2e1fe42ec2c17a42b079adcb330ea235` (`feat(browser): add reliable tab ownership, human takeover preemption, and CDP coordination`).

### Milestone 4: Record Bug Journey, Reviewed Assertions & Deterministic Verification
- **Record Issue Workflow**:
  - Dedicated "Record issue" workflow with red indicator in browser toolbar.
  - Records interactions (`goto`, `click`, `fill`, `selectOption`, `check`, `press`).
  - Automatically captures before-evidence screenshots upon completion.
- **Reviewed Assertions & Fragile Locators**:
  - Allows adding and editing explicit assertions (`assertVisible`, `assertText`, `assertValue`).
  - Detects fragile positional selectors (deep `nth-child`, absolute XPath, generated CSS hashes) and alerts the user to use stable locators (`data-testid`, roles, labels).
- **Masking Sensitive Inputs in Playwright Code**:
  - Automatically parameterizes passwords, tokens, and secret inputs using environment variable placeholders (`process.env.USER_PASSWORD`, `process.env.TEST_INPUT_*`).
  - Plaintext credentials are never written to disk or test artifacts.
- **Deterministic Verification Runner**:
  - Re-executes the recorded steps against the live tab and asserts expected outcomes.
  - Reports `pass`, `fail`, `interrupted` (on human takeover), or `not_verified` (when no assertions were defined).
- **Commit**: `99431374` (`feat(browser): implement record issue workflow with reviewed assertions and deterministic verification`).

### Milestone 5: Side-by-Side Comparison, Server Discovery & Sanitized Diagnostics
- **Side-by-Side Browser Comparison View (`BrowserComparisonView`)**:
  - Split comparison modes:
    1. **Responsive Viewports**: Side-by-side comparison of device presets (iPhone SE, iPhone 14, Pixel 7, iPad Mini, iPad Pro, Desktop 1080p).
    2. **Multi-Profile Comparison**: Side-by-side comparison of authenticated (Default/Admin) vs unauthenticated (Guest/Clean) profiles on the same application URL.
    3. **Route Comparison**: Compare Route A vs Route B (e.g. `/v1` vs `/v2` or `staging` vs `localhost`).
  - Configurable split orientation (horizontal columns vs vertical rows).
  - Synchronized scroll and navigation controls.
  - One-click side-by-side visual snapshot capture directly to clipboard.
- **Local Server Discovery Readiness Probes (`ServerReadinessBadge`)**:
  - Live probe engine (`probeServerReadiness`) with non-CORS loopback HEAD requests measuring latency.
  - Address bar badge displaying port, latency, and connectivity state (Ready / Probing / Offline).
  - Discovered project server switcher: lists active local dev servers (Vite, Next.js, Node) with port and PID, enabling one-click navigation.
  - Auto-reload on connect: polls during server startup and reloads the tab the instant the dev server completes compilation.
- **Privacy-Preserving Diagnostics (`BrowserAuthDiagnostics`)**:
  - Automatically strips sensitive query strings (`code`, `token`, `secret`, `password`, `session`) from URLs and diagnostic summaries before recording or reporting.

---

## Verification & Test Results

All test suites and pre-flight checks pass cleanly with zero regressions:

### 1. Web Test Suite (`apps/web`)
```bash
bun --cwd apps/web test src/components/browser/RecordIssueDialog.test.ts src/components/browser/ServerReadinessBadge.test.ts src/components/browser/BrowserComparisonView.test.ts
```
- `RecordIssueDialog.test.ts` (13 tests): Playwright code generation, sensitive input masking, fragile locator detection, assertion generation, deterministic verification evaluation.
- `ServerReadinessBadge.test.ts` (5 tests): Loopback domain identification, successful probe response, offline error handling, probe timeouts.
- `BrowserComparisonView.test.ts` (2 tests): Device preset verification, standard viewport dimensions.
- **Result**: 3 test files passed, 20 tests passed.

### 2. Desktop Test Suite (`apps/desktop`)
```bash
bun --cwd apps/desktop test
```
- 31 test files passed, 271 tests passed (including `browserHostManager.test.ts`, `browserCdpCoordinator.test.ts`, `browserDiagnostics.test.ts`, `browserAuthLifecycle.test.ts`, `browserImport/BrowserSessionImporter.test.ts`, `permissionMediator.test.ts`, `profileStorage.test.ts`, `journeyRecorder.test.ts`).

### 3. Typecheck & Linter Checks
```bash
bun --cwd apps/web typecheck
bun --cwd apps/desktop typecheck
bun lint
```
- `apps/web`: 0 TypeScript errors.
- `apps/desktop`: 0 TypeScript errors.
- `oxlint`: 0 errors across all 1,759 workspace files.

---

## Process & Operational Safety Notes
- **Instance Limit**: At all times, process count for Tabs was verified to be 0 or 1. No orphaned Electron or backend processes remain.
- **Git State**: All changes are committed locally to `main`. No destructive Git commands were run.
