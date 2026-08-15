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

## 2026-08-12 — Testing UX: Project-Scoped Guided Workspace & Workbook Template

### Changed

- Reworked Testing into a task-oriented workspace with a clear Start screen and persistent
  Discover, Cases, Automate, Runs, and Reports workflow navigation. The starting choices now cover
  importing an existing test plan, understanding an application first, and continuing existing
  project work; the recommended next action is derived from that project's persisted state.
- Made project scope explicit in the Testing header and retained the existing project-ID boundary
  for every API call and SQLite query. Switching a top-level Tabs project changes the Testing
  workspace rather than combining cases, graph states, runs, or reports across projects.
- Replaced the expanded case-card wall with a searchable/filterable master-detail inventory.
  Reviewers can edit a case ID as well as its description and steps. IDs must be non-empty and are
  enforced case-insensitively as unique within the current project, while the review history keeps
  the old and new values.
- Replaced decorative green emphasis with the application's primary accent for navigation,
  selection, and calls to action. Green remains reserved for semantic success states.
- Added a downloadable, parser-compatible `.xlsx` template beside the workbook picker. It contains
  the exact `Case ID`, `Description`, and `Steps` headers, ten ready-to-fill rows, filters, frozen
  headers, and an Instructions sheet explaining unique IDs and multi-line numbered steps.

### Verification

- Exercised the redesigned UI in the running Electron app through its Chrome DevTools endpoint.
  The `Tabs-ide-cleanup-vscode-web-…` project showed **0 graph states / 0 cases**, while switching
  to `Intern-batch-08` showed **21 graph states / 18 cases**, confirming live project isolation.
- Verified Start and populated Cases flows, exact case-ID search (`DISCOVERED-018`), status
  filtering, case selection/edit controls, the project badge, template download, keyboard-reachable
  controls, accessible names, and polite project-change announcements. Also exercised a narrower
  900 px viewport without expanding the crawler scope.
- Rendered and visually inspected both workbook sheets with no clipping or broken layout. Inspected
  workbook data and formula errors, normalized the OOXML for ExcelJS compatibility, passed the
  production workbook parser test, and confirmed the development server returns the template with
  HTTP 200.
- Focused contract, workbook-parser, and graph-store verification reported **3 files / 26 tests
  passed**. Web and server typechecks passed. `git diff --check`, repository formatting, full lint,
  and the full production build all completed successfully.

### Deferred

- No real company workbook, authenticated external target, or credentials were supplied, so those
  validations remain unclaimed. Arbitrary discovery of an organization's pre-existing repository
  tests is also not claimed; the existing company-template and repository-output paths remain the
  integration points for those conventions.
- Native-mobile execution remains a future transport/runtime concern. This pass keeps the workflow
  and project model target-neutral while validating it in the actual Electron application.


## 2026-08-12 — Expected Result Retrofit

### Built
- Retrofitted a new "Expected Result" field across the entire testing pipeline (schema, parsing, reconciliation, generation, and storage).
- The `workbookParser` now opportunistically reads the "Expected Result" column if it exists in the test workbook (aliases: `expectedresult`, `expectedoutcome`, `outcome`, `expected`). For backward compatibility, workbooks missing this column default to an empty string.
- In `reconciliation`, added a new check to flag a `expected-result` mismatch if the described outcome has no matching evidence (via semantic matching on page titles/URLs) in the discovered graph.
- Auto-generated scenarios (`scenariosFromGraph`) now derive an expected result based on the target node's title.
- The `generator` now grounds the LLM prompt with the explicitly defined `expectedResult` (if present) before asking for an assertion, significantly improving assertion accuracy over the previous blind guessing based only on graph topology.
- Generated `.data.ts` files now include the user's `expectedResult` alongside the LLM's `assertionText` for human auditability.
- Updated the "## Expected" section in `TestingService.draftBug` to use the `expectedResult`, and included the outcome in `triageFailure` context prompts.

### Verification
- Both the `phase2-controlled.xlsx` and `testing-cases-template.xlsx` fixtures were programmatically regenerated using `exceljs` to include the new "Expected Result" column.
- Unit and integration tests in the testing package were updated and passed (`bun run vitest apps/server/src/testing/`).
- Full typechecking (`vp run typecheck`) passed with no errors.

### Addendum: User Questions Addressed

1. **Generation Fallback Behavior**
   - *Previous state*: When `expectedResult` was an empty string, the generation logic silently degraded by omitting the explicit outcome from the prompt and asking the LLM to guess an assertion based on the graph path.
   - *Fix applied*: Modified `TestingGenerator.generate` to throw an immediate, visible error: `"Case [ID] is missing an expected result. Update the case before generation."` if any selected case has a blank expected result. This halts generation and explicitly flags the incomplete case to the user instead of silently degrading.

