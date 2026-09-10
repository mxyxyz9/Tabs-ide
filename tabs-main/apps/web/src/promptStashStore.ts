import type { PersistedComposerImageAttachment } from "./composerDraftStore";
import { createMemoryStorage } from "./lib/storage";
import { create } from "zustand";

export const PROMPT_STASH_STORAGE_KEY = "tabs:prompt-stash:v1";
export const MAX_PROMPT_STASH_ENTRIES = 20;

export interface PromptStashEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly prompt: string;
  readonly attachments: ReadonlyArray<PersistedComposerImageAttachment>;
}

interface PromptStashState {
  readonly entries: ReadonlyArray<PromptStashEntry>;
  stash: (entry: PromptStashEntry) => PromptStashEntry | null;
  take: (id: string) => PromptStashEntry | null;
  remove: (id: string) => void;
}

interface SyncStorage {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
}

function storage(): SyncStorage {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // Sandboxed or policy-disabled renderers retain an in-memory stash.
  }
  return createMemoryStorage() as SyncStorage;
}

const promptStashStorage = storage();

function readEntries(): PromptStashEntry[] {
  try {
    const raw = promptStashStorage.getItem(PROMPT_STASH_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is PromptStashEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as PromptStashEntry).id === "string" &&
        typeof (entry as PromptStashEntry).createdAt === "string" &&
        typeof (entry as PromptStashEntry).prompt === "string" &&
        Array.isArray((entry as PromptStashEntry).attachments),
    );
  } catch {
    return [];
  }
}

function persist(entries: ReadonlyArray<PromptStashEntry>): void {
  promptStashStorage.setItem(PROMPT_STASH_STORAGE_KEY, JSON.stringify(entries));
}

export const usePromptStashStore = create<PromptStashState>()((set, get) => ({
  entries: readEntries(),
  stash: (entry) => {
    const next = [entry, ...get().entries];
    const evicted = next.length > MAX_PROMPT_STASH_ENTRIES ? (next.pop() ?? null) : null;
    persist(next);
    set({ entries: next });
    return evicted;
  },
  take: (id) => {
    const entry = get().entries.find((candidate) => candidate.id === id) ?? null;
    if (!entry) return null;
    const next = get().entries.filter((candidate) => candidate.id !== id);
    persist(next);
    set({ entries: next });
    return entry;
  },
  remove: (id) => {
    const next = get().entries.filter((candidate) => candidate.id !== id);
    persist(next);
    set({ entries: next });
  },
}));

export function promptStashSnippet(entry: PromptStashEntry): string {
  const normalized = entry.prompt.trim().replace(/\s+/g, " ");
  if (normalized) return normalized.length > 72 ? `${normalized.slice(0, 69)}…` : normalized;
  const count = entry.attachments.length;
  return `${count} image${count === 1 ? "" : "s"}`;
}
