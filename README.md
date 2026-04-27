# Tabs

Tabs is a minimal web GUI for coding agents (currently Codex and Claude, more coming soon).

## How to use

> [!WARNING]
> You need to have [Codex CLI](https://github.com/openai/codex) installed and authorized for Tabs to work.

```bash
npx tabs
```

You can also just install the desktop app. It's cooler.

Install the [desktop app from the Releases page](https://github.com/pingdotgg/tabs/releases)

## Embedded VS Code in the desktop app

The desktop Code tab prefers a local `vscode-main` checkout built for the desktop Electron renderer.
T3 boots the stock desktop workbench inside its Code tab instead of loading the web workbench first.

From the sibling VS Code checkout:

```bash
cd ../vscode-main
npm install
npm run compile
```

T3 will auto-detect `../vscode-main` and expects these compiled assets:

- `out/vs/base/parts/sandbox/electron-browser/preload.js`
- `out/vs/code/electron-browser/workbench/workbench.html`
- `out-build/nls.messages.json`

You can also override detection with:

- `TABS_CODE_OSS_BUILD_DIR`: absolute path to the local `vscode-main` checkout root
- `TABS_CODE_OSS_ENTRY`: absolute `http://` or `https://` URL for an already running VS Code web workbench if you explicitly want that mode

## Some notes

We are very very early in this project. Expect bugs.

We are not accepting contributions yet.

## If you REALLY want to contribute still.... read this first

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
