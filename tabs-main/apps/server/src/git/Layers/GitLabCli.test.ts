import { describe, expect, it } from "vitest";

import { decodeGitLabMergeRequestChanges, decodeGitLabMergeRequests } from "./GitLabCli.ts";

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

describe("decodeGitLabMergeRequestChanges", () => {
  it("normalizes renamed and binary merge-request files", () => {
    expect(
      decodeGitLabMergeRequestChanges({
        changes: [
          {
            old_path: "src/old.ts",
            new_path: "src/new.ts",
            renamed_file: true,
            new_file: false,
            deleted_file: false,
            diff: "@@ -1 +1 @@\n-old\n+new",
          },
          {
            old_path: "logo.png",
            new_path: "logo.png",
            new_file: false,
            deleted_file: false,
            renamed_file: false,
          },
        ],
      }),
    ).toEqual([
      {
        path: "src/new.ts",
        previousPath: "src/old.ts",
        status: "renamed",
        additions: 1,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-old\n+new",
        patchTruncated: false,
      },
      {
        path: "logo.png",
        status: "modified",
        additions: 0,
        deletions: 0,
        patch: null,
        patchTruncated: false,
      },
    ]);
  });
});
