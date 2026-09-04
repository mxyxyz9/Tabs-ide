import { Effect, Layer } from "effect";
import { runProcess } from "../../processRunner";
import { GitLabCliError } from "../Errors.ts";
import { GitLabCli, type GitLabCliShape } from "../Services/GitLabCli.ts";
import type { GitResolvedPullRequest } from "@tabs/contracts";

const DEFAULT_TIMEOUT_MS = 30_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseState(value: unknown, mergedAt: unknown): "open" | "closed" | "merged" {
  if (text(mergedAt) || text(value)?.toLowerCase() === "merged") return "merged";
  return text(value)?.toLowerCase() === "closed" ? "closed" : "open";
}

function parseMergeRequest(value: unknown): GitResolvedPullRequest | null {
  const raw = record(value);
  if (!raw) return null;
  const prNumber = number(raw.iid ?? raw.id);
  const title = text(raw.title);
  const url = text(raw.web_url ?? raw.webUrl);
  const headBranch = text(raw.source_branch ?? raw.sourceBranch);
  const baseBranch = text(raw.target_branch ?? raw.targetBranch);
  if (!prNumber || !title || !url || !headBranch || !baseBranch) return null;

  const authorRecord = record(raw.author);
  const authorLogin = text(authorRecord?.username ?? authorRecord?.name);
  const reviewers = Array.isArray(raw.reviewers)
    ? raw.reviewers.flatMap((entry) => {
        const reviewer = record(entry);
        const login = text(reviewer?.username ?? reviewer?.name);
        return login
          ? [
              {
                login,
                ...(text(reviewer?.avatar_url ?? reviewer?.avatarUrl)
                  ? { avatarUrl: text(reviewer?.avatar_url ?? reviewer?.avatarUrl)! }
                  : {}),
              },
            ]
          : [];
      })
    : [];
  const labels = Array.isArray(raw.labels)
    ? raw.labels.flatMap((entry) => {
        const label = record(entry);
        const name = text(label?.name ?? entry);
        return name
          ? [{ name, ...(text(label?.color) ? { color: text(label?.color)! } : {}) }]
          : [];
      })
    : [];
  const pipeline = record(raw.head_pipeline ?? raw.pipeline);
  const pipelineStatus = text(pipeline?.status)?.toLowerCase();
  const checksState = pipelineStatus
    ? ["success", "passed"].includes(pipelineStatus)
      ? ("passing" as const)
      : ["failed", "canceled", "skipped"].includes(pipelineStatus)
        ? ("failing" as const)
        : ("pending" as const)
    : undefined;
  const hasConflicts = raw.has_conflicts === true;
  const mergeStatus = text(raw.merge_status)?.toLowerCase();

  return {
    provider: "gitlab",
    number: prNumber,
    title,
    url,
    headBranch,
    baseBranch,
    state: parseState(raw.state, raw.merged_at),
    isDraft: raw.draft === true || raw.work_in_progress === true,
    ...(authorLogin
      ? {
          author: {
            login: authorLogin,
            ...(text(authorRecord?.avatar_url ?? authorRecord?.avatarUrl)
              ? { avatarUrl: text(authorRecord?.avatar_url ?? authorRecord?.avatarUrl)! }
              : {}),
          },
        }
      : {}),
    labels,
    reviewers,
    mergeability:
      hasConflicts || mergeStatus === "cannot_be_merged"
        ? "conflicting"
        : mergeStatus
          ? "mergeable"
          : "unknown",
    ...(checksState ? { checksState } : {}),
    ...(text(raw.created_at) ? { createdAt: text(raw.created_at)! } : {}),
    ...(text(raw.updated_at) ? { updatedAt: text(raw.updated_at)! } : {}),
    ...(typeof raw.description === "string" ? { body: raw.description } : {}),
    ...(typeof raw.changes_count === "string" && Number.isFinite(Number(raw.changes_count))
      ? { changedFiles: Number(raw.changes_count) }
      : {}),
  };
}

export function decodeGitLabMergeRequests(stdout: string): ReadonlyArray<GitResolvedPullRequest> {
  const parsed: unknown = JSON.parse(stdout);
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  return entries.flatMap((entry) => {
    const pullRequest = parseMergeRequest(entry);
    return pullRequest ? [pullRequest] : [];
  });
}

function normalizeGitLabCliError(operation: string, error: unknown): GitLabCliError {
  if (error instanceof Error) {
    if (error.message.includes("Command not found: glab")) {
      return new GitLabCliError({
        operation,
        detail: "GitLab CLI (`glab`) is required but not available on PATH.",
        cause: error,
      });
    }
    return new GitLabCliError({
      operation,
      detail: `GitLab CLI command failed: ${error.message}`,
      cause: error,
    });
  }
  return new GitLabCliError({
    operation,
    detail: "GitLab CLI command failed.",
    cause: error,
  });
}

