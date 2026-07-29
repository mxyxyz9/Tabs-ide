import type { GitBranch as GitBranchType } from "@tabs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, GitBranch as GitBranchIcon, GitMerge, GitPullRequest } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";
import { invalidateGitQueries } from "../../lib/gitReactQuery";
import { readNativeApi } from "../../nativeApi";
import { toastManager } from "../ui/toast";
import { GitCheckingState } from "./GitCheckingState";
import { Badge, Banner, Btn, Card, InlineForm, Modal, PanelToolbar } from "./gitPrimitives";

export function BranchesPanel({
  cwd,
  activeBranch,
  allBranches,
  aheadCount,
  behindCount,
  isDetached,
  loadingBranches,
  onOpenNewBranch,
  onOpenNewWorktree,
  onGoToChanges,
}: {
  cwd: string;
  activeBranch: GitBranchType | null;
  allBranches: ReadonlyArray<GitBranchType>;
  aheadCount: number;
  behindCount: number;
  isDetached: boolean;
  loadingBranches?: boolean;
  onOpenNewBranch: () => void;
  onOpenNewWorktree: () => void;
  onGoToChanges?: () => void;
}) {
  const [form, setForm] = useState<"new" | "rename" | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: "merge" | "rebase"; targetBranch: string } | null>(null);
  const [conflictState, setConflictState] = useState<{ active: boolean; message: string }>({ active: false, message: "" });
  const api = readNativeApi();
  const queryClient = useQueryClient();

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
        setConflictState({ active: false, message: "" });
        toastManager.add({ type: "success", title: `Merged ${name} into current branch` });
      } catch (error) {
        const errMsg = toGitUserFacingErrorMessage(error);
        if (errMsg.toLowerCase().includes("conflict")) {
          setConflictState({ active: true, message: `Merge conflict while merging ${name}.` });
        }
        toastManager.add({ type: "error", title: "Merge failed", description: errMsg });
      }
    },
    [api, cwd, queryClient],
  );

  const rebaseBranch = useCallback(
    async (name: string) => {
      if (!api) return;
      try {
        await api.git.rebase({ cwd, branch: name });
        await invalidateGitQueries(queryClient);
        setConflictState({ active: false, message: "" });
        toastManager.add({ type: "success", title: `Rebased current branch onto ${name}` });
      } catch (error) {
        const errMsg = toGitUserFacingErrorMessage(error);
        if (errMsg.toLowerCase().includes("conflict")) {
          setConflictState({ active: true, message: `Rebase conflict while rebasing onto ${name}.` });
        }
        toastManager.add({ type: "error", title: "Rebase failed", description: errMsg });
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

  if (loadingBranches) {
    return <GitCheckingState message="Loading branches…" size={36} />;
  }

  return (
    <div>
      {form === null && (
        <PanelToolbar>
          <Btn primary onClick={() => setForm("new")}>
            New branch
          </Btn>
          <Btn ghost onClick={onOpenNewWorktree}>
            New worktree
          </Btn>
        </PanelToolbar>
      )}

      {conflictState.active && (
        <Banner
          tone="bad"
          title="Merge / Rebase Conflict Detected"
          body={conflictState.message}
          actions={
            onGoToChanges && (
              <Btn sm primary onClick={onGoToChanges}>
                Resolve in Changes
              </Btn>
            )
          }
        />
      )}
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
        {otherBranches.length === 0 ? (
          <div className="fs-11 tx-30 px-3 py-4 text-center">
            No other branches in this repository.
          </div>
        ) : (
          otherBranches.map((b) => (
            <div key={b.name} className="flex items-center gap-2.5 px-2 py-2 border-b bd-1 last:border-0">
              <span className="text-xs font-mono tx-70 flex-1 truncate">{b.name}</span>
              <Badge tone="muted">{b.isRemote ? "remote" : "local"}</Badge>
              <Btn sm ghost onClick={() => setConfirmModal({ type: "merge", targetBranch: b.name })}>
                Merge into current
              </Btn>
              <Btn sm ghost onClick={() => setConfirmModal({ type: "rebase", targetBranch: b.name })}>
                Rebase onto…
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
          ))
        )}
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

      {confirmModal && (
        <Modal
          title={confirmModal.type === "merge" ? `Merge ${confirmModal.targetBranch}` : `Rebase onto ${confirmModal.targetBranch}`}
          onClose={() => setConfirmModal(null)}
        >
          <div className="space-y-4">
            <p className="fs-12 tx-70">
              {confirmModal.type === "merge"
                ? `Are you sure you want to merge '${confirmModal.targetBranch}' into '${activeBranch?.name}'?`
                : `Are you sure you want to rebase '${activeBranch?.name}' onto '${confirmModal.targetBranch}'?`}
            </p>
            <p className="fs-11 tx-40">
              This operation modifies the current working tree and commit history. If conflicts occur, you can resolve them in the Changes panel.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t bd-1">
              <Btn ghost onClick={() => setConfirmModal(null)}>
                Cancel
              </Btn>
              <Btn
                primary
                onClick={() => {
                  const { type, targetBranch } = confirmModal;
                  setConfirmModal(null);
                  if (type === "merge") {
                    void mergeBranch(targetBranch);
                  } else {
                    void rebaseBranch(targetBranch);
                  }
                }}
              >
                Confirm {confirmModal.type === "merge" ? "Merge" : "Rebase"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
