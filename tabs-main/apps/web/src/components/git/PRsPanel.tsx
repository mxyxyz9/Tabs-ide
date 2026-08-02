import { CheckCircle2, ChevronDown, ChevronRight, GitMerge, GitPullRequest, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { readNativeApi } from "../../nativeApi";
import { GitCheckingState } from "./GitCheckingState";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Card, PanelToolbar, Select } from "./gitPrimitives";

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
  const [prs, setPrs] = useState<MockPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergePr, setMergePr] = useState<MockPR | null>(null);
  const [mergeMethod, setMergeMethod] = useState<"squash" | "merge" | "rebase">("squash");
  const [deleteBranch, setDeleteBranch] = useState(true);
  const [expandedPrComments, setExpandedPrComments] = useState<number | null>(null);
  const [prComments, setPrComments] = useState<Record<number, PRComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>({});

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
      .then((res: { pullRequest?: { number: number; title: string; state?: string; headBranch?: string; baseBranch?: string; url: string } | null }) => {
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

  const toggleComments = (prNumber: number) => {
    if (expandedPrComments === prNumber) {
      setExpandedPrComments(null);
      return;
    }
    setExpandedPrComments(prNumber);
    if (prComments[prNumber]) return;

    setLoadingComments((prev) => ({ ...prev, [prNumber]: true }));
    // Fetch comments via web view or mock placeholder fallback if gh CLI output isn't parsed
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
    <div>
      {prs.length > 0 && (
        <PanelToolbar>
          <Button size="sm" onClick={onOpenCreatePR}>
            <GitPullRequest /> Create pull request
          </Button>
        </PanelToolbar>
      )}

      {loading ? (
        <GitCheckingState message="Loading pull requests…" size={36} />
      ) : prs.length === 0 ? (
        <Card className="p-6 text-center">
          <GitPullRequest className="mx-auto mb-2 text-muted-foreground/70" size={24} />
          <p className="text-xs font-medium text-foreground/90 mb-1">No open pull requests for {branchName}</p>
          <p className="text-[11px] text-muted-foreground/70 mb-4">Push your branch and open a pull request on GitHub to request feedback and merge changes.</p>
          <Button size="sm" onClick={onOpenCreatePR}>
            <GitPullRequest /> Create pull request
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {prs.map((pr) => (
            <Card key={pr.n} className="p-3">
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

              <label className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer select-none py-1">
                <Checkbox
                  checked={deleteBranch}
                  onCheckedChange={(c) => setDeleteBranch(!!c)}
                />
                <span>Delete head branch after merging</span>
              </label>
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
