import * as FS from "node:fs/promises";
import * as Os from "node:os";
import * as Path from "node:path";
import { DatabaseSync } from "node:sqlite";

/** A cookie in the shape Electron's `session.cookies.set` accepts. */
export interface ImportedCookie {
  readonly url: string;
  readonly name: string;
  readonly value: string;
  /**
   * Set only for domain cookies, which the sources mark with a leading dot.
   * A host-only cookie leaves this undefined: Electron treats any `domain` it
   * is given as marking a domain cookie and re-adds the dot, which would widen
   * the cookie to every subdomain of the host it was scoped to, and rejects
   * `__Host-` cookies, which require it to be absent.
   */
  readonly domain: string | undefined;
  readonly path: string;
  readonly secure: boolean;
  readonly httpOnly: boolean;
  /** Seconds since the UNIX epoch, or undefined for a session cookie. */
  readonly expirationDate: number | undefined;
  readonly sameSite: "unspecified" | "no_restriction" | "lax" | "strict";
}

/**
 * Cookies recovered from one database and rows that could not be decrypted.
 * The skipped count reaches the user instead of disappearing from a partial
 * import result.
 */
export interface CookieReadResult {
  readonly cookies: readonly ImportedCookie[];
  readonly undecryptable: number;
  /** Distinct hosts of the rows that could not be decrypted. */
  readonly undecryptableHosts: readonly string[];
}

/** A host without the leading dot both engines put on a domain cookie, for display. */
export function bareHost(host: string): string {
  return host.startsWith(".") ? host.slice(1) : host;
}

/**
 * The URL and domain Electron should register a stored row under.
 *
 * Both engines mark a domain cookie with a leading dot on the host. Electron
 * matches on a URL, so the dot comes off for that; `domain` is passed through
 * only for domain cookies, because supplying it at all makes Electron treat
 * the cookie as one and re-add the dot — widening a host-only cookie to every
 * subdomain of the host it was scoped to, and rejecting `__Host-` cookies,
 * which require it to be absent.
 */
export function cookieScope(
  host: string,
  path: string,
  secure: boolean,
): { readonly url: string; readonly domain: string | undefined } {
  const isDomainCookie = host.startsWith(".");
  const unwrappedHost = bareHost(host);
  const authority =
    unwrappedHost.includes(":") && !(unwrappedHost.startsWith("[") && unwrappedHost.endsWith("]"))
      ? `[${unwrappedHost}]`
      : unwrappedHost;
  const cleanPath = path && path.startsWith("/") ? path : `/${path || ""}`;
  return {
    url: `${secure ? "https" : "http"}://${authority}${cleanPath}`,
    domain: isDomainCookie ? host : undefined,
  };
}

export interface DatabaseSnapshot {
  readonly path: string;
  readonly cleanup: () => Promise<void>;
}

/**
 * Creates a transactionally consistent snapshot of a cookie database in a
 * temporary directory and returns the snapshot path and cleanup handler.
 *
 * Both engines keep the file open with WAL while the browser runs, so reading
 * in place can observe a torn write. Copying also guarantees we never open the
 * browser's own file for writing.
 */
export async function snapshotCookieDatabase(
  cookiePath: string,
  tempPrefix = "tabs-cookie-import-",
): Promise<DatabaseSnapshot> {
  const tempDir = await FS.mkdtemp(Path.join(Os.tmpdir(), tempPrefix));
  const target = Path.join(tempDir, Path.basename(cookiePath));

  const cleanup = async () => {
    try {
      await FS.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors on temp directories
    }
  };

  // First try SQLite VACUUM INTO if possible, which produces a clean standalone checkpoint.
  let vacuumSucceeded = false;
  try {
    const db = new DatabaseSync(cookiePath, { readOnly: true });
    try {
      db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
      vacuumSucceeded = true;
    } finally {
      db.close();
    }
  } catch {
    vacuumSucceeded = false;
  }

  if (!vacuumSucceeded) {
    // Fallback to file copy, including WAL and SHM files if present
    await FS.copyFile(cookiePath, target);
    for (const ext of ["-wal", "-shm"]) {
      try {
        await FS.copyFile(`${cookiePath}${ext}`, `${target}${ext}`);
      } catch {
        // WAL/SHM might not exist, which is normal
      }
    }
  }

  return { path: target, cleanup };
}
