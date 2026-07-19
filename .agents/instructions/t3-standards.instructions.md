---
name: t3-standards
description: Strict architectural and coding standards distilled from the t3code-main reference repository.
---

# The T3 Reference Standards

**WARNING TO AGENT:** When you are instructed to write code to the "t3code-main standard", you are legally bound by the rules in this document. These are the explicit, non-negotiable structural standards of this codebase.

## Core Architectural Rules

### 1. The Schema Protocol (`packages/contracts`)
- `packages/contracts` is exclusively for Effect/Schema schemas and TypeScript type definitions. 
- **ABSOLUTE BAN:** You are strictly forbidden from placing ANY runtime logic, functions, or business logic inside the contracts package. It is for structural definitions only.

### 2. The Barrel Index Ban (`packages/shared`)
- The `packages/shared` directory holds runtime utilities used across the server and client.
- **ABSOLUTE BAN:** Do NOT use or create "barrel indices" (e.g., `index.ts` files that re-export everything).
- You MUST use explicit subpath exports. (e.g., `import { foo } from '@t3tools/shared/git'`).

### 3. The Toolchain Mandate (`vp` CLI)
- This repository uses the `vp` (Vite+) CLI wrapper for operations.
- Before considering any code task complete, you MUST successfully run:
  - `vp check` (Runs formatting and linting. Hint: Use `vp check --fix` to auto-format).
  - `vp run typecheck` (Validates TypeScript).
  - `vp test` (Runs the test suite).
- Do not run raw `eslint` or `prettier` commands. Use the `vp` toolchain.

### 4. The Maintainability Rule
- **Duplication is a Code Smell:** If you find yourself writing logic that looks similar to something else in the codebase, STOP. You must extract it into a shared module (in the appropriate package). Do not take shortcuts by duplicating logic.
- **Reliability > Convenience:** Always choose robustness, error handling, and correct typing over a fast, hacky solution.

### 5. Idiomatic External Usage
- **Effect-TS:** If you are writing Effect code, you MUST use `.repos/effect-smol/` as your reference implementation. Do not guess or hallucinate patterns.
- **Alchemy:** If writing relay infrastructure, use `.repos/alchemy-effect/` as your reference.
