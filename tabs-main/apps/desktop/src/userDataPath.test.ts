import { describe, expect, it, vi } from "vitest";
import {
  CANONICAL_DEV_DIR_NAME,
  CANONICAL_PROD_DIR_NAME,
  FsProbe,
  resolveUserDataPathWithFs,
} from "./userDataPath";

function createMockFs(files: Record<string, string[] | "file" | "symlink">): FsProbe {
  return {
    existsSync: (path: string) => path in files,
    readdirSync: (path: string) => {
      const entry = files[path];
      if (Array.isArray(entry)) return entry;
      throw new Error(`ENOTDIR: not a directory, ${path}`);
    },
    statSync: (path: string) => {
      const entry = files[path];
      if (!entry) throw new Error(`ENOENT: no such file or directory, ${path}`);
      return {
        isDirectory: () => Array.isArray(entry),
      };
    },
    lstatSync: (path: string) => {
      const entry = files[path];
      if (!entry) throw new Error(`ENOENT: no such file or directory, ${path}`);
      return {
        isDirectory: () => Array.isArray(entry),
        isSymbolicLink: () => entry === "symlink",
      };
    },
  };
}

describe("Linux and multi-platform userData continuity", () => {
  const homedir = "/home/testuser";
  const defaultBase = "/home/testuser/.config";

  it("uses canonical production 'tabs' on Linux when newly installed", () => {
    const fs = createMockFs({});
    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      fs,
    });
    expect(resolved).toBe(`${defaultBase}/${CANONICAL_PROD_DIR_NAME}`);
  });

  it("uses canonical production 'tabs' when populated, even if legacy directory also exists", () => {
    const warn = vi.fn();
    const fs = createMockFs({
      [`${defaultBase}/tabs`]: ["Cookies", "Preferences"],
      [`${defaultBase}/Tabs (Alpha)`]: ["OldCookies"],
    });

    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      fs,
      logger: { warn },
    });

    // Never overwrites or merges into populated canonical directory
    expect(resolved).toBe(`${defaultBase}/tabs`);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Active canonical profile at tabs found alongside legacy directory (Tabs (Alpha))",
      ),
    );
  });

  it("safely reuses single verified legacy 'Tabs (Alpha)' when canonical is missing", () => {
    const info = vi.fn();
    const fs = createMockFs({
      [`${defaultBase}/Tabs (Alpha)`]: ["Cookies", "Partitions", "Local Storage"],
    });

    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      fs,
      logger: { warn: vi.fn(), info },
    });

    expect(resolved).toBe(`${defaultBase}/Tabs (Alpha)`);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("reusing verified legacy profile directory Tabs (Alpha)"),
    );
  });

  it("safely reuses single verified legacy 'Tabs' (Electron default) when canonical is missing", () => {
    const info = vi.fn();
    const fs = createMockFs({
      [`${defaultBase}/Tabs`]: ["Cookies", "Partitions"],
    });

    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      fs,
      logger: { warn: vi.fn(), info },
    });

    expect(resolved).toBe(`${defaultBase}/Tabs`);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("reusing verified legacy profile directory Tabs"),
    );
  });

  it("chooses deterministic safe priority when multiple legacy directories exist and does not merge them", () => {
    const warn = vi.fn();
    const fs = createMockFs({
      [`${defaultBase}/Tabs (Alpha)`]: ["AlphaCookies"],
      [`${defaultBase}/Tabs`]: ["LegacyCookies"],
    });

    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      fs,
      logger: { warn },
    });

    // Priority 1: Tabs (Alpha)
    expect(resolved).toBe(`${defaultBase}/Tabs (Alpha)`);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Selecting Tabs (Alpha) deterministically without merging"),
    );
  });

  it("isolates development profiles from production profiles on Linux", () => {
    const fsDev = createMockFs({
      [`${defaultBase}/Tabs (Dev)`]: ["DevCookies"],
      [`${defaultBase}/Tabs (Alpha)`]: ["ProdCookies"],
    });

    const resolvedDev = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      isDevelopment: true,
      fs: fsDev,
    });
    expect(resolvedDev).toBe(`${defaultBase}/Tabs (Dev)`);

    const resolvedProd = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      isDevelopment: false,
      fs: fsDev,
    });
    // Production ignores Tabs (Dev) and uses Tabs (Alpha)
    expect(resolvedProd).toBe(`${defaultBase}/Tabs (Alpha)`);
  });

  it("honors XDG_CONFIG_HOME on Linux", () => {
    const customConfig = "/mnt/shared/custom-xdg-config";
    const fs = createMockFs({});

    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      env: { XDG_CONFIG_HOME: customConfig },
      fs,
    });

    expect(resolved).toBe(`${customConfig}/tabs`);
  });

  it("respects case-sensitivity on Linux filesystems", () => {
    const fs = createMockFs({
      [`${defaultBase}/tabs`]: ["NewData"],
      [`${defaultBase}/Tabs`]: ["OldData"],
    });

    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      fs,
    });

    // Canonical lowercase 'tabs' is distinct from capitalized 'Tabs'
    expect(resolved).toBe(`${defaultBase}/tabs`);
  });

  it("rejects symlinks for populated legacy directories to prevent symlink traversal", () => {
    const fs = createMockFs({
      [`${defaultBase}/Tabs (Alpha)`]: "symlink",
    });

    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      homedir,
      fs,
    });

    // Does not follow symlink as a populated directory, falls back to canonical
    expect(resolved).toBe(`${defaultBase}/tabs`);
  });

  it("resolves Windows user data path under %APPDATA%", () => {
    const fs = createMockFs({});
    const resolved = resolveUserDataPathWithFs({
      platform: "win32",
      env: { APPDATA: "C:\\Users\\testuser\\AppData\\Roaming" },
      homedir: "C:\\Users\\testuser",
      fs,
    });

    expect(resolved).toBe("C:\\Users\\testuser\\AppData\\Roaming\\tabs");
  });

  it("resolves macOS user data path under Library/Application Support", () => {
    const fs = createMockFs({});
    const resolved = resolveUserDataPathWithFs({
      platform: "darwin",
      homedir: "/Users/testuser",
      fs,
    });

    expect(resolved).toBe("/Users/testuser/Library/Application Support/tabs");
  });

  it("honors explicit TABS_DESKTOP_USER_DATA_DIR override across all platforms", () => {
    const override = "/opt/tabs-custom-data";
    const resolved = resolveUserDataPathWithFs({
      platform: "linux",
      configuredPath: override,
    });
    expect(resolved).toBe(override);
  });
});
