# Provider / Model / Capability Matrix Audit

This document provides a factual audit of how providers, models, and their capabilities are represented and flow through the codebase. It details the structures at the contracts layer, the server-side provider registry/drivers, and how these capabilities dynamically construct and render UI controls in the composer.

---

## Summary
The codebase currently wires up **5 top-level provider drivers** (`codex`, `claudeAgent`, `cursor`, `grok`, and `opencode`) supporting both static built-in models (e.g., Claude's 8 models) and dynamic models queried via local CLI/server processes. The single biggest capability asymmetry is that the traits picker is **entirely capability-driven via generic option descriptors** (`select` and `boolean` types): Claude features a prompt-injected reasoning level (`ultrathink`) and `fastMode` toggles; Codex exposes a unique speed/tier setting (`serviceTier`); Cursor dynamically loads variable capabilities from its Agent CLI ACP; and OpenCode exposes nested upstream models with a dynamic `variant` select option.

---

## 1. Provider Inventory

The following table documents each top-level provider driver wired up in the codebase:

| Internal ID/Key | Display Name | Registration File & Export Name | Vendor & Instance Configuration |
| :--- | :--- | :--- | :--- |
| `"codex"` | `"Codex"` | [session-logic.ts:L25-35](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/session-logic.ts#L25-L35) (`PROVIDER_OPTIONS`), [model.ts:L217-223](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L217-L223) (`PROVIDER_DISPLAY_NAMES`) | Single vendor driver (OpenAI/Bedrock/ChatGPT backend) supporting multiple configured instances (e.g., built-in default and user-authored custom instances like `codex_personal`). |
| `"claudeAgent"` | `"Claude"` | [session-logic.ts:L25-35](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/session-logic.ts#L25-L35) (`PROVIDER_OPTIONS`), [model.ts:L217-223](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L217-L223) (`PROVIDER_DISPLAY_NAMES`) | Anthropic vendor driver supporting default built-in instance and user-configured custom instances. |
| `"cursor"` | `"Cursor"` | [session-logic.ts:L25-35](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/session-logic.ts#L25-L35) (`PROVIDER_OPTIONS`), [model.ts:L217-223](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L217-L223) (`PROVIDER_DISPLAY_NAMES`) | Cursor Agent CLI wrapper driver supporting default and custom instances. |
| `"grok"` | `"Grok"` | [session-logic.ts:L25-35](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/session-logic.ts#L25-L35) (`PROVIDER_OPTIONS`), [model.ts:L217-223](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L217-L223) (`PROVIDER_DISPLAY_NAMES`) | Grok CLI backend driver supporting default and custom instances. |
| `"opencode"` | `"OpenCode"` | [session-logic.ts:L25-35](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/session-logic.ts#L25-L35) (`PROVIDER_OPTIONS`), [model.ts:L217-223](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L217-L223) (`PROVIDER_DISPLAY_NAMES`) | **Multi-vendor bundle**: A single local OpenCode driver wrapper that communicates with an OpenCode server. It dynamically queries and bundles multiple connected upstream backends (e.g. Anthropic, OpenAI, Google) under this one provider option. |

### Source References:
- Branded types and Kind constructors: [providerInstance.ts:L71-90](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/providerInstance.ts#L71-L90)
- Provider Display Names mapping: [model.ts:L217-223](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L217-L223)
- Streamed config aggregator registry: [ProviderRegistry.ts:L187-200](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/ProviderRegistry.ts#L187-L200)
- Multi-instance helper mapping: [providerInstances.ts:L158-182](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/providerInstances.ts#L158-L182)

---

## 2. Model Inventory per Provider

Models are represented as `ServerProviderModel` wire schemas defined in [server.ts:L61-69](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/server.ts#L61-L69):
```typescript
export const ServerProviderModel = Schema.Struct({
  slug: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  shortName: Schema.optional(TrimmedNonEmptyString),
  subProvider: Schema.optional(TrimmedNonEmptyString),
  isCustom: Schema.Boolean,
  capabilities: Schema.NullOr(ModelCapabilities),
});
```

Here is how each provider registers and represents its models:

### A. Claude Provider (`claudeAgent`)
Statically defined in `BUILT_IN_MODELS` in [ClaudeProvider.ts:L55-284](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/ClaudeProvider.ts#L55-L284). Models are conditionally filtered by the server based on the local Claude CLI version:
- **`claude-fable-5`**: "Claude Fable 5" (Requires Claude CLI $\ge$ `2.1.169`, verified in [L286-288](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/ClaudeProvider.ts#L286-L288))
- **`claude-opus-4-8`**: "Claude Opus 4.8" (Requires Claude CLI $\ge$ `2.1.154`, verified in [L290-292](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/ClaudeProvider.ts#L290-L292))
- **`claude-opus-4-7`**: "Claude Opus 4.7" (Requires Claude CLI $\ge$ `2.1.111`, verified in [L294-296](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/ClaudeProvider.ts#L294-L296))
- **`claude-opus-4-6`**: "Claude Opus 4.6" (No version restriction)
- **`claude-opus-4-5`**: "Claude Opus 4.5" (No version restriction)
- **`claude-sonnet-5`**: "Claude Sonnet 5" (No version restriction)
- **`claude-sonnet-4-6`**: "Claude Sonnet 4.6" (No version restriction)
- **`claude-haiku-4-5`**: "Claude Haiku 4.5" (No version restriction)

### B. Grok Provider (`grok`)
- **`grok-build`**: Statically defined in `GROK_BUILT_IN_MODELS` inside [GrokProvider.ts:L52-59](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/GrokProvider.ts#L52-L59).
- **Dynamic Discovered Models**: Discovered dynamically via ACP (Agent Communication Protocol) stdio session and parsed from `models.availableModels` in [GrokProvider.ts:L112-134](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/GrokProvider.ts#L112-L134).

### C. Codex Provider (`codex`)
- Has **no static model list**; models are dynamically loaded from the Codex app-server via the `model/list` API and parsed in [CodexProvider.ts:L177-186](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/CodexProvider.ts#L177-L186).
- Defines default text-generation models (`gpt-5.4`, `gpt-5.4-mini`) and model slug aliases (e.g. `gpt-5-codex` $\rightarrow$ `gpt-5.4`) in [model.ts:L148-178](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L148-L178).

### D. Cursor Provider (`cursor`)
- Has **no static model list**; models are retrieved dynamically via the local Cursor Agent CLI using the ACP method `cursor/list_available_models` and parsed in [CursorProvider.ts:L373-393](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/CursorProvider.ts#L373-L393).
- Mappings and aliases (e.g., `composer` $\rightarrow$ `composer-2`, `opus-4.6-thinking` $\rightarrow$ `claude-opus-4-6`) are configured in [model.ts:L201-211](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L201-L211).

### E. OpenCode Provider (`opencode`)
- Has **no static model list**; models are retrieved dynamically by connecting to the local/external OpenCode server, fetching the inventory, and flattening connected upstream provider models in [OpenCodeProvider.ts:L222-253](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/OpenCodeProvider.ts#L222-L253).
- Model slugs are formatted dynamically as `${provider.id}/${model.id}` and carry their upstream provider name as a `subProvider` metadata label.

---

## 3. Capability Matrix

Model capabilities are specified dynamically via `optionDescriptors` in `ModelCapabilities` ([model.ts:L125-139](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L125-L139)), supporting `select` and `boolean` controls.

Here is the capability matrix showing what options each model supports.

| Model / Group | Reasoning Effort Levels (Value / Label) | Thinking Toggle | Fast Mode | Context Window Options | Service Tier Option (Codex Only) | Variant Option (OpenCode Only) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Claude Models** | | | | | | |
| `claude-fable-5` | `low`/`medium`/`high` (default)/`xhigh`/`max`/`ultracode`/`ultrathink` (prompt-injected) | Not supported | Not supported | `200k` (default), `1m` | N/A | N/A |
| `claude-opus-4-8` | `low`/`medium`/`high` (default)/`xhigh`/`max`/`ultracode`/`ultrathink` (prompt-injected) | Not supported | Supported | `200k` (default), `1m` | N/A | N/A |
| `claude-opus-4-7` | `low`/`medium`/`high`/`xhigh` (default)/`max`/`ultrathink` (prompt-injected) | Not supported | Supported | `200k` (default), `1m` | N/A | N/A |
| `claude-opus-4-6` | `low`/`medium`/`high` (default)/`max`/`ultrathink` (prompt-injected) | Not supported | Supported | `200k` (default), `1m` | N/A | N/A |
| `claude-opus-4-5` | `low`/`medium`/`high` (default)/`max` | Not supported | Supported | Not supported | N/A | N/A |
| `claude-sonnet-5` | `low`/`medium`/`high` (default)/`xhigh`/`max`/`ultrathink` (prompt-injected) | Not supported | Not supported | `200k` (default), `1m` | N/A | N/A |
| `claude-sonnet-4-6` | `low`/`medium`/`high` (default)/`max`/`ultrathink` (prompt-injected) | Not supported | Not supported | `200k` (default), `1m` | N/A | N/A |
| `claude-haiku-4-5` | Not supported | Supported | Not supported | Not supported | N/A | N/A |
| **Grok Models** | | | | | | |
| `grok-build` | Not supported | Not supported | Not supported | Not supported | N/A | N/A |
| Dynamic Models | Not supported | Not supported | Not supported | Not supported | N/A | N/A |
| **Codex Models** | | | | | | |
| Dynamic Models | Dynamic (standard/none/minimal/low/medium/high/xhigh/max/ultra) | Not supported | Not supported | Not supported | Supported (Standard, Fast, custom speed tiers) | N/A |
| **Cursor Models** | | | | | | |
| Dynamic Models | Dynamic (low/medium/high/max/xhigh if present in ACP options) | Dynamic (if present in ACP) | Dynamic (if present in ACP) | Dynamic (from ACP context options) | N/A | N/A |
| **OpenCode Models** | | | | | | |
| Dynamic Models | N/A (Handled via variant) | Not supported | Not supported | Not supported | N/A | Supported (low, medium, high variants) |

### Key Architectural Asymmetries:
1. **Service Tier Option (Codex-Only)**: Codex exposes speed/service tiers (`serviceTier` option) such as `default` ("Standard") and `fast`, which is completely absent from all other providers. Mapped in [CodexProvider.ts:L143-163](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/CodexProvider.ts#L143-L163).
2. **Prompt-Injected Ultrathink (Claude-Only)**: Claude models support `ultrathink` reasoning effort which is injected into the user prompt instead of being sent as an API parameter. This is detected in [TraitsPicker.tsx:L111-117](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/chat/TraitsPicker.tsx#L111-L117) and handled in [L382-397](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/shared/src/model.ts#L382-L397) to prefix the prompt with `Ultrathink:\n`.
3. **OpenCode Variant (OpenCode-Only)**: OpenCode dynamically constructs variant lists and maps them to a generic `variant` select option descriptor, while filtering out its secondary `agent` option descriptor inside the traits menu so that it can be handled by the Plan toggle in the composer footer. Mapped in [OpenCodeProvider.ts:L173-220](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/Layers/OpenCodeProvider.ts#L173-L220) and filtered in [TraitsPicker.tsx:L95-100](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/chat/TraitsPicker.tsx#L95-L100).
4. **Hiding Unavailable Controls**: If a model doesn't support any option descriptors (e.g. `grok-build`), `hasAnyControls` resolves to false and the entire traits picker button is hidden (`return null;`) in the composer UI. Mapped in [TraitsPicker.tsx:L299-301](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/chat/TraitsPicker.tsx#L299-L301).

---

## 4. Where This Data Flows Into the UI

### A. Raw Model Map Compilation (`modelOptionsByProvider`)
In [ChatView.tsx:L1088-1097](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ChatView.tsx#L1088-L1097), the component compiles a mapping from provider keys to model arrays using `providerStatuses` (fetched from `serverConfigQuery.data?.providers`):
```typescript
const modelOptionsByProvider = useMemo(() => {
  const result: Partial<
    Record<ProviderPickerKind, ReadonlyArray<{ slug: string; name: string }>>
  > = {};
  for (const option of AVAILABLE_PROVIDER_OPTIONS) {
    result[option.value] =
      providerStatuses.find((provider) => provider.instanceId === option.value)?.models ?? [];
  }
  return result;
}, [providerStatuses]);
```

### B. Rendering Provider & Model Selector (`ProviderModelPicker.tsx`)
Rendered inside `ChatView.tsx` (passes down `modelOptionsByProvider`).
- If provider switching is allowed, clicking the button renders a dropdown list of available provider options (`AVAILABLE_PROVIDER_OPTIONS`). Hovering over a provider opens a submenu listing its models from `modelOptionsByProvider[provider]`. Mapped in [ProviderModelPicker.tsx:L155-214](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/chat/ProviderModelPicker.tsx#L155-L214).
- The vitest browser mock in [ProviderModelPicker.browser.tsx](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/chat/ProviderModelPicker.browser.tsx) mounts the component with custom provider fixtures to assert submenu positions, mid-thread locked states, and model selections.

### C. Traits Menu Construction (`renderProviderTraits` in `ChatView.tsx`)
In [ChatView.tsx:L176-218](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ChatView.tsx#L176-L218), traits are built by calling `<TraitsPicker>` and `<TraitsMenuContent>` from `TraitsPicker.tsx`.
- `TraitsPicker.tsx` performs capability-driven trait derivation via `deriveDescriptorTraits`. It calls `getProviderModelCapabilities(models, model, provider)` to resolve the model's `ModelCapabilities`.
- It then filters out any descriptor with ID `"agent"` (handled separately by the Plan toggle in the composer footer).
- If `hasAnyControls` is false (descriptors array is empty), it returns `null` (hiding the button completely).
- If there are controls, the button label is formed by joining the labels of all options (e.g. `Low`, `Fast Mode On`) with ` · `.
- In the dropdown popup, `TraitsMenuContent` maps each select descriptor to a `MenuRadioGroup` and each boolean descriptor to a `MenuRadioGroup` with "On" and "Off" choices.
- For Claude's `ultrathink` option, if chosen, `TraitsPicker` detects it via `isClaudeUltrathinkPrompt(prompt)` and handles it by prefixing the prompt with `"Ultrathink:\n"`. In `TraitsMenuContent`, if the prompt starts with `"Ultrathink:\n"`, the effort picker is disabled, showing a message: `"Remove Ultrathink from the prompt to change this option."`. Mapped in [TraitsPicker.tsx:L224-228](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/chat/TraitsPicker.tsx#L224-L228).

---

## 5. Extensibility

### Minimum Steps to Add a Brand-New Provider:
1. **Contracts (Types)**:
   - Add matching settings type or model options schema in `ProviderModelOptions` in [model.ts:L244-247](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L244-L247).
   - Register default model & git text generation models in `DEFAULT_MODEL_BY_PROVIDER` and `DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER` in [model.ts:L151-167](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L151-L167).
   - Map aliases in `MODEL_SLUG_ALIASES_BY_PROVIDER` in [model.ts:L169-213](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L169-L213).
   - Add the driver's display name to `PROVIDER_DISPLAY_NAMES` in [model.ts:L217-223](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/contracts/src/model.ts#L217-L223).
2. **Server (Backend Driver)**:
   - Create a driver file: `apps/server/src/provider/Drivers/MyNewDriver.ts` implementing `ProviderDriver`.
   - Add driver instance to `BUILT_IN_DRIVERS` registry list and its environment services to `BuiltInDriversEnv` in [builtInDrivers.ts:L35-53](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/server/src/provider/builtInDrivers.ts#L35-L53).
3. **Web (Frontend Registry & Icons)**:
   - Add picker kind to `ProviderPickerKind` and a metadata entry to `PROVIDER_OPTIONS` in [session-logic.ts:L25-35](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/session-logic.ts#L25-L35).
   - Add icon mapping in `PROVIDER_ICON_BY_PROVIDER` in [ProviderModelPicker.tsx:L33-39](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/chat/ProviderModelPicker.tsx#L33-L39).

### Capability Types Arbitrary Extensibility:
The modern `optionDescriptors` system is **very flexible** because it is a generic array of `select` and `boolean` descriptors. Adding a new level or unique toggle does *not* require database migrations or types changes; they will dynamically render in the traits menu.

However, the system has **rigid aspects**:
1. **Prompt Injection**: Prompt-injected options (like Claude's `ultrathink` prefixing logic) are hardcoded in shared model helpers: [model.ts:L257-259](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/shared/src/model.ts#L257-L259) and [model.ts:L382-397](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/shared/src/model.ts#L382-L397).
2. **API Parameter Mapping**: Each backend driver adapter (e.g. `ClaudeAdapter.ts`, `CodexAdapter.ts`) must hardcode mapping logic to translate the generic `ProviderOptionSelection` IDs (`"reasoning"`, `"thinking"`, `"fastMode"`, etc.) into actual API parameters or CLI flags. Adding a new toggle requires adding parsing support in the corresponding server adapter.
3. **Legacy Compat Shim Mapping**: In [model.ts:L20-45](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/shared/src/model.ts#L20-L45), legacy fields like `supportsFastMode` and `supportsThinkingToggle` are derived by looking for hardcoded IDs (`"thinking"`, `"fastMode"`).

### Fallbacks for Missing or Partial Data:
- If a model's `capabilities` field is missing, it falls back to `EMPTY_CAPABILITIES` (no controls, empty options). Mapped in [providerModels.ts:L19-24](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/providerModels.ts#L19-L24) and [L58-65](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/providerModels.ts#L58-L65).
- If no reasoning level is marked as default, `getDefaultEffort` searches through the option descriptors and picks the first option marked `isDefault: true`. If still none, it returns `null`. Mapped in [model.ts:L422-430](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/shared/src/model.ts#L422-L430).
- If model resolution fails, the system resolves the provider default using `DEFAULT_MODEL_BY_PROVIDER` and then the global `DEFAULT_MODEL` (`gpt-5.4`). Mapped in [model.ts:L317-323](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/packages/shared/src/model.ts#L317-L323).

---

## 6. Open Questions

1. **Codex/Cursor/OpenCode Dynamic Model Configuration**: Since Codex, Cursor, and OpenCode load model configuration dynamically over local CLI or HTTP API processes at runtime, we cannot statically audit the full range of production model names/slugs outside of the client side mocks and contract aliases.
2. **Claude required versions validation**: We can confirm that the server filters out `claude-fable-5`, `claude-opus-4-8`, and `claude-opus-4-7` based on required minimum versions of the Claude Code CLI, but we cannot confirm how version advisory notices are calculated for other providers.
3. **Plan / Agent Selector Separation**: We confirmed that the `agent` descriptor is explicitly filtered out of `TraitsPicker` (handled as a standalone Plan Toggle in the composer footer), but we would need to inspect the footer layout file to verify where the selections are dispatched back to the model choices state.
