/**
 * Shared logic for the native Code-tab chrome (activity rail / header / status
 * bar) that surrounds the embedded Code-OSS BrowserView, plus the loopback
 * control-channel protocol used to drive the embedded workbench.
 *
 * This module is the single source of truth consumed by:
 *  - the web UI (`apps/web/.../components/code/*`) — renders the chrome,
 *  - the Electron main process (`apps/desktop/.../codeControlChannel.ts`) — the
 *    broker that validates and forwards command requests, and
 *  - (by reference) the bundled integration extension
 *    (`apps/desktop/resources/code-oss-extensions/tabs-workbench-integration/
 *    extension.js`), which keeps a hardcoded mirror of the allowlist because it
 *    ships as plain JS with no bundler. Keep that mirror in sync with
 *    `CODE_CHROME_COMMAND_ALLOWLIST` below.
 *
 * Kept free of React/DOM/node so it is trivially unit-testable and importable
 * from every layer.
 */

import type { CodeActivityViewId, CodeChromeState } from "@tabs/contracts";

export type { CodeActivityViewId, CodeChromeState };

/** lucide-react icon names (resolved to components in the web layer). */
export type CodeActivityIcon = "files" | "search" | "git-branch" | "bug" | "puzzle";

/** A single activity-rail entry, mirroring VS Code's default activity bar order. */
export interface CodeActivityItem {
  readonly id: CodeActivityViewId;
  readonly label: string;
  /** VS Code command that reveals this view. */
  readonly commandId: string;
  readonly icon: CodeActivityIcon;
}

export const CODE_ACTIVITY_ITEMS: readonly CodeActivityItem[] = [
  { id: "explorer", label: "Explorer", commandId: "workbench.view.explorer", icon: "files" },
  { id: "search", label: "Search", commandId: "workbench.view.search", icon: "search" },
  { id: "scm", label: "Source Control", commandId: "workbench.view.scm", icon: "git-branch" },
  { id: "debug", label: "Run and Debug", commandId: "workbench.view.debug", icon: "bug" },
  {
    id: "extensions",
    label: "Extensions",
    commandId: "workbench.view.extensions",
    icon: "puzzle",
  },
] as const;

/** Command ids used by the header / status bar / panel toggles. */
export const CODE_CHROME_COMMANDS = {
  commandPalette: "workbench.action.showCommands",
  toggleSidebar: "workbench.action.toggleSidebarVisibility",
  togglePanel: "workbench.action.togglePanel",
  toggleTerminal: "workbench.action.terminal.toggleTerminal",
  quickOpen: "workbench.action.quickOpen",
  settings: "workbench.action.openSettings",
} as const;

/**
 * Every command id the chrome is allowed to request. Both the broker (Electron
 * main) and the extension validate against this before executing, so a
 * compromised renderer can only trigger this fixed, side-effect-light set of
 * navigation/layout commands — never arbitrary VS Code commands.
 */
export const CODE_CHROME_COMMAND_ALLOWLIST: readonly string[] = [
  ...CODE_ACTIVITY_ITEMS.map((item) => item.commandId),
  ...Object.values(CODE_CHROME_COMMANDS),
];

export function isAllowedChromeCommand(commandId: string): boolean {
  return CODE_CHROME_COMMAND_ALLOWLIST.includes(commandId);
}

export const DEFAULT_CODE_CHROME_STATE: CodeChromeState = {
  activeViewId: null,
  panelOpen: false,
  dirtyCount: 0,
  branch: null,
};

// ----------------------------------------------------------------------------
// Control-channel protocol (loopback WebSocket between Electron main and the
// integration extension running in the Code-OSS extension host).
// ----------------------------------------------------------------------------

/** Messages sent from the broker (Electron main) → extension. */
export type CodeControlServerMessage = { type: "runCommand"; commandId: string };

/**
 * Messages sent from the extension → broker (Electron main). Both carry the
 * `projectId` (from the TABS_PROJECT_ID env the desktop sets per session) so
 * the broker can route commands/state to the right editor when several projects
 * share the one control channel. `projectId` may be empty if the env was unset.
 * `hello` additionally carries the per-launch auth `token`: the channel is a
 * raw loopback TCP socket (newline-delimited JSON), so authentication happens
 * in-band as the first message rather than in a URL.
 */
export type CodeControlClientMessage =
  | { type: "hello"; projectId: string; token: string }
  | { type: "chromeState"; projectId: string; state: CodeChromeState };

/**
 * Parse/validate an inbound control message from a JSON string. Returns null on
 * any malformed or unknown payload so callers can safely ignore junk without
 * throwing. Used on both ends of the loopback channel.
 */
export function parseCodeControlClientMessage(raw: string): CodeControlClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const projectId = typeof record.projectId === "string" ? record.projectId : "";
  if (record.type === "hello") {
    const token = typeof record.token === "string" ? record.token : "";
    return { type: "hello", projectId, token };
  }
  if (record.type === "chromeState") {
    return { type: "chromeState", projectId, state: coerceChromeState(record.state) };
  }
  return null;
}

export function parseCodeControlServerMessage(raw: string): CodeControlServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.type === "runCommand" && typeof record.commandId === "string") {
    return { type: "runCommand", commandId: record.commandId };
  }
  return null;
}

/** Coerce an untrusted value into a CodeChromeState, filling defaults. */
export function coerceChromeState(value: unknown): CodeChromeState {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_CODE_CHROME_STATE };
  const record = value as Record<string, unknown>;
  const activeViewId =
    typeof record.activeViewId === "string" &&
    CODE_ACTIVITY_ITEMS.some((item) => item.id === record.activeViewId)
      ? (record.activeViewId as CodeActivityViewId)
      : null;
  return {
    activeViewId,
    panelOpen: record.panelOpen === true,
    dirtyCount:
      typeof record.dirtyCount === "number" && Number.isFinite(record.dirtyCount)
        ? Math.max(0, Math.floor(record.dirtyCount))
        : 0,
    branch: typeof record.branch === "string" && record.branch.length > 0 ? record.branch : null,
  };
}

/**
 * Derive the basename shown in the header from an absolute file path. Returns an
 * empty string for nullish/empty input. Handles both POSIX and Windows
 * separators so it is correct regardless of the host platform.
 */
export function deriveActiveFileName(path: string | null | undefined): string {
  if (!path) return "";
  const trimmed = path.replace(/[\\/]+$/, "");
  const lastSep = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return lastSep === -1 ? trimmed : trimmed.slice(lastSep + 1);
}
