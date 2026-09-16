# Changelog

All notable changes to Tabs IDE will be documented in this file.

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
