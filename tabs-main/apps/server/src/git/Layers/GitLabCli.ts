import { Effect, Layer } from "effect";
import { runProcess } from "../../processRunner";
import { GitLabCliError } from "../Errors.ts";
import { GitLabCli, type GitLabCliShape } from "../Services/GitLabCli.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

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

const makeGitLabCli = Effect.sync(() => {
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
  } satisfies GitLabCliShape;
});

export const GitLabCliLive = Layer.effect(GitLabCli, makeGitLabCli);
