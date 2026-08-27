# Native Desktop Renderer Migration Log

## Scope and operating constraints

- Goal: replace the REH-based embedded Code-OSS runtime with the native desktop renderer and its Electron main-process services.
- Execution is phase-gated. A later phase is not started when its prerequisite verification fails.
- Existing unrelated worktree changes are preserved and excluded from migration checkpoints.
- Any unavoidable edit under `tabs-code-main` is recorded explicitly.

## Initial verification

- The current resolver still prefers `managed-server` when `out/server-main.js` and `out/server-cli.js` exist.
- The current REH session path still owns a per-project BrowserView and child server process.
- The desktop renderer still has renderer-side native extension-host and `Schemas.file` clients, but Tabs does not currently host the corresponding Electron main-process channels.

## Phase 0: Electron runtime launch blocker

- The earlier disposable probe was launched by invoking a second, production-named copied Electron bundle directly while the repository's `Tabs (Dev)` instance and helper processes were already running.
- The Electron distribution and both copied app bundles contain `Electron Framework.framework/Versions/A/Resources/icudtl.dat`; the file was not absent from the installed runtime.
- The supported `Tabs (Dev)` runtime is currently running with renderer helpers, the backend child, and CDP enabled. This rules out a persistent missing-ICU defect in the repository's launcher output.
- Root cause: the probe bypassed the mandated `bun run dev:desktop` lifecycle and violated the single-instance constraint. Its ICU/GPU errors came from the unsupported concurrent copied-bundle launch, before application bootstrap.
- Decision: no source change is warranted for the launcher. All subsequent runtime verification will stop the existing scoped Tabs process first and use only `bun run dev:desktop`.
