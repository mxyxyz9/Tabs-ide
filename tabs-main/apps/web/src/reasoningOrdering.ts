import type { ProviderOptionChoice, ProviderOptionDescriptor } from "@tabs/contracts";

export const REASONING_LEVEL_RANKS: Readonly<Record<string, number>> = {
  none: 0,
  low: 10,
  minimal: 15,
  medium: 20,
  high: 30,
  xhigh: 40,
  max: 50,
  ultra: 60,
  ultracode: 70,
  ultrathink: 80,
};

/**
 * Returns numeric rank for known reasoning IDs, or a default high value for unknown IDs so they sort after known levels.
 */
export function getReasoningChoiceRank(id: string): number {
  const normalized = id.toLowerCase();
  if (normalized in REASONING_LEVEL_RANKS) {
    return REASONING_LEVEL_RANKS[normalized]!;
  }
  return 1000;
}

/**
 * Sorts reasoning choices dynamically while preserving full `ProviderOptionChoice` objects and metadata.
 * Known level IDs are sorted according to `REASONING_LEVEL_RANKS`.
 * Unknown level IDs are never discarded; they are sorted after known IDs deterministically.
 */
export function sortReasoningChoices<T extends { id: string }>(choices: ReadonlyArray<T>): T[] {
  if (!choices || choices.length <= 1) return [...choices];

  return [...choices].sort((a, b) => {
    const rankA = getReasoningChoiceRank(a.id);
    const rankB = getReasoningChoiceRank(b.id);

    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.id.localeCompare(b.id);
  });
}

export const DEFAULT_STANDARD_REASONING_CHOICES: ReadonlyArray<ProviderOptionChoice> = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra High" },
  { id: "max", label: "Max" },
  { id: "ultra", label: "Ultra" },
];

/**
 * Collects, deduplicates, and sorts unique reasoning effort choices across multiple provider option descriptor sets.
 * Operates purely on `ProviderOptionDescriptor` collections with zero coupling to model or provider types.
 * Falls back to standard default reasoning choices if no descriptors specify explicit options.
 */
export function collectReasoningChoices(
  descriptorSets: ReadonlyArray<ReadonlyArray<ProviderOptionDescriptor>>,
): ProviderOptionChoice[] {
  if (!descriptorSets || descriptorSets.length === 0) {
    return [...DEFAULT_STANDARD_REASONING_CHOICES];
  }

  const choicesMap = new Map<string, ProviderOptionChoice>();

  for (const descriptors of descriptorSets) {
    const primary = descriptors.find(
      (d) =>
        d.id === "reasoningEffort" ||
        d.id === "effort" ||
        d.id === "reasoning" ||
        d.id === "variant" ||
        d.id.toLowerCase().includes("effort") ||
        d.id.toLowerCase().includes("reasoning") ||
        d.id.toLowerCase().includes("variant"),
    );

    if (primary && primary.type === "select" && Array.isArray(primary.options)) {
      for (const choice of primary.options) {
        if (choice && choice.id && !choicesMap.has(choice.id)) {
          choicesMap.set(choice.id, choice);
        }
      }
    }
  }

  if (choicesMap.size === 0) {
    return [...DEFAULT_STANDARD_REASONING_CHOICES];
  }

  return sortReasoningChoices(Array.from(choicesMap.values()));
}

/**
 * Splits and formats thinking level labels for multi-line display to prevent header text overlap in matrix grids.
 * Compound terms like `Ultrathink`, `Ultracode`, and `ExtraHigh` are split across multiple lines cleanly.
 */
export function formatThinkingHeaderWords(stop: { id: string; label?: string }): string[] {
  const raw = (stop.label || stop.id).trim();
  const normalized = raw
    .replace(/^ultra[-_]?think$/i, "Ultra Think")
    .replace(/^ultra[-_]?code(r?)$/i, "Ultra Code$1")
    .replace(/^extra[-_]?high$/i, "Extra High")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ");

  const words = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toUpperCase());

  if (words.length <= 2) {
    return words;
  }
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

