import type {
  GitActionProgressEvent,
  GitListBranchesResult,
  GitStackedAction,
  GitStatusFile,
  GitStatusResult,
  ThreadId,
} from "@tabs/contracts";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { CloudUploadIcon, GitCommitIcon } from "lucide-react";

import { openInPreferredEditor } from "../editorPreferences";
import {
  gitInitMutationOptions,
  gitMutationKeys,
  gitRunStackedActionMutationOptions,
  invalidateGitQueries,
} from "../lib/gitReactQuery";
import { cn, randomUUID } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { resolvePathLinkTarget } from "../terminal-links";
import { GitHubIcon } from "./Icons";
import {
  buildGitActionProgressStages,
  type DefaultBranchConfirmableAction,
  requiresDefaultBranchConfirmation,
  resolveDefaultBranchActionDialogCopy,
  summarizeGitResult,
} from "./GitActionsControl.logic";
import { buildGitCommitComposerState } from "./GitCommitComposer.logic";
import { getGitWorkspaceLayoutSection } from "./GitToolLayout.logic";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Textarea } from "./ui/textarea";
import { toastManager } from "./ui/toast";

interface GitCommitComposerProps {
  gitCwd: string | null;
  activeThreadId: ThreadId | null;
  gitStatus: GitStatusResult | null;
  branchList: GitListBranchesResult | null;
  stagedFiles: ReadonlyArray<GitStatusFile>;
  externalBusy?: boolean;
}

interface PendingDefaultBranchAction {
  action: DefaultBranchConfirmableAction;
  branchName: string;
  includesCommit: boolean;
  commitMessage?: string;
  forcePushOnlyProgress: boolean;
  filePaths?: string[];
}

type GitActionToastId = ReturnType<typeof toastManager.add>;

interface ActiveGitActionProgress {
  toastId: GitActionToastId;
  actionId: string;
  title: string;
  phaseStartedAtMs: number | null;
  hookStartedAtMs: number | null;
  hookName: string | null;
  lastOutputLine: string | null;
  currentPhaseLabel: string | null;
}

