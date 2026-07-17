import { beforeEach, describe, expect, it } from "vitest";
import { ThreadId } from "@tabs/contracts";

import { appAtomRegistry } from "./atomRegistry";
import { threadSelectionActions, threadSelectionAtom } from "./threadSelection";

const A = ThreadId.makeUnsafe("thread-a");
const B = ThreadId.makeUnsafe("thread-b");
const C = ThreadId.makeUnsafe("thread-c");

describe("thread selection atoms", () => {
  beforeEach(() => {
    appAtomRegistry.set(threadSelectionAtom, {
      selectedThreadIds: new Set<ThreadId>(),
      anchorThreadId: null,
    });
  });

  it("toggles a selection and records its anchor", () => {
    threadSelectionActions.toggle(A);
    expect(appAtomRegistry.get(threadSelectionAtom)).toEqual({
      selectedThreadIds: new Set([A]),
      anchorThreadId: A,
    });
    threadSelectionActions.toggle(A);
    expect(appAtomRegistry.get(threadSelectionAtom).selectedThreadIds).toEqual(new Set());
  });

  it("selects an inclusive range from the anchor", () => {
    threadSelectionActions.toggle(A);
    threadSelectionActions.rangeSelectTo(C, [A, B, C]);
    expect(appAtomRegistry.get(threadSelectionAtom)).toEqual({
      selectedThreadIds: new Set([A, B, C]),
      anchorThreadId: A,
    });
  });

  it("removes deleted threads and clears a removed anchor", () => {
    threadSelectionActions.toggle(A);
    threadSelectionActions.toggle(B);
    threadSelectionActions.remove([B]);
    expect(appAtomRegistry.get(threadSelectionAtom)).toEqual({
      selectedThreadIds: new Set([A]),
      anchorThreadId: null,
    });
  });
});
