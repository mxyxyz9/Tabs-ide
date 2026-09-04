import * as OS from "node:os";

import type { ServerSupportBundleResult, ServerTraceDiagnosticsResult } from "@tabs/contracts";

import { readProcessDiagnostics, readProcessResourceHistory } from "./ProcessDiagnostics.ts";

export function redactSupportBundleText(text: string): string {
  const home = OS.homedir();
  return text
    .replaceAll(home, "<home>")
    .replace(
      /\b(?:Bearer\s+)?(?:gh[opsu]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{32,})\b/giu,
      "<redacted-token>",
    )
    .replace(/([?&](?:token|key|secret|code|credential)=)[^&\s"]+/giu, "$1<redacted>");
}

export async function createSupportBundle(input: {
  readonly environmentId: string;
  readonly appVersion: string;
  readonly traces: ServerTraceDiagnosticsResult;
}): Promise<ServerSupportBundleResult> {
  const [processes, history] = await Promise.all([
    readProcessDiagnostics(),
    readProcessResourceHistory({ windowMs: 60 * 60_000, bucketMs: 30_000 }),
  ]);
  const generatedAt = new Date().toISOString();
  const content = redactSupportBundleText(
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt,
        environmentId: input.environmentId,
        appVersion: input.appVersion,
        platform: { platform: process.platform, arch: process.arch, node: process.version },
        processes,
        processHistory: history,
        traces: input.traces,
      },
      null,
      2,
    ),
  );
  const day = generatedAt.slice(0, 10);
  return {
    filename: `tabs-support-${day}.json`,
    mediaType: "application/json",
    byteLength: new TextEncoder().encode(content).byteLength,
    content,
  };
}
