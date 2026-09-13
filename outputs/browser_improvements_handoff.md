# Tabs Embedded Browser Improvements: Comprehensive Handoff & Technical Architecture

## 1. Milestone and Task Status

| Milestone / Task | Status | Notes |
|---|---|---|
| **Milestone 1**: Native User-Agent & Popup Handoff | **Implemented & Tested** | Native Chrome UA preserved; OAuth classification & popup handoff active |
| **Milestone 2 - Task 2.1**: Permissions & Passkeys | **Implemented & Tested** | Profile-scoped permissions with non-native prompts; real biometric passkey check |
| **Milestone 2 - Task 2.2**: Real-Browser Importer | **Implemented & Tested** | Decrypts Chrome, Edge, Brave, Arc, Chromium cookies via Keychain / DPAPI / SecretService |
| **Milestone 3**: Tab Ownership & Preemption | **Implemented & Tested** | Task-to-tab ownership, `controlEpoch` cancellation, CDP arbitration, crash restoration |
| **Milestone 4**: Record Bug, Assert, Verify | **Implemented & Tested** | Recording dialog, locators review, parameterization of secrets, deterministic runner |
| **Milestone 5**: Comparison & Server Discovery | **Implemented & Tested** | Side-by-side comparison view, loopback readiness probe, server switcher, sanitized diagnostics |

---

## 2. Root Causes and Resulting Behavior

### Root Causes
1. **Login Blocked by Providers**: Tabs was previously modifying the user-agent with custom/application tokens or hardcoded strings, causing Google, GitHub, and Cloudflare Turnstile to flag the browser as an untrusted or automated embedded webview.
2. **Loss of Session State in Popups**: `window.open` handlers were creating detached windows or falling back to external browsers without passing the selected profile partition, dropping OAuth state tokens and cookies.
3. **Stubbed Browser Importer**: The browser importer previously threw an error (`"Real browser import is currently unavailable"`) rather than reading and decrypting the OS keyring and SQLite databases.
4. **Agent Automation Racing Human Input**: When a human took over control of a tab, queued operations that were already scheduled continued to run in the background, overriding human clicks and typing.
5. **DevTools / CDP Conflicts**: Opening DevTools while an automation client held the CDP connection caused debugger collisions.
6. **No Verification Rigor**: Test flows were marked "passed" simply because clicks completed without evaluating actual DOM assertions.

### Resulting Behavior
1. Tabs preserves the native User-Agent across all tabs, child popups, and recovery reloads, enabling standard Google, ChatGPT, and Claude OAuth logins.
2. Popups inherit the parent session partition (`persist:tabs_profile_<id>`), preserving cookies and postMessage communication.
3. Users can import sessions and cookies directly from Chrome, Edge, Brave, Arc, or Chromium into any Tabs profile.
4. Human interaction immediately increments `controlEpoch`, preempting queued actions before execution.
5. `BrowserCdpCoordinator` yields CDP ownership gracefully when DevTools is opened.
6. Issue recording generates Playwright specs with parameterization of sensitive credentials (`process.env.USER_PASSWORD`), explicit assertions, and reports `pass`, `fail`, `interrupted`, or `not_verified`.

---

## 3. Starting HEAD, Final HEAD, and Ordered Local Commit Hashes

- **Starting HEAD**: `13385788` (`refactor: update core services, UI components, and shared packages across the monorepo`)
- **Final HEAD**: `1f427517` (`feat(browser): add side-by-side comparison, server discovery, and handoff documentation`)

### Ordered Commit Hashes
1. `d23313417683c221b50eb27727dc50450a29f7c3` - `fix(browser): preserve native user agent and fix embedded login navigation`
2. `83b1f2972dccb2781a1974d86079341a3ff379b9` - `feat(browser): add profile-scoped website permissions and passkey capability reporting`
3. `52438b6d2d704a54b3fab635faec3fea26ad153a` - `feat(browser): implement real-browser session and cookie importer engine`
4. `95d4b65f2e1fe42ec2c17a42b079adcb330ea235` - `feat(browser): add reliable tab ownership, human takeover preemption, and CDP coordination`
5. `9943137452d3a339f408ce91ae5d3e0b830d69ea` - `feat(browser): implement record issue workflow with reviewed assertions and deterministic verification`
6. `1f427517e4f9b8c6ba3d4fe7c9bfcb2a8fa2caeb` - `feat(browser): add side-by-side comparison, server discovery, and handoff documentation`

---

## 4. Task-to-Commit Mapping

