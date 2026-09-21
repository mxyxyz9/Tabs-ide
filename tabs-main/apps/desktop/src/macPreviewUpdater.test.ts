import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import { compareMacPreviewVersions, parseAndVerifyMacPreviewManifest } from "./macPreviewUpdater";

function createSignedManifest(overrides: Record<string, unknown> = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const manifest = {
    schemaVersion: 1,
    version: "1.4.0",
    releaseDate: "2026-09-21T12:00:00.000Z",
    repository: "mxyxyz9/Tabs-ide",
    releaseNotes: "## What changed\n\n- Faster startup",
    assets: {
      arm64: {
        name: "Tabs-1.4.0-arm64.zip",
        sha512: Buffer.alloc(64, 1).toString("base64"),
        size: 123,
      },
      x64: {
        name: "Tabs-1.4.0-x64.zip",
        sha512: Buffer.alloc(64, 2).toString("base64"),
        size: 456,
      },
    },
    ...overrides,
  };
  const bytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  return {
    bytes,
    publicKey: publicKey.export({ format: "pem", type: "spki" }).toString(),
    signature: sign(null, bytes, privateKey).toString("base64"),
  };
}

describe("parseAndVerifyMacPreviewManifest", () => {
  it("accepts a well-formed manifest signed by the expected key", () => {
    const fixture = createSignedManifest();
    const result = parseAndVerifyMacPreviewManifest(
      fixture.bytes,
      fixture.signature,
      "mxyxyz9/Tabs-ide",
      fixture.publicKey,
    );
    expect(result.version).toBe("1.4.0");
    expect(result.releaseNotes).toContain("Faster startup");
    expect(result.assets.arm64.name).toBe("Tabs-1.4.0-arm64.zip");
  });

  it("rejects tampered manifest bytes", () => {
    const fixture = createSignedManifest();
    const tampered = Buffer.from(fixture.bytes.toString().replace("1.4.0", "9.9.9"));
    expect(() =>
      parseAndVerifyMacPreviewManifest(
        tampered,
        fixture.signature,
        "mxyxyz9/Tabs-ide",
        fixture.publicKey,
      ),
    ).toThrow("signature is invalid");
  });

  it("rejects a valid signature for another repository", () => {
    const fixture = createSignedManifest({ repository: "attacker/Tabs-ide" });
    expect(() =>
      parseAndVerifyMacPreviewManifest(
        fixture.bytes,
        fixture.signature,
        "mxyxyz9/Tabs-ide",
        fixture.publicKey,
      ),
    ).toThrow("targets another project");
  });
});

describe("compareMacPreviewVersions", () => {
  it("orders stable and prerelease versions", () => {
    expect(compareMacPreviewVersions("1.4.0", "1.3.12")).toBeGreaterThan(0);
    expect(compareMacPreviewVersions("1.4.0", "1.4.0-beta.2")).toBeGreaterThan(0);
    expect(compareMacPreviewVersions("1.4.0-beta.10", "1.4.0-beta.2")).toBeGreaterThan(0);
    expect(compareMacPreviewVersions("1.4.0", "1.4.0")).toBe(0);
  });
});