2. **Transient In-Page State Reconciliation Gap (FIXED)**
   - *Previous state*: `reconcileWorkbookCase` validated expected results by running `semanticScore` solely on a node's `pageTitle` and `pageUrl` fields against the user's string. It completely ignored the DOM/accessibility `snapshot`.
   - *Fix applied*: Extended the semantic scoring loop to also evaluate `semanticScore(parsedCase.expectedResult, node.snapshot)`. Expected-result validation is now routed through the same semantic-ranking step used elsewhere in reconciliation for graph candidate matching, using the actual sanitized/tokenized accessible snapshot content instead of just title/URL strings.
   - *Verification*: A test case whose expected result describes transient state (`"an error message is displayed after submitting invalid data"`) checked against a snapshot containing `text "error message: invalid data provided..."` previously scored `0.0` (failing), but now successfully scores `0.2` (passing the ≥0.2 threshold) and reconciles without a false-positive mismatch.

3. **Skipped Tests Analysis**
   The 7 skipped tests are heavy, opt-in integration tests conditionally bypassed unless explicit environment variables are set (to keep local test runs fast and deterministic):
   - `execution.test.ts` (1 test skipped): "executes a generated Playwright test end to end..." — bypassed by `it.runIf(process.env.TABS_VERIFY_GENERATED_SUITE === "1")`
   - `reporting.test.ts` (1 test skipped): "creates openable DOCX/PDF reports..." — bypassed by `it.runIf(process.env.TABS_VERIFY_REPORT === "1")`
   - `crawler.integration.test.ts` (4 tests skipped): "Testing crawler Playwright MCP integration..." — bypassed by `describe.runIf(process.env.TESTING_CRAWLER_INTEGRATION === "1")`
   - `TestingService.integration.test.ts` (1 test skipped): "imports the controlled workbook after crawling..." — bypassed by `describe.runIf(process.env.TESTING_CRAWLER_INTEGRATION === "1")`

4. **Typecheck Failures (skillsCatalog.ts and threadMentionContext.ts)**
   - `git blame` confirms that both `skillsCatalog.ts` (`ProviderSkillDescriptor` import) and `threadMentionContext.ts` (`ProviderMentionReference` import) failures were introduced by commit `12f8ee7e feat(claude): port synara claude adapter and bump version to 1.2.121`. This commit represents the upstream merge explicitly called out in the Phase 2 log and predates this retrofit branch.

5. **Legacy Generated Test Cases**
   - **None existed.** As documented in the Phase 1 and 2 logs, test script generation (Phase 3) had been explicitly deferred and had not been run against real projects. I verified against the SQLite schema that no cases exist in the `generated` status, meaning there is zero legacy data requiring regeneration.

## 2026-08-13 — Phase 6: Locator-First Discovery

### Built

- Added the project-scoped Locator-first Discover preview while retaining Classic Discover as the
  stabilization default. The workflow now exposes Automatic, Guided, and Manual capture; Actions
  + assertions, Actions only, and Everything accessible coverage; Supervised, Read-only, and
  Configured unattended safety; and configurable page/element limits (500/25 by default, bounded
  at 5,000/250). The review inventory is bounded to 100 rendered entries per page.
- Added the Locator Library with sanitized pages, stable editable keys, action/assertion/content
  classification, immutable versions, per-environment verification, lifecycle/synchronization
  status, project isolation, graph/fingerprint backfill, and exact locator entry/version references
  from generated artifacts.
- Added static TypeScript/JavaScript POM indexing through the TypeScript compiler API without
  executing repository code. The review surface reports recognized, warning, unsupported/dynamic,
  and parsed-file counts; recognition includes unsupported expressions in its denominator and file
  coverage is reported separately.
- Added Managed, Connected repository, and Snapshot export metadata flows. Initial reconciliation
  preserves unmatched Managed entries as `managed-only`; conflicts, repository-only entries, and
  healing source diffs are reviewable. Disconnecting marks sources `source-disconnected` while
  retaining paths, entries, versions, verifications, and pending review data. Repository files are
  never overwritten automatically.
- Excel steps can now map directly to verified locator entries and create focused Locator-needed
  findings without requiring a complete graph crawl. Added TXT, Markdown, DOCX, and text-PDF story
  ingestion plus schema-decoded `story-to-cases` generation through the existing Fusion model
  selection/provider abstraction. Scanned-PDF OCR is explicitly unsupported.

### Self-healing integration

- Generated fingerprints now retain locator entry/version IDs. Execution healing proposals carry
  those IDs and preserve the existing 0.90 confidence, 0.10 runner-up margin, uniqueness, review,
  and two-attempt constraints.
- Accepting a proposal verifies that its source version is still current, supersedes it with an
  immutable `source=healing` version, marks the new version verified only in the failing
  environment, retains the old fingerprint/execution history, and creates a pending reviewed
  source diff. Rejection leaves the current version unchanged. Generated/company source is not
  silently rewritten.