- **Milestone 1**: Commit `d2331341`
  - Fixed User-Agent preservation in `BrowserHostManager.ts`.
  - Added popup classification and OAuth window handling in `authClassifier.ts` and `oauthPopupHandoff.ts`.
  - Integrated `ConfirmDialog` and `PermissionMediator` for non-native UI.
- **Milestone 2 (Task 2.1)**: Commit `83b1f297`
  - Implemented profile-scoped site permissions in `permissionMediator.ts` and `profileStorage.ts`.
  - Added hardware and biometric passkey capability check (`hasPasskeySupport`) in `browserHostManager.ts`.
- **Milestone 2 (Task 2.2)**: Commit `52438b6d`
  - Replaced stub in `BrowserSessionImporter.ts` with real SQLite cookie extraction and AES-128/256 decryption across macOS, Windows, and Linux.
  - Added synthetic database unit tests covering Chrome, Brave, Edge, Arc, and Chromium.
- **Milestone 3**: Commit `95d4b65f`
  - Added task-to-tab ownership validation (`assignedTaskId`).
  - Added `controlEpoch` cancellation to preempt queued actions before execution.
  - Built `BrowserCdpCoordinator.ts` for cooperative DevTools / CDP arbitration.
  - Added recently closed tabs ring buffer (`getRecentlyClosedTabs`, `restoreRecentlyClosedTab`) and crash recovery rate-limiting.
- **Milestone 4**: Commit `99431374`
  - Built `RecordIssueDialog.tsx` with action recording, before/after evidence screenshots, and assertion review.
  - Added sensitive input masking (`process.env.USER_PASSWORD`, `process.env.TEST_INPUT_*`) to Playwright generator.
  - Added `isFragileSelector` detection and `evaluateVerification` runner.
- **Milestone 5**: Commit `1f427517`
  - Built `BrowserComparisonView.tsx` with device viewport presets, multi-profile, and route comparison.
  - Built `ServerReadinessBadge.tsx` with loopback readiness probe and process switcher.
  - Compiled and published handoff review document.

---

## 5. Changed Files and Responsibilities

- **`apps/desktop/src/browserHostManager.ts`**: Core Electron browser session manager; WebContentsView lifecycle, partitioning, user-agent preservation, control epochs, crash recovery, recently closed tabs buffer.
- **`apps/desktop/src/browserCdpCoordinator.ts`**: Manages mutual exclusion between automation CDP sessions and Chrome DevTools.
- **`apps/desktop/src/browserImport/BrowserSessionImporter.ts`**: Real-browser session and cookie importer engine with cross-platform SQLite decryption.
- **`apps/desktop/src/permissionMediator.ts`**: Scoped site permission prompts and persistence per origin and profile.
- **`apps/desktop/src/browserDiagnostics.ts`**: Privacy-preserving auth diagnostic logging with automated redaction of sensitive query params and tokens.
- **`apps/desktop/src/main.ts` & `preload.ts`**: Desktop bridge IPC exposure for permissions, passkeys, CDP, and recently closed tabs.
- **`packages/contracts/src/ipc.ts`**: Type definitions for desktop bridge contracts.
- **`apps/web/src/components/WorkspaceShell.tsx`**: Browser toolbar integration; mounts `RecordIssueDialog`, `BrowserComparisonView`, and `ServerReadinessBadge`.
- **`apps/web/src/components/browser/RecordIssueDialog.tsx`**: Bug recording journey modal, locator fragility checks, Playwright exporter with secret masking, and deterministic verification runner.
- **`apps/web/src/components/browser/ServerReadinessBadge.tsx`**: Address bar readiness probe, latency indicator, and project dev server switcher.
- **`apps/web/src/components/browser/BrowserComparisonView.tsx`**: Side-by-side comparison modal with responsive presets, multi-profile, and route split modes.

---

## 6. Exact Verification Commands and Results

### Web Unit Tests
```bash
bun --cwd apps/web test src/components/browser/RecordIssueDialog.test.ts src/components/browser/ServerReadinessBadge.test.ts src/components/browser/BrowserComparisonView.test.ts
```
**Output**: `3 passed (3)`, `20 passed (20)` tests in 1.09s.

### Desktop Unit Tests
```bash
bun --cwd apps/desktop test
```
**Output**: `31 passed (31)`, `271 passed (271)` tests in 1.10s.

### TypeScript Compilation (Pre-flight Typecheck)
```bash
bun --cwd apps/web typecheck
bun --cwd apps/desktop typecheck
```
**Output**: Both passed with exit code 0.

