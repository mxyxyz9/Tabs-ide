# Git Tab — Action → Real Command Reference

Every action in `GitTabRedesign.jsx`'s `actions` object, mapped to the real
`git`/`gh` command(s) it should execute once wired to the real backend. Use
this alongside `GitTabRedesign-FeatureFlags.md` — this file tells you *what
command to run*, the flags file tells you *what's already confirmed to exist
vs. needs new backend work*.

## Sync

| Action | Command |
|---|---|
| `fetch` | `git fetch <remote>` |
| `pull` | `git pull <remote> <branch>` — must NOT run if there are uncommitted changes (`git status --porcelain` non-empty); surface git's own "Please commit your changes or stash them" error instead of attempting a pull. Detect a resulting conflict via non-zero exit code + `git status` showing `UU`/unmerged paths. |
| `push` | `git push <remote> <branch>` — a non-fast-forward rejection (exit code 1, stderr contains `[rejected]` / `fetch first`) must surface as "pull first," not a generic error. |
| `forcePush` | `git push --force-with-lease <remote> <branch>` (prefer `--force-with-lease` over bare `--force` — it fails safely if someone else pushed in the meantime, which bare `--force` would silently clobber) |

## Changes / Commit

| Action | Command |
|---|---|
| `stageFile(path)` / `stageAll` | `git add <path>` / `git add -A` |
| `unstageFile(path)` / `unstageAll` | `git restore --staged <path>` / `git restore --staged .` |
| `discardFile(path)` / `discardAll` | `git restore <path>` (unstaged edits) or `git checkout -- <path>`; for untracked files use `git clean -f <path>` |
| `commit(message)` | `git commit -m "<message>"` |
| `commit(message, amend=true)` | `git commit --amend -m "<message>"` (or `--amend --no-edit` if message is unchanged). If the commit being amended is already on the remote (i.e. `git rev-parse @{u}` equals the pre-amend `HEAD`), the next push must be `--force-with-lease`, not a plain push — surface this in the UI exactly like the prototype now does. |
| `commitAndPush` | commit, then push (see push's rejection handling above — don't swallow a push failure after a successful commit) |

## Branches

