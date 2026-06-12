import {
  type ModelSlug,
  type ProviderKind,
  type ProviderOptionSelection,
  type ServerProviderModel,
  type ThreadId,
} from "@tabs/contracts";
import {
  buildProviderOptionSelectionsFromDescriptors,
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
  isClaudeUltrathinkPrompt,
} from "@tabs/shared/model";
import type { ReactNode } from "react";
import { getProviderModelCapabilities } from "../../providerModels";
import { TraitsMenuContent, TraitsPicker } from "./TraitsPicker";

// Composer model state and trait controls are derived entirely from the
// selected model's capabilities/option descriptors, so these work for any
// provider/driver (codex, claude, cursor, grok, opencode, …) uniformly.
// Options flow as the canonical `ProviderOptionSelection[]` wire form — no
// per-provider typed-option shims. `TraitsPicker`/`TraitsMenuContent` render
// nothing when a model exposes no trait controls, so trait-less providers
// (grok, opencode) degrade cleanly.

export type ComposerProviderStateInput = {
  provider: ProviderKind;
  model: ModelSlug;
  models: ReadonlyArray<ServerProviderModel>;
  prompt: string;
  modelOptions: ReadonlyArray<ProviderOptionSelection> | null | undefined;
};

export type ComposerProviderState = {
  provider: ProviderKind;
  promptEffort: string | null;
  modelOptionsForDispatch: ReadonlyArray<ProviderOptionSelection> | undefined;
  composerFrameClassName?: string;
  composerSurfaceClassName?: string;
  modelPickerIconClassName?: string;
};

export function getComposerProviderState(input: ComposerProviderStateInput): ComposerProviderState {
  const { provider, model, models, prompt, modelOptions } = input;
  const caps = getProviderModelCapabilities(models, model, provider);
  const descriptors = getProviderOptionDescriptors({ caps, selections: modelOptions });
  const primarySelectDescriptor = descriptors.find(
    (descriptor): descriptor is Extract<(typeof descriptors)[number], { type: "select" }> =>
      descriptor.type === "select",
  );
  const primaryValue = getProviderOptionCurrentValue(primarySelectDescriptor ?? null);
  const promptEffort = typeof primaryValue === "string" ? primaryValue : null;
  const ultrathinkActive =
    (primarySelectDescriptor?.promptInjectedValues?.length ?? 0) > 0 &&
    isClaudeUltrathinkPrompt(prompt);

  return {
    provider,
    promptEffort,
    modelOptionsForDispatch: buildProviderOptionSelectionsFromDescriptors(descriptors),
    ...(ultrathinkActive
      ? {
          composerFrameClassName: "ultrathink-frame",
          composerSurfaceClassName: "shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]",
          modelPickerIconClassName: "ultrathink-chroma",
        }
      : {}),
  };
}

export function renderProviderTraitsMenuContent(input: {
  provider: ProviderKind;
  threadId: ThreadId;
  model: ModelSlug;
  models: ReadonlyArray<ServerProviderModel>;
  modelOptions: ReadonlyArray<ProviderOptionSelection> | undefined;
  prompt: string;
  onPromptChange: (prompt: string) => void;
}): ReactNode {
  return (
    <TraitsMenuContent
      provider={input.provider}
      models={input.models}
      threadId={input.threadId}
      model={input.model}
      modelOptions={input.modelOptions}
      prompt={input.prompt}
      onPromptChange={input.onPromptChange}
    />
  );
}

export function renderProviderTraitsPicker(input: {
  provider: ProviderKind;
  threadId: ThreadId;
  model: ModelSlug;
  models: ReadonlyArray<ServerProviderModel>;
  modelOptions: ReadonlyArray<ProviderOptionSelection> | undefined;
  prompt: string;
  onPromptChange: (prompt: string) => void;
}): ReactNode {
  return (
    <TraitsPicker
      provider={input.provider}
      models={input.models}
      threadId={input.threadId}
      model={input.model}
      modelOptions={input.modelOptions}
      prompt={input.prompt}
      onPromptChange={input.onPromptChange}
    />
  );
}
