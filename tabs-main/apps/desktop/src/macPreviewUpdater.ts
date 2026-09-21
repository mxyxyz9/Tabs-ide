import { createHash, verify } from "node:crypto";
import * as FS from "node:fs";
import * as FSPromises from "node:fs/promises";
import * as Path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

const MANIFEST_NAME = "tabs-mac-preview-update.json";
const UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAhDgnyPlvyYHwvS9U5TV6PXtVi0Du03HWviLL6cCxSsg=
-----END PUBLIC KEY-----`;
const EXPECTED_BUNDLE_IDENTIFIER = "com.tabs.app";

export interface MacPreviewUpdateAsset {
  readonly name: string;
  readonly sha512: string;
  readonly size: number;
}

export interface MacPreviewUpdateManifest {
  readonly schemaVersion: 1;
  readonly version: string;
  readonly releaseDate: string;
  readonly repository: string;
  readonly releaseNotes: string;
  readonly assets: {
    readonly arm64: MacPreviewUpdateAsset;
    readonly x64: MacPreviewUpdateAsset;
  };
}

interface DownloadedUpdate {
  readonly manifest: MacPreviewUpdateManifest;
  readonly archivePath: string;
}

export interface MacPreviewUpdaterOptions {
  readonly appBundlePath: string;
  readonly currentVersion: string;
  readonly repository: string;
  readonly arch: "arm64" | "x64";
  readonly tempDirectory: string;
  readonly requestHeaders?: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAsset(value: unknown, label: string): MacPreviewUpdateAsset {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !/^Tabs-[\w.-]+-(?:arm64|x64)\.zip$/.test(value.name) ||
    typeof value.sha512 !== "string" ||
    !/^[A-Za-z0-9+/]{80,}={0,2}$/.test(value.sha512) ||
    typeof value.size !== "number" ||
    !Number.isSafeInteger(value.size) ||
    value.size <= 0
  ) {
    throw new Error(`The signed update manifest contains an invalid ${label} asset.`);
  }
  return { name: value.name, sha512: value.sha512, size: value.size };
}

export function parseAndVerifyMacPreviewManifest(
  manifestBytes: Buffer,
  signatureText: string,
  expectedRepository: string,
  publicKey: string = UPDATE_PUBLIC_KEY,
): MacPreviewUpdateManifest {
  const signature = Buffer.from(signatureText.trim(), "base64");
  if (signature.length !== 64 || !verify(null, manifestBytes, publicKey, signature)) {
    throw new Error("The macOS update manifest signature is invalid.");
  }

  const value: unknown = JSON.parse(manifestBytes.toString("utf8"));
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/.test(value.version) ||
    typeof value.releaseDate !== "string" ||
    Number.isNaN(Date.parse(value.releaseDate)) ||
    value.repository !== expectedRepository ||
    typeof value.releaseNotes !== "string" ||
    value.releaseNotes.length > 50_000 ||
    !isRecord(value.assets)
  ) {
    throw new Error("The signed macOS update manifest is malformed or targets another project.");
  }

  return {
    schemaVersion: 1,
    version: value.version,
    releaseDate: value.releaseDate,
    repository: expectedRepository,
    releaseNotes: value.releaseNotes.trim(),
    assets: {
      arm64: parseAsset(value.assets.arm64, "arm64"),
      x64: parseAsset(value.assets.x64, "x64"),
    },
  };
}

function compareIdentifiers(left: string, right: string): number {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : null;
  if (leftNumber !== null && rightNumber !== null) return Math.sign(leftNumber - rightNumber);
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  return left.localeCompare(right);
}

export function compareMacPreviewVersions(left: string, right: string): number {
  const [leftCore = "", leftPre] = left.split(/-(.+)/, 2);
  const [rightCore = "", rightPre] = right.split(/-(.+)/, 2);
  const leftParts = leftCore.split(".").map(Number);
  const rightParts = rightCore.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (leftPre === undefined && rightPre === undefined) return 0;
  if (leftPre === undefined) return 1;
  if (rightPre === undefined) return -1;
  const leftIdentifiers = leftPre.split(".");
  const rightIdentifiers = rightPre.split(".");
  for (
    let index = 0;
    index < Math.max(leftIdentifiers.length, rightIdentifiers.length);
    index += 1
  ) {
    const leftIdentifier = leftIdentifiers[index];
    const rightIdentifier = rightIdentifiers[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    const result = compareIdentifiers(leftIdentifier, rightIdentifier);
    if (result !== 0) return result;
  }
  return 0;
}

function releaseAssetUrl(repository: string, assetName: string): string {
  return `https://github.com/${repository}/releases/latest/download/${encodeURIComponent(assetName)}`;
}