### Additive schema and migration

- Added migration version **6** and additive tables `testing_schema_migrations`,
  `testing_project_preferences`, `locator_discovery_sessions`, `locator_pages`, `locator_entries`,
  `locator_entry_versions`, `locator_verifications`, `locator_sources`,
  `locator_sync_conflicts`, `story_imports`, and `case_locator_mappings`. Added nullable
  locator-entry/version columns to generated fingerprints and healing proposals.
- Fresh and existing-database tests confirmed graph tables and Locator Library tables share the
  same SQLite database safely. Graph edge/fingerprint backfill is sanitized and idempotent.
  Managed-only preservation, repository disconnect, and two-project isolation were verified. The
  repository-source disconnect timestamp is guarded by an additive compatibility migration. No
  Phase 1-5 table or history is deleted or rewritten by migration 6.
- No real company database was migrated in this pass, so production backfilled/linked/conflict
  counts are not claimed. Controlled tests produced one isolated locator and one preserved
  Managed-only entry; static import produced one recognized, one warning, one unsupported/dynamic,
  and two stored repository candidates.

### Security and sanitization

- URLs are sanitized before persistence to remove user-info, normalize paths, replace every query
  value, hide credential-like parameter names, remove arbitrary fragments/hash queries, and redact
  JWT-like, secret-prefixed, credential-like, long encoded, and high-entropy normal/hash-route path
  segments. Raw target URLs remain limited to active browser sessions.
- Accessibility/semantic content passes through hidden/zero-size removal, depth bounds,
  prompt-injection stripping, PII tokenization, bearer/JWT/API-key/session/credential/high-entropy
  redaction, and text bounds. Sensitive accessible names become `manual-required` rather than
  persisted locators. The same boundary applies to graph/fingerprint backfill and story/provider
  context.
- Security tests confirmed email, phone, bearer, query, hash, credential, and high-entropy path
  values are absent from persisted/model-bound output. Temporary MCP references and geometry are
  removed. Preview screenshots are not model inputs and session-managed previews are not retained
  as locator data.

### Verification

- Focused Testing verification reported **11 test files passed, 3 environment-gated files
  skipped; 47 tests passed, 7 skipped**. New coverage includes capture filtering/truncation,
  duplicate ambiguity, hidden/injected/PII removal, project isolation, kill-switch rejection,
  Managed-only preservation, URL sanitization, static import recognition math, and text/Markdown
  story import. Existing graph, generation, execution, workbook, reporting, and service tests
  remained green.
- Contracts and web package typechecks passed. Filtered server typecheck produced no Testing or
  WebSocket errors; the repository-wide typecheck remains non-zero for the previously logged
  unrelated provider/contracts baseline. `vp` is not installed in this checkout, so its aliases
  could not be used. Full lint exited 0 with existing warnings, focused formatting passed,
  `git diff --check` passed, and the full production build passed **5/5** targets.
- Connected to the already-running Electron development shell over CDP port 9222, confirmed the
  renderer and Settings shell load, and captured screenshots under
  `/tmp/tabs-phase6-ui-2026-08-13/`. That live profile was at the no-project Welcome state, so the
  project-scoped Locator-first panel itself was not claimed as visually exercised. The existing
  desktop process was left running.

### Decisions and deferred validation

- New/existing projects default to Classic Discover. `TABS_TESTING_LOCATOR_FIRST_ENABLED=false`
  hides the preview, rejects new work, and cancels active sessions at navigation/capture/action/
  commit checkpoints. A page transaction in progress rolls back; earlier sanitized pages remain
  draft/incomplete and cannot be generated, executed, promoted by healing, or synchronized until
  reviewed after re-enable.
- Automatic capture is intentionally bounded by the configured page limit. Read-only activates no
  controls; Supervised auto-activates navigation roles only; Configured unattended additionally
  requires an approved category. Destructive, purchase, delete, credential, logout, and
  irreversible controls retain the crawler's hard block.
- Real authenticated/company repository/provider validation was not performed because no target,
  credentials, company POM folder/workbook, or paid-provider dispatch was supplied. Shadow-DOM and
  real cross-environment ambiguity, DOCX/PDF story files, scanned-PDF messaging, live kill-switch
  cancellation, and the complete project-level Electron/browser visual flow remain rollout gates.
- Native mobile execution is still a transport/runtime concern. The Locator Library, target
  environment, contracts, and case mappings are target-neutral, but this phase does not claim a
  native-mobile automation driver or continuous video preview.

### Runtime correction — 2026-08-13

- Fixed an Electron backend restart loop introduced by the static POM importer. TypeScript had
  been embedded in the server's ESM bundle, where its Node host referenced CommonJS-only
  `__filename` during module initialization. TypeScript is now a production runtime dependency and
  is explicitly externalized by the server bundler; static imports still use the compiler API and
  repository code remains unexecuted.
