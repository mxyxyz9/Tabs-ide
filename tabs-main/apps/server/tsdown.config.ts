import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  checks: {
    legacyCjs: false,
  },
  outDir: "dist",
  sourcemap: true,
  clean: true,
  // Bundle internal workspace packages into the server output so the packaged
  // desktop app doesn't need to resolve `workspace:*` deps at runtime. This
  // covers the `@tabs/*` packages plus the (unscoped) `effect-acp` and
  // `effect-codex-app-server` workspace packages.
  deps: {
    alwaysBundle: (id) =>
      id.startsWith("@tabs/") ||
      id === "effect-acp" ||
      id.startsWith("effect-acp/") ||
      id === "effect-codex-app-server" ||
      id.startsWith("effect-codex-app-server/"),
  },
  banner: {
    js: "#!/usr/bin/env node\n",
  },
});
