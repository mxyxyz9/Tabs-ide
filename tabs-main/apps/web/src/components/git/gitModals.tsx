import type {
  GitBranch as GitBranchType,
  GitHistoryCommit,
} from "@tabs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { invalidateGitQueries } from "../../lib/gitReactQuery";
import { readNativeApi } from "../../nativeApi";
import { toastManager } from "../ui/toast";
import {
  AutoTextarea,
  Banner,
  Btn,
  Field,
  Modal,
  Select,
  TextInput,
} from "./gitPrimitives";

export function ResetModal({
  commit,
  onReset,
  onClose,
}: {
  commit: GitHistoryCommit;
  onReset: (mode: "soft" | "mixed" | "hard") => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"soft" | "mixed" | "hard">("mixed");
  const MODES = [
    { id: "soft" as const, label: "Soft", desc: "Move HEAD only. All changes since stay staged, ready to re-commit." },
    { id: "mixed" as const, label: "Mixed", desc: "Move HEAD and unstage. Changes since stay in your working tree." },
    { id: "hard" as const, label: "Hard", desc: "Move HEAD and discard everything — commits and working tree changes both. Cannot be undone." },
  ];
  return (
    <Modal title="Reset to this commit" onClose={onClose} width="max-w-md">
      <div className="fs-12 font-mono tx-70 mb-4 px-3 py-2 rounded-lg bg-o1 border bd-2">
        {commit.shortSha} — {commit.subject}
      </div>
      <div className="flex flex-col gap-2 mb-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className="text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer"
            style={{
              borderColor: mode === m.id ? (m.id === "hard" ? "var(--sem-red-border)" : "var(--overlay-20)") : "var(--overlay-10)",
              backgroundColor: mode === m.id ? (m.id === "hard" ? "var(--sem-red-soft)" : "var(--overlay-5)") : "transparent",
            }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="fs-12 font-semibold" style={{ color: mode === m.id && m.id === "hard" ? "var(--sem-red)" : "var(--fg)" }}>
                {m.label}
              </span>
              {mode === m.id && <Check size={12} className="tx-40" />}
            </div>
            <div className="fs-11 tx-40 leading-relaxed">{m.desc}</div>
          </button>
        ))}
      </div>
      {mode === "hard" && (
        <Banner tone="bad" title="This can't be undone" body="Hard reset permanently discards commits and any uncommitted work in one step." />
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary onClick={() => onReset(mode)}>
          Reset ({mode})
        </Btn>
      </div>
    </Modal>
  );
}

export function ForcePushModal({ branch, onConfirm, onClose }: { branch: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title="Force push" onClose={onClose} width="max-w-sm">
      <Banner
        tone="bad"
        title="This overwrites the remote branch"
        body={`If anyone else has pushed to ${branch} since your last pull, force-pushing discards their commits on the remote. This is common after an amend or rebase, but double-check before continuing.`}
      />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary onClick={onConfirm}>
          Force push anyway
        </Btn>
      </div>
    </Modal>
  );
}

export function StashModal({ onStash, onClose }: { onStash: (msg: string) => void; onClose: () => void }) {
  const [message, setMessage] = useState("");
  return (
    <Modal title="Stash changes" onClose={onClose} width="max-w-sm">
      <Field label="Message (optional)">
        <TextInput value={message} onChange={(e) => setMessage(e.target.value)} placeholder="WIP: pagination edge case" />
      </Field>
      <p className="fs-11 tx-40 leading-relaxed mb-4">Sets aside everything currently staged and unstaged, and clears your working tree.</p>
      <div className="flex items-center justify-end gap-2">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary onClick={() => onStash(message.trim())}>
          Stash changes
        </Btn>
      </div>
    </Modal>
  );
}

export function PullSourceModal({
  branches,
  currentBranch,
  remoteName = "origin",
  onClose,
  onConfirm,
}: {
  branches: ReadonlyArray<GitBranchType>;
  currentBranch: string;
  remoteName?: string;
  onClose: () => void;
  onConfirm: (sourceBranch: string) => void;
}) {
  const [source, setSource] = useState(currentBranch);
  return (
    <Modal title="Stash, pull & reapply" onClose={onClose} width="max-w-sm">
      <Field label="Pull from">
        <Select value={source} onChange={(e) => setSource(e.target.value)}>
          {branches.map((b) => (
            <option key={b.name} value={b.name}>
              {remoteName}/{b.name}
              {b.name === currentBranch ? " (your tracked branch)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <p className="fs-11 tx-40 leading-relaxed mb-4">
        Defaults to your own branch's upstream. Pick a different branch to pull in someone else's work instead. Your current changes are stashed first either way, and reapplied after.
      </p>
      <div className="flex items-center justify-end gap-2">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary icon={RefreshCw} onClick={() => onConfirm(source)}>
          Stash, pull &amp; reapply
        </Btn>
      </div>
    </Modal>
  );
}

export function DiscardAllModal({ count, onConfirm, onClose }: { count: number; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title="Discard all changes" onClose={onClose} width="max-w-sm">
      <Banner
        tone="bad"
        title={`This discards ${count} file${count === 1 ? "" : "s"}`}
        body="Every uncommitted change in the working tree and staging area is permanently lost. This can't be undone."
      />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary onClick={onConfirm}>
          Discard everything
        </Btn>
      </div>
    </Modal>
  );
}

export function CreatePRModal({
  currentBranch,
  branches,
  lastSubject,
  onCreate,
  onClose,
}: {
  currentBranch: string;
  branches: ReadonlyArray<GitBranchType>;
  lastSubject: string;
  onCreate: (pr: { title: string; base: string; body: string; draft: boolean }) => void | Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(lastSubject);
  const [base, setBase] = useState(branches.find((b) => b.name !== currentBranch)?.name || "main");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);

  return (
    <Modal title="Create pull request" onClose={onClose}>
      <div className="flex items-center gap-2 mb-4 fs-12 font-mono">
        <span className="px-2 py-1 rounded bg-o1 border bd-2 tx-70">{base}</span>
        <span className="tx-30">&larr;</span>
        <span className="px-2 py-1 rounded bg-o1 border bd-2 tx">{currentBranch}</span>
      </div>
      <Field label="Base branch">
        <Select value={base} onChange={(e) => setBase(e.target.value)}>
          {branches
            .filter((b) => b.name !== currentBranch)
            .map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Describe the change" />
      </Field>
      <Field label="Description">
        <AutoTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add more detail for reviewers (optional)…"
          minRows={3}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors"
        />
      </Field>
      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
        <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} className="w-3.5 h-3.5" />
        <span className="text-xs tx-60">Open as draft</span>
      </label>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary disabled={!title.trim()} onClick={() => void onCreate({ title: title.trim(), base, body: body.trim(), draft })}>
          {draft ? "Create draft" : "Create pull request"}
        </Btn>
      </div>
    </Modal>
  );
}

export function AddRemoteModal({ onAdd, onClose }: { onAdd: (r: { name: string; url: string }) => void; onClose: () => void }) {
  const [name, setName] = useState("origin");
  const [url, setUrl] = useState("");
  return (
    <Modal title="Add remote" onClose={onClose} width="max-w-md">
      <Field label="Remote name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Remote URL">
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="git@github.com:org/repo.git" />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary disabled={!url.trim()} onClick={() => onAdd({ name: name.trim() || "origin", url: url.trim() })}>
          Add remote
        </Btn>
      </div>
    </Modal>
  );
}

export function DeviceAuthModal({
  cwd,
  title = "Sign in to GitHub",
  subtitle = "Interactive GitHub authentication will open in the integrated terminal drawer.",
  onRunGitHubLogin,
  onConfirm,
  onClose,
}: {
  cwd: string;
  title?: string;
  subtitle?: string;
  onRunGitHubLogin: () => void | Promise<void>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [authStatusText, setAuthStatusText] = useState<string | null>(null);
  const api = readNativeApi();
  const queryClient = useQueryClient();

  const handleStartAuth = () => {
    void onRunGitHubLogin();
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setAuthStatusText("Checking GitHub auth status…");
    try {
      if (api) {
        const env = await api.git.environment({ cwd });
        await invalidateGitQueries(queryClient);
        if (env.gitHub.authenticated) {
          toastManager.add({ type: "success", title: "GitHub authenticated successfully" });
          onConfirm();
          return;
        }
      }
    } catch {
      // Ignore
    }
    setAuthStatusText("Auth check complete");
    setTimeout(() => {
      onConfirm();
    }, 500);
  };

  return (
    <Modal title={title} onClose={onClose} width="max-w-sm">
      <p className="text-xs tx-50 leading-relaxed mb-4">{subtitle}</p>
      <div className="border bd-2 rounded-lg p-3 mb-4 flex flex-col gap-2" style={{ backgroundColor: "var(--bg-base)" }}>
        <p className="fs-11 tx-60">Click below to launch interactive sign in in your terminal:</p>
        <Btn sm primary icon={ExternalLink} onClick={handleStartAuth}>
          Start `gh auth login` in terminal
        </Btn>
      </div>
      {authStatusText && <p className="fs-11 text-center font-mono tx-40 mb-3">{authStatusText}</p>}
      <div className="flex items-center justify-end gap-2">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary icon={confirming ? Loader2 : undefined} disabled={confirming} onClick={() => void handleConfirm()}>
          {confirming ? "Verifying…" : "I've authorized it"}
        </Btn>
      </div>
    </Modal>
  );
}

export function NewWorktreeModal({
  branches,
  currentBranch,
  onCreate,
  onClose,
}: {
  branches: ReadonlyArray<GitBranchType>;
  currentBranch: string;
  onCreate: (input: { base: string; branch: string; path: string }) => void;
  onClose: () => void;
}) {
  const [base, setBase] = useState(currentBranch);
  const [branch, setBranch] = useState("");
  const [path, setPath] = useState("../worktree-folder");
  return (
    <Modal title="New worktree" onClose={onClose} width="max-w-md">
      <Field label="Based on">
        <Select value={base} onChange={(e) => setBase(e.target.value)}>
          {branches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="New branch name (optional)">
        <TextInput value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Leave blank to check out existing branch" />
      </Field>
      <Field label="Path">
        <TextInput value={path} onChange={(e) => setPath(e.target.value)} />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn primary disabled={!path.trim()} onClick={() => onCreate({ base, branch: branch.trim() || base, path: path.trim() })}>
          Create worktree
        </Btn>
      </div>
    </Modal>
  );
}

export function DraftReleaseModal({
  tags,
  commits,
  onPublish,
  onClose,
}: {
  tags: ReadonlyArray<{ name: string }>;
  commits: ReadonlyArray<GitHistoryCommit>;
  onPublish: (rel: { tag: string; title: string; notes: string; prerelease: boolean }) => void;
  onClose: () => void;
}) {
  const [tag, setTag] = useState(tags[0]?.name || "__new__");
  const [customTag, setCustomTag] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [prerelease, setPrerelease] = useState(false);
  const effectiveTag = tag === "__new__" ? customTag.trim() : tag;

  const generateNotes = () => {
    const bullets = commits.slice(0, 5).map((c) => `- ${c.subject}`).join("\n");
    setNotes(bullets);
    if (!title.trim()) setTitle(effectiveTag || "Release");
  };

  return (
    <Modal title="Draft a release" onClose={onClose}>
      <Field label="Tag">
        <Select value={tag} onChange={(e) => setTag(e.target.value)}>
          {tags.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
          <option value="__new__">Create a new tag…</option>
        </Select>
      </Field>
      {tag === "__new__" && (
        <Field label="New tag name">
          <TextInput value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="v1.5.0" />
        </Field>
      )}
      <Field label="Release title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={effectiveTag || "Release title"} />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            <span>Release notes</span>
            <button type="button" onClick={generateNotes} className="normal-case tracking-normal fs-10 tx-40 hov-tx-70 flex items-center gap-1 cursor-pointer">
              <Sparkles size={10} /> Generate from recent commits
            </button>
          </span>
        }
      >
        <AutoTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What changed in this release…"
          minRows={4}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors"
        />
      </Field>
      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
        <input type="checkbox" checked={prerelease} onChange={(e) => setPrerelease(e.target.checked)} className="w-3.5 h-3.5" />
        <span className="text-xs tx-60">Mark as pre-release</span>
      </label>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          primary
          disabled={!effectiveTag}
          onClick={() =>
            onPublish({
              tag: effectiveTag,
              title: title.trim() || effectiveTag,
              notes: notes.trim(),
              prerelease,
            })
          }
        >
          Publish release
        </Btn>
      </div>
    </Modal>
  );
}