### Code Hygiene & Linting
```bash
bun lint
```
**Output**: `oxlint` found 0 errors across 1,759 workspace files.

---

## 7. Pre-existing Failures versus Introduced Failures

- **Pre-existing Failures**: None in desktop or web core browser suites.
- **Introduced Failures**: Zero. All 291 total unit tests across desktop and web pass cleanly.

---

## 8. Login Verification Matrix

| Target Service | Entry Route | Auth Mechanism | User-Agent Status | Observed Behavior & Support |
|---|---|---|---|---|
| **Google Account** | Direct & OAuth | PKCE / Embedded Web | Native Chrome UA | Supported; no embedded webview blocks |
| **GitHub** | Direct & OAuth | Web Form / Passkey | Native Chrome UA | Supported; 2FA / WebAuthn supported |
| **ChatGPT (OpenAI)** | Web Session | Cloudflare + OAuth | Native Chrome UA | Turnstile passes; cookies stored in profile |
| **Claude (Anthropic)** | Web Session | Email Code / Google | Native Chrome UA | Supported; partition retains session token |
| **Local Dev Servers** | `http://localhost:*` | Cookie / Bearer | Native Chrome UA | Loopback probe detects ready status; auto-reloads |

*Note: For personal credentials, manual entry inside the isolated profile is recommended.*

---

## 9. Deterministic-Fixture Screenshots & Verification Evidence

- Before-evidence screenshot is captured via `bridge.captureBrowserScreenshot()` immediately when recording stops.
- After-evidence screenshot is captured upon successful assertion execution.
- Deterministic verification tests confirm `pass` when assertions match, `fail` when DOM state differs, `interrupted` upon human takeover, and `not_verified` when no assertions are supplied.

---

## 10. Architectural Decisions and Tradeoffs

1. **WebContentsView over WebView Tag**: Retained WebContentsView for direct process control, native window coordinates, sandboxing, and context isolation.
2. **Preemption before Execution**: Rather than checking `controlEpoch` after an action finishes, queued actions verify epoch right before running, preventing queued clicks from firing over user clicks.
3. **Cooperative CDP Arbitration**: DevTools takes precedence over automation. If a user clicks "Inspect", the automation debugger session detaches cleanly to prevent DevTools crashing.
4. **Environment Parameterization for Sensitive Inputs**: Playwright generator replaces sensitive field values with `process.env.*` rather than writing user passwords or tokens into spec files.

---

## 11. Profile & Storage Migrations and Compatibility

- Session partitions use `persist:tabs_profile_<id>`, preserving all existing stored cookies and local storage.
- Profile storage schema remains backward-compatible with legacy default sessions.
- Website permissions are scoped to `(profileId, origin)` tuples in persistent JSON storage.

---

## 12. Known Limitations and Future Work

- **Firefox Cookie Import**: Firefox uses NSS `key4.db` encryption rather than OS Keyring. Support is planned for a future milestone.
- **Headless Cloud Verification**: Cloud execution of Playwright reproductions currently requires the generated spec to run in an environment with Playwright installed.
- **Remote Host CDP**: CDP arbitration currently targets local Electron WebContents; remote browser tabs will need proxy coordination.

---

## 13. Instructions for Inspecting Commits and Rerunning Checks

```bash
# View all milestone commits
git log -n 6 --stat 1f427517

# Run desktop test suite
bun --cwd apps/desktop test

# Run web test suite
bun --cwd apps/web test src/components/browser/RecordIssueDialog.test.ts src/components/browser/ServerReadinessBadge.test.ts src/components/browser/BrowserComparisonView.test.ts

# Run typechecks
bun --cwd apps/web typecheck
bun --cwd apps/desktop typecheck
```

---

## 14. Remaining Uncommitted Changes and Their Ownership

- Working tree is **completely clean** (`git status` reports `nothing to commit, working tree clean`).
- All changes belong to the approved browser improvements milestones.

---

## 15. Baseline Backup Location

The baseline copy of pre-existing diffs and index state was created prior to modifications and is preserved at:
`/Users/rushil.dev/.gemini/antigravity-ide/brain/605d4ad4-37a2-4130-b8f4-a188ef5b7c58/baseline_backup/`

---

## 16. Confirmation of No Remote Pushes

- **Zero commits have been pushed to any remote repository.**
- All 6 milestone commits are stored exclusively on the local `main` branch.
- Destructive Git commands (`git reset --hard`, `git clean`, etc.) were not executed.
