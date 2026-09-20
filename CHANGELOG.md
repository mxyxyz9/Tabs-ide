# Changelog

All notable changes to Tabs IDE will be documented in this file.

## [v1.3.12] - 2026-09-20

### Agents split-thread workspace, multi-pane composer isolation, and responsive layout polish

- **Agents split-thread workspace**: View and interact with two agent threads side-by-side directly in the conversation area without opening separate windows.
- **Drag-and-drop thread placement**: Drag any sidebar thread row into the conversation area with real-time drop zone previews to split left or right.
- **Context menu & shortcut splitting**: Quick "Open to the side" context menu action and <kbd>Alt</kbd>+Click on sidebar thread rows.
- **Composer & timeline isolation**: Independent composer draft inputs, attachment staging, scroll containers, tool call execution, and review diff targeting per pane.
- **Concurrent live streaming**: Real-time token streaming across both panes simultaneously with zero cross-talk.
- **Draggable pane divider & accessibility**: Smooth pointer dragging, 50/50 double-click reset, keyboard arrow resizing, and full ARIA separator semantics.
- **Seamless '+ New Thread' creation**: Creating a new thread while in split mode targets the active pane without closing the secondary pane.
- **Production-grade responsiveness**: Flexbox containment and container queries preventing layout clipping and horizontal overflow at 1024px screen widths with open sidebars.
- **Bundled self-contained desktop installers**: Maintained full self-contained desktop packages across macOS (Apple Silicon & Intel), Windows x64, and Linux x64 bundling the complete Code-OSS runtime directly.

## [v1.3.11] - 2026-09-20

### Refined Solari startup cascade, browser partition persistence, and storage migration resilience

- **Smoothed startup animation**: Paced the Solari tile cascade with a relaxed 160ms letter stagger, 250ms scramble lead-in, and a 1.8s hold time.
- **Desktop partition persistence**: Proactively flushes in-memory session cookies and cache partitions before application shutdown, preventing session state loss on exit.
- **Workspace storage migration resilience**: Hardened schema migration routines to validate and preserve user state during storage format upgrades without data corruption.
- **Linux legacy user data preservation**: Added automatic detection and migration from legacy configuration paths on Linux distributions.
- **Reduced motion accessibility**: Honored user accessibility preferences across all core dialog primitives (Alert Dialog, Command Palette, Dialog, and Sheet).
- **Bundled self-contained desktop installers**: Maintained full self-contained desktop packages across macOS (Apple Silicon & Intel), Windows x64, and Linux x64 bundling the complete Code-OSS runtime directly.

## [v1.3.10] - 2026-09-18

### AppleTimePicker numeric accumulation, drum wheel sync, and bundled desktop distribution

- **AppleTimePicker numeric accumulation**: Introduced an 800ms accumulation buffer for keyboard numeric entry. Users can now seamlessly type two-digit hours (e.g. typing "11" or "12") without the input prematurely jumping or getting stuck at single-digit "1".
- **Drum wheel scroll synchronization**: Fixed a stale closure race condition in the drum wheel column scroll handler by reading active selection state from mutable references, eliminating visual desynchronization between the header pill and the picker wheel.
- **Bundled self-contained desktop installers**: Continued bundling the Code-OSS runtime directly inside `.dmg`, `.exe`, and `.AppImage` packages, ensuring zero remote download dependencies or 404 runtime zip errors on cold start.
- **Development runtime isolation**: Verified local editor asset resolution in development mode (`bun run dev:desktop`) directly from the workspace checkout.
- **Client runtime error handling**: Aligned relay discovery error propagation with Effect yieldable error contracts.

## [v1.3.9] - 2026-09-17

### Bundled self-contained desktop installers, dev runtime isolation, and runtime stability

- **Bundled self-contained desktop installers**: Packaged desktop releases (.dmg, .exe, .AppImage) now bundle the complete Code-OSS runtime directly inside the application package (`Resources/tabs-code-main`), eliminating post-install download latency, 404 errors, and network dependencies.
- **Development runtime isolation**: Prevented development builds (`bun run dev:desktop`) from attempting GitHub release zip downloads, ensuring the editor runtime is always resolved directly from the local development checkout.
- **Runtime dependency pinning**: Pinned `@effect/platform-node-shared` to prevent transitive semver drift against `@effect/platform-node`, eliminating missing module runtime crashes (`ByteSize.js`).
- **Strict packaging assertions**: Added fail-loud build validations and preflight runtime structure checks preventing silent thin installer regressions.

## [v1.3.8] - 2026-09-16

### Code-OSS 1.138 upstream runtime sync, native code host contracts, and UI refinements

- **Code-OSS 1.138.0 upstream sync**: Synchronized the vendored Code-OSS runtime to VS Code 1.138.0, refreshing core workbench services, chat integrations, editor capabilities, and extensions.
- **AgentHost & Codex protocol schemas**: Aligned AgentHost services, session coordination, and turn lifecycle handlers, updating generated Codex protocol types.
- **Native code host contracts & testing**: Added strongly-typed IPC contracts and automated tests for desktop-to-editor bridge communication.
- **Workspace UI & settings polish**: Refined workspace shell layout, prompt stash and message queue panels, time picker input stability, and notification preferences.

## [v1.3.7] - 2026-09-16

### Notification history, schedule popover styling, time picker typing, and provider session lifecycle

