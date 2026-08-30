import { MessageId } from "@tabs/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

function matchMedia() {
  return {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

beforeAll(() => {
  const classList = {
    add: () => {},
    remove: () => {},
    toggle: () => {},
    contains: () => false,
  };

  vi.stubGlobal("navigator", {
    userAgent: "node",
  });
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  });
  vi.stubGlobal("window", {
    matchMedia,
    addEventListener: () => {},
    removeEventListener: () => {},
    desktopBridge: undefined,
  });
  vi.stubGlobal("document", {
    documentElement: {
      classList,
      offsetHeight: 0,
    },
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    clearTimeout(id);
  });
});

describe("MessagesTimeline", () => {
  it("renders inline terminal labels with the composer chip UI", async () => {
    const { MessagesTimeline } = await import("./MessagesTimeline");
    const markup = renderToStaticMarkup(
      <MessagesTimeline
        hasMessages
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        scrollContainer={null}
        timelineEntries={[
          {
            id: "entry-1",
            kind: "message",
            createdAt: "2026-03-17T19:12:28.000Z",
            message: {
              id: MessageId.makeUnsafe("message-2"),
              role: "user",
              text: [
                "yoo what's @terminal-1:1-5 mean",
                "",
                "<terminal_context>",
                "- Terminal 1 lines 1-5:",
                "  1 | julius@mac effect-http-ws-cli % bun i",
                "  2 | bun install v1.3.9 (cf6cdbbb)",
                "</terminal_context>",
              ].join("\n"),
              createdAt: "2026-03-17T19:12:28.000Z",
              streaming: false,
            },
          },
        ]}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={new Map()}
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={{}}
        onToggleWorkGroup={() => {}}
        onOpenTurnDiff={() => {}}
        revertTurnCountByUserMessageId={new Map()}
        onRevertUserMessage={() => {}}
        isRevertingCheckpoint={false}
        onImageExpand={() => {}}
        markdownCwd={undefined}
        resolvedTheme="light"
        timestampFormat="locale"
        workspaceRoot={undefined}
        latestTaskDescription={null}
      />,
    );

    expect(markup).toContain("Terminal 1 lines 1-5");
    expect(markup).toContain("lucide-terminal");
    expect(markup).toContain("yoo what&#x27;s ");
  });

  it("renders context compaction entries in the normal work log", async () => {
    const { MessagesTimeline } = await import("./MessagesTimeline");
    const markup = renderToStaticMarkup(
      <MessagesTimeline
        hasMessages
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        scrollContainer={null}
        timelineEntries={[
          {
            id: "entry-1",
            kind: "work",
            createdAt: "2026-03-17T19:12:28.000Z",
            entry: {
              id: "work-1",
              createdAt: "2026-03-17T19:12:28.000Z",
              label: "Context compacted",
              tone: "info",
            },
          },
        ]}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={new Map()}
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={{}}
        onToggleWorkGroup={() => {}}
        onOpenTurnDiff={() => {}}
        revertTurnCountByUserMessageId={new Map()}
        onRevertUserMessage={() => {}}
        isRevertingCheckpoint={false}
        onImageExpand={() => {}}
        markdownCwd={undefined}
        resolvedTheme="light"
        timestampFormat="locale"
        workspaceRoot={undefined}
        latestTaskDescription={null}
      />,
    );

    expect(markup).toContain("Context compacted");
    expect(markup).toContain("Work log");
  });

  it("places each turn's tasks after its assistant response and before the next user message", async () => {
    const { placeTaskRowsAtTurnEnds } = await import("./MessagesTimeline");
    const rows = placeTaskRowsAtTurnEnds([
      {
        id: "user-1",
        kind: "message",
        createdAt: "2026-03-17T19:12:20.000Z",
        message: {
          id: MessageId.makeUnsafe("user-1"),
          role: "user",
          text: "First prompt marker",
          createdAt: "2026-03-17T19:12:20.000Z",
          streaming: false,
        },
        durationStart: "2026-03-17T19:12:20.000Z",
        showCompletionDivider: false,
      },
      {
        id: "tasks-turn-1",
        kind: "tasks",
        createdAt: "2026-03-17T19:12:21.000Z",
        tasks: [
          {
            taskId: "task-1",
            description: "First task",
            status: "completed",
            startedAt: "2026-03-17T19:12:21.000Z",
          },
          {
            taskId: "task-2",
            description: "Second task",
            status: "completed",
            startedAt: "2026-03-17T19:12:21.000Z",
          },
        ],
      },
      {
        id: "assistant-1",
        kind: "message",
        createdAt: "2026-03-17T19:12:22.000Z",
        message: {
          id: MessageId.makeUnsafe("assistant-1"),
          role: "assistant",
          text: "",
          createdAt: "2026-03-17T19:12:22.000Z",
          streaming: false,
        },
        durationStart: "2026-03-17T19:12:22.000Z",
        showCompletionDivider: false,
      },
      {
        id: "user-2",
        kind: "message",
        createdAt: "2026-03-17T19:12:23.000Z",
        message: {
          id: MessageId.makeUnsafe("user-2"),
          role: "user",
          text: "Second prompt marker",
          createdAt: "2026-03-17T19:12:23.000Z",
          streaming: false,
        },
        durationStart: "2026-03-17T19:12:23.000Z",
        showCompletionDivider: false,
      },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["user-1", "assistant-1", "tasks-turn-1", "user-2"]);
  });
});
