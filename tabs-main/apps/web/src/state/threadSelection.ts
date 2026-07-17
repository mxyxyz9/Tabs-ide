import { useAtomValue } from "@effect/atom-react";
import type { ThreadId } from "@tabs/contracts";
import { Atom } from "@tabs/client-runtime/state";

import { appAtomRegistry } from "./atomRegistry";

export interface ThreadSelectionState {
  readonly selectedThreadIds: ReadonlySet<ThreadId>;
  readonly anchorThreadId: ThreadId | null;
}

const emptySelection: ThreadSelectionState = {
  selectedThreadIds: new Set<ThreadId>(),
  anchorThreadId: null,
};

export const threadSelectionAtom = Atom.make<ThreadSelectionState>(emptySelection).pipe(
  Atom.withLabel("tabs-thread-selection"),
  Atom.keepAlive,
);

function update(update: (state: ThreadSelectionState) => ThreadSelectionState) {
  appAtomRegistry.update(threadSelectionAtom, update);
}

export const threadSelectionActions = {
  toggle(threadId: ThreadId) {
    update((state) => {
      const selectedThreadIds = new Set(state.selectedThreadIds);
      if (selectedThreadIds.has(threadId)) selectedThreadIds.delete(threadId);
      else selectedThreadIds.add(threadId);
      return {
        selectedThreadIds,
        anchorThreadId: selectedThreadIds.has(threadId) ? threadId : state.anchorThreadId,
      };
    });
  },
  rangeSelectTo(threadId: ThreadId, orderedThreadIds: readonly ThreadId[]) {
    update((state) => {
      const selectedThreadIds = new Set(state.selectedThreadIds);
      const anchor = state.anchorThreadId;
      if (anchor === null) {
        selectedThreadIds.add(threadId);
        return { selectedThreadIds, anchorThreadId: threadId };
      }
      const anchorIndex = orderedThreadIds.indexOf(anchor);
      const targetIndex = orderedThreadIds.indexOf(threadId);
      if (anchorIndex === -1 || targetIndex === -1) {
        selectedThreadIds.add(threadId);
        return { selectedThreadIds, anchorThreadId: threadId };
      }
      for (
        let index = Math.min(anchorIndex, targetIndex);
        index <= Math.max(anchorIndex, targetIndex);
        index += 1
      ) {
        const id = orderedThreadIds[index];
        if (id !== undefined) selectedThreadIds.add(id);
      }
      return { selectedThreadIds, anchorThreadId: anchor };
    });
  },
  clear() {
    const state = appAtomRegistry.get(threadSelectionAtom);
    if (state.selectedThreadIds.size > 0 || state.anchorThreadId !== null) {
      appAtomRegistry.set(threadSelectionAtom, emptySelection);
    }
  },
  remove(threadIds: readonly ThreadId[]) {
    const removals = new Set(threadIds);
    update((state) => {
      const selectedThreadIds = new Set(
        [...state.selectedThreadIds].filter((id) => !removals.has(id)),
      );
      if (
        selectedThreadIds.size === state.selectedThreadIds.size &&
        !removals.has(state.anchorThreadId as ThreadId)
      )
        return state;
      return {
        selectedThreadIds,
        anchorThreadId:
          state.anchorThreadId !== null && removals.has(state.anchorThreadId)
            ? null
            : state.anchorThreadId,
      };
    });
  },
  setAnchor(threadId: ThreadId) {
    update((state) =>
      state.anchorThreadId === threadId ? state : { ...state, anchorThreadId: threadId },
    );
  },
};

export function useThreadSelection() {
  return useAtomValue(threadSelectionAtom);
}