function formatElapsedDescription(startedAtMs: number | null): string | undefined {
  if (startedAtMs === null) {
    return undefined;
  }
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  if (elapsedSeconds < 60) {
    return `Running for ${elapsedSeconds}s`;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `Running for ${minutes}m ${seconds}s`;
}

function resolveProgressDescription(progress: ActiveGitActionProgress): string | undefined {
  if (progress.lastOutputLine) {
    return progress.lastOutputLine;
  }
  return formatElapsedDescription(progress.hookStartedAtMs ?? progress.phaseStartedAtMs);
}

function GitComposerActionIcon(props: {
  actionId: "commit" | "commit_push" | "commit_push_pr" | "open_pr";
}) {
  const className = "size-3.5";
  if (props.actionId === "commit") return <GitCommitIcon className={className} />;
  if (props.actionId === "open_pr" || props.actionId === "commit_push_pr") {
    return <GitHubIcon className={className} />;
  }
  return <CloudUploadIcon className={className} />;
}

export default function GitCommitComposer(props: GitCommitComposerProps) {
  const { gitCwd, activeThreadId, gitStatus, branchList, stagedFiles, externalBusy = false } = props;
  const composerSection = getGitWorkspaceLayoutSection("composer");
  const threadToastData = useMemo(
    () => (activeThreadId ? { threadId: activeThreadId } : undefined),
    [activeThreadId],
  );
  const queryClient = useQueryClient();
  const [commitMessage, setCommitMessage] = useState("");
  const [pendingDefaultBranchAction, setPendingDefaultBranchAction] =
    useState<PendingDefaultBranchAction | null>(null);
  const activeGitActionProgressRef = useRef<ActiveGitActionProgress | null>(null);

  const updateActiveProgressToast = useCallback(() => {
    const progress = activeGitActionProgressRef.current;
    if (!progress) return;
    toastManager.update(progress.toastId, {
      type: "loading",
      title: progress.title,
      description: resolveProgressDescription(progress),
      timeout: 0,
      data: threadToastData,
    });
  }, [threadToastData]);

  const initMutation = useMutation(gitInitMutationOptions({ cwd: gitCwd, queryClient }));
  const runImmediateGitActionMutation = useMutation(
    gitRunStackedActionMutationOptions({
      cwd: gitCwd,
      queryClient,
    }),
  );
  const isRunStackedActionRunning =
    useIsMutating({ mutationKey: gitMutationKeys.runStackedAction(gitCwd) }) > 0;
  const currentBranch = branchList?.branches.find((branch) => branch.current)?.name ?? null;
  const isGitStatusOutOfSync =
    !!gitStatus?.branch && !!currentBranch && gitStatus.branch !== currentBranch;

  useEffect(() => {
    if (!isGitStatusOutOfSync) return;
    void invalidateGitQueries(queryClient);
  }, [isGitStatusOutOfSync, queryClient]);

  const gitStatusForActions = isGitStatusOutOfSync ? null : gitStatus;
  const isBusy = externalBusy || initMutation.isPending || isRunStackedActionRunning;
  const composerState = useMemo(
    () =>
      buildGitCommitComposerState({
        gitStatus: gitStatusForActions,
        branchList,
        isBusy,
        stagedCount: stagedFiles.length,
      }),
    [branchList, gitStatusForActions, isBusy, stagedFiles.length],
  );
  const pendingDefaultBranchActionCopy = pendingDefaultBranchAction
    ? resolveDefaultBranchActionDialogCopy({
        action: pendingDefaultBranchAction.action,
        branchName: pendingDefaultBranchAction.branchName,
        includesCommit: pendingDefaultBranchAction.includesCommit,
      })
    : null;
  const stagedInsertions = stagedFiles.reduce((sum, file) => sum + file.insertions, 0);
  const stagedDeletions = stagedFiles.reduce((sum, file) => sum + file.deletions, 0);

  useEffect(() => {
    const api = readNativeApi();
    if (!api) return;

    const applyProgressEvent = (event: GitActionProgressEvent) => {
      const progress = activeGitActionProgressRef.current;
      if (!progress) return;
      if (gitCwd && event.cwd !== gitCwd) return;
      if (progress.actionId !== event.actionId) return;

      const now = Date.now();
      switch (event.kind) {
        case "action_started":
          progress.phaseStartedAtMs = now;
          progress.hookStartedAtMs = null;
          progress.hookName = null;
          progress.lastOutputLine = null;
          break;
        case "phase_started":
          progress.title = event.label;
          progress.currentPhaseLabel = event.label;
          progress.phaseStartedAtMs = now;
          progress.hookStartedAtMs = null;
          progress.hookName = null;
          progress.lastOutputLine = null;
          break;
        case "hook_started":
          progress.title = `Running ${event.hookName}...`;
          progress.hookName = event.hookName;
          progress.hookStartedAtMs = now;
          progress.lastOutputLine = null;
          break;
        case "hook_output":
          progress.lastOutputLine = event.text;
          break;
        case "hook_finished":
          progress.title = progress.currentPhaseLabel ?? "Committing...";
          progress.hookName = null;
          progress.hookStartedAtMs = null;
          progress.lastOutputLine = null;
          break;
        case "action_finished":
        case "action_failed":
          return;
      }

      updateActiveProgressToast();
    };

    return api.git.onActionProgress(applyProgressEvent);
  }, [gitCwd, updateActiveProgressToast]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!activeGitActionProgressRef.current) return;
      updateActiveProgressToast();
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [updateActiveProgressToast]);

  const openExistingPr = useCallback(async () => {
    const api = readNativeApi();
    if (!api) {
      toastManager.add({
        type: "error",
        title: "Link opening is unavailable.",
        data: threadToastData,
      });
      return;
    }
    const prUrl = gitStatusForActions?.pr?.state === "open" ? gitStatusForActions.pr.url : null;
    if (!prUrl) {
      toastManager.add({
        type: "error",
        title: "No open PR found.",
        data: threadToastData,
      });
      return;
    }
    void api.shell.openExternal(prUrl).catch((error) => {
      toastManager.add({
        type: "error",
        title: "Unable to open PR link",
        description: error instanceof Error ? error.message : "An error occurred.",
        data: threadToastData,
      });
    });
  }, [gitStatusForActions, threadToastData]);

  const runGitActionWithToast = useEffectEvent(
    async (input: {
      action: GitStackedAction;
      commitMessage?: string;
      forcePushOnlyProgress?: boolean;
      filePaths?: string[];
      featureBranch?: boolean;
      skipDefaultBranchPrompt?: boolean;
      statusOverride?: GitStatusResult | null;
      isDefaultBranchOverride?: boolean;
    }) => {
      const actionStatus = input.statusOverride ?? gitStatusForActions;
      const actionBranch = actionStatus?.branch ?? null;
      const actionIsDefaultBranch =
        input.isDefaultBranchOverride ?? (input.featureBranch ? false : composerState.isDefaultBranch);
      const includesCommit =
        !input.forcePushOnlyProgress && (input.action === "commit" || stagedFiles.length > 0);

      if (
        !input.skipDefaultBranchPrompt &&
        requiresDefaultBranchConfirmation(input.action, actionIsDefaultBranch) &&
        actionBranch
      ) {
        if (input.action !== "commit_push" && input.action !== "commit_push_pr") {
          return;
        }
        setPendingDefaultBranchAction({
          action: input.action,
          branchName: actionBranch,
          includesCommit,
          ...(input.commitMessage ? { commitMessage: input.commitMessage } : {}),
          forcePushOnlyProgress: input.forcePushOnlyProgress ?? false,
          ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        });
        return;
      }

      const progressStages = buildGitActionProgressStages({
        action: input.action,
        hasCustomCommitMessage: !!input.commitMessage?.trim(),
        hasWorkingTreeChanges: stagedFiles.length > 0,
        ...(input.forcePushOnlyProgress !== undefined
          ? { forcePushOnly: input.forcePushOnlyProgress }
          : {}),
        ...(input.featureBranch !== undefined ? { featureBranch: input.featureBranch } : {}),
      });
      const actionId = randomUUID();
      const toastId = toastManager.add({
        type: "loading",
        title: progressStages[0] ?? "Running git action...",
        description: "Waiting for Git...",
        timeout: 0,
        data: threadToastData,
      });

      activeGitActionProgressRef.current = {
        toastId,
        actionId,
        title: progressStages[0] ?? "Running git action...",
        phaseStartedAtMs: null,
        hookStartedAtMs: null,
        hookName: null,
        lastOutputLine: null,
        currentPhaseLabel: progressStages[0] ?? "Running git action...",
      };

      try {
        const result = await runImmediateGitActionMutation.mutateAsync({
          actionId,
          action: input.action,
          ...(input.commitMessage ? { commitMessage: input.commitMessage } : {}),
          ...(input.featureBranch ? { featureBranch: input.featureBranch } : {}),
          ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        });
        activeGitActionProgressRef.current = null;
        const resultToast = summarizeGitResult(result);
        const existingOpenPrUrl =
          actionStatus?.pr?.state === "open" ? actionStatus.pr.url : undefined;
        const prUrl = result.pr.url ?? existingOpenPrUrl;
        const shouldOfferPushCta = input.action === "commit" && result.commit.status === "created";
        const shouldOfferOpenPrCta =
          (input.action === "commit_push" || input.action === "commit_push_pr") &&
          !!prUrl &&
          (!actionIsDefaultBranch ||
            result.pr.status === "created" ||
            result.pr.status === "opened_existing");
        const shouldOfferCreatePrCta =
          input.action === "commit_push" &&
          !prUrl &&
          result.push.status === "pushed" &&
          !actionIsDefaultBranch;
        const closeToast = () => {
          toastManager.close(toastId);
        };

        toastManager.update(toastId, {
          type: "success",
          title: resultToast.title,
          description: resultToast.description,
          timeout: 0,
          data: {
            ...threadToastData,
            dismissAfterVisibleMs: 10_000,
          },
          ...(shouldOfferPushCta
            ? {
                actionProps: {
                  children: "Push",
                  onClick: () => {
                    void runGitActionWithToast({
                      action: "commit_push",
                      forcePushOnlyProgress: true,
                      statusOverride: actionStatus,
                      isDefaultBranchOverride: actionIsDefaultBranch,
                    });
                    closeToast();
                  },
                },
              }
            : shouldOfferOpenPrCta
              ? {
                  actionProps: {
                    children: "View PR",
                    onClick: () => {
                      const api = readNativeApi();
                      if (!api) return;
                      closeToast();
                      void api.shell.openExternal(prUrl);
                    },
                  },
                }
              : shouldOfferCreatePrCta
                ? {
                    actionProps: {
                      children: "Create PR",
                      onClick: () => {
                        closeToast();
                        void runGitActionWithToast({
                          action: "commit_push_pr",
                          forcePushOnlyProgress: true,
                          statusOverride: actionStatus,
                          isDefaultBranchOverride: actionIsDefaultBranch,
                        });
                      },
                    },
                  }
                : {}),
        });
        setCommitMessage("");
      } catch (error) {
        activeGitActionProgressRef.current = null;
        toastManager.update(toastId, {
          type: "error",
          title: "Action failed",
          description: error instanceof Error ? error.message : "An error occurred.",
          data: threadToastData,
        });
      }
    },
  );

  const continuePendingDefaultBranchAction = useCallback(() => {
    if (!pendingDefaultBranchAction) return;
    const { action, commitMessage: pendingCommitMessage, forcePushOnlyProgress, filePaths } =
      pendingDefaultBranchAction;
    setPendingDefaultBranchAction(null);
    void runGitActionWithToast({
      action,
      ...(pendingCommitMessage ? { commitMessage: pendingCommitMessage } : {}),
      forcePushOnlyProgress,
      ...(filePaths ? { filePaths } : {}),
      skipDefaultBranchPrompt: true,
    });
  }, [pendingDefaultBranchAction, runGitActionWithToast]);

  const checkoutFeatureBranchAndContinuePendingAction = useCallback(() => {
    if (!pendingDefaultBranchAction) return;
    const { action, commitMessage: pendingCommitMessage, forcePushOnlyProgress, filePaths } =
      pendingDefaultBranchAction;
    setPendingDefaultBranchAction(null);
    void runGitActionWithToast({
      action,
      ...(pendingCommitMessage ? { commitMessage: pendingCommitMessage } : {}),
      forcePushOnlyProgress,
      ...(filePaths ? { filePaths } : {}),
      featureBranch: true,
      skipDefaultBranchPrompt: true,
    });
  }, [pendingDefaultBranchAction, runGitActionWithToast]);

  const runComposerAction = useCallback(
    (action: GitStackedAction) => {
      const trimmedCommitMessage = commitMessage.trim();
      const filePaths = stagedFiles.length > 0 ? stagedFiles.map((file) => file.path) : undefined;
      const forcePushOnlyProgress = action !== "commit" && stagedFiles.length === 0;
      void runGitActionWithToast({
        action,
        ...(trimmedCommitMessage ? { commitMessage: trimmedCommitMessage } : {}),
        ...(filePaths ? { filePaths } : {}),
        forcePushOnlyProgress,
      });
    },
    [commitMessage, runGitActionWithToast, stagedFiles],
  );

  const openStagedFileInEditor = useCallback(
    (filePath: string) => {
      const api = readNativeApi();
      if (!api || !gitCwd) return;
      const target = resolvePathLinkTarget(filePath, gitCwd);
      void openInPreferredEditor(api, target).catch((error) => {
        toastManager.add({
          type: "error",
          title: "Unable to open file",
          description: error instanceof Error ? error.message : "An error occurred.",
          data: threadToastData,
        });
      });
    },
    [gitCwd, threadToastData],
  );

  return (
    <>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="min-w-0 border-b border-border/60 pb-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle>{composerSection.title}</CardTitle>
              <CardDescription className="mt-1 break-words">
                {composerSection.description}
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge size="sm" variant={stagedFiles.length > 0 ? "secondary" : "outline"}>
                {stagedFiles.length} staged
              </Badge>
              <Badge
                size="sm"
                variant={(gitStatusForActions?.aheadCount ?? 0) > 0 ? "secondary" : "outline"}
              >
                Ahead {gitStatusForActions?.aheadCount ?? 0}
              </Badge>
              <Badge
                size="sm"
                variant={(gitStatusForActions?.behindCount ?? 0) > 0 ? "warning" : "outline"}
              >
                Behind {gitStatusForActions?.behindCount ?? 0}
              </Badge>
              {gitStatusForActions?.pr ? (
                <Badge size="sm" variant="outline">
                  PR #{gitStatusForActions.pr.number}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4 pt-6 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          {!branchList?.isRepo ? (
            <div className="min-w-0 rounded-2xl border border-dashed border-border/70 bg-background/40 p-5 text-sm text-muted-foreground">
              <div className="space-y-2">
                <div className="font-medium text-foreground">Initialize Git for this project</div>
                <p className="break-words">
                  This workspace is not a Git repository yet. Initialize it here, then the full
                  Git dashboard will become active.
                </p>
              </div>
              <div className="mt-4">
                <Button
                  type="button"
                  size="sm"
                  disabled={initMutation.isPending}
                  onClick={() => initMutation.mutate()}
                >
                  {initMutation.isPending ? "Initializing..." : "Initialize Git"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Commit Message
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Optional. Leave it blank to use the existing auto-generated message flow.
                      </div>
                    </div>
                    {composerState.isDefaultBranch && gitStatusForActions?.branch ? (
                      <Badge size="sm" variant="warning">
                        Default branch
                      </Badge>
                    ) : null}
                  </div>
                  <Textarea
                    value={commitMessage}
                    onChange={(event) => setCommitMessage(event.target.value)}
                    placeholder="Describe the staged change set"
                    size="sm"
                    className="mt-4 min-h-28"
                  />
                  {isGitStatusOutOfSync ? (
                    <div className="mt-3 text-xs text-muted-foreground">Refreshing Git status…</div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Staged Summary
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        The composer only acts on files already staged in the Changes panel.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-success">+{stagedInsertions}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-destructive">-{stagedDeletions}</span>
                    </div>
                  </div>
                  {stagedFiles.length > 0 ? (
                    <ScrollArea className="mt-4 h-48 rounded-xl border border-border/70 bg-background/60">
                      <div className="space-y-2 p-2">
                        {stagedFiles.map((file) => (
                          <button
                            key={`composer-staged:${file.path}`}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-background"
                            onClick={() => openStagedFileInEditor(file.path)}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {file.path}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Opens in your preferred editor
                              </div>
                            </div>
                            <div className="shrink-0 font-mono text-xs">
                              <span className="text-success">+{file.insertions}</span>
                              <span className="text-muted-foreground"> / </span>
                              <span className="text-destructive">-{file.deletions}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                      {gitStatusForActions?.hasWorkingTreeChanges
                        ? "Nothing is staged yet. Use the Changes panel to stage the files that belong in the next commit."
                        : "No staged files right now. Existing local commits can still be pushed from the actions on the right."}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid min-w-0 gap-3">
                {composerState.actions.map((action) => (
                  <div
                    key={action.id}
                    className={cn(
                      "min-w-0 rounded-2xl border border-border/70 bg-background/40 p-4",
                      action.disabled ? "opacity-80" : "shadow-sm",
                    )}
                  >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 items-center gap-2 text-foreground">
                          <GitComposerActionIcon actionId={action.id} />
                          <div className="truncate text-sm font-semibold">{action.label}</div>
                        </div>
                        <p className="break-words text-sm text-muted-foreground">
                          {action.description}
                        </p>
                        <p
                          className={cn(
                            "break-words text-xs",
                            action.disabledReason ? "text-warning" : "text-muted-foreground",
                          )}
                        >
                          {action.disabledReason ??
                            (action.id === "open_pr"
                              ? "Open the existing pull request for this branch."
                              : action.id === "commit"
                                ? "Uses only the currently staged files."
                                : action.id === "commit_push"
                                  ? stagedFiles.length > 0
                                    ? "Commits the staged set first, then pushes."
                                    : "Pushes existing local commits without creating a new commit."
                                  : stagedFiles.length > 0
                                    ? "Commits the staged set, pushes the branch, then opens a PR."
                                    : "Pushes existing local commits and opens a PR.")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={action.id === "commit" ? "outline" : "default"}
                        disabled={action.disabled}
                        onClick={() => {
                          if (action.kind === "open_pr") {
                            void openExistingPr();
                            return;
                          }
                          if (action.action) {
                            runComposerAction(action.action);
                          }
                        }}
                      >
                        {action.label}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={pendingDefaultBranchAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDefaultBranchAction(null);
          }
        }}
      >
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {pendingDefaultBranchActionCopy?.title ?? "Run action on default branch?"}
            </DialogTitle>
            <DialogDescription>{pendingDefaultBranchActionCopy?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingDefaultBranchAction(null)}>
              Abort
            </Button>
            <Button variant="outline" size="sm" onClick={continuePendingDefaultBranchAction}>
              {pendingDefaultBranchActionCopy?.continueLabel ?? "Continue"}
            </Button>
            <Button size="sm" onClick={checkoutFeatureBranchAndContinuePendingAction}>
              Create feature branch first
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
