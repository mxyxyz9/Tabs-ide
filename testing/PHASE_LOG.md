# Testing Tab — Phase Log

> Each phase prompt reads this file first (if it exists) to know what's already built, then
> appends its own entry before finishing. This is the substitute for keeping one long session
> alive — it's how a fresh Codex session picks up context without you re-explaining anything.

## How to use this
1. Before firing a phase's slash command, make sure this file is in the repo root (create it
   empty with just this header the very first time).
2. Each phase prompt is instructed to append a dated entry: what it built, what decisions it
   made that later phases need to know about, what it explicitly deferred or couldn't verify.
3. If you run phases out of order, check this log first — a phase prompt will refuse to
   proceed (and tell you why) if a hard prerequisite from an earlier phase is missing.

---

<!-- Entries appended below by each phase. Do not hand-edit unless correcting something wrong. -->

## 2026-08-11 — Phase 1: Foundation

### Built

- Added a top-toolbar **Testing** tool with a target URL field, manual authentication capture controls, exploration control, live status, graph counts, and keyboard/ARIA tab behavior consistent with the existing workspace shell.
- Integrated Microsoft's Playwright MCP in-process. The crawler drives a real browser through MCP accessibility snapshots and uses intent locators (role plus accessible name), not screenshots, DOM/CSS selectors, or direct Playwright automation.
- Added a bounded state-graph crawler. It replays paths from the entry URL, prioritizes deeper/novel states, penalizes repeated chrome and circular actions, remains same-origin, avoids dangerous actions, normalizes volatile content before hashing, and currently caps exploration at 30 states per run.
- Added pre-cache/pre-model security middleware: zero-size/hidden and over-depth accessibility content is removed; instruction-like text is flagged and stripped; email, phone, and card-like values are replaced with deterministic project-scoped tokens; structurally static subtrees are hashed and cached.
- Added shared contracts and WebSocket methods for status, authentication capture, authentication completion, and exploration.

### State Transition Graph storage

- Stored outside the user's project git history at `<Tabs server stateDir>/testing/state-graph.sqlite` (WAL-enabled SQLite). MCP output and persistent authentication profiles live under the same server-owned `testing/` directory.
- `crawl_runs`: run ID, project ID, target URL, running/completed/failed status, error, and timestamps.
- `graph_nodes`: project-scoped structural state hash, URL/title, tokenized sanitized accessibility snapshot, first-seen run, and timestamp.
- `graph_edges`: run/project, from/to state hashes, action role/name, replayable intent locator, and timestamp.
- `pii_tokens`: project-scoped deterministic token, PII kind, local-only plaintext/digest mapping, and timestamp.
- `subtree_cache`: project-scoped structural subtree hash, tokenized content, approximate token count, hit count, and last-used time.
- `auth_sessions`: project ID, persistent browser-profile path, and capture timestamp.

### Authentication capture and reuse

- **Capture Login Session** opens a headed MCP browser at the target URL with a persistent, project-keyed browser profile under `<stateDir>/testing/auth/`. The user completes login, SSO, or MFA manually.
- **Finish & Save Session** closes the capture browser and records the profile. Later exploration sessions launch MCP with that same profile. Login automation is intentionally not implemented.

### Decisions later phases must respect

- Treat the stored snapshots as already sanitized and tokenized. Never place raw accessibility text in caches or downstream model prompts; detokenization data remains local in `pii_tokens`.
- State identity is the hash of normalized structural accessibility content, excluding volatile values. Actions are recorded as accessibility intent (`role` plus accessible name), not brittle selectors.
- Use `subtree_cache` before spending tokens on shared chrome. Later phases may consume the graph but should not bypass its sanitization/tokenization interception point.
- The SQLite adapter uses `bun:sqlite` under Bun and `node:sqlite` under Node 24 so the server bundle remains compatible with both supported runtimes.

### Verification

