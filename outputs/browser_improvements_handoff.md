# Browser improvements: implementation and validation handoff

Updated September 13, 2026. This replaces the earlier five-milestone completion report. The implementation gaps identified in the independent review have been corrected. Provider login acceptance and real operating-system credential-store access remain separate manual validation items; automated results below do not establish those outcomes.

## What now works

### Native sessions, authentication foundations, and ownership

The browser retains its runtime User-Agent and profile-backed Electron sessions. This is Electron identity, not a claim to be standalone Chrome. Existing OAuth popup, redirect, permission, and recovery foundations remain in place.

Agent requests carry their actual task identity from the preview automation ingress. Assigned tabs reject absent or mismatched task identities, including observation requests. Explicit human toolbar actions remain distinct. Reassignment, recreation, cancellation, and human takeover invalidate queued operations and in-progress verification. Resize and media acquisition check control across asynchronous boundaries.

One persistent, serialized CDP connection coordinates recording, emulation, screenshots, and automation. DevTools or unexpected detach invalidates pending commands; a timed-out command releases the owned connection. Recorder teardown cannot detach another consumer. Loading precedes initial media emulation so a fresh guest does not hang awaiting CDP initialization.

Native input uses CDP mouse and keyboard events with scoped focus emulation. Expected injected events are distinguished from user input. Stationary hover updates caused by attaching a view are not takeover; real movement, clicks, and keys remain takeover. Background actions prepare a native surface beneath the app renderer and release it afterward. Verification retains that surface through its evidence capture. Control is rechecked after asynchronous surface preparation.

### Recording, reviewed replay, and real task dispatch

Starting recording closes the review dialog while keeping recording active. The toolbar reopens Stop & review. Review drafts survive tab switches in a bounded in-memory store. Interrupted recording can be recovered for review. Drafts are not stored in localStorage; restarting Tabs is not a promise of unsaved-draft persistence.

A shared Playwright generator is used by both recording entry points. It generates the installed `playwright/test` entry point, preserves the recorded initial route, validates fragile selectors and required parameters, and never substitutes a placeholder passing assertion. Missing inputs are named environment variables; captured fill values are not persisted. Launch the desktop process with the reviewed environment variables when replay needs those values.

The native runner executes every supported action: navigation, click, fill, key press, select option, check, and uncheck. Assertions check actual visibility, locator-scoped normalized text, and exact values. Parameters and selector review are validated before navigation. Failed navigation is propagated instead of replaying a stale page. Pass requires every step and assertion to complete, followed by an actual screenshot from the same session and control lease. Missing inputs report not verified; interrupted runs cannot report pass.

Sending a reproduction requires a real task in the current project and available write/dispatch services. It writes the spec and sanitized evidence JSON beneath `tests/e2e/reproductions/` in that project's actual directory, then awaits the orchestration command. A failed write or dispatch is not success. Retries use the same saved reproduction and command identity. After successful dispatch the button is disabled; New recording starts a separate reproduction. Screenshot artifacts can be revealed from review.

### Native comparison

Comparison uses two independent WebContentsViews, not renderer iframes. Each pane has an explicit browser profile partition, session identity, and CDP viewport override. Responsive, route, and profile comparisons capture their own pane artifacts. Two synthetic profiles were verified to expose different cookies at the same origin, and evaluated viewport dimensions matched 375 × 667 and 1366 × 768.

Navigation and normalized document scrolling synchronize with loop prevention. Stale geometry updates do not undo a guest navigation. Closing comparison destroys only its temporary views and restores the original tab when appropriate. Nested scroll-container synchronization and changes to a site's own responsive logic are not claimed.

### Readiness

The desktop performs bounded, cookie-free HTTP(S) probes of literal loopback addresses. The renderer does not use no-cors fetch or fabricate HTTP 200. Successful HTTP responses, redirects, server errors, refused connections, and unknown failures remain distinct. Probes do not follow redirects or send the signed-in profile's cookies.

Each probe belongs to one target generation. Late responses from an old URL are discarded. Auto-reload occurs only on offline → ready for the same target, with no overlapping request for the active target. The existing discovered-server list remains connected to navigation.

### Import support and cancellation

The importer discovers Chrome, Edge, Brave, Chromium, Arc (macOS), Firefox, and Safari where their platform paths are supported. Support means the implemented cookie formats below, not all browser session state.

- macOS Chromium cookies: existing Keychain/AES-CBC support, with bounded subprocess fallback.
- Linux Chromium cookies: Secret Service v2 lookup through `secret-tool`, plus Chromium's legacy fallback formats. A missing/locked keyring produces a visible partial-import warning.
- Windows Chromium cookies: legacy DPAPI-unwrapped AES-GCM support. App-Bound/v20 is unsupported and explicitly reported. An App-Bound key does not prevent importing readable rows or supported legacy rows when available.
- Firefox/Safari: their existing cookie readers remain present. This is not an NSS-password importer.

