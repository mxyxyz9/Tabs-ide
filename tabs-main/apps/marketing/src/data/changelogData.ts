export interface ChangelogCategory {
  title: string;
  items: string[];
}

export interface ChangelogRelease {
  tag: string;
  title: string;
  date: string;
  shortDate?: string;
  isLatest?: boolean;
  type: "major" | "feature" | "patch";
  summary: string;
  highlights: string[];
  categories: ChangelogCategory[];
  installers?: {
    platform: string;
    arch: string;
    filename: string;
    url: string;
  }[];
}

export const TOTAL_TAGS_COUNT = 147;

export const changelogData: ChangelogRelease[] = [
  {
    tag: "v1.3.4",
    title: "Toast notifications over native views, clean activity rail, and heartbeat optimization",
    date: "September 11, 2026",
    shortDate: "Sep 11",
    isLatest: true,
    type: "patch",
    summary:
      "Toast notifications remain visible over embedded views, auxiliary items are cleaned from Code activity rail, and background heartbeat latency warnings are eliminated.",
    highlights: [
      "Embedded Code-OSS, browser preview, and testing views suspend during active toasts and notifications so alerts remain visible.",
      "Auxiliary bar items filtered out from the primary activity bar to prevent cluttering main rail navigation.",
      "Excluded routine lease heartbeats from slow RPC latency tracking and added concurrency guards to activity reporting.",
      "Refined production website deployment packaging and verified live release assets.",
    ],
    categories: [
      {
        title: "Native Overlays & Notifications",
        items: [
          "Suspends native WebContentsViews when toasts are mounted so notifications are never occluded.",
          "Updated overlay selectors across Code host and testing previews.",
        ],
      },
      {
        title: "Workbench & Activity Rail",
        items: [
          "Secondary auxiliary bar items excluded from main activity rail.",
          "Deterministic ordering for custom activity bar extensions.",
        ],
      },
      {
        title: "RPC & Performance",
        items: [
          "Heartbeat RPC methods excluded from latency monitoring to avoid spurious slow request toasts.",
          "In-flight concurrency guard for client activity reporting.",
        ],
      },
    ],
    installers: [
      {
        platform: "macOS",
        arch: "Apple Silicon (M1/M2/M3/M4)",
        filename: "Tabs-1.3.4-arm64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.4/Tabs-1.3.4-arm64.dmg",
      },
      {
        platform: "macOS",
        arch: "Intel x64",
        filename: "Tabs-1.3.4-x64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.4/Tabs-1.3.4-x64.dmg",
      },
      {
        platform: "Windows",
        arch: "x64 installer",
        filename: "Tabs-1.3.4-x64.exe",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.4/Tabs-1.3.4-x64.exe",
      },
      {
        platform: "Linux",
        arch: "x64 AppImage",
        filename: "Tabs-1.3.4-x86_64.AppImage",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.4/Tabs-1.3.4-x86_64.AppImage",
      },
    ],
  },
  {
    tag: "v1.3.3",
    title: "Workspace skills, preview controls, and attachments",
    date: "September 10, 2026",
    shortDate: "Sep 10",
    type: "patch",
    summary:
      "Workspace-specific skill discovery and dispatch, direct browser preview controls, file attachments, and progressive desktop startup stability.",
    highlights: [
      "Discover and dispatch directory-aware skills for Claude, Cursor, Codex, OpenCode, Antigravity, and Grok with ranked fuzzy search.",
      "Added direct viewport resize handles, picture-in-picture, appearance emulation, and active session controls to the browser preview.",
      "General file attachments in composer, persistent prompt stashing, and paste mention preservation.",
      "Progressive Code-OSS workbench startup, secondary sidebar support, and multi-environment state isolation.",
    ],
    categories: [
      {
        title: "Skills & Slash Commands",
        items: [
          "Ranked skill search with source badges for app, repo, project, personal, and system skills.",
          "Directory-aware skill snapshots and native provider dispatch planning.",
        ],
      },
      {
        title: "Browser & Preview",
        items: [
          "Direct viewport resize frame with responsive presets.",
          "Theme appearance emulation, native picture-in-picture, and per-session audio controls.",
        ],
      },
      {
        title: "Composer & Desktop Stability",
        items: [
          "File attachments with provider upload support and persistent prompt stash.",
          "Progressive Code-OSS startup, secondary sidebar support, and effect remount preservation.",
        ],
      },
    ],
    installers: [
      {
        platform: "macOS",
        arch: "Apple Silicon (M1/M2/M3/M4)",
        filename: "Tabs-1.3.3-arm64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.3/Tabs-1.3.3-arm64.dmg",
      },
      {
        platform: "macOS",
        arch: "Intel x64",
        filename: "Tabs-1.3.3-x64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.3/Tabs-1.3.3-x64.dmg",
      },
      {
        platform: "Windows",
        arch: "x64 installer",
        filename: "Tabs-1.3.3-x64.exe",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.3/Tabs-1.3.3-x64.exe",
      },
      {
        platform: "Linux",
        arch: "x64 AppImage",
        filename: "Tabs-1.3.3-x86_64.AppImage",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.3/Tabs-1.3.3-x86_64.AppImage",
      },
    ],
  },
  {
    tag: "v1.3.2",
    title: "A steadier embedded editor",
    date: "September 9, 2026",
    shortDate: "Sep 9",
    type: "patch",
    summary:
      "A stability release that makes the shipped desktop workspace and its release validation path more dependable.",
    highlights: [
      "Stabilized the embedded Code OSS host and its startup path in the desktop app.",
      "Fixed a TypeScript declaration issue in the web application's atom registry so release validation can complete reliably.",
    ],
    categories: [
      {
        title: "Release scope",
        items: ["This release does not add a new end-user workflow."],
      },
    ],
    installers: [
      {
        platform: "macOS",
        arch: "Apple Silicon (M1/M2/M3/M4)",
        filename: "Tabs-1.3.2-arm64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.2/Tabs-1.3.2-arm64.dmg",
      },
      {
        platform: "macOS",
        arch: "Intel x64",
        filename: "Tabs-1.3.2-x64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.2/Tabs-1.3.2-x64.dmg",
      },
      {
        platform: "Windows",
        arch: "x64 installer",
        filename: "Tabs-1.3.2-x64.exe",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.2/Tabs-1.3.2-x64.exe",
      },
      {
        platform: "Linux",
        arch: "x64 AppImage",
        filename: "Tabs-1.3.2-x86_64.AppImage",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.2/Tabs-1.3.2-x86_64.AppImage",
      },
    ],
  },
  {
    tag: "v1.3.1",
    title: "Standalone installers and reliable updates",
    date: "September 5, 2026",
    shortDate: "Sep 5",
    type: "patch",
    summary:
      "Tabs now ships as a complete desktop installer for macOS, Windows, and Linux, with update manifests checked as part of every release.",
    highlights: [
      "Each installer includes the runtime it needs, so there are no separate dependencies to install.",
      "Release checks now validate the Windows and Linux update manifests before publishing.",
      "Code OSS packaging and window startup are more reliable in production builds.",
    ],
    categories: [
      {
        title: "Desktop & Distribution",
        items: [
          "Bundled native runtimes into standalone .dmg packages for macOS (separate Apple Silicon arm64 and Intel x64 builds).",
          "Generated verified NSIS installer (.exe) with differential blockmap for Windows x64.",
          "Produced universal Linux .AppImage with glibc 2.31+ binary compatibility.",
        ],
      },
      {
        title: "Updater & Lifecycle",
        items: [
          "Integrated in-app update checks for Windows and Linux with automated restart flow.",
          "Hardened native IPC bootstrap channel between Electron main process and background server daemon.",
        ],
      },
    ],
    installers: [
      {
        platform: "macOS",
        arch: "Apple Silicon (M1/M2/M3/M4)",
        filename: "Tabs-1.3.1-arm64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.1/Tabs-1.3.1-arm64.dmg",
      },
      {
        platform: "macOS",
        arch: "Intel x64",
        filename: "Tabs-1.3.1-x64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.1/Tabs-1.3.1-x64.dmg",
      },
      {
        platform: "Windows",
        arch: "x64 (Win 10/11)",
        filename: "Tabs-1.3.1-x64.exe",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.1/Tabs-1.3.1-x64.exe",
      },
      {
        platform: "Linux",
        arch: "x64 AppImage",
        filename: "Tabs-1.3.1-x86_64.AppImage",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.1/Tabs-1.3.1-x86_64.AppImage",
      },
    ],
  },
  {
    tag: "v1.3.0",
    title: "Code OSS, project tabs, browser tools, and remote workspaces",
    date: "September 5, 2026",
    shortDate: "Sep 5",
    type: "major",
    summary:
      "This release brings the editor, browser automation, remote environments, pull requests, and testing into the same project-based desktop workspace.",
    highlights: [
      "Use the embedded Code OSS editor with extensions, syntax support, and familiar keyboard shortcuts.",
      "Open URLs in browser tabs, inspect elements, record journeys, and turn them into Playwright tests.",
      "Connect through SSH or Tailscale while keeping terminals and Git commands scoped to the selected project.",
      "Review GitHub and GitLab pull requests with inline comments and merge controls.",
      "Generate, run, and review Playwright tests without leaving the project tab.",
    ],
    categories: [
      {
        title: "Code OSS Chrome & Editor",
        items: [
          "Replaced separate editor windows with a native Code OSS workbench embedded directly into the workspace rail.",
          "Surface extension views, webviews, and file trees in compact Tabs chrome.",
          "Synchronized active editor state, cursor locations, and themes with agent sessions.",
        ],
      },
      {
        title: "Agent Browser Automation Broker",
        items: [
          "Connected Chromium-based browser preview with bidirectional CDP automation broker.",
          "Visual DOM element inspection and locator discovery with automatic selector generation.",
          "Journey recording: automatically records user interactions into executable Playwright test scripts.",
          "Session recording with live automation diagnostics and video artifacts.",
        ],
      },
      {
        title: "Remote Environments & Connections",
        items: [
          "Desktop SSH gateway supporting password and key-based authentication with reconnect resilience.",
          "Tailscale transport support for zero-config mesh networking.",
          "Isolate workspace state, file watchers, and terminals by target project environment.",
        ],
      },
      {
        title: "AI Collaborators & Providers",
        items: [
          "Added GitHub Copilot provider driver with ACP and custom authentication configurations.",
          "Integrated Kilo, Droid, Antigravity, and OpenRouter model drivers.",
          "Real-time provider usage telemetry with token tracking and quota alerts.",
        ],
      },
      {
        title: "Git Workflows & PR Management",
        items: [
          "Full PR review workspace for both GitHub and GitLab repositories.",
          "Manage reviewers, labels, draft statuses, and branches directly in-app.",
          "Suspend inactive Git panel queries for optimal multi-tab CPU efficiency.",
        ],
      },
    ],
    installers: [
      {
        platform: "macOS",
        arch: "Apple Silicon (M1/M2/M3/M4)",
        filename: "Tabs-1.3.0-arm64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.0/Tabs-1.3.0-arm64.dmg",
      },
      {
        platform: "macOS",
        arch: "Intel x64",
        filename: "Tabs-1.3.0-x64.dmg",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.0/Tabs-1.3.0-x64.dmg",
      },
      {
        platform: "Windows",
        arch: "x64",
        filename: "Tabs-1.3.0-x64.exe",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.0/Tabs-1.3.0-x64.exe",
      },
      {
        platform: "Linux",
        arch: "x64 AppImage",
        filename: "Tabs-1.3.0-x86_64.AppImage",
        url: "https://github.com/mxyxyz9/Tabs-ide/releases/download/v1.3.0/Tabs-1.3.0-x86_64.AppImage",
      },
    ],
  },
  {
    tag: "v1.2.122",
    title: "Safer quit flow and steadier extension sessions",
    date: "August 12, 2026",
    shortDate: "Aug 12",
    type: "feature",
    summary:
      "Tabs now protects active work before quitting, restores project state more consistently, and starts Code OSS extensions more reliably.",
    highlights: [
      "Quit Confirmation Dialog: Custom non-native modal dialog safeguards active agent sessions and uncommitted file edits from accidental exit.",
      "Extension Host Stabilization: Resolved race condition during multiple extension host activations on cold launch.",
      "Tab Switching Responsiveness: Smoother tab transitions and reduced memory footprint during background tab hibernation.",
    ],
    categories: [
      {
        title: "Session & Tab Management",
        items: [
          "Implemented quit confirmation flow with modal to prevent data loss on exit.",
          "Refined tabs layout and session UI with smooth tab dragging and pinning.",
          "Lifecycle state preservation across workspace restarts.",
        ],
      },
      {
        title: "Extension Runtime",
        items: [
          "Fixed native Code OSS extension integration and webview assistant communication.",
          "Preserved structured output findings during agent tool invocation.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.121",
    title: "Synara Claude adapter and modular code audit engine",
    date: "August 5, 2026",
    shortDate: "Aug 5",
    type: "feature",
    summary:
      "Added native Claude provider support ported from Synara, paired with an automated code analysis engine for proactive workspace audits.",
    highlights: [
      "Integrated Synara Claude provider adapter with streaming tool calls and token metrics.",
      "Introduced modular audit engine running background code analysis passes.",
      "Added dashboard view for findings triage and one-click agent remediation.",
    ],
    categories: [
      {
        title: "Model Providers",
        items: [
          "Synced Claude protocol adapter with prompt caching and sub-agent handoffs.",
          "Added token metering and cost telemetry per workspace project.",
        ],
      },
      {
        title: "Audit & Analysis",
        items: [
          "Built multi-phase static inspection runner for TypeScript and Rust codebases.",
          "Surfaced diagnostic findings in the project rail alongside Git changes.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.120",
    title: "WebSocket review progress and reasoning controls",
    date: "August 4, 2026",
    shortDate: "Aug 4",
    type: "feature",
    summary:
      "Live WebSocket streaming for review progress, granular model reasoning budgets, and unified system dialog aesthetics.",
    highlights: [
      "Real-time WebSocket event streaming for background PR review jobs.",
      "Configurable reasoning effort levels (Low, Medium, High, Ultrathink).",
      "Unified modal design system replacing browser-native dialogs.",
    ],
    categories: [
      {
        title: "Review Streaming",
        items: [
          "Connected live server logs directly into PR review status views.",
          "Resilient auto-reconnect logic for interrupted WebSocket review feeds.",
        ],
      },
      {
        title: "Reasoning Controls",
        items: [
          "Exposed per-turn thinking budget sliders in composer settings.",
          "Persisted reasoning preferences by selected model tier.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.119",
    title: "Strict structured output and Effect runtime alignment",
    date: "August 4, 2026",
    shortDate: "Aug 4",
    type: "patch",
    summary:
      "Constrained provider responses to validated JSON schemas and synchronized Effect version dependencies across the monorepo.",
    highlights: [
      "Native JSON Schema constraints on agent tool calling to eliminate parse exceptions.",
      "Synchronized Effect runtime packages across shared, server, and client apps.",
    ],
    categories: [
      {
        title: "Schema Reliability",
        items: [
          "Enforced strict schema output parsing on provider RPC endpoints.",
          "Cleaned up legacy schema contracts and added regression test coverage.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.118",
    title: "Desktop IndexedDB storage migration and session cleanup",
    date: "August 3, 2026",
    shortDate: "Aug 3",
    type: "patch",
    summary:
      "Automated migration for Electron IndexedDB session storage, selecting latest mtime database ports without workspace disruption.",
    highlights: [
      "Resolved multi-instance storage collision during desktop database migrations.",
      "Cleaned up orphaned session records on background daemon startup.",
    ],
    categories: [
      {
        title: "Storage & Persistence",
        items: [
          "Migrated Electron IndexedDB session storage to newest mtime port.",
          "Pruned orphaned session data on background daemon startup.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.117",
    title: "Single tool toolbar optimization and zero-tool safeguard",
    date: "July 28, 2026",
    shortDate: "Jul 28",
    type: "patch",
    summary:
      "Streamlined toolbar layout when only one tool is active and added safety guards when no tools are configured.",
    highlights: [
      "Optimized compact toolbar layout for single active agent tools.",
      "Added zero-tool fallback indicator and empty-state guidance in toolbar UI.",
    ],
    categories: [
      {
        title: "Toolbar & Actions",
        items: [
          "Compact layout optimization when exactly one tool is active.",
          "Zero-tool fallback indicator and empty-state guidance in session toolbar.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.116",
    title: "Independent font preferences and Reset to Defaults UX",
    date: "July 27, 2026",
    shortDate: "Jul 27",
    type: "feature",
    summary:
      "Independent typography preferences with --font-display support, dynamic web font loader, and quick Reset to Defaults controls.",
    highlights: [
      "Configurable editor, UI, and display fonts with live preview.",
      "One-click Reset to Defaults for typography and theme customizations.",
      "Scoped CSS custom property injection for frictionless theme overrides.",
    ],
    categories: [
      {
        title: "Typography & Theming",
        items: [
          "Standalone Typography settings panel with --font-display support.",
          "Dynamic Google Fonts loader for selected display typefaces.",
          "One-click Reset to Defaults for themes and typography.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.114",
    title: "Embedded editor theme refinements and desktop integration",
    date: "July 27, 2026",
    shortDate: "Jul 27",
    type: "patch",
    summary:
      "Refined Code OSS dark theme contrast, fixed window title bar drag regions, and improved desktop bridge handshake.",
    highlights: [
      "Harmonized editor token colors with Tabs dark theme palette.",
      "Patched macOS titlebar drag region collision with custom tab rail.",
    ],
    categories: [
      {
        title: "Desktop & Editor Theme",
        items: [
          "Harmonized Code OSS dark theme tokens with workspace rail.",
          "Patched macOS titlebar drag region collision with custom tab rail.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.113",
    title: "Toolbar tools stale cache fix and provider stability",
    date: "July 27, 2026",
    shortDate: "Jul 27",
    type: "patch",
    summary:
      "Purged stale entries in the toolbar tools registry and improved MCP tool hot-reloading.",
    highlights: [
      "Fixed tool cache invalidation when MCP servers disconnect or reload.",
      "Prevented phantom tools from rendering in the active session action bar.",
    ],
    categories: [
      {
        title: "Tool Registry",
        items: [
          "Purged stale tool entries on MCP disconnect or reload.",
          "Prevented phantom tools from rendering in the active session action bar.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.112",
    title: "Language service build cleanup and CI preflight fixes",
    date: "July 26, 2026",
    shortDate: "Jul 26",
    type: "patch",
    summary:
      "Cleaned up build lifecycle scripts to eliminate TypeScript compiler preflight errors in continuous integration.",
    highlights: [
      "Streamlined monorepo typecheck pipeline across web and server workspaces.",
      "Accelerated CI preflight verification time by 30%.",
    ],
    categories: [
      {
        title: "Build & CI",
        items: [
          "Streamlined monorepo typecheck pipeline across web and server workspaces.",
          "Removed effect-language-service patch script causing preflight build errors.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.111",
    title: "Browser collapsed state persistence and header tooltips",
    date: "July 26, 2026",
    shortDate: "Jul 26",
    type: "patch",
    summary:
      "Persisted browser panel collapsed states across sessions and prevented header tooltips from clipping window borders.",
    highlights: [
      "Saved browser drawer visibility to local workspace preferences.",
      "Repositioned floating header tooltips to ensure they never overflow screen boundaries.",
    ],
    categories: [
      {
        title: "Browser & Header UI",
        items: [
          "Saved browser drawer visibility to local workspace preferences.",
          "Repositioned floating header tooltips to ensure they never overflow screen boundaries.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.110",
    title: "Animation frame stubs and test suite reliability",
    date: "July 26, 2026",
    shortDate: "Jul 26",
    type: "patch",
    summary:
      "Polyfilled requestAnimationFrame and cancelAnimationFrame in headless test environments to ensure zero test flakiness.",
    highlights: [
      "Deterministic test runs under bun:test runner.",
      "Eliminated headless DOM timing discrepancies in UI unit tests.",
    ],
    categories: [
      {
        title: "Test Infrastructure",
        items: [
          "Deterministic test runs under bun:test runner.",
          "Eliminated headless DOM timing discrepancies in UI unit tests.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.109",
    title: "Browser navigation loop guard and URL normalization",
    date: "July 26, 2026",
    shortDate: "Jul 26",
    type: "patch",
    summary:
      "Guard against infinite browser reloads with automatic URL normalization and isSameWebUrl comparison check.",
    highlights: [
      "Prevented rapid reload cycles when navigating client-side hashed routes.",
      "Normalized trailing slashes and default protocols for browser tabs.",
    ],
    categories: [
      {
        title: "Browser Engine",
        items: [
          "Prevented rapid reload cycles when navigating client-side hashed routes.",
          "Normalized trailing slashes and default protocols for browser tabs.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.108",
    title: "Browser toolbar expansion and default workspace URL resolution",
    date: "July 26, 2026",
    shortDate: "Jul 26",
    type: "patch",
    summary:
      "Added toolbar expansion controls for the embedded browser and automatic dev server URL detection on project boot.",
    highlights: [
      "Expanded browser chrome view with zoom controls and console toggle.",
      "Auto-detected running Vite and Next.js dev server ports.",
    ],
    categories: [
      {
        title: "Browser Chrome & Discovery",
        items: [
          "Expanded browser chrome view with zoom controls and console toggle.",
          "Auto-detected running Vite and Next.js dev server ports.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.105",
    title: "Persisted startup animation settings and UI efficiency",
    date: "July 26, 2026",
    shortDate: "Jul 26",
    type: "patch",
    summary:
      "Respected user preferences for startup animations and reduced initial rendering cost during cold launch.",
    highlights: [
      "Added toggle to disable startup splash animations for immediate editor focus.",
      "Optimized DOM reconciliation during session restoration.",
    ],
    categories: [
      {
        title: "Preferences & Performance",
        items: [
          "Added toggle to disable startup splash animations for immediate editor focus.",
          "Optimized DOM reconciliation during session restoration.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.104",
    title: "High contrast theme-based project tabs styling",
    date: "July 25, 2026",
    shortDate: "Jul 25",
    type: "feature",
    summary:
      "Introduced high-contrast project tab indicators with custom status markers and active border highlights.",
    highlights: [
      "Crisp visual separation for multiple concurrently active project tabs.",
      "Added high-contrast theme support for improved outdoor visibility.",
    ],
    categories: [
      {
        title: "Tabs Rail Design",
        items: [
          "Crisp visual separation for multiple concurrently active project tabs.",
          "Added high-contrast theme support for improved outdoor visibility.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.103",
    title: "Universal dynamic model discovery and remote catalog registry",
    date: "July 25, 2026",
    shortDate: "Jul 25",
    type: "feature",
    summary:
      "Dynamic model catalog discovery pulling latest provider models on demand with auto-refresh guards.",
    highlights: [
      "Auto-populated model pickers with newly released LLM models without requiring app updates.",
      "Rate-limiting protection on startup catalog synchronization.",
    ],
    categories: [
      {
        title: "Model Catalog Registry",
        items: [
          "Auto-populated model pickers with newly released LLM models without requiring app updates.",
          "Rate-limiting protection on startup catalog synchronization.",
        ],
      },
    ],
  },
  {
    tag: "v1.2.102",
    title: "Chat UI and composer redesign",
    date: "July 25, 2026",
    shortDate: "Jul 25",
    type: "feature",
    summary:
      "Rebuilt chat interface with expandable multi-line composer, file tag autocompletion, and visual model badge chips.",
    highlights: [
      "Redesigned conversational stream with markdown formatting and collapsible code blocks.",
      "Fuzzy file search `@mention` autocompletion directly in the prompt input.",
      "Added model token count estimators and cost previews.",
    ],
    categories: [
      {
        title: "Chat & Composer",
        items: [
          "Redesigned conversational stream with markdown formatting and collapsible code blocks.",
          "Fuzzy file search `@mention` autocompletion directly in the prompt input.",
          "Added model token count estimators and cost previews.",
        ],
      },
    ],
  },
];
