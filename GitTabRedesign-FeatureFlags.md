# Git Tab Redesign — Feature Flags

Cross-referencing `GitTabRedesign.jsx` against Antigravity's context report on the
real `GitTool`. The real tool is already fully functional (real `git`/`gh` commands
via `api.git.*`) — most of the prototype is a straight reskin of that. This file
lists the parts that **aren't** a straight reskin: either the backend doesn't
appear to support them yet, or they're new client-side orchestration that's safe
to build from existing primitives. Confirm the first group with Antigravity before
implementing; the second group just needs wiring.

---

## A. Needs backend confirmation — may require new work, not just rewiring

| # | Feature | Prototype action(s) | Why it's flagged |
|---|---|---|---|
| 1 | Init or clone from the "not a repo yet" state | `initRepo`, `cloneRepo` | `GitEnvironmentGate` is described as *blocking* on "not a repo" — unclear if it already offers an inline fix, or just tells the user to do it themselves outside the app. |
| 2 | Git worktrees | `createWorktree`, `removeWorktree` | `git worktree` support isn't mentioned anywhere in the report. Likely a genuinely new capability. |
| 3 | Distinct "not authenticated" / "no repo access" gate states | `notAuthed`, `noAccess` scenarios | The report describes the gate as `loading → not installed → not a repo → children` — no auth or access-denied state. May need adding to the gate itself. |
| 4 | Credential/account mismatch detection | `checkCredentialMatch`, `mismatch` scenario | Detects that the signed-in `gh` account doesn't match what the repo needs (e.g. SSH key resolves to a different account than the GitHub account in use). No mention of this existing. |
| 5 | Large-diff handling (250+ changed files) | `huge` scenario | A performance/UX path for huge diffs, not just a UI state — needs real-world testing against an actual large diff, not just a mock. |
| 6 | Remote management | `addRemote`, `removeRemote` | Not in the `api.git.*` list from the report at all. |
| 7 | Git identity settings | `updateIdentity` (git config `user.name`/`user.email`) | Not mentioned. May need a new method, or may already exist under a different name — worth asking directly. |
| 8 | `.gitignore` editing | `updateGitignore` | Not mentioned. Might be able to reuse the existing file-write API already used by `onOpenFileInCode` instead of a dedicated git method. |
| 9 | Creating a commit | `commit` | The report only lists `amendCommit`/`undoLastCommit`/`revertCommit` — no plain "create a new commit" method surfaced. `GitCommitComposer.tsx` must do this somehow; find out how before assuming a new method is needed. |
| 10 | Opening a pull request | `createPR` | Not in `api.git.*`. Likely goes through `gh pr create` in the terminal, or a separate GitHub-specific API surface — needs confirming which. |
| 11 | Bulk conflict resolution | `setConflictResolutions` ("accept all current" / "accept all incoming") | Confirm whether the real `resolveConflict` method supports a bulk/all-files call, or only resolves one file at a time. The new UI's one-click bulk actions depend on this. |
| 12 | Reset to a specific commit | `resetTo` (soft/mixed/hard) | Not confirmed to exist as a distinct method. |
| 13 | Force push | `forcePush` | Confirm whether `push` takes a force flag, and whether a confirmation step already exists server-side or needs to live entirely in the UI. |
| 14 | Fetch without pulling | `fetch` | Only `push`/`pull` were listed explicitly — confirm `fetch` exists separately or folds into `pull`. |

---

## B. Client-side orchestration only — composed from existing real primitives, no new backend method needed

| # | Feature | Notes |
|---|---|---|
| 15 | "Stash, pull & reapply" guided flow | Composed from three already-real primitives: `saveStash` → `pull` → `applyStash`, with conflict detection reusing whatever `resolveConflict` already returns on a failed apply. No new backend surface — just sequencing existing calls and reusing the existing conflict resolver UI. |
| 16 | Choosing which branch to pull from within that flow | Just a different argument to the same real `pull` call (pull `origin/<chosen-branch>` instead of the current branch's own tracked remote). No backend change. |
| 17 | "Stash current changes" as a direct action inside the Stashes tab | Already exists as `saveStash` per the report — this only adds a second entry point to it (previously only reachable from the Changes tab), not new backend behavior. |

---

## C. Resolved in this session — design corrected, still needs backend mapping

| # | Feature | What changed |
|---|---|---|
| 18 | Multi-account connect / switch / remove / rename | Originally had the user type their own GitHub username to "connect" an account, which isn't how `gh auth login`'s device flow works (GitHub tells you who authenticated — you don't type it). Also conflated "sign out" with "permanently disconnect," which could leave the app in a broken state. Redesigned to match real `gh` semantics: **Connect** = device flow, no typed username, backend tells us who signed in. **Switch** = swap the active account among already-authenticated ones (maps to `gh auth switch`, no re-auth needed). **Remove** = fully disconnects (`gh auth logout`), separate from switching, with safe fallback if the removed account was active. Still needs the actual `connectAccount`/`switchAccount`/`removeAccount` calls wired to `gitHubSwitchAccount`/`gitHubLogout` and whatever backs the initial `gh auth login` device flow — the *design* is now correct, the wiring in item A still applies to whatever's net-new here (e.g. is there a "list all locally authenticated accounts" call, or does the report's `gitHub.accounts[]` from `environment` already cover it?). |

---

## Suggested next step

Give Antigravity section **A** as a direct checklist — for each row, confirm
"exists under a different name," "needs a new WS method + `wsNativeApi.ts` entry +
`gitReactQuery.ts` factory," or "not needed, drop the feature." Section **B** can
be implemented immediately regardless of A's answers, since it doesn't touch the
backend. Section **C** just needs its real API calls filled in once A's answers
for items 6, 7, and 10 (which affect account/remote handling) come back.
