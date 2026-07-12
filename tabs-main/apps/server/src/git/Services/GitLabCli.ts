import * as Context from "effect/Context";
import type { Effect } from "effect";
import type { ProcessRunResult } from "../../processRunner";
import type { GitLabCliError } from "../Errors.ts";

export interface GitLabCliShape {
  readonly execute: (input: {
    readonly cwd: string;
    readonly args: ReadonlyArray<string>;
    readonly timeoutMs?: number;
  }) => Effect.Effect<ProcessRunResult, GitLabCliError>;

  readonly getAuthStatus: (input: {
    readonly cwd: string;
  }) => Effect.Effect<string, GitLabCliError>;
}

export class GitLabCli extends Context.Service<GitLabCli, GitLabCliShape>()(
  "tabs/git/Services/GitLabCli",
) {}
