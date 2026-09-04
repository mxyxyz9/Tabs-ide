import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitCommit,
  FileDiff,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { GitPullRequestAction } from "@tabs/contracts";

import {
  gitAllPullRequestsQueryOptions,
  gitResolvePullRequestQueryOptions,
} from "../../lib/gitReactQuery";
import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";
import { GitCheckingState } from "./GitCheckingState";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
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
import { useProjectGitState } from "../../state/scopedStateStore";
import { useGitApi, useGitScopeKey } from "./gitApiContext";

interface PullRequestRow {
  n: number;
  title: string;
  state: "open" | "draft" | "merged" | "closed";
  branch: string;
  url: string;
  provider?: "github" | "gitlab" | "azure-devops" | "bitbucket" | "unknown";
  isDraft: boolean;
  author: string | null;
  labels: ReadonlyArray<{ name: string; color?: string | undefined }>;
  reviewDecision?: "approved" | "changes_requested" | "review_required";
  mergeability?: "mergeable" | "conflicting" | "unknown";
  checksState?: "passing" | "failing" | "pending";
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}

function formatProviderName(provider: PullRequestRow["provider"]): string {
  switch (provider) {
    case "github":
      return "GitHub";
    case "gitlab":
      return "GitLab";
    case "azure-devops":
      return "Azure DevOps";
    case "bitbucket":
      return "Bitbucket";
    default:
      return "provider";
  }
}

function handleTabListKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role='tab']"));
  const currentIndex = tabs.indexOf(document.activeElement as HTMLElement);
  if (currentIndex < 0 || tabs.length === 0) return;
  event.preventDefault();
  const nextIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

