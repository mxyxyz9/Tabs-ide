import { describe, expect, it } from "vitest";
import { toastManager } from "./toast";

describe("toastManager deduplication", () => {
  it("deduplicates identical toast notifications within 2.5 seconds", () => {
    const id1 = toastManager.add({
      type: "success",
      title: "Keybindings updated",
      description: "Keybindings configuration reloaded successfully.",
    });

    const id2 = toastManager.add({
      type: "success",
      title: "Keybindings updated",
      description: "Keybindings configuration reloaded successfully.",
    });

    expect(id2).toBe(id1);

    const id3 = toastManager.add({
      type: "warning",
      title: "Keybindings updated",
      description: "Keybindings configuration reloaded successfully.",
    });

    expect(id3).not.toBe(id1);
  });
});
