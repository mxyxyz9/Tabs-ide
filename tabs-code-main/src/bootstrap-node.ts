/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import type { IProductConfiguration } from './vs/base/common/product.js';

const require = createRequire(import.meta.url);
const isWindows = process.platform === 'win32';

// increase number of stack frames(from 10, https://github.com/v8/v8/wiki/Stack-Trace-API)
Error.stackTraceLimit = 100;

if (!process.env['VSCODE_HANDLES_SIGPIPE']) {
	// Workaround for Electron not installing a handler to ignore SIGPIPE
	// (https://github.com/electron/electron/issues/13254)
	let didLogAboutSIGPIPE = false;
	process.on('SIGPIPE', () => {
		// See https://github.com/microsoft/vscode-remote-release/issues/6543
		// In certain situations, the console itself can be in a broken pipe state
		// so logging SIGPIPE to the console will cause an infinite async loop
		if (!didLogAboutSIGPIPE) {
			didLogAboutSIGPIPE = true;
			console.error(new Error(`Unexpected SIGPIPE`));
		}
	});
}

// Setup current working directory in all our node & electron processes
// - Windows: call `process.chdir()` to always set application folder as cwd
// -  all OS: store the `process.cwd()` inside `VSCODE_CWD` for consistent lookups
function setupCurrentWorkingDirectory(): void {
	try {

		// Store the `process.cwd()` inside `VSCODE_CWD`
		// for consistent lookups, but make sure to only
		// do this once unless defined already from e.g.
		// a parent process.
		if (typeof process.env['VSCODE_CWD'] !== 'string') {
			process.env['VSCODE_CWD'] = process.cwd();
		}

		// Windows: always set application folder as current working dir
		if (process.platform === 'win32') {
			process.chdir(path.dirname(process.execPath));
		}
	} catch (err) {
		console.error(err);
	}
}

setupCurrentWorkingDirectory();

/**
 * Add support for redirecting the loading of node modules
 *
 * Note: only applies when running out of sources.
 */
export function devInjectNodeModuleLookupPath(injectPath: string): void {
	if (!process.env['VSCODE_DEV']) {
		return; // only applies running out of sources
	}

	if (!injectPath) {
		throw new Error('Missing injectPath');
	}

	const Module = require('node:module');
	if (typeof Module.registerHooks === 'function') {
		// Prefer the synchronous in-thread hooks API (Node >= 22.15). The
		// off-thread `Module.register` loader worker can deadlock under
		// Electron-run-as-Node: a synchronous resolve request parks the main
		// thread in the hooks channel's futex wait while the worker never
		// wakes, freezing the whole process on the next dynamic import (this
		// froze every remote extension host in the embedded Tabs runtime).
		// The mapping is a plain table lookup, so it needs no worker at all.
		devRegisterSyncNodeModuleHooks(Module, injectPath);
	} else {
		// register a loader hook
		Module.register('./bootstrap-import.js', { parentURL: import.meta.url, data: injectPath });
	}
}

/**
 * Synchronous equivalent of the mapping in `bootstrap-import.ts`: redirects
 * bare imports of the inject path's package dependencies to that
 * node_modules tree. Keep the resolution logic in sync with
 * `bootstrap-import.ts#initialize`.
 */
function devRegisterSyncNodeModuleHooks(Module: typeof import('node:module'), injectPath: string): void {
	const { fileURLToPath, pathToFileURL } = require('node:url');

	const specifierToUrl: Record<string, string> = {};
	const specifierToFormat: Record<string, string> = {};

	const injectPackageJSONPath = fileURLToPath(new URL('../package.json', pathToFileURL(injectPath)));
	const nodeModulesPath = path.join(injectPackageJSONPath, '../node_modules');
	const packageNames = fs.readdirSync(nodeModulesPath, { withFileTypes: true }).flatMap(entry => {
		if (!entry.isDirectory() || entry.name.startsWith('.')) {
			return [];
		}
		if (!entry.name.startsWith('@')) {
			return [entry.name];
		}
		return fs.readdirSync(path.join(nodeModulesPath, entry.name), { withFileTypes: true })
			.filter(child => child.isDirectory())
			.map(child => `${entry.name}/${child.name}`);
	});
	for (const name of packageNames) {
		try {
			const pkgJsonPath = path.join(injectPackageJSONPath, `../node_modules/${name}/package.json`);
			const pkgJson = JSON.parse(String(fs.readFileSync(pkgJsonPath)));

			// Determine the entry point: prefer exports["."].import for ESM, then main.
			// Handle conditional export targets where exports["."].import/default
			// can be a string or an object with a string `default` field.
			let main: string | undefined;
			if (pkgJson.exports?.['.']) {
				const dotExport = pkgJson.exports['.'];
				if (typeof dotExport === 'string') {
					main = dotExport;
				} else if (typeof dotExport === 'object' && dotExport !== null) {
					const resolveCondition = (v: unknown): string | undefined => {
						if (typeof v === 'string') {
							return v;
						}
						if (typeof v === 'object' && v !== null) {
							const d = (v as { default?: unknown }).default;
							if (typeof d === 'string') {
								return d;
							}
						}
						return undefined;
					};
					main = resolveCondition(dotExport.import) ?? resolveCondition(dotExport.default);
				}
			}
			if (typeof main !== 'string') {
				main = typeof pkgJson.main === 'string' ? pkgJson.main : undefined;
			}

			if (!main) {
				main = 'index.js';
			}
			if (!main.endsWith('.js') && !main.endsWith('.mjs') && !main.endsWith('.cjs')) {
				main += '.js';
			}
			const mainPath = path.join(injectPackageJSONPath, `../node_modules/${name}/${main}`);
			specifierToUrl[name] = pathToFileURL(mainPath).href;
			// Determine module format: .mjs is always ESM, .cjs always CJS, otherwise check type field
			const isModule = main.endsWith('.mjs')
				? true
				: main.endsWith('.cjs')
					? false
					: pkgJson.type === 'module';
			specifierToFormat[name] = isModule ? 'module' : 'commonjs';

		} catch (err) {
			console.error(name);
			console.error(err);
		}
	}

	Module.registerHooks({
		resolve(specifier, context, nextResolve) {
			const newSpecifier = specifierToUrl[specifier];
			if (newSpecifier !== undefined) {
				return {
					format: specifierToFormat[specifier] ?? 'commonjs',
					shortCircuit: true,
					url: newSpecifier
				};
			}
			return nextResolve(specifier, context);
		}
	});

	console.log(`[bootstrap-import] Initialized node_modules redirector (sync hooks) for: ${injectPath}`);
}

