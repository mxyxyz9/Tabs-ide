import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_TOOL_ORDER,
  ProjectWorkspaceSessionState,
  ProjectWorkspaceSettings,
  ServerSettings,
} from "./settings";

const decodeProjectWorkspaceSettings = Schema.decodeUnknownSync(ProjectWorkspaceSettings);
const decodeProjectWorkspaceSessionState = Schema.decodeUnknownSync(ProjectWorkspaceSessionState);
const decodeServerSettings = Schema.decodeUnknownSync(ServerSettings);

describe("ServerSettings", () => {
  it("defaults always-create-tasks to false", () => {
    const parsed = decodeServerSettings({});

    expect(parsed.alwaysCreateTasks).toBe(false);
  });
});

describe("ProjectWorkspaceSettings", () => {
  it("provides the default shell tool order with visible tabs", () => {
    const parsed = decodeProjectWorkspaceSettings({});

    expect(parsed.tools.map((tool) => tool.id)).toEqual(DEFAULT_PROJECT_TOOL_ORDER);
    expect(parsed.tools.every((tool) => tool.visible)).toBe(true);
    expect(parsed.browser.defaultUrl).toBe("");
    expect(parsed.serverProcesses).toEqual([]);
    expect(parsed.customEmbeds).toEqual([]);
  });

  it("accepts custom embed toolbar entries", () => {
    const parsed = decodeProjectWorkspaceSettings({
      customEmbeds: [
        {
          id: "designs",
          label: "Designs",
          url: "https://figma.example.com/file/123",
        },
      ],
      tools: [
        {
          id: "agents",
          kind: "agents",
          label: "Agents",
          visible: true,
        },
        {
          id: "embed-designs",
          kind: "custom_embed",
          label: "Designs",
          visible: true,
          customEmbedId: "designs",
        },
      ],
    });

    expect(parsed.customEmbeds[0]?.id).toBe("designs");
    expect(parsed.tools[1]?.customEmbedId).toBe("designs");
  });

  it("allows draft custom tabs and terminal commands while editing settings", () => {
    const parsed = decodeProjectWorkspaceSettings({
      customEmbeds: [
        {
          id: "draft-tab",
          label: "Draft Tab",
          url: "",
        },
      ],
      serverProcesses: [
        {
          id: "draft-terminal",
          label: "Draft Terminal",
          commands: [""],
          cwd: "",
          autoStart: false,
        },
      ],
    });

    expect(parsed.customEmbeds[0]?.url).toBe("");
    expect(parsed.serverProcesses[0]?.commands).toEqual([""]);
  });

  it("accepts ordered server command steps", () => {
    const parsed = decodeProjectWorkspaceSettings({
      serverProcesses: [
        {
          id: "frontend",
          label: "Frontend",
          commands: ["npm install", "npm run dev"],
          cwd: "frontend",
          autoStart: true,
        },
      ],
      tools: [
        {
          id: "terminal-frontend",
          kind: "custom_process",
          label: "Frontend",
          visible: true,
          serverProcessId: "frontend",
        },
      ],
    });

    expect(parsed.serverProcesses).toEqual([
      {
        id: "frontend",
        label: "Frontend",
        commands: ["npm install", "npm run dev"],
        cwd: "frontend",
        env: {},
        autoStart: true,
      },
    ]);
    expect(parsed.tools[0]?.serverProcessId).toBe("frontend");
  });
});

describe("ProjectWorkspaceSessionState", () => {
  it("defaults to an empty persisted session", () => {
    const parsed = decodeProjectWorkspaceSessionState({});

    expect(parsed).toEqual({
      openProjectIds: [],
      activeProjectId: null,
      activeToolIdByProjectId: {},
      rememberedThreadIdByProjectId: {},
      activePendingTabId: null,
      pendingTabIds: [],
    });
  });
});
