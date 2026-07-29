import type { GitHistoryCommit } from "@tabs/contracts";
import {
  Check,
  Copy,
  History as HistoryIcon,
  MoreHorizontal,
  RotateCcw,
  Search,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";
import { readNativeApi } from "../../nativeApi";
import { DiffCard, parseGitPatchToFiles, type ParsedFileDiff } from "./DiffPage";
import { GitCheckingState } from "./GitCheckingState";
import {
  Banner,
  Btn,
  Card,
  Modal,
  StatPill,
  TextInput,
} from "./gitPrimitives";

export function CommitRow({
  c,
  onClick,
  onReset,
  onRevert,
  onCherryPick,
}: {
  c: GitHistoryCommit;
  onClick?: () => void;
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

  const copySha = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(c.sha).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    setMenuOpen(false);
  };

  return (
    <div className="group relative">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className="relative w-full text-left flex flex-col gap-1.5 pl-4 pr-9 py-3 border-b bd-1 last:border-0 hov-bg-o1 rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
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
      <div className="absolute right-1 top-3" ref={menuRef} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
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
              onClick={(e) => {
                e.stopPropagation();
                onCherryPick(c);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 tx-60 hov-tx hov-bg-o1 transition-colors cursor-pointer"
            >
              <Copy size={11} /> Cherry-pick
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRevert(c);
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left fs-11 tx-60 hov-tx hov-bg-o1 transition-colors cursor-pointer"
            >
              <Undo2 size={11} /> Revert
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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

export function CommitDetailModal({
  cwd,
  commit,
  onClose,
}: {
  cwd: string;
  commit: GitHistoryCommit | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileDiffs, setFileDiffs] = useState<ParsedFileDiff[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const api = readNativeApi();

  useEffect(() => {
    if (!commit || !api || !cwd) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedFileIndex(0);

    api.git
      .diff({ cwd, commit: commit.sha })
      .then((res: { patch?: string }) => {
        if (cancelled) return;
        if (res?.patch) {
          const parsed = parseGitPatchToFiles(res.patch);
          setFileDiffs(parsed);
        } else {
          setFileDiffs([]);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(toGitUserFacingErrorMessage(err));
          setFileDiffs([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, cwd, commit]);

  if (!commit) return null;

  const currentFile = fileDiffs[selectedFileIndex] ?? null;

  return (
    <Modal title={`Commit ${commit.shortSha}`} onClose={onClose} width="w-[92vw] max-w-[1300px]">
      <div className="p-4 space-y-4 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="space-y-1.5 border-b bd-1 pb-3 shrink-0">
          <div className="text-sm font-semibold tx leading-snug">{commit.subject}</div>
          <div className="flex flex-wrap items-center gap-3 text-xs tx-40 font-mono">
            <span>Author: <strong className="tx-70">{commit.authorName}</strong></span>
            <span>Date: <strong className="tx-70">{commit.authoredAt.slice(0, 10)}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono tx-30 pt-1">
            <span className="truncate flex-1">SHA: {commit.sha}</span>
            <Btn sm ghost onClick={() => void navigator.clipboard?.writeText(commit.sha)}>
              Copy SHA
            </Btn>
          </div>
        </div>

        {loading ? (
          <GitCheckingState message="Loading commit diff…" size={36} />
        ) : error ? (
          <Banner tone="bad" title="Failed to load commit diff" body={error} />
        ) : fileDiffs.length === 0 ? (
          <div className="text-center text-xs tx-30 py-8">No file changes found in this commit.</div>
        ) : (
          <div className="flex flex-1 min-h-[350px] gap-3 overflow-hidden">
            <div className="w-64 shrink-0 border-r bd-1 pr-2 overflow-y-auto custom-scrollbar space-y-1">
              <div className="fs-10 uppercase tracking-widest tx-30 px-2 py-1">
                Files ({fileDiffs.length})
              </div>
              {fileDiffs.map((fd, idx) => (
                <button
                  key={fd.path}
                  type="button"
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    selectedFileIndex === idx ? "bg-o2 tx font-medium" : "tx-60 hov-bg-o1"
                  }`}
                >
                  <span className="truncate flex-1 font-mono fs-11">{fd.path}</span>
                  {fd.isBinary ? (
                    <span className="fs-10 font-mono border bd-2 rounded px-1.5 py-0.5 tx-40 uppercase">BIN</span>
                  ) : (
                    <StatPill ins={fd.ins} del={fd.del} />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-0 h-full overflow-hidden">
              {currentFile ? (
                <DiffCard
                  path={currentFile.path}
                  ins={currentFile.ins}
                  del={currentFile.del}
                  lines={currentFile.lines}
                />
              ) : (
                <div className="text-center text-xs tx-30 py-8">Select a file to view changes.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function HistoryPanel({
  cwd,
  commits,
  loadingHistory,
  onReset,
  onRevert,
  onCherryPick,
  onLoadMoreHistory,
}: {
  cwd: string;
  commits: ReadonlyArray<GitHistoryCommit>;
  loadingHistory?: boolean;
  onReset: (c: GitHistoryCommit) => void;
  onRevert: (c: GitHistoryCommit) => void;
  onCherryPick: (c: GitHistoryCommit) => void;
  onLoadMoreHistory?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeCommit, setActiveCommit] = useState<GitHistoryCommit | null>(null);
  const q = query.trim().toLowerCase();
  const filtered = q ? commits.filter((c) => c.subject.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q) || c.sha.includes(q)) : commits;

  if (loadingHistory) {
    return <GitCheckingState message="Loading history…" size={36} />;
  }

  if (commits.length === 0) {
    return (
      <Card className="p-6 text-center">
        <HistoryIcon className="mx-auto mb-2 tx-30" size={24} />
        <p className="fs-12 font-medium tx-80 mb-1">No commits yet</p>
        <p className="fs-11 tx-40">Commits made to this repository will appear here.</p>
      </Card>
    );
  }

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
            <CommitRow key={c.sha} c={c} onClick={() => setActiveCommit(c)} onReset={onReset} onRevert={onRevert} onCherryPick={onCherryPick} />
          ))}
          {onLoadMoreHistory && filtered.length >= 50 && (
            <div className="pt-4 text-center">
              <Btn ghost onClick={onLoadMoreHistory}>
                Load more commits
              </Btn>
            </div>
          )}
        </div>
      )}
      {activeCommit && (
        <CommitDetailModal cwd={cwd} commit={activeCommit} onClose={() => setActiveCommit(null)} />
      )}
    </div>
  );
}