export function removeGlobalNodeJsModuleLookupPaths(): void {
	if (typeof process?.versions?.electron === 'string') {
		return; // Electron disables global search paths in https://github.com/electron/electron/blob/3186c2f0efa92d275dc3d57b5a14a60ed3846b0e/shell/common/node_bindings.cc#L653
	}

	const Module = require('module');
	const globalPaths = Module.globalPaths;

	const originalResolveLookupPaths = Module._resolveLookupPaths;

	Module._resolveLookupPaths = function (moduleName: string, parent: unknown): string[] {
		const paths = originalResolveLookupPaths(moduleName, parent);
		if (Array.isArray(paths)) {
			let commonSuffixLength = 0;
			while (commonSuffixLength < paths.length && paths[paths.length - 1 - commonSuffixLength] === globalPaths[globalPaths.length - 1 - commonSuffixLength]) {
				commonSuffixLength++;
			}

			return paths.slice(0, paths.length - commonSuffixLength);
		}

		return paths;
	};

	const originalNodeModulePaths = Module._nodeModulePaths;
	Module._nodeModulePaths = function (from: string): string[] {
		let paths: string[] = originalNodeModulePaths(from);
		if (!isWindows) {
			return paths;
		}

		// On Windows, remove drive(s) and users' home directory from search paths,
		// UNLESS 'from' is explicitly set to one of those.
		const isDrive = (p: string) => p.length >= 3 && p.endsWith(':\\');

		if (!isDrive(from)) {
			paths = paths.filter(p => !isDrive(path.dirname(p)));
		}

		if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
			const userDir = path.dirname(path.join(process.env.HOMEDRIVE, process.env.HOMEPATH));

			const isUsersDir = (p: string) => path.relative(p, userDir).length === 0;

			// Check if 'from' is the same as 'userDir'
			if (!isUsersDir(from)) {
				paths = paths.filter(p => !isUsersDir(path.dirname(p)));
			}
		}

		return paths;
	};
}

/**
 * Helper to enable portable mode.
 */
export function configurePortable(product: Partial<IProductConfiguration>): { portableDataPath: string; isPortable: boolean } {
	const appRoot = path.dirname(import.meta.dirname);

	function getApplicationPath(): string {
		if (process.env['VSCODE_DEV']) {
			return appRoot;
		}

		if (process.platform === 'darwin') {
			return path.dirname(path.dirname(path.dirname(appRoot)));
		}

		// appRoot = ..\Microsoft VS Code Insiders\<version>\resources\app
		if (process.platform === 'win32' && product.win32VersionedUpdate) {
			return path.dirname(path.dirname(path.dirname(appRoot)));
		}

		return path.dirname(path.dirname(appRoot));
	}

	function getPortableDataPath(): string {
		if (process.env['VSCODE_PORTABLE']) {
			return process.env['VSCODE_PORTABLE'];
		}

		if (process.platform === 'win32' || process.platform === 'linux') {
			return path.join(getApplicationPath(), 'data');
		}

		const portableDataName = product.portable || `${product.applicationName}-portable-data`;
		return path.join(path.dirname(getApplicationPath()), portableDataName);
	}

	const portableDataPath = getPortableDataPath();
	const isPortable = !('target' in product) && fs.existsSync(portableDataPath);
	const portableTempPath = path.join(portableDataPath, 'tmp');
	const isTempPortable = isPortable && fs.existsSync(portableTempPath);

	if (isPortable) {
		process.env['VSCODE_PORTABLE'] = portableDataPath;
	} else {
		delete process.env['VSCODE_PORTABLE'];
	}

	if (isTempPortable) {
		if (process.platform === 'win32') {
			process.env['TMP'] = portableTempPath;
			process.env['TEMP'] = portableTempPath;
		} else {
			process.env['TMPDIR'] = portableTempPath;
		}
	}

	return {
		portableDataPath,
		isPortable
	};
}
