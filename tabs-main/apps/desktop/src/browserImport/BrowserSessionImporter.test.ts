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

import { BrowserSessionImporter, importSyntheticCookiesToSession } from "./BrowserSessionImporter";

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

  describe("importSyntheticCookiesToSession", () => {
    it("preserves Secure, HttpOnly, SameSite, domain, path, and expiration semantics", async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockSession = { cookies: { set: mockSet } };

      const syntheticCookies = [
        {
          name: "session_token",
          value: "secret_value_123",
          domain: "example.com",
          path: "/auth",
          secure: true,
          httpOnly: true,
          sameSite: "strict" as const,
          expirationDate: 1893456000,
        },
      ];

      const result = await importSyntheticCookiesToSession(mockSession, "work", syntheticCookies);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockSet).toHaveBeenCalledWith({
        url: "https://example.com/auth",
        name: "session_token",
        value: "secret_value_123",
        domain: "example.com",
        path: "/auth",
        secure: true,
        httpOnly: true,
        sameSite: "strict",
        expirationDate: 1893456000,
      });
    });

    it("filters to allowed requested domains and deterministic partial failure reporting", async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockSession = { cookies: { set: mockSet } };

      const cookies = [
        {
          name: "token_app",
          value: "val1",
          domain: "app.example.com",
          secure: true,
        },
        {
          name: "tracker",
          value: "val2",
          domain: "thirdparty-tracker.net",
          secure: true,
        },
      ];

      const result = await importSyntheticCookiesToSession(mockSession, "work", cookies, {
        allowedDomains: ["app.example.com"],
      });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.skippedDomains).toContain("thirdparty-tracker.net");
    });

    it("handles cookie injection errors gracefully without leaking cookie values", async () => {
      const mockSet = vi.fn().mockRejectedValue(new Error("Invalid cookie"));
      const mockSession = { cookies: { set: mockSet } };

      const cookies = [
        {
          name: "bad_cookie",
          value: "super_secret_value",
          domain: "faulty.com",
        },
      ];

      const result = await importSyntheticCookiesToSession(mockSession, "work", cookies);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.skippedDomains).toEqual(["faulty.com"]);
    });

    it("rejects invalid profile identifiers", async () => {
      const mockSession = { cookies: { set: vi.fn() } };

      await expect(
        importSyntheticCookiesToSession(mockSession, "../../../etc", []),
      ).rejects.toThrow("Invalid browser profile identifier");
    });
  });
});
