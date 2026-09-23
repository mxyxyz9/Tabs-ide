# Changelog

All notable changes to Tabs IDE will be documented in this file.

## [v1.3.16] - 2026-09-23

### More recoverable desktop updates

- **macOS update recovery**: If replacing the app fails, Tabs restores the previous app from its backup.
- **Linux AppImage recovery**: Tabs keeps the previous AppImage until the replacement starts successfully and restores it if the update fails.
- **Windows upgrades**: The installer closes processes running from the existing Tabs installation before replacing its files, without closing unrelated processes elsewhere.

## [v1.3.15] - 2026-09-22

### Centered release notes dialog with dedicated close control

- **Centered release notes dialog**: Replaced the edge-anchored popover with a spacious, centered modal dialog that gives release notes plenty of reading room across all display sizes.
- **Dedicated close button**: Added an accessible top-right close button with an X icon, complementing keyboard escape and backdrop click to dismiss.
- **Scroll-faded changelog panel**: Added a smooth, scroll-faded reading panel so you can easily browse long update notes while keeping titles and close actions anchored.

## [v1.3.14] - 2026-09-22

### Reliable settings drafts and input saving

- **Workspace draft isolation**: Editing custom browser tabs, terminal tabs, or server presets keeps your in-progress changes isolated until you choose to save or cancel, preventing unrelated actions from committing dirty drafts.
- **Debounced input persistence**: Settings text fields automatically debounce updates during typing and flush immediately on blur, Enter, or when closing the application.
- **Clean theme preview rollback**: Exploring and customizing colors in the Theme Studio safely reverts back to your previous theme if you exit or cancel without applying changes.
- **Early Access brand refinements**: Refreshed brand typography and visual aurora liquid effects across buildwithtabs.com.
- **Keybindings batch importing**: Improved stability and validation when importing custom keybinding configurations.

## [v1.3.13] - 2026-09-21

### In-app desktop updates and release notes preview

- **In-app macOS preview updates**: macOS preview builds now verify and install updates in place, with automatic cryptographic signature and checksum verification.
- **Release notes preview in the sidebar**: Hover over the update button or check About settings to review what changed before downloading or restarting.
- **Clear download progress**: See real-time download percentage directly in the update button tooltip and About settings.
- **Updated website and documentation**: Fresh product screenshots, social cards, and updated release documentation on buildwithtabs.com.

## [v1.3.12] - 2026-09-20

### Work with two agent threads side by side

- **Open a second conversation**: Drag a thread to either side, choose "Open to the side" from its menu, or Alt-click it.
- **Keep each conversation separate**: Each pane has its own draft, attachments, message position, and review view.
- **Follow both responses**: Agent replies continue updating in both panes while you work.
- **Adjust the layout**: Drag the divider, double-click to split the space evenly, or resize it with the keyboard. On narrow windows, Tabs shows one thread at a time with a quick way to switch.
- **Start a fresh thread**: "New Thread" opens in the active pane without closing the other conversation.

## [v1.3.11] - 2026-09-20

### Smoother startup and more reliable saved sessions

- **Smoothed startup animation**: Paced the Solari tile cascade with a relaxed 160ms letter stagger, 250ms scramble lead-in, and a 1.8s hold time.
- **Desktop partition persistence**: Proactively flushes in-memory session cookies and cache partitions before application shutdown, preventing session state loss on exit.
- **Workspace settings**: Improved how existing settings are carried forward when Tabs updates its local storage format.
- **Linux user data**: Tabs can find data from older Linux configuration locations when you update.
- **Reduced motion accessibility**: Honored user accessibility preferences across all core dialog primitives (Alert Dialog, Command Palette, Dialog, and Sheet).
- **Bundled self-contained desktop installers**: Maintained full self-contained desktop packages across macOS (Apple Silicon & Intel), Windows x64, and Linux x64 bundling the complete Code-OSS runtime directly.

## [v1.3.10] - 2026-09-18

### Easier keyboard entry in the time picker

- **Two-digit time entry**: You can type hours such as 11 or 12 without the picker jumping away after the first digit.
- **Scroll selection**: The displayed time now stays in step with the picker wheel while scrolling.

## [v1.3.9] - 2026-09-17

### Desktop installers include the editor

- **Install and launch**: macOS, Windows, and Linux packages contain the editor runtime instead of fetching it on first launch.
- **Startup reliability**: Fixed a dependency issue that could stop the packaged app from opening.

## [v1.3.8] - 2026-09-16

### Updated editor and workspace controls

- **Embedded editor**: Updated the Code workspace with changes from VS Code 1.138.
- **Workspace controls**: Refined the layout, prompt stash, and message queue panels.
- **Time and notification settings**: Improved time picker input and notification preferences.

## [v1.3.7] - 2026-09-16

### Notification history and scheduling improvements

- **Notification system & history panel**: Added a dedicated Notifications History drawer with category filtering, sound/badge settings, auto-dismiss duration controls, and full synchronization with the desktop native overlay.
- **Schedule popover & time picker typing overhaul**: Added modern backdrop blur styling to schedule dialogs and completely overhauled time picker input mechanics—eliminating drum wheel scroll fighting and hour input sticking to provide seamless, intuitive keyboard numeric entry.
- **Prompt stash & message queue panels**: Introduced prompt staging and queue management panels to organize and sequence agent commands without interrupting ongoing execution streams.
- **Session cleanup**: Ending an agent conversation now stops its background updates more reliably.
- **Dynamic Codex reasoning effort & Grok fallback**: Enabled support for dynamic, server-reported reasoning effort levels across models and added resilient fallback routing for Grok model configurations.
- **Theme heading font support**: Added custom `headingFont` selection in Theme Studio with full export/import and system font synchronization.

## [v1.3.6] - 2026-09-15

### Native view notification overlay, persistent editor views, and accessible modal dialogs

- **Topmost native notification overlay**: Embedded Code-OSS, browser preview, and testing web contents views no longer detach or flicker when toasts appear. A dedicated Electron `WebContentsView` overlay managed by the new `NativeViewStackCoordinator` renders notifications seamlessly above native surfaces.
- **Typed notification IPC & focus restoration**: Added typed IPC channels for notification syncing and action dispatching. User interactions with toasts now restore focus to the previously active native editor or web view.
- **Accessible dialogs**: Replaced browser popups with Tabs dialogs across Git reviews, Theme Studio, browser profiles, testing, and settings.
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
