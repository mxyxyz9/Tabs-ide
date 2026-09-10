import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_PROMPT_STASH_ENTRIES,
  promptStashSnippet,
  usePromptStashStore,
  type PromptStashEntry,
} from "./promptStashStore";

function entry(id: string, prompt = `prompt ${id}`): PromptStashEntry {
  return {
    id,
    prompt,
    createdAt: "2026-09-10T12:00:00.000Z",
    attachments: [],
  };
}

describe("promptStashStore", () => {
  beforeEach(() => {
    usePromptStashStore.setState({ entries: [] });
  });

  it("stores newest entries first and returns a restored entry exactly once", () => {
    const store = usePromptStashStore.getState();
    store.stash(entry("one"));
    store.stash(entry("two"));

    expect(usePromptStashStore.getState().entries.map(({ id }) => id)).toEqual(["two", "one"]);
    expect(usePromptStashStore.getState().take("one")?.id).toBe("one");
    expect(usePromptStashStore.getState().take("one")).toBeNull();
  });

  it("caps the queue and reports the evicted oldest entry", () => {
    const store = usePromptStashStore.getState();
    for (let index = 0; index < MAX_PROMPT_STASH_ENTRIES; index += 1) {
      store.stash(entry(String(index)));
    }

    const evicted = usePromptStashStore.getState().stash(entry("newest"));

    expect(evicted?.id).toBe("0");
    expect(usePromptStashStore.getState().entries).toHaveLength(MAX_PROMPT_STASH_ENTRIES);
  });

  it("builds a bounded readable label", () => {
    expect(promptStashSnippet(entry("long", "  a   very long prompt  "))).toBe(
      "a very long prompt",
    );
    expect(promptStashSnippet({ ...entry("image", ""), attachments: [{} as never] })).toBe(
      "1 image",
    );
  });
});