SQLite imports use a consistent private VACUUM snapshot and fail clearly if a safe snapshot cannot be obtained. The unsafe raw database/WAL copy fallback was removed. Expired cookies are skipped. Host-only/domain scoping is preserved. Failed cookie writes and flush failures are surfaced as counts/warnings. Cancelling closes the UI, stops further destination writes, and reports already completed writes; it does not roll back or erase existing destination cookies. An outstanding OS key lookup/read may take until its bounded operation finishes before cancellation returns.

Cookies do not include passkeys, passwords, local storage, every session token, or a guarantee that a provider will accept an imported session. No personal browser cookie database or keychain was read during this work.

## Validation evidence

- Desktop package: **36 files / 306 tests passed**.
- Web package: **171 files / 1,263 tests passed**, using two Vitest workers.
- Shared package: **33 files / 405 tests passed**.
- Browser-rendered recording workflow: **1 real Chromium UI test passed**. It exercises close-with-recording-active, review, remount/tab switch, retained draft, project-scoped writes, and one successful dispatch. The desktop/task services in this UI test are controlled fixtures.
- Real Electron native workflow: **passed** using isolated temporary app storage and synthetic cookies. It checks two actual profile partitions, both viewport sizes and screenshots, original-tab preservation, task mismatch rejection, native recording, individual background clicks, and replay of **10 steps / 4 assertions**, including Enter, checkbox check/uncheck, and select/value verification while the source view is hidden.
- `vp check`: **passed**, with existing lint warnings. Root Vite+ configuration now reuses `.oxfmtrc.json` exclusions rather than rewriting generated routes.
- `vp run typecheck`: **12 workspace tasks passed**. Existing advisory Effect diagnostics remain.
- `git diff --check`: passed before commits.

An earlier unconstrained web run timed out importing an unrelated chat test while other checks were active. The complete web suite passed with two workers; no test timeout was increased or test skipped. The historical full-workspace server-suite timeouts were not reclassified as passing. Full affected-package suites and workspace typechecking are the evidence for this change.

Reproduce from `tabs-main`:

```sh
bun run --cwd apps/desktop test
bun run --cwd apps/web test --maxWorkers=2
bun run --cwd packages/shared test --maxWorkers=2
bun run --cwd apps/web test:browser src/components/browser/RecordIssueDialog.browser.tsx
bun run --cwd apps/desktop test:browser-workflows
vp check
vp run typecheck
```

The native workflow harness opens its own test window, uses synthetic data only, and cleans its temporary bundle/profile after Electron exits. It does not start or stop a user's Tabs instance. Playwright Chromium must be installed for browser integration tests.

## Manual checks still requiring the account owner or another OS

1. In Tabs, complete Google, ChatGPT, and Claude login using the desired provider routes. Record Electron version, profile, popup/redirect route, and outcome without credentials. Verify login survives restart and logout remains isolated to its profile.
2. Test actual platform/hardware passkeys separately from passwords and verification codes. Capability reporting alone is not successful passkey authentication.
3. On the corresponding OS, validate consented imports against real Keychain, Secret Service, or supported Windows DPAPI stores. Synthetic format tests establish code paths, not access to a particular user's protected store.

These checks were not performed or fabricated. Provider restrictions cannot be promised away by code or by cookie import.

## Local history and preservation

- `d1ff5158` — native comparison, recording/replay, CDP coordination, import boundaries, contracts, and repeatable Electron workflow harness.
- `ffa774bb` — recheck human takeover after asynchronous background-surface preparation.
- `5fcdb95e` — native comparison UI, persistent review and task dispatch, readiness gating, importer cancellation UI, and Vite+ formatting configuration.
- Documentation commit — this handoff and the preserved historical review.

All commits remain local. The pre-existing `tabs-main/bun.lock` change was preserved and excluded from commits. Earlier implementation/review commits and the reported baseline backup were not reset, amended, or deleted. The T3 reference tree was not edited.

## Reference for Linux key lookup

The Secret Service integration follows Chromium's v2 schema and application attribute, also used by the local T3 reference helper:

- [Chromium libsecret key storage](https://chromium.googlesource.com/chromium/src.git/+/729c95b3a98db22f82fcac5c0dbf5141a4c44054/components/os_crypt/key_storage_libsecret.cc)
- [GNOME secret-tool implementation](https://github.com/GNOME/libsecret/blob/main/tool/secret-tool.c)
