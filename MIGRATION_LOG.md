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

## Phase 1: Native main-process backend

- Added a Tabs-owned native main-process boundary that dynamically loads the compiled Code-OSS Electron services from the resolved runtime. Tabs now creates the Electron IPC server and registers the extension-host starter, local disk file-system provider, utility-process worker, and the bootstrap channels required before the workbench can finish starting.
- The extension host is an Electron `utilityProcess` launched by Code-OSS `ExtensionHostStarter`. Its renderer connection is Code-OSS Electron IPC plus the `MessagePort` transferred by the starter; no HTTP or WebSocket REH transport participates.
- The local file provider is Code-OSS `DiskFileSystemProviderChannel` registered as `localFilesystem`. Renderer-side `Schemas.file` operations therefore terminate in the native main process.
- Runtime verification used only `bun run dev:desktop`, with Turbo loose env forwarding and a disposable copied runtime that excluded `server-main.js` and `server-cli.js`. The copy was necessary only to force the still-existing Phase 1 resolver fallback without racing the Code-OSS compiler.
- Verified extension-host lifecycle: the workbench logged `Started local extension host with pid 88907`; the host activated the Tabs integration extension, logged `[tabs-control] starting control channel`, connected it, and handled `setTheme tabs-dark`.
- Verified native file read/write: the workbench opened a disposable file in the repository through Quick Open, replaced its contents with `saved-through-native-file-provider\\n`, saved it, and the changed bytes were immediately visible from the host filesystem. The disposable file was removed after verification.
- Product metadata must be the normal merge of Code-OSS `package.json` plus `product.json`; using only `product.json` left the version undefined and made otherwise valid extensions appear incompatible.
- Remaining non-gating channel gaps observed during the probe are `workspaces`, `localPty`, `NativeMcpDiscoveryHelper`, `externalTerminal`, `menubar`, and `webview`. They affect secondary desktop features but did not prevent extension activation or native file persistence; they remain in scope for the native-only cutover.
- Verification: `bun run typecheck` passed in `tabs-main/apps/desktop`.
