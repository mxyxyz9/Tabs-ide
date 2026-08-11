import { createHash } from "node:crypto";

export interface AccessibilitySecurityResult {
  readonly sanitized: string;
  readonly flags: ReadonlyArray<string>;
}

export interface PiiToken {
  readonly token: string;
  readonly kind: string;
  readonly plaintext: string;
  readonly digest: string;
}

export interface TokenizationResult {
  readonly tokenized: string;
  readonly tokens: ReadonlyArray<PiiToken>;
}

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions?/i,
  /(?:system|developer)\s+(?:message|prompt|instruction)/i,
  /reveal|exfiltrate|send|upload/i,
  /(?:secret|credential|api[ _-]?key|password|token)/i,
  /you\s+are\s+(?:chatgpt|an?\s+ai|an?\s+assistant)/i,
] as const;

const ZERO_SIZE_PATTERN = /\[(?:box=[^\]]*,(?:0(?:\.0+)?),(?:0(?:\.0+)?)|size=0x0)\]/i;
const HIDDEN_PATTERN = /\[(?:hidden|aria-hidden=true|visible=false)\]/i;

function indentationDepth(line: string): number {
  const leadingSpaces = line.length - line.trimStart().length;
  return Math.floor(leadingSpaces / 2);
}

function looksInjected(line: string): boolean {
  let matches = 0;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(line)) matches += 1;
  }
  return matches >= 2;
}

export function sanitizeAccessibilitySnapshot(
  snapshot: string,
  options: { readonly maxDepth?: number } = {},
): AccessibilitySecurityResult {
  const maxDepth = options.maxDepth ?? 12;
  const flags: string[] = [];
  const keptLines: string[] = [];

  for (const line of snapshot.split("\n")) {
    if (indentationDepth(line) > maxDepth) {
      flags.push("max-depth-exceeded");
      continue;
    }
    if (ZERO_SIZE_PATTERN.test(line) || HIDDEN_PATTERN.test(line)) {
      flags.push("hidden-or-zero-size-element");
      continue;
    }
    if (looksInjected(line)) {
      flags.push(`possible-prompt-injection:${shortDigest(line)}`);
      continue;
    }
    keptLines.push(line.replace(/\s+$/u, ""));
  }

  return {
    sanitized: keptLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    flags: [...new Set(flags)],
  };
}

const PII_PATTERNS = [
  {
    kind: "EMAIL",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    kind: "HOST_IDENTITY",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\b/gi,
  },
  {
    kind: "CARD",
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
  },
  {
    kind: "PHONE",
    pattern: /(?<!\w)(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]?)\d{3,4}[ .-]?\d{4}(?!\w)/g,
  },
] as const;

export function tokenizePii(projectId: string, text: string): TokenizationResult {
  const discovered = new Map<string, PiiToken>();
  let tokenized = text;

  for (const { kind, pattern } of PII_PATTERNS) {
    tokenized = tokenized.replace(pattern, (plaintext) => {
      const normalized = plaintext.toLowerCase().replace(/[ -]/g, "");
      const digest = createHash("sha256")
        .update(`${projectId}\0${kind}\0${normalized}`)
        .digest("hex");
      const token = `<PII_${kind}_${digest.slice(0, 12)}>`;
      discovered.set(token, { token, kind, plaintext, digest });
      return token;
    });
  }

  return { tokenized, tokens: [...discovered.values()] };
}

export function normalizeStructuralSnapshot(snapshot: string): string {
  return snapshot
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "<VOLATILE_ID>")
    .replace(
      /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g,
      "<VOLATILE_TIME>",
    )
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "<VOLATILE_TIME>")
    .replace(
      /\b(?:session|request|trace|nonce)[-_ ]?(?:id)?[:= ]+[A-Za-z0-9_-]{6,}\b/gi,
      "<VOLATILE_ID>",
    )
    .replace(/\b(?:slide|item|page)\s+\d+\s+(?:of|\/)\s+\d+\b/gi, "<VOLATILE_CAROUSEL>")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAccessibilityForStorage(snapshot: string): string {
  return snapshot
    .replace(/\s+\[ref=[^\]]+\]/g, "")
    .replace(/\s+\[box=[^\]]+\]/g, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

export function shortDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function structuralHash(snapshot: string): string {
  return createHash("sha256").update(normalizeStructuralSnapshot(snapshot)).digest("hex");
}

export function splitStaticSubtrees(snapshot: string): ReadonlyArray<string> {
  const lines = snapshot.split("\n").filter((line) => line.trim().length > 0);
  const subtrees: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (indentationDepth(line) === 0 && current.length > 0) {
      subtrees.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) subtrees.push(current.join("\n"));
  return subtrees;
}
