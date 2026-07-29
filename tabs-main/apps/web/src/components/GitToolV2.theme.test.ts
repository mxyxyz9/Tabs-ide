import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("GitToolV2 Theme Reactivity", () => {
  const cssPath = join(__dirname, "git", "GitToolV2.css");
  const cssContent = readFileSync(cssPath, "utf-8");

  it("does not contain hardcoded rgba(250, 250, 250, ...) text color literals in scoped CSS", () => {
    const hardcodedTextMatches = cssContent.match(/rgba\(\s*250\s*,\s*250\s*,\s*250/g);
    expect(hardcodedTextMatches).toBeNull();
  });

  it("does not contain hardcoded rgba(255, 255, 255, ...) border/bg literals in scoped CSS", () => {
    const hardcodedRgbaMatches = cssContent.match(/rgba\(\s*255\s*,\s*255\s*,\s*255/g);
    expect(hardcodedRgbaMatches).toBeNull();
  });

  it("uses color-mix(in srgb, var(--foreground) ...) for text, border, and background opacity utilities", () => {
    expect(cssContent).toContain("color-mix(in srgb, var(--foreground)");
    expect(cssContent).toContain(".git-tool-v2 .tx-80 { color: color-mix(in srgb, var(--foreground) 80%, transparent); }");
    expect(cssContent).toContain(".git-tool-v2 .bd-1 { border-color: color-mix(in srgb, var(--foreground) 8%, transparent); }");
    expect(cssContent).toContain(".git-tool-v2 .bg-o1 { background-color: color-mix(in srgb, var(--foreground) 6%, transparent); }");
  });
});

