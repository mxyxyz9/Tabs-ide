import {
  copyFileSync,
  cpSync,
  existsSync,
  readdirSync,
  readlinkSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";

export function sanitizeMacAppSymlinks(appPath: string): void {
  const resolvedAppPath = resolve(appPath);
  const queue = [resolvedAppPath];

  while (queue.length > 0) {
    const currentDir = queue.shift()!;
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          const target = readlinkSync(fullPath);
          const resolvedTarget = resolve(currentDir, target);

          if (!existsSync(resolvedTarget)) {
            unlinkSync(fullPath);
            continue;
          }

          const isInside =
            resolvedTarget === resolvedAppPath || resolvedTarget.startsWith(resolvedAppPath + sep);

          if (!isInside) {
            const stat = statSync(resolvedTarget);
            unlinkSync(fullPath);
            if (stat.isDirectory()) {
              cpSync(resolvedTarget, fullPath, { recursive: true, dereference: true });
              queue.push(fullPath);
            } else {
              copyFileSync(resolvedTarget, fullPath);
            }
          }
        } catch {
          try {
            unlinkSync(fullPath);
          } catch {}
        }
      } else if (entry.isDirectory()) {
        queue.push(fullPath);
      }
    }
  }
}
