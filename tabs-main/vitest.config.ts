import { createRequire } from "node:module";
import * as path from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const vitestDir = path.dirname(require.resolve("vitest"));
const runnerEntry = require.resolve("@vitest/runner", { paths: [vitestDir] });

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@vitest\/runner$/,
        replacement: runnerEntry,
      },
      {
        find: /^@tabs\/contracts$/,
        replacement: path.resolve(import.meta.dirname, "./packages/contracts/src/index.ts"),
      },
      {
        find: /^~\/(.*)$/,
        replacement: path.resolve(import.meta.dirname, "./apps/web/src/$1"),
      },
    ],
  },
  test: {
    server: {
      deps: {
        inline: ["@effect/vitest"],
      },
    },
  },
});
