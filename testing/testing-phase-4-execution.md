---
description: "Testing tab Phase 4 - test execution, self-healing, flaky quarantine, visual regression, CI/Standalone modes"
argument-hint: ""
---

# Phase 4: Execution, Self-Healing, and the Two Operating Modes

Read `AGENTS.md` and `PHASE_LOG.md` fully before starting. **Hard prerequisite: Phase 1–3
entries must all exist**, including where fingerprints and replay data live from Phase 3.

## Goal
Run the generated tests, recover automatically from cosmetic breakage without masking real
regressions, and give the feature its two distinct operating surfaces: CI Mode and
Standalone/UAT Mode, sharing this same execution engine underneath.

## Scope for this phase
1. **Runner integration**: execute generated Playwright tests via the existing Server/Terminal
   tab infrastructure (or an integrated runner if that's cleaner), capturing pass/fail, error
   detail, and trace/screenshot evidence per test.
2. **Healer agent**: on a locator-resolution failure, capture the current accessibility snapshot
   via Playwright MCP, score candidate elements against the stored fingerprint (role, text, DOM
   position, subtree similarity), and if a candidate clears a high-confidence threshold, propose
   a fix — as a diff for review, not a silent rewrite — and re-run. **Cap the number of
   consecutive auto-heals per test** before it's forced into human review instead of healing
   forever and potentially masking a real regression.
3. **Flaky detection — separate from healing**: track pass/fail history per test across runs
   independent of the healer. A test that flips with no underlying app change and no locator
   issue gets auto-quarantined out of the release gate the same day, but stays visible/reported,
   not silently dropped. This is a different mechanism from self-healing and should not be
   conflated with it in the code.
4. **Visual regression**: snapshot a screenshot per test at generation time, diff on later runs.
   Route ambiguous diffs through a vision-capable step (via the configured backend) to
   distinguish a real layout break from anti-aliasing/font-rendering noise, rather than failing
   on any pixel delta.
5. **CI Mode**: PR/deploy-triggered, scoped test selection (only tests whose graph-node coverage
   overlaps the diff, if that mapping is available — otherwise run the full suite for now and
   leave scoping as a documented future improvement), gate on merge, re-crawl on deploy to
   refresh the State Transition Graph and catch app drift proactively.
6. **Standalone/UAT Mode**: no git/pipeline dependency. Manual batch runs, triggerable from the
   Testing tab UI, richer status set (Passed/Failed/Blocked/N/A/Not Yet Tested from Phase 2's
   schema), an in-app scheduler (simple recurring/one-off run, not a CI cron) for "re-run failed
   cases tomorrow morning," and round-over-round comparison against the previous run for the
   same case set (what got fixed, what's still broken).

## Explicitly out of scope for this phase
Sign-off report generation, bug drafting, traceability dashboards — Phase 5 owns the reporting
layer that sits on top of what this phase produces.

## Verification (required)
- Run the build. Paste real output.
- Actually execute a generated test end-to-end and show real pass/fail output.
- If feasible in this environment, deliberately break a locator (rename an element in a test
  fixture) and show the Healer actually detecting and proposing a fix, not just describe that
  it would.

## Before finishing
Append an entry to `PHASE_LOG.md`: how CI Mode and Standalone Mode are switched/configured, the
heal-attempt cap chosen and why, how flaky-quarantine state is stored, and anything unverified.
