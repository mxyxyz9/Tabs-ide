import { describe, expect, it, vi } from "vitest";

import { applyInterfaceFontSize } from "./useTheme";

describe("interface font scaling", () => {
  it("does not redefine the root rem unit", () => {
    const setProperty = vi.fn();
    const removeProperty = vi.fn();
    const style = { setProperty, removeProperty } as unknown as CSSStyleDeclaration;

    applyInterfaceFontSize(style, 13);

    expect(setProperty).toHaveBeenCalledWith("--font-size-interface", "13px");
    expect(removeProperty).toHaveBeenCalledWith("font-size");
  });
});
