import type { Debugger, WebContents } from "electron";

export type CdpOwner = "none" | "automation" | "emulation" | "devtools" | "recording";

/**
 * Coordinated owner for debugger/CDP operations across automation,
 * DevTools, emulation, snapshots, and recording.
 *
 * Prevents "Already attached" collisions, safely coordinates with
 * DevTools opening/closing, and handles unexpected detach events.
 */
export class BrowserCdpCoordinator {
  private owner: CdpOwner = "none";
  private isAttached = false;
  private devToolsOpen = false;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly contents: WebContents) {
    if (!contents.isDestroyed() && contents.debugger) {
      contents.debugger.on("detach", (_event, reason) => {
        this.isAttached = false;
        this.owner = "none";
      });
    }
  }

  handleDevToolsOpened(): void {
    this.devToolsOpen = true;
    this.owner = "devtools";
  }

  prepareForDevTools(): void {
    this.detach();
    this.handleDevToolsOpened();
  }

  handleDevToolsClosed(): void {
    this.devToolsOpen = false;
    if (this.owner === "devtools") {
      this.owner = "none";
    }
  }

  handleDetach(_reason?: string): void {
    this.isAttached = false;
    this.owner = "none";
  }

  get currentOwner(): CdpOwner {
    return this.owner;
  }

  get attached(): boolean {
    return (
      this.isAttached ||
      (this.contents && !this.contents.isDestroyed() && this.contents.debugger.isAttached())
    );
  }

  /**
   * Executes a scoped CDP command block with coordinated debugger ownership.
   */
  async withSession<T>(
    owner: "automation" | "emulation" | "recording",
    fn: (debuggerApi: Debugger) => Promise<T>,
  ): Promise<T> {
    // Reserve a queue slot before yielding, including when the previous operation fails.
    const previous = this.operationQueue;
    let release!: () => void;
    this.operationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.runSession(owner, fn);
    } finally {
      release();
    }
  }

  private async runSession<T>(
    owner: "automation" | "emulation" | "recording",
    fn: (debuggerApi: Debugger) => Promise<T>,
  ): Promise<T> {
    if (this.contents.isDestroyed()) {
      throw new Error("Cannot perform CDP operation: WebContents is destroyed.");
    }
    if (this.devToolsOpen) {
      throw new Error(
        "Cannot perform CDP operation while DevTools is open. Close DevTools and retry.",
      );
    }

    const dbg = this.contents.debugger;
    const wasAttached = dbg.isAttached();

    if (!wasAttached) {
      try {
        dbg.attach("1.3");
        this.isAttached = true;
        this.owner = owner;
      } catch (err) {
        if (!dbg.isAttached()) {
          throw new Error(
            `Failed to attach debugger for ${owner}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    try {
      return await fn(dbg);
    } finally {
      // If we attached specifically for this operation and DevTools is not using it,
      // release cleanly to avoid holding the debugger lock.
      if (!wasAttached && !this.devToolsOpen) {
        try {
          if (dbg.isAttached()) {
            dbg.detach();
          }
        } catch {
          // Non-fatal if already detached
        }
        this.isAttached = false;
        this.owner = "none";
      }
    }
  }

  detach(): void {
    if (this.contents.isDestroyed()) return;
    try {
      if (this.contents.debugger?.isAttached()) {
        this.contents.debugger.detach();
      }
    } catch {
      // Ignore
    }
    this.isAttached = false;
    this.owner = "none";
  }
}
