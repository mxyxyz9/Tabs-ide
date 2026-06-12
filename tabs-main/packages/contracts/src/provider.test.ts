import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { ProviderSendTurnInput, ProviderSessionStartInput } from "./provider";

const decodeProviderSessionStartInput = Schema.decodeUnknownSync(ProviderSessionStartInput);
const decodeProviderSendTurnInput = Schema.decodeUnknownSync(ProviderSendTurnInput);

// `modelSelection.options` decodes to the canonical `ProviderOptionSelections`
// array (`{ id, value }[]`). Legacy object inputs (`{ reasoningEffort: "high" }`)
// are coerced to that array shape by the schema, so look options up by id.
const opt = (
  sel: { readonly options?: ReadonlyArray<{ readonly id: string; readonly value: unknown }> },
  id: string,
): unknown => sel.options?.find((o) => o.id === id)?.value;

describe("ProviderSessionStartInput", () => {
  it("accepts codex-compatible payloads", () => {
    const parsed = decodeProviderSessionStartInput({
      threadId: "thread-1",
      provider: "codex",
      cwd: "/tmp/workspace",
      modelSelection: {
        provider: "codex",
        model: "gpt-5.3-codex",
        options: {
          reasoningEffort: "high",
          fastMode: true,
        },
      },
      runtimeMode: "full-access",
    });
    expect(parsed.runtimeMode).toBe("full-access");
    expect(parsed.modelSelection?.instanceId).toBe("codex");
    expect(parsed.modelSelection?.model).toBe("gpt-5.3-codex");
    if (parsed.modelSelection?.instanceId !== "codex") {
      throw new Error("Expected codex modelSelection");
    }
    expect(opt(parsed.modelSelection, "reasoningEffort")).toBe("high");
    expect(opt(parsed.modelSelection, "fastMode")).toBe(true);
  });

  it("rejects payloads without runtime mode", () => {
    expect(() =>
      decodeProviderSessionStartInput({
        threadId: "thread-1",
        provider: "codex",
      }),
    ).toThrow();
  });

  it("accepts claude runtime knobs", () => {
    const parsed = decodeProviderSessionStartInput({
      threadId: "thread-1",
      provider: "claudeAgent",
      cwd: "/tmp/workspace",
      modelSelection: {
        provider: "claudeAgent",
        model: "claude-sonnet-4-6",
        options: {
          thinking: true,
          effort: "max",
          fastMode: true,
        },
      },
      runtimeMode: "full-access",
    });
    expect(parsed.provider).toBe("claudeAgent");
    expect(parsed.modelSelection?.instanceId).toBe("claudeAgent");
    expect(parsed.modelSelection?.model).toBe("claude-sonnet-4-6");
    if (parsed.modelSelection?.instanceId !== "claudeAgent") {
      throw new Error("Expected claude modelSelection");
    }
    expect(opt(parsed.modelSelection, "thinking")).toBe(true);
    expect(opt(parsed.modelSelection, "effort")).toBe("max");
    expect(opt(parsed.modelSelection, "fastMode")).toBe(true);
    expect(parsed.runtimeMode).toBe("full-access");
  });
});

describe("ProviderSendTurnInput", () => {
  it("accepts codex modelSelection", () => {
    const parsed = decodeProviderSendTurnInput({
      threadId: "thread-1",
      modelSelection: {
        provider: "codex",
        model: "gpt-5.3-codex",
        options: {
          reasoningEffort: "xhigh",
          fastMode: true,
        },
      },
    });

    expect(parsed.modelSelection?.instanceId).toBe("codex");
    expect(parsed.modelSelection?.model).toBe("gpt-5.3-codex");
    if (parsed.modelSelection?.instanceId !== "codex") {
      throw new Error("Expected codex modelSelection");
    }
    expect(opt(parsed.modelSelection, "reasoningEffort")).toBe("xhigh");
    expect(opt(parsed.modelSelection, "fastMode")).toBe(true);
  });

  it("accepts claude modelSelection including ultrathink", () => {
    const parsed = decodeProviderSendTurnInput({
      threadId: "thread-1",
      modelSelection: {
        provider: "claudeAgent",
        model: "claude-sonnet-4-6",
        options: {
          effort: "ultrathink",
          fastMode: true,
        },
      },
    });

    expect(parsed.modelSelection?.instanceId).toBe("claudeAgent");
    if (parsed.modelSelection?.instanceId !== "claudeAgent") {
      throw new Error("Expected claude modelSelection");
    }
    expect(opt(parsed.modelSelection, "effort")).toBe("ultrathink");
    expect(opt(parsed.modelSelection, "fastMode")).toBe(true);
  });
});