- `bun run build` passed. Final task output: `Tasks: 5 successful, 5 total` and `Cached: 5 cached, 5 total`; the server bundle completed with the existing Vite chunk-size warning only.
- Full monorepo typecheck passed through the repository-local Vite+ binary: `10 packages in workspace`, all typecheck tasks completed with exit code 0.
- Full `bun run test` passed with exit code 0 after rerunning outside the filesystem sandbox because several existing suites bind loopback ports. Targeted new unit tests reported `Test Files 2 passed (2)` and `Tests 4 passed (4)`.
- The opt-in real-browser MCP integration test crawled `apps/server/src/testing/fixtures/hidden-injection.html` and reported `Test Files 1 passed (1)` and `Tests 1 passed (1)` in 2.52 seconds. It proved the deliberately hidden injected instruction never reached the stored snapshot, while the visible email was stored only as a PII token and the button transition produced graph nodes/edges.
- `bun run lint` passed with exit code 0 (existing warnings only). Scoped `vp check` over all 18 Phase 1 files passed with `Found 0 errors`; `git diff --check` also passed.
- Repo-wide `vp check` could not be made clean within this phase: it reports 118 pre-existing formatting failures in files unrelated to Phase 1. Those unrelated files were not rewritten; the complete Phase 1 change set was checked separately and passes.

### Deferred or not verified

- No external UAT/dev URL was supplied—the prompt contained a placeholder—so the representative local fixture was used for the live MCP crawl. An authenticated third-party UAT app was therefore not verified in this environment.
- Excel ingestion, reconciliation, generated scripts, execution/healing, and reporting remain explicitly deferred to later phases.

## 2026-08-11 — Phase 1b: Validation & Hardening

### Changed

- Replaced the crawler's fixed 30-state run limit with the validated `maxStates` request setting. The Testing UI exposes **Maximum states per run**, defaults to 30, accepts 1 through 10,000, and the live Electron run exceeded the former default while configured for 150.
- Added an optional, loopback-only **Browser / Electron CDP endpoint**. With no endpoint, the existing managed Chromium profile continues to support ordinary web/UAT targets. A CDP endpoint connects the same crawler to an isolated Electron or externally managed Chromium instance.
- Added `TABS_DESKTOP_USER_DATA_DIR` for isolated desktop validation profiles so a crawler run does not reuse or mutate the developer's normal Electron profile.
- Hardened desktop/dynamic crawling: bounded startup/accessibility stabilization; empty MCP snapshot support; interrupted-run recovery; retry of transient overlay clicks; replay sanitization/tokenization before action matching; and branch-local handling of stale replay actions.
- Removed transient MCP references and viewport boxes before graph hashing, caching, or persistence. This prevents changing `ref`/`box` annotations from manufacturing new states while retaining role/name intent locators on edges.
- Bounded circular planning to at most two occurrences of the same intent per path and excluded destructive, authentication, filesystem/project-launcher, task-runner, self-exploration, terminal-creation, and restore-default controls from autonomous clicks.
- Extended PII tokenization with local shell host identities such as `user@workstation`. The live audit found this case after the conventional email rule correctly ignored it; a regression test now proves it is tokenized without treating help text such as `@tag` as PII.

### Real desktop validation

- Target: the full Tabs Electron development application, launched from the desktop dev runtime with renderer URL `http://localhost:5733`, an isolated `TABS_HOME`, an isolated Electron user-data directory, and CDP at `http://127.0.0.1:9224`. Port 5733 by itself is only the React renderer and is **not** treated as full-app validation because it lacks Electron's native bridge, backend lifecycle, and embedded VS Code surfaces.
- The visible Testing toolbar UI was used to configure the target, the optional CDP endpoint, and `maxStates=150`. The manual **Capture Login Session** / **Finish & Save Session** flow was also exercised. Tabs has no normal web login, so this verifies headed-profile lifecycle and reuse only; it does not claim credential-authenticated third-party coverage.
- Per the user's resource-bounding direction for this very large application, the final clean crawl was manually stopped after **23m 15s** rather than exhaustively draining every safe Tabs path. At stop it had persisted **34 normalized states**, **72 intent-locator edges**, **34 cache entries**, and **39 cache hits**. It neither plateaued nor hit the 150-state cap; its run row is honestly marked `failed` with `Interrupted before completion`, while its sampled graph remains available for inspection.
- The bounded run demonstrated continued discovery above the old default (34 > 30). Representative paths covered the workspace toolbar, Agents, Code, Git, Browser, Server, Testing, settings, terminal visibility, and project/new-tab surfaces without activating filtered destructive or authentication controls.
- Security inspection found zero persisted MCP refs, zero persisted viewport boxes, zero bearer-token strings, zero prompt-injection strings, zero non-`getByRole` edges, and zero unsafe filtered edges. The only raw sensitive pattern discovered was the shell host identity described above; it was fixed and regression-tested after the bounded run. Reversible PII mappings remain local-only.

