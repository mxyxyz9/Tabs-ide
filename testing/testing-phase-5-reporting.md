---
description: "Testing tab Phase 5 - sign-off reports, traceability, bug drafting, dashboard UI polish"
argument-hint: ""
---

# Phase 5: Reporting, Traceability, and Closing the Loop

Read `AGENTS.md` and `PHASE_LOG.md` fully before starting. **Hard prerequisite: Phase 1–4
entries must all exist.**

## Goal
Turn run results into the artifacts a QA engineer actually needs to hand to someone else, and
close the loop back to the coding agents so failures don't dead-end in a dashboard nobody reads.

## Scope for this phase
1. **Sign-off report generation**: for a completed Standalone/UAT Mode run, generate a
   professional exportable report (Word/PDF) — pass/fail/blocked counts, per-case status and
   notes, evidence screenshots, tester identity, build/environment info, date. This is the
   literal deliverable a QA engineer attaches to a change request or hands to a manager — treat
   it as a primary feature, not an afterthought export button.
2. **Traceability**: every generated test and every run result must map back to the original
   Excel case ID (or the newbie-mode-generated scenario ID). Make this queryable — "show me case
   QA-0042's current status and when it was last verified" — not just implicit in file naming.
3. **Round-over-round diffing**: compare a Standalone-mode run against the immediately prior run
   of the same case set and surface what changed (newly passing, newly failing, still broken).
4. **One-click bug drafting**: on a failed case, draft a bug report (repro steps from the actual
   executed trace, expected vs. actual, screenshot, environment) for the user to review and
   file — don't auto-file it anywhere; this is a draft the human sends, not an autonomous action.
5. **Closed-loop triage (CI Mode)**: on a CI-mode failure that survives flaky-quarantine and
   healing, hand the failure context (diff, trace, error) to the currently active coding-agent
   backend and ask it to triage: real regression in the app, or a test that needs updating.
   Surface its answer in the Testing tab rather than silently acting on it.
6. **State-graph explorer view**: a visual/queryable rendering of the State Transition Graph
   from Phase 1 inside the Testing tab, so a QA engineer can browse "what does this tool think
   the app looks like" directly — this was the original ask (understand the app without reading
   code) and deserves a real UI surface, not just internal storage.
7. **UI polish pass**: bring the whole Testing tab up to the same visual standard as the rest of
   Tabs — Tailwind v4 conventions, dark-mode parity, consistent with the TaskListPanel/
   FusedModelPicker work already done elsewhere in the app. Original layout, not a copy of any
   reference implementation.

## Verification (required)
- Run the build. Paste real output.
- Generate one real sign-off report from actual run data (from earlier phases) and confirm it
  opens correctly, not just that the generation function returns without error.
- Confirm traceability actually resolves a case ID to its current status via whatever query
  path was built, with real output shown.

## Before finishing
Append a final entry to `PHASE_LOG.md` summarizing the whole feature's current state end-to-end,
anything deferred to a future pass, and anything that was never verifiable in this environment
(e.g., no real UAT target, no live coding-agent backend to test closed-loop triage against).
