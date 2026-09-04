import { describe, expect, it } from "bun:test";

import { decodeGitLabMergeRequests } from "./GitLabCli.ts";

describe("decodeGitLabMergeRequests", () => {
  it("normalizes real GitLab fields without inventing unavailable data", () => {
    const [mergeRequest] = decodeGitLabMergeRequests(
      JSON.stringify([
        {
          iid: 17,
          title: "Ship provider routing",
          web_url: "https://gitlab.com/tabs/app/-/merge_requests/17",
          source_branch: "feature/providers",
          target_branch: "main",
          state: "opened",
          draft: true,
          description: "Provider-backed details.",
          author: { username: "rushil", avatar_url: "https://gitlab.com/avatar.png" },
          reviewers: [{ username: "reviewer" }],
          labels: ["backend", { name: "git", color: "1f75cb" }],
          has_conflicts: false,
          merge_status: "can_be_merged",
          changes_count: "4",
          head_pipeline: { status: "success" },
          created_at: "2026-09-01T10:00:00Z",
          updated_at: "2026-09-02T10:00:00Z",
        },
      ]),
    );

    expect(mergeRequest).toEqual({
      provider: "gitlab",
      number: 17,
      title: "Ship provider routing",
      url: "https://gitlab.com/tabs/app/-/merge_requests/17",
      headBranch: "feature/providers",
      baseBranch: "main",
      state: "open",
      isDraft: true,
      author: { login: "rushil", avatarUrl: "https://gitlab.com/avatar.png" },
      labels: [{ name: "backend" }, { name: "git", color: "1f75cb" }],
      reviewers: [{ login: "reviewer" }],
      mergeability: "mergeable",
      checksState: "passing",
      createdAt: "2026-09-01T10:00:00Z",
      updatedAt: "2026-09-02T10:00:00Z",
      body: "Provider-backed details.",
      changedFiles: 4,
    });
  });

  it("drops malformed list rows instead of fabricating required fields", () => {
    expect(
      decodeGitLabMergeRequests(
        JSON.stringify([
          { iid: 2, title: "Missing URL" },
          {
            iid: 3,
            title: "Valid",
            web_url: "https://gitlab.com/tabs/app/-/merge_requests/3",
            source_branch: "feature/valid",
            target_branch: "main",
          },
        ]),
      ),
    ).toHaveLength(1);
  });
});
