import type {
  TestingLocatorCoverageMode,
  TestingLocatorEntry,
  TestingLocatorVerificationStatus,
} from "@tabs/contracts";

import type { LocatorCandidate } from "./locatorLibrary";
import {
  extractAccessibilityYaml,
  extractPageUrl,
  type PlaywrightMcpSession,
} from "./playwrightMcp";
import {
  normalizeAccessibilityForStorage,
  redactCredentialLikeText,
  sanitizeAccessibilitySnapshot,
  structuralHash,
  tokenizePii,
} from "./security";

const ACTION_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem",
]);
const ASSERTION_ROLES = new Set([
  "alert",
  "alertdialog",
  "dialog",
  "heading",
  "log",
  "progressbar",
  "status",
  "table",
  "tabpanel",
]);
const SNAPSHOT_NODE = /^\s*-\s+([a-z]+)(?:\s+"((?:[^"\\]|\\.)*)")?/i;

function candidateKey(role: string, name: string, index: number): string {
  const base = `${role}-${name || "unnamed"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return index === 0 ? base : `${base}-${index + 1}`;
}

function classificationForRole(role: string): TestingLocatorEntry["classification"] {
  if (ACTION_ROLES.has(role)) return "action";
  if (ASSERTION_ROLES.has(role)) return "assertion";
  return "content";
}

export interface LocatorCaptureSnapshot {
  readonly rawUrl: string;
  readonly fingerprint: string;
  readonly storedSnapshot: string;
  readonly observedElements: number;
  readonly truncatedElements: number;
  readonly candidates: ReadonlyArray<LocatorCandidate>;
  readonly matchCounts: ReadonlyMap<string, number>;
  readonly injectionFlags: ReadonlyArray<string>;
}

export function locatorCandidatesFromSnapshot(input: {
  readonly projectId: string;
  readonly snapshot: string;
  readonly coverage: TestingLocatorCoverageMode;
  readonly maxElements: number;
  readonly taskContext?: string;
}): Omit<LocatorCaptureSnapshot, "rawUrl" | "fingerprint"> {
  const sanitized = sanitizeAccessibilitySnapshot(input.snapshot, { maxDepth: 12 });
  const tokenized = tokenizePii(input.projectId, redactCredentialLikeText(sanitized.sanitized));
  const storedSnapshot = normalizeAccessibilityForStorage(tokenized.tokenized);
  const nodes: Array<{ role: string; name: string }> = [];
  for (const line of storedSnapshot.split("\n")) {
    const match = SNAPSHOT_NODE.exec(line);
    if (!match?.[1]) continue;
    const role = match[1].toLowerCase();
    const name = (match[2] ?? "").replace(/\\"/g, '"').trim();
    const classification = classificationForRole(role);
    if (input.coverage === "actions-only" && classification !== "action") continue;
    if (input.coverage === "actions-assertions" && classification === "content") continue;
    if (!name && input.coverage !== "everything-accessible") continue;
    nodes.push({ role, name });
  }
  const taskWords = new Set(
    (input.taskContext ?? "")
      .toLocaleLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3),
  );
  const scopedNodes =
    taskWords.size === 0
      ? nodes
      : nodes.filter((node) => {
          const words = `${node.role} ${node.name}`.toLocaleLowerCase().split(/[^a-z0-9]+/);
          return words.some((word) => taskWords.has(word));
        });
  const matchCounts = new Map<string, number>();
  for (const node of scopedNodes) {
    const signature = `${node.role}\0${node.name.toLocaleLowerCase()}`;
    matchCounts.set(signature, (matchCounts.get(signature) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const candidates = scopedNodes.slice(0, input.maxElements).map((node) => {
    const signature = `${node.role}\0${node.name.toLocaleLowerCase()}`;
    const duplicateIndex = seen.get(signature) ?? 0;
    seen.set(signature, duplicateIndex + 1);
    return {
      locatorKey: candidateKey(node.role, node.name, duplicateIndex),
      classification: classificationForRole(node.role),
      strategy: "role" as const,
      arguments: { role: node.role, ...(node.name ? { name: node.name } : {}) },
      semanticContext: `${node.role}${node.name ? ` ${node.name}` : ""}`,
      source: "discovered" as const,
      fragile: (matchCounts.get(signature) ?? 0) > 1,
      // Discovery proposes candidates. A human chooses which entries become
      // part of the generated page object, including candidates that happen
      // to resolve uniquely in the capture environment.
      lifecycleStatus: "draft" as const,
    };
  });
  return {
    storedSnapshot,
    observedElements: scopedNodes.length,
    truncatedElements: Math.max(0, scopedNodes.length - candidates.length),
    candidates,
    matchCounts,
    injectionFlags: sanitized.flags,
  };
}

export async function captureLocatorSnapshot(input: {
  readonly projectId: string;
  readonly session: PlaywrightMcpSession;
  readonly coverage: TestingLocatorCoverageMode;
  readonly maxElements: number;
  readonly fallbackUrl: string;
  readonly taskContext?: string;
}): Promise<LocatorCaptureSnapshot> {
  const response = await input.session.call("browser_snapshot", { depth: 12, boxes: true });
  const rawSnapshot = extractAccessibilityYaml(response);
  const parsed = locatorCandidatesFromSnapshot({
    projectId: input.projectId,
    snapshot: rawSnapshot,
    coverage: input.coverage,
    maxElements: input.maxElements,
    ...(input.taskContext ? { taskContext: input.taskContext } : {}),
  });
  return {
    ...parsed,
    rawUrl: extractPageUrl(response) ?? input.fallbackUrl,
    fingerprint: structuralHash(parsed.storedSnapshot),
  };
}

export function countLocatorMatches(
  snapshot: string,
  entry: Pick<TestingLocatorEntry, "strategy" | "arguments">,
): number {
  const strategy = entry.strategy;
  const args = entry.arguments;
  if (strategy === "role") {
    const role = String(args.role ?? "").toLowerCase();
    const name = String(args.name ?? "").toLocaleLowerCase();
    let count = 0;
    for (const line of snapshot.split("\n")) {
      const match = SNAPSHOT_NODE.exec(line);
      if (!match?.[1] || match[1].toLowerCase() !== role) continue;
      const candidateName = (match[2] ?? "").replace(/\\"/g, '"').trim().toLocaleLowerCase();
      if (!name || candidateName === name) count += 1;
    }
    return count;
  }
  const expected = String(
    args.label ??
      args.testId ??
      args.placeholder ??
      args.altText ??
      args.title ??
      args.text ??
      args.selector ??
      "",
  ).toLocaleLowerCase();
  if (!expected) return 0;
  return snapshot.split("\n").filter((line) => line.toLocaleLowerCase().includes(expected)).length;
}

export function verificationStatusForCount(count: number): TestingLocatorVerificationStatus {
  if (count === 0) return "missing";
  if (count === 1) return "verified";
  return "ambiguous";
}