### Verification

- Server Testing tests passed: `Test Files 4 passed | 1 skipped`, `Tests 18 passed | 1 skipped`. The opt-in real-browser hidden-injection fixture passed separately: `Test Files 1 passed`, `Tests 1 passed`.
- Contracts tests passed (`5` tests) and workspace-shell tests passed (`7` tests).
- Full monorepo typecheck passed: `10 successful, 10 total`.
- Full build passed: `5 successful, 5 total`. Full lint exited 0 with existing repository warnings only.
- Scoped formatting over the changed Testing/desktop files passed, and `git diff --check` passed.

### Decisions and deferred work

- The crawler core remains transport-neutral: managed Chromium covers web applications and CDP covers Electron/Chromium desktop surfaces. Native mobile is not falsely represented as Playwright support; it requires a future mobile accessibility/automation transport (for example, Appium) that feeds the same sanitized state/edge model.
- Large applications do not require exhaustive traversal to establish a useful validation sample. Future run-control work should add an explicit time/effort budget and graceful user cancellation so a bounded run can end with a non-failure termination reason instead of requiring process interruption.
- The Phase 1/1b implementation remains uncommitted in the current worktree alongside unrelated pre-existing changes. No commit, push, or deployment was performed.
- No Phase 2 Excel ingestion or reconciliation work was started. Phase 2 still requires the user-provided real QA workbook before it can be declared complete.

## 2026-08-12 — Phase 1c: Scoped Exploration

### Built

- Added three explicit exploration boundaries: **This exact page**, **This path and its subpages**, and **Entire application origin**. The Testing UI defaults new runs to path scope; callers that omit the new field retain the previous origin-wide API behavior.
- Exact-page scope compares the complete target URL. Path scope uses segment-safe prefix matching, so `/settings` includes `/settings/profile` but not `/settings-old`; hash-router targets such as `#/settings` likewise include `#/settings/themes` but exclude `#/agents`.
- Added an optional time budget. The UI defaults to five minutes and can be cleared for an unlimited run. Expiry completes the run normally with termination reason `time-budget` rather than marking it failed.
- Scoped runs continue to merge their verified nodes and edges into the existing project graph. Out-of-scope and cross-origin states are neither persisted nor expanded.
- Extended `crawl_runs` additively with scope, state/time limits, termination reason, states visited, transitions observed, and duration. Existing databases receive the columns without discarding Phase 1 graph or authentication data.

### Verification

- Contract tests passed with scope and duration validation: `9` tests.
- Server Testing tests passed: `23 passed | 1 skipped`.
- Real-browser MCP integration passed `3` tests. The scoped fixture stored `/area` and `/area/child` while excluding `/outside`; a separate one-second run completed successfully with `time-budget`.
- The running Electron UI exposed labelled, keyboard-operable controls for Browser/Electron CDP endpoint, target URL, exploration scope, maximum states, and optional time budget. Path scope and the five-minute budget were visible as defaults.
- Full monorepo typecheck passed: `10 successful, 10 total`. Full build passed: `5 successful, 5 total`. Lint exited 0 with existing warnings only; scoped formatting and `git diff --check` passed.

### Deferred

- Native mobile remains a future transport adapter rather than being misrepresented as Playwright coverage. A mobile driver can later feed the same scoped, sanitized state graph.
- No new exhaustive Tabs crawl was run for this follow-up; focused real-browser fixtures verified the new boundary and termination behavior without repeating the resource-heavy Phase 1b crawl.
- Phase 2 and later work remain unchanged and gated by the real QA workbook.

## 2026-08-12 — Phase 1d: Guided Setup & Credential Safety

### Changed

