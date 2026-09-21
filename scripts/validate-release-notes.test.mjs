import assert from "node:assert/strict";
import { test } from "node:test";
import { validateReleaseNotes } from "./validate-release-notes.mjs";

const good = `## Work with two agent threads side by side

Open two conversations in one window and keep a separate draft in each pane.

### What changed

- Drag a thread to open it beside another conversation.
- Resize the divider with a mouse or keyboard.
`;

test("accepts concise reader-facing release notes", () => {
  assert.deepEqual(validateReleaseNotes(good), []);
});

test("rejects the wording that escaped into the published changelog", () => {
  const problems = validateReleaseNotes(good.replace("Resize the divider", "Production-grade responsiveness resizes the divider"));
  assert.ok(problems.some((problem) => problem.includes("production-grade")));
});

test("rejects a generated link instead of authored notes", () => {
  assert.ok(validateReleaseNotes("**Full Changelog**: https://example.com/compare").length > 0);
});

test("rejects HTML tags that would show literally in the website", () => {
  assert.ok(validateReleaseNotes(good.replace("mouse", "<kbd>mouse</kbd>")).some((problem) => problem.includes("HTML")));
});
