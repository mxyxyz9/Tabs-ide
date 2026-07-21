import {
  DEFAULT_MODEL,
  DEFAULT_MODEL_BY_PROVIDER,
  type ProviderDriverKind,
  type ClaudeModelOptions,
  type CodexModelOptions,
  type ModelCapabilities,
  type ProviderKind,
  type ServerProvider,
  type ServerProviderModel,
} from "@tabs/contracts";
import {
  createModelCapabilities,
  getDefaultEffort,
  hasEffortLevel,
  normalizeModelSlug,
  trimOrNull,
} from "@tabs/shared/model";

const EMPTY_CAPABILITIES: ModelCapabilities = {
  reasoningEffortLevels: [],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  promptInjectedEffortLevels: [],
  optionDescriptors: [],
};

const DEFAULT_FALLBACK_MODEL_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [
    {
      id: "reasoningEffort",
      type: "select",
      label: "Reasoning Effort",
      currentValue: "high",
      options: [
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium" },
        { id: "high", label: "High" },
        { id: "xhigh", label: "Extra High" },
        { id: "max", label: "Max" },
        { id: "ultra", label: "Ultra" },
      ],
    },
    {
      id: "fastMode",
      type: "boolean",
      label: "Fast Mode",
      currentValue: false,
    },
  ],
});

export const FALLBACK_BUILTIN_MODELS_BY_PROVIDER: Record<string, ReadonlyArray<ServerProviderModel>> = {
  codex: [
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "gpt-5.4-mini", name: "GPT-5.4 Mini", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
  ],
  claudeAgent: [
    { slug: "claude-sonnet-5", name: "Claude Sonnet 5", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "claude-opus-4-8", name: "Claude Opus 4.8", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "claude-haiku-4-5", name: "Claude Haiku 4.5", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
  ],
  cursor: [
    { slug: "auto", name: "Auto (Recommended)", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "composer-2", name: "Composer 2", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "composer-1.5", name: "Composer 1.5", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
  ],
  grok: [
    { slug: "grok-build", name: "Grok Build", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "grok-code", name: "Grok Code", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "grok-3", name: "Grok 3", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
  ],
  opencode: [
    { slug: "openai/gpt-5", name: "OpenAI GPT-5", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
    { slug: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", isCustom: false, capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES },
  ],
};

export function getProviderModels(
  providers: ReadonlyArray<ServerProvider>,
  provider: string,
): ReadonlyArray<ServerProviderModel> {
  const liveModels = providers.find((candidate) => candidate.instanceId === provider)?.models;
  if (liveModels && liveModels.length > 0) {
    return liveModels;
  }
  return FALLBACK_BUILTIN_MODELS_BY_PROVIDER[provider] ?? [];
}

export function getProviderSnapshot(
  providers: ReadonlyArray<ServerProvider>,
  provider: string,
): ServerProvider | undefined {
  return providers.find((candidate) => candidate.instanceId === provider);
}

export function isProviderEnabled(
  providers: ReadonlyArray<ServerProvider>,
  provider: string,
): boolean {
  return getProviderSnapshot(providers, provider)?.enabled ?? true;
}

export function resolveSelectableProvider(
  providers: ReadonlyArray<ServerProvider>,
  provider: string | null | undefined,
): string {
  const requested = provider ?? "codex";
  if (isProviderEnabled(providers, requested)) {
    return requested;
  }
  return providers.find((candidate) => candidate.enabled)?.instanceId ?? requested;
}

export function getProviderModelCapabilities(
  models: ReadonlyArray<ServerProviderModel>,
  model: string | null | undefined,
  provider: string,
): ModelCapabilities {
  const slug = normalizeModelSlug(model, provider);
  return models.find((candidate) => candidate.slug === slug)?.capabilities ?? EMPTY_CAPABILITIES;
}

export function getDefaultServerModel(
  providers: ReadonlyArray<ServerProvider>,
  provider: string,
): string {
  const models = getProviderModels(providers, provider);
  return (
    models.find((model) => !model.isCustom)?.slug ??
    models[0]?.slug ??
    DEFAULT_MODEL_BY_PROVIDER[provider as ProviderDriverKind] ??
    DEFAULT_MODEL
  );
}

export function normalizeCodexModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: CodexModelOptions | null | undefined,
): CodexModelOptions | undefined {
  const defaultReasoningEffort = getDefaultEffort(caps);
  const reasoningEffort = trimOrNull(modelOptions?.reasoningEffort) ?? defaultReasoningEffort;
  const fastModeEnabled = modelOptions?.fastMode === true;
  const nextOptions: CodexModelOptions = {
    ...(reasoningEffort && reasoningEffort !== defaultReasoningEffort
      ? { reasoningEffort: reasoningEffort as CodexModelOptions["reasoningEffort"] }
      : {}),
    ...(fastModeEnabled ? { fastMode: true } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

export function normalizeClaudeModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: ClaudeModelOptions | null | undefined,
): ClaudeModelOptions | undefined {
  const defaultReasoningEffort = getDefaultEffort(caps);
  const resolvedEffort = trimOrNull(modelOptions?.effort);
  const isPromptInjected = caps.promptInjectedEffortLevels.includes(resolvedEffort ?? "");
  const effort =
    resolvedEffort &&
    !isPromptInjected &&
    hasEffortLevel(caps, resolvedEffort) &&
    resolvedEffort !== defaultReasoningEffort
      ? resolvedEffort
      : undefined;
  const thinking =
    caps.supportsThinkingToggle && modelOptions?.thinking === false ? false : undefined;
  const fastMode = caps.supportsFastMode && modelOptions?.fastMode === true ? true : undefined;
  const nextOptions: ClaudeModelOptions = {
    ...(thinking === false ? { thinking: false } : {}),
    ...(effort ? { effort } : {}),
    ...(fastMode ? { fastMode: true } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}
