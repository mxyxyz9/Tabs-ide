import type {
  GitEnvironmentResult,
  GitHistoryCommit,
  GitListBranchesResult,
  GitStatusResult,
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
import {
  AutoTextarea,
  Badge,
  Banner,
  Btn,
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
  onGoToChanges,
  onGoToAccounts,
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
  const [forking, setForking] = useState(false);
  const [lastPushedAt, setLastPushedAt] = useState<number | null>(null);
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
          <Btn primary as="a" href="https://git-scm.com/downloads">
            Download Git
          </Btn>
          <Btn ghost onClick={() => onRunInTerminal("git --version")}>
            Check in terminal
          </Btn>
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
          <Btn primary icon={GitCommit} onClick={onInitRepo}>
            Initialize repository
          </Btn>
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
          <Btn primary icon={GitPullRequest} disabled={forking} onClick={() => void handleCreateFork()}>
            {forking ? "Forking…" : "Fork repository"}
          </Btn>
          <Btn ghost onClick={onGoToAccounts}>
            Check accounts
          </Btn>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Dynamic Repo State Banner */}
      {repoState.kind !== "clean_ready" && (
        <div
          className="w-full flex items-start gap-3 rounded-lg border px-4 py-3 mb-5"
          style={{
            borderColor:
              repoState.severity === "error"
                ? "var(--sem-red-border)"
                : repoState.severity === "warning"
                  ? "var(--sem-amber-border)"
                  : "var(--sem-sky-border)",
            backgroundColor:
              repoState.severity === "error"
                ? "var(--sem-red-soft)"
                : repoState.severity === "warning"
                  ? "var(--sem-amber-soft)"
                  : "var(--sem-sky-soft)",
          }}
        >
          {repoState.severity === "error" ? (
            <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: "var(--sem-red)" }} />
          ) : (
            <CircleAlert size={15} className="shrink-0 mt-0.5" style={{ color: "var(--sem-amber)" }} />
          )}
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span
              className="text-xs font-semibold"
              style={{
                color: repoState.severity === "error" ? "var(--sem-red)" : "var(--sem-amber)",
              }}
            >
              {repoState.title}
            </span>
            <span className="text-xs tx-50 leading-relaxed">
              {forking ? "Creating a fork on GitHub and adding local remote..." : repoState.description}
            </span>
            {repoState.primaryAction && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Btn
                  primary
                  sm
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
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Secondary Notices */}
      {repoState.secondaryNotices.map((notice) => (
        <Banner
          key={notice.id}
          tone={notice.severity === "warning" ? "warn" : "info"}
          title={notice.message}
          actions={
            notice.actionLabel && notice.actionType === "add_remote" ? (
              <Btn sm primary onClick={onOpenAddRemote}>
                {notice.actionLabel}
              </Btn>
            ) : notice.actionLabel && notice.actionType === "pull_merge" ? (
              <Btn sm primary icon={Download} onClick={() => onRunInTerminal("git pull")}>
                {notice.actionLabel}
              </Btn>
            ) : undefined
          }
        />
      ))}

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-3">
          <div className="fs-10 uppercase tracking-widest tx-30 mb-1">Branch</div>
          <div className="fs-12 font-mono tx-85 font-semibold truncate flex items-center gap-1.5">
            <Badge tone="default">{branchName}</Badge>
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
            <Btn
              primary
              icon={GitCommit}
              disabled={!stagedFiles.length || !repoState.canCommitLocally}
              title={!stagedFiles.length ? "Stage some changes first" : undefined}
              onClick={() => void handleCommit(false)}
            >
              {repoState.commitButtonLabel}
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
            disabled={!stagedFiles.length || !repoState.canCommitLocally || !repoState.canPush}
            title={repoState.pushDisabledReason ?? (!stagedFiles.length ? "Stage some changes first" : undefined)}
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
            <Btn
              icon={ArrowUp}
              disabled={!repoState.canPush}
              title={repoState.pushDisabledReason}
              onClick={() => onRunInTerminal(`git push origin ${branchName}`)}
            >
              Push
            </Btn>
            <Btn
              disabled={!repoState.canForcePush}
              title={repoState.pushDisabledReason}
              onClick={() => onRunInTerminal(`git push --force-with-lease origin ${branchName}`)}
            >
              Force push…
            </Btn>
            <Btn
              icon={ArrowDown}
              disabled={!repoState.canPull}
              onClick={() => onRunInTerminal(`git pull origin ${branchName}`)}
            >
              Pull
            </Btn>
          </div>
          <Btn
            icon={GitPullRequest}
            disabled={!repoState.canCreatePR}
            title={repoState.prDisabledReason}
            onClick={() => onRunInTerminal(`gh pr create --head ${branchName}`)}
          >
            Create pull request
          </Btn>
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
    </div>
  );
}
