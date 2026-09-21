import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const internalCopy = [
  [/\bproduction[- ]grade\b/i, "Replace 'production-grade' with the actual user-visible result."],
  [/\bseamless update\b/i, "Do not promise a 'seamless update'; state any action users need to take."],
  [/\bzero cross-talk\b/i, "Avoid absolute guarantees such as 'zero cross-talk'."],
  [/\brootDirectory\b/i, "Explain the outcome, not a deployment configuration key."],
  [/\b(?:preflight|test coverage|automated (?:integration )?tests)\b/i, "Remove internal testing or CI process narration."],
  [/<\/?[a-z][^>]*>/i, "Use Markdown instead of raw HTML tags."],
];

export function validateReleaseNotes(markdown) {
  const problems = [];
  const lines = markdown.trim().split(/\r?\n/);
  if (!/^##\s+\S/.test(lines[0] ?? "")) problems.push("Start with a short '##' headline.");
  const changesIndex = lines.findIndex((line) => /^### What changed\s*$/.test(line));
  if (changesIndex < 0) problems.push("Add a '### What changed' section.");
  const introduction = lines.slice(1, changesIndex < 0 ? undefined : changesIndex).join(" ").trim();
  if (introduction.length < 40) problems.push("Explain the user-visible result after the headline.");
  const bullets = lines.filter((line) => /^-\s+\S/.test(line));
  if (bullets.length < 2) problems.push("Describe at least two concrete shipped changes in bullets.");
  if (/^\*\*Full Changelog\*\*:\s*https?:\/\//m.test(markdown))
    problems.push("A comparison link cannot replace release notes.");
  for (const [pattern, message] of internalCopy) {
    if (pattern.test(markdown)) problems.push(message);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write("Usage: node scripts/validate-release-notes.mjs <notes-file>\n");
    process.exitCode = 2;
  } else {
    try {
      const problems = validateReleaseNotes(readFileSync(file, "utf8"));
      if (problems.length) {
        for (const problem of problems) process.stderr.write(`${file}: ${problem}\n`);
        process.exitCode = 1;
      } else {
        process.stdout.write(`${file}: release-note checks passed\n`);
      }
    } catch (error) {
      process.stderr.write(`${file}: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}