export function PRsPanel({
  cwd,
  environmentId,
  branchName,
  onOpenCreatePR,
}: {
  cwd: string;
  environmentId?: string | undefined;
  branchName: string;
  onOpenCreatePR: () => void;
}) {
  const api = useGitApi();
  const [gitState, setGitState] = useProjectGitState(useGitScopeKey());
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

  const [mergePr, setMergePr] = useState<PullRequestRow | null>(null);
  const [mergeMethod, setMergeMethod] = useState<"squash" | "merge" | "rebase">("squash");
  const [deleteBranch, setDeleteBranch] = useState(true);
  const [expandedPrNumber, setExpandedPrNumber] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<
    "summary" | "code" | "checks" | "commits" | "activity"
  >("summary");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [actionBody, setActionBody] = useState("");
  const [reviewerInput, setReviewerInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(50);

  // Query 1: Branch PR query
  const branchPrQuery = useQuery(
    gitResolvePullRequestQueryOptions({
      cwd: cwd || null,
      reference: branchName || null,
      environmentId,
    }),
  );

  // Query 2: Repository PRs query (supports state filter for past merged/closed PRs)
  const allPrsQuery = useQuery(
    gitAllPullRequestsQueryOptions(cwd || null, filterState, environmentId, listLimit),
  );
  const detailQuery = useQuery(
    gitResolvePullRequestQueryOptions({
      cwd: cwd || null,
      reference: expandedPrNumber === null ? null : String(expandedPrNumber),
      environmentId,
    }),
  );

  const activeQuery = viewMode === "branch" ? branchPrQuery : allPrsQuery;
  const capabilities = activeQuery.data?.capabilities;
  const supportsAction = useCallback(
    (action: GitPullRequestAction) =>
      capabilities ? capabilities.actions.includes(action) : action !== "request_changes",
    [capabilities],
  );
  const loading = activeQuery.isLoading;

  const prs = useMemo<PullRequestRow[]>(() => {
    if (viewMode === "branch") {
      const pr = branchPrQuery.data?.pullRequest;
      if (!pr) return [];
      return [
        {
          n: pr.number,
          title: pr.title,
          state: (pr.state as "open" | "draft" | "merged" | "closed") || "open",
          branch: `${pr.headBranch ?? branchName} → ${pr.baseBranch ?? "main"}`,
          url: pr.url,
          ...(pr.provider ? { provider: pr.provider } : {}),
          isDraft: pr.isDraft ?? false,
          author: pr.author?.login ?? null,
          labels: pr.labels ?? [],
          ...(pr.reviewDecision ? { reviewDecision: pr.reviewDecision } : {}),
          ...(pr.mergeability ? { mergeability: pr.mergeability } : {}),
          ...(pr.checksState ? { checksState: pr.checksState } : {}),
          ...(pr.additions !== undefined ? { additions: pr.additions } : {}),
          ...(pr.deletions !== undefined ? { deletions: pr.deletions } : {}),
          ...(pr.changedFiles !== undefined ? { changedFiles: pr.changedFiles } : {}),
        },
      ];
    } else {
      const list = allPrsQuery.data?.pullRequests || [];
      return list.map((pr) => ({
        n: pr.number,
        title: pr.title,
        state: (pr.state as "open" | "draft" | "merged" | "closed") || "open",
        branch: `${pr.headBranch} → ${pr.baseBranch}`,
        url: pr.url,
        ...(pr.provider ? { provider: pr.provider } : {}),
        isDraft: pr.isDraft ?? false,
        author: pr.author?.login ?? null,
        labels: pr.labels ?? [],
        ...(pr.reviewDecision ? { reviewDecision: pr.reviewDecision } : {}),
        ...(pr.mergeability ? { mergeability: pr.mergeability } : {}),
        ...(pr.checksState ? { checksState: pr.checksState } : {}),
        ...(pr.additions !== undefined ? { additions: pr.additions } : {}),
        ...(pr.deletions !== undefined ? { deletions: pr.deletions } : {}),
        ...(pr.changedFiles !== undefined ? { changedFiles: pr.changedFiles } : {}),
      }));
    }
  }, [viewMode, branchPrQuery.data, allPrsQuery.data, branchName]);

  const mutatePullRequest = async (
    reference: number,
    action:
      | "merge"
      | "close"
      | "reopen"
      | "ready"
      | "draft"
      | "comment"
      | "approve"
      | "request_changes"
      | "add_reviewer"
      | "remove_reviewer"
      | "add_label"
      | "remove_label",
    body?: string,
    value?: string,
  ) => {
    if (!api) return false;
    setPendingAction(action);
    try {
      await api.git.mutatePullRequest({
        cwd,
        reference: String(reference),
        action,
        ...(action === "merge" ? { mergeMethod, deleteBranch } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(value !== undefined ? { value } : {}),
      });
      await Promise.all([branchPrQuery.refetch(), allPrsQuery.refetch(), detailQuery.refetch()]);
      toastManager.add({
        type: "success",
        title:
          action === "request_changes"
            ? "Changes requested"
            : `Pull request ${action.replaceAll("_", " ")} succeeded`,
      });
      return true;
    } catch (error) {
      toastManager.add({
        type: "error",
        title: `Pull request ${action.replaceAll("_", " ")} failed`,
        description: toGitUserFacingErrorMessage(error),
      });
      return false;
    } finally {
      setPendingAction(null);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergePr) return;
    if (await mutatePullRequest(mergePr.n, "merge")) setMergePr(null);
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
              aria-pressed={viewMode === "branch"}
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
              aria-pressed={viewMode === "all"}
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
                  aria-pressed={filterState === st}
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
        {capabilities?.create !== false ? (
          <Button size="sm" onClick={onOpenCreatePR} className="gap-1.5 shrink-0 ml-auto">
            <Plus size={13} />
            <span>Create pull request</span>
          </Button>
        ) : null}
      </div>

      {activeQuery.isError ? (
        <div role="alert">
          <Card className="border-destructive/40 bg-destructive/5 p-6 text-center">
            <GitPullRequest className="mx-auto mb-2 text-destructive" size={28} />
            <p className="text-sm font-medium text-foreground">Unable to load pull requests</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              {activeQuery.error instanceof Error
                ? activeQuery.error.message
                : "The pull-request provider returned an unknown error."}
            </p>
            <Button
              className="mt-4"
              size="sm"
              variant="outline"
              onClick={() => activeQuery.refetch()}
            >
              Retry
            </Button>
          </Card>
        </div>
      ) : loading ? (
        <GitCheckingState
          message={
            viewMode === "branch"
              ? `Loading pull request for ${branchName}…`
              : `Loading repository pull requests (${filterState})…`
          }
          size={36}
        />
      ) : prs.length === 0 ? (
        <Card className="p-8 text-center bg-card/40 border-dashed">
          <GitPullRequest className="mx-auto mb-2 text-muted-foreground/70" size={28} />
          <p className="text-sm font-medium text-foreground mb-1">
            {viewMode === "branch"
              ? `No pull requests for ${branchName}`
              : `No ${filterState === "all" ? "" : filterState + " "}pull requests in this repository`}
          </p>
          <p className="text-xs text-muted-foreground/70 mb-4 max-w-sm mx-auto">
            {viewMode === "branch"
              ? "Push your branch and open a pull request to request feedback and merge changes."
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
                <Badge
                  variant={
                    pr.state === "open"
                      ? "success"
                      : pr.state === "merged"
                        ? "secondary"
                        : pr.state === "closed"
                          ? "destructive"
                          : "outline"
                  }
                >
                  #{pr.n} {pr.state}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground/90 truncate">
                    {pr.title}{" "}
                    {pr.isDraft ? <span className="text-muted-foreground">(draft)</span> : null}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
                    {pr.branch}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    {pr.author ? <span>by @{pr.author}</span> : null}
                    {pr.checksState ? (
                      <Badge
                        variant={
                          pr.checksState === "passing"
                            ? "success"
                            : pr.checksState === "failing"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        Checks {pr.checksState}
                      </Badge>
                    ) : null}
                    {pr.reviewDecision ? (
                      <Badge variant="outline">{pr.reviewDecision.replaceAll("_", " ")}</Badge>
                    ) : null}
                    {pr.mergeability === "conflicting" ? (
                      <Badge variant="destructive">Conflicts</Badge>
                    ) : null}
                    {pr.changedFiles !== undefined ? <span>{pr.changedFiles} files</span> : null}
                    {pr.additions !== undefined ? (
                      <span className="text-emerald-600">+{pr.additions}</span>
                    ) : null}
                    {pr.deletions !== undefined ? (
                      <span className="text-red-600">−{pr.deletions}</span>
                    ) : null}
                    {pr.labels.slice(0, 3).map((label) => (
                      <Badge key={label.name} variant="secondary">
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={expandedPrNumber === pr.n}
                    onClick={() => {
                      setExpandedPrNumber((current) => (current === pr.n ? null : pr.n));
                      setDetailTab("summary");
                      setSelectedFilePath(null);
                    }}
                  >
                    {expandedPrNumber === pr.n ? <ChevronDown /> : <ChevronRight />}
                    Details
                  </Button>
                  {pr.state === "open" && !pr.isDraft && supportsAction("merge") && (
                    <Button
                      size="sm"
                      disabled={pr.mergeability === "conflicting" || pr.checksState === "failing"}
                      title={
                        pr.mergeability === "conflicting"
                          ? "Resolve merge conflicts before merging"
                          : pr.checksState === "failing"
                            ? "Fix failing checks before merging"
                            : undefined
                      }
                      onClick={() => {
                        const methods = capabilities?.mergeMethods ?? ["squash", "merge", "rebase"];
                        if (!methods.includes(mergeMethod)) {
                          setMergeMethod(methods[0] ?? "squash");
                        }
                        setMergePr(pr);
                      }}
                    >
                      <GitMerge /> Merge…
                    </Button>
                  )}
                  {pr.state === "open" && supportsAction("close") ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pendingAction !== null}
                      onClick={() => void mutatePullRequest(pr.n, "close")}
                    >
                      Close
                    </Button>
                  ) : pr.state === "closed" && supportsAction("reopen") ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pendingAction !== null}
                      onClick={() => void mutatePullRequest(pr.n, "reopen")}
                    >
                      Reopen
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void api?.shell.openExternal(pr.url).catch((error) => {
                        toastManager.add({
                          type: "error",
                          title: "Unable to open pull request",
                          description: toGitUserFacingErrorMessage(error),
                        });
                      });
                    }}
                  >
                    Open{pr.provider ? ` on ${formatProviderName(pr.provider)}` : " pull request"}
                  </Button>
                </div>
              </div>
              {expandedPrNumber === pr.n ? (
                <div className="mt-3 border-t border-border/60 pt-3">
                  {detailQuery.isLoading ? (
                    <GitCheckingState message={`Loading pull request #${pr.n}…`} size={24} />
                  ) : detailQuery.isError ? (
                    <div role="alert" className="rounded-lg border border-destructive/40 p-3">
                      <p className="text-xs text-destructive">
                        {detailQuery.error instanceof Error
                          ? detailQuery.error.message
                          : "Unable to load pull-request details."}
                      </p>
                      <Button
                        className="mt-2"
                        variant="outline"
                        size="sm"
                        onClick={() => detailQuery.refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : detailQuery.data?.pullRequest ? (
                    <div className="space-y-3">
                      <div
                        role="tablist"
                        aria-label={`Pull request #${pr.n} details`}
                        onKeyDown={handleTabListKeyDown}
                        className="flex flex-wrap gap-1"
                      >
                        {(
                          [
                            ["summary", "Summary", GitPullRequest],
                            ["code", "Code", FileDiff],
                            ["checks", "Checks", CheckCircle2],
                            ["commits", "Commits", GitCommit],
                            ["activity", "Activity", MessageSquare],
                          ] as const
                        ).map(([id, label, Icon]) => (
                          <Button
                            key={id}
                            id={`pr-${pr.n}-${id}-tab`}
                            role="tab"
                            aria-controls={`pr-${pr.n}-detail-panel`}
                            aria-selected={detailTab === id}
                            tabIndex={detailTab === id ? 0 : -1}
                            variant={detailTab === id ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setDetailTab(id)}
                          >
                            <Icon /> {label}
                          </Button>
                        ))}
                      </div>
                      <div
                        id={`pr-${pr.n}-detail-panel`}
                        role="tabpanel"
                        aria-labelledby={`pr-${pr.n}-${detailTab}-tab`}
                        tabIndex={0}
                        className="rounded-lg bg-muted/20 p-3 text-xs"
                      >
                        {detailTab === "summary" ? (
                          <div className="space-y-2">
                            {detailQuery.data.pullRequest.state === "open" &&
                            supportsAction(
                              detailQuery.data.pullRequest.isDraft ? "ready" : "draft",
                            ) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  void mutatePullRequest(
                                    pr.n,
                                    detailQuery.data.pullRequest.isDraft ? "ready" : "draft",
                                  )
                                }
                              >
                                {detailQuery.data.pullRequest.isDraft
                                  ? "Mark ready for review"
                                  : "Convert to draft"}
                              </Button>
                            ) : null}
                            {detailQuery.data.pullRequest.body ? (
                              <p className="whitespace-pre-wrap text-foreground/90">
                                {detailQuery.data.pullRequest.body}
                              </p>
                            ) : (
                              <p className="text-muted-foreground">No description provided.</p>
                            )}
                            {(detailQuery.data.pullRequest.reviewers ?? []).length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-muted-foreground">Reviewers:</span>
                                {detailQuery.data.pullRequest.reviewers?.map((reviewer) => (
                                  <Button
                                    key={reviewer.login}
                                    size="sm"
                                    variant="ghost"
                                    disabled={
                                      pendingAction !== null || !supportsAction("remove_reviewer")
                                    }
                                    aria-label={`Remove reviewer ${reviewer.login}`}
                                    onClick={() =>
                                      void mutatePullRequest(
                                        pr.n,
                                        "remove_reviewer",
                                        undefined,
                                        reviewer.login,
                                      )
                                    }
                                  >
                                    @{reviewer.login} ×
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                            {detailQuery.data.pullRequest.state === "open" ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                <form
                                  hidden={!supportsAction("add_reviewer")}
                                  className="flex gap-1"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const value = reviewerInput.trim().replace(/^@/, "");
                                    if (!value) return;
                                    void mutatePullRequest(
                                      pr.n,
                                      "add_reviewer",
                                      undefined,
                                      value,
                                    ).then((ok) => {
                                      if (ok) setReviewerInput("");
                                    });
                                  }}
                                >
                                  <input
                                    value={reviewerInput}
                                    onChange={(event) => setReviewerInput(event.target.value)}
                                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2"
                                    aria-label="Reviewer login"
                                    placeholder="Reviewer login"
                                  />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!reviewerInput.trim() || pendingAction !== null}
                                  >
                                    Add
                                  </Button>
                                </form>
                                <form
                                  hidden={!supportsAction("add_label")}
                                  className="flex gap-1"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const value = labelInput.trim();
                                    if (!value) return;
                                    void mutatePullRequest(
                                      pr.n,
                                      "add_label",
                                      undefined,
                                      value,
                                    ).then((ok) => {
                                      if (ok) setLabelInput("");
                                    });
                                  }}
                                >
                                  <input
                                    value={labelInput}
                                    onChange={(event) => setLabelInput(event.target.value)}
                                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2"
                                    aria-label="Label name"
                                    placeholder="Label name"
                                  />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!labelInput.trim() || pendingAction !== null}
                                  >
                                    Add
                                  </Button>
                                </form>
                              </div>
                            ) : null}
                            {(detailQuery.data.pullRequest.labels ?? []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {detailQuery.data.pullRequest.labels?.map((label) => (
                                  <Button
                                    key={label.name}
                                    size="sm"
                                    variant="secondary"
                                    disabled={
                                      pendingAction !== null || !supportsAction("remove_label")
                                    }
                                    aria-label={`Remove label ${label.name}`}
                                    onClick={() =>
                                      void mutatePullRequest(
                                        pr.n,
                                        "remove_label",
                                        undefined,
                                        label.name,
                                      )
                                    }
                                  >
                                    {label.name} ×
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : detailTab === "code" ? (
                          (() => {
                            const files = detailQuery.data.pullRequest.files ?? [];
                            const selectedFile =
                              files.find((file) => file.path === selectedFilePath) ?? files[0];
                            if (!selectedFile) {
                              return (
                                <p className="text-muted-foreground">
                                  This provider did not report any changed files.
                                </p>
                              );
                            }
                            return (
                              <div className="grid min-h-72 gap-3 md:grid-cols-[minmax(12rem,0.32fr)_minmax(0,1fr)]">
                                <div
                                  className="max-h-96 overflow-auto rounded-md border border-border/70 bg-background"
                                  aria-label="Changed files"
                                >
                                  {files.map((file) => (
                                    <button
                                      key={file.path}
                                      type="button"
                                      aria-current={
                                        selectedFile.path === file.path ? "true" : undefined
                                      }
                                      className={`flex w-full items-start justify-between gap-2 border-b border-border/50 px-2.5 py-2 text-left last:border-b-0 ${
                                        selectedFile.path === file.path
                                          ? "bg-accent text-accent-foreground"
                                          : "hover:bg-muted/40"
                                      }`}
                                      onClick={() => setSelectedFilePath(file.path)}
                                    >
                                      <span className="min-w-0 break-all font-mono text-[11px]">
                                        {file.path}
                                      </span>
                                      <span className="shrink-0 text-[10px] text-muted-foreground">
                                        <span className="text-emerald-600">+{file.additions}</span>{" "}
                                        <span className="text-red-600">−{file.deletions}</span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                                <div className="min-w-0 overflow-hidden rounded-md border border-border/70 bg-background">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                                    <span className="break-all font-mono text-[11px] font-medium">
                                      {selectedFile.path}
                                    </span>
                                    <Badge variant="outline">{selectedFile.status}</Badge>
                                  </div>
                                  {selectedFile.patch === null ? (
                                    <p className="p-4 text-muted-foreground">
                                      No textual patch is available. The file may be binary or the
                                      provider may have omitted a very large patch.
                                    </p>
                                  ) : (
                                    <pre
                                      tabIndex={0}
                                      aria-label={`Patch for ${selectedFile.path}`}
                                      className="max-h-96 overflow-auto p-3 font-mono text-[11px] leading-5"
                                    >
                                      {selectedFile.patch}
                                    </pre>
                                  )}
                                  {selectedFile.patchTruncated ? (
                                    <p
                                      role="status"
                                      className="border-t border-border/60 px-3 py-2 text-amber-700 dark:text-amber-400"
                                    >
                                      This patch was truncated to keep the review responsive. Open
                                      the pull request on the provider for the complete diff.
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()
                        ) : detailTab === "checks" ? (
                          <div className="space-y-1.5">
                            {(detailQuery.data.pullRequest.checks ?? []).length > 0 ? (
                              detailQuery.data.pullRequest.checks?.map((check) => (
                                <div
                                  key={`${check.workflowName ?? ""}:${check.name}`}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span>
                                    {check.workflowName ? `${check.workflowName} / ` : ""}
                                    {check.name}
                                  </span>
                                  <Badge variant="outline">
                                    {check.conclusion ?? check.status.replaceAll("_", " ")}
                                  </Badge>
                                </div>
                              ))
                            ) : (
                              <p className="text-muted-foreground">No checks reported.</p>
                            )}
                          </div>
                        ) : detailTab === "commits" ? (
                          <div className="space-y-2">
                            {(detailQuery.data.pullRequest.commits ?? []).length > 0 ? (
                              detailQuery.data.pullRequest.commits?.map((commit) => (
                                <div key={commit.sha} className="flex items-start gap-2">
                                  <code className="text-muted-foreground">
                                    {commit.sha.slice(0, 7)}
                                  </code>
                                  <span>{commit.subject}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-muted-foreground">No commits reported.</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(detailQuery.data.pullRequest.reviews ?? []).map((review) => (
                              <div key={review.id}>
                                <p className="font-medium">
                                  {review.author ? `@${review.author.login}` : "Unknown reviewer"} ·{" "}
                                  {review.state.toLowerCase().replaceAll("_", " ")}
                                </p>
                                {review.body ? (
                                  <p className="mt-1 whitespace-pre-wrap">{review.body}</p>
                                ) : null}
                              </div>
                            ))}
                            {(detailQuery.data.pullRequest.comments ?? []).map((comment) => (
                              <div key={comment.id}>
                                <p className="font-medium">
                                  {comment.author ? `@${comment.author.login}` : "Unknown author"}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
                              </div>
                            ))}
                            {(detailQuery.data.pullRequest.reviews ?? []).length === 0 &&
                            (detailQuery.data.pullRequest.comments ?? []).length === 0 ? (
                              <p className="text-muted-foreground">No review activity reported.</p>
                            ) : null}
                            {detailQuery.data.pullRequest.state === "open" ? (
                              <div className="space-y-2 border-t border-border/60 pt-3">
                                <label
                                  className="block text-[11px] font-medium"
                                  htmlFor={`pr-action-${pr.n}`}
                                >
                                  Add review feedback
                                </label>
                                <textarea
                                  id={`pr-action-${pr.n}`}
                                  value={actionBody}
                                  onChange={(event) => setActionBody(event.target.value)}
                                  className="min-h-20 w-full rounded-lg border border-border bg-background p-2 text-xs"
                                  placeholder="Write a comment or review…"
                                />
                                <div className="flex flex-wrap gap-2">
                                  {supportsAction("comment") ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!actionBody.trim() || pendingAction !== null}
                                      onClick={async () => {
                                        if (
                                          await mutatePullRequest(
                                            pr.n,
                                            "comment",
                                            actionBody.trim(),
                                          )
                                        ) {
                                          setActionBody("");
                                        }
                                      }}
                                    >
                                      Comment
                                    </Button>
                                  ) : null}
                                  {supportsAction("approve") ? (
                                    <Button
                                      size="sm"
                                      disabled={pendingAction !== null}
                                      onClick={async () => {
                                        if (
                                          await mutatePullRequest(
                                            pr.n,
                                            "approve",
                                            actionBody.trim(),
                                          )
                                        ) {
                                          setActionBody("");
                                        }
                                      }}
                                    >
                                      Approve
                                    </Button>
                                  ) : null}
                                  {supportsAction("request_changes") ? (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={!actionBody.trim() || pendingAction !== null}
                                      onClick={async () => {
                                        if (
                                          await mutatePullRequest(
                                            pr.n,
                                            "request_changes",
                                            actionBody.trim(),
                                          )
                                        ) {
                                          setActionBody("");
                                        }
                                      }}
                                    >
                                      Request changes
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
          {viewMode === "all" && allPrsQuery.data?.hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={allPrsQuery.isFetching || listLimit >= 200}
                onClick={() => setListLimit((current) => Math.min(200, current + 50))}
              >
                {allPrsQuery.isFetching ? "Loading more…" : "Load 50 more pull requests"}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {mergePr && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setMergePr(null);
          }}
        >
          <DialogPopup className="git-tool-v2 max-w-md">
            <DialogHeader>
              <DialogTitle>Merge Pull Request #{mergePr.n}</DialogTitle>
            </DialogHeader>
            <DialogPanel className="space-y-4">
              <p className="text-xs text-foreground/90">
                Are you sure you want to merge <strong>{mergePr.title}</strong> into base branch?
              </p>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Merge Strategy
                </label>
                <Select
                  value={mergeMethod}
                  onChange={(e) => setMergeMethod(e.target.value as "squash" | "merge" | "rebase")}
                >
                  {(capabilities?.mergeMethods ?? ["squash", "merge", "rebase"]).map((method) => (
                    <option key={method} value={method}>
                      {method === "squash"
                        ? "Squash and merge (recommended)"
                        : method === "merge"
                          ? "Create a merge commit"
                          : "Rebase and merge"}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-border/60 bg-muted/20 mt-2">
                <span className="text-xs text-foreground/90 font-medium">
                  Delete head branch after merging
                </span>
                <Switch checked={deleteBranch} onCheckedChange={(c) => setDeleteBranch(!!c)} />
              </div>
            </DialogPanel>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setMergePr(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pendingAction !== null}
                onClick={() => void handleConfirmMerge()}
              >
                <CheckCircle2 /> Confirm Merge
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      )}
    </div>
  );
}
