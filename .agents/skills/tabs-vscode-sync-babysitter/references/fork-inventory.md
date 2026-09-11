# Tabs Code-OSS fork inventory

This is the minimum known patch surface after the 1.135.0 refresh. Re-derive the actual delta from Git at every update; add or remove entries only after reviewing their history and current upstream equivalent.

## Tabs-owned Code-OSS additions

- `tabs-code-main/TABS_ARCHITECTURE.md`
- `tabs-code-main/src/vs/workbench/contrib/tabs/`
- `tabs-code-main/src/vs/workbench/browser/parts/editor/media/tabs-logo.svg`

## Modified upstream integration files

- bootstrap and preload: `src/bootstrap-import.ts`, `src/bootstrap-node.ts`, `src/vs/base/parts/sandbox/electron-browser/preload.ts`
- workbench startup/registration: `src/vs/code/browser/workbench/workbench.ts`, `src/vs/code/electron-browser/workbench/workbench.ts`, `src/vs/workbench/browser/workbench.ts`, `src/vs/workbench/workbench.common.main.ts`
- native services: context menus, utility processes, terminal request lifecycle, extension signature verification, and notification preferences
- embedded chrome: layout, activity bar, auxiliary bar, editor watermark/tab styling, extension icons, SCM input, chat participant registration, and webview view panes
- runtime/build metadata: `product.json`, root `package.json`, `build/.moduleignore`, and production Copilot packaging inputs

## Tabs-side compatibility boundary

Always review these alongside fork changes:

- `tabs-main/apps/desktop/src/codeHostManager.ts`
- `tabs-main/apps/desktop/src/nativeCodeHostMain.ts`
- `tabs-main/apps/desktop/src/browserHostManager.ts`
- `tabs-main/apps/desktop/resources/code-oss-extensions/tabs-workbench-integration/`
- `tabs-main/apps/web/src/components/WorkspaceShell.tsx`
- `tabs-main/apps/web/src/components/code/`
- `tabs-main/apps/web/src/nativeSurfaceOverlay.ts`
- `tabs-main/scripts/build-desktop-artifact.ts`
- `.github/workflows/build-desktop.yml` and `.github/workflows/release.yml`

## Historical commits worth reading

- `465fc5d5` and `3eeb55ca`: prior upstream Code-OSS refreshes
- `c7e2785b`, `23e0d0b4`, `b7db557c`, `737f4ee0`: bootstrap, extension host, webview, and provider integration
- `79c64cb8`, `7f56447f`: embedded workbench/native host stabilization
- `7a3d2341`, `4f622f75`: assistant view registration and shared notification preferences
- `af4969d0`, `7e0a7c4c`, and the later notification-overlay correction: native surface lifecycle and overlay behavior

Use `git show <commit> -- <path>` to recover intent. Commit messages alone are not sufficient evidence for replaying a patch.
