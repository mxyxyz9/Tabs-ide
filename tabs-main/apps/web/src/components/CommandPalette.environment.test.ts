import { describe, expect, it } from "vitest";

import type { Project, Thread } from "../types";
import { resolveCommandPaletteWorkspaceContext } from "./CommandPalette.logic";

describe("resolveCommandPaletteWorkspaceContext", () => {
  it("does not select a same-id thread or project from another environment", () => {
    const localProject = { id: "project-1", environmentId: "local", cwd: "/local" } as Project;
    const remoteProject = { id: "project-1", environmentId: "remote", cwd: "/remote" } as Project;
    const localThread = {
      id: "thread-1",
      projectId: "project-1",
      environmentId: "local",
    } as Thread;
    const remoteThread = {
      id: "thread-1",
      projectId: "project-1",
      environmentId: "remote",
    } as Thread;

    expect(
      resolveCommandPaletteWorkspaceContext({
        projects: [localProject, remoteProject],
        threads: [localThread, remoteThread],
        threadId: "thread-1",
        environmentId: "remote",
      }),
    ).toEqual({ project: remoteProject, thread: remoteThread });
  });
});
