# Git Tool Audit: Tabs, T3 Code, and Synara

Date: 2026-09-04

## Executive assessment

Tabs has the broadest standalone Git workspace of the three applications. It covers changes, inline and full diffs, conflict resolution, branches, divergence, history, pull requests, tags, stashes, accounts, repository settings, worktrees, and AI-assisted summaries. T3 Code and Synara expose fewer general Git-client workflows, but both have substantially deeper pull-request models and review experiences.

The current Tabs implementation is therefore a strong base. Its provider-neutral PR model and native detail/mutation workflow now cover most of the read/write surface from the reference applications, but it is not yet a replacement for their code-review experience. Earlier correctness gaps included remote panels calling the local API, fabricated PR comments, timer-based commit-message generation, and false authentication success; those are corrected in the implementation history below.

## Capability comparison

| Area                     | Tabs                                                                                            | T3 Code                                                                       | Synara                                                          | Assessment                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| Working-tree operations  | Rich staging, unstaging, discard, hunk/diff, conflicts, commit/amend/push                       | Basic repository actions                                                      | Basic repository actions                                        | Keep Tabs                                                     |
| Branches and divergence  | Branch CRUD, merge/rebase, watched divergence, worktrees                                        | Basic branch/checkout integration                                             | Basic branch/project integration                                | Keep Tabs; harden command execution                           |
| History                  | Search, details, reset, revert, cherry-pick, AI summary                                         | Limited compared with Tabs Git tool                                           | Limited compared with Tabs Git tool                             | Keep Tabs                                                     |
| Stashes and tags         | First-class panels and actions                                                                  | Not comparable in breadth                                                     | Not comparable in breadth                                       | Keep Tabs                                                     |
| Provider/account support | GitHub and GitLab PR adapters; Azure/Bitbucket discovery only                                   | GitHub, GitLab, Azure DevOps, Bitbucket PR providers                          | Deep hosted-PR service and repository inventory                 | Finish Azure/Bitbucket and capability gating                  |
| PR list                  | Current-branch/repository list, state filters, draft/review/check/merge metadata                | Rich filters, pagination, draft/review/check metadata                         | Rich list, project context, pinning, stack metadata             | Real parity base; pagination and advanced organization remain |
| PR detail                | Native Summary, Checks, Commits, and Activity tabs; actors, labels, reviewers, comments/reviews | Native summary, checks, commits, code, timeline, actors, labels, reviewers    | Native summary, checks, code, timeline, comments, stack context | Code diff/review tab remains materially behind                |
| Review interaction       | Comments, approve/request-changes, reviewer/label edits, plus separate local AI review          | Inline annotations, comments, reactions, reviewer selection, Markdown editing | Comments, Markdown, review timeline and code inspection         | Inline threads, reactions, and rich Markdown remain           |
| PR merge                 | Typed GitHub/GitLab mutation with merge/squash/rebase and branch deletion                       | Typed provider capabilities and merge methods                                 | Typed PR operations and capabilities                            | Mutation exists; explicit capability negotiation remains      |
| Tests                    | Good lower-level Git coverage; sparse Git-panel/PR interaction coverage                         | Extensive PR service, provider, and UI tests                                  | Extensive PR service, cache/recovery, and browser tests         | Add contract and interaction coverage                         |

## Findings by priority

### P0 — fixed in this change

1. **Remote action misrouting.** `GitToolV2` resolved an environment-specific API, but child panels independently called the global `readNativeApi()`. A remote status view could therefore perform mutations against the primary environment. All Git panels and modals now consume the API selected by `GitToolV2`, and the provider is cleared during an environment switch.

2. **Fabricated PR comments.** The PR panel generated a successful GitHub Actions comment after a timer without querying any provider. The comments affordance has been removed until real timeline data exists.

3. **False authentication success.** The device-auth modal closed after an unsuccessful or failed verification. It now remains open, reports the real failure, and closes only after the environment reports GitHub authentication.

4. **Placeholder AI presented as real AI.** Commit-message buttons used file names after an artificial delay. They now invoke the real diff-summary operation. The static review-rule template is now labeled “Use suggested rules” instead of “Improve with AI.”

### P1 — next implementation slice

1. **Provider-neutral PR domain — substantially completed.** Tabs now carries provider identity, draft state, author, labels, review decision, mergeability, aggregate and individual checks, commits, comments, reviews, reviewers, body, and change totals. Pagination and an explicit provider-capability object remain.

2. **Native PR detail workspace — partially completed.** Summary, Checks, Commits, and Activity are implemented with accessible tab semantics and real provider data. Add the Code tab with provider diff files, inline threads, and review annotations. Preserve Tabs' existing local AI Review panel as a complementary workflow.

3. **Typed PR mutation — GitHub and GitLab implemented.** The repository remote now selects the provider before list, detail, creation, or mutation. Both adapters pass argument arrays directly to their CLI and GitLab normalizes real MR metadata into the shared model. GitLab deliberately rejects the unsupported request-changes verdict. Azure DevOps and Bitbucket adapters remain, along with a fuller self-hosted-provider refinement step.

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

1. **Finish read-only parity:** pagination plus provider-backed PR file/diff data and a Code tab.
2. **Finish review parity:** inline annotations/threads, reactions, and rich Markdown editing; basic comments, review submission, and reviewer management already work.
3. **Finish mutation parity:** add an explicit provider-capability contract and use it to gate the implemented create, merge-method, close/reopen, label, reviewer, and review actions.

T3 Code is the stronger reference for multi-provider contracts, review filters, annotations, reactions, and merge capabilities. Synara is the stronger reference for stack context, repository inventory, project pinning/recovery, request coalescing, and its cohesive docked PR workflow. Tabs should port those strengths without replacing its more capable general Git workspace.

## Release gate

The Git tool should not be described as PR-parity complete until pagination, the native Code review surface, inline collaboration, and provider-capability gating are implemented and tested against at least GitHub plus one non-GitHub provider. The current implementation is a broad Git client with a real GitHub/GitLab PR management workspace, not yet a complete collaborative PR-review client.
