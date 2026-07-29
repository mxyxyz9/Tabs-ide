import type { GitHistoryCommit, ThreadId } from "@tabs/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./git/GitToolV2.css";

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
import { AccountsPanel } from "./git/AccountsPanel";
import { BranchesPanel } from "./git/BranchesPanel";
import { ChangesPanel } from "./git/ChangesPanel";
import { DiffPage } from "./git/DiffPage";
import { GitCheckingState } from "./git/GitCheckingState";
import { GitEnvironmentGate } from "./git/GitEnvironmentGate";
import { PanelErrorBoundary } from "./git/PanelErrorBoundary";

import { HistoryPanel } from "./git/HistoryPanel";
import { OverviewPanel } from "./git/OverviewPanel";
import { PRsPanel } from "./git/PRsPanel";
import { SettingsPanel } from "./git/SettingsPanel";
import { Sidebar, type NavPanel } from "./git/Sidebar";
import { StashesPanel } from "./git/StashesPanel";
import { TagsPanel } from "./git/TagsPanel";
import { TopBar } from "./git/TopBar";
import {
  AddRemoteModal,
  CreatePRModal,
  DeviceAuthModal,
  DiscardAllModal,
  DraftReleaseModal,
  ForcePushModal,
  NewWorktreeModal,
  PullSourceModal,
  ResetModal,
  StashModal,
} from "./git/gitModals";
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

/* ============================== Main GitToolV2 ============================== */

/* ============================== OverviewPanel & ChangesPanel moved to ./git/ ============================== */



/* ============================== DiffPage moved to ./git/DiffPage ============================== */

/* ============================== BranchesPanel moved to ./git/BranchesPanel ============================== */

/* ============================== CommitRow & HistoryPanel moved to ./git/HistoryPanel ============================== */

/* ============================== PRsPanel moved to ./git/PRsPanel ============================== */

/* ============================== TagsPanel & StashesPanel moved to ./git/ ============================== */

