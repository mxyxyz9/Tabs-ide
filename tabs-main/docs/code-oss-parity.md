# Code-OSS parity contract

Tabs embeds Code-OSS as its IDE workbench. The integration follows one rule:

> If behavior does not conflict with Tabs' application shell, preserve the
> upstream Code-OSS implementation and user preference.

## Intentional differences

Only the following behavior is intentionally owned by Tabs:

- application window and project-tab lifecycle, including New Window and Quit;
- the outer title bar, activity rail, application menu, and Tabs branding;
- project selection and restoration across Tabs project tabs;
- application updates, release notes, telemetry policy, and workspace trust;
- visibility of the outer Tabs/Copilot provider surfaces; and
- safe routing between the outer shell and the active embedded workbench.

These differences must stay explicit and covered by integration tests.

## Behavior that remains native

Code-OSS continues to own editor tabs, Explorer, Search, Source Control, Run and
Debug, extensions, terminal, command palette, context menus, clipboard and file
commands, editor preferences, notifications, authentication prompts,
extension-contributed views, keybindings, and accessibility behavior.

The integration must not duplicate those features or rewrite their ordinary
settings. A deviation in these areas is a compatibility defect, not product
customization.

## Updating the Code-OSS fork

Keep Microsoft VS Code as an `upstream` remote and the Tabs fork as the push
remote. Update on a dedicated branch; do not merge a new upstream revision into
a dirty checkout.

```bash
cd ../tabs-code-main
git fetch upstream
git switch -c chore/sync-vscode-<version>
git merge <reviewed-upstream-ref>
npm install
npm run compile
npm run typecheck-client
```

Resolve conflicts only in the documented Tabs integration surface. Treat new
conflicts elsewhere as a signal that the patch boundary has expanded and needs
review.

For production packaging, build the production extension bundles before the
Tabs artifact:

```bash
cd ../tabs-code-main
npm run compile-extensions-build
npm run gulp compile-copilot-extension-build

cd ../tabs-main
bun install
bun typecheck
bun test
bun run test:desktop-smoke
bun run dist:desktop:dmg:arm64
```

Use the platform-specific artifact command for Intel macOS, Windows, or Linux.
An installed Tabs application never updates merely because source was pulled;
it must be rebuilt and replaced or distributed through a new release.

## Required regression coverage

Before merging an upstream update, verify:

- application launch and first Code tab time;
- project switching, restoration, and session eviction;
- Explorer file operations, Copy Path, save, and clipboard operations;
- command palette, context menus, keyboard navigation, and native editor tabs;
- Git, terminal, search, debug, and extension installation/activation;
- notification dismissal, global Do Not Disturb, and per-source filters across projects;
- GitHub, Copilot, Claude, and Codex authentication and callback routing;
- stable Chat, Claude Code, and Codex view registration; and
- Tabs-owned New Window, Quit, outer navigation, and update behavior.
