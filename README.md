<p align="center">
  <img src="logo/dark mode icon.svg" width="120" alt="Tabs Logo" />
</p>

<h1 align="center">Tabs IDE</h1>

<p align="center">
  <strong>A desktop-first workspace for coding agents.</strong><br/>
  Chat with AI, edit code, run terminals, manage git — all in one place.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#building-installers">Building Installers</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## What is Tabs?

Tabs is a desktop application that combines a **chat-driven AI coding interface** with a full **VS Code-based editor**, **embedded terminals**, **browser tooling**, and **git controls** — all wired together through a local WebSocket server.

It supports multiple AI providers:
- **OpenAI Codex** — via the Codex CLI app-server (JSON-RPC over stdio)
- **Anthropic Claude** — via the Claude Agent SDK

## Features

- 🤖 **AI-Powered Chat** — Provider-backed agent threads with streaming responses
- 📝 **Embedded Code Editor** — Full VS Code (Code-OSS) workbench inside the Code tab
- 💻 **Integrated Terminals** — Embedded terminal sessions with PTY support
- 🌐 **Browser Tooling** — Built-in browser surfaces for web development
- 🔀 **Git Controls** — Full git workflow: branches, commits, diffs, stash, merge, rebase, PRs
- 🛡️ **Tailscale & Connections** — Secure remote network access and Tailscale VPN status integration
- ⚙️ **Source Control Settings** — Discover and configure Git/source control repositories and credentials
- 🎛️ **Model Picker Settings** — Select, configure, and switch between provider models directly from settings
- ⌨️ **Custom Keybindings** — Configurable keyboard shortcuts
- 🔄 **Session Checkpointing** — Git-based session state persistence
- 📦 **Cross-Platform** — macOS (DMG), Windows (NSIS), Linux (AppImage)
- 🎨 **Modern UI** — React 19 + TailwindCSS 4 with dark mode

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Shell                        │
│                   (apps/desktop)                         │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Chat Tab    │  │   Code Tab   │  │ Terminal Tab  │  │
│  │  (React UI)   │  │  (VS Code)   │  │   (xterm)    │  │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘  │
│         │                                     │         │
│         └──────────────┬──────────────────────┘         │
│                        │ WebSocket                      │
│  ┌─────────────────────┴──────────────────────────┐    │
│  │              Local Server (apps/server)          │    │
│  │                                                  │    │
│  │  ┌────────────┐  ┌─────────┐  ┌─────────────┐  │    │
│  │  │Orchestration│  │   Git   │  │  Terminals  │  │    │
│  │  │  (Events)   │  │ Service │  │   (PTY)     │  │    │
│  │  └──────┬─────┘  └─────────┘  └─────────────┘  │    │
│  │         │                                        │    │
│  │  ┌──────┴──────────────────┐                    │    │
│  │  │    Provider Runtime     │                    │    │
│  │  │  ┌───────┐  ┌────────┐ │                    │    │
│  │  │  │ Codex │  │ Claude │ │                    │    │
│  │  │  └───────┘  └────────┘ │                    │    │
│  │  └─────────────────────────┘                    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, TailwindCSS 4, Zustand, TanStack Router & Query |
| **Editor** | Lexical (composer), xterm.js 6 (terminal), @pierre/diffs |
| **Backend** | Node.js, Effect-TS, WebSocket, SQLite |
| **Desktop** | Electron 40, embedded VS Code (Code-OSS) workbench |
| **AI Providers** | Codex CLI (JSON-RPC), Claude Agent SDK |
| **Build** | Bun, Turborepo, tsdown, electron-builder |
| **Quality** | Vitest, Playwright, oxlint, oxfmt |

## Getting Started

### Prerequisites

- **Bun** 1.3+
- **Node.js** 24+
- A working **Codex CLI** install (for Codex-backed threads)
- A working **Claude CLI** install (for Claude-backed threads)

### Install

```bash
cd tabs-main
bun install
```

### Compile the embedded VS Code editor

```bash
cd tabs-code-main
npm install
npm run compile
```

### Run in development