/* ============================== AccountsPanel & SettingsPanel moved to ./git/ ============================== */

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

  const lastPanelPerCwd = useRef<Record<string, NavPanel>>({});
  const [panel, setPanelState] = useState<NavPanel>(() => lastPanelPerCwd.current[cwd] || "overview");

  useEffect(() => {
    setPanelState(lastPanelPerCwd.current[cwd] || "overview");
  }, [cwd]);

  const setPanel = useCallback(
    (p: NavPanel) => {
      lastPanelPerCwd.current[cwd] = p;
      setPanelState(p);
    },
    [cwd],
  );

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

  const systemActiveLogin = accounts.find((a) => a.active)?.login ?? null;
  const isCredentialMismatch =
    Boolean(activeAccountLogin) &&
    Boolean(systemActiveLogin) &&
    activeAccountLogin !== systemActiveLogin;

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

  const renderPanel = () => {
    let content: React.ReactNode = null;
    switch (panel) {
      case "overview":
        content = (
          <OverviewPanel
            cwd={cwd}
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
        break;
      case "changes":
        content = (
          <ChangesPanel
            cwd={cwd}
            statusData={statusData}
            onOpenDiff={() => setPanel("diff")}
            onOpenStash={() => setModal("stash")}
            onOpenDiscardAll={() => setModal("discardAll")}
            onRunInTerminal={onRunInTerminal}
          />
        );
        break;
      case "diff":
        content = <DiffPage cwd={cwd} statusData={statusData} commits={commits} />;
        break;
      case "branches":
        content = (
          <BranchesPanel
            cwd={cwd}
            activeBranch={activeBranch}
            allBranches={allBranches}
            aheadCount={aheadCount}
            behindCount={behindCount}
            isDetached={!activeBranch}
            loadingBranches={branchesQuery.isLoading}
            onOpenNewBranch={() => setModal("newWorktree")}
            onOpenNewWorktree={() => setModal("newWorktree")}
          />
        );
        break;
      case "history":
        content = (
          <HistoryPanel
            cwd={cwd}
            commits={commits}
            loadingHistory={historyQuery.isLoading}
            onReset={(c) => setModal({ kind: "reset", commit: c })}
            onRevert={(c) => onRunInTerminal(`git revert ${c.sha}`)}
            onCherryPick={(c) => onRunInTerminal(`git cherry-pick ${c.sha}`)}
          />
        );
        break;
      case "prs":
        content = <PRsPanel cwd={cwd} branchName={branchName} onOpenCreatePR={() => setModal("createPR")} onRunInTerminal={onRunInTerminal} />;
        break;
      case "tags":
        content = (
          <TagsPanel
            cwd={cwd}
            commits={commits}
            pushAccess={branchesQuery.data?.pushAccess}
            onOpenDraftRelease={() => setModal("draftRelease")}
            onRunInTerminal={onRunInTerminal}
          />
        );
        break;
      case "stashes":
        content = (
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
        break;
      case "accounts":
        content = (
          <AccountsPanel
            accounts={accounts}
            activeAccountLogin={activeAccountLogin}
            repoName={repoName}
            credentialMismatch={isCredentialMismatch}
            onOpenConnectAccount={() => setModal("deviceAuth")}
            onSwitchAccount={switchAccount}
            onRemoveAccount={removeAccount}
          />
        );
        break;
      case "settings":
        content = (
          <SettingsPanel
            cwd={cwd}
            environmentData={environmentData}
            onOpenAddRemote={() => setModal("addRemote")}
            onRunInTerminal={onRunInTerminal}
          />
        );
        break;
    }

    return <PanelErrorBoundary key={panel} panelName={panel}>{content}</PanelErrorBoundary>;
  };


  const hasOriginRemote = branchList?.hasOriginRemote ?? false;
  const currentPushAccess = branchList?.pushAccess ?? "unknown";
  const isGhAuthed = environmentData?.gitHub.authenticated ?? false;
  const isPushAccessPending = hasOriginRemote && isGhAuthed && currentPushAccess === "unknown";
  const isRepoFolder = branchList?.isRepo ?? true;
  const isHistoryPending = isRepoFolder && (historyQuery.isLoading || !historyQuery.data);

  return (
    <GitEnvironmentGate
      key={cwd}
      environment={environmentData ?? undefined}
      isRepo={branchList?.isRepo}
      isLoading={
        gitEnvironmentQuery.isLoading ||
        branchesQuery.isLoading ||
        gitStatusQuery.isLoading ||
        isHistoryPending ||
        isPushAccessPending
      }
      initPending={gitInitMutation.isPending}
      onInitRepo={() => void gitInitMutation.mutateAsync()}
    >
      <div className="git-tool-v2 flex h-full min-h-0 overflow-hidden" style={{ backgroundColor: "var(--bg-base)", color: "var(--fg)" }}>


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
            <div className="w-full max-w-[1400px] mx-auto">{renderPanel()}</div>
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
          onCreate={async (pr) => {
            // Security: never interpolate user-controlled title/body directly into a shell
            // string — the terminal writes verbatim to a PTY and shell metacharacters
            // (quotes, backticks, $(...), ;) would be executed.
            //
            // Body: written to .git/GITUI_PR_BODY and passed via --body-file so the
            // content never touches the shell at all.
            //
            // Title: single-quote escaped (replace every ' with '\''). Single-quoted
            // strings in POSIX shells treat every character literally except `'` itself.
            const safeTitle = pr.title.replace(/'/g, `'\''`);
            const bodyFilePath = ".git/GITUI_PR_BODY";
            try {
              await api?.projects.writeFile({ cwd, relativePath: bodyFilePath, contents: pr.body });
            } catch {
              toastManager.add({ type: "error", title: "Could not prepare PR body", description: "Failed to write body to temp file." });
              return;
            }
            onRunInTerminal(
              `gh pr create --title '${safeTitle}' --base '${pr.base}' --body-file ${bodyFilePath}${pr.draft ? " --draft" : ""}; rm -f ${bodyFilePath}`
            );
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
