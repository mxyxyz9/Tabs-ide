import type { ResolvedKeybindingsConfig } from "@tabs/contracts";
import { describe, expect, it } from "vitest";

import {
  buildKeybindingRows,
  commandLabel,
  keybindingFromKeyboardEvent,
  parseWhenExpressionDraft,
  shortcutToKeybindingInput,
  whenAstToExpression,
} from "./keybindingsSettings.logic";

const shortcut = (key: string, mods: Partial<Record<"modKey" | "shiftKey", boolean>> = {}) => ({
  key,
  modKey: mods.modKey ?? false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: mods.shiftKey ?? false,
});

describe("keybindingsSettings.logic", () => {
  it("builds searchable rows with readable key and when values", () => {
    const rows = buildKeybindingRows(
      [
        {
          command: "diff.toggle",
          shortcut: shortcut("d", { modKey: true }),
          whenAst: { type: "not", node: { type: "identifier", name: "terminalFocus" } },
        },
      ] satisfies ResolvedKeybindingsConfig,
      "diff",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      command: "diff.toggle",
      key: "mod+d",
      when: "!terminalFocus",
      source: "Default",
    });
  });

  it("classifies a custom shortcut for a default command as Custom", () => {
    const rows = buildKeybindingRows(
      [
        {
          command: "terminal.toggle",
          shortcut: shortcut("k", { modKey: true }),
        },
      ] satisfies ResolvedKeybindingsConfig,
      "",
    );
    expect(rows[0]?.source).toBe("Custom");
    expect(rows[0]?.defaultKey).toBe("mod+j");
  });

  it("serializes shortcuts and when expressions", () => {
    expect(shortcutToKeybindingInput(shortcut("d", { modKey: true, shiftKey: true }))).toBe(
      "mod+shift+d",
    );
    expect(
      whenAstToExpression({
        type: "and",
        left: { type: "identifier", name: "a" },
        right: { type: "not", node: { type: "identifier", name: "b" } },
      }),
    ).toBe("a && !b");
  });

  it("captures platform-specific mod shortcuts", () => {
    expect(
      keybindingFromKeyboardEvent(
        { key: "k", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
        "MacIntel",
      ),
    ).toBe("mod+k");
    expect(
      keybindingFromKeyboardEvent(
        { key: "k", metaKey: false, ctrlKey: true, altKey: false, shiftKey: false },
        "Win32",
      ),
    ).toBe("mod+k");
  });

  it("validates when-expression drafts", () => {
    expect(parseWhenExpressionDraft("")).toEqual({ ok: true, value: undefined });
    expect(parseWhenExpressionDraft("a && (b || !c)").ok).toBe(true);
    expect(parseWhenExpressionDraft("a &&")).toEqual({ ok: false, message: expect.any(String) });
  });

  it("formats command labels", () => {
    expect(commandLabel("terminal.toggle")).toBe("Terminal: Toggle");
    expect(commandLabel("chat.newLocal")).toBe("Chat: New Local");
    expect(commandLabel("script.setup-db.run")).toBe("Run Script: Setup Db");
  });

  it("reports conflicting shortcuts that share an active when context", () => {
    const rows = buildKeybindingRows(
      [
        { command: "chat.new", shortcut: shortcut("p", { modKey: true }) },
        { command: "chat.newLocal", shortcut: shortcut("p", { modKey: true }) },
      ] satisfies ResolvedKeybindingsConfig,
      "",
    );
    expect(rows[0]?.conflicts).toEqual(["Chat: New Local"]);
    expect(rows[1]?.conflicts).toEqual(["Chat: New"]);
  });
});
