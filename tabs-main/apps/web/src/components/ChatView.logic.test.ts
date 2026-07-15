import { ThreadId } from "@tabs/contracts";
import { describe, expect, it } from "vitest";

import {
  FOLLOW_UP_COMPOSER_PLACEHOLDER,
  GENERIC_COMPOSER_PLACEHOLDER,
  buildExpiredTerminalContextToastCopy,
  deriveComposerSendState,
  resolveBaseComposerPlaceholder,
  shouldPauseAutoScrollOnUserScrollIntent,
  shouldUseCenteredEmptyComposer,
} from "./ChatView.logic";

describe("deriveComposerSendState", () => {
  it("treats expired terminal pills as non-sendable content", () => {
    const state = deriveComposerSendState({
      prompt: "\uFFFC",
      imageCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("");
    expect(state.sendableTerminalContexts).toEqual([]);
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(false);
  });

  it("keeps text sendable while excluding expired terminal pills", () => {
    const state = deriveComposerSendState({
      prompt: `yoo \uFFFC waddup`,
      imageCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("yoo  waddup");
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(true);
  });
});

describe("buildExpiredTerminalContextToastCopy", () => {
  it("formats clear empty-state guidance", () => {
    expect(buildExpiredTerminalContextToastCopy(1, "empty")).toEqual({
      title: "Expired terminal context won't be sent",
      description: "Remove it or re-add it to include terminal output.",
    });
  });

  it("formats omission guidance for sent messages", () => {
    expect(buildExpiredTerminalContextToastCopy(2, "omitted")).toEqual({
      title: "Expired terminal contexts omitted from message",
      description: "Re-add it if you want that terminal output included.",
    });
  });
});

describe("shouldPauseAutoScrollOnUserScrollIntent", () => {
  it("pauses auto-scroll for upward user scroll intent while streaming", () => {
    expect(
      shouldPauseAutoScrollOnUserScrollIntent({
        shouldAutoScroll: true,
        intentDirection: "up",
        canScrollUp: true,
      }),
    ).toBe(true);
  });

  it("keeps auto-scroll enabled for downward movement", () => {
    expect(
      shouldPauseAutoScrollOnUserScrollIntent({
        shouldAutoScroll: true,
        intentDirection: "down",
        canScrollUp: true,
      }),
    ).toBe(false);
  });

  it("does not change state when auto-scroll is already paused", () => {
    expect(
      shouldPauseAutoScrollOnUserScrollIntent({
        shouldAutoScroll: false,
        intentDirection: "up",
        canScrollUp: true,
      }),
    ).toBe(false);
  });

  it("does not pause auto-scroll when the viewport cannot move upward", () => {
    expect(
      shouldPauseAutoScrollOnUserScrollIntent({
        shouldAutoScroll: true,
        intentDirection: "up",
        canScrollUp: false,
      }),
    ).toBe(false);
  });
});

describe("shouldUseCenteredEmptyComposer", () => {
  it("centers only a truly fresh local draft thread", () => {
    expect(
      shouldUseCenteredEmptyComposer({
        isLocalDraftThread: true,
        hasTimelineEntries: false,
        isWorking: false,
      }),
    ).toBe(true);
  });

  it("keeps existing server threads docked even when they have no timeline entries", () => {
    expect(
      shouldUseCenteredEmptyComposer({
        isLocalDraftThread: false,
        hasTimelineEntries: false,
        isWorking: false,
      }),
    ).toBe(false);
  });

  it("keeps the welcome text visible even when a draft already has content", () => {
    expect(
      shouldUseCenteredEmptyComposer({
        isLocalDraftThread: true,
        hasTimelineEntries: false,
        isWorking: false,
      }),
    ).toBe(true);
  });
});

describe("resolveBaseComposerPlaceholder", () => {
  it("uses the generic placeholder for a history-less thread", () => {
    expect(
      resolveBaseComposerPlaceholder({
        hasConversationHistory: false,
        phase: "disconnected",
      }),
    ).toBe(GENERIC_COMPOSER_PLACEHOLDER);
  });

  it("uses the follow-up placeholder only for disconnected threads with history", () => {
    expect(
      resolveBaseComposerPlaceholder({
        hasConversationHistory: true,
        phase: "disconnected",
      }),
    ).toBe(FOLLOW_UP_COMPOSER_PLACEHOLDER);
  });
});
