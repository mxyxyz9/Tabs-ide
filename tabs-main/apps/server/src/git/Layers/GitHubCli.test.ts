import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, expect, vi } from "vitest";

vi.mock("../../processRunner", () => ({
  runProcess: vi.fn(),
}));

import { runProcess } from "../../processRunner";
import { GitHubCli } from "../Services/GitHubCli.ts";
import { GitHubCliLive } from "./GitHubCli.ts";

const mockedRunProcess = vi.mocked(runProcess);
const layer = it.layer(GitHubCliLive);

afterEach(() => {
  mockedRunProcess.mockReset();
});

layer("GitHubCliLive", (it) => {
  it.effect("parses pull request view output", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          number: 42,
          title: "Add PR thread creation",
          url: "https://github.com/pingdotgg/codething-mvp/pull/42",
          baseRefName: "main",
          headRefName: "feature/pr-threads",
          state: "OPEN",
          mergedAt: null,
          isCrossRepository: true,
          headRepository: {
            nameWithOwner: "octocat/codething-mvp",
          },
          headRepositoryOwner: {
            login: "octocat",
          },
          isDraft: false,
          author: { login: "octocat", avatarUrl: "https://avatars.example/octocat" },
          labels: [{ name: "enhancement", color: "84b6eb", description: null }],
          reviewDecision: "APPROVED",
          mergeable: "MERGEABLE",
          statusCheckRollup: [{ name: "CI", status: "COMPLETED", conclusion: "SUCCESS" }],
          additions: 120,
          deletions: 18,
          changedFiles: 7,
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-04T10:00:00Z",
          body: "Implements the PR workspace.",
          reviewRequests: [{ login: "reviewer" }],
          comments: [
            {
              id: "comment-1",
              author: { login: "reviewer" },
              body: "Looks good.",
              createdAt: "2026-09-04T09:00:00Z",
            },
          ],
          reviews: [
            {
              id: "review-1",
              author: { login: "reviewer" },
              body: "Approved.",
              state: "APPROVED",
              submittedAt: "2026-09-04T09:30:00Z",
            },
          ],
          commits: [
            {
              oid: "abcdef1234567890",
              messageHeadline: "Build PR workspace",
              authoredDate: "2026-09-03T10:00:00Z",
              authors: [{ login: "octocat" }],
            },
          ],
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getPullRequest({
          cwd: "/repo",
          reference: "#42",
        });
      });

      assert.deepStrictEqual(result, {
        number: 42,
        title: "Add PR thread creation",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseRefName: "main",
        headRefName: "feature/pr-threads",
        state: "open",
        isCrossRepository: true,
        headRepositoryNameWithOwner: "octocat/codething-mvp",
        headRepositoryOwnerLogin: "octocat",
        isDraft: false,
        author: { login: "octocat", avatarUrl: "https://avatars.example/octocat" },
        labels: [{ name: "enhancement", color: "84b6eb", description: null }],
        reviewDecision: "approved",
        mergeability: "mergeable",
        checksState: "passing",
        checks: [{ name: "CI", status: "completed", conclusion: "SUCCESS" }],
        additions: 120,
        deletions: 18,
        changedFiles: 7,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-04T10:00:00Z",
        body: "Implements the PR workspace.",
        reviewers: [{ login: "reviewer" }],
        comments: [
          {
            id: "comment-1",
            author: { login: "reviewer" },
            body: "Looks good.",
            createdAt: "2026-09-04T09:00:00Z",
          },
        ],
        reviews: [
          {
            id: "review-1",
            author: { login: "reviewer" },
            body: "Approved.",
            state: "APPROVED",
            submittedAt: "2026-09-04T09:30:00Z",
          },
        ],
        commits: [
          {
            sha: "abcdef1234567890",
            subject: "Build PR workspace",
            authoredAt: "2026-09-03T10:00:00Z",
            authors: [{ login: "octocat" }],
          },
        ],
      });
      expect(mockedRunProcess).toHaveBeenCalledWith(
        "gh",
        [
          "pr",
          "view",
          "#42",
          "--json",
          "number,title,url,baseRefName,headRefName,state,mergedAt,isCrossRepository,headRepository,headRepositoryOwner,isDraft,author,labels,reviewDecision,mergeable,statusCheckRollup,additions,deletions,changedFiles,createdAt,updatedAt,body,reviewRequests,comments,reviews,commits",
        ],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );

  it.effect("reads repository clone URLs", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          nameWithOwner: "octocat/codething-mvp",
          url: "https://github.com/octocat/codething-mvp",
          sshUrl: "git@github.com:octocat/codething-mvp.git",
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getRepositoryCloneUrls({
          cwd: "/repo",
          repository: "octocat/codething-mvp",
        });
      });

      assert.deepStrictEqual(result, {
        nameWithOwner: "octocat/codething-mvp",
        url: "https://github.com/octocat/codething-mvp",
        sshUrl: "git@github.com:octocat/codething-mvp.git",
      });
    }),
  );

  it.effect("surfaces a friendly error when the pull request is not found", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockRejectedValueOnce(
        new Error(
          "GraphQL: Could not resolve to a PullRequest with the number of 4888. (repository.pullRequest)",
        ),
      );

      const error = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getPullRequest({
          cwd: "/repo",
          reference: "4888",
        });
      }).pipe(Effect.flip);

      assert.equal(error.message.includes("Pull request not found"), true);
    }),
  );
});
