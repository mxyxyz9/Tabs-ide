import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

export interface FsProbe {
  existsSync: (path: string) => boolean;
  readdirSync?: (path: string) => string[];
  statSync?: (path: string) => { isDirectory: () => boolean };
  lstatSync?: (path: string) => { isDirectory: () => boolean; isSymbolicLink: () => boolean };
}

export interface ResolveUserDataOptions {
  configuredPath?: string | undefined;
  platform?: NodeJS.Platform | undefined;
  env?: Record<string, string | undefined> | undefined;
  homedir?: string | undefined;
  isDevelopment?: boolean | undefined;
  fs?: FsProbe | undefined;
  logger?: {
    warn: (message: string) => void;
    info?: (message: string) => void;
  } | undefined;
}

export const CANONICAL_PROD_DIR_NAME = "tabs";
export const CANONICAL_DEV_DIR_NAME = "tabs-dev";

// Verified historical legacy directory names based on repository evidence:
// 1. "Tabs (Alpha)" - explicit legacy name in main.ts
// 2. "Tabs" - Electron default productName directory on Linux
// In development: "Tabs (Dev)"
export const VERIFIED_LEGACY_PROD_DIR_NAMES = ["Tabs (Alpha)", "Tabs"] as const;
export const VERIFIED_LEGACY_DEV_DIR_NAMES = ["Tabs (Dev)"] as const;

function isDirectoryEntry(path: string, fs: FsProbe): boolean {
  try {
    if (!fs.existsSync(path)) return false;
    if (fs.lstatSync) {
      const lstat = fs.lstatSync(path);
      if (lstat.isSymbolicLink()) return false;
      return lstat.isDirectory();
    }
    if (fs.statSync) {
      return fs.statSync(path).isDirectory();
    }
    return true;
  } catch {
    return false;
  }
}

function isPopulatedDirectory(dirPath: string, fs: FsProbe): boolean {
  try {
    if (!isDirectoryEntry(dirPath, fs)) return false;
    if (fs.readdirSync) {
      const entries = fs.readdirSync(dirPath);
      return entries.length > 0;
    }
    return true;
  } catch {
    return false;
  }
}

export function resolveUserDataPathWithFs(options: ResolveUserDataOptions = {}): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const pathUtil = platform === "win32" ? Path.win32 : Path.posix;

  const configuredPath = options.configuredPath ?? env.TABS_DESKTOP_USER_DATA_DIR?.trim();
  if (configuredPath) {
    return pathUtil.resolve(configuredPath);
  }

  const homedir = options.homedir ?? OS.homedir();
  const isDevelopment = options.isDevelopment ?? false;
  const fs: FsProbe = options.fs ?? FS;
  const logger = options.logger ?? console;

  const appDataBase =
    platform === "win32"
      ? env.APPDATA || pathUtil.join(homedir, "AppData", "Roaming")
      : platform === "darwin"
        ? pathUtil.join(homedir, "Library", "Application Support")
        : env.XDG_CONFIG_HOME?.trim() || pathUtil.join(homedir, ".config");

  const canonicalName = isDevelopment ? CANONICAL_DEV_DIR_NAME : CANONICAL_PROD_DIR_NAME;
  const canonicalPath = pathUtil.join(appDataBase, canonicalName);

  if (platform !== "linux") {
    const legacyName = isDevelopment ? "Tabs (Dev)" : "Tabs (Alpha)";
    const legacyPath = pathUtil.join(appDataBase, legacyName);
    if (isDirectoryEntry(legacyPath, fs) && !isDirectoryEntry(canonicalPath, fs)) {
      return legacyPath;
    }
    return canonicalPath;
  }

  // Linux continuity handling
  const canonicalPopulated = isPopulatedDirectory(canonicalPath, fs);
  const legacyNames = isDevelopment ? VERIFIED_LEGACY_DEV_DIR_NAMES : VERIFIED_LEGACY_PROD_DIR_NAMES;

  const populatedLegacyPaths: string[] = [];
  for (const name of legacyNames) {
    const candidatePath = pathUtil.join(appDataBase, name);
    if (isPopulatedDirectory(candidatePath, fs)) {
      populatedLegacyPaths.push(candidatePath);
    }
  }

  // Case A: Canonical is already populated -> always preserve canonical. Never overwrite or merge.
  if (canonicalPopulated) {
    if (populatedLegacyPaths.length > 0) {
      const legacyBaseNames = populatedLegacyPaths.map((p) => pathUtil.basename(p)).join(", ");
      logger.warn(
        `[userDataPath] Active canonical profile at ${canonicalName} found alongside legacy directory (${legacyBaseNames}). Using canonical profile without merging.`,
      );
    }
    return canonicalPath;
  }

  // Case B: Canonical is empty/missing, exactly one verified legacy directory has data -> reuse it safely.
  if (populatedLegacyPaths.length === 1) {
    const chosen = populatedLegacyPaths[0]!;
    logger.info?.(
      `[userDataPath] Canonical profile missing; reusing verified legacy profile directory ${pathUtil.basename(chosen)}.`,
    );
    return chosen;
  }

  // Case C: Canonical is empty/missing, but multiple legacy directories contain data.
  // Deterministic safe choice: choose first in priority order, never merge, and log diagnostic.
  if (populatedLegacyPaths.length > 1) {
    const chosen = populatedLegacyPaths[0]!;
    const allCandidates = populatedLegacyPaths.map((p) => pathUtil.basename(p)).join(", ");
    logger.warn(
      `[userDataPath] Multiple legacy profile directories found: [${allCandidates}]. Selecting ${pathUtil.basename(chosen)} deterministically without merging. To select a different directory, set TABS_DESKTOP_USER_DATA_DIR.`,
    );
    return chosen;
  }

  // Case D: Neither canonical nor any legacy directories are populated.
  // If an unpopulated legacy path exists and canonical does not, check if single legacy directory exists.
  const existingLegacyPaths = legacyNames
    .map((name) => pathUtil.join(appDataBase, name))
    .filter((p) => isDirectoryEntry(p, fs));

  if (!isDirectoryEntry(canonicalPath, fs) && existingLegacyPaths.length === 1) {
    return existingLegacyPaths[0]!;
  }

  return canonicalPath;
}

export function resolveUserDataPath(): string {
  const isDevelopment = Boolean(
    process.env.VITE_DEV_SERVER_URL || (typeof process !== "undefined" && !process.env.NODE_ENV),
  );
  return resolveUserDataPathWithFs({ isDevelopment });
}
