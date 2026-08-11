---
description: "Testing tab Phase 1 - crawler engine, state transition graph, security/PII layers, tab scaffold"
argument-hint: "[target-url]"
---

# Phase 1: Foundation — Crawler, State Graph, Security Layer

Read `AGENTS.md` (which includes the Testing Tab conventions section) and `PHASE_LOG.md` fully
before starting. This is the first phase — `PHASE_LOG.md` should be empty or absent; if it
already has entries referencing this phase as done, stop and report that instead of redoing it.

## Goal
Stand up the new "Testing" tool in Tabs' top toolbar (next to Code/Agent/Server/Git/Browser) and
build the crawler subsystem that turns a live app URL into a stored State Transition Graph,
with security and privacy protections built in from the start rather than bolted on later.

## Scope for this phase
1. **Tab scaffold**: new toolbar entry, empty panel shell following existing tab conventions
   (Tailwind v4 + CSS vars, `.dark` toggle, DM Sans, functional components, no Framer Motion).
   A simple input for a target URL and a "Start Exploration" button is enough UI for now.
2. **Playwright MCP integration**: bundle/wire the Playwright MCP server so the app can drive a
   real browser and receive accessibility-tree snapshots, not screenshots.
3. **Auth bootstrap**: before crawling, support capturing an authenticated session
   (`storageState`-equivalent) via a manual login step the user performs once, reused for all
   subsequent crawl/test runs. Do not attempt to automate SSO/MFA login flows — that's out of
   scope; just make sure a captured session persists and gets reused.
4. **Crawler / Planner logic**: explore the app starting from the entry URL. Enumerate
   actionable elements from the accessibility snapshot at each state. Use graph-theoretic
   centrality (or a reasonable approximation) to prioritize unexplored deep paths over shallow
   circular ones (nav menus, pagination) so it doesn't get stuck re-exploring the header forever.
5. **State Transition Graph storage**: nodes = UI states (hash of structural accessibility
   content, explicitly excluding volatile text like timestamps/session IDs/carousel content to
   avoid state explosion), edges = actions. Persist locally (SQLite is fine for this phase) in
   the Testing-tab workspace, not mixed into the user's project git history.
6. **DOM sanitization middleware**: before any accessibility-tree content is passed to an LLM
   (in later phases — but the interception point belongs here), strip zero-size/visually-hidden
   elements, cap nesting depth, and flag/strip text that looks like an injected instruction
   rather than real UI content. This is a defense against indirect prompt injection via a
   compromised or malicious element in the target app.
7. **PII tokenization layer**: scan extracted text for common PII patterns (emails, phone
   numbers, card-like number sequences, etc.) and replace with deterministic placeholders before
   anything is cached or would be sent onward. Keep the detokenization mapping local only.
8. **Token/cost caching**: hash and cache structurally-static subtrees (shared header/footer)
   so repeat visits to different pages don't re-spend tokens re-describing identical chrome.

## Explicitly out of scope for this phase
Excel ingestion, test-case reconciliation, script generation, execution, healing, reporting.
Don't start any of that — later phases own it and will read the graph this phase produces.

## Verification (required — do not skip)
- Run the build. Paste the actual output.
- Manually exercise the crawler against a real or representative test URL if one is available
  in this environment; if not, say so explicitly rather than claiming it works.
- Confirm the sanitization layer actually strips a deliberately-planted hidden-text test element
  — write a small test page/fixture with a hidden injected instruction and prove it gets
  stripped before reaching the point where it would go to an LLM.

## Before finishing
Append an entry to `PHASE_LOG.md`: what was built, where the State Transition Graph is stored
and its schema, how auth sessions are captured/reused, any decisions later phases must respect,
and anything you couldn't verify in this environment.
