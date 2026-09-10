import { changelogData } from "../data/changelogData";

const manualReleaseNotes: Record<string, string> = {
  "v1.3.3": `## Workspace skills, native preview controls, and composer attachments

Tabs v1.3.3 delivers workspace-specific skill discovery and dispatch, direct browser preview controls, file attachments, and progressive desktop startup stability.

### What changed

- **Workspace skills & slash commands**: Discover and dispatch directory-aware skills for Claude, Cursor, Codex, OpenCode, Antigravity, and Grok with ranked fuzzy search and source badges.
- **Collaborative browser preview**: Added direct viewport resize handles, picture-in-picture, dark/light appearance emulation, per-session audio controls, persistent navigation history, and active session clearing.
- **Composer & attachments**: Added support for general file attachments, persistent prompt stashing, mention preservation when pasting prompts, and dismissible provider warnings.
- **Workbench & desktop stability**: Progressive Code-OSS workbench startup, secondary sidebar and auxiliary bar extension support, workbench preservation across remounts, and cross-environment state storage isolation.
- **Notifications & performance**: Passive toast deduplication window, suppression of replayed keybindings alerts, and deferred native editor services.

### Upgrade notes

- Seamless update for all macOS (Apple Silicon & Intel), Windows x64, and Linux x64 installations.`,
  "v1.3.2": `## A steadier embedded editor

This release focuses on making the shipped desktop workspace more dependable.

### What changed

- Stabilized the embedded Code OSS host and its startup path in the desktop app.
- Fixed a TypeScript declaration issue in the web application's atom registry so release validation can complete reliably.

### Release scope

This is a stability release. It does not add a new end-user workflow.`,
};

function isComparisonOnly(body: string | null): boolean {
  return Boolean(
    body &&
      /^\s*\*\*Full Changelog\*\*:\s*https:\/\/github\.com\/mxyxyz9\/Tabs-ide\/compare\/v?\d+\.\d+\.\d+\.\.\.v?\d+\.\d+\.\d+\s*$/i.test(
        body,
      ),
  );
}

function legacyReleaseNotes(tag: string): string | null {
  const release = changelogData.find((item) => item.tag === tag);
  if (!release) return null;

  const categories = release.categories
    .map((category) => `### ${category.title}\n\n${category.items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");
  return `## ${release.title}\n\n${release.summary}\n\n### Highlights\n\n${release.highlights.map((item) => `- ${item}`).join("\n")}${categories ? `\n\n${categories}` : ""}`;
}

/**
 * GitHub's generated "Full Changelog" link is useful context but not release notes.
 * Prefer the author-written release body; retain curated notes for existing releases
 * published before the manual-notes workflow was introduced.
 */
export function resolveReleaseNotes(tag: string, body: string | null): string {
  if (manualReleaseNotes[tag]) return manualReleaseNotes[tag];
  if (isComparisonOnly(body)) return legacyReleaseNotes(tag) ?? "Release notes were not recorded for this version.";
  return body?.trim() || "Release notes were not recorded for this version.";
}
