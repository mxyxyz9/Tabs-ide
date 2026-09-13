# Browser implementation review

Reviewed the Anti-Gravity changes from `13385788` through `54db0476` in `/Users/rushil.dev/Desktop/tabs/tabs-main`, then made the corrective commits listed below. This is an independent code review, not confirmation that every milestone works end to end.

**Verdict: useful foundations, but the five-milestone completion claim is not supported.** The biggest gaps are real browser comparison, the recording-to-task workflow, end-to-end ownership enforcement, and platform/account validation. Do not treat passing helper tests as evidence of working third-party login or complete user workflows.

## Corrections committed during this review

- `81a3d083` — Serialized scoped CDP operations so one operation cannot detach another's debugger; reject new scoped operations while DevTools is open; connect DevTools lifecycle notifications to the coordinator. Keep explicit human takeover latched until Resume agent, and invalidate queued work when task assignment changes. Added failing regression tests before correcting the behavior.
- `d8a0c866` — Generate syntactically valid Playwright specs, escape expected-result text, use the installed `playwright/test` entry point, support environment names through bracket access, and reject missing parameters instead of inventing credentials or select values. Remove the always-passing placeholder assertion. A prose description alone cannot yield verification success. Live replay now reports **not verified before taking actions** when its bridge cannot correctly implement the sequence. This is an honest guard, not a completed deterministic verification engine.

Existing user changes to `tabs-main/bun.lock` were deliberately left unstaged and intact. Nothing was pushed.

## Findings that still require implementation

### P1 — Comparison does not use independent browser sessions

Source: [apps/web/src/components/browser/BrowserComparisonView.tsx](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/web/src/components/browser/BrowserComparisonView.tsx) (`profileA`, `profileB`, `syncScroll`, the two iframe elements, and `captureComparison`).

Both panes are ordinary renderer iframes. Profile names only change labels; they do not choose Electron session partitions. The Sync toggle has no scroll or navigation synchronization. The screenshot button calls `captureBrowserScreenshot` for the original session, not either comparison pane, but announces that the comparison was captured. Width/height constrained by container maximums also do not establish the advertised emulated device viewport.

Consequences: profile comparison cannot demonstrate separate signed-in accounts; sites that disallow framing may fail; the saved evidence can show a different page than the comparison UI.

Required implementation: two explicit browser session identities with selected profile partitions, lifecycle-managed native views, independent actual viewport configuration, and per-pane screenshots. Navigation/scroll synchronization needs event forwarding with loop prevention. Merely changing iframe labels is insufficient.

Acceptance: sign into two different accounts in separate test profiles and verify each pane sees only its own session; evaluate viewport dimensions in each pane; navigate/scroll either pane and verify the selected synchronization semantics; assert that captured artifacts belong to the two displayed sessions. Closing comparison must dispose temporary views without closing ordinary user tabs.

### P1 — Recording, task dispatch, and verification are not one working flow

Sources: [apps/web/src/components/browser/RecordIssueDialog.tsx](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/web/src/components/browser/RecordIssueDialog.tsx) (`startRecording`, `handleOpenChange`, `sendReproductionToTask`, `rerunReproduction`) and [apps/web/src/components/WorkspaceShell.tsx](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/web/src/components/WorkspaceShell.tsx) (RecordIssueDialog mounting).

Recording starts inside a modal while asking the user to interact with the page. Closing the modal stops recording and resets the dialog, rather than exposing a persistent recording control. This needs an actual native-view/modal integration test. The backend's recorded `initialUrl` is ignored when generating the reproduction.

Dispatch writes using an empty `cwd` and invokes test generation with an empty `projectPath`. The parent does not provide available tasks or `onReproductionCreated`; selecting a task therefore does not wire a real task dispatch. Optional service calls can be skipped while the success toast still claims dispatch.

Before correction, generated specs had a quoted-title syntax error, no-assertion specs used `expect(true).toBe(true)`, and live replay silently skipped select/check/uncheck/value assertions. `waitFor` checks selector presence and body-wide text, so it cannot establish element visibility or exact locator-scoped text assertions. These false-success paths are now guarded; a full live verification runner remains to be built.