export const makeGitLabCli = Effect.sync(() => {
  const execute: GitLabCliShape["execute"] = (input) =>
    Effect.tryPromise({
      try: () =>
        runProcess("glab", input.args, {
          cwd: input.cwd,
          timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        }),
      catch: (error) => normalizeGitLabCliError("execute", error),
    });

  return {
    execute,
    getAuthStatus: (input) =>
      execute({
        cwd: input.cwd,
        args: ["auth", "status"],
      }).pipe(
        Effect.map((result) => `${result.stdout}\n${result.stderr}`),
        Effect.catch((err) => {
          // glab auth status exits non-zero if not logged in.
          if (err && typeof err === "object" && "cause" in err) {
            const cause = err.cause;
            if (cause && typeof cause === "object") {
              const stdout =
                "stdout" in cause && typeof cause.stdout === "string" ? cause.stdout : "";
              const stderr =
                "stderr" in cause && typeof cause.stderr === "string" ? cause.stderr : "";
              if (stdout || stderr) {
                return Effect.succeed(`${stdout}\n${stderr}`);
              }
            }
          }
          return Effect.fail(err);
        }),
      ),
    listPullRequests: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "mr",
          "list",
          ...(input.state === "open"
            ? []
            : input.state === "merged"
              ? ["--merged"]
              : input.state === "closed"
                ? ["--closed"]
                : ["--all"]),
          "--per-page",
          String(input.limit),
          "--output",
          "json",
        ],
      }).pipe(
        Effect.flatMap((result) =>
          Effect.try({
            try: () => decodeGitLabMergeRequests(result.stdout.trim() || "[]"),
            catch: (error) => normalizeGitLabCliError("listPullRequests", error),
          }),
        ),
      ),
    getPullRequest: (input) =>
      execute({
        cwd: input.cwd,
        args: ["mr", "view", input.reference, "--output", "json"],
      }).pipe(
        Effect.flatMap((result) =>
          Effect.try({
            try: () => {
              const [pullRequest] = decodeGitLabMergeRequests(result.stdout.trim());
              if (!pullRequest) throw new Error("GitLab returned an invalid merge request.");
              return pullRequest;
            },
            catch: (error) => normalizeGitLabCliError("getPullRequest", error),
          }),
        ),
      ),
    mutatePullRequest: (input) => {
      const reference = input.reference.trim().replace(/^#/, "");
      let args: ReadonlyArray<string>;
      switch (input.action) {
        case "merge":
          args = [
            "mr",
            "merge",
            reference,
            ...(input.mergeMethod === "squash" ? ["--squash"] : []),
            ...(input.mergeMethod === "rebase" ? ["--rebase"] : []),
            ...(input.deleteBranch ? ["--remove-source-branch"] : []),
          ];
          break;
        case "close":
        case "reopen":
        case "approve":
          args = ["mr", input.action, reference];
          break;
        case "ready":
          args = ["mr", "update", reference, "--ready"];
          break;
        case "draft":
          args = ["mr", "update", reference, "--draft"];
          break;
        case "comment":
          args = ["mr", "note", reference, "--message", input.body ?? ""];
          break;
        case "add_reviewer":
          args = ["mr", "update", reference, "--reviewer", input.value ?? ""];
          break;
        case "remove_reviewer":
          args = ["mr", "update", reference, "--unreviewer", input.value ?? ""];
          break;
        case "add_label":
          args = ["mr", "update", reference, "--label", input.value ?? ""];
          break;
        case "remove_label":
          args = ["mr", "update", reference, "--unlabel", input.value ?? ""];
          break;
        case "request_changes":
          return Effect.fail(
            new GitLabCliError({
              operation: "mutatePullRequest",
              detail: "GitLab does not support a request-changes review verdict.",
            }),
          );
      }
      return execute({ cwd: input.cwd, args }).pipe(Effect.asVoid);
    },
    createPullRequest: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "api",
          "--method",
          "POST",
          "projects/:fullpath/merge_requests",
          "--raw-field",
          `source_branch=${input.headBranch}`,
          "--raw-field",
          `target_branch=${input.baseBranch}`,
          "--raw-field",
          `title=${input.title}`,
          "--field",
          `description=@${input.bodyFile}`,
          ...(input.draft ? ["--raw-field", "draft=true"] : []),
        ],
      }).pipe(Effect.asVoid),
  } satisfies GitLabCliShape;
});

export const GitLabCliLive = Layer.effect(GitLabCli, makeGitLabCli);
