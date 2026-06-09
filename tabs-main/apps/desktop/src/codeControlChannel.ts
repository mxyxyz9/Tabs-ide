/**
 * Loopback control channel between the Electron main process and the bundled
 * `tabs-workbench-integration` extension running inside the Code-OSS extension
 * host.
 *
 * Why this exists: the native React chrome in the Tabs window (activity rail /
 * header / status bar) needs to drive the embedded VS Code (switch sidebar
 * view, toggle terminal, …) and reflect its state. The managed-server runtime
 * exposes no command accessor on the workbench window, so the only place we can
 * call `vscode.commands.executeCommand` is the extension host. Main is the
 * natural broker: it already owns the BrowserView and the desktopBridge IPC.
 *
 * Transport: a `ws` WebSocket server bound to 127.0.0.1 on an ephemeral port,
 * gated by a random token. The URL+token are handed to the extension via env
 * vars (it inherits the main process env through the spawned REH server). Only
 * one extension connection is kept (the most recent); commands are forwarded to
 * it and `chromeState` pushes are surfaced via `onChromeState`.
 *
 * Security: binds to loopback only, requires a per-launch token, and forwards
 * only allowlisted command ids (`CODE_CHROME_COMMAND_ALLOWLIST`). A compromised
 * renderer therefore cannot trigger arbitrary VS Code commands.
 */
import * as Crypto from "node:crypto";
import type { AddressInfo } from "node:net";

import { WebSocketServer, type WebSocket } from "ws";
import {
  CODE_CHROME_COMMAND_ALLOWLIST,
  parseCodeControlClientMessage,
  type CodeChromeState,
  type CodeControlServerMessage,
} from "@tabs/shared/codeChrome";

const CONTROL_PATH = "/code-control";

export class CodeControlChannel {
  private server: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private token = "";
  private port = 0;
  private chromeStateListener: ((state: CodeChromeState) => void) | null = null;

  /**
   * Start the loopback control server. Idempotent — repeated calls return the
   * already-resolved connection info. Resolves once the server is listening.
   */
  start(): Promise<{ url: string; token: string }> {
    if (this.server) {
      return Promise.resolve({ url: this.url(), token: this.token });
    }
    this.token = Crypto.randomBytes(24).toString("hex");
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0, path: CONTROL_PATH });
    this.server = server;

    server.on("connection", (socket, request) => {
      // Token check: reject connections without the exact per-launch token.
      const requestUrl = new URL(request.url ?? "", "ws://127.0.0.1");
      if (requestUrl.searchParams.get("token") !== this.token) {
        socket.close(1008, "invalid token");
        return;
      }
      // Keep only the most recent connection (one embedded workbench at a time).
      if (this.socket && this.socket !== socket) {
        try {
          this.socket.close(1000, "superseded");
        } catch {
          /* ignore */
        }
      }
      this.socket = socket;

      socket.on("message", (raw: unknown) => {
        const text =
          typeof raw === "string"
            ? raw
            : raw instanceof Buffer
              ? raw.toString("utf8")
              : Buffer.from(raw as ArrayBuffer).toString("utf8");
        const message = parseCodeControlClientMessage(text);
        if (!message) return;
        if (message.type === "chromeState") {
          this.chromeStateListener?.(message.state);
        }
      });
      socket.on("close", () => {
        if (this.socket === socket) {
          this.socket = null;
        }
      });
      socket.on("error", () => {
        if (this.socket === socket) {
          this.socket = null;
        }
      });
    });

    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", () => {
        this.port = (server.address() as AddressInfo).port;
        resolve({ url: this.url(), token: this.token });
      });
    });
  }

  /** Register the callback invoked whenever the extension pushes chrome state. */
  onChromeState(listener: (state: CodeChromeState) => void): void {
    this.chromeStateListener = listener;
  }

  /**
   * Forward an allowlisted command to the connected extension. Returns true if a
   * connection existed and the (allowed) command was sent.
   */
  runCommand(commandId: string): boolean {
    if (!CODE_CHROME_COMMAND_ALLOWLIST.includes(commandId)) {
      return false;
    }
    const socket = this.socket;
    if (!socket || socket.readyState !== socket.OPEN) {
      return false;
    }
    const message: CodeControlServerMessage = { type: "runCommand", commandId };
    socket.send(JSON.stringify(message));
    return true;
  }

  url(): string {
    return `ws://127.0.0.1:${this.port}${CONTROL_PATH}?token=${this.token}`;
  }

  dispose(): void {
    try {
      this.socket?.close();
    } catch {
      /* ignore */
    }
    this.socket = null;
    this.server?.close();
    this.server = null;
    this.chromeStateListener = null;
  }
}