- Reorganized the Testing panel into a three-step setup guide: **Choose what to test**, **Prepare access**, and **Set limits and explore**. The target URL and page/path/origin boundary now come before authentication and resource limits, giving a clear keyboard and visual sequence instead of one dense set of controls.
- Added explicit authentication modes: **No sign-in required**, **Sign in manually in local browser**, and **Use signed-in Electron/Chromium**. Exploration remains disabled until the selected access method is ready.
- Kept credentials out of Tabs-owned form fields. Local-profile mode opens the target in a headed browser for the user to enter passwords, SSO, and MFA directly; only the browser profile is retained beneath the local Tabs Testing state directory. Connected-session mode reuses the session already present in the isolated Electron/Chromium instance and does not copy credentials into the graph.
- Added plain-language privacy guidance beside each access mode. Cookies, authorization material, and entered credentials are not added to accessibility snapshots, graph nodes, prompts, caches, or generated reports. Reversible PII mappings remain local under the existing Phase 1 security boundary.
- Preserved the scoped exploration controls and bounded defaults. The guide starts a focused page/path/origin crawl rather than implying that a user must map a large application exhaustively.

### Existing-architecture integration decisions

- The state graph remains a framework-neutral, server-managed artifact. Later generated tests will stay in server-managed storage by default; writing into a company repository will require an explicit export choice and configuration for that repository's framework, folder layout, naming, page-object, fixture, and command conventions.
- Later CI credentials must be referenced through the company's existing secret manager or environment-variable names. Testing must not copy secret values into SQLite, prompts, generated fixtures, replay data, or reports.
- Recorded video or model vision may later be offered as opt-in supporting evidence through the configured provider abstraction, after sanitization. It is not a substitute for observable accessibility states and verified transitions, and it is not part of Phase 1.
- Web targets continue to use managed Chromium, Electron/Chromium targets can use the CDP session option, and a future native-mobile driver can feed the same sanitized graph contract. The UI does not claim native-mobile automation is already implemented.

### Verification

- The running Electron application was inspected through its desktop CDP session. The Testing panel exposed labelled controls for target URL, exploration boundary, authentication method, limits, and the scoped start action in the intended three-step order.
- The authentication selector exposed all three choices. Selecting local-profile mode showed the manual sign-in action and its local-storage/privacy explanation; returning to no-auth restored the normal readiness path. No new crawl was launched for this UI-focused follow-up.
- The targeted workspace-shell test passed, followed by the web package typecheck and production build. Repository lint exited 0 with existing warnings only; scoped formatting and `git diff --check` passed.

### Deferred

- No passwords, SSO tokens, or third-party credentials were requested or stored during this follow-up. A real authenticated target still requires the user to sign in interactively in the headed browser or provide an already authenticated isolated session.
- Company-specific export adapters, CI secret references, video/vision evidence, and native-mobile transports belong to later phases and require explicit configuration or opt-in where noted above.
- No Phase 2 Excel ingestion or reconciliation work was started. Phase 2 remains gated by the user-provided real QA workbook.

## 2026-08-12 — Phase 2: Ingestion, Reconciliation, and Dual-Mode Cases

### Built

- Added production `.xlsx` ingestion through `exceljs`. The parser scans the first 20 rows of every worksheet, accepts normalized aliases for Case ID, Description, and Steps, parses numbered/newline-separated procedures, preserves worksheet/row provenance, rejects files without all required columns, and retains blank/malformed/duplicate rows as reviewable errors instead of silently dropping them.
- Added deterministic graph reconciliation. Each written step is ranked against intent edges, the shortest reachable prefix is selected from the graph entry state, and unmatched steps persist an expected-versus-observed finding. Generic action words are excluded from scoring so an unrelated button cannot satisfy a step merely because both are buttons.
- Added live verification through the existing Playwright MCP profile. Reconciled role/name actions are resolved again in a sanitized live accessibility snapshot before import is accepted; renamed or missing controls become `live-verification` mismatches.
- Added an accessible reconciliation UI with workbook selection, import/verification progress, provenance, status badges, mismatch details, and keyboard-operable Accept/Edit/Reject actions. Users without a workbook can add starter scenarios derived only from reachable graph paths into the same review queue.
- Added graph lifecycle controls. **Update graph** reruns bounded exploration with the current page/path/origin settings. **Clear graph** requires confirmation and removes crawl nodes, edges, cache, and PII mappings while preserving imported cases and the local authentication profile.

