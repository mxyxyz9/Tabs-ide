# Changelog

All notable changes to Tabs IDE will be documented in this file.

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
