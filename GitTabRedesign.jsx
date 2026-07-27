import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, Check, Sun, Moon, Github, X,
  GitBranch, GitCommit, GitPullRequest, GitMerge, Tag, History as HistoryIcon,
  Users, FolderGit2, Package, AlertTriangle, RefreshCw, FileDiff,
  KeyRound, Plus, Minus, CircleAlert, Upload, Download, Sparkles, Loader2, Copy, ExternalLink,
  Settings, MoreHorizontal, RotateCcw, Undo2, Trash2, Search, Pencil,
} from 'lucide-react';

// Same monotone-accent convention as the Agents tab: white in dark mode,
// near-black in light mode, driven entirely by CSS variables.
const ACCENT = 'var(--accent)';
const ACCENT_CONTRAST = 'var(--accent-contrast)';

/* ============================== Static fixtures ============================== */

const REPO_NAME = 'Digital-Eval-Backend';

const BASE_UNSTAGED = [
  { p: '.github/workflows/deploy.yml', t: 'mod', ins: 34, del: 34 },
  { p: '.gitignore', t: 'mod', ins: 79, del: 79 },
  { p: 'Digital-Eval-Backend/.dockerignore', t: 'mod', ins: 53, del: 53 },
  { p: 'Digital-Eval-Backend/.prettierrc', t: 'mod', ins: 11, del: 11 },
  { p: 'Digital-Eval-Backend/app.js', t: 'mod', ins: 101, del: 101 },
  { p: 'Digital-Eval-Backend/config/azureBlob.js', t: 'mod', ins: 42, del: 42 },
  { p: 'Digital-Eval-Backend/config/database.js', t: 'mod', ins: 42, del: 42 },
];
const BASE_STAGED = [
  { p: 'Digital-Eval-Backend/controllers/annotations.js', t: 'add', ins: 94, del: 0 },
  { p: 'Digital-Eval-Backend/controllers/auth.js', t: 'mod', ins: 18, del: 6 },
];
const BASE_CONFLICT_FILES = [
  {
    p: 'Digital-Eval-Backend/config/database.js',
    hunks: [{
      header: '@@ -18,3 +18,3 @@ ssl config',
      ours: ['  ssl: {', '    rejectUnauthorized: process.env.NODE_ENV === "production",', '  },'],
      theirs: ['  ssl: {', '    rejectUnauthorized: true,', '  },'],
    }],
  },
  {
    p: 'Digital-Eval-Backend/app.js',
    hunks: [
      {
        header: '@@ -8,2 +8,3 @@ middleware order',
        ours: ['app.use(cors());', 'app.use(helmet());'],
        theirs: ['app.use(helmet());', 'app.use(cors());', 'app.use(rateLimiter());'],
      },
      {
        header: '@@ -22,1 +23,1 @@ route mount',
        ours: [`app.use('/api/annotations', annotationsRouter);`],
        theirs: [`app.use('/api/v2/annotations', annotationsRouter);`],
      },
    ],
  },
];
const BASE_COMMITS = [
  { sha: '9dceceb', subj: 'feat(auth): add Home button in login page desktop and mobile headers', who: 'Harthik Kuppam', when: 'May 28, 4:01 PM', head: true, refs: ['HEAD', 'demo'] },
  { sha: '8326ed6', subj: 'feat(student): restore original rich dashboard UI, suppress non-critical PDF.js warnings', who: 'Harthik Kuppam', when: 'May 28, 3:53 PM' },
  { sha: '560dbae', subj: 'feat(student): resolve notification bug, add password visibility toggle/meter', who: 'Harthik Kuppam', when: 'May 28, 3:37 PM' },
  { sha: '0b5c32c', subj: 'updated the navbar also to have profile pic', who: 'SONALISHARMA2425', when: 'May 28, 3:35 PM' },
  { sha: '23a1531', subj: 'updated the password to have an strong password check', who: 'SONALISHARMA2425', when: 'May 28, 3:29 PM' },
];
const BASE_BRANCHES = [
  { name: 'demo', current: true, merged: false },
  { name: 'main', current: false, merged: true },
  { name: 'deps/azure-blob', current: false, merged: false },
];
const BASE_PRS = [
  { n: 142, title: 'feat(auth): add Home button to headers', state: 'open', branch: 'demo → main', body: 'Adds a Home link to the desktop and mobile header nav. Tested on both breakpoints.' },
  { n: 138, title: 'chore: dependency bump for azure-storage-blob', state: 'draft', branch: 'deps/azure-blob → main', body: 'Bumps @azure/storage-blob to the latest minor. No code changes required.' },
];
const BASE_TAGS = [
  { name: 'v1.4.0', sha: '7f2a91c', when: 'May 20, 2026' },
  { name: 'v1.3.2', sha: '3bd410a', when: 'May 6, 2026' },
];
const BASE_STASHES = [
  { ref: 'stash@{0}', msg: 'WIP: pagination edge case', when: '2 hours ago' },
];
const BASE_ACCOUNTS = [
  { login: 'mxyxyz9', host: 'github.com', scopes: ['repo', 'read:org'], active: true },
  { login: 'harthik-work', host: 'github.com', scopes: ['repo', 'workflow'], active: false },
];

const DIFF_SNIPPETS = [
  [
    { type: 'hunk', text: '@@ -12,7 +12,7 @@ const pool = new Pool({' },
    { type: 'ctx', text: '  host: process.env.DB_HOST,' },
    { type: 'del', text: '  port: 5432,' },
    { type: 'add', text: '  port: process.env.DB_PORT ?? 5432,' },
    { type: 'ctx', text: '  ssl: {' },
    { type: 'del', text: '    rejectUnauthorized: false' },
    { type: 'add', text: '    rejectUnauthorized: process.env.NODE_ENV === "production"' },
    { type: 'ctx', text: '  },' },
  ],
  [
    { type: 'hunk', text: '@@ -3,6 +3,10 @@ function Header() {' },
    { type: 'ctx', text: '  return (' },
    { type: 'add', text: '    <Link to="/">Home</Link>' },
    { type: 'ctx', text: '    <nav>' },
    { type: 'ctx', text: '      ...' },
  ],
  [
    { type: 'hunk', text: '@@ -44,4 +44,9 @@ export function paginate(items, cursor) {' },
    { type: 'ctx', text: '  const start = cursor ?? 0;' },
    { type: 'del', text: '  return items.slice(start, start + 20);' },
    { type: 'add', text: '  const pageSize = Math.min(limit ?? 20, 100);' },
    { type: 'add', text: '  return items.slice(start, start + pageSize);' },
  ],
  [
    { type: 'hunk', text: '@@ -1,5 +1,6 @@' },
    { type: 'ctx', text: 'import { useEffect } from "react";' },
    { type: 'add', text: 'import { useMemo } from "react";' },
    { type: 'del', text: 'const cache = {};' },
    { type: 'add', text: 'const cache = new Map();' },
  ],
  [
    { type: 'hunk', text: '@@ -88,3 +88,7 @@ describe("auth", () => {' },
    { type: 'add', text: '  it("rejects expired tokens", () => {' },
    { type: 'add', text: '    expect(verify(expiredToken)).toBe(false);' },
    { type: 'add', text: '  });' },
    { type: 'ctx', text: '});' },
  ],
];
// Deterministic (not random) so the same file/commit always shows the same
// diff on repeated visits, but different files/commits show different content
// instead of one hardcoded snippet everywhere.
function hashKey(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function diffLinesFor(key) { return DIFF_SNIPPETS[hashKey(key) % DIFF_SNIPPETS.length]; }
function statsFor(key) { const h = hashKey(key); return { ins: 3 + (h % 22), del: h % 9 }; }

const SCENARIOS = [
  { id: 'clean', label: 'Clean — everything set up', tone: 'ok' },
  { id: 'noGit', label: 'Git not installed', tone: 'bad' },
  { id: 'notRepo', label: 'Not a Git repository yet', tone: 'bad' },
  { id: 'noRemote', label: 'No remote configured', tone: 'warn' },
  { id: 'notAuthed', label: 'GitHub CLI not authenticated', tone: 'warn' },
  { id: 'noAccess', label: 'Authenticated, but no repo access', tone: 'bad' },
  { id: 'conflict', label: 'Merge conflict in progress', tone: 'bad' },
  { id: 'diverged', label: 'Branch diverged from remote', tone: 'warn' },
  { id: 'detached', label: 'Detached HEAD', tone: 'warn' },
  { id: 'huge', label: '250+ changed files', tone: 'warn' },
  { id: 'mismatch', label: 'Account / credential mismatch', tone: 'warn' },
];

const NAV = [
  { id: 'overview', label: 'Overview', icon: FolderGit2, desc: 'Repo health, quick actions, and sync status' },
  { id: 'changes', label: 'Changes', icon: GitCommit, badge: 'changes', desc: 'Stage, commit, and review working tree changes' },
  { id: 'diff', label: 'Diff', icon: FileDiff, desc: 'Browse diffs for working tree files or past commits' },
  { id: 'branches', label: 'Branches', icon: GitBranch, desc: 'Switch, create, or rename branches' },
  { id: 'history', label: 'History', icon: HistoryIcon, desc: 'Commit timeline for the current branch' },
  { id: 'prs', label: 'Pull requests', icon: GitPullRequest, badge: 'prs', desc: 'Open, review, and create pull requests' },
  { id: 'tags', label: 'Tags & releases', icon: Tag, desc: 'Tag commits and draft releases' },
  { id: 'stashes', label: 'Stashes', icon: Package, desc: 'Set changes aside and reapply them later' },
  { id: 'accounts', label: 'Accounts', icon: Users, desc: 'Manage which GitHub account this project uses' },
  { id: 'settings', label: 'Settings', icon: Settings, desc: 'Git identity, remotes, and repo-level config' },
];

const STRATEGY_LABEL = { ours: 'Using current', theirs: 'Using incoming', both: 'Using both', manual: 'Edited manually' };

function makeInitialState(id) {
  const unstaged = BASE_UNSTAGED.map((f) => ({ ...f }));
  if (id === 'huge') {
    for (let i = 0; i < 260; i++) unstaged.push({ p: `Digital-Eval-Backend/src/generated/file${i + 1}.js`, t: 'mod', ins: 2, del: 2 });
  }
  const base = {
    hasGit: true, hasRepo: true, hasRemote: true, ghAuthed: true, hasAccess: true,
    detached: false, branch: 'demo', ahead: 0, behind: 0, conflict: false, credentialMismatch: false,
    historyRewritten: false,
    repoName: REPO_NAME,
    remoteUrl: 'git@github.com:acme-co/digital-eval-backend.git',
    remotes: [{ name: 'origin', url: 'git@github.com:acme-co/digital-eval-backend.git' }],
    gitIdentity: { name: 'Harthik Kuppam', email: 'harthik@example.com' },
    sshIdentity: 'harthik-work',
    gitignoreText: 'node_modules/\n.env\ndist/\n*.log',
    staged: BASE_STAGED.map((f) => ({ ...f })),
    unstaged,
    commits: BASE_COMMITS.map((c) => ({ ...c })),
    branches: BASE_BRANCHES.map((b) => ({ ...b })),
    worktrees: [],
    prs: BASE_PRS.map((p) => ({ ...p })),
    tags: BASE_TAGS.map((t) => ({ ...t })),
    releases: [],
    stashes: BASE_STASHES.map((s) => ({ ...s })),
    accounts: BASE_ACCOUNTS.map((a) => ({ ...a })),
    conflictFiles: BASE_CONFLICT_FILES.map((f) => ({ ...f, hunks: f.hunks.map((h) => ({ ...h })) })),
    conflictResolutions: {},
  };
  const overrides = {
    noGit: { hasGit: false },
    notRepo: { hasRepo: false },
    noRemote: { hasRemote: false, remoteUrl: null, remotes: [] },
    notAuthed: { ghAuthed: false, hasAccess: false },
    noAccess: { hasAccess: false },
    conflict: { conflict: true, behind: 1 },
    diverged: { ahead: 3, behind: 2 },
    detached: { detached: true, branch: '9dceceb' },
    mismatch: { credentialMismatch: true },
  }[id] || {};
  return { ...base, ...overrides };
}

/* Adds sequential old/new line numbers to a diff line array, resetting off
   the hunk header's @@ -a,b +c,d @@ markers, like a real diff viewer. */
function withLineNumbers(lines) {
  let oldNo = 0;
  let newNo = 0;
  return lines.map((l) => {
    if (l.type === 'hunk') {
      const m1 = l.text.match(/-(\d+)/);
      const m2 = l.text.match(/\+(\d+)/);
      if (m1) oldNo = parseInt(m1[1], 10);
      if (m2) newNo = parseInt(m2[1], 10);
      return { ...l, oldNo: null, newNo: null };
    }
    if (l.type === 'del') return { ...l, oldNo: oldNo++, newNo: null };
    if (l.type === 'add') return { ...l, oldNo: null, newNo: newNo++ };
    return { ...l, oldNo: oldNo++, newNo: newNo++ };
  });
}

/* ============================== Small pieces ============================= */

const ThemeToggle = ({ theme, onToggle, className = '' }) => (
  <button
    onClick={onToggle}
    className={`flex items-center justify-center rounded-lg bg-o1 hov-bg-o2 bd-1 hov-bd-2 tx-50 hov-tx-80 transition-all shrink-0 ${className}`}
    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  >
    {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
  </button>
);

const TONE = {
  ok: { color: 'var(--sem-emerald)', dot: 'var(--sem-emerald)', soft: 'var(--sem-emerald-soft)', border: 'var(--sem-emerald-border)' },
  warn: { color: 'var(--sem-amber)', dot: 'var(--sem-amber)', soft: 'var(--sem-amber-soft)', border: 'var(--sem-amber-border)' },
  bad: { color: 'var(--sem-red)', dot: 'var(--sem-red)', soft: 'var(--sem-red-soft)', border: 'var(--sem-red-border)' },
  info: { color: 'var(--sem-sky)', dot: 'var(--sem-sky)', soft: 'var(--sem-sky-soft)', border: 'var(--sem-sky-border)' },
};

const Banner = ({ tone = 'info', title, body, actions }) => {
  const c = TONE[tone];
  const Icon = tone === 'warn' ? AlertTriangle : CircleAlert;
  return (
    <div className="w-full flex items-start gap-3 rounded-lg border px-4 py-3 mb-4" style={{ borderColor: c.border, backgroundColor: c.soft }}>
      <Icon size={14} className="shrink-0 mt-0.5" style={{ color: c.color }} />
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-xs font-semibold" style={{ color: c.color }}>{title}</span>
        {body && <span className="text-xs tx-50 leading-relaxed">{body}</span>}
        {actions && <div className="flex flex-wrap items-center gap-2 mt-1">{actions}</div>}
      </div>
    </div>
  );
};

const Btn = ({ children, icon: Icon, primary, ghost, sm, disabled, title, onClick, as: As = 'button', href, className: extraClass = '' }) => {
  const cls = `inline-flex items-center gap-1.5 rounded-lg font-medium transition-all shrink-0 ${
    sm ? 'h-6 px-2 fs-11' : 'h-7 px-2.5 text-xs'
  } ${
    primary ? 'hover:opacity-90' : ghost ? 'bg-transparent hov-bg-o1 border bd-1 hov-bd-2 tx-60 hov-tx-90' : 'bg-o1 hov-bg-o2 bd-1 hov-bd-2 tx-70 hov-tx'
  } ${disabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''} ${extraClass}`;
  const style = primary && !disabled ? { backgroundColor: ACCENT, color: ACCENT_CONTRAST } : undefined;
  const content = <>{Icon && <Icon size={sm ? 11 : 12} className={Icon === Loader2 ? 'animate-spin' : undefined} />}{children}</>;
  if (As === 'a') {
    return <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={cls} style={style}>{content}</a>;
  }
  return <button onClick={onClick} disabled={disabled} title={title} className={cls} style={style}>{content}</button>;
};

const SectionLabel = ({ children, action }) => (
  <div className="flex items-center justify-between mt-5 mb-2 first:mt-0">
    <span className="text-xs font-mono uppercase tracking-widest tx-30">{children}</span>
    {action}
  </div>
);

const Card = ({ children, className = '' }) => (
  <div className={`border bd-2 rounded-lg ${className}`} style={{ backgroundColor: 'var(--bg-surface)' }}>{children}</div>
);

/* ---- Redesigned diff viewer: dual line-number gutter, soft accent-bar
   tinting instead of solid color blocks, hunk header rendered as a dotted
   divider. Reads much closer to GitHub/Linear's diff view than flat text. */
const DiffLines = ({ lines }) => {
  const numbered = withLineNumbers(lines);
  return (
    <div className="font-mono fs-12" style={{ lineHeight: 1.75 }}>
      {numbered.map((l, i) => {
        if (l.type === 'hunk') {
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="flex-1 h-px bg-o2"></div>
              <span className="fs-10 tx-30 whitespace-pre shrink-0">{l.text}</span>
              <div className="flex-1 h-px bg-o2"></div>
            </div>
          );
        }
        const isAdd = l.type === 'add';
        const isDel = l.type === 'del';
        const barColor = isAdd ? 'var(--sem-emerald)' : isDel ? 'var(--sem-red)' : 'transparent';
        const rowStyle = {
          backgroundColor: isAdd ? 'var(--sem-emerald-soft)' : isDel ? 'var(--sem-red-soft)' : 'transparent',
          borderLeft: `2px solid ${barColor}`,
        };
        return (
          <div key={i} className="flex" style={rowStyle}>
            <span className="w-7 shrink-0 text-right pr-1.5 select-none fs-10 tx-20">{l.oldNo || ''}</span>
            <span className="w-7 shrink-0 text-right pr-1.5 select-none fs-10 tx-20 border-r bd-1 mr-2">{l.newNo || ''}</span>
            <span className="w-3 shrink-0 select-none fs-11" style={{ color: isAdd ? 'var(--sem-emerald)' : isDel ? 'var(--sem-red)' : 'var(--fg-20)' }}>
              {isAdd ? '+' : isDel ? '-' : ''}
            </span>
            <span className="whitespace-pre pr-3" style={{ color: isAdd ? 'var(--sem-emerald-text)' : isDel ? 'var(--sem-red-text)' : 'var(--fg-60)' }}>{l.text}</span>
          </div>
        );
      })}
    </div>
  );
};

const StatPill = ({ ins, del }) => (
  <span className="flex items-center gap-1.5 fs-11 font-mono shrink-0">
    <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--sem-emerald-soft)', color: 'var(--sem-emerald)' }}>+{ins}</span>
    <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--sem-red-soft)', color: 'var(--sem-red)' }}>-{del}</span>
  </span>
);

