"use strict";

/**
 * electron-builder afterPack hook.
 *
 * electron-builder drops nested `node_modules` from the `extraFiles` copy of
 * `tabs-code-main`, so the packaged Code-OSS server (`out/server-main.js`) fails
 * at runtime on `import minimist from 'minimist'` with
 * `ERR_MODULE_NOT_FOUND: Cannot find package 'minimist'`.
 *
 * This hook runs after the app directory is packed but before the installer
 * (nsis / AppImage / dmg) is assembled, and restores the runtime `node_modules`
 * into the packaged `resources/tabs-code-main`.
 *
 * macOS is intentionally skipped here: its DMG is rebuilt from a verified ZIP
 * payload in `createMacDmgFromZip`, which performs the same restore.
 */

const fs = require("node:fs");
const path = require("node:path");

/** @param {{ appOutDir: string, electronPlatformName: string, packager: any }} context */
module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName; // 'darwin' | 'win32' | 'linux' | 'mas'
  if (platform === "darwin" || platform === "mas") {
    return;
  }

  // Windows and Linux place app resources under `<appOutDir>/resources`.
  const resourcesDir = path.join(context.appOutDir, "resources");
  const runtimeDir = path.join(resourcesDir, "tabs-code-main");

  // Thin builds (or any build without the bundled runtime) have no
  // tabs-code-main directory — nothing to restore.
  if (!fs.existsSync(runtimeDir)) {
    return;
  }

  const target = path.join(runtimeDir, "node_modules");
  if (fs.existsSync(target)) {
    // Already present (e.g. electron-builder kept it) — leave it alone.
    return;
  }

  const projectDir =
    (context.packager && context.packager.info && context.packager.info.projectDir) ||
    process.cwd();
  const source = path.join(
    projectDir,
    "apps",
    "desktop",
    "resources",
    "tabs-code-main",
    "node_modules",
  );

  if (!fs.existsSync(source)) {
    console.warn(
      `[afterPack] Runtime node_modules source not found at ${source}; ` +
        "skipping tabs-code-main/node_modules restore. The packaged Code-OSS " +
        "server will fail to start.",
    );
    return;
  }

  console.log(
    "[afterPack] Restoring tabs-code-main/node_modules into packaged resources " +
      "(dropped by electron-builder extraFiles)...",
  );
  // Copy symlinks as-is (no dereference) to avoid failing on dangling links.
  fs.cpSync(source, target, { recursive: true });
};
