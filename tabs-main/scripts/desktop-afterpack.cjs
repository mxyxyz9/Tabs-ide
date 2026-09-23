"use strict";

/**
 * electron-builder afterPack hook.
 *
 * electron-builder drops nested `node_modules` from the `extraFiles` copy of
 * `tabs-code-main`, which removes dependencies used by native main-process
 * services and built-in extensions.
 *
 * This hook runs after the app directory is packed but before platform signing
 * and installer assembly, and restores the runtime `node_modules` into the
 * packaged `resources/tabs-code-main`.
 *
 * On macOS this must happen here, before electron-builder applies the Developer
 * ID signature. Mutating and ad-hoc signing the app during DMG assembly changes
 * its Keychain identity and triggers a login-password prompt on startup.
 */

const fs = require("node:fs");
const path = require("node:path");
const { sanitizeMacAppSymlinks } = require("./mac-symlink-sanitizer.cjs");

/** @param {{ appOutDir: string, electronPlatformName: string, packager: any }} context */
module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName; // 'darwin' | 'win32' | 'linux' | 'mas'
  const productFilename = context.packager?.appInfo?.productFilename;
  const resourcesDir =
    platform === "darwin" || platform === "mas"
      ? path.join(context.appOutDir, `${productFilename}.app`, "Contents", "Resources")
      : path.join(context.appOutDir, "resources");
  const runtimeDir = path.join(resourcesDir, "tabs-code-main");

  // Thin builds (or any build without the bundled runtime) have no
  // tabs-code-main directory — nothing to restore.
  if (!fs.existsSync(runtimeDir)) {
    if (platform === "darwin" || platform === "mas") {
      const appPath = path.join(context.appOutDir, `${productFilename}.app`);
      if (fs.existsSync(appPath)) {
        sanitizeMacAppSymlinks(appPath);
      }
    }
    return;
  }

  const target = path.join(runtimeDir, "node_modules");
  const requiredModule = path.join("minimist", "index.js");
  if (fs.existsSync(target)) {
    if (!fs.existsSync(path.join(target, requiredModule))) {
      throw new Error(`[afterPack] Bundled Code OSS runtime is missing node_modules/${requiredModule}.`);
    }
    // Already present (e.g. electron-builder kept it) — still sanitize symlinks on mac.
    if (platform === "darwin" || platform === "mas") {
      const appPath = path.join(context.appOutDir, `${productFilename}.app`);
      if (fs.existsSync(appPath)) {
        sanitizeMacAppSymlinks(appPath);
      }
    }
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
    throw new Error(`[afterPack] Bundled Code OSS runtime node_modules source not found at ${source}.`);
  }
  if (!fs.existsSync(path.join(source, requiredModule))) {
    throw new Error(`[afterPack] Bundled Code OSS runtime source is missing node_modules/${requiredModule}.`);
  }

  console.log(
    "[afterPack] Restoring tabs-code-main/node_modules into packaged resources " +
      "(dropped by electron-builder extraFiles)...",
  );
  // Copy symlinks as-is (no dereference) to avoid failing on dangling links.
  fs.cpSync(source, target, { recursive: true });
  if (!fs.existsSync(path.join(target, requiredModule))) {
    throw new Error(`[afterPack] Bundled Code OSS runtime copy is missing node_modules/${requiredModule}.`);
  }

  if (platform === "darwin" || platform === "mas") {
    const appPath = path.join(context.appOutDir, `${productFilename}.app`);
    if (fs.existsSync(appPath)) {
      sanitizeMacAppSymlinks(appPath);
    }
  }
};