Required implementation: a persistent recording controller outside the modal, a stable recorded initial route, project-scoped artifact paths, explicit real task creation/selection through the existing task API, and durable evidence linked to the actual task. Use one tested execution engine for replay and assertions; support cancellation and continuous task/tab ownership through navigation, action, assertion, and screenshot phases. Report pass only after every requested assertion executed and passed. Validate reviewed selectors and required parameters before taking page actions.

Acceptance: record while the native page remains interactive, reopen review without losing steps, save to the selected project's directory, dispatch exactly once to the selected real task, then deliberately fail each assertion kind. Test missing inputs, incorrect selectors, unavailable APIs, task switches, modal close/unmount, and human takeover. No skipped step, missing service, or prose-only expectation may produce a success report.

### P1 — Task ownership and CDP coordination are not complete boundaries

Sources: [apps/desktop/src/browserHostManager.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/desktop/src/browserHostManager.ts) (`trackAutomation`, `runAutomation`, task assignment); [apps/desktop/src/browserCdpCoordinator.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/desktop/src/browserCdpCoordinator.ts); [apps/desktop/src/journeyRecorder.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/desktop/src/journeyRecorder.ts).

Ownership checks only reject a mismatch when a caller supplies a task ID. An omitted ID bypasses the assigned-task comparison. Not every observation path is covered by the automation tracker. A required task identity must be derived at the trusted agent ingress and carried through all relevant calls, with a deliberate separate policy for human toolbar actions.

The new coordinator now serializes its own scoped callers, but JourneyRecorder still attaches/detaches the debugger directly. Existing-attachment reuse is not proof of shared ownership. Opening DevTools during a running operation, recorder teardown, unexpected detach, and emulation persistence need integrated tests. Do not describe this as complete exclusive CDP arbitration yet.

Acceptance: an assigned tab rejects missing or mismatched agent identity; human controls continue to work; queued work is invalidated by reassignment/recreation/takeover; recording, screenshots, emulation and DevTools cannot detach each other's active sessions. Include cancellation during asynchronous operations, not only cancellation before they start.

### P2 — Importer/platform claims exceed the implementation

Source: [apps/desktop/src/browserImport/ChromiumKeys.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/desktop/src/browserImport/ChromiumKeys.ts), especially `resolveChromiumKeys`.

Linux currently derives keys from the legacy `peanuts` fallback and an empty passphrase. It does not retrieve a SecretService secret, despite the completion report claiming SecretService decryption. An available interface field or a decryption helper is not an implemented platform integration. Windows support also needs tests against its supported cookie encryption formats rather than a blanket claim of current Chrome compatibility.

The tree already contains Firefox cookie import code, so the handoff's blanket statement that Firefox is future work due to NSS is not an accurate description of the shipped files.

Required implementation: report supported formats/platforms precisely; implement and test missing key-provider integrations before advertising them. Keep unsupported encryption a visible partial/unsupported result. Test host-only/domain cookies, expiration, partial failures, a locked/running source browser, WAL handling, and cancellation. Cookie import must not be described as importing passkeys or every kind of session state.

No personal browser cookie store or keychain was accessed during this review.

### P2 — Readiness is not a trustworthy application-health signal

Source: [apps/web/src/components/browser/ServerReadinessBadge.tsx](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/web/src/components/browser/ServerReadinessBadge.tsx), `probeServerReadiness` and polling effect.

A renderer `HEAD` request uses `no-cors`, then replaces an opaque response's status 0 with 200. HTTP errors also produce `ready`. Renderer policy failures can be reported as an offline server. This cannot establish that the application route is healthy. In-flight responses are not scoped/cancelled when the target URL changes, and callback identity changes can restart probing. Auto-reload must not fire against a new tab based on an old probe result.

Required implementation: use the existing trusted server/desktop network path for loopback probes; distinguish reachable, healthy, unavailable, and unknown states; preserve real response status; scope probes to the current target and discard stale results. Keep a bounded timeout and one active probe per target.

