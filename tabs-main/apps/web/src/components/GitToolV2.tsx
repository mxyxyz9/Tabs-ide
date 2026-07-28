import {
  type GitBranch as GitBranchType,
  type GitEnvironmentResult,
  type GitHistoryCommit,
  type GitHubAccount,
  type GitStashEntry,
  type GitStatusFile,
  type GitStatusResult,
  type ThreadId,
} from "@tabs/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  Download,
  ExternalLink,
  FileDiff,
  FolderGit2,
  GitBranch as GitBranchIcon,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Github,
  History as HistoryIcon,
  KeyRound,
  Loader2,
  Minus,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Tag,
  Terminal,
  Trash2,
  Undo2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { randomUUID } from "../lib/utils";

import {
  gitBranchesQueryOptions,
  gitEnvironmentQueryOptions,
  gitHistoryQueryOptions,
  gitHubLogoutMutationOptions,
  gitHubSwitchAccountMutationOptions,
  gitInitMutationOptions,
  gitStashListQueryOptions,
  gitStatusQueryOptions,
  invalidateGitQueries,
} from "../lib/gitReactQuery";
import { toGitUserFacingErrorMessage } from "../lib/gitErrorMessages";
import { readNativeApi } from "../nativeApi";
import { GitEnvironmentGate } from "./git/GitEnvironmentGate";
import { toastManager } from "./ui/toast";

/* ============================== Types ============================== */

export interface GitToolV2Props {
  cwd: string;
  activeThreadId: ThreadId | null;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  onRunInTerminal: (command: string) => void;
  onOpenAgents: () => void | Promise<void>;
  onRunGitHubLogin: () => void | Promise<void>;
}

type NavPanel =
  | "overview"
  | "changes"
  | "diff"
  | "branches"
  | "history"
  | "prs"
  | "tags"
  | "stashes"
  | "accounts"
  | "settings";

interface NavItem {
  id: NavPanel;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: "changes" | "prs";
}

const ACCENT = "var(--accent)";
const ACCENT_CONTRAST = "var(--accent-contrast)";

const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: FolderGit2, desc: "Repo health, quick actions, and sync status" },
  { id: "changes", label: "Changes", icon: GitCommit, badge: "changes", desc: "Stage, commit, and review working tree changes" },
  { id: "diff", label: "Diff", icon: FileDiff, desc: "Browse diffs for working tree files or past commits" },
  { id: "branches", label: "Branches", icon: GitBranchIcon, desc: "Switch, create, or rename branches" },
  { id: "history", label: "History", icon: HistoryIcon, desc: "Commit timeline for the current branch" },
  { id: "prs", label: "Pull requests", icon: GitPullRequest, badge: "prs", desc: "Open, review, and create pull requests" },
  { id: "tags", label: "Tags & releases", icon: Tag, desc: "Tag commits and draft releases" },
  { id: "stashes", label: "Stashes", icon: Package, desc: "Set changes aside and reapply them later" },
  { id: "accounts", label: "Accounts", icon: Users, desc: "Manage which GitHub account this project uses" },
  { id: "settings", label: "Settings", icon: Settings, desc: "Git identity, remotes, and repo-level config" },
];

const STRATEGY_LABEL: Record<string, string> = {
  ours: "Using current",
  theirs: "Using incoming",
  both: "Using both",
  manual: "Edited manually",
};

const TONE = {
  ok: { color: "var(--sem-emerald)", dot: "var(--sem-emerald)", soft: "var(--sem-emerald-soft)", border: "var(--sem-emerald-border)" },
  warn: { color: "var(--sem-amber)", dot: "var(--sem-amber)", soft: "var(--sem-amber-soft)", border: "var(--sem-amber-border)" },
  bad: { color: "var(--sem-red)", dot: "var(--sem-red)", soft: "var(--sem-red-soft)", border: "var(--sem-red-border)" },
  info: { color: "var(--sem-sky)", dot: "var(--sem-sky)", soft: "var(--sem-sky-soft)", border: "var(--sem-sky-border)" },
};

/* ============================== Primitives ============================== */

function Banner({
  tone = "info",
  title,
  body,
  actions,
}: {
  tone?: "ok" | "warn" | "bad" | "info";
  title: string;
  body?: string;
  actions?: ReactNode;
}) {
  const c = TONE[tone];
  const Icon = tone === "warn" ? AlertTriangle : CircleAlert;
  return (
    <div
      className="w-full flex items-start gap-3 rounded-lg border px-4 py-3 mb-4"
      style={{ borderColor: c.border, backgroundColor: c.soft }}
    >
      <Icon size={14} className="shrink-0 mt-0.5" style={{ color: c.color }} />
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-xs font-semibold" style={{ color: c.color }}>
          {title}
        </span>
        {body && <span className="text-xs tx-50 leading-relaxed">{body}</span>}
        {actions && <div className="flex flex-wrap items-center gap-2 mt-1">{actions}</div>}
      </div>
    </div>
  );
}

function Btn({
  children,
  icon: Icon,
  primary,
  ghost,
  sm,
  disabled,
  title,
  onClick,
  as: As = "button",
  href,
  className: extraClass = "",
}: {
  children?: ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }> | undefined;
  primary?: boolean;
  ghost?: boolean;
  sm?: boolean;
  disabled?: boolean;
  title?: string | undefined;
  onClick?: () => void;
  as?: "button" | "a";
  href?: string;
  className?: string;
}) {
  const cls = `inline-flex items-center gap-1.5 rounded-lg font-medium transition-all shrink-0 cursor-pointer ${
    sm ? "h-6 px-2 fs-11" : "h-7 px-2.5 text-xs"
  } ${
    primary
      ? "hover:opacity-90"
      : ghost
        ? "bg-transparent hov-bg-o1 border bd-1 hov-bd-2 tx-60 hov-tx-90"
        : "bg-o1 hov-bg-o2 bd-1 hov-bd-2 tx-70 hov-tx"
  } ${disabled ? "opacity-30 cursor-not-allowed pointer-events-none" : ""} ${extraClass}`;
  const style = primary && !disabled ? { backgroundColor: ACCENT, color: ACCENT_CONTRAST } : undefined;
  const content = (
    <>
      {Icon && <Icon size={sm ? 11 : 12} className={Icon === Loader2 ? "animate-spin" : ""} />}
      {children}
    </>
  );
  if (As === "a") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={cls} style={style}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls} style={style}>
      {content}
    </button>
  );
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-5 mb-2 first:mt-0">
      <span className="text-xs font-mono uppercase tracking-widest tx-30">{children}</span>
      {action}
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border bd-2 rounded-lg ${className}`} style={{ backgroundColor: "var(--bg-surface)" }}>
      {children}
    </div>
  );
}

function PathBreadcrumb({ path }: { path: string }) {
  const parts = path.split("/");
  const file = parts.pop();
  return (
    <span className="text-xs font-mono truncate flex items-center gap-1 min-w-0" title={path}>
      {parts.length > 0 && <span className="tx-30 truncate">{parts.join("/")}/</span>}
      <span className="tx-85 font-medium shrink-0">{file}</span>
    </span>
  );
}

function FilePathLabel({ path, size = "fs-11" }: { path: string; size?: string }) {
  const parts = path.split("/");
  const file = parts.pop();
  const dir = parts.join("/");
  return (
    <div className="min-w-0 flex-1" title={path}>
      {dir && <div className="fs-10 font-mono tx-30 truncate leading-tight">{dir}/</div>}
      <div className={`${size} font-mono tx-80 truncate leading-tight`}>{file}</div>
    </div>
  );
}

function StatPill({ ins, del }: { ins: number; del: number }) {
  return (
    <span className="flex items-center gap-1.5 fs-11 font-mono shrink-0">
      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--sem-emerald-soft)", color: "var(--sem-emerald)" }}>
        +{ins}
      </span>
      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--sem-red-soft)", color: "var(--sem-red)" }}>
        -{del}
      </span>
    </span>
  );
}

interface BadgeProps {
  children: ReactNode;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "emerald" | "amber" | "red" | "purple" | "sky" | "muted" | "open" | "draft" | "merged" | "closed";
  mono?: boolean;
  className?: string;
}

function Badge({ children, icon: Icon, tone = "default", mono = true, className = "" }: BadgeProps) {
  const TONES: Record<string, { color: string; bg: string; border?: string }> = {
    default: {
      color: "color-mix(in srgb, var(--foreground) 80%, transparent)",
      bg: "color-mix(in srgb, var(--foreground) 6%, transparent)",
      border: "color-mix(in srgb, var(--foreground) 15%, transparent)",
    },
    emerald: { color: "var(--sem-emerald)", bg: "var(--sem-emerald-soft)", border: "var(--sem-emerald-border)" },
    open: { color: "var(--sem-emerald)", bg: "var(--sem-emerald-soft)", border: "var(--sem-emerald-border)" },
    amber: { color: "var(--sem-amber)", bg: "var(--sem-amber-soft)", border: "var(--sem-amber-border)" },
    red: { color: "var(--sem-red)", bg: "var(--sem-red-soft)", border: "var(--sem-red-border)" },
    closed: { color: "var(--sem-red)", bg: "var(--sem-red-soft)", border: "var(--sem-red-border)" },
    purple: { color: "var(--sem-purple)", bg: "var(--sem-purple-soft)", border: "rgba(192, 132, 252, 0.25)" },
    merged: { color: "var(--sem-purple)", bg: "var(--sem-purple-soft)", border: "rgba(192, 132, 252, 0.25)" },
    sky: { color: "var(--sem-sky)", bg: "var(--sem-sky-soft)", border: "var(--sem-sky-border)" },
    muted: {
      color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
      bg: "color-mix(in srgb, var(--foreground) 5%, transparent)",
      border: "color-mix(in srgb, var(--foreground) 10%, transparent)",
    },
    draft: {
      color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
      bg: "color-mix(in srgb, var(--foreground) 5%, transparent)",
      border: "color-mix(in srgb, var(--foreground) 10%, transparent)",
    },
  };

  const currentTone = TONES[tone] || TONES.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border bd-2 fs-10 ${
        mono ? "font-mono" : "font-medium"
      } shrink-0 ${className}`}
      style={{
        color: currentTone.color,
        backgroundColor: currentTone.bg,
        borderColor: currentTone.border || "color-mix(in srgb, var(--foreground) 12%, transparent)",
      }}
    >
      {Icon && <Icon size={11} className="shrink-0" />}
      {children}
    </span>
  );
}

function withLineNumbers(lines: Array<{ type: string; text: string }>) {
  let oldNo = 0;
  let newNo = 0;
  return lines.map((l) => {
    if (l.type === "hunk") {
      const m1 = l.text.match(/-(\d+)/);
      const m2 = l.text.match(/\+(\d+)/);
      if (m1 && m1[1]) oldNo = parseInt(m1[1], 10);
      if (m2 && m2[1]) newNo = parseInt(m2[1], 10);
      return { ...l, oldNo: null, newNo: null };
    }
    if (l.type === "del") return { ...l, oldNo: oldNo++, newNo: null };
    if (l.type === "add") return { ...l, oldNo: null, newNo: newNo++ };
    return { ...l, oldNo: oldNo++, newNo: newNo++ };
  });
}