| Action | Command |
|---|---|
| `createBranch(name)` | `git checkout -b <name>` — first check `git show-ref --verify refs/heads/<name>` to reject duplicates with the same message git would give (`fatal: A branch named '<name>' already exists.`) |
| `checkoutBranch(name)` | `git checkout <name>` — refuse first if `git status --porcelain` is non-empty (matches the prototype's existing "commit or stash first" check) |
| `renameBranch(name)` | `git branch -m <name>` — if the old name was already pushed, the UI should say so (already implemented in the prototype) and the actual push-the-rename step is `git push <remote> -u <name>` followed by `git push <remote> --delete <old-name>` |
| `deleteBranch(name)` | Safe: `git branch -d <name>` (fails with a message if unmerged — surface that as the "not fully merged" warning). Force: `git branch -D <name>` |
| `mergeBranch(name)` | `git merge <name>` — non-zero exit + `git status` showing unmerged paths means conflict; drop into the same conflict resolver as pull |
| `createWorktree({base, branch, path})` | `git worktree add <path> <branch>` (existing branch) or `git worktree add -b <branch> <path> <base>` (new branch). `git worktree list --porcelain` first to reject a branch that's already checked out somewhere, matching the prototype's new pre-check. |
| `removeWorktree(path)` | `git worktree remove <path>` (add `--force` only if the worktree has uncommitted changes and the user confirms) |

## History

| Action | Command |
|---|---|
| `revertCommit(commit)` | `git revert <sha>` (use `--no-edit` for a one-click revert, or open the message editor if you want to match the "let the user edit" pattern) |
| `cherryPick(commit)` | `git cherry-pick <sha>` — non-zero exit means conflict, same conflict-resolver path |
| `resetTo(commit, mode)` | `git reset --soft <sha>` / `git reset --mixed <sha>` (default, no flag needed) / `git reset --hard <sha>`. Compare `<sha>`'s position against `@{u}` (upstream) first — if you're resetting past commits that are already on the remote, flag `historyRewritten` exactly like the prototype does, so the next push is forced. |

## Pull requests (via `gh`, not plain `git`)

| Action | Command |
|---|---|
| `createPR({title, base, body, draft})` | `gh pr create --title "<title>" --base <base> --body "<body>" [--draft]`. Check `gh pr list --head <current-branch> --base <base> --state open` first to reject duplicates. |
| `readyForReview(n)` | `gh pr ready <n>` |
| `mergePR(n, method)` | `gh pr merge <n> --merge` / `--squash` / `--rebase` (map the UI's method dropdown 1:1 to these flags) |
| `closePR(n)` | `gh pr close <n>` |
| `reopenPR(n)` | `gh pr reopen <n>` (note: real GitHub only allows reopening a *closed* PR, not a *merged* one — the prototype's UI already only shows Reopen for `closed` state, keep that restriction) |

## Tags & releases

| Action | Command |
|---|---|
| `createTag(name)` | `git tag <name>` (check `git tag -l <name>` first to reject duplicates), then `git push <remote> <name>` if it should be pushed immediately, or leave local until a release is published |
| `publishRelease({tag, title, notes, prerelease})` | `gh release create <tag> --title "<title>" --notes "<notes>" [--prerelease] [--target <branch>]` — creates the tag too if it doesn't exist yet |

## Stashes

| Action | Command |
|---|---|
| `stashChanges(message)` | `git stash push -m "<message>"` (or `git stash push` with no message) |
| `applyStash(ref)` | `git stash apply <ref>` (prototype uses apply, not pop, elsewhere — keep that so a failed apply due to conflicts doesn't lose the stash entry) |
| `dropStash(ref)` | `git stash drop <ref>` |
| `stashPullReapply(sourceBranch)` | Composed, not a single command — exactly as the prototype now does it: <br>1. `git stash push` (only if `git status --porcelain` is non-empty) <br>2. `git pull <remote> <sourceBranch>` <br>3. `git stash pop` (use pop here, not apply — you want the stash removed on success; on conflict, `git stash pop` leaves the stash entry intact and drops you into conflict-resolution state, which is exactly the behavior the prototype models) |

## Accounts (`gh` device flow — see the login/logout section below for the exact commands)

| Action | Command |
|---|---|
| `connectAccount()` | `gh auth login --hostname github.com --git-protocol ssh --web` (or omit `--web` for the device-code flow the prototype's UI shows). After it completes, `gh api user --jq .login` tells you who actually authenticated — that's what populates the account list, never a typed-in username. |
| `switchAccount(login)` | `gh auth switch --hostname github.com --user <login>` — this is instant, no re-authentication, exactly as the prototype models it |
| `removeAccount(login)` | `gh auth logout --hostname github.com --user <login>` |
| `signInGitHub()` | Same as `connectAccount` — the only difference is UI context (first-time sign-in vs. adding an additional account); the underlying command is identical |
| `checkCredentialMatch()` | Compare `gh api user --jq .login` (the active `gh` account) against `ssh -T git@github.com` (git's stderr response identifies the SSH-authenticated user, e.g. `Hi <username>! You've successfully authenticated`) — a mismatch between these two is exactly the "credential mismatch" state |

## Remotes & repo-level settings

| Action | Command |
|---|---|
| `addRemote({name, url})` | `git remote add <name> <url>` — this command itself already errors with `fatal: remote <name> already exists` if the name is taken, so the duplicate-check the prototype now does client-side is just anticipating that error, not inventing new behavior |
| `removeRemote(name)` | `git remote remove <name>` |
| `updateIdentity({name, email})` | `git config user.name "<name>"` and `git config user.email "<email>"` — use `--local` (the default when run inside a repo) so it's scoped to this project, not `--global` |
| `updateGitignore(text)` | Plain file write to `<repo>/.gitignore` — reuse whatever file-write API the app already uses elsewhere (e.g. for `onOpenFileInCode`), no git command needed |
| `initRepo(name, branch)` | `git init -b <branch>` |
| `cloneRepo(name, url)` | `git clone <url> <name>` |
| `checkGitAgain()` | Re-run whatever detection check gates the tool (likely `git --version`) |

## Conflict resolution

| Action | Command |
|---|---|
| Per-file resolve ("ours"/"theirs") | `git checkout --ours <path>` / `git checkout --theirs <path>`, then `git add <path>` |
| Bulk "accept all current" | `git checkout --ours .` across all unmerged paths, then `git add -A` |
| Bulk "accept all incoming" | `git checkout --theirs .` across all unmerged paths, then `git add -A` |
| Manual edit + resolve | User edits the file directly (conflict markers), then `git add <path>` |
| `continueMerge` | `git commit` (no message needed if merging — git pre-fills the merge commit message) — or `git rebase --continue` / `git cherry-pick --continue` depending on which operation is in progress; check `.git/MERGE_HEAD` vs `.git/rebase-merge` vs `.git/CHERRY_PICK_HEAD` to know which |
| `abortMerge` | `git merge --abort` (or `git rebase --abort` / `git cherry-pick --abort` — same detection as above) |

---

**On login/logout specifically, since these get asked about most:**

- **Log in (first account or additional):** `gh auth login` — interactively prompts for host, protocol, and auth method; for the device-code flow specifically (what the prototype's modal shows), it's `gh auth login --hostname github.com --web=false` or just letting `gh auth login` default to device flow when not in a browser-capable context. The code shown in the modal is real — it comes from `gh`'s own output during this flow, not something the app generates itself.
- **Switch active account (already connected):** `gh auth switch --hostname github.com --user <login>` — no re-authentication, this is instant.
- **List connected accounts:** `gh auth status` (human-readable) or `gh api user --jq .login` for just the current one.
- **Log out / disconnect an account:** `gh auth logout --hostname github.com --user <login>`.
- **Fallback if `gh` isn't installed at all:** the app should detect this (`gh --version` failing) and show a distinct "GitHub CLI not installed" state — separate from "not authenticated" — with a link to https://cli.github.com. Git operations that don't need GitHub specifically (commit, push, pull, branches, stashes) should still work via plain `git` even without `gh` installed; only PR/release/account features need `gh`.
