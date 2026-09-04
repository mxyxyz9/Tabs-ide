import { BookOpenIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "~/components/ui/input";
import { SettingsSection } from "~/routes/_chat.settings";

const TOPICS = [
  {
    title: "Composer and agents",
    summary: "Create local or worktree threads, choose models and reasoning, attach files or browser context, and respond to approvals or questions inline.",
    details: "Use a local thread when changes should happen in the current checkout. Use a worktree for isolated parallel work. Drafts, attachments, selected models, and pending input are kept per environment and thread.",
  },
  {
    title: "Remote environments",
    summary: "Connect through direct HTTPS pairing, SSH, Tailscale, or an account-managed Tabs Connect relay.",
    details: "Open Connections to add and verify a host. Tabs validates the environment identity, obtains a scoped session, and renews websocket authorization after reconnects. Passwords are passed only to the local SSH process and are not stored.",
  },
  {
    title: "Browser collaboration",
    summary: "Share a persistent browser with an agent while retaining human control, profiles, DevTools, screenshots, recordings, and annotations.",
    details: "Browser sessions use isolated profiles. Human input interrupts stale agent actions. Pick Element captures real DOM context; annotation tools attach marked regions, ink, style changes, and comments to the next message.",
  },
  {
    title: "Source control and pull requests",
    summary: "Review changes, stage and commit, manage branches and worktrees, and work with GitHub, GitLab, Azure DevOps, or Bitbucket pull requests.",
    details: "Provider-backed review threads support inline comments, replies, resolution, reactions, checks, and verdicts where the host supports them. Operations run in the selected environment and project workspace.",
  },
  {
    title: "Thread lifecycle",
    summary: "Rename, regenerate titles, pin, settle, snooze, archive, delete, or start another thread from the same branch.",
    details: "Settling keeps completed work out of the active list without removing it. Snoozing returns it later. Archiving preserves history; deleting permanently removes the conversation and can optionally clean up an orphaned worktree.",
  },
  {
    title: "Diagnostics and support",
    summary: "Inspect attributed process CPU and memory, retained history, structured traces, background policy, and export a redacted support bundle.",
    details: "Diagnostics are read from the selected environment. Support exports redact home paths and token-shaped credentials before download. Process ownership distinguishes backend, provider, terminal, Git, and browser activity.",
  },
  {
    title: "Keyboard shortcuts",
    summary: "Search, add, replace, and remove application shortcuts from Keybindings settings.",
    details: "The command palette exposes navigation, project, thread, and action commands. Shortcut conflicts are detected before replacement, and project scripts can be assigned command IDs and keybindings.",
  },
] as const;

export function DocumentationSettings() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? TOPICS.filter((topic) => `${topic.title} ${topic.summary} ${topic.details}`.toLowerCase().includes(needle))
      : TOPICS;
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-[28px] font-bold leading-relaxed text-foreground">Documentation</h2>
        <p className="text-sm text-muted-foreground">A practical guide to the capabilities available in this build of Tabs.</p>
      </div>
      <SettingsSection title="Browse topics">
        <div className="border-b border-border/60 p-4 sm:px-5">
          <label className="relative block">
            <span className="sr-only">Search documentation</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Tabs documentation" className="pl-9" />
          </label>
        </div>
        <div aria-live="polite">
          {visible.map((topic) => (
            <details key={topic.title} className="group border-t border-border/60 px-5 py-4 first:border-t-0">
              <summary className="cursor-pointer list-none text-[13px] font-semibold marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-center gap-2"><BookOpenIcon className="size-4 text-muted-foreground" />{topic.title}</span>
                <span className="mt-1 block pl-6 text-xs font-normal leading-relaxed text-muted-foreground">{topic.summary}</span>
              </summary>
              <p className="mt-3 pl-6 text-xs leading-relaxed text-foreground/85">{topic.details}</p>
            </details>
          ))}
          {visible.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">No documentation topics match “{query}”.</p> : null}
        </div>
      </SettingsSection>
    </div>
  );
}
