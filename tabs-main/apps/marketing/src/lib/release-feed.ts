import { fetchAllReleases, pickAsset, type Platform, type Release } from "./releases";
import { resolveReleaseNotes } from "./release-note-content";

const downloadLabels: Record<Platform, [string, string]> = {
  "mac-arm64": ["macOS", "Apple Silicon"],
  "mac-x64": ["macOS", "Intel x64"],
  "windows-x64": ["Windows", "x64 installer"],
  "linux-x64": ["Linux", "x64 AppImage"],
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function appendInline(container: HTMLElement, value: string) {
  const pattern = /\[([^\]]+)]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s]+)/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    container.append(value.slice(cursor, index));
    const link = el("a");
    link.href = match[2] ?? match[3] ?? "";
    link.textContent = match[1] ?? match[3] ?? "Link";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    container.append(link);
    cursor = index + match[0].length;
  }
  container.append(value.slice(cursor));
}

function renderNotes(body: string | null) {
  const fragment = document.createDocumentFragment();
  const lines = (body?.trim() || "No release notes were provided for this release.").split(/\r?\n/);
  let list: HTMLUListElement | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      list = null;
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) {
      if (!list) {
        list = el("ul", "hs-cl-bullet-list");
        fragment.append(list);
      }
      const item = el("li");
      appendInline(item, bullet[1] ?? "");
      list.append(item);
      continue;
    }
    list = null;
    const heading = line.match(/^#{2,4}\s+(.+)/);
    const node = heading ? el("h4", "hs-cl-category-title") : el("p");
    appendInline(node, (heading?.[1] ?? line).replaceAll("**", ""));
    fragment.append(node);
  }
  return fragment;
}

function buildReleaseCard(release: Release, isLatest: boolean) {
  const article = el("article", `hs-cl-release${isLatest ? " hs-cl-release-latest" : ""}`);
  article.id = release.tag_name;
  article.dataset.releaseCard = release.tag_name;

  const header = el("div", "hs-cl-release-header");
  const tagRow = el("div", "hs-cl-tag-row");
  const heading = el("h2");
  heading.textContent = release.tag_name;
  tagRow.append(heading);
  if (isLatest) {
    const badge = el("span", "hs-cl-badge hs-cl-badge-latest");
    badge.textContent = "● LATEST STABLE";
    tagRow.append(badge);
  }
  const date = el("time", "hs-cl-date");
  date.dateTime = release.published_at;
  date.textContent = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(release.published_at));
  tagRow.append(date);
  const github = el("a", "hs-cl-tag-link");
  github.href = release.html_url;
  github.target = "_blank";
  github.rel = "noopener noreferrer";
  github.textContent = "View on GitHub ↗";
  header.append(tagRow, github);

  const body = el("div", "hs-cl-release-body");
  const title = el("h3", "hs-cl-title");
  title.textContent = release.name || release.tag_name;
  body.append(title);

  const binaries = el("div", "hs-cl-binaries");
  const binaryLabel = el("span", "hs-cl-binaries-label");
  binaryLabel.textContent = "GET THIS RELEASE";
  const binaryList = el("div", "hs-cl-binaries-list");
  for (const [platform, [label, architecture]] of Object.entries(downloadLabels) as [
    Platform,
    [string, string],
  ][]) {
    const url = pickAsset(release, platform);
    if (!url) continue;
    const link = el("a", "hs-cl-binary-btn");
    link.href = url;
    link.setAttribute("download", "");
    const text = el("span");
    const strong = el("strong");
    strong.textContent = label;
    const small = el("small");
    small.textContent = architecture;
    text.append(strong, small);
    link.append(text, "↓");
    binaryList.append(link);
  }
  if (binaryList.childElementCount) {
    binaries.append(binaryLabel, binaryList);
    body.append(binaries);
  }

  const details = el("details", "hs-cl-details");
  details.open = isLatest;
  const summary = el("summary", "hs-cl-summary-trigger");
  const trigger = el("span", "hs-cl-trigger-left");
  const plus = el("span", "hs-cl-arrow");
  plus.textContent = "+";
  const triggerText = el("span", "hs-cl-trigger-text");
  triggerText.textContent = "Release notes";
  trigger.append(plus, triggerText);
  summary.append(trigger);
  const notes = el("div", "hs-cl-details-content");
  notes.append(renderNotes(resolveReleaseNotes(release.tag_name, release.body)));
  details.append(summary, notes);
  body.append(details);
  article.append(header, body);
  return article;
}

export async function refreshReleaseFeed() {
  const feed = document.querySelector<HTMLElement>("[data-live-release-feed]");
  const index = document.querySelector<HTMLElement>("[data-live-release-index]");
  if (!feed || !index) return;

  const releases = await fetchAllReleases(20);
  if (!releases.length) return;
  feed.replaceChildren(
    ...releases.map((release, position) => buildReleaseCard(release, position === 0)),
  );

  index.replaceChildren(
    ...releases.map((release, position) => {
      const link = el("a", `hs-cl-sidebar-link${position === 0 ? " is-latest" : ""}`);
      link.href = `#${release.tag_name}`;
      link.dataset.sidebarTarget = release.tag_name;
      const left = el("div", "hs-cl-link-left");
      if (position === 0) {
        const dot = el("span", "hs-cl-sidebar-dot");
        dot.textContent = "●";
        left.append(dot);
      }
      const tag = el("span", "hs-cl-sidebar-tag");
      tag.textContent = release.tag_name;
      left.append(tag);
      const date = el("span", "hs-cl-sidebar-date");
      date.textContent = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(new Date(release.published_at));
      link.append(left, date);
      return link;
    }),
  );
  document
    .querySelectorAll<HTMLElement>("[data-release-count]")
    .forEach((node) => (node.textContent = String(releases.length)));
  document.querySelectorAll<HTMLAnchorElement>("[data-latest-release-link]").forEach((node) => {
    node.href = `#${releases[0]!.tag_name}`;
  });
  document
    .querySelectorAll<HTMLElement>("[data-latest-release-tag]")
    .forEach((node) => (node.textContent = releases[0]!.tag_name));
  document
    .querySelectorAll<HTMLElement>("[data-latest-release-title]")
    .forEach((node) => (node.textContent = releases[0]!.name || releases[0]!.tag_name));
  document.querySelectorAll<HTMLTimeElement>("[data-latest-release-date]").forEach((node) => {
    node.dateTime = releases[0]!.published_at;
    node.textContent = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(releases[0]!.published_at));
  });
}
