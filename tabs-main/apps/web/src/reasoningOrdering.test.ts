import { describe, expect, it } from "vitest";
import type { ProviderOptionDescriptor } from "@tabs/contracts";
import {
  collectReasoningChoices,
  formatThinkingHeaderWords,
  getReasoningChoiceRank,
  sortReasoningChoices,
} from "./reasoningOrdering";

describe("reasoningOrdering", () => {
  describe("formatThinkingHeaderWords", () => {
    it("splits compound terms into two lines", () => {
      expect(formatThinkingHeaderWords({ id: "ultrathink", label: "Ultrathink" })).toEqual([
        "ULTRA",
        "THINK",
      ]);
      expect(formatThinkingHeaderWords({ id: "ultracode", label: "Ultracode" })).toEqual([
        "ULTRA",
        "CODE",
      ]);
      expect(formatThinkingHeaderWords({ id: "ultracoder", label: "Ultracoder" })).toEqual([
        "ULTRA",
        "CODER",
      ]);
      expect(formatThinkingHeaderWords({ id: "xhigh", label: "Extra High" })).toEqual([
        "EXTRA",
        "HIGH",
      ]);
    });

    it("handles single-word terms without splitting unnecessarily", () => {
      expect(formatThinkingHeaderWords({ id: "low", label: "Low" })).toEqual(["LOW"]);
      expect(formatThinkingHeaderWords({ id: "medium", label: "Medium" })).toEqual(["MEDIUM"]);
      expect(formatThinkingHeaderWords({ id: "high", label: "High" })).toEqual(["HIGH"]);
      expect(formatThinkingHeaderWords({ id: "max", label: "Max" })).toEqual(["MAX"]);
    });

    it("splits multi-word strings cleanly", () => {
      expect(formatThinkingHeaderWords({ id: "deep_thinking", label: "Deep Thinking" })).toEqual([
        "DEEP",
        "THINKING",
      ]);
    });
  });
  describe("getReasoningChoiceRank", () => {
    it("assigns stable ranks to known reasoning level IDs", () => {
      expect(getReasoningChoiceRank("none")).toBe(0);
      expect(getReasoningChoiceRank("low")).toBe(10);
      expect(getReasoningChoiceRank("minimal")).toBe(15);
      expect(getReasoningChoiceRank("medium")).toBe(20);
      expect(getReasoningChoiceRank("high")).toBe(30);
      expect(getReasoningChoiceRank("xhigh")).toBe(40);
      expect(getReasoningChoiceRank("max")).toBe(50);
      expect(getReasoningChoiceRank("ultra")).toBe(60);
      expect(getReasoningChoiceRank("ultracode")).toBe(70);
      expect(getReasoningChoiceRank("ultrathink")).toBe(80);
    });

    it("returns high fallback rank for unknown reasoning level IDs", () => {
      expect(getReasoningChoiceRank("creative")).toBe(1000);
      expect(getReasoningChoiceRank("deep_thinking")).toBe(1000);
    });
  });

  describe("sortReasoningChoices", () => {
    it("sorts choices by rank order and preserves full choice metadata", () => {
      const input = [
        { id: "max", label: "Maximum Effort", isDefault: false },
        { id: "low", label: "Low Effort", isDefault: true },
        { id: "high", label: "High Effort", isDefault: false },
      ];

      const sorted = sortReasoningChoices(input);
      expect(sorted.map((c) => c.id)).toEqual(["low", "high", "max"]);
      expect(sorted[0]).toEqual({ id: "low", label: "Low Effort", isDefault: true });
    });

    it("preserves unknown reasoning IDs and places them after known IDs deterministically", () => {
      const input = [
        { id: "creative", label: "Creative" },
        { id: "high", label: "High" },
        { id: "balanced", label: "Balanced" },
        { id: "low", label: "Low" },
      ];

      const sorted = sortReasoningChoices(input);
      expect(sorted.map((c) => c.id)).toEqual(["low", "high", "balanced", "creative"]);
    });
  });

  describe("collectReasoningChoices", () => {
    it("returns default standard reasoning choices for empty descriptor collections", () => {
      expect(collectReasoningChoices([]).map((c) => c.id)).toEqual([
        "low",
        "medium",
        "high",
        "xhigh",
        "max",
        "ultra",
      ]);
    });

    it("falls back to default standard choices when descriptor sets do not contain reasoning effort options", () => {
      const descriptors: ProviderOptionDescriptor[][] = [
        [
          {
            id: "fastMode",
            type: "boolean",
            label: "Fast Mode",
            currentValue: false,
          },
        ],
      ];

      expect(collectReasoningChoices(descriptors).map((c) => c.id)).toEqual([
        "low",
        "medium",
        "high",
        "xhigh",
        "max",
        "ultra",
      ]);
    });

    it("collects, deduplicates by ID, and sorts choices from reasoning effort descriptors", () => {
      const set1: ProviderOptionDescriptor[] = [
        {
          id: "reasoningEffort",
          type: "select",
          label: "Reasoning Effort",
          currentValue: "medium",
          options: [
            { id: "low", label: "Low", isDefault: false },
            { id: "medium", label: "Medium", isDefault: true },
            { id: "high", label: "High", isDefault: false },
          ],
        },
      ];

      const set2: ProviderOptionDescriptor[] = [
        {
          id: "reasoningEffort",
          type: "select",
          label: "Reasoning Effort",
          currentValue: "ultra",
          options: [
            { id: "medium", label: "Medium", isDefault: false },
            { id: "ultra", label: "Ultra Thinking", isDefault: false },
            { id: "max", label: "Max", isDefault: false },
          ],
        },
      ];

      const result = collectReasoningChoices([set1, set2]);
      expect(result.map((c) => c.id)).toEqual(["low", "medium", "high", "max", "ultra"]);
      expect(result.find((c) => c.id === "ultra")?.label).toBe("Ultra Thinking");
    });
  });
});
