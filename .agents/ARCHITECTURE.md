# Tabs IDE Architecture and Context

This document provides a comprehensive overview of the Tabs IDE application architecture to help agents quickly understand the codebase. Future agents should keep this document updated as the system evolves.

## High-Level Architecture

Tabs IDE is a minimal web GUI and desktop application for using coding agents (like Codex and Claude). It is built as a **Turborepo monorepo** managed by **Bun**, featuring a strict separation between the client-side UI, the backend server, and shared contracts.

### Monorepo Structure

The repository is divided into `apps/` (runnable applications) and `packages/` (shared libraries).

#### Applications (`apps/`)

- **`apps/web`**: The main frontend React application. 
  - **Stack**: React, Vite, Tailwind CSS, Zustand (state management).
  - **Role**: Renders the session UX, workspace shell, conversation/event streams, and embedded browser views. It connects to the local server via WebSocket.
  - **Key Components**: `WorkspaceShell` (the main IDE layout), `DesktopBrowserTool` (embedded browser for webviews), terminal emulators, and chat interfaces.

- **`apps/server`**: The backend Node.js WebSocket server.
  - **Role**: Wraps the Codex app-server (via JSON-RPC over stdio), serves the compiled React web app locally, and manages provider sessions. 
  - **Tech**: Node.js, WebSockets, `effect` library for robust async and error handling.

- **`apps/desktop`**: The Electron application wrapper.
  - **Role**: Packages the `server` and `web` apps into a native desktop experience. Manages native OS integrations (like resizing embedded browser views, system menus, file system access).

- **`apps/marketing`**: The public-facing landing page/website.

#### Shared Packages (`packages/`)

- **`packages/contracts`**: The single source of truth for types and schemas.
  - **Role**: Contains `effect/Schema` definitions and TypeScript contracts for provider events, WebSocket protocols, and model/session types. 
  - **Rule**: *Keep this package schema-only — absolutely no runtime logic.*

- **`packages/shared`**: Shared runtime utilities.
  - **Role**: Consumed by both server and client applications (e.g., git utilities). 
  - **Rule**: Uses explicit subpath exports (e.g., `@t3tools/shared/git`) — no barrel index (`index.ts`).

- **`packages/client-runtime`**: Shared frontend logic.
  - **Role**: Shared runtime code specifically for clients (e.g., sharing React hooks or API clients across web and mobile/desktop).

- **`packages/effect-acp` & `packages/effect-codex-app-server`**: 
  - **Role**: Integrations with the Agent Communication Protocol (ACP) and Codex app servers, heavily utilizing the `effect` ecosystem for functional programming patterns.

## Core Technologies

- **Package Manager**: Bun (`bun install`, `bun run dev:desktop`)
- **Build System**: Turborepo (`turbo.json`)
- **Frontend**: React, Vite, Zustand (Store)
- **Backend**: Node.js, Electron (Desktop)
- **Functional Core**: `effect` (Effect-TS) is used extensively in backend and shared packages for schema validation, dependency injection, and concurrency.

## Core Engineering Principles

1. **Performance & Reliability First**: Keep behavior predictable under load and during failures (e.g., session restarts, reconnects, partial streaming). Choose correctness and robustness over short-term convenience.
2. **Shared Logic**: Extract duplicate logic into `packages/shared` or `packages/client-runtime`. Don't take shortcuts by adding local logic if it belongs in a shared module.
3. **No Native UI**: Do not use native browser popups (`window.confirm`, `window.alert`, `window.prompt`). Always use custom UI components like the `useConfirm` hook.
4. **Testing**: Maintain test suite correctness using `vitest` (`bun run test`). Do not leave failing tests.

## Local Development Flow

- Start the desktop app: `bun run dev:desktop`
- The `dev-runner.ts` script orchestrates Turborepo to start the Vite dev server (`apps/web`), the backend WebSocket server (`apps/server`), and the Electron host (`apps/desktop`).

*Note to Agents: When architectural changes are made (e.g., new packages, major state management shifts), you MUST update this file to ensure future agents have accurate context.*

## Testing Workspace Architecture

Testing is a project-scoped feature spanning the shared contracts, local server, React workspace,
Electron browser host, and built-in Code workbench integration.

- `packages/contracts/src/testing.ts` and `packages/contracts/src/ws.ts` define the Testing API and
  long-running operation inputs. All calls carry the top-level Tabs project ID.
- `apps/server/src/testing/` owns the additive SQLite schema, sanitized accessibility capture,
  Locator Library, page-object artifacts, workbook/story reconciliation, generation, execution,
  healing, and reporting. The Locator Library is canonical; generated Playwright page objects are
  immutable derived artifacts linked to exact locator versions.
- `apps/web/src/components/WorkspaceShell.tsx` hosts the Testing workflow. Locator-first is the
  default when no explicit project preference exists and the server flag is enabled. Classic
  discovery remains available under Advanced and is the kill-switch fallback.
- Desktop Testing preview sessions reuse the project-isolated Electron browser host partition via
  a dedicated `testing:<projectId>` session ID. Browser-only clients fall back to an iframe and the
  server-managed Playwright path where framing is unavailable.
- `apps/server/src/testing/testInventory.ts` statically indexes Playwright test files without
  executing repository code. The built-in `tabs-workbench-integration` extension observes VS Code
  `TestItem` state when that proposed API is available; live editor state takes precedence in the
  merged inventory.

Captured URLs, accessibility names, semantic context, generated code, prompts, and logs cross the
Testing sanitization boundary before persistence. Authentication cookies and credentials remain in
the project-scoped browser profile and are not written to Testing records.