- Fixed the desktop backend watcher for Bun 1.3 by changing the working-directory option from
  `bun --cwd ../server` to `bun --cwd=../server`. Previously the command printed Bun help, exited
  successfully, and left Electron using a stale backend bundle.
- Verified the corrected ESM output contains an external `import * as ts from "typescript"` and no
  bundled TypeScript Node host. A standalone Node 24 server started successfully, the live Electron
  backend remained running after its automatic restart, and the Testing workspace rendered over
  CDP. The desktop smoke test, 11 focused importer/library/security tests, desktop typecheck, full
  5-target production build, formatting, and `git diff --check` passed.

## 2026-08-13 — Phase 6: Locator-First Workspace UX

### Built

- Replaced the form-first Locator-first Discover surface with a guided, project-scoped workspace:
  scope and exploration choices on a compact workflow rail, a large application preview, a locator
  review tray, and persistent page/locator/warning progress. Task-focused capture is the default;
  complete-application and Automatic controls remain under Advanced.
- Locator-first is now the default only when the server feature flag is enabled and the project has
  no explicit saved preference. Existing explicit Classic choices remain unchanged, Classic is
  available under Advanced, and the existing server kill switch continues to force Classic.
- Added preview navigation, environment/address controls, Back/Forward/Refresh/Open externally,
  relevant/page capture, finish/cancel, and desktop/tablet/mobile viewport presets. Electron reuses
  the existing project-scoped native browser session; browser mode uses an iframe where permitted
  and clearly labels that fallback.
- Added a page-oriented Locator Library with page tree, search and status filters, locator detail,
  generated Playwright code, repository-sync summary, and verification history. Custom Base UI
  Select/Popover behavior is used for in-app choices; native file selection remains native.
- Added migration version **7**, `locator_page_artifacts`, and additive case-ID policy fields.
  Captured pages now derive deterministic versioned Playwright TypeScript page objects whose lines
  reference exact locator entry/version IDs and become stale when their source hash changes.
- Replaced the multiline case-step editor with numbered step cards containing separate action and
  expected-result fields, mapped locator chips, add/duplicate/delete/move operations, and keyboard
  equivalents. Added configurable case IDs with default `TC-00001`, editable prefix/sequence, and
  imported-ID preservation.
- Added a Testing inventory combining managed/imported/generated cases, statically discovered
  Playwright `.spec`/`.test` JavaScript and TypeScript files, and TestItem snapshots from the
  built-in VS Code workbench integration. Repository scanning is static and never executes project
  code. The UI provides an accessible lazy tree and flat-table alternative.

### Preview architecture and project isolation

- The Electron UI was exercised in the actual desktop application for project `Intern-batch-08`.
  The Testing workspace reported **32 graph states and 12 cases**; the Locator-first default,
  custom scope menu, preview layout, Locator Library, structured case editor, and Test Explorer all
  rendered within that project context.
- Native preview sessions use `testing:<projectId>` identifiers and all new preferences, locators,
  artifacts, case-ID sequences, and inventory requests carry the top-level Tabs project ID. The
  additive tests cover two-project isolation; no existing project graph was deleted or reassigned.
- Preview bounds are zoom-aware and native preview content is hidden while an in-app overlay is
  open so Base UI dialogs, menus, and popovers remain visible and keyboard reachable.

### POM artifacts, cases, and inventory

- The exercised project produced a generated page object for one stored page containing nine safe
  locators. Copy and regeneration are available from the code surface; repository output remains a
  reviewed proposal and does not overwrite company files automatically.
- The Test Explorer found **11 repository test files** and displayed the project's **12 managed
  cases**. Suite/test grouping, source metadata, framework, parse warnings, search, arrow/Home/End/
  Enter/typeahead navigation, labelled states, and a flat table are available without executing
  repository code.
- The case editor exposes the imported or generated case ID directly and allocates new IDs from the
  project policy. Existing `DISCOVERED-*` values are retained rather than rewritten.

### Accessibility and security verification

- The workflow uses labelled regions and controls, keyboard-operable custom selections, focus/
  selection distinction in the test tree, status text in addition to color, polite progress
  announcements, and keyboard alternatives for drag ordering. Electron snapshots verified the
  custom menu and the structured step controls were exposed to the accessibility tree.
- Live POM inspection found that a previously tokenized accessible name could still be emitted as
  a generated locator argument. The generator was hardened to exclude archived, `manual-required`,
  `<PII_...>`, and `<REDACTED_...>` locator versions. The post-fix Electron check reported
  `hasPiiToken=false`, `hasRedactedLocator=false`, and `hasSafeLocator=true`.
- Existing URL/accessibility sanitization remains upstream of persistence, code generation, logs,
  and prompts; a redacted accessible name is never used as generated Playwright source.

