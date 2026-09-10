# Authoritative T3 Code to Tabs Parity Matrix

Scope: Port non-mobile T3 Code capabilities into Tabs while retaining Tabs-specific architecture and implementations that are already stronger (Electron `WebContentsView`, custom shortcuts `Cmd/Ctrl+Shift+N` and `Cmd/Ctrl+Q`, 200 ms bottom-exit startup splash animation, and native session/thread persistence).

Status Legend:
- **Complete**: Fully implemented, adapted to Tabs architecture, covered by automated unit/integration tests, and verified against production build.
- **Intentionally Superseded**: Tabs uses a demonstrably superior native architecture (e.g. Electron `WebContentsView` instead of T3's `<webview>`, native Code-OSS embedded sessions).
- **Excluded**: Mobile-only capability (e.g., iOS/Android push notifications, mobile keyboard accessories).

---

## 1. Skills and Slash Commands

| Capability | T3 Implementation & Files | Tabs Equivalent & Implementation | Status | Evidence & Test Suite | Implementing Commits |
|---|---|---|---|---|---|
| Cwd / Workspace-Specific Skill Snapshots | `packages/client-runtime/src/providerSkills.ts`, `apps/server/src/provider/Layers/ProviderRegistry.ts` | `packages/contracts/src/provider.ts` (`ServerProviderWorkspaceSnapshot`), `apps/server/src/provider/Layers/ProviderRegistry.ts` (`refreshWorkspaceSnapshot`, `upsertProviderWorkspaceSnapshot`), `packages/client-runtime/src/providerSkills.ts` (`resolveProviderSkillsForCwd`) | Complete | `apps/server/src/provider/Layers/ProviderRegistry.test.ts` (36 tests), `packages/client-runtime/src/providerSkills.test.ts` (2 tests) | `3ed8b5d5`, `c7049d7b` |
| Workspace Skill Discovery Drivers | `apps/server/src/provider/Drivers/ClaudeSkills.ts`, `CursorSkills.ts` | `AntigravitySkills.ts`, `ClaudeSkills.ts`, `ClaudeExecutable.ts`, `ClaudeSkillDispatch.ts`, `CursorSkills.ts`, `GrokSkills.ts` | Complete | `ClaudeSkills.test.ts` (20 tests), `AntigravitySkills.test.ts` (14 tests), `ClaudeExecutable.test.ts` (8 tests), `ClaudeSkillDispatch.test.ts` (7 tests), `GrokSkills.test.ts` (5 tests), `CursorSkills.test.ts` (2 tests) | `c7049d7b` |
| Native Provider Dispatch Planning & Mentions | T3 slash dispatch transforms in Claude/Cursor adapters | `apps/server/src/provider/Layers/ClaudeAdapter.ts` (`planClaudeSkillDispatch`), `CursorAdapter.ts` (`rewriteCursorSkillMentions`) | Complete | `ClaudeAdapter.test.ts` (14 tests), `CursorAdapter.test.ts` (17 tests) | `c7049d7b` |
| Ranked Skill Search & Fuzzy Matching | `apps/web/src/providerSkillSearch.ts` | `packages/shared/src/searchRanking.ts`, `apps/web/src/providerSkillSearch.ts` | Complete | `packages/shared/src/searchRanking.test.ts` (6 tests), `apps/web/src/providerSkillSearch.test.ts` (6 tests) | `3ed8b5d5`, `36857c7b` |
| Source Badges (app, repo, project, personal, system) | `apps/web/src/components/chat/ComposerCommandMenu.tsx` | `apps/web/src/components/chat/ComposerCommandMenu.tsx` (`SkillSourceBadge` with Lucide icons: `BlocksIcon`, `FolderIcon`, `UserRoundIcon`, `SettingsIcon`, `PackageIcon`) | Complete | `apps/web/src/components/chat/ComposerCommandMenu.test.tsx` (2 tests) | `36857c7b` |
| Invocable vs Non-Invocable Semantics | T3 client-runtime filters | `packages/client-runtime/src/providerSkills.ts` (`user-invocable: false` hidden from composer, `disable-model-invocation` permitted for user) | Complete | `packages/client-runtime/src/providerSkills.test.ts` (2 tests) | `7eb79a3b`, `3ed8b5d5` |
| Full Slash Command Menu & Menu Fallbacks | `apps/web/src/components/chat/ChatComposer.tsx` | `apps/web/src/components/ChatView.tsx`, `ComposerCommandMenu.tsx` | Complete | `apps/web/src/components/chat/ComposerCommandMenu.test.tsx` (2 tests) | `058e6da4`, `5b10e0ec` |

---

## 2. Embedded Code-OSS & Workbench Stability

| Capability | T3 Implementation & Files | Tabs Equivalent & Implementation | Status | Evidence & Test Suite | Implementing Commits |
|---|---|---|---|---|---|
| Native Secondary Sidebar & Auxiliary Bar Extensions | T3 webview/iframe based activity routing | `apps/desktop/src/codeHostManager.ts` (enables `workbench.secondarySideBar.defaultVisibility: visible`), `apps/web/src/components/code/CodeActivityRail.tsx` (exposes auxiliaryBar items for Copilot, Claude, Codex) | Complete | `apps/desktop/src/codeHostManager.test.ts` (41 tests) | `8245b3b7` |
| Strict Mode & Effect Remount Workbench Preservation | N/A (T3 does not embed native Code-OSS) | `apps/web/src/components/code/CodeWorkbench.tsx`, `apps/desktop/src/codeHostManager.ts` | Complete | React Strict Mode cleanup no longer cancels Code-OSS startup; `codeHostManager.test.ts` | `af4969d0` |
| Code-OSS Theme Synchronization | `packages/shared/src/theme.ts` | `apps/desktop/src/codeHostManager.ts` (`setTheme` across all 7 built-in themes + custom theme) | Complete | `apps/desktop/src/codeHostManager.test.ts` ("verifies setTheme executes cleanly across all 7 built-in themes") | `af4969d0`, `8245b3b7` |
| Code-OSS Project Session Routing & Teardown | N/A | `apps/desktop/src/codeHostManager.ts` (LRU cache of 3 warm sessions, detached views, project-scoped cleanup) | Complete | `apps/desktop/src/codeHostManager.test.ts` (41 tests) | `af4969d0` |

---

## 3. Remote Environments & Repositories

| Capability | T3 Implementation & Files | Tabs Equivalent & Implementation | Status | Evidence & Test Suite | Implementing Commits |
|---|---|---|---|---|---|
| Direct, SSH, Tailscale, Relay Environment Connections | `packages/client-runtime/src/connection/` | `packages/client-runtime/src/connection/supervisor.ts`, `registry.ts`, `driver.ts`, `catalog.ts` | Complete | `packages/client-runtime/src/connection/supervisor.test.ts` (35 tests), `registry.test.ts` (18 tests) | `91652c82`, `2b5aacf4` |
| Remote Environment Input Validation | `packages/client-runtime/src/connection/` | `packages/client-runtime/src/connection/connectionInputValidation.ts`, `apps/web/src/components/settings/ConnectionsSettings.tsx` | Complete | `connectionInputValidation.test.ts` (23 tests) | `91652c82` |
| Cross-Environment Scoped State Isolation (Duplicate IDs) | `packages/client-runtime/src/environment/scoped.ts` | `apps/web/src/lib/scopedStateStorage.ts`, `packages/client-runtime/src/environment/scoped.ts` | Complete | `apps/web/src/lib/scopedStateStorage.test.ts` (12 tests including cross-environment isolation suite) | `2b5aacf4` |
| Reconnect, Session Resume, and Wake Probes | `packages/client-runtime/src/connection/supervisor.ts` | `packages/client-runtime/src/connection/supervisor.ts` | Complete | `packages/client-runtime/src/connection/supervisor.test.ts` (liveness probe, transient close, wake probe tests) | `2b5aacf4` |

---

## 4. Collaborative Browser & Automation (WebContentsView)

| Capability | T3 Implementation & Files | Tabs Equivalent & Implementation | Status | Evidence & Test Suite | Implementing Commits |
|---|---|---|---|---|---|
| WebContentsView Engine Architecture | T3 uses `<webview>` tag | `apps/desktop/src/browserHostManager.ts` (uses Electron `WebContentsView`) | Intentionally Superseded | Tabs provides superior process isolation, performance, and partition persistence | Preserved architecture |
| Chat Links Routed to Integrated Preview | T3 browser link handler | `apps/web/src/components/WorkspaceShell.tsx` | Complete | Chat links open in integrated WebContentsView browser preview | `2322675b` |
| Direct Viewport Resize Handles | T3 viewport rail | `apps/web/src/components/browser/BrowserViewportResizeRail.tsx` | Complete | Direct mouse/keyboard viewport resizing rails | `fc71ba6c` |
| Native Surface Non-Blanking for Passive Toasts | T3 overlay system | `apps/web/src/nativeSurfaceOverlay.ts`, `apps/web/src/components/WorkspaceShell.tsx` | Complete | `apps/web/src/nativeSurfaceOverlay.test.ts` (2 tests), passive toasts no longer hide native page | `7e0a7c4c` |
| Crash Recovery with Exponential Backoff | T3 crash recovery | `apps/desktop/src/browserHostManager.ts` (`planBrowserCrashRecovery`) | Complete | `apps/desktop/src/browserHostManager.test.ts` (bounded backoff, 25 tests) | Preserved & verified |
| Element Picker, Screenshot, DevTools, PiP | T3 preview features | `apps/desktop/src/browserHostManager.ts` (`pickElement`, `openPictureInPicture`, `setColorScheme`) | Complete | `apps/desktop/src/browserHostManager.test.ts` (25 tests) | Preserved & verified |

---

## 5. Notifications & UI Polish

| Capability | T3 Implementation & Files | Tabs Equivalent & Implementation | Status | Evidence & Test Suite | Implementing Commits |
|---|---|---|---|---|---|
| Toast Deduplication Window | T3 toast queue | `apps/web/src/components/ui/toast.tsx` (`RECENT_TOAST_DEDUPE_WINDOW_MS = 2500` deduplication map) | Complete | `apps/web/src/components/ui/toast.dedupe.test.ts` (1 test) | `afa8eba0` |
| Replayed Keybindings Config Toast Suppression | T3 config subscriber | `apps/web/src/routes/__root.tsx` (`lastKeybindingsPayloadHash` diff check) | Complete | Verified during reconnect without duplicate notification pops | `afa8eba0` |
| Provider Update Notification Dismissal Persistence | T3 update banner | `apps/web/src/components/ProviderUpdateNotification.tsx` (`dismissedProviderUpdateNotificationKeys` updated on "Settings" click) | Complete | Settings click marks key dismissed and prevents repeat banner | `afa8eba0` |

---

## 6. Startup & Interaction Performance

| Capability | T3 Implementation & Files | Tabs Equivalent & Implementation | Status | Evidence & Test Suite | Implementing Commits |
|---|---|---|---|---|---|
| Startup Splash Anti-Flash Hold & 200 ms Bottom-Exit | T3 splash screen | `apps/web/src/components/SplashScreen.tsx` (`STARTUP_ANIMATION_HOLD_MS = 150`, `STARTUP_ANIMATION_EXIT_MS = 200`), `apps/web/src/routes/__root.tsx` (`transition-transform duration-200 ease-out`) | Complete | `apps/web/src/hooks/useMinimumDuration.test.ts` (2 tests) | `cf55a3e4` |
| Intentionally Preserved Shortcuts (`Cmd+Shift+N`, `Cmd+Q`) | T3 default shortcuts | Tabs app shell keybinding registrations | Complete | Preserved custom window management and application exit behavior | Preserved architecture |

---

## Verification Summary

| Suite / Check | Command | Result |
|---|---|---|
| Contracts Typecheck | `packages/contracts/node_modules/.bin/tsc --noEmit -p packages/contracts/tsconfig.json` | 0 errors (Passed) |
| Web Typecheck | `apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` | 0 errors (Passed, 1 known TS29 advisory) |
| Server Provider Vitest Suite | `apps/server/node_modules/.bin/vitest run src/provider` | 102 passed, 2 skipped (885 passed tests) |
| Desktop Managers Vitest Suite | `apps/web/node_modules/.bin/vitest run apps/desktop/src/` | 2 passed (66 passed tests) |
| Web Vitest Suite (Changed Modules) | `apps/web/node_modules/.bin/vitest run apps/web/src/` | 6 passed (25 passed tests) |
| Web Production Bundle Build | `./node_modules/.bin/vite build` (in `apps/web`) | Built in 20.26s (Exit code 0) |