```bash
# Run everything (web + server)
cd tabs-main
bun run dev

# Or run specific parts
bun run dev:web        # Web app only
bun run dev:server     # Server only
bun run dev:desktop    # Desktop (Electron) app
```

### Quality checks

```bash
bun run fmt:check    # Check formatting
bun run lint         # Run linter
bun run typecheck    # TypeScript type checking
bun run test         # Run all tests
```

## Building Installers

### macOS (DMG)

```bash
cd tabs-main
bun run dist:desktop:dmg           # Auto-detects arch
bun run dist:desktop:dmg:arm64     # Apple Silicon
bun run dist:desktop:dmg:x64       # Intel
```

### Windows (NSIS Installer)

> ⚠️ Must be built on a Windows machine or CI — cross-compilation is not supported due to native modules.

```bash
bun run dist:desktop:win
```

### Linux (AppImage)

```bash
bun run dist:desktop:linux
```

### CI Builds

Use the **Build Desktop Installers** GitHub Actions workflow to build for any platform:

1. Go to **Actions** → **Build Desktop Installers** → **Run workflow**
2. Select platforms (e.g. `mac-arm64,win-x64`)
3. Download artifacts from the completed workflow run

For production releases, push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers the full **Release Desktop** workflow which builds all platforms, signs the binaries, publishes to npm, and creates a GitHub Release.

## Project Structure

```
.
├── tabs-main/                  # Core monorepo
│   ├── apps/
│   │   ├── web/                # React/Vite frontend (~58K LOC)
│   │   │   ├── src/components/ # UI components (117 total)
│   │   │   ├── src/hooks/      # React hooks
│   │   │   ├── src/lib/        # Utilities & queries
│   │   │   └── src/routes/     # TanStack Router pages
│   │   ├── server/             # Node.js WebSocket server (~62K LOC)
│   │   │   ├── src/orchestration/  # Event-sourced domain logic
│   │   │   ├── src/provider/       # AI provider adapters
│   │   │   ├── src/git/            # Git operations service
│   │   │   ├── src/terminal/       # PTY terminal management
│   │   │   └── src/persistence/    # SQLite storage
│   │   ├── desktop/            # Electron shell (~6K LOC)
│   │   └── marketing/          # Astro marketing site
│   ├── packages/
│   │   ├── contracts/          # Effect/Schema shared types
│   │   └── shared/             # Shared runtime utilities
│   └── scripts/                # Build & release scripts
│
├── tabs-code-main/             # Forked VS Code (Code-OSS)
│                               # Compiled workbench for the Code tab
│
├── tabs-code-web/              # VS Code web build output
├── vscode-web/                 # VS Code web build output
└── logo/                       # Brand assets (SVG icons)
```

### Key Design Patterns

- **Effect-TS** — The server uses Effect for services, layers, typed errors, and structured concurrency
- **Event Sourcing** — Orchestration uses a decider/projector pattern for session lifecycle
- **Schema-First** — All client/server types defined in `@tabs/contracts` using Effect Schema
- **Logic Extraction** — UI components have companion `.logic.ts` files separating business logic from rendering

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TABS_PORT` | Server port |
| `TABS_HOME` | Tabs home directory |
| `TABS_AUTH_TOKEN` | Authentication token |
| `TABS_MODE` | Runtime mode |
| `TABS_CODE_OSS_BUILD_DIR` | Override path to tabs-code-main |
| `TABS_CODE_OSS_ENTRY` | URL for web-hosted workbench mode |
| `TABS_DESKTOP_WS_URL` | WebSocket URL override for desktop |
| `TABS_LOG_WS_EVENTS` | Enable WebSocket event logging |
| `TABS_NO_BROWSER` | Disable auto browser opening |

## Contributing

1. Read [CONTRIBUTING.md](tabs-main/CONTRIBUTING.md) before opening a change
2. All of `bun fmt`, `bun lint`, and `bun typecheck` must pass
3. Use `bun run test` (not `bun test`) to run tests
4. Performance and reliability are core priorities

## License

[MIT](tabs-main/LICENSE)
