import type {
  GitEnvironmentResult,
  GitHistoryCommit,
  GitListBranchesResult,
  GitStatusResult,
  GitWatchedBranchStatus,
} from "@tabs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Download,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";

import { deriveRepoState } from "../../lib/deriveRepoState";
import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";
import { invalidateGitQueries } from "../../lib/gitReactQuery";
import { readNativeApi } from "../../nativeApi";
import { toastManager } from "../ui/toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import {
  AutoTextarea,
  Banner,
  Card,
  SectionLabel,
} from "./gitPrimitives";


const TONE = {
  ok: { color: "var(--sem-emerald)", dot: "var(--sem-emerald)", soft: "var(--sem-emerald-soft)", border: "var(--sem-emerald-border)" },
  warn: { color: "var(--sem-amber)", dot: "var(--sem-amber)", soft: "var(--sem-amber-soft)", border: "var(--sem-amber-border)" },
  bad: { color: "var(--sem-red)", dot: "var(--sem-red)", soft: "var(--sem-red-soft)", border: "var(--sem-red-border)" },
  info: { color: "var(--sem-sky)", dot: "var(--sem-sky)", soft: "var(--sem-sky-soft)", border: "var(--sem-sky-border)" },
};

export function OverviewPanel({
  cwd,
  repoName,
  statusData,
  environmentData,
  branchList,
  commits,
  watchedBranchStatuses = [],
  onGoToChanges,
  onGoToAccounts,
  onGoToDivergence,
  onOpenSignIn,
  onOpenAddRemote,
  onOpenCreateBranch,
  onRunInTerminal,
  onInitRepo,
}: {
  cwd: string;
  repoName: string;
  statusData: GitStatusResult | null;
  environmentData: GitEnvironmentResult | null;
  branchList: GitListBranchesResult | null;
  commits: ReadonlyArray<GitHistoryCommit>;
  watchedBranchStatuses?: ReadonlyArray<GitWatchedBranchStatus>;
  onGoToChanges: () => void;
  onGoToAccounts: () => void;
  onGoToDivergence: () => void;
  onOpenSignIn: () => void;
  onOpenAddRemote: () => void;
  onOpenCreateBranch: () => void;
  onRunInTerminal: (cmd: string) => void;
  onInitRepo: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [forking, setForking] = useState(false);
  const [lastPushedAt, setLastPushedAt] = useState<number | null>(null);
  const [confirmMergeBranch, setConfirmMergeBranch] = useState<string | null>(null);
  const [confirmRebaseBranch, setConfirmRebaseBranch] = useState<string | null>(null);
  const [showAllWatchedBranches, setShowAllWatchedBranches] = useState(false);

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
  const remoteName = branchList?.remoteName ?? "origin";
  const pushAccess = branchList?.pushAccess ?? "unknown";

  const handleExecuteMergeWatched = async (targetBranch: string) => {
    if (!api) return;
    try {
      await api.git.merge({ cwd, branch: targetBranch });
      await invalidateGitQueries(queryClient);
      setConfirmMergeBranch(null);
      toastManager.add({ type: "success", title: `Merged ${targetBranch} into current branch` });
    } catch (error) {
      toastManager.add({ type: "error", title: "Merge failed", description: toGitUserFacingErrorMessage(error) });
    }
  };

  const handleExecuteRebaseWatched = async (targetBranch: string) => {
    if (!api) return;
    try {
      await api.git.rebase({ cwd, branch: targetBranch });
      await invalidateGitQueries(queryClient);
      setConfirmRebaseBranch(null);
      toastManager.add({ type: "success", title: `Rebased current branch onto ${targetBranch}` });
    } catch (error) {
      toastManager.add({ type: "error", title: "Rebase failed", description: toGitUserFacingErrorMessage(error) });
    }
  };

  const urgentWatchedBranch = useMemo(() => {
    const mainBranch = watchedBranchStatuses.find(
      (b) =>
        b.behindCount > 0 &&
        (b.name === "main" ||
          b.name === "master" ||
          b.name === "origin/main" ||
          b.name === "origin/master"),
    );
    return mainBranch ?? watchedBranchStatuses.find((b) => b.behindCount > 0) ?? null;
  }, [watchedBranchStatuses]);

  const handleCreateFork = async () => {
    if (!api) return;
    setForking(true);
    try {
      await api.git.createFork({ cwd, remoteName: "fork" });
      await invalidateGitQueries(queryClient);
      toastManager.add({ type: "success", title: "Fork created", description: "Forked repository and added remote 'fork'." });
    } catch (error) {
      toastManager.add({ type: "error", title: "Fork failed", description: toGitUserFacingErrorMessage(error) });
    } finally {
      setForking(false);
    }
  };

  const repoState = useMemo(
    () =>
      deriveRepoState({
        isGitInstalled,
        isRepo,
        hasRemote,
        ghAuthed,
        aheadCount: ahead,
        behindCount: behind,
        stagedFilesCount: stagedFiles.length,
        unstagedFilesCount: unstagedFiles.length,
        hasConflict,
        isDetached,
        isEmptyRepo: isRepo && (commits.length === 0 || (branchList?.branches.length === 0 && !hasConflict)),
        remoteName,
        pushAccess,
      }),
    [
      isGitInstalled,
      isRepo,
      hasRemote,
      ghAuthed,
      ahead,
      behind,
      stagedFiles.length,
      unstagedFiles.length,
      hasConflict,
      isDetached,
      commits.length,
      branchList?.branches.length,
      remoteName,
      pushAccess,
    ],
  );

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const pool = (stagedFiles.length ? stagedFiles : unstagedFiles).map((f) => f.path.split("/").pop());
      const summary = pool.length ? `Update ${pool.slice(0, 3).join(", ")}` : "WIP: general improvements";
      setMsg(summary);
      setGenerating(false);
    }, 400);
  };

  const handleCommit = async (andPush = false) => {
    if (!api || !msg.trim()) return;
    try {
      await api.git.runStackedAction({
        actionId: crypto.randomUUID(),
        cwd,
        action: andPush ? "commit_push" : "commit",
        commitMessage: msg.trim(),
      });
      setMsg("");
      await invalidateGitQueries(queryClient);
      if (andPush) setLastPushedAt(Date.now());
      toastManager.add({ type: "success", title: andPush ? "Committed and pushed" : "Committed staged" });
    } catch (error) {
      await invalidateGitQueries(queryClient);
      const errObj = error as { message?: string; phase?: string; createdCommitSha?: string };
      const isPushFailureAfterCommit = errObj?.phase === "push" && Boolean(errObj?.createdCommitSha);
      const unpushedCount = ahead + 1;
      const countLabel = unpushedCount === 1 ? "1 unpushed commit" : `${unpushedCount} unpushed commits`;
      const shortSha = errObj.createdCommitSha ? errObj.createdCommitSha.substring(0, 7) : "";
      const errorMsg = toGitUserFacingErrorMessage(error);
      toastManager.add({
        type: "error",
        title: isPushFailureAfterCommit
          ? "Commit succeeded, but push failed"
          : "Commit failed",
        description: isPushFailureAfterCommit
          ? `${shortSha ? `Committed as ${shortSha}. ` : ""}Push failed: ${errorMsg}. You have ${countLabel} — click Push to retry.`
          : errorMsg,
      });
    }
  };

  if (repoState.kind === "git_not_installed") {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto">
        <CircleAlert className="mx-auto mb-3 tx-30" size={32} />
        <h3 className="text-base font-semibold tx mb-1">Git command line required</h3>
        <p className="fs-12 tx-50 leading-relaxed mb-6">
          Tabs uses system Git to track files, stage changes, and manage history. Install Git to enable full source control in this workspace.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" render={<a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer" />}>
            Download Git
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRunInTerminal("git --version")}>
            Check in terminal
          </Button>
        </div>
      </Card>
    );
  }

  if (repoState.kind === "not_a_repo") {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto">
        <GitCommit className="mx-auto mb-3 tx-30" size={32} />
        <h3 className="text-base font-semibold tx mb-1">Initialize Git in {repoName}</h3>
        <p className="fs-12 tx-50 leading-relaxed mb-6">
          This workspace directory is not a Git repository. Initialize Git to start tracking file changes, saving commits, and syncing with remotes.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" onClick={onInitRepo}>
            <GitCommit /> Initialize repository
          </Button>
        </div>
      </Card>
    );
  }

  if (repoState.kind === "read_only_remote") {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto">
        <CircleAlert className="mx-auto mb-3" size={32} style={{ color: "var(--sem-amber)" }} />
        <h3 className="text-base font-semibold tx mb-1">Read-only remote repository</h3>
        <p className="fs-12 tx-50 leading-relaxed mb-6">
          You don't have write access to {remoteName}. You can create local commits, but pushing to this remote is disabled. Fork this repository or switch accounts to push your work.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" disabled={forking} onClick={() => void handleCreateFork()}>
            <GitPullRequest /> {forking ? "Forking…" : "Fork repository"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onGoToAccounts}>
            Check accounts
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Dynamic Repo State Banner */}
      {repoState.kind !== "clean_ready" && (
        <Banner
          tone={repoState.severity === "error" ? "bad" : repoState.severity === "warning" ? "warn" : "info"}
          title={repoState.title}
          body={forking ? "Creating a fork on GitHub and adding local remote..." : repoState.description}
          actions={
            repoState.primaryAction ? (
              <Button
                size="sm"
                disabled={forking}
                onClick={() => {
                  switch (repoState.primaryAction?.actionType) {
                    case "create_fork":
                      void handleCreateFork();
                      break;
                    case "pull_merge":
                      onRunInTerminal("git pull");
                      break;
                    case "push":
                      onRunInTerminal(`git push origin ${branchName}`);
                      break;
                    case "init_repo":
                      onInitRepo();
                      break;
                    case "add_remote":
                      onOpenAddRemote();
                      break;
                    case "sign_in_gh":
                      onOpenSignIn();
                      break;
                    case "create_branch":
                      onOpenCreateBranch();
                      break;
                    case "resolve_conflicts":
                      onGoToChanges();
                      break;
                  }
                }}
              >
                {repoState.primaryAction.label}
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Secondary Notices */}
      {repoState.secondaryNotices.map((notice) => (
        <Banner
          key={notice.id}
          tone={notice.severity === "warning" ? "warn" : "info"}
          title={notice.message}
          actions={
            notice.actionLabel && notice.actionType === "add_remote" ? (
              <Button size="sm" onClick={onOpenAddRemote}>
                {notice.actionLabel}
              </Button>
            ) : notice.actionLabel && notice.actionType === "pull_merge" ? (
              <Button size="sm" onClick={() => onRunInTerminal("git pull")}>
                <Download /> {notice.actionLabel}
              </Button>
            ) : undefined
          }
        />
      ))}

      {/* Urgent Watched Branch Notice Banner */}
      {urgentWatchedBranch && (
        <Banner
          tone="warn"
          title={`${urgentWatchedBranch.name} has ${urgentWatchedBranch.behindCount} new commit${urgentWatchedBranch.behindCount === 1 ? "" : "s"} you don't have`}
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setConfirmMergeBranch(urgentWatchedBranch.name)}>
                <Download /> Merge {urgentWatchedBranch.name}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRebaseBranch(urgentWatchedBranch.name)}>
                Rebase onto {urgentWatchedBranch.name}
              </Button>
            </div>
          }
        />
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-3">
          <div className="fs-10 uppercase tracking-widest tx-30 mb-1">Branch</div>
          <div className="fs-12 font-mono tx-85 font-semibold truncate flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono">{branchName}</Badge>
          </div>
        </Card>

        <Card className="p-3">
          <div className="fs-10 uppercase tracking-widest tx-30 mb-1">Sync status</div>
          <div className="fs-12 font-mono tx-85 flex items-center gap-2">
            {ahead > 0 && (
              <span className="flex items-center gap-0.5" style={{ color: "var(--sem-emerald)" }}>
                <ArrowUp size={11} />
                {ahead}
              </span>
            )}
            {behind > 0 && (
              <span className="flex items-center gap-0.5" style={{ color: "var(--sem-amber)" }}>
                <ArrowDown size={11} />
                {behind}
              </span>
            )}
            {ahead === 0 && behind === 0 && <span className="fs-11 tx-40">In sync</span>}
          </div>
        </Card>

        <Card className="p-3 cursor-pointer hov-bd-3 transition-colors" onClick={onGoToChanges}>
          <div className="fs-10 uppercase tracking-widest tx-30 mb-1">Working tree</div>
          <div className="fs-12 font-mono tx-85">
            {changed === 0 ? (
              <span className="fs-11 tx-40">Clean</span>
            ) : (
              <span>
                {stagedFiles.length} staged, {unstagedFiles.length} modified
              </span>
            )}
          </div>
        </Card>

        <Card className="p-3">
          <div className="fs-10 uppercase tracking-widest tx-30 mb-1">Remote</div>
          <div className="fs-12 font-mono tx-85 truncate">
            {hasRemote ? (pushAccess === "read_only" ? "origin (read-only)" : "origin") : "none"}
          </div>
        </Card>
      </div>

      {/* Watched Branch Divergence Card */}
      {watchedBranchStatuses.length > 0 && (
        <div className="mb-6">
          <SectionLabel>Watched branch divergence</SectionLabel>
          <Card className="p-3">
            <p className="fs-11 tx-40 leading-relaxed mb-3">
              Branches in this repository with unmerged commits ahead of or behind your current branch.
            </p>
            <div className="flex flex-col">
              {watchedBranchStatuses.slice(0, 5).map((b, idx, arr) => {
                const isLast = idx === arr.length - 1 && watchedBranchStatuses.length <= 5;
                return (
                  <div
                    key={b.name}
                    className={`flex items-center justify-between gap-3 py-2 ${
                      isLast ? "" : "border-b bd-1"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="fs-12 font-mono font-semibold tx-80 truncate">{b.name}</span>
                      {b.isRemote && <Badge variant="secondary">remote</Badge>}
                      {b.behindCount > 0 && (
                        <span className="flex items-center gap-0.5 fs-11 font-mono shrink-0" style={{ color: "var(--sem-amber)" }}>
                          <ArrowDown size={11} />
                          {b.behindCount} behind
                        </span>
                      )}
                      {b.aheadCount > 0 && (
                        <span className="flex items-center gap-0.5 fs-11 font-mono shrink-0" style={{ color: "var(--sem-emerald)" }}>
                          <ArrowUp size={11} />
                          {b.aheadCount} ahead
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmMergeBranch(b.name)}>
                        Merge
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmRebaseBranch(b.name)}>
                        Rebase
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {watchedBranchStatuses.length > 5 && (
              <div className="pt-2 mt-2 border-t bd-1 flex items-center justify-between">
                <span className="fs-11 tx-40">Showing top 5 of {watchedBranchStatuses.length} diverged branches</span>
                <button
                  type="button"
                  onClick={onGoToDivergence}
                  className="fs-11 font-medium tx-60 hov-tx hover:underline cursor-pointer py-1 flex items-center gap-1"
                >
                  View all →
                </button>
              </div>
            )}
          </Card>
        </div>
      )}


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
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (stagedFiles.length && repoState.canCommitLocally) void handleCommit(false);
            }
          }}
          placeholder="Summarize your change…"
          minRows={2}
          className="w-full border bd-2 rounded-lg tx text-xs ph-25 p-3 outline-none foc-bd-3 transition-colors"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!stagedFiles.length || !repoState.canCommitLocally}
              title={!stagedFiles.length ? "Stage some changes first" : undefined}
              onClick={() => void handleCommit(false)}
            >
              <GitCommit /> {repoState.commitButtonLabel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={(!stagedFiles.length && !unstagedFiles.length) || generating}
              title="Fills the box from your changed file names"
              onClick={handleGenerate}
            >
              <Sparkles /> {generating ? "Generating…" : "Generate message"}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!stagedFiles.length || !repoState.canCommitLocally || !repoState.canPush}
            title={repoState.pushDisabledReason ?? (!stagedFiles.length ? "Stage some changes first" : undefined)}
            onClick={() => void handleCommit(true)}
          >
            <Upload /> Commit &amp; push
          </Button>
        </div>

        <div className="h-px bg-o2 my-3 -mx-4" />

        <div className="flex items-center justify-between mb-2">
          <span className="fs-10 uppercase tracking-widest tx-30">Sync</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!repoState.canPush}
              title={repoState.pushDisabledReason}
              onClick={() => onRunInTerminal(`git push origin ${branchName}`)}
            >
              <ArrowUp /> Push
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!repoState.canForcePush}
              title={repoState.pushDisabledReason}
              onClick={() => onRunInTerminal(`git push --force-with-lease origin ${branchName}`)}
            >
              Force push…
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!repoState.canPull}
              onClick={() => onRunInTerminal(`git pull origin ${branchName}`)}
            >
              <ArrowDown /> Pull
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!repoState.canCreatePR}
            title={repoState.prDisabledReason}
            onClick={() => onRunInTerminal(`gh pr create --head ${branchName}`)}
          >
            <GitPullRequest /> Create pull request
          </Button>
        </div>
        {lastPushedAt && (
          <div className="fs-10 tx-30 mt-2 font-mono flex items-center gap-1">
            <RefreshCw size={10} />
            Pushed to origin/{branchName} {Math.round((Date.now() - lastPushedAt) / 1000)}s ago
          </div>
        )}

        {(() => {
          if (!hasRemote) return null;
          if (pushAccess === "read_only") {
            return (
              <div className="fs-10 mt-2 font-mono flex items-center gap-1" style={{ color: "var(--sem-amber)" }}>
                <CircleAlert size={10} />
                Remote is read-only (404 / no write access). Pushing disabled.
              </div>
            );
          }
          return null;
        })()}
      </Card>

      {/* Environment status card */}
      <SectionLabel>Environment</SectionLabel>
      <Card className="p-2">
        {[
          ["Git", environmentData?.git.version ?? "v2.44.0", "ok"],
          ["GitHub CLI", environmentData?.gitHub.version ?? "authenticated", "ok"],
          ["Remote", hasRemote ? (pushAccess === "read_only" ? "origin (read-only)" : "origin") : "none", hasRemote ? (pushAccess === "read_only" ? "warn" : "ok") : "warn"],
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

      {confirmMergeBranch && (
        <Dialog open onOpenChange={(open) => { if (!open) setConfirmMergeBranch(null); }}>
          <DialogPopup className="git-tool-v2 max-w-sm">
            <DialogHeader>
              <DialogTitle>Merge {confirmMergeBranch} into {branchName}</DialogTitle>
            </DialogHeader>
            <DialogPanel>
              <p className="fs-12 tx-60">
                This will merge commits from <strong>{confirmMergeBranch}</strong> into <strong>{branchName}</strong>.
              </p>
            </DialogPanel>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConfirmMergeBranch(null)}>Cancel</Button>
              <Button size="sm" onClick={() => void handleExecuteMergeWatched(confirmMergeBranch)}>Confirm merge</Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      )}

      {confirmRebaseBranch && (
        <Dialog open onOpenChange={(open) => { if (!open) setConfirmRebaseBranch(null); }}>
          <DialogPopup className="git-tool-v2 max-w-sm">
            <DialogHeader>
              <DialogTitle>Rebase {branchName} onto {confirmRebaseBranch}</DialogTitle>
            </DialogHeader>
            <DialogPanel>
              <p className="fs-12 tx-60">
                This will reapply your local commits on top of <strong>{confirmRebaseBranch}</strong>.
              </p>
            </DialogPanel>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConfirmRebaseBranch(null)}>Cancel</Button>
              <Button size="sm" onClick={() => void handleExecuteRebaseWatched(confirmRebaseBranch)}>Confirm rebase</Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      )}
    </div>
  );
}