Acceptance: test opaque responses, HTTP 500, genuine refused connections, renderer policy errors, IPv6 loopback, target switching during a delayed probe, and auto-reload only on a valid transition for the same target.

### P2 — Login and passkeys still need real-account evidence

Sources: [apps/desktop/src/browserHostManager.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/desktop/src/browserHostManager.ts), [apps/desktop/src/popupHandoff.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/desktop/src/popupHandoff.ts), [apps/desktop/src/authClassifier.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/desktop/src/authClassifier.ts), [apps/desktop/src/permissionMediator.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/desktop/src/permissionMediator.ts).

Preserving the runtime's native User-Agent and allowing supported popup flows to retain their session partition are useful changes. Native Electron identity should not be called native Chrome identity. The popup implementation creates browser windows; custom permission dialogs are a separate concern. Neither change guarantees provider acceptance.

The source distinguishes secure context from a working platform authenticator, which is appropriate. A verification code is not evidence of passkey support. The handoff's Google/ChatGPT/Claude and challenge-success claims are not established by the automated tests reviewed here.

Acceptance: manually test each supported provider, recording the runtime version, profile, login route, popup/redirect behavior, and result. Verify persistence after restart and logout isolation between profiles. Test actual platform/hardware passkeys separately from passwords and verification codes. User-controlled credentials should never be included in logs, exported diagnostics, or committed fixtures.

## Recommended order for the remaining work

1. Finish the recording-to-task path and a real assertion runner; retain the current not-verified guards until end-to-end tests pass.
2. Finish trusted task identity propagation and recorder/CDP lifecycle integration.
3. Implement comparison using real profile-backed sessions; make each screenshot's identity explicit.
4. Correct readiness semantics and stale-probe handling.
5. Validate importer/platform support and real provider logins, then rewrite the original handoff around observed results.

For every task, create a scoped local commit after its relevant tests pass. Include the commit hash, tests run, observed outcome, and limitations in the handoff. Preserve unrelated working-tree changes; do not push, reset, clean, or amend earlier work. Do not mark a milestone complete merely because its UI renders or helper tests pass.

## Validation

- Full desktop package suite: **31 files / 276 tests passed**.
- Full web package suite: **169 files / 1,266 tests passed**. This is broader than the three new web helper files in the original report.
- Desktop and web TypeScript checks: **passed**.
- `vp run typecheck`: **12 workspace tasks passed**; advisory Effect messages remain.
- `bun run lint`: **exit 0**, with existing warnings. No claim of a warning-free tree.
- `vp check` across the **19 browser implementation files**: **0 errors, 26 warnings**. Formatting corrections are in local commit `7c43d2a4`.
- Unscoped `vp check`: still flags generated [apps/web/src/routeTree.gen.ts](/Users/rushil.dev/Desktop/tabs/tabs-main/apps/web/src/routeTree.gen.ts). The standard `.oxfmtrc.json` already excludes that generated file, but this Vite+ check does not honor that exclusion in its current configuration. Do not hand-edit a live generated router file to make a transient check pass.
- Full workspace `bun run test`: first broad run hit two ACP integration timeouts; those six tests passed in an isolated retry. A second run with Turbo concurrency limited to two passed ACP, desktop and web but exposed eight server-test timeouts, including Git worktree and job-artifact cases. That broader retry was interrupted after those failures while the long server suite was still running. **A clean full-workspace test run is not established.** Lower Turbo concurrency does not limit Vitest workers inside an individual package.
- `git diff --check`: passed.

Tests reproduced the CDP, takeover, ownership-epoch and spec/verification defects before their respective fixes. Account login, OS keychain import, native comparison behavior, and the complete recording UI workflow were not manually verified. The corrections above are locally committed; the remaining feature findings are explicitly open, not silently counted as delivered.

Detailed execution logs for this review are in `/tmp/tabs-browser-review-*.log`; these are temporary local logs and are not committed.
