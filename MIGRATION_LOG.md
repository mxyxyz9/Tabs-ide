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

## Phase 2: Resolver and session model

- The resolver no longer inspects or prefers `out/server-main.js` / `out/server-cli.js`. Both explicit build directories and discovered sibling runtimes are accepted only when the compiled desktop preload, workbench, NLS, and product assets exist.
- The existing per-project desktop `CodeSession` implementation already owns a dedicated persistent Electron partition, `BrowserView`, workspace root/URI, per-project profile/state root, configuration IPC channel, bounds, focus state, and load/recreation lifecycle. Those responsibilities were retained instead of introducing a second session abstraction.
- Extended the native backend window registry to accept each per-project `BrowserView.webContents`. This is the missing session-to-extension-host link: Code-OSS identifies the target by webContents ID, while the backend supplies the window-like adapter used to transfer the extension-host `MessagePort`. Destroying the view removes it from the registry; existing workspace-change, project-removal, and shutdown paths already close the view and flush its storage.
- A first normal-launch verification exposed `responseWindow.win.isDestroyed is not a function` in the generalized adapter. The adapter was corrected to preserve the full `BrowserWindow` for top-level windows and provide `isDestroyed()` for BrowserView-backed sessions.
- Normal verification used plain `bun run dev:desktop` with the real `tabs-code-main` checkout and both REH entrypoint files present. The loaded URL was `vscode-file://vscode-app/.../workbench-dev.html`, proving resolver selection no longer depends on hiding REH artifacts.
- The normal launch started local extension host PID 5601, activated the Tabs integration extension, connected its control channel, applied the theme, and processed restored file-open commands.
- Verification: desktop typecheck passed; `bun run test -- src/codeHostManager.test.ts` passed all 31 tests. An earlier `bun test` invocation failed before test execution because Bun's runner does not apply this suite's Vitest Electron mock; the prescribed Vitest command is the valid result.

## Phase 3: REH removal

- Removed the managed-server runtime variant and all associated child-process handles, server startup logs, loopback port allocation/retry, HTTP readiness polling, HTTP session URL construction, port-keyed IndexedDB migration, server arguments/defaults, and process-tree termination.
- Removed the runtime downgrade path that could replace the native Code-OSS window with the legacy shell after load failure. Native startup failures are now logged and remain visible in the existing window; no server or replacement-window path is activated.
- Runtime discovery and downloaded-runtime validation now require native desktop workbench assets only. `TABS_CODE_OSS_ENTRY` is no longer a supported served-entry override.
- The main window and native backend no longer branch on `runtime.kind`; the sole runtime type is `desktop-renderer`. The remaining conditional is runtime availability for thin-install download handling, not runtime selection.
- Updated AI-provider settings persistence to target native per-profile settings rather than the deleted shared REH server-data directory.
- Verification: desktop typecheck passed; the focused CodeHostManager Vitest suite passed all 15 remaining native/session tests. A normal `bun run dev:desktop` launch loaded `vscode-file://vscode-app/.../workbench-dev.html`, started local extension host PID 10058, activated and connected the Tabs control extension, and issued native file-open commands. No Tabs/Electron process remained after the run.
- Phase 4 gap confirmed during this launch: the workbench requests `localPty`, but that channel is not registered yet. Terminal verification therefore cannot pass until the normal native terminal backend is mirrored.
