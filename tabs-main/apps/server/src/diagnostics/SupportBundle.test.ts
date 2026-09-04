import * as OS from "node:os";
import { describe, expect, it } from "vitest";

import { redactSupportBundleText } from "./SupportBundle.ts";

describe("SupportBundle", () => {
  it("redacts home paths, credentials, and token-shaped values", () => {
    const input = `${OS.homedir()}/project?token=secret-value Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz123456`;
    const result = redactSupportBundleText(input);
    expect(result).not.toContain(OS.homedir());
    expect(result).not.toContain("secret-value");
    expect(result).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(result).toContain("<home>");
    expect(result).toContain("<redacted>");
  });
});
