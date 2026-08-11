---
description: "Testing tab Phase 3 - multi-backend script generation, Page Object Model output, deterministic replay"
argument-hint: "[target-framework]"
---

# Phase 3: Script Generation Engine

Read `AGENTS.md` and `PHASE_LOG.md` fully before starting. **Hard prerequisite: Phase 1 and
Phase 2 entries must both exist.** If either is missing, stop and report which one, rather than
guessing at their output shape.

## Goal
Turn a reconciled test case (from Phase 2) into runnable, maintainable Page Object Model test
code, in a framework the user picks, generated via whichever coding-agent CLI backend the user
has configured — not a bespoke LLM-calling system built inside this feature.

## Scope for this phase
1. **Backend abstraction**: locate and reuse the existing CLI-invocation layer that already
   powers the Agent view (the one that talks to Codex, Claude Code, opencode, Cursor CLI, Grok
   CLI, GitHub Copilot CLI). If it's currently built only for interactive use, extend it with a
   programmatic/headless call path — most of these CLIs support one (Codex has non-interactive
   exec, Copilot CLI has `-p` mode) — since batch-generating scripts for 100+ test cases can't
   go through an interactive terminal one at a time.
2. **Framework selection**: expose a dropdown (Playwright/TS as the first-class target; leave
   the door open for others) that constrains the prompt sent to the backend.
3. **Page Object Model enforcement**: the Generator step must produce three separate artifacts
   per feature area, not one file — locator classes (role/accessible-name based selectors),
   externalized test data (JSON/config, no hardcoded strings in specs), and spec files
   containing the actual scenario/assertions that call into the locator classes.
4. **Locator fingerprinting**: when a locator class is generated, also capture and store a
   fingerprint for each element (role, accessible name, DOM position relative to siblings,
   local subtree) alongside it. This is what the Healer in Phase 4 will match against — build
   the fingerprint now, even though nothing consumes it until next phase.
5. **Deterministic replay data**: during the trace-alignment step from Phase 2 (or a follow-up
   pass here), capture the network responses seen along each verified path and store them so
   generated tests can optionally replay against recorded responses instead of hitting live
   data every run — this is what keeps a generated suite passing reliably even when staging
   data changes underneath it. Make this opt-in per test case (some QA scenarios genuinely need
   to hit the real backend; don't force mocking on everything).
6. **Batch runner with cost governance**: process reconciled test cases in a queue, not all at
   once uncontrolled. Support a per-run token/cost budget cap and let cheaper subtasks (parsing,
   simple diffing) route to lower reasoning effort while generation itself uses the user's
   selected effort level.

## Explicitly out of scope for this phase
Actually executing the generated tests, self-healing, visual regression, reporting.

## Verification (required)
- Run the build. Paste real output.
- Generate at least one real test end-to-end from a reconciled case (from Phase 2's output) and
  show the actual generated POM files, not a description of what they'd contain.
- Confirm the generated code compiles/lints under the project's strict TypeScript config.

## Before finishing
Append an entry to `PHASE_LOG.md`: the backend-abstraction extension made (if any), the POM
file layout convention chosen, where fingerprints and replay data are stored, and anything
unverified.
