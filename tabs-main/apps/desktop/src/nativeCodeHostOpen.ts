import { fileURLToPath } from "node:url";

type UriLike = {
  scheme?: unknown;
  authority?: unknown;
  path?: unknown;
  fsPath?: unknown;
};

export type NativeCodeOpenTarget =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "folder"; readonly path: string }
  | { readonly kind: "workspace"; readonly path: string };

export function filePathFromNativeUri(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const uri = value as UriLike;
  if (typeof uri.fsPath === "string" && uri.fsPath.length > 0) return uri.fsPath;
  if (uri.scheme !== "file" || typeof uri.path !== "string") return null;
  try {
    const authority = typeof uri.authority === "string" ? uri.authority : "";
    return fileURLToPath(new URL(`file://${authority}${uri.path}`));
  } catch {
    return null;
  }
}

export function getNativeCodeOpenTargets(openables: unknown): NativeCodeOpenTarget[] {
  if (!Array.isArray(openables)) return [];
  const targets: NativeCodeOpenTarget[] = [];
  for (const openable of openables) {
    if (!openable || typeof openable !== "object") continue;
    const candidate = openable as Record<string, unknown>;
    const filePath = filePathFromNativeUri(candidate.fileUri);
    if (filePath) {
      targets.push({ kind: "file", path: filePath });
      continue;
    }
    const folderPath = filePathFromNativeUri(candidate.folderUri);
    if (folderPath) {
      targets.push({ kind: "folder", path: folderPath });
      continue;
    }
    const workspacePath = filePathFromNativeUri(candidate.workspaceUri);
    if (workspacePath) targets.push({ kind: "workspace", path: workspacePath });
  }
  return targets;
}
