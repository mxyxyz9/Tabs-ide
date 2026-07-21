import { describe, expect, it } from "vitest";
import {
  applyCustomModelOrdering,
  resetModelOrder,
  updateModelOrder,
} from "./modelOrdering";

describe("modelOrdering", () => {
  it("sorts models according to custom modelOrder while preserving Auto at top", () => {
    const models = [
      { slug: "model-a", name: "Model A" },
      { slug: "auto", name: "Auto" },
      { slug: "model-b", name: "Model B" },
      { slug: "model-c", name: "Model C" },
    ];
    const customOrder = ["model-c", "model-a", "model-b"];

    const sorted = applyCustomModelOrdering(models, customOrder);
    expect(sorted.map((m) => m.slug)).toEqual(["auto", "model-c", "model-a", "model-b"]);
  });

  it("appends unordered models to the end", () => {
    const models = [
      { slug: "model-a" },
      { slug: "model-b" },
      { slug: "model-c" },
      { slug: "model-new" },
    ];
    const customOrder = ["model-c", "model-a"];

    const sorted = applyCustomModelOrdering(models, customOrder);
    expect(sorted.map((m) => m.slug)).toEqual(["model-c", "model-a", "model-b", "model-new"]);
  });

  it("immutably updates model order for instance", () => {
    const initial = {};
    const next = updateModelOrder(initial, "codex", ["gpt-5.4", "gpt-5.3"]);
    expect(next).toEqual({
      codex: {
        hiddenModels: [],
        modelOrder: ["gpt-5.4", "gpt-5.3"],
      },
    });
  });

  it("resets model order for instance", () => {
    const initial = {
      codex: {
        hiddenModels: ["gpt-legacy"],
        modelOrder: ["gpt-5.4", "gpt-5.3"],
      },
    };
    const next = resetModelOrder(initial, "codex");
    expect(next).toEqual({
      codex: {
        hiddenModels: ["gpt-legacy"],
        modelOrder: [],
      },
    });
  });
});
