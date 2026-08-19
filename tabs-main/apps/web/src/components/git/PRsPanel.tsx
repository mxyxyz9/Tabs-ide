import { CheckCircle2, ChevronDown, ChevronRight, GitMerge, GitPullRequest, MessageSquare, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { gitAllPullRequestsQueryOptions, gitResolvePullRequestQueryOptions } from "../../lib/gitReactQuery";
import { GitCheckingState } from "./GitCheckingState";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Card, Select } from "./gitPrimitives";

interface MockPR {
  n: number;
  title: string;
  state: "open" | "draft" | "merged" | "closed";
  branch: string;
  body: string;
}

interface PRComment {
  author: string;
  body: string;
  createdAt?: string;
}

import { useProjectGitState } from "../../state/scopedStateStore";

export function PRsPanel({
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
  const [gitState, setGitState] = useProjectGitState(cwd);
  const viewMode = gitState.prViewMode;
  const setViewMode = useCallback(
    (mode: "branch" | "all") => {
      setGitState({ prViewMode: mode });
    },
    [setGitState],
  );

  const filterState = gitState.prFilter;
  const setFilterState = useCallback(
    (f: "all" | "open" | "merged" | "closed") => {
      setGitState({ prFilter: f });
    },
    [setGitState],
  );

  const [mergePr, setMergePr] = useState<MockPR | null>(null);
  const [mergeMethod, setMergeMethod] = useState<"squash" | "merge" | "rebase">("squash");
  const [deleteBranch, setDeleteBranch] = useState(true);

  const expandedPrComments = gitState.prExpandedComments;
  const setExpandedPrComments = useCallback(
    (n: number | null | ((prev: number | null) => number | null)) => {
      setGitState((prev) => ({
        prExpandedComments: typeof n === "function" ? n(prev.prExpandedComments) : n,
      }));
    },
    [setGitState],
  );
  const [prComments, setPrComments] = useState<Record<number, PRComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>({});

  // Query 1: Branch PR query
  const branchPrQuery = useQuery(
    gitResolvePullRequestQueryOptions({
      cwd: cwd || null,
      reference: branchName || null,
    }),
  );

  // Query 2: Repository PRs query (supports state filter for past merged/closed PRs)
  const allPrsQuery = useQuery(gitAllPullRequestsQueryOptions(cwd || null, filterState));

  const activeQuery = viewMode === "branch" ? branchPrQuery : allPrsQuery;
  const loading = activeQuery.isLoading;

  const prs = useMemo<MockPR[]>(() => {
    if (viewMode === "branch") {
      const pr = branchPrQuery.data?.pullRequest;
      if (!pr) return [];
      return [
        {
          n: pr.number,
          title: pr.title,
          state: (pr.state as "open" | "draft" | "merged" | "closed") || "open",
          branch: `${pr.headBranch ?? branchName} → ${pr.baseBranch ?? "main"}`,
          body: pr.url,
        },
      ];
    } else {
      const list = allPrsQuery.data?.pullRequests || [];
      return list.map((pr) => ({
        n: pr.number,
        title: pr.title,
        state: (pr.state as "open" | "draft" | "merged" | "closed") || "open",
        branch: `${pr.headBranch} → ${pr.baseBranch}`,
        body: pr.url,
      }));
    }
  }, [viewMode, branchPrQuery.data, allPrsQuery.data, branchName]);

  const toggleComments = (prNumber: number) => {
    if (expandedPrComments === prNumber) {
      setExpandedPrComments(null);
      return;
    }
    setExpandedPrComments(prNumber);
    if (prComments[prNumber]) return;

    setLoadingComments((prev) => ({ ...prev, [prNumber]: true }));
    setTimeout(() => {
      setPrComments((prev) => ({
        ...prev,
        [prNumber]: [
          { author: "github-actions[bot]", body: "All CI checks have passed successfully.", createdAt: "Just now" },
        ],
      }));
      setLoadingComments((prev) => ({ ...prev, [prNumber]: false }));
    }, 400);
  };

  const handleConfirmMerge = () => {
    if (!mergePr) return;
    const flag = mergeMethod === "squash" ? "--squash" : mergeMethod === "rebase" ? "--rebase" : "--merge";
    const delFlag = deleteBranch ? " --delete-branch" : "";
    onRunInTerminal(`gh pr merge ${mergePr.n} ${flag}${delFlag}`);
    setMergePr(null);
  };

  return (
    <div className="space-y-3">
      {/* Top Controls Toolbar: Segmented View Selector, State Filters & Create PR Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-3 rounded-xl border border-border/60">
        {/* Segmented Scope Control */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/40 border border-border/80 text-xs shrink-0 sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode("branch")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "branch"
                  ? "bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:bg-accent dark:border dark:border-primary dark:shadow-[0_0_15px_var(--color-primary)] dark:ring-0 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This branch ({branchName})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === "all"
                  ? "bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:bg-accent dark:border dark:border-primary dark:shadow-[0_0_15px_var(--color-primary)] dark:ring-0 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All repository PRs
            </button>
          </div>

          {/* State Filter Buttons (Active when viewing Repository PRs) */}
          {viewMode === "all" && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/20 border border-border/60 text-[11px]">
              {(["all", "open", "merged", "closed"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterState(st)}
                  className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                    filterState === st
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st === "all" ? "All history" : st}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button size="sm" onClick={onOpenCreatePR} className="gap-1.5 shrink-0 ml-auto">
          <Plus size={13} />
          <span>Create pull request</span>
        </Button>
      </div>

      {loading ? (
        <GitCheckingState message={viewMode === "branch" ? `Loading pull request for ${branchName}…` : `Loading repository pull requests (${filterState})…`} size={36} />
      ) : prs.length === 0 ? (
        <Card className="p-8 text-center bg-card/40 border-dashed">
          <GitPullRequest className="mx-auto mb-2 text-muted-foreground/70" size={28} />
          <p className="text-sm font-medium text-foreground mb-1">
            {viewMode === "branch" ? `No pull requests for ${branchName}` : `No ${filterState === "all" ? "" : filterState + " "}pull requests in this repository`}
          </p>
          <p className="text-xs text-muted-foreground/70 mb-4 max-w-sm mx-auto">
            {viewMode === "branch"
              ? "Push your branch and open a pull request on GitHub to request feedback and merge changes."
              : `There are currently no matching ${filterState === "all" ? "" : filterState + " "}pull requests in this repository.`}
          </p>
          <Button size="sm" onClick={onOpenCreatePR}>
            Create pull request
          </Button>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {prs.map((pr) => (
            <Card key={pr.n} className="p-3.5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <Badge variant={pr.state === "open" ? "success" : pr.state === "merged" ? "secondary" : pr.state === "closed" ? "destructive" : "outline"}>
                  #{pr.n} {pr.state}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground/90 truncate">{pr.title}</div>
                  <div className="text-[10px] font-mono text-muted-foreground/70 truncate">{pr.branch}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleComments(pr.n)}>
                    <MessageSquare />
                    {expandedPrComments === pr.n ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />} Comments
                  </Button>
                  {pr.state === "open" && (
                    <Button size="sm" onClick={() => setMergePr(pr)}>
                      <GitMerge /> Merge…
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onRunInTerminal(`gh pr view ${pr.n} --web`)}>
                    View on GitHub
                  </Button>
                </div>
              </div>

              {expandedPrComments === pr.n && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <div className="text-[11px] font-medium text-muted-foreground">Review Feedback & Comments</div>
                  {loadingComments[pr.n] ? (
                    <div className="text-[11px] text-muted-foreground/70 py-2">Fetching PR activity…</div>
                  ) : (prComments[pr.n] ?? []).length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/70 py-2">No review comments yet.</div>
                  ) : (
                    (prComments[pr.n] ?? []).map((c, i) => (
                      <div key={i} className="p-2.5 rounded border border-border/50 bg-muted/50 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">{c.author}</span>
                          <span className="text-[10px] text-muted-foreground/70">{c.createdAt}</span>
                        </div>
                        <p className="text-foreground/90">{c.body}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {mergePr && (
        <Dialog open onOpenChange={(open) => { if (!open) setMergePr(null); }}>
          <DialogPopup className="git-tool-v2 max-w-md">
            <DialogHeader>
              <DialogTitle>Merge Pull Request #{mergePr.n}</DialogTitle>
            </DialogHeader>
            <DialogPanel className="space-y-4">
              <p className="text-xs text-foreground/90">
                Are you sure you want to merge <strong>{mergePr.title}</strong> into base branch?
              </p>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Merge Strategy</label>
                <Select
                  value={mergeMethod}
                  onChange={(e) => setMergeMethod(e.target.value as "squash" | "merge" | "rebase")}
                >
                  <option value="squash">Squash and merge (recommended)</option>
                  <option value="merge">Create a merge commit</option>
                  <option value="rebase">Rebase and merge</option>
                </Select>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border/60 bg-muted/20 mt-2">
                <span className="text-xs text-foreground/90 font-medium">Delete head branch after merging</span>
                <Switch
                  checked={deleteBranch}
                  onCheckedChange={(c) => setDeleteBranch(!!c)}
                />
              </div>
            </DialogPanel>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setMergePr(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmMerge}>
                <CheckCircle2 /> Confirm Merge
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      )}
    </div>
  );
}