### Additive SQLite schema

- `test_imports`: project, workbook name/path, and import timestamp.
- `test_cases`: stable internal ID, original/generated external ID, source mode, description, ordered steps JSON, source sheet/row, reconciliation status, mismatch JSON, matched state path, review decision, Standalone/UAT status, CI status, notes, and timestamps.
- `test_case_reviews`: append-only before/after JSON, decision, notes, and timestamp for every accept/edit/reject action.
- Reconciliation statuses are `matches`, `needs-review`, and `blocked`. Mismatches store an optional step index, expected text, observed text, and kind (`parse`, `duplicate`, `unreachable`, or `live-verification`).
- The same case row supports Standalone/UAT (`passed`, `failed`, `blocked`, `not-applicable`, `not-yet-tested`) and CI (`pass`, `fail`, or null) without parallel schemas.

### Controlled workbook verification

- Authored and visually rendered `testing/fixtures/phase2-controlled.xlsx`. The artifact contains six cases with tolerant header aliases, numbered steps, a valid live path, a deliberate removed action, duplicate IDs, a blank ID, and missing steps. A LibreOffice normalization pass exposed and resolved an OOXML namespace compatibility issue between the artifact authoring runtime and ExcelJS.
- The end-to-end service integration first crawled a real local HTTP fixture, then imported the controlled workbook. Actual result: **6 imported, 1 Matches, 1 Needs Review, 4 Blocked**. `QA-003` replayed Profile -> Save changes live; `QA-002` persisted an `unreachable` finding for Delete account.
- A separate live MCP reconciliation test replayed a matching path, renamed Save changes to Apply changes, reran, and persisted a `live-verification` mismatch rather than guessing.
- Unit verification passed: workbook/parser/reconciliation and graph-store suites reported **8 tests passed**. The full live crawler integration reported **4 tests passed**; the Phase 2 service integration reported **1 test passed**.

### Repository verification

- Full monorepo test passed: **95 files passed, 5 skipped; 880 tests passed, 29 skipped; 11 tasks successful**.
- Full monorepo typecheck passed: **10 successful, 10 total**.
- Full build passed: **5 successful, 5 total**.
- Full lint exited 0 with existing warnings only. Scoped formatter and `git diff --check` passed.
- Electron accessibility inspection exposed the new controls in logical order: Update graph, Clear graph, Choose workbook, Import and verify, and Generate from graph.
- Before synchronization with GitHub, the full suite and typecheck passed as recorded above. After rebasing onto `target/main` commit `12f8ee7e`, the build still passed and the scoped Testing (`28 passed, 5 skipped`), contracts (`11 passed`), and web API/store (`21 passed`) suites passed, but that upstream Claude-port commit's newly added provider baseline reports 2 unresolved shared-package imports, 29 provider test failures, and existing `threadMentionContext.ts` type errors. These failures are outside the Testing diff and are not represented as Phase 2 successes.

### Decisions and deferred work

- Existing company workbooks can retain extra sheets, columns, formatting, and arbitrary pre-header content; import reads only mapped semantic columns and preserves original provenance. Completely custom header names will need explicit mapping configuration rather than an unsafe guess.
- Deterministic graph search remains the first pass. Ambiguous semantic ranking through a configured coding-agent backend will use the structured testing operation introduced in Phase 3; unresolved ambiguity already remains human-reviewed rather than silently accepted.
- No user-provided real QA workbook exists in the workspace, so real-company workbook compatibility is not claimed. The controlled workbook gate passed; a real workbook must still be supplied for that additional validation.
- Script generation, execution/healing, and reporting remain owned by Phases 3 through 5.

## 2026-08-12 — Phase 3: Template-Driven Test Generation

### Built

- Extended the existing provider-instance text-generation abstraction with a schema-decoded
  `generateStructuredTesting` operation. Codex, Claude, Cursor, Grok, and OpenCode reuse their
  existing local CLI/runtime implementations; the direct Gemini API implementation rejects this
  operation so Testing cannot bypass the coding-agent boundary.
