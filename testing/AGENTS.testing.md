# Testing Tab — Durable Conventions

> Append this section to the project's root AGENTS.md (or drop it in `apps/testing/AGENTS.md`
> if that subfolder gets its own scope). Codex loads AGENTS.md automatically — do not repeat
> these rules inside individual phase prompts.

## What this feature is
A new top-level tool in Tabs (alongside Code, Agent, Server, Git, Browser) called **Testing**.
It lets a QA engineer — who may have zero access to the codebase, only a running app URL —
understand an application's structure, validate/import Excel-based test cases against it, and
generate maintainable automated test scripts, without hand-writing each one.

Two operating modes share one engine:
- **CI Mode**: git-integrated, triggered by PR/deploy, scoped test runs, gating.
- **Standalone/UAT Mode**: no git, no pipeline — manual batch runs against a UAT URL, ending in
  a sign-off report artifact. This is the primary mode; build for it first.

## Non-negotiable architectural decisions (do not relitigate these mid-phase)
- Context gathering uses the **accessibility tree via Playwright MCP**, not screenshots/vision
  models, as the default. Vision is a fallback only for canvas/custom-widget elements the a11y
  tree can't describe.
- The app model is a **State Transition Graph** (nodes = UI states, edges = actions), not a flat
  site-map list. Hash structural accessibility nodes for state identity; explicitly ignore
  volatile text (timestamps, session IDs, carousel content) to avoid state explosion.
- Generated test code strictly follows the **Page Object Model**: locator classes, test-data
  files, and spec files are separate artifacts. Never generate monolithic procedural scripts.
- Locators are **intent-based** (role + accessible name), never raw CSS/XPath selectors, unless
  no accessible role exists for an element.
- The Testing tab **does not call LLM APIs directly**. It orchestrates the user's already-
  configured coding-agent CLI backend (Codex, Claude Code, opencode, Cursor CLI, Grok CLI,
  GitHub Copilot CLI) for every AI step (planning, generation, healing). Reuse the existing
  backend-invocation abstraction from the Agent view — do not build a parallel one.
- Any accessibility-tree content that will be sent to an LLM passes through a **sanitization
  layer first** (strip zero-size/hidden elements, cap nesting depth, flag anomalous injected
  text) to mitigate indirect prompt injection via the DOM.
- Any text extracted from a live app that might contain PII gets **tokenized before it reaches
  an LLM prompt** and detokenized only when writing the final script to disk.

## Code conventions (existing project standard — do not deviate)
- Tailwind CSS v4 with CSS variables and `.dark` class toggle. Strict TypeScript. Functional
  components only. No Framer Motion. DM Sans via Google Fonts. `useSettings` hook separates
  server-authoritative config from client-only UI preferences — new Testing-tab settings follow
  the same split.
- Run `nvm use` from `tabs-main/` before any work in the main repo (Node v24). If touching the
  embedded Code-OSS runtime specifically, that subproject needs Node 18 — switch back with `nvm`
  before working there, back to v24 after.

## Verification requirement (applies to every phase)
Do not report a phase complete without actually running the build and any tests/lint that
exist for the touched code, and pasting the real output into the handoff log. Do not claim
something "should work" — run it. If something can't be verified in this environment (e.g. no
live UAT target available), say so explicitly in the handoff log instead of asserting success.
