import type { ResourceAttributionEntry, ResourceAttributionSnapshot } from "@tabs/contracts";
import * as DateTime from "effect/DateTime";

export interface ResourceAttributionRecord {
  readonly component: string;
  readonly operation: string;
  readonly logicalReadBytes?: number;
  readonly logicalWriteBytes?: number;
  readonly count?: number;
  readonly durationMs?: number;
}

const entries = new Map<string, ResourceAttributionEntry>();

function key(component: string, operation: string): string {
  return `${component}\u0000${operation}`;
}

export function recordResourceAttribution(input: ResourceAttributionRecord): void {
  const entryKey = key(input.component, input.operation);
  const existing = entries.get(entryKey);
  entries.set(entryKey, {
    component: input.component,
    operation: input.operation,
    logicalReadBytes:
      (existing?.logicalReadBytes ?? 0) + Math.max(0, Math.round(input.logicalReadBytes ?? 0)),
    logicalWriteBytes:
      (existing?.logicalWriteBytes ?? 0) + Math.max(0, Math.round(input.logicalWriteBytes ?? 0)),
    count: (existing?.count ?? 0) + Math.max(0, Math.round(input.count ?? 1)),
    durationMs: (existing?.durationMs ?? 0) + Math.max(0, Math.round(input.durationMs ?? 0)),
  });
}

export function readResourceAttributionSnapshot(): ResourceAttributionSnapshot {
  return {
    readAt: DateTime.nowUnsafe(),
    entries: [...entries.values()].sort((a, b) => b.logicalWriteBytes - a.logicalWriteBytes),
  };
}

export function resetResourceAttribution(): void {
  entries.clear();
}