- Added a Testing generation queue with persisted job IDs, status, selected provider instance,
  model/options, output directory, case progress, estimated tokens, estimated cost, errors, and
  generated artifacts. Default caps are 25 cases, 200,000 estimated tokens, and USD 5; a case is
  not dispatched when it would cross a cap. Queue concurrency is one and cancellation is exposed.
- Added Playwright TypeScript generation with strict separation between page objects, external
  data fixtures, and business-flow specs. Role/name locators come only from reviewed graph edges.
  Locator fingerprints persist separately with semantic context, graph state, URL pattern, and
  verification timestamp.
- Added a stepwise Phase 3 UI. The shared Fusion backend picker lists configured subscription
  provider instances and discovered models while excluding direct API-key models. The selected
  `ModelSelection` is persisted on the generation job. Users also choose reasoning tier, managed
  versus explicit repository output, limits, and opt-in sanitized replay metadata.
- Added the built-in Page Object Model template and a versioned company-manifest format under
  `testing/templates/`. A manifest may map relative page/data/spec directories, file patterns, and
  class naming into an existing company repository. It cannot execute code, traverse outside the
  project, or inject prompt instructions. Nested output folders and TypeScript identifiers are
  validated before files are written.
- Added `@playwright/test` 1.61.1 to the server development dependencies after the generated-suite
  compile gate identified that the runtime package alone did not provide the generated imports.

### Additive SQLite schema

- `generation_jobs`: project, lifecycle status, framework, exact provider/model/options,
  server-managed or repository output location, batch progress, estimates, error, and timestamps.
- `generated_artifacts`: job/case identity plus page-object, data, and spec paths.
- `locator_fingerprints`: artifact/case, locator key, role/name, stable-attribute JSON, nearby
  semantic context, graph state, URL pattern, and last verification timestamp.
- `network_replay_metadata`: per-case opt-in flag and sanitized metadata JSON. It starts empty;
  cookies, authorization headers, credentials, and unapproved bodies are not captured.

### Verification

- The controlled Phase 2 reviewed case generated one page object, one data fixture, and one spec,
  with one persisted locator fingerprint. The opt-in verification gate compiled all three files
  under strict TypeScript and Playwright discovery listed `opens account settings` successfully.
- A company-manifest test generated nested `qa/pages`, `qa/data`, and `qa/specs` output with the
  requested `AccountSettingsScreen` naming. A separate one-token budget test stopped before any
  provider dispatch.
- Structured provider routing and schema decoding passed for the shared registry and the Codex
  command path. Codex, Claude, Cursor, Grok, and OpenCode text-generation suites passed: **5 files,
  38 tests**. Phase 3 generator/store/registry tests passed, and the final focused set reported
  **4 files, 26 tests**.
- Contracts passed **31 files, 391 tests** before the existing upstream server baseline was entered.
  Web API/store tests passed **2 files, 21 tests**, and web typecheck passed. Full lint exited 0
  with existing warnings. Full build passed: **5 successful, 5 total**.
- Full monorepo test reached **118 server files passed, 5 skipped, 6 failed; 1,060 tests passed,
  29 skipped, 29 failed**. The same 29 failures are in the pre-existing upstream Claude/OpenCode
  provider baseline recorded by Phase 2; no Testing suite failed. Full typecheck likewise remains
  blocked by that upstream provider/contracts mismatch. A filtered server typecheck reported no
  errors in Testing, text-generation, GitManager test stubs, or the Testing server route.

### Decisions and deferred work

- Managed output under the Tabs Testing state directory remains the default. Repository output is
  explicit, stays under the selected project, and is the only mode intended for CI integration.
- Generation currently uses the controlled reviewed Phase 2 case because no real company workbook
  has been supplied. Real-workbook compatibility and generation from those cases remain an honest
  external validation item, not a claimed success.
- Network replay storage and policy are present, but live request interception remains opt-in work
  for Phase 4 execution. No credentials, cookies, authorization headers, or response bodies were
  placed in generated fixtures or model prompts.