function DiffLines({ lines }: { lines: Array<{ type: string; text: string }> }) {
  const numbered = withLineNumbers(lines);
  return (
    <div className="font-mono fs-12" style={{ lineHeight: 1.75 }}>
      {numbered.map((l, i) => {
        if (l.type === "hunk") {
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="flex-1 h-px bg-o2" />
              <span className="fs-10 tx-30 whitespace-pre shrink-0">{l.text}</span>
              <div className="flex-1 h-px bg-o2" />
            </div>
          );
        }
        const isAdd = l.type === "add";
        const isDel = l.type === "del";
        const barColor = isAdd ? "var(--sem-emerald)" : isDel ? "var(--sem-red)" : "transparent";
        const rowStyle = {
          backgroundColor: isAdd ? "var(--sem-emerald-soft)" : isDel ? "var(--sem-red-soft)" : "transparent",
          borderLeft: `2px solid ${barColor}`,
        };
        return (
          <div key={i} className="flex" style={rowStyle}>
            <span className="w-7 shrink-0 text-right pr-1.5 select-none fs-10 tx-20">{l.oldNo || ""}</span>
            <span className="w-7 shrink-0 text-right pr-1.5 select-none fs-10 tx-20 border-r bd-1 mr-2">{l.newNo || ""}</span>
            <span className="w-3 shrink-0 select-none fs-11" style={{ color: isAdd ? "var(--sem-emerald)" : isDel ? "var(--sem-red)" : "var(--fg-20)" }}>
              {isAdd ? "+" : isDel ? "-" : ""}
            </span>
            <span className="whitespace-pre pr-3" style={{ color: isAdd ? "var(--sem-emerald-text)" : isDel ? "var(--sem-red-text)" : "var(--fg-60)" }}>
              {l.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DiffCard({ path, ins, del, lines }: { path: string; ins: number; del: number; lines: Array<{ type: string; text: string }> }) {
  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bd-2 bg-o05 shrink-0">
        <PathBreadcrumb path={path} />
        <StatPill ins={ins} del={del} />
      </div>
      <div className="flex-1 py-2 overflow-auto custom-scrollbar">
        <DiffLines lines={lines} />
      </div>
    </Card>
  );
}

function Dropdown({
  trigger,
  children,
  open,
  setOpen,
  align = "left",
  width = "w-72",
}: {
  trigger: (toggle: () => void) => ReactNode;
  children: ReactNode;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  align?: "left" | "right";
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setOpen]);
  return (
    <div className="relative" ref={ref}>
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div
          className={`absolute top-full mt-2 ${align === "right" ? "right-0" : "left-0"} ${width} rounded-xl shadow-2xl overflow-hidden z-50 border bd-2`}
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function InlineForm({
  placeholder,
  initial = "",
  onSubmit,
  onCancel,
  submitLabel = "Save",
  className = "",
}: {
  placeholder: string;
  initial?: string;
  onSubmit: (val: string) => void;
  onCancel: () => void;
  submitLabel?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className={`flex items-center gap-2 bg-o1 border bd-2 rounded-lg px-2.5 py-2 ${className || "mb-2"}`}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs font-mono tx outline-none min-w-0"
      />
      <Btn sm primary disabled={!value.trim()} onClick={() => value.trim() && onSubmit(value.trim())}>
        {submitLabel}
      </Btn>
      <Btn sm ghost onClick={onCancel}>
        Cancel
      </Btn>
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  minRows = 2,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      style={{ backgroundColor: "var(--bg-base)", resize: "none", overflow: "hidden" }}
    />
  );
}

/* ============================== Modals ============================== */

const Field = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="mb-3">
    <label className="fs-10 uppercase tracking-widest tx-30 block mb-1.5">{label}</label>
    {children}
  </div>
);

const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full border bd-2 rounded-lg tx text-xs ph-25 px-3 py-2 outline-none foc-bd-3 transition-colors ${props.className || ""}`}
    style={{ backgroundColor: "var(--bg-base)" }}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full border bd-2 rounded-lg tx text-xs px-3 py-2 outline-none foc-bd-3 transition-colors ${props.className || ""}`}
    style={{ backgroundColor: "var(--bg-base)" }}
  />
);

function Modal({
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-sm"
      style={{ backgroundColor: "color-mix(in srgb, var(--background) 65%, transparent)" }}
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-xl border bd-2 shadow-2xl overflow-hidden`}
        style={{ backgroundColor: "var(--bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b bd-1">
          <span className="text-sm font-semibold tx">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ResetModal({
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

function ForcePushModal({ branch, onConfirm, onClose }: { branch: string; onConfirm: () => void; onClose: () => void }) {
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

function StashModal({ onStash, onClose }: { onStash: (msg: string) => void; onClose: () => void }) {
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

function PullSourceModal({
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

function DiscardAllModal({ count, onConfirm, onClose }: { count: number; onConfirm: () => void; onClose: () => void }) {
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

function CreatePRModal({
  currentBranch,
  branches,
  lastSubject,
  onCreate,
  onClose,
}: {
  currentBranch: string;
  branches: ReadonlyArray<GitBranchType>;
  lastSubject: string;
  onCreate: (pr: { title: string; base: string; body: string; draft: boolean }) => void;
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
        <Btn primary disabled={!title.trim()} onClick={() => onCreate({ title: title.trim(), base, body: body.trim(), draft })}>
          {draft ? "Create draft" : "Create pull request"}
        </Btn>
      </div>
    </Modal>
  );
}

function AddRemoteModal({ onAdd, onClose }: { onAdd: (r: { name: string; url: string }) => void; onClose: () => void }) {
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

function DeviceAuthModal({
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

function NewWorktreeModal({
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

function DraftReleaseModal({
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

/* ============================== Sidebar ============================== */

function RailTooltip({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="relative group flex items-center justify-center">
      {children}
      <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-50">
        <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border bd-2 shadow-2xl" style={{ backgroundColor: "var(--bg-surface)", width: "190px" }}>
          <span className="fs-12 font-medium tx">{title}</span>
          {desc && (
            <span className="fs-10 tx-40" style={{ lineHeight: 1.4 }}>
              {desc}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  repoName,
  panel,
  setPanel,
  collapsed,
  setCollapsed,
  changeCount,
  prCount = 0,
  hasConflict,
}: {
  repoName: string;
  panel: NavPanel;
  setPanel: (p: NavPanel) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  changeCount: number;
  prCount?: number;
  hasConflict: boolean;
}) {
  const wrapStyle = { backgroundColor: "var(--bg-base)" };
  if (collapsed) {
    return (
      <div className="w-16 flex flex-col items-center border-r bd-1 shrink-0 h-full py-4 gap-2" style={wrapStyle}>
        <RailTooltip title={repoName} desc="Expand the sidebar for full labels and details">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="group relative w-8 h-8 rounded-lg bg-o1 hov-bg-o2 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <Github size={15} className="tx-70 group-hover:opacity-0 transition-opacity" />
            <ChevronRight size={14} className="absolute tx opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </RailTooltip>
        <div className="w-6 h-px bg-o2 shrink-0 my-1" />
        <div className="flex-1 flex flex-col items-center gap-2 w-full px-2 pt-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = panel === n.id;
            const count = n.badge === "changes" ? changeCount : n.badge === "prs" ? prCount : null;
            return (
              <RailTooltip key={n.id} title={n.label} desc={n.desc}>
                <button
                  type="button"
                  onClick={() => setPanel(n.id)}
                  className={`relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    isActive ? "bg-o2 ring-safe" : "bg-o1 hov-bg-o2"
                  }`}
                >
                  {isActive && <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ backgroundColor: "var(--fg)" }} />}
                  <Icon size={15} className="tx-70" />
                  {count ? (
                    <span
                      className="absolute -bottom-1 -right-1 h-4 px-1 rounded-full border bd-2 fs-9 font-mono flex items-center justify-center"
                      style={{
                        minWidth: "16px",
                        color: n.id === "changes" && hasConflict ? "var(--sem-red)" : "var(--fg-60)",
                        backgroundColor: "var(--bg-base)",
                      }}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              </RailTooltip>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 flex flex-col border-r bd-1 shrink-0 h-full" style={wrapStyle}>
      <div className="p-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-mono tracking-widest tx-30 uppercase">Source control</span>
          <div className="text-base font-semibold tx tracking-tight mt-0.5 truncate">{repoName}</div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 rounded-lg bg-o1 hov-bg-o2 border bd-2 hov-bd-3 flex items-center justify-center tx-60 hov-tx transition-all shrink-0 cursor-pointer"
          title="Collapse sidebar"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar px-2">
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = panel === n.id;
          const count = n.badge === "changes" ? changeCount : n.badge === "prs" ? prCount : null;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setPanel(n.id)}
              className={`group relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                isActive ? "bg-o1" : "hov-bg-o1"
              }`}
            >
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: "var(--fg)" }} />}
              <Icon size={14} className={isActive ? "tx" : "tx-40 ghov-tx-70"} />
              <span className={`fs-13 flex-1 truncate ${isActive ? "tx font-medium" : "tx-60 ghov-tx-90"}`}>{n.label}</span>
              {count ? (
                <span
                  className="fs-10 font-mono px-1.5 py-0.5 rounded-full bg-o1 border bd-1"
                  style={{ color: n.id === "changes" && hasConflict ? "var(--sem-red)" : "var(--fg-40)" }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== TopBar ============================== */

function TopBar({
  repoName,
  branchLabel,
  accentDotTone,
  accounts,
  activeAccountLogin,
  terminalOpen,
  onToggleTerminal,
  onSwitchAccount,
  onOpenAccounts,
  onOpenSignIn,
}: {
  repoName: string;
  branchLabel: string;
  accentDotTone: "ok" | "warn" | "bad" | "info";
  accounts: ReadonlyArray<GitHubAccount>;
  activeAccountLogin: string | null;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  onSwitchAccount: (login: string) => void;
  onOpenAccounts: () => void;
  onOpenSignIn: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b bd-1 shrink-0" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="flex items-center gap-2 text-xs font-mono tx-40 min-w-0">
        <FolderGit2 size={13} className="tx-30 shrink-0" />
        <span className="tx-70 truncate">{repoName}</span>
        <span className="tx-20">/</span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bd-2 bg-o1 tx shrink-0 font-medium">
          <GitBranchIcon size={11} />
          {branchLabel}
        </span>
      </div>

      <div className="flex-1" />

      {/* Account button */}
      <Dropdown
        open={accountOpen}
        setOpen={setAccountOpen}
        align="right"
        width="w-72"
        trigger={(toggle) => (
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-2 h-7 pl-1.5 pr-2.5 rounded-full bg-o1 hov-bg-o2 border bd-2 hov-bd-3 transition-all cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-o2 flex items-center justify-center fs-10 font-mono font-semibold tx-80">
              {activeAccountLogin ? activeAccountLogin[0]?.toUpperCase() : "–"}
            </span>
            <span className="text-xs font-mono tx-70">{activeAccountLogin || "signed out"}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TONE[accentDotTone].dot }} />
          </button>
        )}
      >
        {activeAccountLogin ? (
          <>
            <div className="px-3 pt-3 pb-2 fs-10 uppercase tracking-widest tx-30 font-mono">Switch account</div>
            <div className="pb-1">
              {accounts.map((a) => (
                <button
                  key={a.login}
                  type="button"
                  onClick={() => {
                    onSwitchAccount(a.login);
                    setAccountOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hov-bg-o1 transition-colors cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-full bg-o2 flex items-center justify-center fs-10 font-mono font-semibold tx-80 shrink-0">
                    {a.login[0]?.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono tx-80 flex-1 truncate">{a.login}</span>
                  {a.login === activeAccountLogin && <Check size={12} className="tx-40 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="h-px bg-o1" />
            <button
              type="button"
              onClick={() => {
                onOpenAccounts();
                setAccountOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left fs-11 tx-50 hov-tx hov-bg-o1 transition-colors cursor-pointer"
            >
              <Users size={12} /> Manage accounts
            </button>
          </>
        ) : (
          <div className="p-3">
            <div className="fs-11 tx-50 leading-relaxed mb-3">No GitHub account is signed in. Sign in to push, pull, or open pull requests.</div>
            <Btn
              primary
              className="w-full justify-center"
              onClick={() => {
                onOpenSignIn();
                setAccountOpen(false);
              }}
            >
              Sign in to GitHub
            </Btn>
          </div>
        )}
      </Dropdown>

      {/* Quick Terminal toggle button */}
      <button
        type="button"
        onClick={onToggleTerminal}
        title={terminalOpen ? "Hide terminal" : "Open terminal"}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
          terminalOpen ? "bg-o2 border bd-3 tx" : "bg-o1 hov-bg-o2 border bd-2 tx-60 hov-tx"
        }`}
      >
        <Terminal size={12} />
        <span>Terminal</span>
      </button>
    </div>
  );
}

/* ============================== FileRow ============================== */

function FileRow({
  f,
  staged,
  onOpenDiff,
  onToggleStage,
  onDiscard,
}: {
  f: GitStatusFile;
  staged: boolean;
  onOpenDiff: (f: GitStatusFile) => void;
  onToggleStage: (f: GitStatusFile) => void;
  onDiscard: (f: GitStatusFile) => void;
}) {
  return (
    <div className="group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hov-bg-o1 transition-colors">
      <button type="button" onClick={() => onOpenDiff(f)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            backgroundColor: f.untracked ? "var(--sem-emerald)" : f.deletions > 0 && f.insertions === 0 ? "var(--sem-red)" : "var(--sem-amber)",
          }}
        />
        <FilePathLabel path={f.path} size="text-xs" />
      </button>
      <span className="fs-11 font-mono shrink-0" style={{ color: "var(--sem-emerald)" }}>
        +{f.insertions}
      </span>
      <span className="fs-11 font-mono shrink-0" style={{ color: "var(--sem-red)", opacity: 0.85 }}>
        -{f.deletions}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDiscard(f);
        }}
        title="Discard changes to this file"
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center justify-center w-5 h-5 rounded bg-o1 border bd-2 tx-50 hov-tx cursor-pointer"
      >
        <Trash2 size={10} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleStage(f);
        }}
        title={staged ? "Unstage file" : "Stage file"}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center justify-center w-5 h-5 rounded bg-o1 border bd-2 tx-50 hov-tx cursor-pointer"
      >
        {staged ? <Minus size={10} /> : <Plus size={10} />}
      </button>
    </div>
  );
}

/* ============================== ConflictResolver ============================== */