- **Notification system & history panel**: Added a dedicated Notifications History drawer with category filtering, sound/badge settings, auto-dismiss duration controls, and full synchronization with the desktop native overlay.
- **Schedule popover & time picker typing overhaul**: Added modern backdrop blur styling to schedule dialogs and completely overhauled time picker input mechanics—eliminating drum wheel scroll fighting and hour input sticking to provide seamless, intuitive keyboard numeric entry.
- **Prompt stash & message queue panels**: Introduced prompt staging and queue management panels to organize and sequence agent commands without interrupting ongoing execution streams.
- **Scoped provider session lifecycles**: Bound event loops and notification dispatchers in Antigravity, Codex, Copilot, Cursor, Droid, and Grok adapters directly to the session context scope (`ctx.scope`), preventing orphan fibers and background resource leakage upon session termination.
- **Dynamic Codex reasoning effort & Grok fallback**: Enabled support for dynamic, server-reported reasoning effort levels across models and added resilient fallback routing for Grok model configurations.
- **Theme heading font support**: Added custom `headingFont` selection in Theme Studio with full export/import and system font synchronization.

## [v1.3.6] - 2026-09-15

### Native view notification overlay, persistent editor views, and accessible modal dialogs

- **Topmost native notification overlay**: Embedded Code-OSS, browser preview, and testing web contents views no longer detach or flicker when toasts appear. A dedicated Electron `WebContentsView` overlay managed by the new `NativeViewStackCoordinator` renders notifications seamlessly above native surfaces.
- **Typed notification IPC & focus restoration**: Added typed IPC channels for notification syncing and action dispatching. User interactions with toasts now restore focus to the previously active native editor or web view.
- **Accessible modal dialogs**: Replaced native browser popups with theme-consistent, accessible custom `<Dialog>` modals and `useConfirm` prompts across Git PR reviews, Theme Studio, Browser Profiles, Testing Journey Recorder, and Workspace settings.
- **UI & styling polish**: Fixed input decoration and icon z-indexing across dark and light themes, modernized select dropdowns in testing journey recorders, and tightened review thread actions.

## [v1.3.5] - 2026-09-14

### Antigravity protocol, collaborative browser engine, PR stacks, and streaming performance

- **Antigravity protocol integration**: Added native Antigravity protocol support with interactive approval options, optimized server logging, and resilient provider streams.
- **Collaborative browser engine**: Implemented real-browser session and cookie import, profile-scoped permissions, passkey capability reporting, CDP operation serialization, human takeover preemption, side-by-side comparison replay, and refined custom tab controls.
- **Pull request stacks & reviews**: Manage and navigate GitHub PR stacks directly from Tabs, link agent threads to PRs, inspect status checks and metadata, view inline review annotations, and edit PRs with provider awareness.
- **Streaming & timeline performance**: Dramatically improved streaming responsiveness with incremental markdown parsing, resumable incremental syntax highlighting, DOM stabilization for streaming code lines, and bounded live timeline rendering.
- **Settings & workspace resilience**: Split heavyweight settings sections into lazy loading panels, made configuration persistence failures recoverable, added keybinding configuration, and preserved per-project active tools across navigation.
- **Composer & chat enhancements**: Added a full prompt stashing workflow, structured workspace file references with review context, assistant citations, and response quoting.

## [v1.3.4] - 2026-09-11

### Toast notifications over native views, clean activity rail, and heartbeat optimization

- **Notification visibility over native views**: Embedded Code-OSS, browser preview, and testing web contents views now temporarily suspend when toasts and notification dialogs are active, ensuring alerts are never occluded underneath native surfaces.
- **Clean Code activity rail**: Filtered out auxiliary bar items from the primary activity bar to keep custom extensions and assistants organized without cluttering main rail navigation.
- **Background heartbeat optimization**: Excluded routine client activity and host power state lease heartbeats from slow RPC latency tracking, avoiding spurious slow request alerts.
- **Concurrency control for activity reporting**: Prevented concurrent overlapping activity lease requests during bursts of user interactions.
- **Website & release CI improvements**: Enhanced production website deployment workflows with rootDirectory-aware Vercel artifact packaging and automated deployment verification.

## [v1.3.3] - 2026-09-10

### Workspace skills, preview controls, and attachments

- **Workspace skills & slash commands**: Discover and dispatch directory-aware skills for Claude, Cursor, Codex, OpenCode, Antigravity, and Grok with ranked fuzzy search and source badges.
- **Collaborative browser preview**: Added direct viewport resize handles, picture-in-picture, dark/light appearance emulation, per-session audio controls, persistent navigation history, and active session clearing.
- **Composer & attachments**: Added support for general file attachments, persistent prompt stashing, mention preservation when pasting prompts, and dismissible provider warnings.
- **Workbench & desktop stability**: Progressive Code-OSS workbench startup, secondary sidebar and auxiliary bar extension support, workbench preservation across remounts, and cross-environment state storage isolation.
- **Notifications & performance**: Passive toast deduplication window, suppression of replayed keybindings alerts, and deferred native editor services.

## [v1.3.2] - 2026-09-09

### A steadier embedded editor

- Stabilized the embedded Code OSS host and its startup path in the desktop app.
- Fixed a TypeScript declaration issue in the web application's atom registry so release validation can complete reliably.

## [v1.3.1] - 2026-09-05

### Standalone bundled installers

- Shipped self-contained bundled desktop installers for macOS (Apple Silicon & Intel), Windows, and Linux.
