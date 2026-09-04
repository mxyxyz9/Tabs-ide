import * as Context from "effect/Context";
/**
 * GitHubCli - Effect service contract for `gh` process interactions.
 *
 * Provides thin command execution helpers used by Git workflow orchestration.
 *
 * @module GitHubCli
 */
import type { Effect } from "effect";

import type { ProcessRunResult } from "../../processRunner";
import type { GitHubCliError } from "../Errors.ts";

export interface GitHubPullRequestSummary {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly baseRefName: string;
  readonly headRefName: string;
  readonly state?: "open" | "closed" | "merged";
  readonly isCrossRepository?: boolean;
  readonly headRepositoryNameWithOwner?: string | null;
  readonly headRepositoryOwnerLogin?: string | null;
  readonly isDraft?: boolean | undefined;
  readonly author?: {
    readonly login: string;
    readonly avatarUrl?: string | undefined;
    readonly url?: string | undefined;
  } | null;
  readonly labels?: ReadonlyArray<{
    readonly name: string;
    readonly color?: string | undefined;
    readonly description?: string | null | undefined;
  }>;
  readonly reviewDecision?: "approved" | "changes_requested" | "review_required" | undefined;
  readonly mergeability?: "mergeable" | "conflicting" | "unknown" | undefined;
  readonly checksState?: "passing" | "failing" | "pending" | undefined;
  readonly additions?: number | undefined;
  readonly deletions?: number | undefined;
  readonly changedFiles?: number | undefined;
  readonly createdAt?: string | undefined;
  readonly updatedAt?: string | undefined;
}

export interface GitHubRepositoryCloneUrls {
  readonly nameWithOwner: string;
  readonly url: string;
  readonly sshUrl: string;
}

/**
 * GitHubCliShape - Service API for executing GitHub CLI commands.
 */
export interface GitHubCliShape {
  /**
   * Execute a GitHub CLI command and return full process output.
   */
  readonly execute: (input: {
    readonly cwd: string;
    readonly args: ReadonlyArray<string>;
    readonly timeoutMs?: number;
  }) => Effect.Effect<ProcessRunResult, GitHubCliError>;

  /**
   * List open pull requests for a head branch.
   */
  readonly listOpenPullRequests: (input: {
    readonly cwd: string;
    readonly headSelector?: string;
    readonly state?: "open" | "closed" | "merged" | "all";
    readonly limit?: number;
  }) => Effect.Effect<ReadonlyArray<GitHubPullRequestSummary>, GitHubCliError>;

  /**
   * Resolve a pull request by URL, number, or branch-ish identifier.
   */
  readonly getPullRequest: (input: {
    readonly cwd: string;
    readonly reference: string;
  }) => Effect.Effect<GitHubPullRequestSummary, GitHubCliError>;

  /**
   * Resolve clone URLs for a GitHub repository.
   */
  readonly getRepositoryCloneUrls: (input: {
    readonly cwd: string;
    readonly repository: string;
  }) => Effect.Effect<GitHubRepositoryCloneUrls, GitHubCliError>;

  /**
   * Create a pull request from branch context and body file.
   */
  readonly createPullRequest: (input: {
    readonly cwd: string;
    readonly baseBranch: string;
    readonly headSelector: string;
    readonly title: string;
    readonly bodyFile: string;
  }) => Effect.Effect<void, GitHubCliError>;

  /**
   * Resolve repository default branch through GitHub metadata.
   */
  readonly getDefaultBranch: (input: {
    readonly cwd: string;
  }) => Effect.Effect<string | null, GitHubCliError>;

  /**
   * Checkout a pull request into the current repository worktree.
   */
  readonly checkoutPullRequest: (input: {
    readonly cwd: string;
    readonly reference: string;
    readonly force?: boolean;
  }) => Effect.Effect<void, GitHubCliError>;

  /**
   * Get GitHub CLI auth status.
   */
  readonly getAuthStatus: (input: {
    readonly cwd: string;
  }) => Effect.Effect<string, GitHubCliError>;
}

/**
 * GitHubCli - Service tag for GitHub CLI process execution.
 */
export class GitHubCli extends Context.Service<GitHubCli, GitHubCliShape>()(
  "tabs/git/Services/GitHubCli",
) {}
