import * as FS from "node:fs/promises";
import * as Os from "node:os";
import * as Path from "node:path";
import { describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  fromPartition: vi.fn(() => ({
    cookies: {
      get: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockResolvedValue(undefined),
    },
  })),
}));

vi.mock("electron", () => ({
  session: {
    fromPartition: electronMocks.fromPartition,
  },
}));

import { BrowserSessionImporter } from "./BrowserSessionImporter";

describe("BrowserSessionImporter", () => {
  it("detects running browser and flags unavailable as browserRunning", async () => {
    const mockRunningFn = vi.fn().mockResolvedValue(true);
    const importer = new BrowserSessionImporter("darwin", mockRunningFn);

    // Mock directory check for Google Chrome
    const home = Os.homedir();
    const chromeDir = Path.join(home, "Library/Application Support/Google/Chrome");
    let hasChrome = false;
    try {
      const stat = await FS.stat(chromeDir);
      hasChrome = stat.isDirectory();
    } catch {
      hasChrome = false;
    }

    if (hasChrome) {
      const sources = await importer.listSources();
      const chromeSource = sources.find((s) => s.id === "chrome");
      if (chromeSource) {
        expect(chromeSource.unavailable).toBe("browserRunning");
      }
    }
  });

  it("refuses to import if browser is currently running", async () => {
    const mockRunningFn = vi.fn().mockResolvedValue(true);
    const importer = new BrowserSessionImporter("darwin", mockRunningFn);

    await expect(
      importer.importSelectedCookies({
        sourceId: "chrome",
        sourceProfileDirectory: "Default",
        targetProfileId: "imported-chrome",
      }),
    ).rejects.toThrow("Please quit the browser first");
  });

  it("rejects unknown profile directories instead of allowing path traversal", async () => {
    const mockRunningFn = vi.fn().mockResolvedValue(false);
    const importer = new BrowserSessionImporter("darwin", mockRunningFn);

    await expect(
      importer.importSelectedCookies({
        sourceId: "chrome",
        sourceProfileDirectory: "../../../../etc",
        targetProfileId: "imported-chrome",
      }),
    ).rejects.toThrow("Selected browser profile was not found");
    expect(electronMocks.fromPartition).not.toHaveBeenCalled();
  });
});
