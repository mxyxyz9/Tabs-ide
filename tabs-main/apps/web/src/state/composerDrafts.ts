import { useAtomValue } from "@effect/atom-react";
import type { ThreadId } from "@tabs/contracts";
import { Atom } from "@tabs/client-runtime/state";

import {
  type ComposerThreadDraftState,
  type DraftThreadState,
  useComposerDraftStore,
} from "../composerDraftStore";
import { appAtomRegistry } from "./atomRegistry";

export interface ComposerDraftsState {
  readonly draftsByThreadId: Record<ThreadId, ComposerThreadDraftState>;
  readonly draftThreadsByThreadId: Record<ThreadId, DraftThreadState>;
}

const emptyDraft: ComposerThreadDraftState = {
  prompt: "",
  images: [],
  nonPersistedImageIds: [],
  persistedAttachments: [],
  terminalContexts: [],
  previewAnnotations: [],
  modelSelectionByProvider: {},
  activeProvider: null,
  runtimeMode: null,
  interactionMode: null,
};

export const composerDraftsAtom = Atom.make<ComposerDraftsState>({
  draftsByThreadId: {},
  draftThreadsByThreadId: {},
}).pipe(Atom.withLabel("tabs-composer-drafts"), Atom.keepAlive);

export function initializeComposerDraftsState() {
  appAtomRegistry.set(composerDraftsAtom, {
    draftsByThreadId: useComposerDraftStore.getState().draftsByThreadId,
    draftThreadsByThreadId: useComposerDraftStore.getState().draftThreadsByThreadId,
  });

  useComposerDraftStore.subscribe((state) => {
    appAtomRegistry.set(composerDraftsAtom, {
      draftsByThreadId: state.draftsByThreadId,
      draftThreadsByThreadId: state.draftThreadsByThreadId,
    });
  });
}

export function useComposerDraft(threadId: ThreadId): ComposerThreadDraftState {
  return useAtomValue(
    composerDraftsAtom,
    (state) => state.draftsByThreadId[threadId] ?? emptyDraft,
  );
}

export function useDraftThread(threadId: ThreadId | null): DraftThreadState | null {
  return useAtomValue(composerDraftsAtom, (state) =>
    threadId ? (state.draftThreadsByThreadId[threadId] ?? null) : null,
  );
}

export const composerDraftActions = {
  setStickyModelSelection: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["setStickyModelSelection"]
    >
  ) => useComposerDraftStore.getState().setStickyModelSelection(...args),
  setPrompt: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["setPrompt"]>
  ) => useComposerDraftStore.getState().setPrompt(...args),
  setModelSelection: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["setModelSelection"]>
  ) => useComposerDraftStore.getState().setModelSelection(...args),
  setRuntimeMode: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["setRuntimeMode"]>
  ) => useComposerDraftStore.getState().setRuntimeMode(...args),
  setInteractionMode: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["setInteractionMode"]>
  ) => useComposerDraftStore.getState().setInteractionMode(...args),
  addImage: (...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["addImage"]>) =>
    useComposerDraftStore.getState().addImage(...args),
  addImages: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["addImages"]>
  ) => useComposerDraftStore.getState().addImages(...args),
  removeImage: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["removeImage"]>
  ) => useComposerDraftStore.getState().removeImage(...args),
  insertTerminalContext: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["insertTerminalContext"]>
  ) => useComposerDraftStore.getState().insertTerminalContext(...args),
  addTerminalContexts: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["addTerminalContexts"]>
  ) => useComposerDraftStore.getState().addTerminalContexts(...args),
  removeTerminalContext: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["removeTerminalContext"]>
  ) => useComposerDraftStore.getState().removeTerminalContext(...args),
  setTerminalContexts: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["setTerminalContexts"]>
  ) => useComposerDraftStore.getState().setTerminalContexts(...args),
  addPreviewAnnotation: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["addPreviewAnnotation"]>
  ) => useComposerDraftStore.getState().addPreviewAnnotation(...args),
  setPreviewAnnotations: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["setPreviewAnnotations"]>
  ) => useComposerDraftStore.getState().setPreviewAnnotations(...args),
  removePreviewAnnotation: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["removePreviewAnnotation"]
    >
  ) => useComposerDraftStore.getState().removePreviewAnnotation(...args),
  clearPersistedAttachments: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["clearPersistedAttachments"]
    >
  ) => useComposerDraftStore.getState().clearPersistedAttachments(...args),
  syncPersistedAttachments: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["syncPersistedAttachments"]
    >
  ) => useComposerDraftStore.getState().syncPersistedAttachments(...args),
  clearComposerContent: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["clearComposerContent"]>
  ) => useComposerDraftStore.getState().clearComposerContent(...args),
  setDraftThreadContext: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["setDraftThreadContext"]>
  ) => useComposerDraftStore.getState().setDraftThreadContext(...args),
  getDraftThreadByProjectId: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["getDraftThreadByProjectId"]
    >
  ) => useComposerDraftStore.getState().getDraftThreadByProjectId(...args),
  getDraftThread: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["getDraftThread"]>
  ) => useComposerDraftStore.getState().getDraftThread(...args),
  setProjectDraftThreadId: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["setProjectDraftThreadId"]
    >
  ) => useComposerDraftStore.getState().setProjectDraftThreadId(...args),
  clearProjectDraftThreadId: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["clearProjectDraftThreadId"]
    >
  ) => useComposerDraftStore.getState().clearProjectDraftThreadId(...args),
  clearProjectDraftThreadById: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["clearProjectDraftThreadById"]
    >
  ) => useComposerDraftStore.getState().clearProjectDraftThreadById(...args),
  clearDraftThread: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["clearDraftThread"]>
  ) => useComposerDraftStore.getState().clearDraftThread(...args),
  setProviderModelOptions: (
    ...args: Parameters<
      ReturnType<typeof useComposerDraftStore.getState>["setProviderModelOptions"]
    >
  ) => useComposerDraftStore.getState().setProviderModelOptions(...args),
  applyStickyState: (
    ...args: Parameters<ReturnType<typeof useComposerDraftStore.getState>["applyStickyState"]>
  ) => useComposerDraftStore.getState().applyStickyState(...args),
};
