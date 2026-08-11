---
description: "Testing tab Phase 2 - Excel ingestion, reconciliation against state graph, dual-mode data model"
argument-hint: "[sample-excel-path]"
---

# Phase 2: Ingestion, Reconciliation, and the Dual-Mode Data Model

Read `AGENTS.md` and `PHASE_LOG.md` fully before starting. **Hard prerequisite: a Phase 1 entry
must exist in `PHASE_LOG.md` describing the State Transition Graph and where it's stored.** If
it doesn't, stop and report that Phase 1 needs to run first — do not improvise a substitute.

## Goal
Let a QA engineer upload an Excel file of existing test cases (Case ID / Description / Steps
in plain English), validate each one live against the current State Transition Graph, surface
contradictions for human review, and build the data model that supports both operating modes.

## Scope for this phase
1. **Excel parser**: ingest `.xlsx`, expecting columns for case ID, description, and steps (be
   tolerant of column-name variation — don't hard-fail on a slightly different header).
2. **Trace alignment**: for each parsed test case, read the plain-English steps, find the
   shortest path through the State Transition Graph from the app's entry state to the implied
   target state, and drive a headless Playwright MCP session through that path to verify each
   step's described element actually resolves in the live app right now — not just against the
   cached graph, which may be stale.
3. **Contradiction surfacing**: when a step doesn't resolve (renamed button, changed flow,
   removed field), don't silently guess — record the specific mismatch (expected vs. what's
   actually there) so it can be shown to the user for review before anything gets generated.
4. **Review UI**: a table/list view in the Testing tab showing each imported case with status
   (Matches / Needs Review / Blocked) and the specific mismatch detail for anything not clean.
   Let the user accept, edit, or reject the reconciled version of a case.
5. **Dual-mode data model**: design the underlying schema so a test case can carry either the
   richer Standalone/UAT status set (Passed / Failed / Blocked / Not Applicable / Not Yet
   Tested, with free-text notes) or the simpler CI-mode pass/fail — same table, mode-dependent
   fields, not two parallel schemas that'll drift apart.
6. **Newbie path (no existing test cases)**: if the user has nothing to upload, offer a
   "generate scenarios from the app" option instead — read the State Transition Graph, propose
   a reasonable set of test scenarios (login, form submission, error handling, etc. as
   discovered from actual app structure, not generic boilerplate), and drop those into the same
   reconciliation table as if they'd been imported, so the rest of the pipeline treats them
   identically.

## Explicitly out of scope for this phase
Actual script generation, execution, healing, reporting. This phase ends at a reconciled,
human-reviewed list of test cases ready to be handed to the generator in Phase 3.

## Verification (required)
- Run the build. Paste real output.
- If a sample Excel file is available in this environment, actually run it through the parser
  and reconciliation flow and show real output, including at least one deliberately-mismatched
  case to prove the contradiction-surfacing actually triggers. If not available, say so.

## Before finishing
Append an entry to `PHASE_LOG.md`: the reconciliation data model/schema, how mismatches are
represented, where the newbie-mode scenario generator hooks in, and anything unverified.
