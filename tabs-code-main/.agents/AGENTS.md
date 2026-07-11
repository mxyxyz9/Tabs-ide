# Agent Rules & Instructions

- **Maintain Test Suite Correctness:** Whenever you implement a new feature, fix a bug, or modify any existing codebase, you MUST identify and run the relevant unit/integration tests to ensure no regressions are introduced. If existing tests are broken by your intentional changes, you MUST update the tests to reflect the new behavior. Always verify the full test suite passes using the workspace test commands (e.g. `bun run test` or package-specific test runner) before completing the task. Never leave failing or outdated tests.