### Verification

- Final focused verification reported **7 files / 53 tests passed**, covering Locator Discovery,
  Locator Library/artifact versioning, static inventory parsing, security, contracts, and WebSocket
  client behavior. Changed contracts/shared/web/desktop package typechecks passed **5/5**; filtered
  server typecheck produced no Testing or WebSocket errors.
- Repository formatting passed for all changed Phase 6 files. Full lint exited 0 with the existing
  repository warnings, the production build passed, and `git diff --check` passed.
- The broader repository test run completed **10/11 package tasks**; the server package reported
  **1,082 passed, 31 skipped, and 29 failed**. Those failures are outside Testing and come from the
  previously logged provider-runtime/contracts drift (Claude workflow runtime, OpenCode behavior,
  and provider attachment paths). Repository-wide typecheck likewise remains non-zero for that
  pre-existing provider/contracts baseline.
- Electron screenshots from this verification are stored under `/tmp/tabs-phase6-ui.KB0Cs0/`.
  The verification desktop and automation processes were closed after inspection.

### Remaining rollout work

- The existing Electron `BrowserView` transport was reused; this pass does not claim a completed
  `WebContentsView` migration or a restricted loopback CDP broker proving that Playwright MCP and
  the embedded preview control the identical authenticated target.
- The browser iframe fallback is present, but interactive streamed-preview and headed-browser
  fallback paths are not complete. Individual visual overlay picking is also deferred; this pass
  implements relevant and page-wide capture.
- VS Code TestItem observation and static inventory are implemented, but full run/re-run/result
  command bridging, incremental dual-identity reconciliation, and every editor source-reveal path
  remain rollout work.
- The saved preview target `http://localhost:5173/` was not running during Electron verification,
  so the Testing workspace UX—not a live authenticated application page—was exercised. No real
  authenticated target, company template repository, or provider dispatch was supplied, and those
  validations remain unclaimed.

## 2026-08-14 — Phase 6: Discover UX and Locator Approval Hardening

### UX and navigation

- Renamed the Testing workflow navigation to user-oriented destinations: Home, App & locators,
  Test cases, Build tests, Test runs, and Evidence. Non-Home workspaces now use a compact Testing
  header so the current task begins above the fold.
- Reworked Locator-first Discover around three explicit steps: open the relevant page, choose
  locator candidates, and use the approved set in code. Current-page capture is the default;
  task-focused, section, complete-app, and Automatic modes remain available when broader context is
  intentional.
- Replaced the viewport dropdown with direct Desktop, Tablet, and Mobile buttons. The preview,
  setup rail, and review tray use bounded heights and contained scrolling instead of allowing the
  capture workspace to expand indefinitely down the page.
- Added a prominent **Import your team's existing locators** action. Imported page objects continue
  through the static parser and synchronization review without executing repository code.

### Locator review and code flow

- New discovery candidates are persisted as drafts even when they resolve uniquely. A scan selects
  the new draft candidates in the review tray, where each item shows its exact Playwright locator
  expression, ambiguity state, and inclusion state.
- Added Select proposed, Clear, and **Add selected to page object** actions. Only explicitly accepted
  entries now appear in the deterministic managed Playwright page object. Unselected drafts remain
  reviewable and are not silently archived or written to source.
- Approval regenerates the local versioned page-object artifact and opens its code view. Connected
  repository output remains a separately reviewed synchronization diff; no company file is
  overwritten by capture or approval.
- Manual-required or redacted locator arguments are represented as **Manual setup** and never show
  token placeholders as usable locator code. Electron inspection confirmed the generated page
  object contains neither `PII_` nor `REDACTED_` tokens and contains 12 non-empty safe source lines.

### Native preview scroll fix

- Root cause: the Electron `BrowserView` bounds were recomputed for resize and zoom but not for
  scrolling. The native surface therefore retained its old screen coordinates while the React card
  moved, causing the mobile preview to float over the Locator Library.
- Bounds now update on captured scroll events, including nested scrollers, and are intersected with
  the visible Testing `main` viewport. Fully scrolled-out hosts hide the native preview; partially
  visible hosts are clipped to the workspace. Listener and animation-frame cleanup remains tied to
  the preview lifecycle.
- Added a pure clipping helper and regression tests for partial and complete scroll-out behavior.
  In Electron, Mobile preview was selected and the outer Testing surface was scrolled from the
  capture workspace to `scrollTop=1002.22` (its maximum); the preview disappeared with its card and
  did not overlap the Locator Library.

### Accessibility, security, and verification

- The review tray uses accessible Base UI checkboxes, labelled viewport buttons with pressed state,
  visible text in addition to status color, polite session updates, contained overscroll, and
  keyboard-reachable scan/select/approve actions. The browser iframe fallback now has an explicit
  least-capability sandbox for forms, scripts, same-origin content, user-initiated navigation, and
  popups.
