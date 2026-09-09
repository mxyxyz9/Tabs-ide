import { describe, it, expect } from "vitest";
import { validateRelease, pickAsset, detectPlatform, RELEASES_URL } from "./releases";
import snapshot from "../data/releases.json";
describe("latest-release downloads", () => {
  it("selects the correct architecture without downloading a blockmap", () => {
    const r = validateRelease(snapshot[0]);
    expect(pickAsset(r, "mac-arm64")).toMatch(/-arm64\.dmg$/);
    expect(pickAsset(r, "mac-x64")).toMatch(/-x64\.dmg$/);
    expect(pickAsset(r, "windows-x64")).toMatch(/-x64\.exe$/);
    expect(pickAsset(r, "linux-x64")).toMatch(/-x86_64\.AppImage$/);
    expect(pickAsset({ ...r, assets: [] }, "windows-x64")).toBeNull();
  });
  it("resolves a future version without a hardcoded version", () => {
    const old = snapshot[0]!;
    const future = JSON.parse(
      JSON.stringify(old)
        .replaceAll(old.tag_name, "v1.4.0")
        .replaceAll(old.tag_name.slice(1), "1.4.0"),
    );
    expect(pickAsset(validateRelease(future), "windows-x64")).toContain(
      "/v1.4.0/Tabs-1.4.0-x64.exe",
    );
  });
  it("rejects rate limit errors, prereleases, and external asset URLs", () => {
    expect(() => validateRelease({ message: "rate limited" })).toThrow();
    expect(() => validateRelease({ ...snapshot[0], prerelease: true })).toThrow();
    expect(() =>
      validateRelease({
        ...snapshot[0],
        assets: [{ name: "evil.exe", browser_download_url: "https://example.com/evil.exe" }],
      }),
    ).toThrow();
    expect(() =>
      validateRelease({ ...snapshot[0], html_url: `${RELEASES_URL}/tag/wrong` }),
    ).toThrow();
  });
  it("does not guess Mac architecture or deliver x64 to mobile and ARM", () => {
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBeNull();
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows-x64");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux-x64");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14)")).toBeNull();
    expect(detectPlatform("Mozilla/5.0 (X11; Linux aarch64)")).toBeNull();
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; ARM64)")).toBeNull();
  });
});
