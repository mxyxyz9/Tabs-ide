import * as Path from "node:path";

import { describe, expect, it } from "vitest";

import { filePathFromNativeUri, getNativeCodeOpenTargets } from "./nativeCodeHostOpen";

describe("native Code-OSS open targets", () => {
  it("revives file URI components without losing spaces or unicode", () => {
    expect(
      filePathFromNativeUri({
        scheme: "file",
        authority: "",
        path: "/tmp/My%20Project/%E2%9C%93.ts",
      }),
    ).toBe(Path.join(Path.sep, "tmp", "My Project", "✓.ts"));
  });

  it("routes files to the current project and folders/workspaces to Tabs", () => {
    expect(
      getNativeCodeOpenTargets([
        { fileUri: { scheme: "file", path: "/tmp/file.ts" } },
        { folderUri: { scheme: "file", path: "/tmp/project" } },
        { workspaceUri: { fsPath: "/tmp/example.code-workspace" } },
      ]),
    ).toEqual([
      { kind: "file", path: "/tmp/file.ts" },
      { kind: "folder", path: "/tmp/project" },
      { kind: "workspace", path: "/tmp/example.code-workspace" },
    ]);
  });

  it("rejects non-file schemes", () => {
    expect(filePathFromNativeUri({ scheme: "https", path: "/example" })).toBeNull();
  });
});