- Focused verification passed **8 files / 56 tests**, including locator draft/approval behavior,
  generated-code sanitization, preview clipping, static inventory, contracts, security, and
  WebSocket client behavior. Changed contracts/shared/web/desktop typechecks passed **5/5**;
  filtered server typecheck reported no Locator Discovery or Locator Library errors.
- Formatting, full lint (with the existing repository warning baseline), the full production build
  (**5/5** targets), and `git diff --check` passed. Electron evidence is stored under
  `/tmp/tabs-locator-ux-2026-08-14/`.

### Deferred validation

- The saved `http://localhost:5173/` target did not provide a live authenticated application during
  this pass. Preview containment, responsive viewport switching, accessibility structure, existing
  Locator Library data, and safe generated code were verified in Electron; a new authenticated
  page scan and real repository-diff application remain unclaimed.

## 2026-08-14 — Phase 6: Preview Aspect and Review Layout Hardening

### Built

- Replaced the cramped three-column Discover composition with a vertical workflow: compact setup,
  a dedicated application stage, and a full-width locator-review step below it.
- The application stage now uses an exact responsive `16:9` frame. Desktop fills it at `16:9`,
  Tablet is centered at `4:3`, and Mobile is centered at `9:16`; the active ratio is shown beside
  the viewport controls so switching modes has an explicit visual and textual result.
- Expanded locator review into a responsive two/three-column inventory with a bounded scrolling
  region. Exact Playwright expressions, manual-setup states, selection, and approval controls no
  longer compete with the preview for a narrow side rail.

### Electron and accessibility verification

- Measured the live Electron preview canvases at `950.90 × 534.88` (`1.77779`),
  `713.18 × 534.88` (`1.33334`), and `300.86 × 534.88` (`0.56248`) for Desktop, Tablet, and Mobile
  respectively. These resolve to `16:9`, `4:3`, and `9:16` within rounding tolerance.
- Confirmed the full-width locator review renders three readable cards per row at the tested
  desktop width, including exact locator code and an explicit Manual setup card.
- Confirmed Desktop, Tablet, and Mobile remain labelled pressed-state buttons and that setup,
  candidate-selection, and approval controls are exposed in the accessibility tree.
- Electron screenshots are stored under `/tmp/tabs-preview-ux-2026-08-14/`.

### Verification and limitations

- The preview-bounds regression suite passed (`1` file / `2` tests), web typecheck passed, the full
  production build passed (`5/5` targets), lint completed with the existing unrelated warning
  baseline, formatting and `git diff --check` passed.
- Repository-wide server typecheck remains non-zero because of the previously recorded provider and
  contracts drift outside Testing; the web package changed in this pass typechecks cleanly.
- This pass validates Discover layout, device-ratio behavior, and review readability. It does not
  newly claim authenticated target-state sharing or a live target scan.

## 2026-08-14 — Phase 6: Preview Session and Locator Source Clarity

### Capture and preview UX

- Condensed Step 1 into three primary choices (scope, access, and exploration) with Advanced and the
  scan action sharing one compact footer. The output destination now lives in Step 3 instead of
  appearing twice in the workflow.
- Removed the Locator-first **Open externally** action. It launched an unrelated system-browser
  session whose navigation and clicks could not be observed by the active Testing capture session.
- Added an in-app **Focus preview** mode instead. It keeps the project-scoped Electron preview and
  Testing session connected, expands the preview over the workspace, traps keyboard focus, exits on
  Escape, and restores focus to its trigger. The inline status explicitly explains that a separate
  browser window is not connected to capture.

### Locator source workflow

- Replaced the duplicated storage dropdown with three labelled destination cards: Managed draft,
  Repository proposal, and Snapshot export. Each exposes pressed state and a plain-language outcome.
- Reworked Existing locator source into a balanced connect-and-explain layout. The UI now states the
  actual implementation: selecting a folder statically parses supported TypeScript/JavaScript,
  links imported locators, regenerates a managed page-object artifact after approval, and prepares
  managed-only/repository-only/conflict review data.
- Clarified that connecting a folder does not execute repository code and does not automatically
  write company files. Repository changes remain proposals visible in the Repository diff tab and
  must be copied or applied through the user's normal reviewed code workflow.

### Electron and verification

- Verified the compact setup, destination cards, and focused preview in the running Electron app.
  Repository proposal reported `aria-pressed=true` when selected. Focus mode exposed an **Exit
  focused preview** control; Escape closed it and restored focus to **Focus preview**.
- Web typecheck passed, the preview-bounds suite passed (`1` file / `2` tests), the full production
  build passed (`5/5` targets), formatting and `git diff --check` passed, and the changed file linted
  with the existing warning baseline.
