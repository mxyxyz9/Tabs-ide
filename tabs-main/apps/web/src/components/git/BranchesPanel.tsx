import type { GitBranch as GitBranchType } from "@tabs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { GitBranch as GitBranchIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";
import { invalidateGitQueries } from "../../lib/gitReactQuery";
import { readNativeApi } from "../../nativeApi";
import { toastManager } from "../ui/toast";
import { GitCheckingState } from "./GitCheckingState";
import { Badge, Banner, Btn, Card, InlineForm } from "./gitPrimitives";

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

  if (loadingBranches) {
    return <GitCheckingState message="Loading branches…" size={36} />;
  }

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
        {otherBranches.length === 0 ? (
          <div className="fs-11 tx-30 px-3 py-4 text-center">
            No other branches in this repository.
          </div>
        ) : (
          otherBranches.map((b) => (
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