async function fetchRequired(
  url: string,
  headers: Readonly<Record<string, string>>,
): Promise<Response> {
  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Update server returned HTTP ${response.status} for ${Path.basename(url)}.`);
  }
  return response;
}

function validateBundle(bundlePath: string, expectedVersion: string): void {
  const plistPath = Path.join(bundlePath, "Contents", "Info.plist");
  const readPlistValue = (key: string): string => {
    const result = spawnSync("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plistPath], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`The downloaded update is missing ${key}.`);
    }
    return result.stdout.trim();
  };
  if (readPlistValue("CFBundleIdentifier") !== EXPECTED_BUNDLE_IDENTIFIER) {
    throw new Error("The downloaded update has an unexpected bundle identifier.");
  }
  if (readPlistValue("CFBundleShortVersionString") !== expectedVersion) {
    throw new Error("The downloaded update version does not match its signed manifest.");
  }
  const signature = spawnSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", bundlePath]);
  if (signature.status !== 0) {
    throw new Error("The downloaded update has an invalid ad-hoc code signature.");
  }
}

export class MacPreviewUpdater {
  readonly #options: MacPreviewUpdaterOptions;
  #availableManifest: MacPreviewUpdateManifest | null = null;
  #downloadedUpdate: DownloadedUpdate | null = null;
  #stagedBundlePath: string | null = null;

  constructor(options: MacPreviewUpdaterOptions) {
    if (process.platform === "darwin" && Path.extname(options.appBundlePath) !== ".app") {
      throw new Error("The macOS preview updater could not locate the running app bundle.");
    }
    this.#options = options;
  }

  async checkForUpdates(): Promise<MacPreviewUpdateManifest | null> {
    const manifestUrl = releaseAssetUrl(this.#options.repository, MANIFEST_NAME);
    const [manifestResponse, signatureResponse] = await Promise.all([
      fetchRequired(manifestUrl, this.#options.requestHeaders ?? {}),
      fetchRequired(`${manifestUrl}.sig`, this.#options.requestHeaders ?? {}),
    ]);
    const manifestBytes = Buffer.from(await manifestResponse.arrayBuffer());
    const signatureText = await signatureResponse.text();
    const manifest = parseAndVerifyMacPreviewManifest(
      manifestBytes,
      signatureText,
      this.#options.repository,
    );
    this.#availableManifest =
      compareMacPreviewVersions(manifest.version, this.#options.currentVersion) > 0
        ? manifest
        : null;
    return this.#availableManifest;
  }

  async downloadUpdate(onProgress: (percent: number) => void): Promise<string> {
    const manifest = this.#availableManifest;
    if (!manifest) throw new Error("No verified macOS update is available.");
    const asset = manifest.assets[this.#options.arch];
    const downloadDirectory = await FSPromises.mkdtemp(
      Path.join(this.#options.tempDirectory, "tabs-preview-update-"),
    );
    const archivePath = Path.join(downloadDirectory, asset.name);
    const temporaryPath = `${archivePath}.download`;
    const response = await fetchRequired(
      releaseAssetUrl(this.#options.repository, asset.name),
      this.#options.requestHeaders ?? {},
    );
    if (!response.body) throw new Error("The update server returned an empty download.");

    const hash = createHash("sha512");
    const handle = await FSPromises.open(temporaryPath, "w", 0o600);
    let received = 0;
    try {
      try {
        const reader = (response.body as NodeReadableStream<Uint8Array>).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          hash.update(value);
          await handle.write(value);
          received += value.byteLength;
          if (received > asset.size) {
            await reader.cancel();
            throw new Error("The update download exceeded its signed size.");
          }
          onProgress(Math.min(99, (received / asset.size) * 100));
        }
      } finally {
        await handle.close();
      }
    } catch (error) {
      await FSPromises.rm(temporaryPath, { force: true });
      throw error;
    }
    if (received !== asset.size || hash.digest("base64") !== asset.sha512) {
      await FSPromises.rm(temporaryPath, { force: true });
      throw new Error("The downloaded update did not match its signed checksum.");
    }
    await FSPromises.rename(temporaryPath, archivePath);
    this.#downloadedUpdate = { manifest, archivePath };
    onProgress(100);
    return manifest.version;
  }

  async stageUpdate(): Promise<string> {
    const downloaded = this.#downloadedUpdate;
    if (!downloaded) throw new Error("No verified macOS update has been downloaded.");
    const installDirectory = Path.dirname(this.#options.appBundlePath);
    await FSPromises.access(installDirectory, FS.constants.W_OK);
    const stageRoot = Path.join(
      installDirectory,
      `.Tabs.preview-update-${downloaded.manifest.version}`,
    );
    const stagedBundlePath = Path.join(stageRoot, "Tabs.app");
    await FSPromises.rm(stageRoot, { recursive: true, force: true });
    await FSPromises.mkdir(stageRoot, { recursive: true });
    const extraction = spawnSync("/usr/bin/ditto", ["-x", "-k", downloaded.archivePath, stageRoot]);
    if (extraction.status !== 0) {
      throw new Error("The verified macOS update could not be extracted.");
    }
    validateBundle(stagedBundlePath, downloaded.manifest.version);
    await FSPromises.rm(Path.dirname(downloaded.archivePath), { recursive: true, force: true });
    this.#stagedBundlePath = stagedBundlePath;
    return stagedBundlePath;
  }

  quitAndInstall(processId: number): void {
    const stagedBundlePath = this.#stagedBundlePath;
    if (!stagedBundlePath) throw new Error("The macOS update has not been staged.");
    const targetPath = this.#options.appBundlePath;
    const backupPath = `${targetPath}.preview-update-backup`;
    const script = `set -eu
target="$1"
staged="$2"
backup="$3"
pid="$4"
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
if [ -e "$backup" ]; then /bin/rm -rf "$backup"; fi
/bin/mv "$target" "$backup"
if /bin/mv "$staged" "$target"; then
  /usr/bin/open "$target"
  /bin/rm -rf "$backup"
else
  /bin/mv "$backup" "$target"
  /usr/bin/open "$target"
  exit 1
fi
`;
    const child = spawn(
      "/bin/sh",
      [
        "-c",
        script,
        "tabs-preview-updater",
        targetPath,
        stagedBundlePath,
        backupPath,
        String(processId),
      ],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
  }
}