- The upstream provider baseline is not expanded into this feature's scope. Phase 4 may proceed
  using the green scoped Testing gates and successful production build, while continuing to report
  the repository-wide baseline separately.

## 2026-08-12 — Phase 4: Execution, Healing, Flakiness, Visuals, and CI

### Built

- Added one bounded Playwright execution engine shared by Standalone/UAT and CI modes. It resolves
  the repository-installed Playwright CLI, passes every argument without shell interpolation,
  limits each case to 120 seconds by default, caps stdout/stderr at 512 KiB, and persists round and
  per-case status, duration, trace, screenshot, environment target, and artifact revision.
- Added review-only locator healing. Failed locator output is compared with persisted role/name
  fingerprints and current graph edges. A proposal is eligible only at confidence `>= 0.90` with a
  `>= 0.10` lead over the second candidate. Source files are never silently changed. A third
  consecutive proposal is forced below threshold because the cap is two attempts per locator.
- Added independent flaky classification. At least three executions with the same generated
  artifact revision must contain both pass and fail before a case is marked flaky and visibly
  quarantined from the CI gate; its underlying failure result remains stored and visible.
- Added opt-in screenshot capture and exact pixel-output baselines, local one-off/daily/weekly
  schedule records with IANA timezone and next-run visibility, optional scoped `caseIds` with a
  full-suite fallback, machine-readable CI output/exit codes, and a GitHub Actions template for PR
  and successful-deployment triggers.
- Added an accessible Phase 4 UI with an operating-mode selector, labelled visual toggle, manual
  run action, local schedule input, polite run-result updates, per-case status, flaky/quarantine and
  visual state, and explicit keyboard-operable accept/reject controls for locator proposals.

### Additive SQLite schema

- `execution_runs` and `execution_case_results`: execution mode, target, artifact revision, bounded
  output, result/evidence paths, standalone/CI status, visual status, and flaky/quarantine flags.
- `healing_proposals`: original and proposed role/name, confidence, runner-up margin, diff, attempt
  count, review status, and decision timestamp.
- `visual_baselines`: locally approved screenshot hash/path. `testing_schedules`: project/job,
  target, timezone, recurrence, enabled state, and next-run timestamp.

### Verification

- A real generated Playwright TypeScript spec launched Chromium against a controlled local HTTP
  application, asserted the visible `Ready` heading, and passed end to end. The persisted round
  reported **1 passed**, retained duration/output, and created the first opt-in visual baseline.
- The generated-suite gate and execution gate together reported **2 files, 7 tests passed**. The
  normal focused execution/generation/store/contracts set reported **4 files, 27 passed, 1
  skipped**; the real-browser test is intentionally opt-in outside the live verification gate.
- A deliberately failed locator run proposed `Save setting` for the stored `Save settings`
  fingerprint above the 0.90/0.10 thresholds. The original generated source remained byte-for-byte
  unchanged. Attempts one and two remained reviewable; attempt three became `below-threshold`.
- Three comparable fake-runner rounds (fail/pass/fail) marked the third result flaky and
  quarantined; the second round was not prematurely quarantined. The CI command returned one JSON
  object and exit code 2 for missing configuration. Web typecheck passed and web API tests reported
  **14 passed**. Full lint exited 0 with existing warnings; the full build passed **5/5**.

### Decisions and deferred work

- Standalone and CI are an explicit input/UI choice over the same runner. CI callers may pass case
  IDs derived from graph impact; absence or uncertainty intentionally runs the full generated job.
- Exact screenshot equality is deterministic but sensitive to font/anti-aliasing noise. The
  configured provider abstraction currently has no image attachment operation, so an ambiguous
  visual change remains human review instead of pretending a text-only call is vision analysis.
  Adding a sanitized image-capable provider operation is deferred and must preserve the no-direct-
  API rule.
- Schedule definitions persist with correct timezone/next-run data, but this checkpoint does not
  claim an always-on background dispatcher while Tabs is closed. The GitHub Actions template also
  requires the caller to restore the managed Testing database/artifacts or export generated tests.
- The live gate deliberately used a small controlled web app rather than exhaustively driving the
  large Tabs Electron shell. Electron execution remains supported through a generated target/CDP
  setup, but a broad Electron run was avoided per the agreed resource boundary.