- Screenshots are stored under `/tmp/tabs-locator-source-ux-2026-08-14/`. This pass does not claim a
  newly authenticated target scan or automatic repository-write implementation.

## 2026-08-15 — Phase 6: Locator Page Objects and Reviewed Repository Apply

### Locator naming and selected code

- Replaced hostname-derived root names such as `localhost` with human page labels such as
  **Landing page**. Generated names are refreshed for existing entries while user-edited names are
  preserved. Repository imports derive page names from their page-object filenames.
- Added editable page names in the Locator Library. Renaming a page creates a new deterministic
  page-object artifact version with a corresponding class and filename.
- Added an explicit locator checklist per page. Only the selected, accepted, non-redacted locator
  versions are emitted into the Playwright TypeScript page object; draft, archived,
  `manual-required`, and tokenized entries stay out of generated source.
- Added a generator-version marker to artifact hashes so existing managed drafts regenerate when
  the deterministic code-generation format changes. `Landing page` now produces `LandingPage` in
  `landing.page.ts` rather than duplicating the `Page` suffix.

### Repository preview and apply

- Added the guided **Choose locators → Preview code → Write to repository** workflow. The user
  selects an exact project subfolder and TypeScript filename, previews the current and proposed
  source, and confirms the reviewed file in a modal before any write occurs.
- Added project-scoped contracts and WebSocket routes for page rename, locator selection,
  repository proposal, and repository apply. Applied destinations are persisted per page and link
  the exact locator/page-artifact versions to the repository-relative path.
- Repository output resolves real paths and rejects parent traversal, folders outside the active
  project, symbolic-link destinations, invalid filenames, and non-file targets. Apply rechecks both
  the generated artifact hash and destination source hash, preserves an existing file's mode, and
  uses a same-directory temporary file plus rename. No unrelated file is written.

### Accessibility and Electron verification

- The Locator Library exposes labelled page-name, locator-selection, destination-folder, filename,
  preview, and apply controls. The page-detail tabs now implement roving tab focus with Left/Right,
  Home, and End navigation, and the confirmation dialog restores focus through the shared
  accessible dialog primitive.
- Verified the running Electron app at `http://localhost:5733`: the library displayed **2 pages / 46
  locators**, meaningful **Landing page** labels, an **8 in code / 9 discovered** summary, selected
  locator checkboxes, `landing.page.ts`, `LandingPage`, and the three-step repository workflow.
  Keyboard Right Arrow moved selection from **Choose locators** to **Preview code**.
- Electron evidence is stored under `/tmp/tabs-locator-page-object-2026-08-15/`.

### Verification and limitations

- The complete Testing-focused run passed **15 files / 79 tests**, with **3 files / 7 tests**
  intentionally skipped. New coverage proves selected-only generation, editable naming, safe create
  and update proposals, project containment, symbolic-link rejection, atomic apply, and stale-review
  concurrency blocking. The focused post-hardening run passed **2 files / 10 tests**.
- Contracts typecheck, the web production build, the server production build, focused server
  bundling, formatting, changed-file lint, and `git diff --check` passed. Changed-file lint retained
  only the repository's existing warning baseline.
- Repository-wide server typecheck remains non-zero because of the already logged provider/runtime
  and contracts drift outside Testing; its only new Testing error was corrected before handoff.
- The repository apply integration was exercised against disposable project folders, including an
  actual file write and concurrency failure. Electron verified the production UI without applying
  a page object into the user's dirty working tree. A real company template/repository and a newly
  authenticated external target were not supplied, so those validations remain unclaimed.

## 2026-08-15 — Phase 6: Locator Code Editing and Workflow Clarity

### App and locator workflow

- Replaced the destination-choice presentation with a truthful local-first handoff: approved
  locators are saved as a versioned managed draft, reviewed page by page, and reach a repository
  only after the user chooses a destination and confirms the exact diff.
- Kept existing company page objects as an optional follow-up. Users can compare a folder or import
  an independent snapshot; supported TypeScript and JavaScript are still parsed statically and
  never executed.
- Added a visible capture-coverage explanation and accessible selector. The default captures
  actions plus useful assertion targets; controls-only and everything-accessible remain available
  under Advanced, with hidden and decorative content excluded.

### Editable page-object drafts

- Added **Edit code** to each page's Preview code tab. Small changes are edited inline and saved as
  a new immutable local artifact version; repository actions stay disabled while an edit is open.
- Manual drafts record their origin and the generated source hash they extend. They survive normal
  reads, but changing the page name or selected locators deliberately regenerates the draft from
  the Locator Library so code cannot silently drift from its source entries.
- Added optimistic source-hash checks, TypeScript syntax validation, exported-class preservation,
  size and NUL checks, and PII/credential/high-entropy rejection before an edited draft persists.
  The additive locator migration is version 9; no earlier Testing data is discarded.

### Accessibility and verification

