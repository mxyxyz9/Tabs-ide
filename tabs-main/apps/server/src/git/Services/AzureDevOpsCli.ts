import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProcessRunResult } from "../../processRunner";
import type { AzureDevOpsCliError } from "../Errors.ts";

export interface AzureDevOpsCliShape {
  readonly execute: (input: {
    readonly cwd: string;
    readonly args: ReadonlyArray<string>;
    readonly timeoutMs?: number;
  }) => Effect.Effect<ProcessRunResult, AzureDevOpsCliError>;

  readonly getAuthStatus: (input: {
    readonly cwd: string;
  }) => Effect.Effect<string, AzureDevOpsCliError>;
}

export class AzureDevOpsCli extends ServiceMap.Service<AzureDevOpsCli, AzureDevOpsCliShape>()(
  "tabs/git/Services/AzureDevOpsCli",
) {}
