# Git Tool Audit: Tabs, T3 Code, and Synara

Date: 2026-09-04

## Executive assessment

Tabs has the broadest standalone Git workspace of the three applications. It covers changes, inline and full diffs, conflict resolution, branches, divergence, history, pull requests, tags, stashes, accounts, repository settings, worktrees, and AI-assisted summaries. T3 Code and Synara expose fewer general Git-client workflows, but both have substantially deeper pull-request models and review experiences.

The current Tabs implementation is therefore a strong base, but it is not yet a replacement for either reference application's PR experience. Before this audit, it also contained correctness gaps that made the apparent feature coverage larger than the real coverage: remote panels could call the local API, PR comments were fabricated, commit-message generation was timer-based, and failed GitHub authorization was accepted. Those issues are corrected in the accompanying change.

## Capability comparison

| Area | Tabs | T3 Code | Synara | Assessment |
| --- | --- | --- | --- | --- |
| Working-tree operations | Rich staging, unstaging, discard, hunk/diff, conflicts, commit/amend/push | Basic repository actions | Basic repository actions | Keep Tabs |
| Branches and divergence | Branch CRUD, merge/rebase, watched divergence, worktrees | Basic branch/checkout integration | Basic branch/project integration | Keep Tabs; harden command execution |
| History | Search, details, reset, revert, cherry-pick, AI summary | Limited compared with Tabs Git tool | Limited compared with Tabs Git tool | Keep Tabs |
| Stashes and tags | First-class panels and actions | Not comparable in breadth | Not comparable in breadth | Keep Tabs |
| Provider/account support | GitHub, GitLab, and Azure backend adapters; UI is still GitHub-centric | GitHub, GitLab, Azure DevOps, Bitbucket PR providers | Deep hosted-PR service and repository inventory | Port provider-neutral PR behavior |
| PR list | Current-branch and repository list, basic state filtering | Rich filters, pagination, draft/review/check metadata | Rich list, project context, pinning, stack metadata | Tabs is materially behind |
| PR detail | Opens web page; merge delegated to terminal | Native summary, checks, commits, code, timeline, actors, labels, reviewers | Native summary, checks, code, timeline, comments, stack context | Port reference architecture |
| Review interaction | Separate local AI review surface | Inline annotations, comments, reactions, reviewer selection, Markdown editing | Comments, Markdown, review timeline and code inspection | Tabs is materially behind |
| PR merge | GitHub CLI command | Typed provider capabilities and merge methods | Typed PR operations and capabilities | Replace terminal command with typed provider operation |
| Tests | Good lower-level Git coverage; sparse Git-panel/PR interaction coverage | Extensive PR service, provider, and UI tests | Extensive PR service, cache/recovery, and browser tests | Add contract and interaction coverage |

## Findings by priority

### P0 — fixed in this change

1. **Remote action misrouting.** `GitToolV2` resolved an environment-specific API, but child panels independently called the global `readNativeApi()`. A remote status view could therefore perform mutations against the primary environment. All Git panels and modals now consume the API selected by `GitToolV2`, and the provider is cleared during an environment switch.

2. **Fabricated PR comments.** The PR panel generated a successful GitHub Actions comment after a timer without querying any provider. The comments affordance has been removed until real timeline data exists.

3. **False authentication success.** The device-auth modal closed after an unsuccessful or failed verification. It now remains open, reports the real failure, and closes only after the environment reports GitHub authentication.

4. **Placeholder AI presented as real AI.** Commit-message buttons used file names after an artificial delay. They now invoke the real diff-summary operation. The static review-rule template is now labeled “Use suggested rules” instead of “Improve with AI.”

### P1 — next implementation slice

1. **Build a provider-neutral PR domain.** Tabs' resolved PR object contains only number, title, URL, base, head, and state. Port the shared intersection of the T3 and Synara models: draft state, author, labels, review decision, mergeability, checks, commits, comments/timeline, reviewers, merge capabilities, pagination, and provider identity.

2. **Add a native PR detail workspace.** Implement Summary, Code, Checks, Commits, and Timeline tabs. Preserve Tabs' existing local AI Review panel as a complementary workflow rather than merging the two concepts.

3. **Typed PR mutation — partially completed.** Merge, close/reopen, draft/ready, comments, approvals, and change requests now use a typed environment API whose provider adapter passes argument arrays directly to the host CLI. Create, reviewer assignment, label editing, and non-GitHub adapters remain.

4. **Eliminate shell interpolation.** Worktree paths, release titles/notes, remote names/URLs, branch names, and tags are interpolated into terminal commands in several paths. Move these actions behind typed API methods with argument arrays. Escaping individual strings is only an interim mitigation.

5. **Environment-scoped Git UI state — completed.** Panel drafts, selected commits/files, collapsed state, excluded branches, summaries, audit state, and review badges are keyed by `(environmentId, cwd)`, preventing equal remote and local paths from colliding.

### P2 — quality and performance

1. Mount only the active panel, or disable inactive queries. The current hidden-panel design can keep unnecessary effects and provider calls alive.
2. Include untracked and conflicted files in the sidebar change count where appropriate.
3. Add explicit tab/tabpanel relationships and complete icon-button accessible names.
4. Add panel interaction tests for error, loading, remote-environment routing, destructive confirmations, authentication failure, and PR state transitions.
5. Add provider capability gating so unsupported buttons are hidden or explained rather than assuming GitHub CLI availability.

## Recommended port strategy

Use Tabs as the host and port the PR domain in three vertical slices:

1. **Read-only parity:** provider-neutral contracts, paginated list, filters, detail, checks, commits, timeline, and diff.
2. **Review parity:** comments, inline annotations, reactions, reviewers, Markdown editing, and review submission.
3. **Mutation parity:** create, merge methods, close/reopen, labels, reviewer assignment, and capability-aware provider actions.

T3 Code is the stronger reference for multi-provider contracts, review filters, annotations, reactions, and merge capabilities. Synara is the stronger reference for stack context, repository inventory, project pinning/recovery, request coalescing, and its cohesive docked PR workflow. Tabs should port those strengths without replacing its more capable general Git workspace.

## Release gate

The Git tool should not be described as PR-parity complete until all P1 items are implemented and tested against at least GitHub plus one non-GitHub provider. The current corrected implementation is suitable as a broad Git client with a basic PR list, not yet as a complete collaborative PR-review client.