- The inline editor has a page-specific accessible name, explanatory help, Cancel and Save new
  version actions, and clear generated-versus-edited status. Cancel was exercised in Electron and
  returned to the preview without persisting a live-project change.
- Verified the simplified destination flow, capture explanation, Preview code, and editor in the
  running Electron app. Evidence is stored under
  `/tmp/tabs-locator-edit-clarity-2026-08-15/`.
- The complete Testing-focused run passed **15 files / 80 tests**, with **3 files / 7 tests**
  intentionally skipped. Contracts and web typechecks, web and server production builds,
  formatting, changed-file lint, and `git diff --check` passed; lint retained only the existing
  repository warning baseline.
- Test Cases were intentionally not redesigned in this pass. No repository page object was applied
  and no newly authenticated external target was scanned.

## 2026-08-15 — Phase 6: Locator Library Editing and Search

### Locator control and inventory

- Added page-scoped search across locator keys, strategies, classifications, semantic context, and
  generated Playwright expressions. Added Active, Selected for code, Needs review, and Removed
  filters with a visible result count and a 100-result rendering boundary.
- Replaced the unclear **Review** and **Archive** actions with explicit **Edit** and **Remove**
  controls. Removal is recoverable: archived entries leave active selection and generated code but
  retain immutable versions, verification history, and repository linkage; the Removed filter
  exposes **Restore**, which returns the entry as a draft for review.
- Added an accessible edit dialog for the stable key, action/assertion/content purpose, Playwright
  strategy, typed JSON arguments, and semantic context. Custom project UI primitives are used for
  dialogs and selects; native popups were not introduced.

### Persistence and safety

- Locator strategy, arguments, or semantic-context changes now create a new immutable
  `locator_entry_versions` row with `source=manual` and `change_reason=manual-edit`; the previous
  version is superseded but retained. Key and classification changes update the stable entry while
  the derived page-object artifact regenerates from the new current version.
- Added duplicate active-key rejection, key-format validation, typed-argument validation, and
  credential, high-entropy secret, and PII rejection before locator edits persist. No additive
  schema migration was required.

### Verification

- Verified search narrowing, Edit dialog fields, custom dropdowns, Escape cancellation, Remove
  confirmation, and focus restoration in the running Electron application without changing its
  stored locator data. Evidence is under `/tmp/tabs-locator-library-controls-2026-08-15/`.
- The Testing-focused run passed **15 files / 81 tests**, with **3 files / 7 tests** intentionally
  skipped. Contracts and web typechecks, web and server production builds, formatting, lint, and
  `git diff --check` passed; lint retained the existing repository warning baseline.
- The repository-wide server typecheck remains non-zero only for the previously logged
  provider/runtime drift; it reported no locator-library, TestingService, or WebSocket diagnostics.

## 2026-08-15 — Phase 6: Test Case and Build Workspace UX

### Case intake and locator context

- Replaced the competing case-creation cards with one source-first workspace: write a case, import
  Excel, generate from a user story, or create candidates from captured app paths. Only the chosen
  source is expanded, and the implemented-test inventory is collapsed by default.
- Added project-scoped manual case creation with configurable ID allocation, ordered steps, expected
  result, duplicate-ID rejection, and an explicit `manual` creation method in returned case data.
- Added a searchable page-and-locator picker to new and existing cases. Users may map any number of
  locator pages or individual locators; mappings replace atomically, stay project-scoped, and feed
  the existing generator's selected-case locator context.

### Fusion selection and generation flow

- Replaced Testing's compact model dropdown with the same Fusion matrix used by Agents, including
  configured providers, pinned models, model options, and reasoning levels. Story-to-case and test
  generation share the chosen model without introducing a direct model API.
- Added explicit reviewed-case selection in Cases and Build tests. Build now presents a numbered
  flow (choose cases, choose output, choose Fusion model and guardrails) and sends the exact selected
  case IDs to generation rather than implicitly generating every accepted case.

### Verification

- The complete Testing-focused run passed **15 files / 83 tests**, with **3 files / 7 tests**
  intentionally skipped. New coverage verifies manual case persistence, duplicate rejection,
  project isolation, and replacement of locator mappings.
- Contracts, web, and server typechecks passed. Contracts, web, and server production builds passed;
  repository lint completed with the existing warning baseline, formatting and `git diff --check`
  passed.
- Verified the manual case form, collapsed locator chooser, case-selection flow, numbered Build
  workspace, and the full Agent-style Fusion matrix in the running Electron app at
  `http://localhost:5733`. An axe audit scoped to the Testing main surface reports **0 violations**
  and **0 incomplete checks** after correcting summary semantics and recommended-step contrast.
  Evidence is under `/tmp/tabs-testing-cases-workflow-2026-08-15/`.
- No provider generation job, repository write, or live-project case was created during UI
  verification; those actions remain explicitly user initiated.
