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

const EMPTY_FALLBACK_MODEL_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

export const FALLBACK_BUILTIN_MODELS_BY_PROVIDER: Record<
  string,
  ReadonlyArray<ServerProviderModel>
> = {
  codex: [
    {
      slug: "gpt-5.4",
      name: "GPT-5.4",
      isCustom: false,
      capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
      isCustom: false,
      capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "gpt-5.3-codex",
      name: "GPT-5.3 Codex",
      isCustom: false,
      capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES,
    },
  ],
  claudeAgent: [],
  cursor: [],
  copilot: [],
  grok: [],
  opencode: [
    {
      slug: "openai/gpt-5",
      name: "OpenAI GPT-5",
      isCustom: false,
      capabilities: EMPTY_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "anthropic/claude-sonnet-5",
      name: "Claude Sonnet 5",
      isCustom: false,
      capabilities: EMPTY_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "google/gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      isCustom: false,
      capabilities: EMPTY_FALLBACK_MODEL_CAPABILITIES,
    },
  ],
  kilo: [
    {
      slug: "kilo/kilo-auto/free",
      name: "Kilo Auto Free",
      isCustom: false,
      capabilities: EMPTY_FALLBACK_MODEL_CAPABILITIES,
    },
  ],
  droid: [],
  antigravity: [
    {
      slug: "gemini-3.7-flash",
      name: "Gemini 3.7 Flash",
      isCustom: false,
      capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      isCustom: false,
      capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      isCustom: false,
      capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "claude-3-7-sonnet",
      name: "Claude 3.7 Sonnet",
      isCustom: false,
      capabilities: DEFAULT_FALLBACK_MODEL_CAPABILITIES,
    },
  ],
  openrouter: [],
  gemini: [
    {
      slug: "gemini-3.6-flash",
      name: "Gemini 3.6 Flash",
      isCustom: false,
      capabilities: EMPTY_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      isCustom: false,
      capabilities: EMPTY_FALLBACK_MODEL_CAPABILITIES,
    },
    {
      slug: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      isCustom: false,
      capabilities: EMPTY_FALLBACK_MODEL_CAPABILITIES,
    },
  ],
};

export function getProviderModels(
  providers: ReadonlyArray<ServerProvider>,
  provider: string,
): ReadonlyArray<ServerProviderModel> {
  const snapshot = providers.find((candidate) => candidate.instanceId === provider);
  if (snapshot) {
    return snapshot.models;
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
  if (
    provider === "grok" ||
    (typeof model === "string" && model.toLowerCase().startsWith("grok"))
  ) {
    return EMPTY_CAPABILITIES;
  }
  const slug = normalizeModelSlug(model, provider);
  return (
    models.find((candidate) => candidate.slug === slug)?.capabilities ??
    DEFAULT_FALLBACK_MODEL_CAPABILITIES
  );
}

export function getDefaultServerModel(
  providers: ReadonlyArray<ServerProvider>,
  provider: string,
): string {
  const models = getProviderModels(providers, provider);
  if (getProviderSnapshot(providers, provider) && models.length === 0) {
    return "";
  }
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