interface ConflictHunk {
  header: string;
  ours: string[];
  theirs: string[];
}
interface ConflictFile {
  path: string;
  hunks: ConflictHunk[];
}

function ConflictResolver({
  files,
  resolutions,
  setResolutions,
}: {
  files: ConflictFile[];
  resolutions: Record<string, { strategy: string; text?: string }>;
  setResolutions: React.Dispatch<React.SetStateAction<Record<string, { strategy: string; text?: string }>>>;
}) {
  const [activeFile, setActiveFile] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");

  const key = (fi: number, hi: number) => `${fi}:${hi}`;
  const isResolved = (fi: number, hi: number) => Boolean(resolutions[key(fi, hi)]);
  const fileResolvedCount = (fi: number) => files[fi]?.hunks.filter((_, hi) => isResolved(fi, hi)).length ?? 0;
  const fileDone = (fi: number) => fileResolvedCount(fi) === (files[fi]?.hunks.length ?? 0);

  const setStrategy = (fi: number, hi: number, strategy: string, text?: string) => {
    setResolutions((prev) => {
      const item: { strategy: string; text?: string } = { strategy };
      if (text !== undefined) item.text = text;
      return { ...prev, [key(fi, hi)]: item };
    });
    setEditingKey(null);
  };
  const bulkAll = (strategy: string) => {
    setResolutions((prev) => {
      const next = { ...prev };
      files.forEach((f, fi) =>
        f.hunks.forEach((_, hi) => {
          next[key(fi, hi)] = { strategy };
        }),
      );
      return next;
    });
  };

  const file = files[activeFile] ?? files[0];

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        <Btn sm ghost onClick={() => bulkAll("ours")}>
          Accept all current
        </Btn>
        <Btn sm ghost onClick={() => bulkAll("theirs")}>
          Accept all incoming
        </Btn>
      </div>

      <div className="flex gap-4">
        <div className="w-48 shrink-0">
          {files.map((f, fi) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setActiveFile(fi)}
              className={`w-full text-left px-2.5 py-2 rounded-lg mb-1 transition-colors cursor-pointer ${
                activeFile === fi ? "bg-o2" : "hov-bg-o1"
              }`}
            >
              <div className="fs-11 font-mono tx-80 truncate leading-tight">{f.path.split("/").pop()}</div>
              <div className="fs-10 font-mono mt-1" style={{ color: fileDone(fi) ? "var(--sem-emerald)" : "var(--fg-30)" }}>
                {fileResolvedCount(fi)}/{f.hunks.length} resolved
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {file?.hunks.map((h, hi) => {
            const res = resolutions[key(activeFile, hi)];
            const editing = editingKey === key(activeFile, hi);
            return (
              <Card key={hi} className="mb-3 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b bd-2 bg-o05">
                  <span className="fs-11 font-mono tx-40 truncate">{h.header}</span>
                  <span
                    className="fs-10 font-mono px-1.5 py-0.5 rounded-full shrink-0"
                    style={
                      res
                        ? { color: "var(--sem-emerald)", backgroundColor: "var(--sem-emerald-soft)" }
                        : { color: "var(--sem-amber)", backgroundColor: "var(--sem-amber-soft)" }
                    }
                  >
                    {res ? STRATEGY_LABEL[res.strategy] : "Unresolved"}
                  </span>
                </div>

                {!editing ? (
                  <>
                    <div className="grid grid-cols-2">
                      <div className="border-r bd-1 min-w-0">
                        <div className="px-3 py-1.5 fs-10 uppercase tracking-widest tx-30 border-b bd-1 font-mono">Current (ours)</div>
                        <div className="font-mono fs-11 py-1 overflow-x-auto custom-scrollbar">
                          {h.ours.map((l, li) => (
                            <div key={li} className="px-3 py-0.5 whitespace-pre tx-70">
                              {l}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="px-3 py-1.5 fs-10 uppercase tracking-widest tx-30 border-b bd-1 font-mono">Incoming (theirs)</div>
                        <div className="font-mono fs-11 py-1 overflow-x-auto custom-scrollbar">
                          {h.theirs.map((l, li) => (
                            <div key={li} className="px-3 py-0.5 whitespace-pre tx-70">
                              {l}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t bd-1">
                      <Btn sm primary={res?.strategy === "ours"} onClick={() => setStrategy(activeFile, hi, "ours")}>
                        Use current
                      </Btn>
                      <Btn sm primary={res?.strategy === "theirs"} onClick={() => setStrategy(activeFile, hi, "theirs")}>
                        Use incoming
                      </Btn>
                      <Btn sm ghost onClick={() => setStrategy(activeFile, hi, "both")}>
                        Use both
                      </Btn>
                      <Btn
                        sm
                        ghost
                        onClick={() => {
                          setEditingKey(key(activeFile, hi));
                          setManualText([...h.ours, ...h.theirs].join("\n"));
                        }}
                      >
                        Edit manually
                      </Btn>
                    </div>
                  </>
                ) : (
                  <div className="p-3">
                    <AutoTextarea
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      minRows={4}
                      className="w-full border bd-2 rounded-lg tx-80 font-mono fs-11 p-3 outline-none foc-bd-3 transition-colors"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Btn sm primary onClick={() => setStrategy(activeFile, hi, "manual", manualText)}>
                        Save resolution
                      </Btn>
                      <Btn sm ghost onClick={() => setEditingKey(null)}>
                        Cancel
                      </Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {activeFile < files.length - 1 && (
            <Btn
              disabled={!fileDone(activeFile)}
              title={!fileDone(activeFile) ? "Resolve every hunk in this file first" : undefined}
              onClick={() => setActiveFile((i) => Math.min(files.length - 1, i + 1))}
            >
              Next file
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== EnvGate ============================== */

function EnvGate({
  icon: Icon,
  title,
  body,
  code,
  actions,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
  code?: string[];
  actions?: ReactNode;
}) {
  return (
    <div className="max-w-md mx-auto text-center py-14">
      <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-o1 border bd-2 flex items-center justify-center">
        <Icon size={20} className="tx-60" />
      </div>
      <div className="text-base font-semibold tx tracking-tight mb-2">{title}</div>
      <div className="text-xs tx-50 leading-relaxed mb-5">{body}</div>
      {code && (
        <div className="text-left border bd-2 rounded-lg p-3 font-mono text-xs tx-60 mb-5" style={{ backgroundColor: "var(--bg-base)" }}>
          {code.map((l, i) => (
            <div key={i}>{l || "\u00A0"}</div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-center gap-2 flex-wrap">{actions}</div>
    </div>
  );
}

/* ============================== OverviewPanel ============================== */

function OverviewPanel({
  repoName,
  statusData,
  environmentData,
  branchList,
  commits,
  onGoToChanges,
  onGoToAccounts,
  onOpenSignIn,
  onOpenAddRemote,
  onOpenCreateBranch,
  onRunInTerminal,
  onInitRepo,
}: {
  repoName: string;
  statusData: GitStatusResult | null;
  environmentData: GitEnvironmentResult | null;
  branchList: import("@tabs/contracts").GitListBranchesResult | null;
  commits: ReadonlyArray<GitHistoryCommit>;
  onGoToChanges: () => void;
  onGoToAccounts: () => void;
  onOpenSignIn: () => void;
  onOpenAddRemote: () => void;
  onOpenCreateBranch: () => void;
  onRunInTerminal: (cmd: string) => void;
  onInitRepo: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const api = readNativeApi();
  const queryClient = useQueryClient();

  const isGitInstalled = environmentData?.git.installed ?? true;
  const isRepo = branchList?.isRepo ?? true;
  const ghAuthed = environmentData?.gitHub.authenticated ?? false;
  const hasRemote = branchList?.hasOriginRemote ?? false;
  const activeAccountLogin = environmentData?.gitHub.activeLogin ?? null;
  const branchName = statusData?.branch ?? "main";
  const ahead = statusData?.aheadCount ?? 0;
  const behind = statusData?.behindCount ?? 0;
  const stagedFiles = statusData?.staged?.files ?? [];
  const unstagedFiles = statusData?.unstaged?.files ?? [];
  const conflictedFiles = statusData?.conflicted?.files ?? [];
  const changed = stagedFiles.length + unstagedFiles.length;
  const isDetached = !branchList?.branches.some((b) => b.current);
  const hasConflict = conflictedFiles.length > 0;

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const pool = (stagedFiles.length ? stagedFiles : unstagedFiles).map((f) => f.path.split("/").pop());
      const summary = pool.length ? `Update ${pool.slice(0, 2).join(", ")}${pool.length > 2 ? ` +${pool.length - 2} more` : ""}` : "";
      setMsg(summary);
      setGenerating(false);
    }, 500);
  };

  const handleCommit = async (andPush = false) => {
    if (!api || !msg.trim()) return;
    try {
      await api.git.runStackedAction({
        actionId: randomUUID(),
        cwd: statusData ? repoName : "",
        action: andPush ? "commit_push" : "commit",
        commitMessage: msg.trim(),
      });
      await invalidateGitQueries(queryClient);
      setMsg("");
      toastManager.add({ type: "success", title: andPush ? "Committed and pushed" : "Committed staged changes" });
    } catch (error) {
      toastManager.add({ type: "error", title: "Commit failed", description: toGitUserFacingErrorMessage(error) });
    }
  };

  if (!isGitInstalled) {
    return (
      <EnvGate
        icon={AlertTriangle}
        title="Git isn't installed"
        body="This project can't be tracked until Git is available on this machine. Install it, then this tab picks it up automatically."
        code={["# macOS", "brew install git", "", "# Windows", "winget install --id Git.Git"]}
        actions={
          <>
            <Btn primary onClick={() => void queryClient.invalidateQueries({ queryKey: ["git"] })}>
              Check again
            </Btn>
            <Btn ghost as="a" href="https://git-scm.com/downloads">
              Install guide
            </Btn>
          </>
        }
      />
    );
  }
  if (!isRepo) {
    return (
      <EnvGate
        icon={FolderGit2}
        title="No repository here yet"
        body={`${repoName} isn't tracked by Git. Start one to begin recording changes, or clone an existing project into this folder.`}
        actions={
          <Btn primary onClick={onInitRepo}>
            Initialize repository
          </Btn>
        }
      />
    );
  }
  if (!ghAuthed) {
    return (
      <EnvGate
        icon={KeyRound}
        title="Sign in to GitHub to continue"
        body="Pushing, pulling from a remote, and pull requests all need a signed-in GitHub account. Sign in to unlock the rest of this project."
        actions={
          <Btn primary onClick={onOpenSignIn}>
            Sign in to GitHub
          </Btn>
        }
      />
    );
  }

  return (
    <div>
      {!hasRemote && (
        <Banner
          tone="warn"
          title="No remote configured"
          body="This repo isn't connected to GitHub, so push and pull requests are turned off."
          actions={
            <Btn sm primary onClick={onOpenAddRemote}>
              Add remote
            </Btn>
          }
        />
      )}
      {hasConflict && (
        <Banner
          tone="bad"
          title={`Merge in progress — ${conflictedFiles.length} files need attention`}
          body="Resolve the conflicts in the Changes tab."
          actions={
            <Btn sm primary onClick={onGoToChanges}>
              Open conflicts
            </Btn>
          }
        />
      )}
      {ahead > 0 && behind > 0 && (
        <Banner
          tone="info"
          title={`${branchName} has diverged from origin/${branchName}`}
          body={`You're ${ahead} commit${ahead === 1 ? "" : "s"} ahead and ${behind} behind. Pull before pushing.`}
          actions={
            <Btn sm primary icon={Download} onClick={() => onRunInTerminal("git pull")}>
              Pull
            </Btn>
          }
        />
      )}
      {isDetached && (
        <Banner
          tone="warn"
          title="You're not on a branch"
          body="Commits made here won't belong to any branch. Create one from this point to keep your work safe."
          actions={
            <Btn sm primary onClick={onOpenCreateBranch}>
              Create branch here
            </Btn>
          }
        />
      )}
      {changed > 200 && (
        <Banner
          tone="info"
          title={`${changed} files changed`}
          body="Staging runs in batches so the app stays responsive — this may take a few seconds."
        />
      )}

      {/* Sync stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="p-4">
          <div className="text-2xl font-semibold tracking-tight" style={{ color: "var(--sem-amber)" }}>
            {changed}
          </div>
          <div className="fs-10 uppercase tracking-widest tx-30 mt-1">Changed files</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-semibold tracking-tight" style={{ color: "var(--sem-emerald)" }}>
            {ahead}
          </div>
          <div className="fs-10 uppercase tracking-widest tx-30 mt-1">Ahead of remote</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-semibold tracking-tight" style={{ color: behind > 0 ? "var(--sem-red)" : "var(--fg-30)" }}>
            {behind}
          </div>
          <div className="fs-10 uppercase tracking-widest tx-30 mt-1">Behind remote</div>
        </Card>
      </div>

      {/* Quick actions card */}
      <SectionLabel>Quick actions</SectionLabel>
      <Card className="p-4 mb-1">
        <div className="flex items-center justify-between mb-2">
          <span className="fs-10 uppercase tracking-widest tx-30">Commit</span>
          <span className="fs-11 font-mono tx-30">{stagedFiles.length} staged</span>
        </div>
        <AutoTextarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Summarize your change…"
          minRows={2}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              primary
              icon={GitCommit}
              disabled={!stagedFiles.length}
              title={!stagedFiles.length ? "Stage some changes first" : undefined}
              onClick={() => void handleCommit(false)}
            >
              Commit staged
            </Btn>
            <Btn
              ghost
              icon={Sparkles}
              disabled={(!stagedFiles.length && !unstagedFiles.length) || generating}
              title="Fills the box from your changed file names"
              onClick={handleGenerate}
            >
              {generating ? "Generating…" : "Generate message"}
            </Btn>
          </div>
          <Btn
            icon={Upload}
            disabled={!stagedFiles.length || !hasRemote}
            title={!hasRemote ? "No remote configured yet" : !stagedFiles.length ? "Stage some changes first" : undefined}
            onClick={() => void handleCommit(true)}
          >
            Commit &amp; push
          </Btn>
        </div>

        <div className="h-px bg-o2 my-3 -mx-4" />

        <div className="flex items-center justify-between mb-2">
          <span className="fs-10 uppercase tracking-widest tx-30">Sync</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Btn icon={Upload} disabled={!hasRemote} onClick={() => onRunInTerminal("git push")}>
              Push
            </Btn>
            <Btn ghost disabled={!hasRemote} onClick={() => onRunInTerminal(`git push --force-with-lease origin ${branchName}`)}>
              Force push
            </Btn>
            <Btn ghost icon={Download} onClick={() => onRunInTerminal("git fetch")}>
              Fetch
            </Btn>
          </div>
          <Btn ghost icon={GitPullRequest} disabled={!hasRemote} onClick={() => onRunInTerminal(`gh pr create --head ${branchName}`)}>
            Create pull request
          </Btn>
        </div>
      </Card>

      {/* Environment status card */}
      <SectionLabel>Environment</SectionLabel>
      <Card className="p-2">
        {[
          ["Git", environmentData?.git.version ?? "v2.44.0", "ok"],
          ["GitHub CLI", environmentData?.gitHub.version ?? "authenticated", "ok"],
          ["Remote", hasRemote ? "origin" : "none", hasRemote ? "ok" : "warn"],
          ["Push credential", activeAccountLogin || "not signed in", "ok"],
        ].map(([label, val, tone]) => (
          <div key={label} className="flex items-center gap-2.5 px-2 py-2 border-b bd-1 last:border-0">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TONE[tone as keyof typeof TONE].dot }} />
            <span className="text-xs tx-50 flex-1">{label}</span>
            <span className="fs-11 font-mono tx-70">{val}</span>
          </div>
        ))}
      </Card>

      {/* Recent activity card */}
      {commits.length > 0 && (
        <>
          <SectionLabel>Recent activity</SectionLabel>
          <Card className="p-2">
            {commits.slice(0, 3).map((c) => (
              <div key={c.sha} className="flex items-center gap-3 px-2 py-2 border-b bd-1 last:border-0">
                <span className="fs-10 font-mono tx-30 border bd-2 rounded px-1.5 py-0.5">{c.shortSha}</span>
                <span className="fs-12 tx-70 flex-1 truncate leading-snug">{c.subject}</span>
                <span className="fs-10 font-mono tx-25 shrink-0">{c.authoredAt.slice(0, 10)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

/* ============================== ChangesPanel ============================== */

function ChangesPanel({
  cwd,
  statusData,
  onOpenDiff,
  onOpenStash,
  onOpenDiscardAll,
  onRunInTerminal,
}: {
  cwd: string;
  statusData: GitStatusResult | null;
  onOpenDiff: (f: GitStatusFile) => void;
  onOpenStash: () => void;
  onOpenDiscardAll: () => void;
  onRunInTerminal: (cmd: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [amend, setAmend] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, { strategy: string; text?: string }>>({});

  const api = readNativeApi();
  const queryClient = useQueryClient();

  const stagedFiles = statusData?.staged?.files ?? [];
  const unstagedFiles = (statusData?.unstaged?.files ?? []).filter((f) => !f.conflicted && !f.untracked);
  const conflictedFiles = statusData?.conflicted?.files ?? [];
  const hasConflict = conflictedFiles.length > 0;
  const totalChanged = stagedFiles.length + unstagedFiles.length;

  const stageFile = useCallback(
    async (f: GitStatusFile) => {
      if (!api) return;
      try {
        await api.git.stageFiles({ cwd, paths: [f.path] });
        await invalidateGitQueries(queryClient);
      } catch (error) {
        toastManager.add({ type: "error", title: "Stage failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const unstageFile = useCallback(
    async (f: GitStatusFile) => {
      if (!api) return;
      try {
        await api.git.unstageFiles({ cwd, paths: [f.path] });
        await invalidateGitQueries(queryClient);
      } catch (error) {
        toastManager.add({ type: "error", title: "Unstage failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const discardFile = useCallback(
    async (f: GitStatusFile) => {
      if (!api) return;
      try {
        await api.git.discardChanges({ cwd, paths: [f.path] });
        await invalidateGitQueries(queryClient);
        toastManager.add({ type: "success", title: `Discarded ${f.path.split("/").pop()}` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Discard failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const stageAll = useCallback(async () => {
    if (!api || unstagedFiles.length === 0) return;
    try {
      await api.git.stageFiles({ cwd, paths: unstagedFiles.map((f) => f.path) });
      await invalidateGitQueries(queryClient);
    } catch (error) {
      toastManager.add({ type: "error", title: "Stage all failed", description: toGitUserFacingErrorMessage(error) });
    }
  }, [api, cwd, queryClient, unstagedFiles]);

  const unstageAll = useCallback(async () => {
    if (!api || stagedFiles.length === 0) return;
    try {
      await api.git.unstageFiles({ cwd, paths: stagedFiles.map((f) => f.path) });
      await invalidateGitQueries(queryClient);
    } catch (error) {
      toastManager.add({ type: "error", title: "Unstage all failed", description: toGitUserFacingErrorMessage(error) });
    }
  }, [api, cwd, queryClient, stagedFiles]);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const names = stagedFiles.map((f) => f.path.split("/").pop());
      const summary = names.length ? `Update ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2} more` : ""}` : "";
      setMsg(summary);
      setGenerating(false);
    }, 500);
  };

  const handleCommit = async (andPush = false) => {
    if (!api) return;
    try {
      if (amend) {
        await api.git.amendCommit({ cwd, message: msg.trim() || undefined });
      } else {
        await api.git.runStackedAction({
          actionId: randomUUID(),
          cwd,
          action: andPush ? "commit_push" : "commit",
          commitMessage: msg.trim(),
        });
      }
      await invalidateGitQueries(queryClient);
      setMsg("");
      toastManager.add({ type: "success", title: amend ? "Amended commit" : andPush ? "Committed and pushed" : "Committed staged" });
    } catch (error) {
      toastManager.add({ type: "error", title: "Commit failed", description: toGitUserFacingErrorMessage(error) });
    }
  };

  const [realConflictFiles, setRealConflictFiles] = useState<ConflictFile[]>([]);

  useEffect(() => {
    if (!hasConflict || conflictedFiles.length === 0 || !api) return;
    let cancelled = false;

    Promise.all(
      conflictedFiles.map(async (f) => {
        let hunks: ConflictHunk[] = [];
        try {
          const res = await api.projects.readFile({ cwd, relativePath: f.path });
          if (res?.contents) {
            const lines = res.contents.split("\n");
            let inConflict = false;
            let inTheirs = false;
            let header = "";
            let ours: string[] = [];
            let theirs: string[] = [];

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i]!;
              if (line.startsWith("<<<<<<<")) {
                inConflict = true;
                inTheirs = false;
                header = `@@ Line ${i + 1}: ${line} @@`;
                ours = [];
                theirs = [];
              } else if (inConflict && line.startsWith("=======")) {
                inTheirs = true;
              } else if (inConflict && line.startsWith(">>>>>>>")) {
                inConflict = false;
                hunks.push({ header, ours, theirs });
              } else if (inConflict) {
                if (inTheirs) theirs.push(line);
                else ours.push(line);
              }
            }
          }
        } catch {
          // Ignore read error
        }

        if (hunks.length === 0) {
          try {
            const snap = await api.git.readConflictSnapshot({ cwd, path: f.path });
            if (snap.oursContents || snap.theirsContents) {
              hunks.push({
                header: `@@ Conflict in ${f.path} @@`,
                ours: snap.oursContents ? snap.oursContents.split("\n") : [],
                theirs: snap.theirsContents ? snap.theirsContents.split("\n") : [],
              });
            }
          } catch {
            // Ignore snapshot error
          }
        }

        if (hunks.length === 0) {
          hunks.push({
            header: `@@ Conflict in ${f.path} @@`,
            ours: ["<<<<<<< HEAD (Current branch)"],
            theirs: [">>>>>>> incoming (Incoming branch)"],
          });
        }

        return { path: f.path, hunks };
      })
    ).then((resolvedFiles) => {
      if (!cancelled) {
        setRealConflictFiles(resolvedFiles);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [api, cwd, hasConflict, conflictedFiles]);

  if (hasConflict) {
    const activeFiles = realConflictFiles.length > 0 ? realConflictFiles : conflictedFiles.map((f) => ({
      path: f.path,
      hunks: [
        {
          header: `@@ Conflict in ${f.path.split("/").pop()} @@`,
          ours: ["<<<<<<< HEAD"],
          theirs: [">>>>>>> incoming"],
        },
      ],
    }));
    return (
      <div>
        <Banner
          tone="bad"
          title={`${conflictedFiles.length} conflicting files`}
          body="Resolve each hunk below, then continue the merge. Nothing is written until you choose a resolution."
        />
        <ConflictResolver files={activeFiles} resolutions={conflictResolutions} setResolutions={setConflictResolutions} />
        <div className="flex items-center gap-2 mt-4">
          <Btn primary icon={GitMerge} onClick={() => onRunInTerminal("git commit --no-edit")}>
            Continue merge
          </Btn>
          <Btn ghost onClick={() => onRunInTerminal("git merge --abort")}>
            Abort merge
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      {totalChanged > 200 && (
        <Banner
          tone="info"
          title="Large changeset"
          body={`Showing ${totalChanged} files. Staging everything runs as one batched operation.`}
        />
      )}

      <SectionLabel
        action={
          <div className="flex items-center gap-2">
            <Btn sm ghost disabled={!totalChanged} onClick={onOpenStash}>
              Stash changes
            </Btn>
            <Btn sm ghost disabled={!totalChanged} onClick={onOpenDiscardAll}>
              Discard all
            </Btn>
          </div>
        }
      >
        Working tree
      </SectionLabel>

      <SectionLabel action={<Btn sm ghost disabled={!unstagedFiles.length} onClick={() => void unstageAll()}>Unstage all</Btn>}>
        Staged ({stagedFiles.length})
      </SectionLabel>
      <Card className="p-1.5">
        {stagedFiles.length === 0 ? (
          <div className="text-center fs-11 tx-25 py-3">Nothing staged yet</div>
        ) : (
          stagedFiles.map((f) => (
            <FileRow
              key={f.path}
              f={f}
              staged
              onOpenDiff={onOpenDiff}
              onToggleStage={(file) => void unstageFile(file)}
              onDiscard={(file) => void discardFile(file)}
            />
          ))
        )}
      </Card>

      <SectionLabel action={<Btn sm ghost disabled={!unstagedFiles.length} onClick={() => void stageAll()}>Stage all</Btn>}>
        Unstaged ({unstagedFiles.length})
      </SectionLabel>
      <Card className="p-1.5 max-h-72 overflow-y-auto custom-scrollbar">
        {unstagedFiles.length === 0 ? (
          <div className="text-center fs-11 tx-25 py-3">Working tree clean</div>
        ) : (
          unstagedFiles.map((f) => (
            <FileRow
              key={f.path}
              f={f}
              staged={false}
              onOpenDiff={onOpenDiff}
              onToggleStage={(file) => void stageFile(file)}
              onDiscard={(file) => void discardFile(file)}
            />
          ))
        )}
      </Card>

      <SectionLabel>Commit</SectionLabel>
      <Card className="p-3">
        <AutoTextarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder={amend ? "Leave blank to keep the previous message…" : "Summarize your change…"}
          minRows={2}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors"
        />
        <label className="flex items-center gap-2 mt-2 mb-1 cursor-pointer select-none">
          <input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)} className="w-3.5 h-3.5" />
          <span className="fs-11 tx-50">Amend the previous commit instead of creating a new one</span>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              primary
              icon={GitCommit}
              disabled={!stagedFiles.length}
              title={!stagedFiles.length ? "Nothing staged yet" : undefined}
              onClick={() => void handleCommit(false)}
            >
              {amend ? "Amend commit" : "Commit staged"}
            </Btn>
            <Btn
              ghost
              icon={Sparkles}
              disabled={!stagedFiles.length || generating}
              title="Generates a message from the staged diff"
              onClick={handleGenerate}
            >
              {generating ? "Generating…" : "Generate message"}
            </Btn>
          </div>
          <Btn
            icon={Upload}
            disabled={!stagedFiles.length}
            title={!stagedFiles.length ? "Nothing staged yet" : undefined}
            onClick={() => void handleCommit(true)}
          >
            Commit &amp; push
          </Btn>
        </div>
      </Card>
    </div>
  );
}

/* ============================== DiffPage ============================== */

function DiffPage({
  cwd,
  statusData,
  commits,
}: {
  cwd: string;
  statusData: GitStatusResult | null;
  commits: ReadonlyArray<GitHistoryCommit>;
}) {
  const [diffMode, setDiffMode] = useState<"working" | "history">("working");
  const [selectedFile, setSelectedFile] = useState<GitStatusFile | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitHistoryCommit | null>(null);

  const api = readNativeApi();
  const stagedFiles = statusData?.staged?.files ?? [];
  const unstagedFiles = statusData?.unstaged?.files ?? [];
  const workingFiles = useMemo(() => [...stagedFiles, ...unstagedFiles], [stagedFiles, unstagedFiles]);

  const [diffContent, setDiffContent] = useState<Array<{ type: string; text: string }>>([]);
  const [commitStats, setCommitStats] = useState<{ ins: number; del: number }>({ ins: 0, del: 0 });

  useEffect(() => {
    if (!api || !cwd) return;
    let cancelled = false;

    if (diffMode === "working" && selectedFile) {
      api.git
        .diff({ cwd, path: selectedFile.path })
        .then((res) => {
          if (cancelled) return;
          if (res?.patch) {
            const lines = res.patch.split("\n").map((line) => {
              if (line.startsWith("@@")) return { type: "hunk", text: line };
              if (line.startsWith("+")) return { type: "add", text: line.slice(1) };
              if (line.startsWith("-")) return { type: "del", text: line.slice(1) };
              return { type: "ctx", text: line };
            });
            setDiffContent(lines);
          } else {
            setDiffContent([]);
          }
        })
        .catch(() => {
          if (!cancelled) setDiffContent([]);
        });
    } else if (diffMode === "history" && selectedCommit) {
      api.git
        .diff({ cwd, commit: selectedCommit.sha })
        .then((res) => {
          if (cancelled) return;
          if (res?.patch) {
            let ins = 0;
            let del = 0;
            const lines = res.patch.split("\n").map((line) => {
              if (line.startsWith("@@")) return { type: "hunk", text: line };
              if (line.startsWith("+") && !line.startsWith("+++")) {
                ins++;
                return { type: "add", text: line.slice(1) };
              }
              if (line.startsWith("-") && !line.startsWith("---")) {
                del++;
                return { type: "del", text: line.slice(1) };
              }
              return { type: "ctx", text: line };
            });
            setDiffContent(lines);
            setCommitStats({ ins: res.stats?.insertions ?? ins, del: res.stats?.deletions ?? del });
          } else {
            setDiffContent([]);
            setCommitStats({ ins: 0, del: 0 });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDiffContent([]);
            setCommitStats({ ins: 0, del: 0 });
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [api, cwd, diffMode, selectedFile, selectedCommit]);

  const list = diffMode === "working" ? workingFiles : commits;

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 bg-o1 border bd-2 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setDiffMode("working")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            diffMode === "working" ? "bg-o2 tx" : "tx-40 hov-tx-70"
          }`}
        >
          Working tree
        </button>
        <button
          type="button"
          onClick={() => setDiffMode("history")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            diffMode === "history" ? "bg-o2 tx" : "tx-40 hov-tx-70"
          }`}
        >
          Commit history
        </button>
      </div>

      {list.length === 0 ? (
        <div className="text-center text-xs tx-30 py-10">
          {diffMode === "working" ? "Working tree is clean — nothing to diff." : "No commits yet."}
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 gap-4 overflow-hidden">
          <div className="w-64 shrink-0 h-full overflow-y-auto custom-scrollbar">
            {diffMode === "working"
              ? workingFiles.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedFile(f)}
                    className={`relative w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-colors cursor-pointer ${
                      selectedFile === f ? "bg-o1" : "hov-bg-o1"
                    }`}
                  >
                    {selectedFile === f && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: "var(--fg)" }} />}
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: f.untracked ? "var(--sem-emerald)" : f.deletions > 0 && f.insertions === 0 ? "var(--sem-red)" : "var(--sem-amber)" }}
                      />
                      <FilePathLabel path={f.path} />
                    </div>
                  </button>
                ))
              : commits.map((c) => (
                  <button
                    key={c.sha}
                    type="button"
                    onClick={() => setSelectedCommit(c)}
                    className={`relative w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-colors cursor-pointer ${
                      selectedCommit === c ? "bg-o1" : "hov-bg-o1"
                    }`}
                  >
                    {selectedCommit === c && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: "var(--fg)" }} />}
                    <div className="fs-12 tx-70 truncate leading-snug">{c.subject}</div>
                    <div className="fs-10 font-mono tx-30 mt-0.5">{c.shortSha}</div>
                  </button>
                ))}
          </div>
          <div className="flex-1 min-w-0 h-full">
            {diffMode === "working" ? (
              selectedFile ? (
                <DiffCard path={selectedFile.path} ins={selectedFile.insertions} del={selectedFile.deletions} lines={diffContent} />
              ) : (
                <div className="text-center text-xs tx-25 py-10">Pick a file on the left.</div>
              )
            ) : selectedCommit ? (
              <DiffCard path={selectedCommit.subject} ins={commitStats.ins} del={commitStats.del} lines={diffContent} />
            ) : (
              <div className="text-center text-xs tx-25 py-10">Pick a commit on the left.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== BranchesPanel ============================== */

function BranchesPanel({
  cwd,
  activeBranch,
  allBranches,
  aheadCount,
  behindCount,
  isDetached,
  onOpenNewBranch,
  onOpenNewWorktree,
}: {
  cwd: string;
  activeBranch: GitBranchType | null;
  allBranches: ReadonlyArray<GitBranchType>;
  aheadCount: number;
  behindCount: number;
  isDetached: boolean;
  onOpenNewBranch: () => void;
  onOpenNewWorktree: () => void;
}) {
  const [form, setForm] = useState<"new" | "rename" | null>(null);
  const api = readNativeApi();
  const queryClient = useQueryClient();

  // Include ALL branches (both local and remote) except the currently checked out active branch
  const otherBranches = useMemo(() => allBranches.filter((b) => !b.current), [allBranches]);

  const checkoutBranch = useCallback(
    async (name: string) => {
      if (!api) return;
      try {
        await api.git.checkout({ cwd, branch: name });
        await invalidateGitQueries(queryClient);
        toastManager.add({ type: "success", title: `Switched to ${name}` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Checkout failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const mergeBranch = useCallback(
    async (name: string) => {
      if (!api) return;
      try {
        await api.git.merge({ cwd, branch: name });
        await invalidateGitQueries(queryClient);
        toastManager.add({ type: "success", title: `Merged ${name} into current branch` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Merge failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const deleteBranch = useCallback(
    async (name: string, force = false) => {
      if (!api) return;
      try {
        await api.git.deleteBranch({ cwd, branch: name, force });
        await invalidateGitQueries(queryClient);
        toastManager.add({ type: "success", title: `Deleted branch ${name}` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Delete failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const createBranch = useCallback(
    async (name: string) => {
      if (!api) return;
      try {
        await api.git.createBranch({ cwd, branch: name });
        await api.git.checkout({ cwd, branch: name });
        await invalidateGitQueries(queryClient);
        toastManager.add({ type: "success", title: `Created and switched to ${name}` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Create branch failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const renameBranch = useCallback(
    async (name: string) => {
      if (!api || !activeBranch) return;
      try {
        await api.git.renameBranch({ cwd, oldBranch: activeBranch.name, newBranch: name });
        await invalidateGitQueries(queryClient);
        toastManager.add({ type: "success", title: `Renamed branch to ${name}` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Rename branch failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, activeBranch, cwd, queryClient],
  );

  return (
    <div>
      {aheadCount > 0 && behindCount > 0 && (
        <Banner tone="info" title={`${activeBranch?.name} has diverged`} body={`${aheadCount} ahead, ${behindCount} behind origin/${activeBranch?.name}.`} />
      )}
      {isDetached && <Banner tone="warn" title="Detached HEAD" body="You're viewing a specific commit, not a branch." />}

      <Card className="p-2">
        <div className="flex items-center gap-2.5 px-2 py-2 border-b bd-1">
          <Badge tone="amber" icon={GitBranchIcon}>
            {isDetached ? `${activeBranch?.name ?? "HEAD"} (detached)` : activeBranch?.name}
          </Badge>
          <span className="fs-11 font-mono tx-30 flex-1">{aheadCount || behindCount ? `↑${aheadCount} ↓${behindCount}` : "up to date"}</span>
          {!isDetached && (
            <Btn sm ghost onClick={() => setForm("rename")}>
              Rename
            </Btn>
          )}
        </div>
        {otherBranches.map((b) => (
          <div key={b.name} className="flex items-center gap-2.5 px-2 py-2 border-b bd-1 last:border-0">
            <span className="text-xs font-mono tx-70 flex-1">{b.name}</span>
            <Badge tone="muted">{b.isRemote ? "remote" : "local"}</Badge>
            <Btn sm ghost onClick={() => void mergeBranch(b.name)}>
              Merge into current
            </Btn>
            <Btn sm ghost onClick={() => void checkoutBranch(b.name)}>
              Switch
            </Btn>
            {!b.isRemote && (
              <Btn sm ghost onClick={() => void deleteBranch(b.name, false)}>
                Delete
              </Btn>
            )}
          </div>
        ))}
      </Card>

      {form === "new" && (
        <div className="mt-3">
          <InlineForm
            placeholder="new-branch-name"
            submitLabel="Create"
            onSubmit={(name) => {
              void createBranch(name);
              setForm(null);
            }}
            onCancel={() => setForm(null)}
          />
        </div>
      )}
      {form === "rename" && (
        <div className="mt-3">
          <InlineForm
            placeholder="new name"
            initial={activeBranch?.name ?? ""}
            submitLabel="Rename"
            onSubmit={(name) => {
              void renameBranch(name);
              setForm(null);
            }}
            onCancel={() => setForm(null)}
          />
        </div>
      )}

      {form === null && (
        <div className="flex items-center gap-2 mt-4">
          <Btn primary onClick={() => setForm("new")}>
            New branch
          </Btn>
          <Btn ghost onClick={onOpenNewWorktree}>
            New worktree
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ============================== CommitRow ============================== */

function CommitRow({
  c,
  onReset,
  onRevert,
  onCherryPick,
}: {
  c: GitHistoryCommit;
  onReset: (commit: GitHistoryCommit) => void;
  onRevert: (commit: GitHistoryCommit) => void;
  onCherryPick: (commit: GitHistoryCommit) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const copySha = () => {
    navigator.clipboard?.writeText(c.sha).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    setMenuOpen(false);
  };

  return (
    <div className="group relative">
      <div className="relative w-full text-left flex flex-col gap-1.5 pl-4 pr-9 py-3 border-b bd-1 last:border-0 hov-bg-o1 rounded-md transition-colors">
        <span
          className="absolute top-4 w-2 h-2 rounded-full border-2"
          style={{
            left: "-13px",
            borderColor: c.isHead ? "var(--fg)" : "var(--fg-30)",
            backgroundColor: c.isHead ? "var(--fg)" : "var(--bg-base)",
          }}
        />
        <div className="fs-12 tx-85 leading-snug">{c.subject}</div>
        <div className="flex items-center gap-2 flex-wrap fs-11 font-mono tx-30">
          <span className="border bd-2 rounded px-1.5 py-0.5 tx-50">{c.shortSha}</span>
          <span>{c.authorName}</span>
          <span>&middot;</span>
          <span>{c.authoredAt.slice(0, 10)}</span>
          {(c.refs || []).map((r) => (
            <span key={r} className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--overlay-10)", color: "var(--fg-80)" }}>
              {r}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute right-1 top-3" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={`w-6 h-6 rounded-md flex items-center justify-center tx-30 hov-tx transition-opacity cursor-pointer ${
            menuOpen ? "opacity-100 bg-o1" : "opacity-0 group-hover:opacity-100 hov-bg-o1"
          }`}
        >
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border bd-2 shadow-2xl overflow-hidden z-40 py-1" style={{ backgroundColor: "var(--bg-surface)" }}>
            <button
              type="button"
              onClick={() => {
                onCherryPick(c);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 tx-60 hov-tx hov-bg-o1 transition-colors cursor-pointer"
            >
              <Copy size={11} /> Cherry-pick
            </button>
            <button
              type="button"
              onClick={() => {
                onRevert(c);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 tx-60 hov-tx hov-bg-o1 transition-colors cursor-pointer"
            >
              <Undo2 size={11} /> Revert
            </button>
            <button
              type="button"
              onClick={() => {
                onReset(c);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 hov-bg-o1 transition-colors cursor-pointer"
              style={{ color: "var(--sem-red)" }}
            >
              <RotateCcw size={11} /> Reset to here
            </button>
            <div className="h-px bg-o1 my-1" />
            <button
              type="button"
              onClick={copySha}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 tx-60 hov-tx hov-bg-o1 transition-colors cursor-pointer"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy SHA"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== HistoryPanel ============================== */

function HistoryPanel({
  commits,
  onReset,
  onRevert,
  onCherryPick,
}: {
  commits: ReadonlyArray<GitHistoryCommit>;
  onReset: (c: GitHistoryCommit) => void;
  onRevert: (c: GitHistoryCommit) => void;
  onCherryPick: (c: GitHistoryCommit) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? commits.filter((c) => c.subject.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q) || c.sha.includes(q)) : commits;

  return (
    <div>
      <div className="relative mb-4">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 tx-30" />
        <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by message, author, or SHA…" className="pl-8" />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center fs-12 tx-30 py-10">No commits match "{query}"</div>
      ) : (
        <div className="relative pl-4">
          <div className="absolute top-2 bottom-2 w-px bg-o2" style={{ left: "7px" }} />
          {filtered.map((c) => (
            <CommitRow key={c.sha} c={c} onReset={onReset} onRevert={onRevert} onCherryPick={onCherryPick} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== PRsPanel ============================== */

interface MockPR {
  n: number;
  title: string;
  state: "open" | "draft" | "merged" | "closed";
  branch: string;
  body: string;
}

function PRsPanel({
  cwd,
  branchName,
  onOpenCreatePR,
  onRunInTerminal,
}: {
  cwd: string;
  branchName: string;
  onOpenCreatePR: () => void;
  onRunInTerminal: (cmd: string) => void;
}) {
  const [prs, setPrs] = useState<MockPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [mergeMethod, setMergeMethod] = useState<Record<number, string>>({});
  const api = readNativeApi();

  useEffect(() => {
    if (!api || !cwd || !branchName) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    api.git
      .resolvePullRequest({ cwd, reference: branchName })
      .then((res) => {
        if (cancelled) return;
        if (res.pullRequest) {
          const pr = res.pullRequest;
          setPrs([
            {
              n: pr.number,
              title: pr.title,
              state: (pr.state as "open" | "draft" | "merged" | "closed") || "open",
              branch: `${pr.headBranch ?? branchName} → ${pr.baseBranch ?? "main"}`,
              body: pr.url,
            },
          ]);
        } else {
          setPrs([]);
        }
      })
      .catch(() => {
        if (!cancelled) setPrs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, cwd, branchName]);

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center p-8 text-xs tx-40">
          <Loader2 className="animate-spin mr-2" size={14} /> Loading pull requests…
        </div>
      ) : prs.length === 0 ? (
        <Card className="p-6 text-center">
          <GitPullRequest className="mx-auto mb-2 tx-30" size={24} />
          <p className="fs-12 font-medium tx-80 mb-1">No open pull requests for {branchName}</p>
          <p className="fs-11 tx-40 mb-4">Push your branch and open a pull request on GitHub to request feedback and merge changes.</p>
          <Btn primary icon={GitPullRequest} onClick={onOpenCreatePR}>
            Create pull request
          </Btn>
        </Card>
      ) : (
        <Card className="p-2 mb-3">
          {prs.map((pr) => (
            <div key={pr.n} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <Badge tone={pr.state}>
                #{pr.n} {pr.state}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="text-xs tx-80 truncate">{pr.title}</div>
                <div className="fs-10 font-mono tx-30 truncate">{pr.branch}</div>
              </div>
              <Btn sm ghost onClick={() => onRunInTerminal(`gh pr view ${pr.n} --web`)}>
                View on GitHub
              </Btn>
            </div>
          ))}
        </Card>
      )}
      {prs.length > 0 && (
        <div className="mt-4">
          <Btn primary icon={GitPullRequest} onClick={onOpenCreatePR}>
            Create pull request
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ============================== TagsPanel ============================== */

function TagsPanel({
  cwd,
  commits,
  onOpenDraftRelease,
  onRunInTerminal,
}: {
  cwd: string;
  commits: ReadonlyArray<GitHistoryCommit>;
  onOpenDraftRelease: () => void;
  onRunInTerminal: (cmd: string) => void;
}) {
  const [form, setForm] = useState(false);
  const [realTags, setRealTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const api = readNativeApi();
  const queryClient = useQueryClient();

  const fetchTags = useCallback(async () => {
    if (!api || !cwd) {
      setLoadingTags(false);
      return;
    }
    const foundTags = new Set<string>();
    try {
      const browse = await api.projects.filesystemBrowse({ cwd, partialPath: ".git/refs/tags" });
      if (browse?.entries) {
        for (const entry of browse.entries) {
          if (entry.name && !entry.name.startsWith(".")) foundTags.add(entry.name);
        }
      }
    } catch {
      // Ignore
    }

    try {
      const packed = await api.projects.readFile({ cwd, relativePath: ".git/packed-refs" });
      if (packed?.contents) {
        for (const line of packed.contents.split("\n")) {
          const match = line.match(/refs\/tags\/(.+)$/);
          if (match && match[1]) {
            foundTags.add(match[1].replace(/\^{}$/, ""));
          }
        }
      }
    } catch {
      // Ignore
    }

    setRealTags(Array.from(foundTags).sort());
    setLoadingTags(false);
  }, [api, cwd]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const createTag = useCallback(
    async (name: string) => {
      if (!api) return;
      try {
        await api.git.createTag({ cwd, name });
        await invalidateGitQueries(queryClient);
        await fetchTags();
        setForm(false);
        toastManager.add({ type: "success", title: `Tag ${name} created` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Create tag failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, fetchTags, queryClient],
  );

  return (
    <div>
      {loadingTags ? (
        <div className="flex items-center justify-center p-8 text-xs tx-40">
          <Loader2 className="animate-spin mr-2" size={14} /> Loading tags…
        </div>
      ) : realTags.length === 0 ? (
        <Card className="p-6 text-center">
          <Tag className="mx-auto mb-2 tx-30" size={24} />
          <p className="fs-12 font-medium tx-80 mb-1">No tags created yet</p>
          <p className="fs-11 tx-40 mb-4">Tags mark specific points in your repository history (e.g. v1.0.0).</p>
        </Card>
      ) : (
        <Card className="p-2 mb-3">
          {realTags.map((tagName) => (
            <div key={tagName} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bd-2 bg-o1 text-xs font-mono tx-80">
                <Tag size={11} /> {tagName}
              </span>
              <span className="fs-11 tx-30 flex-1">Tag release ref</span>
              <Btn sm ghost onClick={() => onRunInTerminal(`git push origin ${tagName}`)}>
                Push tag
              </Btn>
            </div>
          ))}
          {form && (
            <div className="pt-2 mt-1 border-t bd-1">
              <InlineForm
                placeholder="v1.5.0"
                submitLabel="Create tag"
                className="mb-0"
                onSubmit={(name) => {
                  void createTag(name);
                }}
                onCancel={() => setForm(false)}
              />
            </div>
          )}
        </Card>
      )}

      {form && realTags.length === 0 && (
        <Card className="p-2 mb-3">
          <InlineForm
            placeholder="v1.5.0"
            submitLabel="Create tag"
            className="mb-0"
            onSubmit={(name) => {
              void createTag(name);
            }}
            onCancel={() => setForm(false)}
          />
        </Card>
      )}
      {!form && (
        <div className="flex items-center gap-2 mt-4">
          <Btn primary onClick={() => setForm(true)}>
            Create tag
          </Btn>
          <Btn ghost onClick={onOpenDraftRelease}>
            Draft a release
          </Btn>
        </div>
      )}
    </div>
  );
}

/* ============================== StashesPanel ============================== */

function StashesPanel({
  stashes,
  hasChanges,
  behindCount,
  hasConflict,
  onOpenStash,
  onOpenStashPullReapply,
  onApplyStash,
  onDropStash,
}: {
  stashes: ReadonlyArray<GitStashEntry>;
  hasChanges: boolean;
  behindCount: number;
  hasConflict: boolean;
  onOpenStash: () => void;
  onOpenStashPullReapply: () => void;
  onApplyStash: (ref: string) => void;
  onDropStash: (ref: string) => void;
}) {
  const nothingToDo = !hasChanges && behindCount === 0;

  return (
    <div>
      <SectionLabel>Update safely</SectionLabel>
      <Card className="p-3 mb-4">
        <p className="fs-11 tx-40 leading-relaxed mb-3">
          Set your current changes aside, pull the latest commits — from your own branch or a teammate's — then bring your changes back. Each step is reported as it happens. If your changes conflict with what came in, you'll resolve it right here.
        </p>
        <Btn primary icon={RefreshCw} disabled={hasConflict || nothingToDo} onClick={onOpenStashPullReapply}>
          Stash, pull &amp; reapply
        </Btn>
        {nothingToDo && <div className="fs-10 tx-25 mt-2">Nothing to stash, and already up to date.</div>}
        {hasConflict && <div className="fs-10 mt-2" style={{ color: "var(--sem-amber)" }}>Resolve the merge in progress before running this again.</div>}
      </Card>

      <SectionLabel action={<Btn sm ghost disabled={!hasChanges} onClick={onOpenStash}>Stash current changes</Btn>}>
        Stashes
      </SectionLabel>
      {stashes.length === 0 ? (
        <div className="text-center fs-11 tx-25 py-6 border bd-1 rounded-lg">
          {hasChanges ? 'No manual stashes yet. Set aside what you have right now with "Stash current changes" above.' : "No manual stashes, and nothing to stash right now."}
        </div>
      ) : (
        <Card className="p-2">
          {stashes.map((s) => (
            <div key={s.stashRef} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-xs tx-80">{s.message}</div>
                <div className="fs-10 font-mono tx-30">
                  {s.stashRef} &middot; {s.createdAt}
                </div>
              </div>
              <Btn sm ghost onClick={() => onApplyStash(s.stashRef)}>
                Apply
              </Btn>
              <Btn sm ghost onClick={() => onDropStash(s.stashRef)}>
                Drop
              </Btn>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ============================== AccountsPanel ============================== */

function AccountRow({
  account: a,
  isActive,
  onSwitch,
  onRemove,
}: {
  account: GitHubAccount;
  isActive: boolean;
  onSwitch: (login: string) => void;
  onRemove: (login: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(a.login);

  return (
    <div className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
      <span className="w-8 h-8 rounded-lg bg-o1 border bd-2 flex items-center justify-center text-xs font-mono font-semibold tx-80 shrink-0">
        {a.login[0]?.toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <TextInput
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditing(false);
                if (e.key === "Escape") setEditing(false);
              }}
              className="!py-1 !text-xs max-w-40"
            />
            <button type="button" onClick={() => setEditing(false)} className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors">
              <Check size={12} />
            </button>
            <button type="button" onClick={() => setEditing(false)} className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors">
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="text-xs font-mono tx-85 flex items-center gap-2">
            {a.login}
            {isActive && (
              <span className="fs-10 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--overlay-10)", color: "var(--fg-80)" }}>
                used here
              </span>
            )}
            <button type="button" onClick={() => setEditing(true)} className="tx-25 hov-tx transition-colors cursor-pointer">
              <Pencil size={11} />
            </button>
          </div>
        )}
        <div className="fs-10 tx-30 flex items-center gap-1.5 mt-0.5">
          {a.host}
          {a.scopes.map((s) => (
            <span key={s} className="font-mono px-1 py-px rounded bg-o1 border bd-1">
              {s}
            </span>
          ))}
        </div>
      </div>
      {!isActive && <Btn sm ghost onClick={() => onSwitch(a.login)}>Switch to this account</Btn>}
      <Btn sm ghost onClick={() => onRemove(a.login)}>
        Remove
      </Btn>
    </div>
  );
}

function AccountsPanel({
  accounts,
  activeAccountLogin,
  repoName,
  credentialMismatch = false,
  onOpenConnectAccount,
  onSwitchAccount,
  onRemoveAccount,
}: {
  accounts: ReadonlyArray<GitHubAccount>;
  activeAccountLogin: string | null;
  repoName: string;
  credentialMismatch?: boolean;
  onOpenConnectAccount: () => void;
  onSwitchAccount: (login: string) => void;
  onRemoveAccount: (login: string) => void;
}) {
  return (
    <div>
      {credentialMismatch && (
        <Banner
          tone="warn"
          title="This project's push credential doesn't match"
          body="The account below handles GitHub actions. But git push authenticates through your system's SSH key, which currently resolves to a different account."
        />
      )}
      <Card className="p-2 mb-4">
        {accounts.map((a) => (
          <AccountRow key={a.login} account={a} isActive={a.login === activeAccountLogin} onSwitch={onSwitchAccount} onRemove={onRemoveAccount} />
        ))}
        {accounts.length === 0 && <div className="text-center fs-11 tx-25 py-4">No accounts connected</div>}
      </Card>
      <Btn primary onClick={onOpenConnectAccount}>
        Connect an account
      </Btn>

      <SectionLabel>This project</SectionLabel>
      <p className="text-xs tx-40 leading-relaxed mb-2">
        {repoName} pushes and opens pull requests as this account. Changing it here only affects this project.
      </p>
      <div className="flex items-center gap-2.5 bg-o1 border bd-2 rounded-lg px-3 py-2.5">
        <KeyRound size={13} className="tx-30 shrink-0" />
        <span className="text-xs tx-50">Push and open PRs as</span>
        <select
          value={activeAccountLogin || ""}
          onChange={(e) => onSwitchAccount(e.target.value)}
          className="border bd-2 rounded-md text-xs font-mono tx-80 px-2 py-1 outline-none"
          style={{ backgroundColor: "var(--bg-base)" }}
        >
          {accounts.map((a) => (
            <option key={a.login} value={a.login}>
              {a.login}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ============================== SettingsPanel ============================== */

function SettingsPanel({
  cwd,
  environmentData,
  onOpenAddRemote,
  onRunInTerminal,
}: {
  cwd: string;
  environmentData: GitEnvironmentResult | null;
  onOpenAddRemote: () => void;
  onRunInTerminal: (cmd: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gitignore, setGitignore] = useState("");
  const [gitignoreChanged, setGitignoreChanged] = useState(false);
  const [remotes, setRemotes] = useState<Array<{ name: string; url: string }>>([]);
  const [loading, setLoading] = useState(true);
  const api = readNativeApi();

  useEffect(() => {
    const nativeApi = api;
    if (!nativeApi || !cwd) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadSettings() {
      if (!nativeApi) return;
      // 1. Load .gitignore
      try {
        const res = await nativeApi.projects.readFile({ cwd, relativePath: ".gitignore" });
        if (res?.contents && !cancelled) {
          setGitignore(res.contents);
          setGitignoreChanged(false);
        }
      } catch {
        // Ignore if no .gitignore file
      }

      // 2. Load .git/config for identity & remotes
      try {
        const configRes = await nativeApi.projects.readFile({ cwd, relativePath: ".git/config" });
        if (configRes?.contents && !cancelled) {
          const text = configRes.contents;

          const nameMatch = text.match(/name\s*=\s*(.+)/i);
          const emailMatch = text.match(/email\s*=\s*(.+)/i);
          if (nameMatch && nameMatch[1]) setName(nameMatch[1].trim());
          if (emailMatch && emailMatch[1]) setEmail(emailMatch[1].trim());

          const parsedRemotes: Array<{ name: string; url: string }> = [];
          const lines = text.split("\n");
          let currentRemote: string | null = null;
          for (const line of lines) {
            const remoteMatch = line.match(/\[remote\s+"([^"]+)"\]/);
            if (remoteMatch && remoteMatch[1]) {
              currentRemote = remoteMatch[1];
            } else if (currentRemote) {
              const urlMatch = line.match(/\s*url\s*=\s*(.+)/);
              if (urlMatch && urlMatch[1]) {
                parsedRemotes.push({ name: currentRemote, url: urlMatch[1].trim() });
                currentRemote = null;
              }
            }
          }
          if (parsedRemotes.length > 0) {
            setRemotes(parsedRemotes);
          }
        }
      } catch {
        // Ignore
      }

      if (!cancelled) setLoading(false);
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [api, cwd]);

  const handleSaveIdentity = () => {
    onRunInTerminal(`git config user.name "${name.trim()}" && git config user.email "${email.trim()}"`);
    toastManager.add({ type: "success", title: "Git identity update sent to terminal" });
  };

  const handleSaveGitignore = async () => {
    if (!api) return;
    try {
      await api.projects.writeFile({ cwd, relativePath: ".gitignore", contents: gitignore });
      setGitignoreChanged(false);
      toastManager.add({ type: "success", title: "Saved .gitignore" });
    } catch (error) {
      toastManager.add({ type: "error", title: "Could not save .gitignore", description: error instanceof Error ? error.message : "Write error" });
    }
  };

  return (
    <div>
      <SectionLabel>Git identity</SectionLabel>
      <Card className="p-3 mb-1">
        <p className="fs-11 tx-40 leading-relaxed mb-3">Used as the author on every commit you make in this project.</p>
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" />
        </Field>
        <Field label="Email">
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Btn primary disabled={!name.trim() || !email.trim()} onClick={handleSaveIdentity}>
          Save identity
        </Btn>
      </Card>

      <SectionLabel action={<Btn sm ghost onClick={onOpenAddRemote}>Add remote</Btn>}>
        Remotes
      </SectionLabel>
      <Card className="p-3 mb-1">
        <p className="fs-11 tx-40 leading-relaxed mb-3">
          The URLs this project pushes to and pulls from. Most projects only need "origin".
        </p>
        {remotes.length === 0 ? (
          <div className="fs-11 tx-30 px-2 py-2">No remotes configured.</div>
        ) : (
          remotes.map((r) => (
            <div key={r.name} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="fs-12 font-mono tx-80">{r.name}</div>
                <div className="fs-10 font-mono tx-30 truncate">{r.url}</div>
              </div>
              <Btn sm ghost onClick={() => onRunInTerminal(`git remote remove ${r.name}`)}>
                Remove
              </Btn>
            </div>
          ))
        )}
      </Card>

      <SectionLabel>.gitignore</SectionLabel>
      <Card className="p-3">
        <p className="fs-11 tx-40 leading-relaxed mb-3">
          Files and folders Git should never track for this project. One pattern per line.
        </p>
        <AutoTextarea
          value={gitignore}
          onChange={(e) => {
            setGitignore(e.target.value);
            setGitignoreChanged(true);
          }}
          minRows={4}
          className="w-full border bd-2 rounded-lg tx font-mono fs-11 ph-25 p-3 outline-none foc-bd-3 transition-colors"
        />
        <div className="mt-2.5">
          <Btn primary disabled={!gitignoreChanged} onClick={() => void handleSaveGitignore()}>
            Save .gitignore
          </Btn>
        </div>
      </Card>
    </div>
  );
}

/* ============================== Main GitToolV2 ============================== */

export function GitToolV2({
  cwd,
  activeThreadId,
  terminalAvailable,
  terminalOpen,
  onToggleTerminal,
  onRunInTerminal,
  onOpenAgents,
  onRunGitHubLogin,
}: GitToolV2Props) {
  const api = readNativeApi();
  const queryClient = useQueryClient();

  const [panel, setPanel] = useState<NavPanel>("overview");
  const [collapsed, setCollapsed] = useState(false);

  // Queries
  const gitStatusQuery = useQuery(gitStatusQueryOptions(cwd));
  const gitEnvironmentQuery = useQuery(gitEnvironmentQueryOptions(cwd));
  const branchesQuery = useQuery(gitBranchesQueryOptions(cwd));
  const historyQuery = useQuery(gitHistoryQueryOptions({ cwd, limit: 50 }));
  const stashQuery = useQuery(gitStashListQueryOptions(cwd));
  const gitInitMutation = useMutation(gitInitMutationOptions({ cwd, queryClient }));
  const switchMutation = useMutation(gitHubSwitchAccountMutationOptions({ cwd, queryClient }));
  const logoutMutation = useMutation(gitHubLogoutMutationOptions({ cwd, queryClient }));

  const statusData = gitStatusQuery.data ?? null;
  const environmentData = gitEnvironmentQuery.data ?? null;
  const branchList = branchesQuery.data ?? null;
  const allBranches = branchList?.branches ?? [];
  const activeBranch = allBranches.find((b) => b.current) ?? null;
  const branchName = activeBranch?.name ?? statusData?.branch ?? "main";
  const aheadCount = statusData?.aheadCount ?? 0;
  const behindCount = statusData?.behindCount ?? 0;
  const stagedFiles = statusData?.staged?.files ?? [];
  const unstagedFiles = useMemo(
    () => (statusData?.unstaged?.files ?? []).filter((f) => !f.conflicted && !f.untracked),
    [statusData?.unstaged?.files],
  );
  const conflictedFiles = statusData?.conflicted?.files ?? [];
  const changeCount = stagedFiles.length + unstagedFiles.length;
  const hasConflict = conflictedFiles.length > 0;
  const commits = historyQuery.data?.commits ?? [];
  const stashes = stashQuery.data?.entries ?? [];
  const accounts = environmentData?.gitHub.accounts ?? [];
  const activeAccountLogin = environmentData?.gitHub.activeLogin ?? null;

  // Modals
  const [modal, setModal] = useState<
    | null
    | "stash"
    | "discardAll"
    | "forcePush"
    | "createPR"
    | "addRemote"
    | "deviceAuth"
    | "newWorktree"
    | "draftRelease"
    | "pullSource"
    | { kind: "reset"; commit: GitHistoryCommit }
  >(null);

  const closeModal = useCallback(() => setModal(null), []);

  const doStash = useCallback(
    async (msg: string) => {
      if (!api) return;
      try {
        await api.git.saveStash({ cwd, message: msg || undefined });
        await invalidateGitQueries(queryClient);
        closeModal();
        toastManager.add({ type: "success", title: "Stashed changes" });
      } catch (error) {
        toastManager.add({ type: "error", title: "Stash failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, closeModal, cwd, queryClient],
  );

  const doDiscardAll = useCallback(async () => {
    if (!api) return;
    try {
      await api.git.discardChanges({ cwd, discardStaged: true, discardUnstaged: true });
      await invalidateGitQueries(queryClient);
      closeModal();
      toastManager.add({ type: "success", title: "Discarded all changes" });
    } catch (error) {
      toastManager.add({ type: "error", title: "Discard failed", description: toGitUserFacingErrorMessage(error) });
    }
  }, [api, closeModal, cwd, queryClient]);

  const stashPullReapply = useCallback(
    async (sourceBranch: string) => {
      if (!api) return;
      const hasChanges = stagedFiles.length + unstagedFiles.length > 0;
      try {
        if (hasChanges) {
          await api.git.saveStash({ cwd });
          await invalidateGitQueries(queryClient);
        }
        await api.git.pull({ cwd });
        await invalidateGitQueries(queryClient);
        if (hasChanges) {
          await api.git.applyStash({ cwd, stashRef: "stash@{0}", pop: true });
          await invalidateGitQueries(queryClient);
        }
        closeModal();
        toastManager.add({ type: "success", title: `Pulled from origin/${sourceBranch} and reapplied stash` });
      } catch (error) {
        await invalidateGitQueries(queryClient);
        closeModal();
        toastManager.add({ type: "error", title: "Stash, pull & reapply failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, closeModal, cwd, queryClient, stagedFiles.length, unstagedFiles.length],
  );

  const applyStash = useCallback(
    async (ref: string) => {
      if (!api) return;
      try {
        await api.git.applyStash({ cwd, stashRef: ref, pop: true });
        await invalidateGitQueries(queryClient);
        toastManager.add({ type: "success", title: `Applied ${ref}` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Apply stash failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const dropStash = useCallback(
    async (ref: string) => {
      if (!api) return;
      try {
        await api.git.dropStash({ cwd, stashRef: ref });
        await invalidateGitQueries(queryClient);
        toastManager.add({ type: "success", title: `Dropped ${ref}` });
      } catch (error) {
        toastManager.add({ type: "error", title: "Drop stash failed", description: toGitUserFacingErrorMessage(error) });
      }
    },
    [api, cwd, queryClient],
  );

  const switchAccount = useCallback(
    (login: string) => {
      void switchMutation.mutateAsync({ host: "github.com", login });
    },
    [switchMutation],
  );

  const removeAccount = useCallback(
    (login: string) => {
      void logoutMutation.mutateAsync({ host: "github.com", login });
    },
    [logoutMutation],
  );

  const repoName = cwd.split("/").pop() ?? cwd;

  const panelContent = useMemo(() => {
    switch (panel) {
      case "overview":
        return (
          <OverviewPanel
            repoName={repoName}
            statusData={statusData}
            environmentData={environmentData}
            branchList={branchList}
            commits={commits}
            onGoToChanges={() => setPanel("changes")}
            onGoToAccounts={() => setPanel("accounts")}
            onOpenSignIn={() => setModal("deviceAuth")}
            onOpenAddRemote={() => setModal("addRemote")}
            onOpenCreateBranch={() => setModal("newWorktree")}
            onRunInTerminal={onRunInTerminal}
            onInitRepo={() => void gitInitMutation.mutateAsync()}
          />
        );
      case "changes":
        return (
          <ChangesPanel
            cwd={cwd}
            statusData={statusData}
            onOpenDiff={() => setPanel("diff")}
            onOpenStash={() => setModal("stash")}
            onOpenDiscardAll={() => setModal("discardAll")}
            onRunInTerminal={onRunInTerminal}
          />
        );
      case "diff":
        return <DiffPage cwd={cwd} statusData={statusData} commits={commits} />;
      case "branches":
        return (
          <BranchesPanel
            cwd={cwd}
            activeBranch={activeBranch}
            allBranches={allBranches}
            aheadCount={aheadCount}
            behindCount={behindCount}
            isDetached={!activeBranch}
            onOpenNewBranch={() => setModal("newWorktree")}
            onOpenNewWorktree={() => setModal("newWorktree")}
          />
        );
      case "history":
        return (
          <HistoryPanel
            commits={commits}
            onReset={(c) => setModal({ kind: "reset", commit: c })}
            onRevert={(c) => onRunInTerminal(`git revert ${c.sha}`)}
            onCherryPick={(c) => onRunInTerminal(`git cherry-pick ${c.sha}`)}
          />
        );
      case "prs":
        return <PRsPanel cwd={cwd} branchName={branchName} onOpenCreatePR={() => setModal("createPR")} onRunInTerminal={onRunInTerminal} />;
      case "tags":
        return (
          <TagsPanel
            cwd={cwd}
            commits={commits}
            onOpenDraftRelease={() => setModal("draftRelease")}
            onRunInTerminal={onRunInTerminal}
          />
        );
      case "stashes":
        return (
          <StashesPanel
            stashes={stashes}
            hasChanges={changeCount > 0}
            behindCount={behindCount}
            hasConflict={hasConflict}
            onOpenStash={() => setModal("stash")}
            onOpenStashPullReapply={() => setModal("pullSource")}
            onApplyStash={(ref) => void applyStash(ref)}
            onDropStash={(ref) => void dropStash(ref)}
          />
        );
      case "accounts":
        return (
          <AccountsPanel
            accounts={accounts}
            activeAccountLogin={activeAccountLogin}
            repoName={repoName}
            onOpenConnectAccount={() => setModal("deviceAuth")}
            onSwitchAccount={switchAccount}
            onRemoveAccount={removeAccount}
          />
        );
      case "settings":
        return (
          <SettingsPanel
            cwd={cwd}
            environmentData={environmentData}
            onOpenAddRemote={() => setModal("addRemote")}
            onRunInTerminal={onRunInTerminal}
          />
        );
      default:
        return null;
    }
  }, [
    panel,
    repoName,
    statusData,
    environmentData,
    branchList,
    commits,
    onRunInTerminal,
    gitInitMutation,
    cwd,
    activeBranch,
    allBranches,
    aheadCount,
    behindCount,
    branchName,
    stashes,
    changeCount,
    hasConflict,
    applyStash,
    dropStash,
    accounts,
    activeAccountLogin,
    switchAccount,
    removeAccount,
  ]);

  return (
    <GitEnvironmentGate
      environment={environmentData ?? undefined}
      isRepo={branchList?.isRepo}
      isLoading={gitEnvironmentQuery.isLoading || branchesQuery.isLoading}
      initPending={gitInitMutation.isPending}
      onInitRepo={() => void gitInitMutation.mutateAsync()}
    >
      <div className="git-tool-v2 flex h-full min-h-0 overflow-hidden" style={{ backgroundColor: "var(--bg-base)", color: "var(--fg)" }}>
        <style>{`
          .git-tool-v2 {
            --accent: var(--primary, #ffffff);
            --accent-contrast: var(--primary-foreground, #000000);
            --bg-base: var(--background, #09090b);
            --bg-surface: var(--card, #121215);
            --fg: var(--foreground, #fafafa);
            --fg-80: color-mix(in srgb, var(--foreground) 80%, transparent);
            --fg-60: color-mix(in srgb, var(--foreground) 60%, transparent);
            --fg-40: color-mix(in srgb, var(--foreground) 40%, transparent);
            --fg-30: color-mix(in srgb, var(--foreground) 30%, transparent);
            --fg-25: color-mix(in srgb, var(--foreground) 25%, transparent);
            --fg-20: color-mix(in srgb, var(--foreground) 20%, transparent);
            --overlay-5: color-mix(in srgb, var(--foreground) 5%, transparent);
            --overlay-10: color-mix(in srgb, var(--foreground) 10%, transparent);
            --overlay-20: color-mix(in srgb, var(--foreground) 20%, transparent);
            --overlay-30: color-mix(in srgb, var(--foreground) 30%, transparent);
            --sem-emerald: #34d399;
            --sem-emerald-soft: rgba(52, 211, 153, 0.1);
            --sem-emerald-border: rgba(52, 211, 153, 0.25);
            --sem-emerald-text: #6ee7b7;
            --sem-amber: #fbbf24;
            --sem-amber-soft: rgba(251, 191, 36, 0.1);
            --sem-amber-border: rgba(251, 191, 36, 0.25);
            --sem-red: #f87171;
            --sem-red-soft: rgba(248, 113, 113, 0.1);
            --sem-red-border: rgba(248, 113, 113, 0.25);
            --sem-red-text: #fca5a5;
            --sem-sky: #38bdf8;
            --sem-sky-soft: rgba(56, 189, 248, 0.1);
            --sem-sky-border: rgba(56, 189, 248, 0.25);
            --sem-purple: #c084fc;
            --sem-purple-soft: rgba(192, 132, 252, 0.1);
          }
          .git-tool-v2 .fs-9 { font-size: 9px; }
          .git-tool-v2 .fs-10 { font-size: 10px; }
          .git-tool-v2 .fs-11 { font-size: 11px; }
          .git-tool-v2 .fs-12 { font-size: 12px; }
          .git-tool-v2 .fs-13 { font-size: 13px; }

          .git-tool-v2 .tx { color: var(--fg); }
          .git-tool-v2 .tx-85 { color: color-mix(in srgb, var(--foreground) 85%, transparent); }
          .git-tool-v2 .tx-80 { color: color-mix(in srgb, var(--foreground) 80%, transparent); }
          .git-tool-v2 .tx-70 { color: color-mix(in srgb, var(--foreground) 70%, transparent); }
          .git-tool-v2 .tx-60 { color: color-mix(in srgb, var(--foreground) 60%, transparent); }
          .git-tool-v2 .tx-50 { color: color-mix(in srgb, var(--foreground) 50%, transparent); }
          .git-tool-v2 .tx-40 { color: color-mix(in srgb, var(--foreground) 40%, transparent); }
          .git-tool-v2 .tx-30 { color: color-mix(in srgb, var(--foreground) 30%, transparent); }
          .git-tool-v2 .tx-25 { color: color-mix(in srgb, var(--foreground) 25%, transparent); }
          .git-tool-v2 .tx-20 { color: color-mix(in srgb, var(--foreground) 20%, transparent); }

          .git-tool-v2 .hov-tx:hover { color: var(--fg); }
          .git-tool-v2 .hov-tx-90:hover { color: color-mix(in srgb, var(--foreground) 90%, transparent); }
          .git-tool-v2 .hov-tx-80:hover { color: color-mix(in srgb, var(--foreground) 80%, transparent); }
          .git-tool-v2 .hov-tx-70:hover { color: color-mix(in srgb, var(--foreground) 70%, transparent); }
          .git-tool-v2 .group:hover .ghov-tx-70 { color: color-mix(in srgb, var(--foreground) 70%, transparent); }
          .git-tool-v2 .group:hover .ghov-tx-90 { color: color-mix(in srgb, var(--foreground) 90%, transparent); }

          .git-tool-v2 .bd-1 { border-color: color-mix(in srgb, var(--foreground) 8%, transparent); }
          .git-tool-v2 .bd-2 { border-color: color-mix(in srgb, var(--foreground) 15%, transparent); }
          .git-tool-v2 .hov-bd-2:hover { border-color: color-mix(in srgb, var(--foreground) 20%, transparent); }
          .git-tool-v2 .hov-bd-3:hover { border-color: color-mix(in srgb, var(--foreground) 30%, transparent); }
          .git-tool-v2 .foc-bd-3:focus { border-color: color-mix(in srgb, var(--foreground) 30%, transparent); }

          .git-tool-v2 .bg-o05 { background-color: color-mix(in srgb, var(--foreground) 3%, transparent); }
          .git-tool-v2 .bg-o1 { background-color: color-mix(in srgb, var(--foreground) 6%, transparent); }
          .git-tool-v2 .bg-o2 { background-color: color-mix(in srgb, var(--foreground) 12%, transparent); }
          .git-tool-v2 .hov-bg-o1:hover { background-color: color-mix(in srgb, var(--foreground) 6%, transparent); }
          .git-tool-v2 .hov-bg-o2:hover { background-color: color-mix(in srgb, var(--foreground) 12%, transparent); }

          .git-tool-v2 .ring-safe { box-shadow: 0 0 0 1px color-mix(in srgb, var(--foreground) 20%, transparent); }
        `}</style>

        {/* Sidebar (w-64 expanded, w-16 collapsed) */}
        <Sidebar
          repoName={repoName}
          panel={panel}
          setPanel={setPanel}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          changeCount={changeCount}
          hasConflict={hasConflict}
        />

        {/* Main Panel Area */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          <TopBar
            repoName={repoName}
            branchLabel={branchName}
            accentDotTone={hasConflict ? "bad" : behindCount > 0 ? "warn" : "ok"}
            accounts={accounts}
            activeAccountLogin={activeAccountLogin}
            terminalOpen={terminalOpen}
            onToggleTerminal={onToggleTerminal}
            onSwitchAccount={switchAccount}
            onOpenAccounts={() => setPanel("accounts")}
            onOpenSignIn={() => setModal("deviceAuth")}
          />
          <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
            <div className="w-full max-w-[1400px] mx-auto">{panelContent}</div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "stash" && <StashModal onClose={closeModal} onStash={(msg) => void doStash(msg)} />}
      {modal === "discardAll" && <DiscardAllModal count={changeCount} onClose={closeModal} onConfirm={() => void doDiscardAll()} />}
      {modal === "forcePush" && (
        <ForcePushModal
          branch={branchName}
          onClose={closeModal}
          onConfirm={() => {
            onRunInTerminal(`git push --force-with-lease origin ${branchName}`);
            closeModal();
          }}
        />
      )}
      {modal === "createPR" && (
        <CreatePRModal
          currentBranch={branchName}
          branches={allBranches}
          lastSubject={commits[0]?.subject || ""}
          onClose={closeModal}
          onCreate={(pr) => {
            onRunInTerminal(`gh pr create --title "${pr.title}" --base ${pr.base} --body "${pr.body}"${pr.draft ? " --draft" : ""}`);
            closeModal();
          }}
        />
      )}
      {modal === "addRemote" && (
        <AddRemoteModal
          onClose={closeModal}
          onAdd={(r) => {
            onRunInTerminal(`git remote add ${r.name} ${r.url}`);
            closeModal();
          }}
        />
      )}
      {modal === "deviceAuth" && (
        <DeviceAuthModal
          cwd={cwd}
          onRunGitHubLogin={onRunGitHubLogin}
          onClose={closeModal}
          onConfirm={() => {
            closeModal();
          }}
        />
      )}
      {modal === "newWorktree" && (
        <NewWorktreeModal
          branches={allBranches}
          currentBranch={branchName}
          onClose={closeModal}
          onCreate={(wt) => {
            onRunInTerminal(`git worktree add -b ${wt.branch} ${wt.path} ${wt.base}`);
            closeModal();
          }}
        />
      )}
      {modal === "draftRelease" && (
        <DraftReleaseModal
          tags={commits.map((c) => ({ name: c.shortSha }))}
          commits={commits}
          onClose={closeModal}
          onPublish={(rel) => {
            onRunInTerminal(`gh release create ${rel.tag} --title "${rel.title}" --notes "${rel.notes}"${rel.prerelease ? " --prerelease" : ""}`);
            closeModal();
          }}
        />
      )}
      {modal === "pullSource" && (
        <PullSourceModal
          branches={allBranches}
          currentBranch={branchName}
          onClose={closeModal}
          onConfirm={(sourceBranch) => void stashPullReapply(sourceBranch)}
        />
      )}
      {modal !== null && typeof modal === "object" && modal.kind === "reset" && (
        <ResetModal
          commit={modal.commit}
          onClose={closeModal}
          onReset={(mode) => {
            onRunInTerminal(`git reset --${mode} ${modal.commit.sha}`);
            closeModal();
          }}
        />
      )}
    </GitEnvironmentGate>
  );
}
