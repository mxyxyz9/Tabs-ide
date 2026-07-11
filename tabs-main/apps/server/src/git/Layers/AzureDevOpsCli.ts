import { Effect, Layer } from "effect";
import { runProcess } from "../../processRunner";
import { AzureDevOpsCliError } from "../Errors.ts";
import { AzureDevOpsCli, type AzureDevOpsCliShape } from "../Services/AzureDevOpsCli.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeAzureDevOpsCliError(operation: string, error: unknown): AzureDevOpsCliError {
  if (error instanceof Error) {
    if (error.message.includes("Command not found: az")) {
      return new AzureDevOpsCliError({
        operation,
        detail: "Azure CLI (`az`) is required but not available on PATH.",
        cause: error,
      });
    }
    return new AzureDevOpsCliError({
      operation,
      detail: `Azure DevOps CLI command failed: ${error.message}`,
      cause: error,
    });
  }
  return new AzureDevOpsCliError({
    operation,
    detail: "Azure DevOps CLI command failed.",
    cause: error,
  });
}

const makeAzureDevOpsCli = Effect.sync(() => {
  const execute: AzureDevOpsCliShape["execute"] = (input) =>
    Effect.tryPromise({
      try: () =>
        runProcess("az", input.args, {
          cwd: input.cwd,
          timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        }),
      catch: (error) => normalizeAzureDevOpsCliError("execute", error),
    });

  return {
    execute,
    getAuthStatus: (input) =>
      execute({
        cwd: input.cwd,
        args: ["account", "show", "--query", "user.name", "-o", "tsv"],
      }).pipe(
        Effect.map((result) => result.stdout),
        Effect.catch((err) => {
          if (err && typeof err === "object" && "cause" in err) {
            const cause = err.cause;
            if (cause && typeof cause === "object") {
              const stdout = "stdout" in cause && typeof cause.stdout === "string" ? cause.stdout : "";
              const stderr = "stderr" in cause && typeof cause.stderr === "string" ? cause.stderr : "";
              if (stdout || stderr) {
                return Effect.succeed(`${stdout}\n${stderr}`);
              }
            }
          }
          return Effect.fail(err);
        })
      ),
  } satisfies AzureDevOpsCliShape;
});

export const AzureDevOpsCliLive = Layer.effect(AzureDevOpsCli, makeAzureDevOpsCli);