const PathBreadcrumb = ({ path }) => {
  const parts = path.split('/');
  const file = parts.pop();
  return (
    <span className="text-xs font-mono truncate flex items-center gap-1 min-w-0" title={path}>
      {parts.length > 0 && <span className="tx-30 truncate">{parts.join('/')}/</span>}
      <span className="tx-85 font-medium shrink-0">{file}</span>
    </span>
  );
};

const DiffCard = ({ path, ins, del, lines }) => (
  <Card className="overflow-hidden">
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bd-2 bg-o05">
      <PathBreadcrumb path={path} />
      <StatPill ins={ins} del={del} />
    </div>
    <div className="py-2 overflow-x-auto"><DiffLines lines={lines} /></div>
  </Card>
);

const Dropdown = ({ trigger, children, open, setOpen, align = 'left', width = 'w-72' }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setOpen]);
  return (
    <div className="relative" ref={ref}>
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} ${width} rounded-xl shadow-2xl overflow-hidden z-50 border bd-2`} style={{ backgroundColor: 'var(--bg-surface)' }}>
          {children}
        </div>
      )}
    </div>
  );
};

function InlineForm({ placeholder, initial = '', onSubmit, onCancel, submitLabel = 'Save' }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex items-center gap-2 bg-o1 border bd-2 rounded-lg px-2.5 py-2 mb-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSubmit(value.trim()); if (e.key === 'Escape') onCancel(); }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs font-mono tx outline-none min-w-0"
      />
      <Btn sm primary disabled={!value.trim()} onClick={() => value.trim() && onSubmit(value.trim())}>{submitLabel}</Btn>
      <Btn sm ghost onClick={onCancel}>Cancel</Btn>
    </div>
  );
}

/* Starts at a compact ~2 lines and grows with content instead of sitting
   as one large mostly-empty box — same technique as any real commit-message
   composer (measure scrollHeight, set height to match). */
function AutoTextarea({ value, onChange, placeholder, className = '', minRows = 2 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
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
      style={{ backgroundColor: 'var(--bg-base)', resize: 'none', overflow: 'hidden' }}
    />
  );
}

/* ============================== Modals ============================== */

const Field = ({ label, children }) => (
  <div className="mb-3">
    <label className="fs-10 uppercase tracking-widest tx-30 block mb-1.5">{label}</label>
    {children}
  </div>
);

const TextInput = (props) => (
  <input {...props} className={`w-full border bd-2 rounded-lg tx text-xs ph-25 px-3 py-2 outline-none foc-bd-3 transition-colors ${props.className || ''}`} style={{ backgroundColor: 'var(--bg-base)' }} />
);

const Select = (props) => (
  <select {...props} className={`w-full border bd-2 rounded-lg tx text-xs px-3 py-2 outline-none foc-bd-3 transition-colors ${props.className || ''}`} style={{ backgroundColor: 'var(--bg-base)' }} />
);

function Modal({ title, onClose, children, width = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className={`w-full ${width} rounded-xl border bd-2 shadow-2xl overflow-hidden`} style={{ backgroundColor: 'var(--bg-surface)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b bd-1">
          <span className="text-sm font-semibold tx">{title}</span>
          <button onClick={onClose} className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors"><X size={14} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function InitRepoModal({ currentName, onInit, onClone, onClose }) {
  const [mode, setMode] = useState('init');
  const [name, setName] = useState(currentName);
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneNameEdited, setCloneNameEdited] = useState(false);
  const [cloneName, setCloneName] = useState(currentName);

  const handleCloneUrlChange = (e) => {
    const url = e.target.value;
    setCloneUrl(url);
    if (!cloneNameEdited) {
      const guess = url.split('/').pop()?.replace(/\.git$/, '');
      if (guess) setCloneName(guess);
    }
  };

  return (
    <Modal title="Set up this project" onClose={onClose} width="max-w-md">
      <div className="flex items-center gap-1 mb-4 bg-o1 border bd-2 rounded-lg p-1 w-fit">
        <button onClick={() => setMode('init')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'init' ? 'bg-o2 tx' : 'tx-40 hov-tx-70'}`}>Initialize new</button>
        <button onClick={() => setMode('clone')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'clone' ? 'bg-o2 tx' : 'tx-40 hov-tx-70'}`}>Clone existing</button>
      </div>

      {mode === 'init' ? (
        <>
          <Field label="Project name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={REPO_NAME} />
          </Field>
          <Field label="Default branch name">
            <TextInput value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} placeholder="main" />
          </Field>
          <p className="fs-11 tx-40 leading-relaxed mb-4">Creates an empty repository in this folder with no commits or remote yet.</p>
          <div className="flex items-center justify-end gap-2">
            <Btn ghost onClick={onClose}>Cancel</Btn>
            <Btn primary disabled={!defaultBranch.trim() || !name.trim()} onClick={() => onInit(name.trim(), defaultBranch.trim() || 'main')}>Initialize repository</Btn>
          </div>
        </>
      ) : (
        <>
          <Field label="Repository URL">
            <TextInput value={cloneUrl} onChange={handleCloneUrlChange} placeholder="git@github.com:org/repo.git" />
          </Field>
          <Field label="Project name">
            <TextInput value={cloneName} onChange={(e) => { setCloneNameEdited(true); setCloneName(e.target.value); }} placeholder={REPO_NAME} />
          </Field>
          <p className="fs-11 tx-40 leading-relaxed mb-4">Clones the full history and sets it as origin for this folder.</p>
          <div className="flex items-center justify-end gap-2">
            <Btn ghost onClick={onClose}>Cancel</Btn>
            <Btn primary disabled={!cloneUrl.trim() || !cloneName.trim()} onClick={() => onClone(cloneName.trim(), cloneUrl.trim())}>Clone repository</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

function ResetModal({ commit, onReset, onClose }) {
  const [mode, setMode] = useState('mixed');
  const MODES = [
    { id: 'soft', label: 'Soft', desc: 'Move HEAD only. All changes since stay staged, ready to re-commit.' },
    { id: 'mixed', label: 'Mixed', desc: 'Move HEAD and unstage. Changes since stay in your working tree.' },
    { id: 'hard', label: 'Hard', desc: 'Move HEAD and discard everything — commits and working tree changes both. Cannot be undone.' },
  ];
  return (
    <Modal title="Reset to this commit" onClose={onClose} width="max-w-md">
      <div className="fs-12 font-mono tx-70 mb-4 px-3 py-2 rounded-lg bg-o1 border bd-2">{commit.sha} — {commit.subj}</div>
      <div className="flex flex-col gap-2 mb-4">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className="text-left px-3 py-2.5 rounded-lg border transition-colors"
            style={{ borderColor: mode === m.id ? (m.id === 'hard' ? 'var(--sem-red-border)' : 'var(--overlay-20)') : 'var(--overlay-10)', backgroundColor: mode === m.id ? (m.id === 'hard' ? 'var(--sem-red-soft)' : 'var(--overlay-5)') : 'transparent' }}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="fs-12 font-semibold" style={{ color: mode === m.id && m.id === 'hard' ? 'var(--sem-red)' : 'var(--fg)' }}>{m.label}</span>
              {mode === m.id && <Check size={12} className="tx-40" />}
            </div>
            <div className="fs-11 tx-40 leading-relaxed">{m.desc}</div>
          </button>
        ))}
      </div>
      {mode === 'hard' && (
        <Banner tone="bad" title="This can't be undone" body="Hard reset permanently discards commits and any uncommitted work in one step." />
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={() => onReset(mode)}>Reset ({mode})</Btn>
      </div>
    </Modal>
  );
}

function ForcePushModal({ branch, onConfirm, onClose }) {
  return (
    <Modal title="Force push" onClose={onClose} width="max-w-sm">
      <Banner tone="bad" title="This overwrites the remote branch" body={`If anyone else has pushed to ${branch} since your last pull, force-pushing discards their commits on the remote. This is common after an amend or rebase, but double-check before continuing.`} />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={onConfirm}>Force push anyway</Btn>
      </div>
    </Modal>
  );
}

function StashModal({ onStash, onClose }) {
  const [message, setMessage] = useState('');
  return (
    <Modal title="Stash changes" onClose={onClose} width="max-w-sm">
      <Field label="Message (optional)">
        <TextInput value={message} onChange={(e) => setMessage(e.target.value)} placeholder="WIP: pagination edge case" />
      </Field>
      <p className="fs-11 tx-40 leading-relaxed mb-4">Sets aside everything currently staged and unstaged, and clears your working tree.</p>
      <div className="flex items-center justify-end gap-2">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={() => onStash(message.trim())}>Stash changes</Btn>
      </div>
    </Modal>
  );
}

function PullSourceModal({ branches, currentBranch, remoteName, onClose, onConfirm }) {
  const [source, setSource] = useState(currentBranch);
  return (
    <Modal title="Stash, pull &amp; reapply" onClose={onClose} width="max-w-sm">
      <Field label="Pull from">
        <Select value={source} onChange={(e) => setSource(e.target.value)}>
          {branches.map((b) => (
            <option key={b.name} value={b.name}>{remoteName}/{b.name}{b.name === currentBranch ? ' (your tracked branch)' : ''}</option>
          ))}
        </Select>
      </Field>
      <p className="fs-11 tx-40 leading-relaxed mb-4">
        Defaults to your own branch's upstream. Pick a different branch to pull in someone else's work instead — useful when a teammate pushed changes you want without switching branches yourself. Your current changes are stashed first either way, and reapplied after.
      </p>
      <div className="flex items-center justify-end gap-2">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary icon={RefreshCw} onClick={() => onConfirm(source)}>Stash, pull &amp; reapply</Btn>
      </div>
    </Modal>
  );
}

function DiscardAllModal({ count, onConfirm, onClose }) {
  return (
    <Modal title="Discard all changes" onClose={onClose} width="max-w-sm">
      <Banner tone="bad" title={`This discards ${count} file${count === 1 ? '' : 's'}`} body="Every uncommitted change in the working tree and staging area is permanently lost. This can't be undone." />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={onConfirm}>Discard everything</Btn>
      </div>
    </Modal>
  );
}

function CreatePRModal({ repo, onCreate, onClose }) {
  const lastSubj = repo.commits[0]?.subj || '';
  const [title, setTitle] = useState(lastSubj);
  const [base, setBase] = useState(repo.branches.find((b) => b.name !== repo.branch)?.name || 'main');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(false);

  return (
    <Modal title="Create pull request" onClose={onClose}>
      <div className="flex items-center gap-2 mb-4 fs-12 font-mono">
        <span className="px-2 py-1 rounded bg-o1 border bd-2 tx-70">{base}</span>
        <span className="tx-30">&larr;</span>
        <span className="px-2 py-1 rounded bg-o1 border bd-2 tx">{repo.branch}</span>
      </div>
      <Field label="Base branch">
        <Select value={base} onChange={(e) => setBase(e.target.value)}>
          {repo.branches.filter((b) => b.name !== repo.branch).map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
        </Select>
      </Field>
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Describe the change" />
      </Field>
      <Field label="Description">
        <AutoTextarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add more detail for reviewers (optional)…" minRows={3}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors" />
      </Field>
      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
        <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} className="w-3.5 h-3.5" />
        <span className="text-xs tx-60">Open as draft</span>
      </label>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary disabled={!title.trim()} onClick={() => onCreate({ title: title.trim(), base, body: body.trim(), draft })}>
          {draft ? 'Create draft' : 'Create pull request'}
        </Btn>
      </div>
    </Modal>
  );
}

function AddRemoteModal({ onAdd, onClose }) {
  const [name, setName] = useState('origin');
  const [url, setUrl] = useState('');
  return (
    <Modal title="Add remote" onClose={onClose} width="max-w-md">
      <Field label="Remote name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Remote URL">
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="git@github.com:org/repo.git" />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary disabled={!url.trim()} onClick={() => onAdd({ name: name.trim() || 'origin', url: url.trim() })}>Add remote</Btn>
      </div>
    </Modal>
  );
}

/* Shared shell for GitHub's actual device-authorization UX pattern (a code
   to enter on github.com, then wait). There's no real backend here to poll,
   so it's an honest simulation — a manual "I've authorized it" step rather
   than pretending to auto-detect a real approval. */
function DeviceAuthModal({ title, subtitle, onConfirm, onClose }) {
  const [code] = useState(() => Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase());
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => onConfirm(), 700);
  };

  return (
    <Modal title={title} onClose={onClose} width="max-w-sm">
      <p className="text-xs tx-50 leading-relaxed mb-4">{subtitle}</p>
      <div className="flex items-center justify-between gap-2 border bd-2 rounded-lg px-3 py-2.5 mb-3" style={{ backgroundColor: 'var(--bg-base)' }}>
        <span className="fs-13 font-mono tracking-widest tx">{code}</span>
        <button onClick={copyCode} className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors" title="Copy code">
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <Btn as="a" href="https://github.com/login/device" ghost className="w-full justify-center mb-4">
        Open github.com/login/device <ExternalLink size={11} />
      </Btn>
      <div className="flex items-center justify-end gap-2">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary icon={confirming ? Loader2 : undefined} disabled={confirming} onClick={handleConfirm}>
          {confirming ? 'Confirming…' : "I've authorized it"}
        </Btn>
      </div>
    </Modal>
  );
}

function NewWorktreeModal({ repo, onCreate, onClose }) {
  const [base, setBase] = useState(repo.branch);
  const [branch, setBranch] = useState('');
  const [path, setPath] = useState('../demo-worktree');
  return (
    <Modal title="New worktree" onClose={onClose} width="max-w-md">
      <Field label="Based on">
        <Select value={base} onChange={(e) => setBase(e.target.value)}>
          {repo.branches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
        </Select>
      </Field>
      <Field label="New branch name (optional)">
        <TextInput value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Leave blank to check out an existing branch" />
      </Field>
      <Field label="Path">
        <TextInput value={path} onChange={(e) => setPath(e.target.value)} />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary disabled={!path.trim()} onClick={() => onCreate({ base, branch: branch.trim() || base, path: path.trim() })}>Create worktree</Btn>
      </div>
    </Modal>
  );
}

function DraftReleaseModal({ repo, onPublish, onClose }) {
  const [tag, setTag] = useState(repo.tags[0]?.name || '');
  const [customTag, setCustomTag] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [prerelease, setPrerelease] = useState(false);
  const effectiveTag = tag === '__new__' ? customTag.trim() : tag;

  const generateNotes = () => {
    const bullets = repo.commits.slice(0, 5).map((c) => `- ${c.subj}`).join('\n');
    setNotes(bullets);
    if (!title.trim()) setTitle(effectiveTag || 'Release');
  };

  return (
    <Modal title="Draft a release" onClose={onClose}>
      <Field label="Tag">
        <Select value={tag} onChange={(e) => setTag(e.target.value)}>
          {repo.tags.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          <option value="__new__">Create a new tag…</option>
        </Select>
      </Field>
      {tag === '__new__' && (
        <Field label="New tag name">
          <TextInput value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="v1.5.0" />
        </Field>
      )}
      <Field label="Release title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={effectiveTag || 'Release title'} />
      </Field>
      <Field label={<span className="flex items-center justify-between"><span>Release notes</span><button onClick={generateNotes} className="normal-case tracking-normal fs-10 tx-40 hov-tx-70 flex items-center gap-1"><Sparkles size={10} />Generate from recent commits</button></span>}>
        <AutoTextarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed in this release…" minRows={4}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors" />
      </Field>
      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
        <input type="checkbox" checked={prerelease} onChange={(e) => setPrerelease(e.target.checked)} className="w-3.5 h-3.5" />
        <span className="text-xs tx-60">Mark as pre-release</span>
      </label>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Btn ghost onClick={onClose}>Cancel</Btn>
        <Btn primary disabled={!effectiveTag} onClick={() => onPublish({ tag: effectiveTag, title: title.trim() || effectiveTag, notes: notes.trim(), prerelease })}>Publish release</Btn>
      </div>
    </Modal>
  );
}

/* ============================== Sidebar ============================== */

/* Rich hover tooltip for the collapsed icon rail — replaces the native
   browser title="" tooltip (the plain gray OS box) with a themed card
   showing the section name plus a short description of what it does. */
const RailTooltip = ({ title, desc, children }) => (
  <div className="relative group flex items-center justify-center">
    {children}
    <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-50">
      <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border bd-2 shadow-2xl" style={{ backgroundColor: 'var(--bg-surface)', width: '190px' }}>
        <span className="fs-12 font-medium tx">{title}</span>
        {desc && <span className="fs-10 tx-40" style={{ lineHeight: 1.4 }}>{desc}</span>}
      </div>
    </div>
  </div>
);

const Sidebar = ({ repoName, panel, setPanel, collapsed, setCollapsed, changeCount, prCount, hasConflict }) => {
  const wrapStyle = { backgroundColor: 'var(--bg-base)' };
  if (collapsed) {
    return (
      <div className="w-16 flex flex-col items-center border-r bd-1 shrink-0 h-full py-4 gap-2" style={wrapStyle}>
        <RailTooltip title={repoName} desc="Expand the sidebar for full labels and details">
          <button onClick={() => setCollapsed(false)} className="group relative w-8 h-8 rounded-lg bg-o1 hov-bg-o2 flex items-center justify-center shrink-0 transition-colors">
            <Github size={15} className="tx-70 group-hover:opacity-0 transition-opacity" />
            <ChevronRight size={14} className="absolute tx opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </RailTooltip>
        <div className="w-6 h-px bg-o2 shrink-0 my-1"></div>
        <div className="flex-1 flex flex-col items-center gap-2 w-full px-2 pt-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = panel === n.id;
            const count = n.badge === 'changes' ? changeCount : n.badge === 'prs' ? prCount : null;
            return (
              <RailTooltip key={n.id} title={n.label} desc={n.desc}>
                <button onClick={() => setPanel(n.id)}
                  className={`relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${isActive ? 'bg-o2 ring-safe' : 'bg-o1 hov-bg-o2'}`}>
                  {isActive && <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ backgroundColor: 'var(--fg)' }}></span>}
                  <Icon size={15} className="tx-70" />
                  {count ? (
                    <span className="absolute -bottom-1 -right-1 h-4 px-1 rounded-full border bd-2 fs-9 font-mono flex items-center justify-center"
                      style={{ minWidth: '16px', color: n.id === 'changes' && hasConflict ? 'var(--sem-red)' : 'var(--fg-60)', backgroundColor: 'var(--bg-base)' }}>
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
        <button onClick={() => setCollapsed(true)} className="w-7 h-7 rounded-lg bg-o1 hov-bg-o2 border bd-2 hov-bd-3 flex items-center justify-center tx-60 hov-tx transition-all shrink-0" title="Collapse sidebar">
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar px-2">
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = panel === n.id;
          const count = n.badge === 'changes' ? changeCount : n.badge === 'prs' ? prCount : null;
          return (
            <button key={n.id} onClick={() => setPanel(n.id)}
              className={`group relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? 'bg-o1' : 'hov-bg-o1'}`}>
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: 'var(--fg)' }}></span>}
              <Icon size={14} className={isActive ? 'tx' : 'tx-40 ghov-tx-70'} />
              <span className={`fs-13 flex-1 truncate ${isActive ? 'tx font-medium' : 'tx-60 ghov-tx-90'}`}>{n.label}</span>
              {count ? (
                <span className="fs-10 font-mono px-1.5 py-0.5 rounded-full bg-o1 border bd-1"
                  style={{ color: n.id === 'changes' && hasConflict ? 'var(--sem-red)' : 'var(--fg-40)' }}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ============================== Top bar ============================== */

const TopBar = ({ repoName, theme, onToggleTheme, scenario, setScenario, branchLabel, accentDotTone, accounts, activeAccountLogin, onSwitchAccount, onOpenAccounts, onOpenSignIn }) => {
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b bd-1 shrink-0" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="flex items-center gap-2 text-xs font-mono tx-40 min-w-0">
        <FolderGit2 size={13} className="tx-30 shrink-0" />
        <span className="tx-70 truncate">{repoName}</span>
        <span className="tx-20">/</span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bd-2 bg-o1 tx shrink-0">
          <GitBranch size={11} />
          {branchLabel}
        </span>
      </div>

      <div className="flex-1"></div>

      <Dropdown open={scenarioOpen} setOpen={setScenarioOpen} align="right" width="w-80"
        trigger={(toggle) => (
          <button onClick={toggle} className="flex items-center gap-2 h-7 px-2.5 rounded-lg bg-o1 hov-bg-o2 border border-dashed bd-2 hov-bd-3 text-xs tx-60 hov-tx-90 transition-all">
            <RefreshCw size={11} className="tx-30" />
            <span className="font-mono uppercase tracking-wider fs-10 tx-30">Demo</span>
            <span>{SCENARIOS.find((s) => s.id === scenario)?.label}</span>
            <ChevronDown size={11} className="tx-30" />
          </button>
        )}>
        <div className="py-1 max-h-80 overflow-y-auto custom-scrollbar">
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => { setScenario(s.id); setScenarioOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hov-bg-o1 transition-colors ${scenario === s.id ? 'bg-o1' : ''}`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TONE[s.tone].dot }}></span>
              <span className="text-xs tx-80 flex-1 truncate">{s.label}</span>
              {scenario === s.id && <Check size={12} className="tx-40 shrink-0" />}
            </button>
          ))}
        </div>
      </Dropdown>

      <Dropdown open={accountOpen} setOpen={setAccountOpen} align="right" width="w-72"
        trigger={(toggle) => (
          <button onClick={toggle} className="flex items-center gap-2 h-7 pl-1.5 pr-2.5 rounded-full bg-o1 hov-bg-o2 border bd-2 hov-bd-3 transition-all">
            <span className="w-5 h-5 rounded-full bg-o2 flex items-center justify-center fs-10 font-mono font-semibold tx-80">
              {activeAccountLogin ? activeAccountLogin[0].toUpperCase() : '–'}
            </span>
            <span className="text-xs font-mono tx-70">{activeAccountLogin || 'signed out'}</span>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TONE[accentDotTone].dot }}></span>
          </button>
        )}>
        {activeAccountLogin ? (
          <>
            <div className="px-3 pt-3 pb-2 fs-10 uppercase tracking-widest tx-30">Switch account</div>
            <div className="pb-1">
              {accounts.map((a) => (
                <button key={a.login} onClick={() => { onSwitchAccount(a.login); setAccountOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hov-bg-o1 transition-colors">
                  <span className="w-6 h-6 rounded-full bg-o2 flex items-center justify-center fs-10 font-mono font-semibold tx-80 shrink-0">{a.login[0].toUpperCase()}</span>
                  <span className="text-xs font-mono tx-80 flex-1 truncate">{a.nickname ? `${a.nickname} · ${a.login}` : a.login}</span>
                  {a.login === activeAccountLogin && <Check size={12} className="tx-40 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="h-px bg-o1"></div>
            <button onClick={() => { onOpenAccounts(); setAccountOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-left fs-11 tx-50 hov-tx hov-bg-o1 transition-colors">
              <Users size={12} />Manage accounts
            </button>
          </>
        ) : (
          <div className="p-3">
            <div className="fs-11 tx-50 leading-relaxed mb-3">No GitHub account is signed in. Sign in to push, pull, or open pull requests.</div>
            <Btn primary className="w-full justify-center" onClick={() => { onOpenSignIn(); setAccountOpen(false); }}>Sign in to GitHub</Btn>
          </div>
        )}
      </Dropdown>

      <ThemeToggle theme={theme} onToggle={onToggleTheme} className="w-7 h-7" />
    </div>
  );
};

/* ============================== File rows ============================== */

/* Strips the repo-name prefix every path shares (so rows don't all read
   "Digital-Eval-Backend/…" and truncate to the same useless string) and
   stacks a dim directory line over a bright filename line instead. */
const FilePathLabel = ({ path, size = 'fs-11' }) => {
  const rel = path.startsWith(`${REPO_NAME}/`) ? path.slice(REPO_NAME.length + 1) : path;
  const parts = rel.split('/');
  const file = parts.pop();
  const dir = parts.join('/');
  return (
    <div className="min-w-0 flex-1" title={path}>
      {dir && <div className="fs-10 font-mono tx-30 truncate leading-tight">{dir}/</div>}
      <div className={`${size} font-mono tx-80 truncate leading-tight`}>{file}</div>
    </div>
  );
};

const FileRow = ({ f, staged, onOpenDiff, onToggleStage, onDiscard }) => (
  <div className="group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hov-bg-o1 transition-colors">
    <button onClick={() => onOpenDiff(f)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: f.t === 'add' ? 'var(--sem-emerald)' : f.t === 'del' ? 'var(--sem-red)' : 'var(--sem-amber)' }}></span>
      <FilePathLabel path={f.p} size="text-xs" />
    </button>
    <span className="fs-11 font-mono shrink-0" style={{ color: 'var(--sem-emerald)' }}>+{f.ins}</span>
    <span className="fs-11 font-mono shrink-0" style={{ color: 'var(--sem-red)', opacity: 0.85 }}>-{f.del}</span>
    <button onClick={(e) => { e.stopPropagation(); onDiscard(f); }} title="Discard changes to this file"
      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center justify-center w-5 h-5 rounded bg-o1 border bd-2 tx-50 hov-tx">
      <Trash2 size={10} />
    </button>
    <button onClick={(e) => { e.stopPropagation(); onToggleStage(f); }} title={staged ? 'Unstage file' : 'Stage file'}
      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center justify-center w-5 h-5 rounded bg-o1 border bd-2 tx-50 hov-tx">
      {staged ? <Minus size={10} /> : <Plus size={10} />}
    </button>
  </div>
);

/* ============================== Merge conflict resolver ============================== */

function ConflictResolver({ files, resolutions, setResolutions }) {
  const [activeFile, setActiveFile] = useState(0);
  const [editingKey, setEditingKey] = useState(null);
  const [manualText, setManualText] = useState('');

  const key = (fi, hi) => `${fi}:${hi}`;
  const isResolved = (fi, hi) => !!resolutions[key(fi, hi)];
  const fileResolvedCount = (fi) => files[fi].hunks.filter((_, hi) => isResolved(fi, hi)).length;
  const fileDone = (fi) => fileResolvedCount(fi) === files[fi].hunks.length;

  const setStrategy = (fi, hi, strategy, text) => {
    setResolutions((prev) => ({ ...prev, [key(fi, hi)]: { strategy, text } }));
    setEditingKey(null);
  };
  const bulkAll = (strategy) => {
    setResolutions((prev) => {
      const next = { ...prev };
      files.forEach((f, fi) => f.hunks.forEach((_, hi) => { next[key(fi, hi)] = { strategy }; }));
      return next;
    });
  };

  const file = files[activeFile];

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        <Btn sm ghost onClick={() => bulkAll('ours')}>Accept all current</Btn>
        <Btn sm ghost onClick={() => bulkAll('theirs')}>Accept all incoming</Btn>
      </div>

      <div className="flex gap-4">
        <div className="w-48 shrink-0">
          {files.map((f, fi) => (
            <button key={f.p} onClick={() => setActiveFile(fi)}
              className={`w-full text-left px-2.5 py-2 rounded-lg mb-1 transition-colors ${activeFile === fi ? 'bg-o2' : 'hov-bg-o1'}`}>
              <div className="fs-11 font-mono tx-80 truncate leading-tight">{f.p.split('/').pop()}</div>
              <div className="fs-10 font-mono mt-1" style={{ color: fileDone(fi) ? 'var(--sem-emerald)' : 'var(--fg-30)' }}>
                {fileResolvedCount(fi)}/{f.hunks.length} resolved
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {file.hunks.map((h, hi) => {
            const res = resolutions[key(activeFile, hi)];
            const editing = editingKey === key(activeFile, hi);
            return (
              <Card key={hi} className="mb-3 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b bd-2 bg-o05">
                  <span className="fs-11 font-mono tx-40 truncate">{h.header}</span>
                  <span className="fs-10 font-mono px-1.5 py-0.5 rounded-full shrink-0"
                    style={res ? { color: 'var(--sem-emerald)', backgroundColor: 'var(--sem-emerald-soft)' } : { color: 'var(--sem-amber)', backgroundColor: 'var(--sem-amber-soft)' }}>
                    {res ? STRATEGY_LABEL[res.strategy] : 'Unresolved'}
                  </span>
                </div>

                {!editing ? (
                  <>
                    {/* min-w-0 on each grid cell is required — without it a long
                        line in one column ignores the track width and visually
                        bleeds into the sibling column instead of scrolling. */}
                    <div className="grid grid-cols-2">
                      <div className="border-r bd-1 min-w-0">
                        <div className="px-3 py-1.5 fs-10 uppercase tracking-widest tx-30 border-b bd-1">Current (ours)</div>
                        <div className="font-mono fs-11 py-1 overflow-x-auto custom-scrollbar">
                          {h.ours.map((l, li) => <div key={li} className="px-3 py-0.5 whitespace-pre tx-70">{l}</div>)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="px-3 py-1.5 fs-10 uppercase tracking-widest tx-30 border-b bd-1">Incoming (theirs)</div>
                        <div className="font-mono fs-11 py-1 overflow-x-auto custom-scrollbar">
                          {h.theirs.map((l, li) => <div key={li} className="px-3 py-0.5 whitespace-pre tx-70">{l}</div>)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t bd-1">
                      <Btn sm primary={res?.strategy === 'ours'} onClick={() => setStrategy(activeFile, hi, 'ours')}>Use current</Btn>
                      <Btn sm primary={res?.strategy === 'theirs'} onClick={() => setStrategy(activeFile, hi, 'theirs')}>Use incoming</Btn>
                      <Btn sm ghost onClick={() => setStrategy(activeFile, hi, 'both')}>Use both</Btn>
                      <Btn sm ghost onClick={() => { setEditingKey(key(activeFile, hi)); setManualText([...h.ours, ...h.theirs].join('\n')); }}>Edit manually</Btn>
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
                      <Btn sm primary onClick={() => setStrategy(activeFile, hi, 'manual', manualText)}>Save resolution</Btn>
                      <Btn sm ghost onClick={() => setEditingKey(null)}>Cancel</Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {activeFile < files.length - 1 && (
            <Btn disabled={!fileDone(activeFile)} title={!fileDone(activeFile) ? 'Resolve every hunk in this file first' : undefined}
              onClick={() => setActiveFile((i) => Math.min(files.length - 1, i + 1))}>
              Next file
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== Env gate ============================== */

const EnvGate = ({ icon: Icon, title, body, code, actions }) => (
  <div className="max-w-md mx-auto text-center py-14">
    <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-o1 border bd-2 flex items-center justify-center">
      <Icon size={20} className="tx-60" />
    </div>
    <div className="text-base font-semibold tx tracking-tight mb-2">{title}</div>
    <div className="text-xs tx-50 leading-relaxed mb-5">{body}</div>
    {code && (
      <div className="text-left border bd-2 rounded-lg p-3 font-mono text-xs tx-60 mb-5" style={{ backgroundColor: 'var(--bg-base)' }}>
        {code.map((l, i) => <div key={i}>{l || '\u00A0'}</div>)}
      </div>
    )}
    <div className="flex items-center justify-center gap-2 flex-wrap">{actions}</div>
  </div>
);

/* ============================== Panels ============================== */

function OverviewPanel({ repo, actions, goToChanges, goToPRs }) {
  const [msg, setMsg] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const pool = (repo.staged.length ? repo.staged : repo.unstaged).map((f) => f.p.split('/').pop());
      const summary = pool.length ? `Update ${pool.slice(0, 2).join(', ')}${pool.length > 2 ? ` +${pool.length - 2} more` : ''}` : '';
      setMsg(summary);
      setGenerating(false);
    }, 500);
  };

  if (!repo.hasGit) {
    return (
      <EnvGate icon={AlertTriangle} title="Git isn't installed"
        body="This project can't be tracked until Git is available on this machine. Install it, then this tab picks it up automatically."
        code={['# macOS', 'brew install git', '', '# Windows', 'winget install --id Git.Git']}
        actions={<><Btn primary onClick={actions.checkGitAgain}>Check again</Btn><Btn ghost as="a" href="https://git-scm.com/downloads">Install guide</Btn></>} />
    );
  }
  if (!repo.hasRepo) {
    return (
      <EnvGate icon={FolderGit2} title="No repository here yet"
        body={`${repo.repoName} isn't tracked by Git. Start one to begin recording changes, or clone an existing project into this folder.`}
        actions={<Btn primary onClick={actions.openInitRepo}>Set up this project</Btn>} />
    );
  }
  if (!repo.ghAuthed) {
    return (
      <EnvGate icon={KeyRound} title="Sign in to GitHub to continue"
        body="Pushing, pulling from a remote, and pull requests all need a signed-in GitHub account. Sign in to unlock the rest of this project."
        actions={<Btn primary onClick={actions.openSignIn}>Sign in to GitHub</Btn>} />
    );
  }

  const totalHunks = repo.conflictFiles.reduce((n, f) => n + f.hunks.length, 0);
  const totalResolved = repo.conflictFiles.reduce((n, f, fi) => n + f.hunks.filter((_, hi) => !!repo.conflictResolutions[`${fi}:${hi}`]).length, 0);
  const changed = repo.staged.length + repo.unstaged.length;

  return (
    <div>
      {!repo.hasRemote && <Banner tone="warn" title="No remote configured" body="This repo isn't connected to GitHub, so push and pull requests are turned off." actions={<Btn sm primary onClick={actions.openAddRemote}>Add remote</Btn>} />}
      {repo.ghAuthed && !repo.hasAccess && <Banner tone="bad" title={`${repo.activeAccountLogin || 'This account'} can't reach this repository`} body="The last push failed — GitHub reported this account doesn't have access. Switch accounts if you meant to use a different one." actions={<><Btn sm onClick={actions.goToAccounts}>Switch account</Btn><Btn sm ghost onClick={actions.viewRawError}>View raw error</Btn></>} />}
      {repo.conflict && <Banner tone="bad" title={`Merge in progress — ${repo.conflictFiles.length} files need attention (${totalResolved}/${totalHunks} resolved)`} body="Resolve the conflicts, then continue the merge, or abort to return to where you started." actions={<><Btn sm primary onClick={goToChanges}>Open conflicts</Btn><Btn sm ghost onClick={actions.abortMerge}>Abort merge</Btn></>} />}
      {repo.ahead > 0 && repo.behind > 0 && <Banner tone="info" title={`${repo.branch} has diverged from origin/${repo.branch}`} body={`You're ${repo.ahead} commit${repo.ahead === 1 ? '' : 's'} ahead and ${repo.behind} behind. Pull before pushing.`} actions={<Btn sm primary icon={Download} onClick={actions.pull}>Pull</Btn>} />}
      {repo.detached && <Banner tone="warn" title="You're not on a branch" body="Commits made here won't belong to any branch. Create one from this point to keep your work safe." actions={<Btn sm primary onClick={actions.openCreateBranch}>Create branch here</Btn>} />}
      {repo.credentialMismatch && <Banner tone="warn" title="Push will use a different identity than shown" body={`This project pushes as ${repo.activeAccountLogin || 'the account above'}, but your SSH key authenticates as ${repo.sshIdentity}. Pushes go through — just not as the account shown.`} actions={<Btn sm onClick={actions.checkCredentialMatch}>Review credentials</Btn>} />}
      {changed > 200 && <Banner tone="info" title={`${changed} files changed`} body="Staging runs in batches so the app stays responsive — this may take a few seconds." />}

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="p-4"><div className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--sem-amber)' }}>{changed}</div><div className="fs-10 uppercase tracking-widest tx-30 mt-1">Changed files</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--sem-emerald)' }}>{repo.ahead}</div><div className="fs-10 uppercase tracking-widest tx-30 mt-1">Ahead of remote</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tracking-tight" style={{ color: repo.behind > 0 ? 'var(--sem-red)' : 'var(--fg-30)' }}>{repo.behind}</div><div className="fs-10 uppercase tracking-widest tx-30 mt-1">Behind remote</div></Card>
      </div>

      <SectionLabel action={
        <Btn sm ghost disabled={!repo.unstaged.length} onClick={actions.stageAll}>Stage all ({repo.unstaged.length})</Btn>
      }>Quick actions</SectionLabel>
      <Card className="p-4 mb-1">
        <div className="flex items-center justify-between mb-2">
          <span className="fs-10 uppercase tracking-widest tx-30">Commit</span>
          <span className="fs-11 font-mono tx-30">{repo.staged.length} staged</span>
        </div>
        <AutoTextarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Summarize your change…" minRows={2}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors" />
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Btn primary icon={GitCommit} disabled={!repo.staged.length} title={!repo.staged.length ? 'Stage some changes first' : undefined}
              onClick={() => { actions.commit(msg); setMsg(''); }}>Commit staged</Btn>
            <Btn ghost icon={Sparkles} disabled={!repo.staged.length && !repo.unstaged.length || generating}
              title="Fills the box from your changed file names — a local heuristic, not a real AI call" onClick={handleGenerate}>
              {generating ? 'Generating…' : 'Generate message'}
            </Btn>
          </div>
          <Btn icon={Upload} disabled={!repo.staged.length || !repo.hasRemote || !repo.hasAccess} title={!repo.hasAccess ? "This account doesn't have push access" : !repo.hasRemote ? 'No remote configured yet' : !repo.staged.length ? 'Stage some changes first' : undefined}
            onClick={() => { actions.commitAndPush(msg); setMsg(''); }}>Commit &amp; push</Btn>
        </div>

        <div className="h-px bg-o2 my-3 -mx-4"></div>

        <div className="flex items-center justify-between mb-2">
          <span className="fs-10 uppercase tracking-widest tx-30">Sync</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Btn icon={Upload} disabled={!repo.hasRemote || !repo.ghAuthed || !repo.hasAccess} title={!repo.hasAccess ? "This account doesn't have push access" : !repo.hasRemote ? 'No remote configured yet' : !repo.ghAuthed ? 'Sign in to GitHub to enable push' : undefined} onClick={actions.push}>Push</Btn>
            <Btn ghost disabled={!repo.hasRemote || !repo.ghAuthed || !repo.hasAccess} title={!repo.hasAccess ? "This account doesn't have push access" : 'Overwrites the remote branch — use after an amend or rebase'} onClick={actions.openForcePush}>Force push</Btn>
            <Btn ghost icon={Download} onClick={actions.fetch}>Fetch</Btn>
          </div>
          <Btn ghost icon={GitPullRequest} disabled={!repo.hasRemote || !repo.ghAuthed || !repo.hasAccess} title={!repo.hasAccess ? "This account doesn't have access to open pull requests here" : undefined} onClick={actions.openCreatePR}>Create pull request</Btn>
        </div>
      </Card>

      <SectionLabel>Environment</SectionLabel>
      <Card className="p-2">
        {[
          ['Git', 'v2.44.0', 'ok'],
          ['GitHub CLI', repo.ghAuthed ? 'v2.55.0' : 'not signed in', repo.ghAuthed ? 'ok' : 'warn'],
          ['Remote', repo.hasRemote ? (repo.remoteUrl || 'origin') : 'none', repo.hasRemote ? 'ok' : 'warn'],
          ['Push credential', repo.credentialMismatch ? `${repo.sshIdentity} (SSH)` : (repo.activeAccountLogin || 'not signed in'), repo.credentialMismatch ? 'warn' : 'ok'],
        ].map(([label, val, tone]) => (
          <div key={label} className="flex items-center gap-2.5 px-2 py-2 border-b bd-1 last:border-0">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TONE[tone].dot }}></span>
            <span className="text-xs tx-50 flex-1">{label}</span>
            <span className="fs-11 font-mono tx-70">{val}</span>
          </div>
        ))}
      </Card>

      <SectionLabel>Recent activity</SectionLabel>
      <Card className="p-2">
        {repo.commits.slice(0, 3).map((c) => (
          <div key={c.sha} className="flex items-center gap-3 px-2 py-2 border-b bd-1 last:border-0">
            <span className="fs-10 font-mono tx-30 border bd-2 rounded px-1.5 py-0.5">{c.sha}</span>
            <span className="fs-12 tx-70 flex-1 truncate leading-snug">{c.subj}</span>
            <span className="fs-10 font-mono tx-25 shrink-0">{c.when}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ChangesPanel({ repo, actions, onOpenDiff, goToChanges }) {
  const [msg, setMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [amend, setAmend] = useState(false);

  if (!repo.hasGit || !repo.hasRepo || !repo.ghAuthed) return <OverviewPanel repo={repo} actions={actions} goToChanges={goToChanges} goToPRs={goToChanges} />;

  if (repo.conflict) {
    const totalHunks = repo.conflictFiles.reduce((n, f) => n + f.hunks.length, 0);
    const totalResolved = repo.conflictFiles.reduce((n, f, fi) => n + f.hunks.filter((_, hi) => !!repo.conflictResolutions[`${fi}:${hi}`]).length, 0);
    const allDone = totalResolved === totalHunks;
    return (
      <div>
        <Banner tone="bad" title={`${totalHunks} conflicting hunks across ${repo.conflictFiles.length} files`} body="Resolve each one below, then continue the merge. Nothing is written until you choose a resolution." />
        <ConflictResolver files={repo.conflictFiles} resolutions={repo.conflictResolutions} setResolutions={actions.setConflictResolutions} />
        <div className="flex items-center gap-2 mt-4">
          <Btn primary icon={GitMerge} disabled={!allDone} title={!allDone ? `Resolve ${totalHunks - totalResolved} more hunk${totalHunks - totalResolved === 1 ? '' : 's'} first` : undefined} onClick={actions.continueMerge}>Continue merge</Btn>
          <Btn ghost onClick={actions.abortMerge}>Abort merge</Btn>
        </div>
      </div>
    );
  }

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const names = repo.staged.map((f) => f.p.split('/').pop());
      const summary = names.length ? `Update ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''}` : '';
      setMsg(summary);
      setGenerating(false);
    }, 500);
  };

  const totalChanged = repo.staged.length + repo.unstaged.length;

  return (
    <div>
      {totalChanged > 200 && <Banner tone="info" title="Large changeset" body={`Showing ${totalChanged} files. Staging everything runs as one batched operation, not that many separate commands.`} />}

      <SectionLabel action={
        <div className="flex items-center gap-2">
          <Btn sm ghost disabled={!totalChanged} onClick={actions.openStash}>Stash changes</Btn>
          <Btn sm ghost disabled={!totalChanged} onClick={actions.openDiscardAll}>Discard all</Btn>
        </div>
      }>Working tree</SectionLabel>

      <SectionLabel action={<Btn sm ghost disabled={!repo.unstaged.length} onClick={actions.unstageAll}>Unstage all</Btn>}>Staged ({repo.staged.length})</SectionLabel>
      <Card className="p-1.5">
        {repo.staged.length === 0
          ? <div className="text-center fs-11 tx-25 py-3">Nothing staged yet</div>
          : repo.staged.map((f) => <FileRow key={f.p} f={f} staged onOpenDiff={onOpenDiff} onToggleStage={() => actions.unstageFile(f.p)} onDiscard={() => actions.discardFile(f.p)} />)}
      </Card>

      <SectionLabel action={<Btn sm ghost disabled={!repo.unstaged.length} onClick={actions.stageAll}>Stage all</Btn>}>Unstaged ({repo.unstaged.length})</SectionLabel>
      <Card className="p-1.5 max-h-72 overflow-y-auto custom-scrollbar">
        {repo.unstaged.length === 0
          ? <div className="text-center fs-11 tx-25 py-3">Working tree clean</div>
          : <>
              {repo.unstaged.slice(0, 30).map((f) => <FileRow key={f.p} f={f} onOpenDiff={onOpenDiff} onToggleStage={() => actions.stageFile(f.p)} onDiscard={() => actions.discardFile(f.p)} />)}
              {repo.unstaged.length > 30 && <div className="text-center fs-11 tx-25 py-2">+ {repo.unstaged.length - 30} more files</div>}
            </>}
      </Card>

      <SectionLabel>Commit</SectionLabel>
      <Card className="p-3">
        <AutoTextarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={amend ? 'Leave blank to keep the previous message…' : 'Summarize your change…'} minRows={2}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors" />
        <label className="flex items-center gap-2 mt-2 mb-1 cursor-pointer select-none">
          <input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)} className="w-3.5 h-3.5" />
          <span className="fs-11 tx-50">Amend the previous commit instead of creating a new one</span>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Btn primary icon={GitCommit} disabled={!repo.staged.length} title={!repo.staged.length ? 'Nothing staged yet' : undefined}
              onClick={() => { actions.commit(msg, amend); setMsg(''); }}>{amend ? 'Amend commit' : 'Commit staged'}</Btn>
            <Btn ghost icon={Sparkles} disabled={!repo.staged.length || generating} title="Generates a message from the staged diff — you'll see it before it's used" onClick={handleGenerate}>
              {generating ? 'Generating…' : 'Generate message'}
            </Btn>
          </div>
          <Btn icon={Upload} disabled={!repo.staged.length || !repo.hasRemote || !repo.hasAccess} title={!repo.hasAccess ? "This account doesn't have push access" : !repo.hasRemote ? 'No remote configured yet' : !repo.staged.length ? 'Nothing staged yet' : undefined}
            onClick={() => { actions.commitAndPush(msg, amend); setMsg(''); }}>Commit &amp; push</Btn>
        </div>
      </Card>
    </div>
  );
}

function DiffPage({ repo, actions, diffMode, setDiffMode, selectedFile, setSelectedFile, selectedCommit, setSelectedCommit }) {
  if (!repo.hasGit || !repo.hasRepo) {
    return <EnvGate icon={FileDiff} title="No diffs to show" body="Diffs appear here once this folder is tracked by Git." />;
  }
  if (!repo.ghAuthed) {
    return <EnvGate icon={KeyRound} title="Sign in to GitHub to continue" body="Sign in to unlock the rest of this project." actions={<Btn primary onClick={actions.openSignIn}>Sign in to GitHub</Btn>} />;
  }
  const workingFiles = [...repo.staged, ...repo.unstaged];
  const list = diffMode === 'working' ? workingFiles : repo.commits;
  const active = diffMode === 'working' ? selectedFile : selectedCommit;

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 bg-o1 border bd-2 rounded-lg p-1 w-fit">
        <button onClick={() => setDiffMode('working')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${diffMode === 'working' ? 'bg-o2 tx' : 'tx-40 hov-tx-70'}`}>Working tree</button>
        <button onClick={() => setDiffMode('history')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${diffMode === 'history' ? 'bg-o2 tx' : 'tx-40 hov-tx-70'}`}>Commit history</button>
      </div>

      {list.length === 0 ? (
        <div className="text-center text-xs tx-30 py-10">{diffMode === 'working' ? 'Working tree is clean — nothing to diff.' : 'No commits yet.'}</div>
      ) : (
        <div className="flex gap-4">
          <div className="w-64 shrink-0 overflow-y-auto custom-scrollbar" style={{ maxHeight: '560px' }}>
            {diffMode === 'working'
              ? workingFiles.map((f) => (
                  <button key={f.p} onClick={() => setSelectedFile(f)} className={`relative w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-colors ${active === f ? 'bg-o1' : 'hov-bg-o1'}`}>
                    {active === f && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: 'var(--fg)' }}></span>}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: f.t === 'add' ? 'var(--sem-emerald)' : f.t === 'del' ? 'var(--sem-red)' : 'var(--sem-amber)' }}></span>
                      <FilePathLabel path={f.p} />
                    </div>
                  </button>
                ))
              : repo.commits.map((c) => (
                  <button key={c.sha} onClick={() => setSelectedCommit(c)} className={`relative w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-colors ${active === c ? 'bg-o1' : 'hov-bg-o1'}`}>
                    {active === c && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: 'var(--fg)' }}></span>}
                    <div className="fs-12 tx-70 truncate leading-snug">{c.subj}</div>
                    <div className="fs-10 font-mono tx-30 mt-0.5">{c.sha}</div>
                  </button>
                ))}
          </div>
          <div className="flex-1 min-w-0">
            {diffMode === 'working'
              ? (selectedFile ? <DiffCard path={selectedFile.p} ins={selectedFile.ins} del={selectedFile.del} lines={diffLinesFor(selectedFile.p)} /> : <div className="text-center text-xs tx-25 py-10">Pick a file on the left.</div>)
              : (selectedCommit ? <DiffCard path={selectedCommit.sha} {...statsFor(selectedCommit.sha)} lines={diffLinesFor(selectedCommit.sha)} /> : <div className="text-center text-xs tx-25 py-10">Pick a commit on the left.</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function BranchesPanel({ repo, actions, goToChanges }) {
  const [form, setForm] = useState(null);
  if (!repo.hasGit || !repo.hasRepo || !repo.ghAuthed) return <OverviewPanel repo={repo} actions={actions} goToChanges={goToChanges} goToPRs={goToChanges} />;

  return (
    <div>
      {repo.ahead > 0 && repo.behind > 0 && <Banner tone="info" title={`${repo.branch} has diverged`} body={`${repo.ahead} ahead, ${repo.behind} behind origin/${repo.branch}.`} />}
      {repo.detached && <Banner tone="warn" title="Detached HEAD" body="You're viewing a specific commit, not a branch." />}

      <Card className="p-2">
        <div className="flex items-center gap-2.5 px-2 py-2 border-b bd-1">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs" style={{ borderColor: 'var(--sem-amber-border)', color: 'var(--sem-amber)' }}>
            <GitBranch size={11} />
            {repo.detached ? `${repo.branch} (detached)` : repo.branch}
          </span>
          <span className="fs-11 font-mono tx-30 flex-1">{repo.ahead || repo.behind ? `↑${repo.ahead} ↓${repo.behind}` : 'up to date'}</span>
          {!repo.detached && <Btn sm ghost onClick={() => setForm('rename')}>Rename</Btn>}
        </div>
        {repo.branches.filter((b) => b.name !== repo.branch).map((b) => (
          <div key={b.name} className="flex items-center gap-2.5 px-2 py-2 border-b bd-1 last:border-0">
            <span className="text-xs font-mono tx-70 flex-1">{b.name}</span>
            <span className="fs-10 tx-25">{b.merged ? 'local · merged' : 'local · unmerged'}</span>
            <Btn sm ghost onClick={() => actions.mergeBranch(b.name)}>Merge into current</Btn>
            <Btn sm ghost onClick={() => actions.checkoutBranch(b.name)}>Switch</Btn>
            <Btn sm ghost onClick={() => actions.deleteBranch(b.name, !b.merged)} className={b.merged ? '' : 'text-amber-400'}>
              {b.merged ? 'Delete' : 'Force delete'}
            </Btn>
          </div>
        ))}
      </Card>

      {form === 'new' && (
        <div className="mt-3">
          <InlineForm placeholder="new-branch-name" submitLabel="Create"
            onSubmit={(name) => { actions.createBranch(name); setForm(null); }} onCancel={() => setForm(null)} />
        </div>
      )}
      {form === 'rename' && (
        <div className="mt-3">
          <InlineForm placeholder="new name" initial={repo.branch} submitLabel="Rename"
            onSubmit={(name) => { actions.renameBranch(name); setForm(null); }} onCancel={() => setForm(null)} />
        </div>
      )}

      {form === null && (
        <div className="flex items-center gap-2 mt-4">
          <Btn primary onClick={() => setForm('new')}>New branch</Btn>
          <Btn ghost onClick={actions.openNewWorktree}>New worktree</Btn>
        </div>
      )}

      {repo.worktrees.length > 0 && (
        <>
          <SectionLabel>Worktrees</SectionLabel>
          <Card className="p-2">
            {repo.worktrees.map((w) => (
              <div key={w.path} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="fs-12 font-mono tx-80">{w.path}</div>
                  <div className="fs-10 font-mono tx-30">{w.branch} from {w.base}</div>
                </div>
                <Btn sm ghost onClick={() => actions.removeWorktree(w.path)}>Remove</Btn>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function CommitRow({ c, onSelectCommit, actions }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const copySha = () => {
    navigator.clipboard?.writeText(c.sha).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    setMenuOpen(false);
  };
  return (
    <div className="group relative">
      <button onClick={() => onSelectCommit(c)} className="relative w-full text-left flex flex-col gap-1.5 pl-4 pr-9 py-3 border-b bd-1 last:border-0 hov-bg-o1 rounded-md transition-colors">
        <span className="absolute top-4 w-2 h-2 rounded-full border-2" style={{ left: '-13px', borderColor: c.head ? 'var(--fg)' : 'var(--fg-30)', backgroundColor: c.head ? 'var(--fg)' : 'var(--bg-base)' }}></span>
        <div className="fs-12 tx-85 leading-snug">{c.subj}</div>
        <div className="flex items-center gap-2 flex-wrap fs-11 font-mono tx-30">
          <span className="border bd-2 rounded px-1.5 py-0.5 tx-50">{c.sha}</span>
          <span>{c.who}</span><span>&middot;</span><span>{c.when}</span>
          {(c.refs || []).map((r) => <span key={r} className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--overlay-10)', color: 'var(--fg-80)' }}>{r}</span>)}
        </div>
      </button>
      <div className="absolute right-1 top-3" ref={menuRef}>
        <button onClick={() => setMenuOpen((o) => !o)}
          className={`w-6 h-6 rounded-md flex items-center justify-center tx-30 hov-tx transition-opacity ${menuOpen ? 'opacity-100 bg-o1' : 'opacity-0 group-hover:opacity-100 hov-bg-o1'}`}>
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border bd-2 shadow-2xl overflow-hidden z-40 py-1" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <button onClick={() => { actions.cherryPick(c); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 tx-60 hov-tx hov-bg-o1 transition-colors"><Copy size={11} />Cherry-pick</button>
            <button onClick={() => { actions.revertCommit(c); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 tx-60 hov-tx hov-bg-o1 transition-colors"><Undo2 size={11} />Revert</button>
            <button onClick={() => { actions.openReset(c); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 hov-bg-o1 transition-colors" style={{ color: 'var(--sem-red)' }}><RotateCcw size={11} />Reset to here</button>
            <div className="h-px bg-o1 my-1"></div>
            <button onClick={copySha} className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 tx-60 hov-tx hov-bg-o1 transition-colors">{copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'Copied' : 'Copy SHA'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryPanel({ repo, onSelectCommit, goToChanges, actions }) {
  const [query, setQuery] = useState('');
  if (!repo.hasGit || !repo.hasRepo || !repo.ghAuthed) return <OverviewPanel repo={repo} actions={actions} goToChanges={goToChanges} goToPRs={goToChanges} />;
  const q = query.trim().toLowerCase();
  const filtered = q ? repo.commits.filter((c) => c.subj.toLowerCase().includes(q) || c.who.toLowerCase().includes(q) || c.sha.includes(q)) : repo.commits;
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
          <div className="absolute top-2 bottom-2 w-px bg-o2" style={{ left: '7px' }}></div>
          {filtered.map((c) => <CommitRow key={c.sha} c={c} onSelectCommit={onSelectCommit} actions={actions} />)}
        </div>
      )}
    </div>
  );
}

function PRsPanel({ repo, actions, goToChanges }) {
  const [expanded, setExpanded] = useState(null);
  const [mergeMethod, setMergeMethod] = useState({});
  if (!repo.hasGit || !repo.hasRepo) return <OverviewPanel repo={repo} actions={actions} goToChanges={goToChanges} goToPRs={goToChanges} />;
  if (!repo.hasRemote || !repo.ghAuthed) {
    return <EnvGate icon={GitPullRequest} title="Pull requests aren't available yet"
      body={!repo.hasRemote ? 'This repo has no remote — connect one to open pull requests.' : 'Sign in to GitHub to see and create pull requests.'}
      actions={<Btn primary onClick={!repo.hasRemote ? actions.openAddRemote : actions.openSignIn}>{!repo.hasRemote ? 'Add remote' : 'Sign in to GitHub'}</Btn>} />;
  }
  const STATE_STYLE = {
    open: { color: 'var(--sem-emerald)', bg: 'var(--sem-emerald-soft)' },
    draft: { color: 'var(--fg-50)', bg: 'var(--overlay-10)' },
    merged: { color: 'var(--sem-purple)', bg: 'var(--sem-purple-soft)' },
    closed: { color: 'var(--sem-red)', bg: 'var(--sem-red-soft)' },
  };
  return (
    <div>
      <Card className="p-2">
        {repo.prs.map((pr) => (
          <div key={pr.n} className="border-b bd-1 last:border-0">
            <div className="flex items-center gap-2.5 flex-wrap px-2 py-2.5">
              <span className="fs-10 uppercase font-semibold tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ color: STATE_STYLE[pr.state].color, backgroundColor: STATE_STYLE[pr.state].bg }}>{pr.state}</span>
              <div className="min-w-0 flex-1"><div className="text-xs tx-80 truncate">#{pr.n} {pr.title}</div><div className="fs-10 font-mono tx-30">{pr.branch}</div></div>
              {pr.state === 'draft' && <Btn sm ghost onClick={() => actions.readyForReview(pr.n)}>Ready for review</Btn>}
              {pr.state === 'open' && (
                <>
                  <Select value={mergeMethod[pr.n] || 'merge'} onChange={(e) => setMergeMethod((m) => ({ ...m, [pr.n]: e.target.value }))} className="!w-auto !py-1 !text-xs">
                    <option value="merge">Merge commit</option>
                    <option value="squash">Squash merge</option>
                    <option value="rebase">Rebase merge</option>
                  </Select>
                  <Btn sm primary onClick={() => actions.mergePR(pr.n, mergeMethod[pr.n] || 'merge')}>Merge</Btn>
                </>
              )}
              {(pr.state === 'open' || pr.state === 'draft') && <Btn sm ghost onClick={() => actions.closePR(pr.n)}>Close</Btn>}
              {pr.state === 'closed' && <Btn sm ghost onClick={() => actions.reopenPR(pr.n)}>Reopen</Btn>}
              <Btn sm ghost onClick={() => setExpanded((e) => (e === pr.n ? null : pr.n))}>{expanded === pr.n ? 'Hide' : 'View'}</Btn>
            </div>
            {expanded === pr.n && <div className="px-2 pb-3 text-xs tx-50 leading-relaxed">{pr.body}</div>}
          </div>
        ))}
      </Card>
      <div className="mt-4"><Btn primary icon={GitPullRequest} onClick={actions.openCreatePR}>Create pull request</Btn></div>
    </div>
  );
}

function TagsPanel({ repo, actions, goToChanges }) {
  const [form, setForm] = useState(false);
  if (!repo.hasGit || !repo.hasRepo || !repo.ghAuthed) return <OverviewPanel repo={repo} actions={actions} goToChanges={goToChanges} goToPRs={goToChanges} />;
  return (
    <div>
      <Card className="p-2">
        {repo.tags.length === 0
          ? <div className="text-center fs-11 tx-25 py-3">No tags yet</div>
          : repo.tags.map((t) => (
            <div key={t.name} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border bd-2 bg-o1 text-xs tx-80"><Tag size={11} />{t.name}</span>
              <span className="fs-11 font-mono tx-30 flex-1">{t.sha}</span>
              <span className="fs-11 tx-25">{t.when}</span>
            </div>
          ))}
      </Card>
      {form && (
        <div className="mt-3">
          <InlineForm placeholder="v1.5.0" submitLabel="Create" onSubmit={(name) => { actions.createTag(name); setForm(false); }} onCancel={() => setForm(false)} />
        </div>
      )}
      {!form && (
        <div className="flex items-center gap-2 mt-4">
          <Btn primary onClick={() => setForm(true)}>Create tag</Btn>
          <Btn ghost onClick={actions.openDraftRelease}>Draft a release</Btn>
        </div>
      )}

      {repo.releases.length > 0 && (
        <>
          <SectionLabel>Releases</SectionLabel>
          <Card className="p-2">
            {repo.releases.map((rel, i) => (
              <div key={i} className="px-2 py-2.5 border-b bd-1 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="fs-12 font-semibold tx">{rel.title}</span>
                  <span className="fs-10 font-mono tx-30">{rel.tag}</span>
                  {rel.prerelease && <span className="fs-9 uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ color: 'var(--sem-amber)', backgroundColor: 'var(--sem-amber-soft)' }}>Pre-release</span>}
                  <span className="fs-10 tx-25 ml-auto">{rel.when}</span>
                </div>
                {rel.notes && <div className="fs-11 tx-50 whitespace-pre-line leading-relaxed">{rel.notes}</div>}
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function StashesPanel({ repo, actions, goToChanges }) {
  if (!repo.hasGit || !repo.hasRepo || !repo.ghAuthed) return <OverviewPanel repo={repo} actions={actions} goToChanges={goToChanges} goToPRs={goToChanges} />;
  const hasChanges = repo.staged.length + repo.unstaged.length > 0;
  const nothingToDo = !hasChanges && repo.behind === 0;
  return (
    <div>
      <SectionLabel>Update safely</SectionLabel>
      <Card className="p-3 mb-4">
        <p className="fs-11 tx-40 leading-relaxed mb-3">
          Set your current changes aside, pull the latest commits — from your own branch or a teammate's — then bring your changes back. Each step is reported as it happens, naming the branch and remote involved. If your changes conflict with what came in, you'll resolve it right here: accept all current, all incoming, or go hunk by hunk.
        </p>
        <Btn primary icon={RefreshCw} disabled={repo.conflict || nothingToDo} onClick={actions.openStashPullReapply}>
          Stash, pull &amp; reapply
        </Btn>
        {nothingToDo && <div className="fs-10 tx-25 mt-2">Nothing to stash, and already up to date.</div>}
        {repo.conflict && <div className="fs-10 mt-2" style={{ color: 'var(--sem-amber)' }}>Resolve the merge in progress before running this again.</div>}
      </Card>

      <SectionLabel action={<Btn sm ghost disabled={!hasChanges} onClick={actions.openStash}>Stash current changes</Btn>}>Stashes</SectionLabel>
      {repo.stashes.length === 0 ? (
        <div className="text-center fs-11 tx-25 py-6 border bd-1 rounded-lg">
          {hasChanges ? 'No manual stashes yet. Set aside what you have right now with "Stash current changes" above.' : 'No manual stashes, and nothing to stash right now.'}
        </div>
      ) : (
        <Card className="p-2">
          {repo.stashes.map((s) => (
            <div key={s.ref} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <div className="min-w-0 flex-1"><div className="text-xs tx-80">{s.msg}</div><div className="fs-10 font-mono tx-30">{s.ref} &middot; {s.when}</div></div>
              <Btn sm ghost onClick={() => actions.applyStash(s.ref)}>Apply</Btn>
              <Btn sm ghost onClick={() => actions.dropStash(s.ref)}>Drop</Btn>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function AccountsPanel({ repo, actions }) {
  return (
    <div>
      {repo.credentialMismatch && (
        <Banner tone="warn" title="This project's push credential doesn't match"
          body="The account below handles GitHub actions like pull requests. But git push authenticates through your system's SSH key, which currently resolves to a different account."
          actions={<Btn sm onClick={actions.checkCredentialMatch}>Check credential match</Btn>} />
      )}
      <Card className="p-2 mb-4">
        {repo.accounts.map((a) => (
          <AccountRow key={a.login} account={a} isActive={a.login === repo.activeAccountLogin} actions={actions} />
        ))}
        {repo.accounts.length === 0 && <div className="text-center fs-11 tx-25 py-4">No accounts connected</div>}
      </Card>
      <Btn primary onClick={actions.openConnectAccount}>Connect an account</Btn>

      <SectionLabel>This project</SectionLabel>
      <p className="text-xs tx-40 leading-relaxed mb-2">{repo.repoName} pushes and opens pull requests as this account. Changing it here only affects this project — other open projects keep their own.</p>
      <div className="flex items-center gap-2.5 bg-o1 border bd-2 rounded-lg px-3 py-2.5">
        <KeyRound size={13} className="tx-30 shrink-0" />
        <span className="text-xs tx-50">Push and open PRs as</span>
        <select value={repo.activeAccountLogin || ''} onChange={(e) => actions.switchAccount(e.target.value)} className="border bd-2 rounded-md text-xs font-mono tx-80 px-2 py-1 outline-none" style={{ backgroundColor: 'var(--bg-base)' }}>
          {repo.accounts.map((a) => <option key={a.login} value={a.login}>{a.nickname ? `${a.nickname} (${a.login})` : a.login}</option>)}
        </select>
      </div>
    </div>
  );
}

function AccountRow({ account: a, isActive, actions }) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(a.nickname || '');

  const saveNickname = () => { actions.renameAccount(a.login, nickname); setEditing(false); };

  return (
    <div className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
      <span className="w-8 h-8 rounded-lg bg-o1 border bd-2 flex items-center justify-center text-xs font-mono font-semibold tx-80 shrink-0">{a.login[0].toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <TextInput value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname (optional)"
              autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveNickname(); if (e.key === 'Escape') setEditing(false); }}
              className="!py-1 !text-xs max-w-40" />
            <button onClick={saveNickname} className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors" title="Save"><Check size={12} /></button>
            <button onClick={() => setEditing(false)} className="w-6 h-6 rounded-md hov-bg-o1 flex items-center justify-center tx-40 hov-tx transition-colors" title="Cancel"><X size={12} /></button>
          </div>
        ) : (
          <div className="text-xs font-mono tx-85 flex items-center gap-2">
            {a.nickname ? `${a.nickname} · ` : ''}{a.login}
            {isActive && <span className="fs-10 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--overlay-10)', color: 'var(--fg-80)' }}>used here</span>}
            <button onClick={() => setEditing(true)} className="tx-25 hov-tx transition-colors" title="Rename"><Pencil size={11} /></button>
          </div>
        )}
        <div className="fs-10 tx-30 flex items-center gap-1.5 mt-0.5">
          {a.host}
          {a.scopes.map((s) => <span key={s} className="font-mono px-1 py-px rounded bg-o1 border bd-1">{s}</span>)}
        </div>
      </div>
      {!isActive && <Btn sm ghost onClick={() => actions.switchAccount(a.login)}>Switch to this account</Btn>}
      <Btn sm ghost onClick={() => actions.removeAccount(a.login)}>Remove</Btn>
    </div>
  );
}

function SettingsPanel({ repo, actions }) {
  const [name, setName] = useState(repo.gitIdentity.name);
  const [email, setEmail] = useState(repo.gitIdentity.email);
  const [gitignore, setGitignore] = useState(repo.gitignoreText);
  const identityChanged = name !== repo.gitIdentity.name || email !== repo.gitIdentity.email;
  const gitignoreChanged = gitignore !== repo.gitignoreText;

  return (
    <div>
      <SectionLabel>Git identity</SectionLabel>
      <Card className="p-3 mb-1">
        <p className="fs-11 tx-40 leading-relaxed mb-3">Used as the author on every commit you make in this project.</p>
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Btn primary disabled={!identityChanged || !name.trim() || !email.trim()} onClick={() => actions.updateIdentity({ name: name.trim(), email: email.trim() })}>Save identity</Btn>
      </Card>

      <SectionLabel action={<Btn sm ghost onClick={actions.openAddRemote}>Add remote</Btn>}>Remotes</SectionLabel>
      <Card className="p-3 mb-1">
        <p className="fs-11 tx-40 leading-relaxed mb-3">The URLs this project pushes to and pulls from. Most projects only need "origin" — add more if you push the same repo to multiple hosts.</p>
        {repo.remotes.length === 0
          ? <div className="text-center fs-11 tx-25 py-3">No remotes configured</div>
          : repo.remotes.map((rem) => (
            <div key={rem.name} className="flex items-center gap-3 px-2 py-2.5 border-b bd-1 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="fs-12 font-mono tx-80">{rem.name}</div>
                <div className="fs-10 font-mono tx-30 truncate">{rem.url}</div>
              </div>
              <Btn sm ghost onClick={() => actions.removeRemote(rem.name)}>Remove</Btn>
            </div>
          ))}
      </Card>

      <SectionLabel>.gitignore</SectionLabel>
      <Card className="p-3">
        <p className="fs-11 tx-40 leading-relaxed mb-3">Files and folders Git should never track for this project (build output, dependencies, local env files). One pattern per line — changes here apply project-wide.</p>
        <AutoTextarea value={gitignore} onChange={(e) => setGitignore(e.target.value)} minRows={4}
          className="w-full border bd-2 rounded-lg tx font-mono fs-11 ph-25 p-3 outline-none foc-bd-3 transition-colors" />
        <div className="mt-2.5"><Btn primary disabled={!gitignoreChanged} onClick={() => actions.updateGitignore(gitignore)}>Save .gitignore</Btn></div>
      </Card>
    </div>
  );
}

/* ============================== Toasts ============================== */

function ToastStack({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="px-3 py-2 rounded-lg text-xs font-medium shadow-2xl border"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: t.tone === 'bad' ? 'var(--sem-red-border)' : t.tone === 'warn' ? 'var(--sem-amber-border)' : 'var(--overlay-10)',
            color: t.tone === 'bad' ? 'var(--sem-red)' : t.tone === 'warn' ? 'var(--sem-amber)' : 'var(--fg-80)',
          }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ============================== App ============================== */

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [panel, setPanel] = useState('overview');
  const [scenario, setScenarioId] = useState('conflict');
  const [repo, setRepo] = useState(() => makeInitialState('conflict'));
  const [collapsed, setCollapsed] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [diffMode, setDiffMode] = useState('working');
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const closeModal = () => setModal(null);

  const pushToast = (text, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  const setScenario = (id) => {
    setScenarioId(id);
    setRepo(makeInitialState(id));
    setPanel('overview');
    setSelectedFile(null);
    setSelectedCommit(null);
  };

  const goToChanges = () => setPanel('changes');
  const goToPRs = () => setPanel('prs');
  const goToAccounts = () => setPanel('accounts');
  const openDiffFor = (file) => { setSelectedFile(file); setDiffMode('working'); setPanel('diff'); };
  const openDiffForCommit = (commit) => { setSelectedCommit(commit); setDiffMode('history'); setPanel('diff'); };

  const activeAccountLogin = repo.ghAuthed ? (repo.accounts.find((a) => a.active)?.login || repo.accounts[0]?.login || null) : null;
  const repoWithAccount = { ...repo, activeAccountLogin };

  const actions = {
    stageAll: () => setRepo((r) => (r.unstaged.length === 0 ? (pushToast('Nothing to stage'), r) : (pushToast(`Staged ${r.unstaged.length} file${r.unstaged.length === 1 ? '' : 's'}`), { ...r, staged: [...r.staged, ...r.unstaged], unstaged: [] }))),
    unstageAll: () => setRepo((r) => (r.staged.length === 0 ? (pushToast('Nothing staged'), r) : (pushToast('Unstaged all files'), { ...r, unstaged: [...r.unstaged, ...r.staged], staged: [] }))),
    stageFile: (path) => setRepo((r) => {
      const f = r.unstaged.find((x) => x.p === path); if (!f) return r;
      return { ...r, unstaged: r.unstaged.filter((x) => x.p !== path), staged: [...r.staged, f] };
    }),
    unstageFile: (path) => setRepo((r) => {
      const f = r.staged.find((x) => x.p === path); if (!f) return r;
      return { ...r, staged: r.staged.filter((x) => x.p !== path), unstaged: [...r.unstaged, f] };
    }),
    commit: (message, amend = false) => setRepo((r) => {
      if (amend) {
        if (r.commits.length === 0) { pushToast('No previous commit to amend', 'warn'); return r; }
        const subj = (message || '').trim() || r.commits[0].subj;
        const alreadyPushed = r.hasRemote && r.ahead === 0;
        pushToast(alreadyPushed
          ? 'Amended the previous commit — it was already pushed, so you\'ll need to force push'
          : 'Amended the previous commit', alreadyPushed ? 'warn' : 'ok');
        return {
          ...r,
          commits: [{ ...r.commits[0], subj }, ...r.commits.slice(1)],
          staged: [],
          ahead: r.hasRemote ? Math.max(r.ahead, 1) : r.ahead,
          historyRewritten: r.historyRewritten || alreadyPushed,
        };
      }
      if (r.staged.length === 0) { pushToast('Nothing staged to commit', 'warn'); return r; }
      const subj = (message || '').trim() || `Update ${r.staged.length} file${r.staged.length === 1 ? '' : 's'}`;
      const newCommit = { sha: Math.random().toString(16).slice(2, 9), subj, who: 'you', when: 'just now', head: true, refs: ['HEAD', r.branch] };
      pushToast(`Committed ${r.staged.length} file${r.staged.length === 1 ? '' : 's'}`);
      return { ...r, commits: [newCommit, ...r.commits.map((c) => ({ ...c, head: false }))], staged: [], ahead: r.hasRemote ? r.ahead + 1 : r.ahead };
    }),
    commitAndPush: (message, amend = false) => { actions.commit(message, amend); actions.push(); },
    forcePush: () => setRepo((r) => {
      if (!r.hasRemote) { pushToast('No remote configured', 'warn'); return r; }
      if (!r.ghAuthed) { pushToast('Sign in to GitHub first', 'warn'); return r; }
      pushToast(`Force-pushed ${r.branch} as ${r.credentialMismatch ? `${r.sshIdentity} (SSH)` : activeAccountLogin}`);
      return { ...r, ahead: 0, behind: 0, historyRewritten: false };
    }),
    push: () => setRepo((r) => {
      if (!r.hasRemote) { pushToast('No remote configured', 'warn'); return r; }
      if (!r.ghAuthed) { pushToast('Sign in to GitHub first', 'warn'); return r; }
      if (!r.hasAccess) { pushToast(`${activeAccountLogin} can't access this repo`, 'bad'); return r; }
      if (r.ahead === 0) { pushToast('Already up to date'); return r; }
      // Real git rejects a push when the remote has commits you don't have
      // (non-fast-forward) — you have to pull/rebase, or force push if you
      // deliberately rewrote history (amend/reset past already-pushed work).
      if (r.historyRewritten) { pushToast('Rejected — history was rewritten since this was last pushed. Use Force push instead.', 'warn'); return r; }
      if (r.behind > 0) { pushToast(`Rejected — origin/${r.branch} has ${r.behind} commit${r.behind === 1 ? '' : 's'} you don't have. Pull first.`, 'bad'); return r; }
      pushToast(`Pushed ${r.ahead} commit${r.ahead === 1 ? '' : 's'} as ${r.credentialMismatch ? `${r.sshIdentity} (SSH)` : activeAccountLogin}`);
      return { ...r, ahead: 0 };
    }),
    fetch: () => setRepo((r) => {
      if (!r.hasRemote) { pushToast('No remote configured', 'warn'); return r; }
      pushToast(r.behind > 0 ? `Already ${r.behind} commit${r.behind === 1 ? '' : 's'} behind` : 'No new commits');
      return r;
    }),
    pull: () => setRepo((r) => {
      if (!r.hasRemote) { pushToast('No remote configured', 'warn'); return r; }
      if (r.conflict) { pushToast('Resolve existing conflicts first', 'warn'); return r; }
      if (r.behind === 0) { pushToast('Already up to date'); return r; }
      const hadChanges = r.staged.length + r.unstaged.length > 0;
      // Real git refuses to pull over uncommitted changes it would have to
      // overwrite — it tells you to commit or stash first, it doesn't merge
      // around them.
      if (hadChanges) {
        pushToast('Please commit your changes or stash them before you pull — try "Stash, pull & reapply" in the Stashes tab instead', 'warn');
        return r;
      }
      // Diverged with a clean working tree: pulling merges the remote's
      // history into your own unpushed commits, which can conflict on
      // overlapping lines just like any other merge.
      if (r.ahead > 0) {
        pushToast(`Pulling ${r.behind} commit${r.behind === 1 ? '' : 's'} from origin/${r.branch} conflicts with your local commits`, 'bad');
        return {
          ...r,
          conflict: true,
          conflictFiles: BASE_CONFLICT_FILES.map((f) => ({ ...f, hunks: f.hunks.map((h) => ({ ...h })) })),
          conflictResolutions: {},
        };
      }
      pushToast(`Pulled ${r.behind} commit${r.behind === 1 ? '' : 's'} from origin/${r.branch}`);
      return { ...r, behind: 0 };
    }),
    createPR: ({ title, base, body, draft }) => setRepo((r) => {
      const dup = r.prs.find((p) => p.state !== 'merged' && p.state !== 'closed' && p.branch === `${r.branch} → ${base}`);
      if (dup) { pushToast(`A pull request for ${r.branch} → ${base} already exists: #${dup.n}`, 'warn'); return r; }
      const n = Math.max(0, ...r.prs.map((p) => p.n)) + 1;
      pushToast(draft ? `Opened draft pull request #${n}` : `Opened pull request #${n}`);
      return { ...r, prs: [{ n, title, state: draft ? 'draft' : 'open', branch: `${r.branch} → ${base}`, body: body || 'No description provided.' }, ...r.prs] };
    }),
    readyForReview: (n) => setRepo((r) => {
      pushToast(`PR #${n} marked ready for review`);
      return { ...r, prs: r.prs.map((p) => (p.n === n ? { ...p, state: 'open' } : p)) };
    }),
    mergePR: (n, method) => setRepo((r) => {
      const pr = r.prs.find((p) => p.n === n);
      if (!pr) return r;
      const [head, base] = pr.branch.split(' → ');
      const label = method === 'squash' ? 'Squash merged' : method === 'rebase' ? 'Rebase merged' : 'Merged';
      const mergesIntoCurrent = r.branch === base;
      pushToast(`${label} #${n}: ${pr.title}${mergesIntoCurrent ? ' — pull to see it locally' : ''}`);
      return {
        ...r,
        prs: r.prs.map((p) => (p.n === n ? { ...p, state: 'merged' } : p)),
        // The merge happens on GitHub's server, not in your local checkout —
        // it doesn't show up locally until you pull, same as any other push
        // someone else made to that branch.
        behind: mergesIntoCurrent ? r.behind + 1 : r.behind,
        branches: r.branches.map((b) => (b.name === head ? { ...b, merged: true } : b)),
      };
    }),
    closePR: (n) => setRepo((r) => { pushToast(`Closed #${n}`); return { ...r, prs: r.prs.map((p) => (p.n === n ? { ...p, state: 'closed' } : p)) }; }),
    reopenPR: (n) => setRepo((r) => { pushToast(`Reopened #${n}`); return { ...r, prs: r.prs.map((p) => (p.n === n ? { ...p, state: 'open' } : p)) }; }),
    signInGitHub: () => setRepo((r) => {
      const login = r.accounts.find((a) => a.active)?.login || r.accounts[0]?.login || 'your account';
      pushToast(`Signed in as ${login}`);
      return { ...r, ghAuthed: true, hasAccess: true };
    }),
    addRemote: ({ name, url }) => setRepo((r) => {
      // Real git refuses `remote add` for a name that already exists — you'd
      // need `remote set-url` to change one, not silently overwrite it here.
      if (r.remotes.some((rem) => rem.name === name)) { pushToast(`remote ${name} already exists`, 'bad'); return r; }
      pushToast(`${name} added`);
      return { ...r, hasRemote: true, remoteUrl: r.remoteUrl || url, remotes: [...r.remotes, { name, url }] };
    }),
    removeRemote: (name) => setRepo((r) => {
      const remotes = r.remotes.filter((rem) => rem.name !== name);
      pushToast(`Removed remote ${name}`);
      return { ...r, remotes, hasRemote: remotes.length > 0, remoteUrl: remotes[0]?.url || null };
    }),
    updateIdentity: (identity) => setRepo((r) => { pushToast('Git identity updated'); return { ...r, gitIdentity: identity }; }),
    updateGitignore: (text) => setRepo((r) => { pushToast('.gitignore saved'); return { ...r, gitignoreText: text }; }),
    initRepo: (name, branch) => setRepo((r) => { pushToast(`Initialized empty repository on ${branch}`); return { ...r, repoName: name, hasRepo: true, hasGit: true, branch, ahead: 0, behind: 0, branches: [{ name: branch, current: true, merged: true }] }; }),
    cloneRepo: (name, url) => setRepo((r) => {
      pushToast(`Cloned ${url}`);
      // A freshly cloned repo has its own history — carrying over whatever
      // commits/branches/tags/PRs happened to be loaded before would show
      // unrelated data attributed to a repo that has nothing to do with it.
      return {
        ...r, repoName: name, hasRepo: true, hasGit: true, hasRemote: true, remoteUrl: url, remotes: [{ name: 'origin', url }],
        branch: 'main', ahead: 0, behind: 0, detached: false, historyRewritten: false,
        staged: [], unstaged: [],
        branches: [{ name: 'main', current: true, merged: true }],
        commits: [{ sha: 'c0ffee1', subj: 'Initial commit', who: 'you', when: 'just now', head: true, refs: ['HEAD', 'main'] }],
        tags: [], releases: [], prs: [], stashes: [], worktrees: [],
      };
    }),
    checkGitAgain: () => pushToast('Still not found on PATH', 'warn'),
    switchAccount: (login) => setRepo((r) => {
      const from = r.accounts.find((a) => a.active)?.login;
      pushToast(from && from !== login ? `Switched from ${from} to ${login}` : `Now using ${login} for this project`);
      return { ...r, hasAccess: true, credentialMismatch: false, accounts: r.accounts.map((a) => ({ ...a, active: a.login === login })) };
    }),
    removeAccount: (login) => setRepo((r) => {
      const wasActive = r.accounts.find((a) => a.login === login)?.active;
      const remaining = r.accounts.filter((a) => a.login !== login);
      if (remaining.length === 0) {
        pushToast(`Disconnected ${login} — no accounts left, sign in again to push or open PRs`, 'warn');
        return { ...r, accounts: [], ghAuthed: false, hasAccess: false };
      }
      if (wasActive) {
        pushToast(`Disconnected ${login} — switched to ${remaining[0].login}`);
        return { ...r, accounts: remaining.map((a, i) => ({ ...a, active: i === 0 })) };
      }
      pushToast(`Disconnected ${login}`);
      return { ...r, accounts: remaining };
    }),
    renameAccount: (login, nickname) => setRepo((r) => ({
      ...r, accounts: r.accounts.map((a) => (a.login === login ? { ...a, nickname: nickname.trim() || undefined } : a)),
    })),
    connectAccount: () => setRepo((r) => {
      // A real `gh auth login` device flow tells you who authenticated after
      // the fact — you never type your own username up front. Simulate that:
      // pick an unused identity from a small pool, don't ask the user for one.
      const pool = ['octocat', 'hubot', 'monalisa', 'defunkt', 'mojombo'];
      const login = pool.find((n) => !r.accounts.some((a) => a.login === n)) || `github-user-${r.accounts.length + 1}`;
      pushToast(`Connected ${login}`);
      const makeActive = r.accounts.length === 0;
      return {
        ...r,
        ghAuthed: true,
        accounts: [...r.accounts.map((a) => (makeActive ? { ...a, active: false } : a)), { login, host: 'github.com', scopes: ['repo'], active: makeActive }],
      };
    }),
    createBranch: (name) => setRepo((r) => {
      if (r.branches.some((b) => b.name === name)) { pushToast(`A branch named '${name}' already exists`, 'bad'); return r; }
      pushToast(`Created and switched to ${name}`);
      return { ...r, branch: name, detached: false, ahead: 0, behind: 0, branches: [{ name, current: true, merged: true }, ...r.branches.map((b) => ({ ...b, current: false }))] };
    }),
    renameBranch: (name) => setRepo((r) => {
      const alreadyPushed = r.hasRemote && r.ahead === 0;
      pushToast(alreadyPushed
        ? `Renamed to ${name} — this branch was already pushed under its old name, push to update the remote and delete the old one there`
        : `Renamed to ${name}`, alreadyPushed ? 'warn' : 'ok');
      return {
        ...r, branch: name,
        branches: r.branches.map((b) => (b.current ? { ...b, name } : b)),
        ahead: alreadyPushed ? Math.max(r.ahead, 1) : r.ahead,
      };
    }),
    checkoutBranch: (name) => setRepo((r) => {
      if (r.staged.length || r.unstaged.length) { pushToast('Commit or stash your changes before switching branches', 'warn'); return r; }
      pushToast(`Switched to ${name}`);
      return { ...r, branch: name, detached: false, ahead: 0, behind: 0, branches: r.branches.map((b) => ({ ...b, current: b.name === name })) };
    }),
    deleteBranch: (name, force = false) => setRepo((r) => {
      if (name === r.branch) { pushToast("Can't delete the branch you're on", 'warn'); return r; }
      const b = r.branches.find((x) => x.name === name);
      // Real `git branch -d` refuses to delete a branch with unmerged
      // commits, to stop you from losing work by accident — `-D` overrides
      // it. Mirror that instead of always deleting on one click.
      if (b && !b.merged && !force) {
        pushToast(`${name} is not fully merged — use force delete if you're sure`, 'warn');
        return r;
      }
      pushToast(force && b && !b.merged ? `Force-deleted ${name} — its commits are now unreachable` : `Deleted ${name}`);
      return { ...r, branches: r.branches.filter((x) => x.name !== name) };
    }),
    mergeBranch: (name) => setRepo((r) => {
      if (r.conflict) { pushToast('Resolve the existing conflict first', 'warn'); return r; }
      // Merging in another branch's history while you already have local
      // commits of your own is exactly when merges can touch the same lines
      // and conflict — a merge isn't guaranteed clean just because you asked.
      if (r.ahead > 0) {
        pushToast(`Merging ${name} into ${r.branch} conflicts with your local commits`, 'bad');
        return {
          ...r,
          conflict: true,
          conflictFiles: BASE_CONFLICT_FILES.map((f) => ({ ...f, hunks: f.hunks.map((h) => ({ ...h })) })),
          conflictResolutions: {},
        };
      }
      pushToast(`Merged ${name} into ${r.branch}`);
      const mergeCommit = { sha: Math.random().toString(16).slice(2, 9), subj: `Merge branch '${name}' into ${r.branch}`, who: 'you', when: 'just now', head: true, refs: ['HEAD', r.branch] };
      return {
        ...r,
        commits: [mergeCommit, ...r.commits.map((c) => ({ ...c, head: false }))],
        ahead: r.hasRemote ? r.ahead + 1 : r.ahead,
        branches: r.branches.map((b) => (b.name === name ? { ...b, merged: true } : b)),
      };
    }),
    createWorktree: ({ base, branch, path }) => setRepo((r) => {
      const targetBranch = (branch || '').trim() || base;
      // Real git worktree forbids checking out a branch that's already
      // checked out somewhere else (the main worktree, or another linked
      // one) — it can only be attached to one working directory at a time.
      const inUseHere = targetBranch === r.branch;
      const inUseElsewhere = r.worktrees.some((w) => w.branch === targetBranch);
      if (inUseHere || inUseElsewhere) {
        pushToast(`'${targetBranch}' is already checked out ${inUseHere ? 'here' : 'in another worktree'} — pick a different branch, or give it a new branch name`, 'bad');
        return r;
      }
      if ((branch || '').trim() && r.branches.some((b) => b.name === branch.trim())) {
        pushToast(`A branch named '${branch.trim()}' already exists`, 'bad');
        return r;
      }
      pushToast(`Worktree created at ${path}`);
      const branches = r.branches.some((b) => b.name === targetBranch) ? r.branches : [{ name: targetBranch, current: false, merged: true }, ...r.branches];
      return { ...r, branches, worktrees: [{ path, branch: targetBranch, base }, ...r.worktrees] };
    }),
    removeWorktree: (path) => setRepo((r) => { pushToast(`Removed worktree at ${path}`); return { ...r, worktrees: r.worktrees.filter((w) => w.path !== path) }; }),
    createTag: (name) => setRepo((r) => {
      if (r.tags.some((t) => t.name === name)) { pushToast(`tag '${name}' already exists`, 'bad'); return r; }
      pushToast(`Tag ${name} created`);
      return { ...r, tags: [{ name, sha: (r.commits[0]?.sha || 'abc1234').slice(0, 7), when: 'just now' }, ...r.tags] };
    }),
    publishRelease: ({ tag, title, notes, prerelease }) => setRepo((r) => {
      pushToast(`Published ${title}`);
      const tags = r.tags.some((t) => t.name === tag) ? r.tags : [{ name: tag, sha: (r.commits[0]?.sha || 'abc1234').slice(0, 7), when: 'just now' }, ...r.tags];
      return { ...r, tags, releases: [{ tag, title, notes, prerelease, when: 'just now' }, ...r.releases] };
    }),
    discardFile: (path) => setRepo((r) => {
      pushToast(`Discarded ${path.split('/').pop()}`);
      return { ...r, staged: r.staged.filter((f) => f.p !== path), unstaged: r.unstaged.filter((f) => f.p !== path) };
    }),
    discardAll: () => setRepo((r) => {
      pushToast('Discarded all changes', 'warn');
      return { ...r, staged: [], unstaged: [] };
    }),
    stashChanges: (message) => setRepo((r) => {
      const total = r.staged.length + r.unstaged.length;
      if (total === 0) { pushToast('Nothing to stash'); return r; }
      pushToast(`Stashed ${total} file${total === 1 ? '' : 's'}`);
      const ref = `stash@{${r.stashes.length}}`;
      const stash = { ref, msg: message || `WIP on ${r.branch}`, when: 'just now' };
      return { ...r, staged: [], unstaged: [], stashes: [stash, ...r.stashes] };
    }),
    applyStash: (ref) => setRepo((r) => {
      pushToast(`Applied ${ref}`);
      return { ...r, stashes: r.stashes.filter((s) => s.ref !== ref), unstaged: [...r.unstaged, { p: 'Digital-Eval-Backend/src/pagination.js', t: 'mod', ins: 6, del: 1 }] };
    }),
    dropStash: (ref) => setRepo((r) => { pushToast(`Dropped ${ref}`); return { ...r, stashes: r.stashes.filter((s) => s.ref !== ref) }; }),
    stashPullReapply: (sourceBranch) => {
      let hadChanges = false;
      let behindCount = 0;
      let remoteName = 'origin';
      let branch = '';
      let pullSource = '';
      let skip = false;

      setRepo((r) => {
        if (r.conflict) { pushToast('Resolve the existing conflict first', 'warn'); skip = true; return r; }
        if (!r.hasRemote) { pushToast('No remote configured', 'warn'); skip = true; return r; }
        hadChanges = r.staged.length + r.unstaged.length > 0;
        remoteName = r.remotes[0]?.name || 'origin';
        branch = r.branch;
        pullSource = sourceBranch || branch;
        // Pulling your own tracked branch uses the repo's real ahead/behind
        // count. Pulling a teammate's branch instead (a different branch
        // than the one you're on) is simulated as having commits to bring
        // in, since this mock doesn't track per-branch divergence.
        behindCount = pullSource === branch ? r.behind : 3;
        if (!hadChanges && behindCount === 0) { pushToast(`${remoteName}/${pullSource} — nothing to stash, already up to date`); skip = true; return r; }

        // Step 1: stash whatever's uncommitted, right away.
        if (hadChanges) pushToast(`Stashed changes on ${branch}`);
        return hadChanges ? { ...r, staged: [], unstaged: [] } : r;
      });
      if (skip) return;

      // Step 2: pull — named explicitly so it's clear whether anything
      // actually came in, rather than silently no-oping when already current.
      setTimeout(() => {
        if (behindCount > 0) {
          pushToast(`Pulled ${behindCount} commit${behindCount === 1 ? '' : 's'} from ${remoteName}/${pullSource} into ${branch}`);
          if (pullSource === branch) setRepo((r) => ({ ...r, behind: 0 }));
        } else {
          pushToast(`${remoteName}/${pullSource} — already up to date, nothing to pull`);
        }
      }, 550);

      // Step 3: reapply the stash, only after the pull step has resolved.
      // Reapplying right after new commits land is exactly when a real
      // `stash pop` can conflict — so when both happened, surface the same
      // conflict resolver used for merges instead of a silent clean apply.
      if (!hadChanges) return;
      setTimeout(() => {
        if (behindCount > 0) {
          pushToast(`Reapplying stashed changes conflicts with what came in from ${remoteName}/${pullSource}`, 'warn');
          setRepo((r) => ({
            ...r,
            conflict: true,
            conflictFiles: BASE_CONFLICT_FILES.map((f) => ({ ...f, hunks: f.hunks.map((h) => ({ ...h })) })),
            conflictResolutions: {},
          }));
        } else {
          pushToast('Reapplied stashed changes cleanly — no upstream changes to conflict with');
          setRepo((r) => ({ ...r, unstaged: [...r.unstaged, { p: 'Digital-Eval-Backend/src/pagination.js', t: 'mod', ins: 6, del: 1 }] }));
        }
      }, 1150);
    },
    revertCommit: (commit) => setRepo((r) => {
      pushToast(`Reverted ${commit.sha}`);
      const rev = { sha: Math.random().toString(16).slice(2, 9), subj: `Revert "${commit.subj}"`, who: 'you', when: 'just now', head: true, refs: ['HEAD', r.branch] };
      return { ...r, commits: [rev, ...r.commits.map((c) => ({ ...c, head: false }))], ahead: r.hasRemote ? r.ahead + 1 : r.ahead };
    }),
    cherryPick: (commit) => setRepo((r) => {
      if (r.conflict) { pushToast('Resolve the existing conflict first', 'warn'); return r; }
      // Cherry-picking onto uncommitted local edits is exactly when it can
      // conflict — applying someone else's change on top of a dirty tree.
      const hadChanges = r.staged.length + r.unstaged.length > 0;
      if (hadChanges) {
        pushToast(`Cherry-picking ${commit.sha} conflicts with your uncommitted changes`, 'bad');
        return {
          ...r,
          conflict: true,
          conflictFiles: BASE_CONFLICT_FILES.map((f) => ({ ...f, hunks: f.hunks.map((h) => ({ ...h })) })),
          conflictResolutions: {},
        };
      }
      pushToast(`Cherry-picked ${commit.sha} onto ${r.branch}`);
      const pick = { sha: Math.random().toString(16).slice(2, 9), subj: commit.subj, who: 'you', when: 'just now', head: true, refs: ['HEAD', r.branch] };
      return { ...r, commits: [pick, ...r.commits.map((c) => ({ ...c, head: false }))], ahead: r.hasRemote ? r.ahead + 1 : r.ahead };
    }),
    resetTo: (commit, mode) => setRepo((r) => {
      const idx = r.commits.findIndex((c) => c.sha === commit.sha);
      if (idx === -1) return r;
      const undone = r.commits.slice(0, idx);
      const remaining = r.commits.slice(idx).map((c, i) => ({ ...c, head: i === 0 }));
      // Rewinding past more commits than you're "ahead" means some of what's
      // being undone was already pushed — the remote still has them, so a
      // later push needs --force rather than a normal fast-forward.
      const rewindsPushedHistory = r.hasRemote && undone.length > r.ahead;
      pushToast(
        `Reset (${mode}) to ${commit.sha} — ${undone.length} commit${undone.length === 1 ? '' : 's'} undone`
        + (rewindsPushedHistory ? ' — some were already pushed, force push to update the remote' : ''),
        mode === 'hard' || rewindsPushedHistory ? 'warn' : 'ok'
      );
      const next = { ...r, commits: remaining, ahead: Math.max(0, r.ahead - undone.length), historyRewritten: r.historyRewritten || rewindsPushedHistory };
      if (mode === 'hard') { next.staged = []; next.unstaged = []; }
      return next;
    }),
    continueMerge: () => setRepo((r) => {
      pushToast('Merge completed');
      const mergeCommit = { sha: Math.random().toString(16).slice(2, 9), subj: `Merge branch 'origin/${r.branch}' into ${r.branch}`, who: 'you', when: 'just now', head: true, refs: ['HEAD', r.branch] };
      return { ...r, conflict: false, conflictFiles: [], conflictResolutions: {}, commits: [mergeCommit, ...r.commits.map((c) => ({ ...c, head: false }))], behind: 0 };
    }),
    abortMerge: () => setRepo((r) => { pushToast('Merge aborted', 'warn'); return { ...r, conflict: false, conflictFiles: [], conflictResolutions: {} }; }),
    setConflictResolutions: (updater) => setRepo((r) => ({ ...r, conflictResolutions: typeof updater === 'function' ? updater(r.conflictResolutions) : updater })),
    checkCredentialMatch: () => setRepo((r) => {
      const gh = activeAccountLogin || 'the account shown';
      pushToast(r.credentialMismatch ? `Push credential is ${r.sshIdentity} — different from ${gh}` : `Push credential matches ${gh}`, r.credentialMismatch ? 'warn' : 'ok');
      return r;
    }),
    viewRawError: () => pushToast('GraphQL: Could not resolve to a Repository (repositoryOwnerFetch)', 'bad'),
    openCreateBranch: () => setPanel('branches'),
    goToAccounts,
    openCreatePR: () => setModal('createPR'),
    openAddRemote: () => setModal('addRemote'),
    openSignIn: () => setModal('signIn'),
    openConnectAccount: () => setModal('connectAccount'),
    openNewWorktree: () => setModal('newWorktree'),
    openDraftRelease: () => setModal('draftRelease'),
    openInitRepo: () => setModal('initRepo'),
    openStash: () => setModal('stash'),
    openStashPullReapply: () => setModal('stashPullReapply'),
    openDiscardAll: () => setModal('discardAll'),
    openForcePush: () => setModal('forcePush'),
    openReset: (commit) => { setResetTarget(commit); setModal('reset'); },
  };

  const changeCount = repo.staged.length + repo.unstaged.length;
  const prCount = repo.prs.length;
  const hasConflict = repo.conflict;

  const branchLabel = repo.detached ? `${repo.branch} (detached)` : repo.branch;
  const accountTone = !repo.ghAuthed ? 'bad' : (repo.credentialMismatch || !repo.hasAccess) ? 'warn' : 'ok';

  const PANELS = {
    overview: <OverviewPanel repo={repoWithAccount} actions={actions} goToChanges={goToChanges} goToPRs={goToPRs} />,
    changes: <ChangesPanel repo={repoWithAccount} actions={actions} onOpenDiff={openDiffFor} goToChanges={goToChanges} />,
    diff: <DiffPage repo={repoWithAccount} actions={actions} diffMode={diffMode} setDiffMode={setDiffMode} selectedFile={selectedFile} setSelectedFile={setSelectedFile} selectedCommit={selectedCommit} setSelectedCommit={setSelectedCommit} />,
    branches: <BranchesPanel repo={repoWithAccount} actions={actions} goToChanges={goToChanges} />,
    history: <HistoryPanel repo={repoWithAccount} actions={actions} onSelectCommit={openDiffForCommit} goToChanges={goToChanges} />,
    prs: <PRsPanel repo={repoWithAccount} actions={actions} goToChanges={goToChanges} />,
    tags: <TagsPanel repo={repoWithAccount} actions={actions} goToChanges={goToChanges} />,
    stashes: <StashesPanel repo={repoWithAccount} actions={actions} goToChanges={goToChanges} />,
    accounts: <AccountsPanel repo={repoWithAccount} actions={actions} />,
    settings: <SettingsPanel repo={repoWithAccount} actions={actions} />,
  };

  return (
    <div className={`tabs-app theme-${theme} flex h-screen w-full tx font-sans overflow-hidden`} style={{ backgroundColor: 'var(--bg-base)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&display=swap');

        /* Real app's --font-sans, matching the Agents tab */
        .tabs-app {
          font-family: "DM Sans Variable", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        }
        .theme-dark {
          --bg-base: #0f0f0f; --bg-surface: #1a1a1a; --fg: #f5f5f5;
          --fg-90: rgba(245,245,245,0.92); --fg-85: rgba(245,245,245,0.88); --fg-80: rgba(245,245,245,0.85); --fg-70: rgba(245,245,245,0.78);
          --fg-60: rgba(245,245,245,0.7); --fg-50: rgba(245,245,245,0.62); --fg-40: rgba(245,245,245,0.54);
          --fg-30: rgba(245,245,245,0.44); --fg-25: rgba(245,245,245,0.38); --fg-20: rgba(245,245,245,0.32);
          --overlay-4: rgba(255,255,255,0.035); --overlay-5: rgba(255,255,255,0.04); --overlay-10: rgba(255,255,255,0.08); --overlay-20: rgba(255,255,255,0.16);
          --accent: oklch(0.588 0.217 264); --accent-contrast: #ffffff;
          --scrollbar-thumb: rgba(255,255,255,0.14); --scrollbar-thumb-hover: rgba(255,255,255,0.24);
          /* Semantic status colors — dark mode uses the light/soft shades
             that read well on near-black. */
          --sem-red: #f87171; --sem-red-soft: rgba(248,113,113,0.09); --sem-red-border: rgba(248,113,113,0.28);
          --sem-amber: #fbbf24; --sem-amber-soft: rgba(251,191,36,0.09); --sem-amber-border: rgba(251,191,36,0.28);
          --sem-emerald: #34d399; --sem-emerald-soft: rgba(52,211,153,0.09); --sem-emerald-border: rgba(52,211,153,0.28);
          --sem-sky: #38bdf8; --sem-sky-soft: rgba(56,189,248,0.09); --sem-sky-border: rgba(56,189,248,0.28);
          --sem-purple: #c084fc; --sem-purple-soft: rgba(192,132,252,0.12);
          --sem-emerald-text: #a7f3d0; --sem-red-text: #fca5a5;
        }
        .theme-light {
          --bg-base: #f6f5f2; --bg-surface: #fcfbf9; --fg: #3a3936;
          --fg-90: rgba(58,57,54,0.88); --fg-85: rgba(58,57,54,0.82); --fg-80: rgba(58,57,54,0.78); --fg-70: rgba(58,57,54,0.68);
          --fg-60: rgba(58,57,54,0.58); --fg-50: rgba(58,57,54,0.5); --fg-40: rgba(58,57,54,0.42);
          --fg-30: rgba(58,57,54,0.34); --fg-25: rgba(58,57,54,0.28); --fg-20: rgba(58,57,54,0.22);
          --overlay-4: rgba(58,57,54,0.035); --overlay-5: rgba(58,57,54,0.045); --overlay-10: rgba(58,57,54,0.07); --overlay-20: rgba(58,57,54,0.12);
          --accent: oklch(0.488 0.217 264); --accent-contrast: #ffffff;
          --scrollbar-thumb: rgba(58,57,54,0.18); --scrollbar-thumb-hover: rgba(58,57,54,0.3);
          /* Light mode needs noticeably darker/more saturated shades of the
             same colors — the dark-mode tints (tuned for contrast on near-
             black) wash out and become hard to read on a near-white card. */
          --sem-red: #dc2626; --sem-red-soft: rgba(220,38,38,0.08); --sem-red-border: rgba(220,38,38,0.3);
          --sem-amber: #b45309; --sem-amber-soft: rgba(180,83,9,0.1); --sem-amber-border: rgba(180,83,9,0.3);
          --sem-emerald: #059669; --sem-emerald-soft: rgba(5,150,105,0.08); --sem-emerald-border: rgba(5,150,105,0.3);
          --sem-sky: #0284c7; --sem-sky-soft: rgba(2,132,199,0.08); --sem-sky-border: rgba(2,132,199,0.3);
          --sem-purple: #9333ea; --sem-purple-soft: rgba(147,51,234,0.1);
          --sem-emerald-text: #047857; --sem-red-text: #b91c1c;
        }
        .tabs-app .tx { color: var(--fg); }
        .tabs-app .tx-90 { color: var(--fg-90); }
        .tabs-app .tx-85 { color: var(--fg-85); }
        .tabs-app .tx-80 { color: var(--fg-80); }
        .tabs-app .tx-70 { color: var(--fg-70); }
        .tabs-app .tx-60 { color: var(--fg-60); }
        .tabs-app .tx-50 { color: var(--fg-50); }
        .tabs-app .tx-40 { color: var(--fg-40); }
        .tabs-app .tx-30 { color: var(--fg-30); }
        .tabs-app .tx-25 { color: var(--fg-25); }
        .tabs-app .tx-20 { color: var(--fg-20); }
        /* Real, guaranteed font-size classes. React artifacts here don't run
           a Tailwind compiler, so bracket values like text-[11px] are not
           pre-defined and silently do nothing — any element relying only on
           one falls back to the browser default (16px), which is exactly
           why some text rendered comically large next to correctly-sized
           siblings. These are plain CSS rules, so they always apply. */
        .tabs-app .fs-9 { font-size: 9px; }
        .tabs-app .fs-10 { font-size: 10px; }
        .tabs-app .fs-11 { font-size: 11px; }
        .tabs-app .fs-12 { font-size: 12px; }
        .tabs-app .fs-13 { font-size: 13px; }
        .tabs-app .hov-tx:hover { color: var(--fg); }
        .tabs-app .hov-tx-70:hover { color: var(--fg-70); }
        .tabs-app .hov-tx-80:hover { color: var(--fg-80); }
        .tabs-app .hov-tx-90:hover { color: var(--fg-90); }
        .tabs-app .group:hover .ghov-tx-70 { color: var(--fg-70); }
        .tabs-app .group:hover .ghov-tx-90 { color: var(--fg-90); }
        .tabs-app .bg-base { background-color: var(--bg-base); }
        .tabs-app .bg-surf { background-color: var(--bg-surface); }
        .tabs-app .bg-o05 { background-color: var(--overlay-4); }
        .tabs-app .bg-o1 { background-color: var(--overlay-5); }
        .tabs-app .bg-o2 { background-color: var(--overlay-10); }
        .tabs-app .hov-bg-o1:hover { background-color: var(--overlay-5); }
        .tabs-app .hov-bg-o2:hover { background-color: var(--overlay-10); }
        .tabs-app .bd-1 { border-color: var(--overlay-5); }
        .tabs-app .bd-2 { border-color: var(--overlay-10); }
        .tabs-app .bd-3 { border-color: var(--overlay-20); }
        .tabs-app .hov-bd-2:hover { border-color: var(--overlay-10); }
        .tabs-app .hov-bd-3:hover { border-color: var(--overlay-20); }
        .tabs-app .foc-bd-3:focus { border-color: var(--overlay-20); }
        .tabs-app .ph-25::placeholder { color: var(--fg-25); }
        .tabs-app .ring-safe { box-shadow: 0 0 0 1px var(--overlay-20); }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 9999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
        .grain-overlay {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.035; mix-blend-mode: overlay;
        }
      `}</style>
      <div className="grain-overlay fixed inset-0 pointer-events-none z-0"></div>
      <ToastStack toasts={toasts} />

      {modal === 'initRepo' && (
        <InitRepoModal currentName={repo.repoName} onClose={closeModal}
          onInit={(name, branch) => { actions.initRepo(name, branch); closeModal(); }}
          onClone={(name, url) => { actions.cloneRepo(name, url); closeModal(); }} />
      )}
      {modal === 'stash' && (
        <StashModal onClose={closeModal} onStash={(message) => { actions.stashChanges(message); closeModal(); }} />
      )}
      {modal === 'stashPullReapply' && (
        <PullSourceModal branches={repo.branches} currentBranch={repo.branch} remoteName={repo.remotes[0]?.name || 'origin'}
          onClose={closeModal} onConfirm={(source) => { actions.stashPullReapply(source); closeModal(); }} />
      )}
      {modal === 'discardAll' && (
        <DiscardAllModal count={repo.staged.length + repo.unstaged.length} onClose={closeModal}
          onConfirm={() => { actions.discardAll(); closeModal(); }} />
      )}
      {modal === 'forcePush' && (
        <ForcePushModal branch={repo.branch} onClose={closeModal} onConfirm={() => { actions.forcePush(); closeModal(); }} />
      )}
      {modal === 'reset' && resetTarget && (
        <ResetModal commit={resetTarget} onClose={closeModal} onReset={(mode) => { actions.resetTo(resetTarget, mode); closeModal(); }} />
      )}
      {modal === 'createPR' && (
        <CreatePRModal repo={repoWithAccount} onClose={closeModal}
          onCreate={(details) => { actions.createPR(details); goToPRs(); closeModal(); }} />
      )}
      {modal === 'addRemote' && (
        <AddRemoteModal onClose={closeModal} onAdd={(details) => { actions.addRemote(details); closeModal(); }} />
      )}
      {modal === 'signIn' && (
        <DeviceAuthModal title="Sign in to GitHub" onClose={closeModal}
          subtitle="Enter this code at github.com/login/device to connect your account to this project."
          onConfirm={() => { actions.signInGitHub(); closeModal(); }} />
      )}
      {modal === 'connectAccount' && (
        <DeviceAuthModal title="Connect a GitHub account" onClose={closeModal}
          subtitle="Authorize this code at github.com/login/device. GitHub will tell us which account signed in — you'll see it added below once it's done. Already-connected accounts can be reused instantly from the account switcher without going through this again."
          onConfirm={() => { actions.connectAccount(); closeModal(); }} />
      )}
      {modal === 'newWorktree' && (
        <NewWorktreeModal repo={repoWithAccount} onClose={closeModal}
          onCreate={(details) => { actions.createWorktree(details); closeModal(); }} />
      )}
      {modal === 'draftRelease' && (
        <DraftReleaseModal repo={repoWithAccount} onClose={closeModal}
          onPublish={(details) => { actions.publishRelease(details); closeModal(); }} />
      )}

      <Sidebar repoName={repo.repoName} panel={panel} setPanel={setPanel} collapsed={collapsed} setCollapsed={setCollapsed} changeCount={changeCount} prCount={prCount} hasConflict={hasConflict} />

      <div className="flex-1 flex flex-col min-w-0 z-10">
        <TopBar repoName={repo.repoName} theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          scenario={scenario} setScenario={setScenario}
          branchLabel={branchLabel} accentDotTone={accountTone}
          accounts={repo.accounts} activeAccountLogin={activeAccountLogin}
          onSwitchAccount={actions.switchAccount} onOpenAccounts={goToAccounts} onOpenSignIn={actions.openSignIn} />

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5" style={{ backgroundColor: 'var(--bg-base)' }}>
          <div style={{ maxWidth: '1120px', margin: '0 auto' }}>{PANELS[panel]}</div>
        </div>
      </div>
    </div>
  );
}
