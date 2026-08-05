# Output-Path Separation & Structured Output Guidelines

## Architectural Boundaries

This repository strictly separates **Interactive Agent Chat** from **One-Shot Structured Text Generation**:

```
ProviderInstance
 ├── adapter: ProviderAdapterShape           ───► Agent Chat (Turns, Tools, Streaming, History)
 └── textGeneration: TextGenerationShape     ───► One-Shot Structured Text Gen
      ├── generateCommitMessage()
      ├── generatePrContent()
      ├── generateBranchName()
      ├── generateThreadTitle()
      └── generateDiffSummary()             ───► AI Code Review Engine (ReviewPassRunner)
```

1. **Agent Chat Output Path (`ProviderAdapterShape.prompt`)**:
   - Manages interactive, multi-turn agent conversations with tool calls, stream deltas, and file edits.
   - **Never** route code review or structured text generation through the adapter prompt channel.

2. **AI Code Review Output Path (`TextGenerationShape.generateDiffSummary`)**:
   - Executes multi-pass security and correctness reviews using `ReviewPassRunner.ts`.
   - Uses `buildDiffSummaryPrompt` and enforces `ReviewResultSchema`.

3. **Metadata Text Generation Output Path**:
   - `generateCommitMessage`, `generatePrContent`, `generateBranchName`, `generateThreadTitle`.
   - Each operation uses its own prompt constructor in `TextGenerationPrompts.ts`.

---

## High-Risk Files & Shared Helpers

- **`@tabs/shared/schemaJson`** (`extractJsonObject`, `fromLenientJson`):
  - **Shared** across all non-native structured text generation drivers (`CursorTextGeneration`, `GeminiTextGeneration`, `GrokTextGeneration`, `OpenCodeTextGeneration`).
  - Do **NOT** modify `extractJsonObject` or `fromLenientJson` without running the full server test suite.

- **`CursorTextGeneration.ts`**:
  - `generateStructuredOutput` is shared internally by all 5 text-generation methods in `CursorTextGeneration.ts`.
  - Always use `fromLenientJson` for decoding LLM JSON strings to tolerate trailing commas, comments, and formatting defects.
  - Modifying `CursorTextGeneration.ts` affects text-generation tasks for Cursor users, but **does NOT affect Agent Chat (`adapter`)**.

---

## Safety & Regression Checklist Before Merging

Before merging any change to text generation or review processing:
1. Verify Agent Chat is unaffected: test interactive chat turn processing.
2. Run text-generation regression tests:
   ```bash
   bun test apps/server/src/textGeneration/CursorTextGeneration.test.ts
   ```
3. Run full typecheck:
   ```bash
   bun run typecheck
   ```
