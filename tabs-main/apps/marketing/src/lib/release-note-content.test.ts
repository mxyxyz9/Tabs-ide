import { describe, expect, it } from "vitest";
import { resolveReleaseNotes } from "./release-note-content";

describe("release note content", () => {
  it("uses authored in-site notes for v1.3.3", () => {
    const notes = resolveReleaseNotes(
      "v1.3.3",
      "**Full Changelog**: https://github.com/mxyxyz9/Tabs-ide/compare/v1.3.2...v1.3.3",
    );
    expect(notes).toContain("Workspace skills");
    expect(notes).not.toContain("Full Changelog");
  });

  it("uses authored in-site notes for v1.3.2 instead of the generated comparison link", () => {
    const notes = resolveReleaseNotes(
      "v1.3.2",
      "**Full Changelog**: https://github.com/mxyxyz9/Tabs-ide/compare/v1.3.1...v1.3.2",
    );
    expect(notes).toContain("steadier embedded editor");
    expect(notes).not.toContain("Full Changelog");
  });

  it("keeps an authored GitHub release body intact", () => {
    expect(resolveReleaseNotes("v9.9.9", "## New\n\n- A real change")).toBe(
      "## New\n\n- A real change",
    );
  });

  it("uses the existing curated entry for an older generated release", () => {
    expect(
      resolveReleaseNotes(
        "v1.3.1",
        "**Full Changelog**: https://github.com/mxyxyz9/Tabs-ide/compare/v1.3.0...v1.3.1",
      ),
    ).toContain("Standalone installers");
  });
});
