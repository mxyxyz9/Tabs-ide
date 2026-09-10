import { writeFile } from "node:fs/promises";
import {
  GITHUB_API_URL,
  RELEASES_URL,
  platforms,
  pickAsset,
  validateRelease,
} from "../src/lib/releases";
import { resolveReleaseNotes } from "../src/lib/release-note-content";
const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
async function get(url: string) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  return res.json();
}
const latest = validateRelease(await get(`${GITHUB_API_URL}/latest`));
for (const platform of platforms)
  if (!pickAsset(latest, platform.id)) throw new Error(`Latest release missing ${platform.label}`);
for (const name of ["latest.yml", "latest-linux.yml"]) {
  const asset = latest.assets.find((a) => a.name === name);
  if (!asset) throw new Error(`Missing updater manifest: ${name}`);
  const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Cannot fetch ${name}: ${response.status}`);
  const manifest = await response.text();
  const version = manifest.match(/^version:\s*['"]?([^\s'"]+)/m)?.[1];
  if (version !== latest.tag_name.replace(/^v/, "")) throw new Error(`${name} version mismatch`);
  const paths = [...manifest.matchAll(/^\s*(?:-\s*)?(?:url|path):\s*['"]?([^\s'"]+)/gm)].map(
    (m) => m[1],
  );
  if (!paths.length || paths.some((path) => !latest.assets.some((a) => a.name === path)))
    throw new Error(`${name} references missing installers`);
}
const all = await get(`${GITHUB_API_URL}?per_page=30`);
if (!Array.isArray(all)) throw new Error("Invalid release history");
const history = all
  .filter((r) => !r.draft && !r.prerelease && r.tag_name !== latest.tag_name)
  .slice(0, 4)
  .map(validateRelease);
const sanitized = [latest, ...history].map((r) => ({
  tag_name: r.tag_name,
  name: r.name ?? r.tag_name,
  published_at: r.published_at,
  body: resolveReleaseNotes(r.tag_name, r.body),
  html_url: r.html_url,
  assets: r.assets.map((a) => ({ name: a.name, browser_download_url: a.browser_download_url })),
}));
await writeFile(
  new URL("../src/data/releases.json", import.meta.url),
  JSON.stringify(sanitized, null, 2) + "\n",
);
console.log(
  `Synced ${latest.tag_name} from ${RELEASES_URL}; all four installers and Windows/Linux manifests verified.`,
);
