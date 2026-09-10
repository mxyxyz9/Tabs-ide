---
name: tabs-release-babysitter
description: Monitor and finish a Tabs GitHub desktop release, diagnosing failed Actions jobs, applying scoped fixes, and verifying all published artifacts. Use only when the user asks to babysit or complete a Tabs release.
---

# Tabs Release Babysitter

Work from the repository root and treat GitHub Actions and the GitHub release as authoritative. The outcome is a successful release with complete desktop and Code-OSS runtime assets, not merely a green preflight.

## Safety and scope

- Confirm the repository, target version, branch, and release run before mutating anything.
- Require explicit user authorization before pushing commits, dispatching/rerunning workflows, creating tags, or publishing a release. An invocation that explicitly asks you to finish the release and authorizes those actions is sufficient.
- Preserve unrelated uncommitted work. Never use `git add -A`, destructive checkout/reset commands, or broad stashing. Stage only exact files changed for a verified failure.
- Do not merge stale, demo, unrelated-history, or experimental branches merely because they are unmerged.
- Stop and ask only for missing credentials, an irreversible ambiguous decision, or a conflict with user-owned edits that cannot be safely isolated.
- Before creating a tag, ensure `.github/release-notes/<tag>.md` exists in the release commit. It must explain the user-facing changes between the previous stable version and the target version. Do not use a generated `Full Changelog` link as the note body, and do not list failed CI attempts, reruns, or fixes that were not delivered in the tagged build.

## Workflow

1. Inspect `git status --short --branch`, remotes, the latest release-workflow runs, and the requested tag/release state.
2. Before making a new tag, identify the previous stable tag and review the changes in that version range. Author `.github/release-notes/<tag>.md` with a concise headline, an explanation of what users will notice, and concrete shipped changes. If the user has not supplied wording, derive a factual draft from that version range. Commit this file with the intended release changes before creating the tag so the release workflow can publish it.
3. If a matching run is active, follow that exact run. Do not dispatch a duplicate.
4. Wait for job transitions with `gh run view` or `gh run watch`. Avoid repeated full local builds while CI is already executing them.
5. On failure, retrieve only failed-job logs first. Identify the earliest causal error; warnings and downstream suite failures are not separate root causes.
6. Classify the failure:
   - For a transient network/runner failure, rerun failed jobs once without changing code.
   - For a deterministic code, test, packaging, or workflow defect, reproduce the narrowest useful slice, implement the real fix, run focused validation, commit exact files, push, and dispatch a fresh release from the new commit.
   - Never weaken production behavior or assertions just to make CI green.
7. Continue until all platform builds, publication, and finalization succeed. Keep updates concise and report only transitions or actionable failures.

## Completion proof

Before declaring success, verify all of the following from GitHub:

- Release workflow conclusion is `success` and its head SHA is the intended pushed commit.
- The expected version tag and GitHub release exist and point to the intended commit.
- macOS arm64 and x64, Linux x64, and Windows x64 application artifacts are present.
- Every thin desktop build has its matching `tabs-code-runtime-<version>-<platform>-<arch>.zip` and checksum asset; no runtime URL can produce the previous HTTP 404 failure.
- Update manifests and blockmaps required by the workflow are present.
- The release is marked latest/prerelease consistently with its semantic version.

Return the release URL, workflow URL, final commit SHA, and a compact artifact summary. Mention any preserved local uncommitted work.
