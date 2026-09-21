# Manual release notes

Create `.github/release-notes/vX.Y.Z.md` before creating the matching release tag. The tag must point at a commit that already contains this file.

Write notes for the changes introduced between the previous shipped version and this version. Do not list failed CI attempts, retries, or release-pipeline fixes unless they changed the delivered application.

Follow the [Tabs release-notes skill](../../.agents/skills/tabs-release-notes/SKILL.md) when drafting or reviewing the copy. Run `node scripts/validate-release-notes.mjs .github/release-notes/vX.Y.Z.md` before tagging. The release workflow runs the same check, but a person must still verify that every claim describes something actually shipped.

Use this shape:

```md
## Short release headline

One or two sentences explaining what a person using Tabs will notice.

### What changed

- Concrete delivered change.
- Concrete delivered change.

### Upgrade notes

- Optional migration, compatibility, or availability information.
```

The release workflow rejects a missing or link-only note file and publishes this Markdown as the GitHub release body. The marketing changelog then renders the same text inside Tabs, with the GitHub release remaining an optional reference.