## 2026-08-12 — Phase 5: Reporting, Traceability, and Closed-Loop Triage

### Built

- Added primary sign-off report generation for completed Standalone/UAT rounds. A neutral
  `standard_business_brief` design produces a Word document with explicit Letter geometry,
  Calibri styles, fixed-DXA result table, running label/page number, executive totals,
  environment/build/tester metadata, per-case evidence, round-over-round changes, healing/flaky/
  visual summary, and traceability statement. The matching PDF is printed deterministically from
  HTML through the repository Playwright/Chromium runtime with native page numbering.
- Added exact external case-ID traceability across original workbook path/sheet/row or generated
  scenario, reviewed case, generated POM/data/spec and locator count, every execution result, and
  healing history. Partial IDs are not guessed. Added local-only bug drafts with executed steps,
  expected/actual, target/revision, and trace/screenshot paths; no filing connector is called.
- Added closed-loop CI failure triage through the existing selected Fusion provider/model. Only
  non-quarantined failed CI cases qualify. Error context is PII-tokenized and credential-like
  fields are redacted before the structured `failure-triage` operation; observed facts, model
  inference, classification, and recommendation stay visibly separate and no source is changed.
- Added a graph explorer API and an accessible UI table alternative that exposes every state URL,
  page title, sanitized accessibility snapshot, linked case IDs, and transition count. Added
  report inputs/paths, exact lookup, local bug drafts, and advisory triage to the stepwise Testing
  UI with labelled controls, keyboard operation, and polite status messages.

### Additive SQLite schema and storage

- `testing_reports` records run, DOCX path, PDF path, and creation timestamp. Reports remain under
  the server-managed `testing/reports/<report-id>/` directory beside the existing graph database,
  profiles, generated suites, and execution evidence.
- Traceability and graph exploration query the existing additive Phase 1-4 tables; no graph,
  authentication profile, workbook provenance, artifact, execution, or healing record is copied or
  discarded.

### Verification

- A persisted controlled Standalone run for exact ID `QA-0042` generated a real DOCX and PDF. The
  traceability query returned `QA-0042`, workbook `controlled.xlsx`, one generated artifact with
  one locator fingerprint, and the current `passed` execution/run ID. The report-generation test
  opened the DOCX ZIP package and PDF header successfully and reported **1 passed**.
- The first PDF render exposed a blank second page caused by fixed-footer print geometry. Chromium
  native footer/page numbering replaced it. The final DOCX and final PDF each rendered to exactly
  **1 US Letter page**; every page was inspected at original resolution with no clipping, overlap,
  broken tables, missing glyphs, or inconsistent pagination. PDF text extraction confirmed `UAT
  Sign-off Report`, `QA-0042`, `PASSED`, and `Traceability`. The DOCX accessibility audit returned
  **0 high, 0 medium, 0 low findings**.
- Final focused reporting/execution/generation/store/contracts/web verification reported **5 files
  passed, 1 skipped; 41 tests passed, 2 skipped**. Web typecheck passed. Filtered server typecheck
  produced no Testing or WebSocket errors; the repository-wide command remains non-zero only for
  the previously logged upstream provider/contracts baseline. Full lint exited 0 with existing
  warnings and the final full production build passed **5/5**.

### End-to-end state and deferred validation

- The integrated feature now covers scoped web/Electron-oriented discovery, local sign-in profile
  reuse, Excel reconciliation/review, Fusion-model template generation, bounded execution,
  review-only healing, flaky quarantine, visual evidence, Standalone/CI modes, reports,
  traceability, local bug drafting, advisory coding-agent triage, and graph inspection.
- No real company QA workbook, real authenticated UAT target, or credentials were supplied. Those
  validations remain unclaimed. The Tabs Electron shell was not exhaustively crawled, in keeping
  with the agreed resource boundary; testing can instead begin at a task-specific page/path.
- Closed-loop triage is contract/provider tested but was not dispatched to a live paid provider in
  this checkpoint. Ambiguous screenshot vision remains deferred until the shared provider layer
  supports sanitized image attachments. Persistent schedule definitions are present, but an
  always-on dispatcher while Tabs is closed is not claimed.
