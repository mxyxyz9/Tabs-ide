import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import {
  TrimmedNonEmptyString,
  TrimmedString,
  ProjectId,
  ThreadId,
  NonNegativeInt,
  PositiveInt,
} from "./baseSchemas.ts";
import { DEFAULT_GIT_TEXT_GENERATION_MODEL, ProviderOptionSelections } from "./model.ts";
import { ModelSelection } from "./orchestration.ts";
import { ProviderInstanceConfig, ProviderInstanceId } from "./providerInstance.ts";

// ── Client Settings (local-only) ───────────────────────────────

export const TimestampFormat = Schema.Literals(["locale", "12-hour", "24-hour"]);
export type TimestampFormat = typeof TimestampFormat.Type;
export const DEFAULT_TIMESTAMP_FORMAT: TimestampFormat = "locale";

export const SidebarProjectSortOrder = Schema.Literals(["updated_at", "created_at", "manual"]);
export type SidebarProjectSortOrder = typeof SidebarProjectSortOrder.Type;
export const DEFAULT_SIDEBAR_PROJECT_SORT_ORDER: SidebarProjectSortOrder = "updated_at";

export const SidebarThreadSortOrder = Schema.Literals(["updated_at", "created_at"]);
export type SidebarThreadSortOrder = typeof SidebarThreadSortOrder.Type;
export const DEFAULT_SIDEBAR_THREAD_SORT_ORDER: SidebarThreadSortOrder = "updated_at";

export const SidebarProjectGroupingMode = Schema.Literals([
  "repository",
  "repository_path",
  "separate",
]);
export type SidebarProjectGroupingMode = typeof SidebarProjectGroupingMode.Type;
export const DEFAULT_SIDEBAR_PROJECT_GROUPING_MODE: SidebarProjectGroupingMode = "repository";
export const MIN_SIDEBAR_THREAD_PREVIEW_COUNT = 1;
export const MAX_SIDEBAR_THREAD_PREVIEW_COUNT = 15;
export const SidebarThreadPreviewCount = Schema.Int.check(
  Schema.isBetween({
    minimum: MIN_SIDEBAR_THREAD_PREVIEW_COUNT,
    maximum: MAX_SIDEBAR_THREAD_PREVIEW_COUNT,
  }),
);
export type SidebarThreadPreviewCount = typeof SidebarThreadPreviewCount.Type;
export const DEFAULT_SIDEBAR_THREAD_PREVIEW_COUNT: SidebarThreadPreviewCount = 6;

export const DesktopIconTheme = Schema.Literals(["dark", "light"]);
export type DesktopIconTheme = typeof DesktopIconTheme.Type;
export const DEFAULT_DESKTOP_ICON_THEME: DesktopIconTheme = "dark";

export const ToolbarStyle = Schema.Literals([
  "solid",
  "linear-edge",
  "traveling-border",
  "ghost-mesh",
  "spotlight",
  "dot",
  "refraction",
  "material",
  "titanium",
  "groove",
]);
export type ToolbarStyle = typeof ToolbarStyle.Type;
export const DEFAULT_TOOLBAR_STYLE: ToolbarStyle = "solid";

export const SplashLoaderStyle = Schema.Literals(["glass", "solari"]);
export type SplashLoaderStyle = typeof SplashLoaderStyle.Type;
export const DEFAULT_SPLASH_LOADER_STYLE: SplashLoaderStyle = "glass";

export const SplashLoaderPalette = Schema.Literals(["block", "mono"]);
export type SplashLoaderPalette = typeof SplashLoaderPalette.Type;
export const DEFAULT_SPLASH_LOADER_PALETTE: SplashLoaderPalette = "mono";

export const SplashLoaderTheme = Schema.Literals(["system", "light", "dark"]);
export type SplashLoaderTheme = typeof SplashLoaderTheme.Type;
export const DEFAULT_SPLASH_LOADER_THEME: SplashLoaderTheme = "system";

export const SplashMinimumHoldSeconds = Schema.Literals([0, 1, 2, 3]);
export type SplashMinimumHoldSeconds = typeof SplashMinimumHoldSeconds.Type;
// Legacy persisted preference. Startup now uses a fixed two-second animation
// hold, but older settings files must continue to decode without migration.
export const DEFAULT_SPLASH_MINIMUM_HOLD_SECONDS: SplashMinimumHoldSeconds = 2;

// Close animation — independent from startup, reuses same enum types
export const DEFAULT_CLOSE_LOADER_STYLE: SplashLoaderStyle = "glass";
export const DEFAULT_CLOSE_LOADER_PALETTE: SplashLoaderPalette = "mono";
export const DEFAULT_CLOSE_LOADER_THEME: SplashLoaderTheme = "system";

export const PinnedModelEntry = Schema.Struct({
  provider: ProviderInstanceId,
  model: TrimmedNonEmptyString,
});
export type PinnedModelEntry = typeof PinnedModelEntry.Type;

export const AiProvider = Schema.Literals(["tabs", "copilot"]);
export type AiProvider = typeof AiProvider.Type;
export const DEFAULT_AI_PROVIDER: AiProvider = "copilot";

export const BrowserProfileDefinition = Schema.Struct({
  id: TrimmedNonEmptyString,
  label: TrimmedNonEmptyString,
  description: Schema.optionalKey(TrimmedString),
  color: Schema.optionalKey(TrimmedString),
  createdAt: Schema.Number.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
});
export type BrowserProfileDefinition = typeof BrowserProfileDefinition.Type;

export const DEFAULT_BROWSER_PROFILES: readonly BrowserProfileDefinition[] = [
  { id: "personal", label: "Personal", color: "#3b82f6", createdAt: 0 },
  { id: "work", label: "Work", color: "#10b981", createdAt: 0 },
];

export const ClientSettingsSchema = Schema.Struct({
  aiProvider: AiProvider.pipe(Schema.withDecodingDefault(Effect.succeed(DEFAULT_AI_PROVIDER))),
  toolbarStyle: ToolbarStyle.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_TOOLBAR_STYLE)),
  ),
  desktopIconTheme: DesktopIconTheme.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_DESKTOP_ICON_THEME)),
  ),
  browserProfiles: Schema.Array(BrowserProfileDefinition).pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_BROWSER_PROFILES)),
  ),
  autoOpenPlanSidebar: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  confirmThreadArchive: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  confirmThreadDelete: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  confirmTabClose: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  dismissedProviderUpdateNotificationKeys: Schema.Array(TrimmedNonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  diffIgnoreWhitespace: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  diffWordWrap: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  // Model pinned state. Keyed by ProviderInstanceId.
  // Preserves decoding fallback for legacy `favorites` array.
  pinnedModels: Schema.Array(PinnedModelEntry).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  favorites: Schema.Array(PinnedModelEntry).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  providerModelPreferences: Schema.Record(
    ProviderInstanceId,
    Schema.Struct({
      hiddenModels: Schema.Array(Schema.String).pipe(
        Schema.withDecodingDefault(Effect.succeed([])),
      ),
      modelOrder: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
    }),
  ).pipe(Schema.withDecodingDefault(Effect.succeed({}))),
  sidebarProjectGroupingMode: SidebarProjectGroupingMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_SIDEBAR_PROJECT_GROUPING_MODE)),
  ),
  sidebarProjectGroupingOverrides: Schema.Record(
    TrimmedNonEmptyString,
    SidebarProjectGroupingMode,
  ).pipe(Schema.withDecodingDefault(Effect.succeed({}))),
  sidebarProjectSortOrder: SidebarProjectSortOrder.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_SIDEBAR_PROJECT_SORT_ORDER)),
  ),
  sidebarThreadSortOrder: SidebarThreadSortOrder.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_SIDEBAR_THREAD_SORT_ORDER)),
  ),
  sidebarThreadPreviewCount: SidebarThreadPreviewCount.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_SIDEBAR_THREAD_PREVIEW_COUNT)),
  ),
  timestampFormat: TimestampFormat.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_TIMESTAMP_FORMAT)),
  ),
  wordWrap: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  sliderAnimationsEnabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  animatedTrackFillEnabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  nyanCatSliderMode: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  colorizePermissions: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  splashLoaderStyle: SplashLoaderStyle.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_SPLASH_LOADER_STYLE)),
  ),
  splashLoaderPalette: SplashLoaderPalette.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_SPLASH_LOADER_PALETTE)),
  ),
  splashLoaderTheme: SplashLoaderTheme.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_SPLASH_LOADER_THEME)),
  ),
  splashMinimumHoldSeconds: SplashMinimumHoldSeconds.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_SPLASH_MINIMUM_HOLD_SECONDS)),
  ),
  closeLoaderStyle: SplashLoaderStyle.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_CLOSE_LOADER_STYLE)),
  ),
  closeLoaderPalette: SplashLoaderPalette.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_CLOSE_LOADER_PALETTE)),
  ),
  closeLoaderTheme: SplashLoaderTheme.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_CLOSE_LOADER_THEME)),
  ),
});
export type ClientSettings = typeof ClientSettingsSchema.Type;

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = Schema.decodeSync(ClientSettingsSchema)({});

// ── Server Settings (server-authoritative) ────────────────────

export const ThreadEnvMode = Schema.Literals(["local", "worktree"]);
export type ThreadEnvMode = typeof ThreadEnvMode.Type;

const makeBinaryPathSetting = (fallback: string) =>
  TrimmedString.pipe(
    Schema.decodeTo(
      Schema.String,
      SchemaTransformation.transformOrFail({
        decode: (value) => {
          let resolved = value || fallback;
          if (fallback === "cursor-agent" && resolved === "agent") {
            resolved = "cursor-agent";
          }
          return Effect.succeed(resolved);
        },
        encode: (value) => Effect.succeed(value),
      }),
    ),
    Schema.withDecodingDefault(Effect.succeed(fallback)),
  );

/**
 * Accepts a provider secret as write-only input while encoding it as empty.
 * The server moves decoded values into secure storage before persisting settings.
 */
const WriteOnlyProviderSecretString = TrimmedString.pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transformOrFail({
      decode: (value) => Effect.succeed(value),
      encode: () => Effect.succeed(""),
    }),
  ),
);

export type ProviderSettingsFormControl = "text" | "password" | "textarea" | "switch";

export interface ProviderSettingsFormAnnotation {
  readonly control?: ProviderSettingsFormControl | undefined;
  readonly placeholder?: string | undefined;
  readonly hidden?: boolean | undefined;
  readonly clearWhenEmpty?: "omit" | "persist" | undefined;
}

export interface ProviderSettingsFormSchemaAnnotation {
  readonly order?: readonly string[] | undefined;
}

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly providerSettingsForm?: ProviderSettingsFormAnnotation | undefined;
      readonly providerSettingsFormSchema?: ProviderSettingsFormSchemaAnnotation | undefined;
    }
  }
}

export type ProviderSettingsOrder<Fields extends Schema.Struct.Fields> = readonly Extract<
  keyof Fields,
  string
>[];

export function makeProviderSettingsSchema<const Fields extends Schema.Struct.Fields>(
  fields: Fields,
  options?: {
    readonly order?: ProviderSettingsOrder<Fields> | undefined;
  },
): Schema.Struct<Fields> {
  return Schema.Struct(fields).pipe(
    Schema.annotate({
      providerSettingsFormSchema:
        options?.order === undefined ? undefined : { order: options.order },
    }),
  );
}

export const CodexSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(true)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("codex").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the Codex binary used by this instance.",
        providerSettingsForm: { placeholder: "codex", clearWhenEmpty: "omit" },
      }),
    ),
    homePath: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "CODEX_HOME path",
        description: "Custom Codex home and config directory.",
        providerSettingsForm: {
          placeholder: "~/.codex",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    shadowHomePath: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "Shadow home path",
        description:
          "Account-specific Codex home. Keeps auth.json separate while sharing state from CODEX_HOME.",
        providerSettingsForm: {
          placeholder: "~/.codex-t3/personal",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  {
    order: ["binaryPath", "homePath", "shadowHomePath"],
  },
);
export type CodexSettings = typeof CodexSettings.Type;

export const ClaudeSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(true)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("claude").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the Claude binary used by this instance.",
        providerSettingsForm: { placeholder: "claude", clearWhenEmpty: "omit" },
      }),
    ),
    homePath: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "Claude HOME path",
        description:
          "Custom HOME used when running this Claude instance. Keeps .claude.json and .claude separate.",
        providerSettingsForm: { placeholder: "~", clearWhenEmpty: "omit" },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    launchArgs: Schema.String.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "Launch arguments",
        description: "Additional CLI arguments passed on session start.",
        providerSettingsForm: {
          placeholder: "e.g. --chrome",
          clearWhenEmpty: "omit",
        },
      }),
    ),
  },
  {
    order: ["binaryPath", "homePath", "launchArgs"],
  },
);
export type ClaudeSettings = typeof ClaudeSettings.Type;

export const CursorSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("cursor-agent").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the Cursor agent binary.",
        providerSettingsForm: { placeholder: "cursor-agent", clearWhenEmpty: "omit" },
      }),
    ),
    apiEndpoint: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "API endpoint",
        description: "Override the Cursor API endpoint for this instance.",
        providerSettingsForm: {
          placeholder: "https://...",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  {
    order: ["binaryPath", "apiEndpoint"],
  },
);
export type CursorSettings = typeof CursorSettings.Type;

export const CopilotSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("copilot").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the GitHub Copilot CLI binary.",
        providerSettingsForm: { placeholder: "copilot", clearWhenEmpty: "omit" },
      }),
    ),
    gheHost: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "GitHub Enterprise host",
        description: "Optional GitHub Enterprise hostname (e.g. https://example.ghe.com).",
        providerSettingsForm: {
          placeholder: "https://example.ghe.com",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    token: WriteOnlyProviderSecretString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "GitHub token",
        description: "Optional personal access token (PAT v2 with Copilot Requests permission).",
        providerSettingsForm: {
          placeholder: "github_pat_...",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    byokProvider: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "BYOK provider",
        description: "Optional BYOK provider name (e.g. anthropic, openai).",
        providerSettingsForm: {
          placeholder: "anthropic",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    byokApiKey: WriteOnlyProviderSecretString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "BYOK API key",
        description: "Optional API key for the configured BYOK provider.",
        providerSettingsForm: {
          placeholder: "sk-...",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  {
    order: ["binaryPath", "gheHost", "token", "byokProvider", "byokApiKey"],
  },
);
export type CopilotSettings = typeof CopilotSettings.Type;

export const GrokSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(true)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("grok").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the Grok CLI binary.",
        providerSettingsForm: { placeholder: "grok", clearWhenEmpty: "omit" },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  {
    order: ["binaryPath"],
  },
);
export type GrokSettings = typeof GrokSettings.Type;

export const OpenCodeSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(true)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("opencode").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the OpenCode binary.",
        providerSettingsForm: {
          placeholder: "opencode",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    serverUrl: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "Server URL",
        description: "Leave blank to let T3 Code spawn the server when needed.",
        providerSettingsForm: {
          placeholder: "http://127.0.0.1:4096",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    serverPassword: WriteOnlyProviderSecretString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "Server password",
        description: "Stored securely in the operating system credential store.",
        providerSettingsForm: {
          control: "password",
          placeholder: "Optional",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    experimentalWebSockets: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  {
    order: ["binaryPath", "serverUrl", "serverPassword"],
  },
);
export type OpenCodeSettings = typeof OpenCodeSettings.Type;

export const KiloSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(true)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("kilo").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the Kilo binary.",
        providerSettingsForm: {
          placeholder: "kilo",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    serverUrl: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "Server URL",
        description: "Leave blank to let Tabs spawn the server when needed.",
        providerSettingsForm: {
          placeholder: "http://127.0.0.1:4096",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    serverPassword: WriteOnlyProviderSecretString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "Server password",
        description: "Stored securely in the operating system credential store.",
        providerSettingsForm: {
          control: "password",
          placeholder: "Optional",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  {
    order: ["binaryPath", "serverUrl", "serverPassword"],
  },
);
export type KiloSettings = typeof KiloSettings.Type;

export const DroidSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
    binaryPath: makeBinaryPathSetting("droid"),
    apiKey: WriteOnlyProviderSecretString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "Factory API key",
        description: "Stored securely in the operating system credential store.",
        providerSettingsForm: {
          control: "password",
          placeholder: "fk-...",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  },
  { order: ["binaryPath", "apiKey"] },
);
export type DroidSettings = typeof DroidSettings.Type;

export const AntigravitySettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
    binaryPath: makeBinaryPathSetting("agy"),
    customModels: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  },
  { order: ["binaryPath"] },
);
export type AntigravitySettings = typeof AntigravitySettings.Type;

export const OpenRouterSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
    apiKey: WriteOnlyProviderSecretString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "API key",
        description:
          "OpenRouter API key, stored securely in the operating system credential store.",
        providerSettingsForm: {
          control: "password",
          placeholder: "sk-or-v1-...",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    baseUrl: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("https://openrouter.ai/api/v1")),
    ),
    customModels: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  },
  { order: ["apiKey", "baseUrl"] },
);
export type OpenRouterSettings = typeof OpenRouterSettings.Type;

export const GeminiSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(true)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    apiKey: WriteOnlyProviderSecretString.pipe(
      Schema.withDecodingDefault(Effect.succeed("")),
      Schema.annotateKey({
        title: "API key",
        description: "Google Gemini API key from Google AI Studio.",
        providerSettingsForm: {
          control: "password",
          placeholder: "AIzaSy...",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    baseUrl: TrimmedString.pipe(
      Schema.withDecodingDefault(Effect.succeed("https://generativelanguage.googleapis.com")),
      Schema.annotateKey({
        title: "API Base URL",
        description: "Custom base URL for Gemini API (optional).",
        providerSettingsForm: {
          placeholder: "https://generativelanguage.googleapis.com",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  {
    order: ["apiKey", "baseUrl"],
  },
);
export type GeminiSettings = typeof GeminiSettings.Type;

export const GitAiStaticAnalysisSettings = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  tools: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
});
export type GitAiStaticAnalysisSettings = typeof GitAiStaticAnalysisSettings.Type;

export const GitAiRepoContextSettings = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  maxCallersPerSymbol: Schema.Number.pipe(Schema.withDecodingDefault(Effect.succeed(5))),
  maxCommitHistoryPerFile: Schema.Number.pipe(Schema.withDecodingDefault(Effect.succeed(3))),
});
export type GitAiRepoContextSettings = typeof GitAiRepoContextSettings.Type;

export const GitAiReviewSettings = Schema.Struct({
  passes: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(["correctness", "security"])),
  ),
});
export type GitAiReviewSettings = typeof GitAiReviewSettings.Type;

export const GitAiSettings = Schema.Struct({
  modelSourceMode: Schema.optional(Schema.Literals(["connected", "direct_gemini"])),
  gitTextGenerationModelSelection: Schema.optional(ModelSelection),
  customPromptInstructions: TrimmedString.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
  includeSummarySection: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  includeKeyChangesSection: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  includeNotesAndRiskSection: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  staticAnalysis: GitAiStaticAnalysisSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
  repoContext: GitAiRepoContextSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
  review: GitAiReviewSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
});
export type GitAiSettings = typeof GitAiSettings.Type;

export const ObservabilitySettings = Schema.Struct({
  otlpTracesUrl: TrimmedString.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
  otlpMetricsUrl: TrimmedString.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
});
export type ObservabilitySettings = typeof ObservabilitySettings.Type;

export const DEFAULT_AUTOMATIC_GIT_FETCH_INTERVAL = Duration.seconds(30);

export const ServerSettings = Schema.Struct({
  enableAssistantStreaming: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  alwaysCreateTasks: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  enableProviderUpdateChecks: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  automaticGitFetchInterval: Schema.DurationFromMillis.pipe(
    Schema.withDecodingDefault(
      Effect.succeed(Duration.toMillis(DEFAULT_AUTOMATIC_GIT_FETCH_INTERVAL)),
    ),
  ),
  defaultThreadEnvMode: ThreadEnvMode.pipe(
    Schema.withDecodingDefault(Effect.succeed("local" as const satisfies ThreadEnvMode)),
  ),
  newWorktreesStartFromOrigin: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(false)),
  ),
  addProjectBaseDirectory: TrimmedString.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
  textGenerationModelSelection: ModelSelection.pipe(
    Schema.withDecodingDefault(
      Effect.succeed({
        instanceId: ProviderInstanceId.make("codex"),
        model: DEFAULT_GIT_TEXT_GENERATION_MODEL,
      }),
    ),
  ),
  gitAi: GitAiSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),

  // Legacy single-instance-per-driver settings. Continues to be the source
  // of truth until `providerInstances` (below) lands per-driver migration
  // shims and the server starts hydrating instances from it. Driver-specific
  // schemas live here for the duration of the migration; once each driver
  // owns its config in its own package, this struct shrinks to nothing and
  // is removed entirely.
  providers: Schema.Struct({
    codex: CodexSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    claudeAgent: ClaudeSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    cursor: CursorSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    grok: GrokSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    copilot: CopilotSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    opencode: OpenCodeSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    kilo: KiloSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    droid: DroidSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    antigravity: AntigravitySettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    openrouter: OpenRouterSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
    gemini: GeminiSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
  }).pipe(Schema.withDecodingDefault(Effect.succeed({}))),
  // New driver-agnostic instance map. Keyed by `ProviderInstanceId`; values
  // are `ProviderInstanceConfig` envelopes. The driver-specific config blob
  // is `Schema.Unknown` at this layer so envelopes with unknown drivers
  // (forks, downgrades, in-flight PR branches) round-trip without loss.
  // See providerInstance.ts for the forward/backward compatibility invariant.
  providerInstances: Schema.Record(ProviderInstanceId, ProviderInstanceConfig).pipe(
    Schema.withDecodingDefault(Effect.succeed({})),
  ),
  observability: ObservabilitySettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
  favorites: Schema.Array(
    Schema.Struct({
      provider: ProviderInstanceId,
      model: TrimmedNonEmptyString,
    }),
  ).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
});
export type ServerSettings = typeof ServerSettings.Type;

export const DEFAULT_SERVER_SETTINGS: ServerSettings = Schema.decodeSync(ServerSettings)({});

export const ServerSettingsOperation = Schema.Literals([
  "normalize",
  "check-exists",
  "read-file",
  "read-secret",
  "remove-secret",
  "remove-stale-secret",
  "write-secret",
  "write-file",
  "prepare-directory",
]);
export type ServerSettingsOperation = typeof ServerSettingsOperation.Type;

export class ServerSettingsError extends Schema.TaggedErrorClass<ServerSettingsError>()(
  "ServerSettingsError",
  {
    settingsPath: Schema.String,
    operation: ServerSettingsOperation,
    providerInstanceId: Schema.optional(Schema.String),
    environmentVariable: Schema.optional(Schema.String),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    const provider =
      this.providerInstanceId === undefined ? "" : ` for provider ${this.providerInstanceId}`;
    const variable =
      this.environmentVariable === undefined
        ? ""
        : ` and environment variable ${this.environmentVariable}`;
    return `Server settings ${this.operation} failed${provider}${variable} at ${this.settingsPath}.`;
  }
}

// ── Unified type ─────────────────────────────────────────────────────

export type UnifiedSettings = ServerSettings & ClientSettings;
export const DEFAULT_UNIFIED_SETTINGS: UnifiedSettings = {
  ...DEFAULT_SERVER_SETTINGS,
  ...DEFAULT_CLIENT_SETTINGS,
};

// ── Server Settings Patch (replace with a Schema.deepPartial if available) ──────────────────────────────────────────

const ModelSelectionPatch = Schema.Struct({
  instanceId: Schema.optionalKey(ProviderInstanceId),
  model: Schema.optionalKey(TrimmedNonEmptyString),
  options: Schema.optionalKey(ProviderOptionSelections),
});

const CodexSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  homePath: Schema.optionalKey(TrimmedString),
  shadowHomePath: Schema.optionalKey(TrimmedString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const ClaudeSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  homePath: Schema.optionalKey(TrimmedString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
  launchArgs: Schema.optionalKey(TrimmedString),
});

const CursorSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  apiEndpoint: Schema.optionalKey(TrimmedString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const GrokSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const CopilotSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  gheHost: Schema.optionalKey(TrimmedString),
  token: Schema.optionalKey(WriteOnlyProviderSecretString),
  byokProvider: Schema.optionalKey(TrimmedString),
  byokApiKey: Schema.optionalKey(WriteOnlyProviderSecretString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const OpenCodeSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  serverUrl: Schema.optionalKey(TrimmedString),
  serverPassword: Schema.optionalKey(WriteOnlyProviderSecretString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
  experimentalWebSockets: Schema.optionalKey(Schema.Boolean),
});

const GeminiSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  apiKey: Schema.optionalKey(WriteOnlyProviderSecretString),
  baseUrl: Schema.optionalKey(TrimmedString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const KiloSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  serverUrl: Schema.optionalKey(TrimmedString),
  serverPassword: Schema.optionalKey(WriteOnlyProviderSecretString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const DroidSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  apiKey: Schema.optionalKey(WriteOnlyProviderSecretString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const AntigravitySettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const OpenRouterSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  apiKey: Schema.optionalKey(WriteOnlyProviderSecretString),
  baseUrl: Schema.optionalKey(TrimmedString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const GitAiStaticAnalysisSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  tools: Schema.optionalKey(Schema.Array(Schema.String)),
});

const GitAiRepoContextSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  maxCallersPerSymbol: Schema.optionalKey(Schema.Number),
  maxCommitHistoryPerFile: Schema.optionalKey(Schema.Number),
});

const GitAiReviewSettingsPatch = Schema.Struct({
  passes: Schema.optionalKey(Schema.Array(Schema.String)),
});

const GitAiSettingsPatch = Schema.Struct({
  modelSourceMode: Schema.optionalKey(Schema.Literals(["connected", "direct_gemini"])),
  gitTextGenerationModelSelection: Schema.optionalKey(ModelSelectionPatch),
  customPromptInstructions: Schema.optionalKey(TrimmedString),
  includeSummarySection: Schema.optionalKey(Schema.Boolean),
  includeKeyChangesSection: Schema.optionalKey(Schema.Boolean),
  includeNotesAndRiskSection: Schema.optionalKey(Schema.Boolean),
  staticAnalysis: Schema.optionalKey(GitAiStaticAnalysisSettingsPatch),
  repoContext: Schema.optionalKey(GitAiRepoContextSettingsPatch),
  review: Schema.optionalKey(GitAiReviewSettingsPatch),
});

export const ServerSettingsPatch = Schema.Struct({
  // Server settings
  enableAssistantStreaming: Schema.optionalKey(Schema.Boolean),
  alwaysCreateTasks: Schema.optionalKey(Schema.Boolean),
  enableProviderUpdateChecks: Schema.optionalKey(Schema.Boolean),
  automaticGitFetchInterval: Schema.optionalKey(Schema.DurationFromMillis),
  defaultThreadEnvMode: Schema.optionalKey(ThreadEnvMode),
  newWorktreesStartFromOrigin: Schema.optionalKey(Schema.Boolean),
  addProjectBaseDirectory: Schema.optionalKey(TrimmedString),
  textGenerationModelSelection: Schema.optionalKey(ModelSelectionPatch),
  gitAi: Schema.optionalKey(GitAiSettingsPatch),
  observability: Schema.optionalKey(
    Schema.Struct({
      otlpTracesUrl: Schema.optionalKey(TrimmedString),
      otlpMetricsUrl: Schema.optionalKey(TrimmedString),
    }),
  ),
  providers: Schema.optionalKey(
    Schema.Struct({
      codex: Schema.optionalKey(CodexSettingsPatch),
      claudeAgent: Schema.optionalKey(ClaudeSettingsPatch),
      cursor: Schema.optionalKey(CursorSettingsPatch),
      grok: Schema.optionalKey(GrokSettingsPatch),
      copilot: Schema.optionalKey(CopilotSettingsPatch),
      opencode: Schema.optionalKey(OpenCodeSettingsPatch),
      kilo: Schema.optionalKey(KiloSettingsPatch),
      droid: Schema.optionalKey(DroidSettingsPatch),
      antigravity: Schema.optionalKey(AntigravitySettingsPatch),
      openrouter: Schema.optionalKey(OpenRouterSettingsPatch),
      gemini: Schema.optionalKey(GeminiSettingsPatch),
    }),
  ),
  // Whole-map replacement for the new instance config. Patching individual
  // entries is intentionally out of scope: the map is small, and partial
  // patches risk leaving driver-specific config in a half-merged state.
  // The web UI sends a fully-formed map every time it edits this field.
  providerInstances: Schema.optionalKey(Schema.Record(ProviderInstanceId, ProviderInstanceConfig)),
  favorites: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        provider: ProviderInstanceId,
        model: TrimmedNonEmptyString,
      }),
    ),
  ),
});
export type ServerSettingsPatch = typeof ServerSettingsPatch.Type;

export const ClientSettingsPatch = Schema.Struct({
  toolbarStyle: Schema.optionalKey(ToolbarStyle),
  desktopIconTheme: Schema.optionalKey(DesktopIconTheme),
  autoOpenPlanSidebar: Schema.optionalKey(Schema.Boolean),
  confirmThreadArchive: Schema.optionalKey(Schema.Boolean),
  confirmThreadDelete: Schema.optionalKey(Schema.Boolean),
  confirmTabClose: Schema.optionalKey(Schema.Boolean),
  diffIgnoreWhitespace: Schema.optionalKey(Schema.Boolean),
  diffWordWrap: Schema.optionalKey(Schema.Boolean),
  favorites: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        provider: ProviderInstanceId,
        model: TrimmedNonEmptyString,
      }),
    ),
  ),
  providerModelPreferences: Schema.optionalKey(
    Schema.Record(
      ProviderInstanceId,
      Schema.Struct({
        hiddenModels: Schema.Array(Schema.String).pipe(
          Schema.withDecodingDefault(Effect.succeed([])),
        ),
        modelOrder: Schema.Array(Schema.String).pipe(
          Schema.withDecodingDefault(Effect.succeed([])),
        ),
      }),
    ),
  ),
  sidebarProjectGroupingMode: Schema.optionalKey(SidebarProjectGroupingMode),
  sidebarProjectGroupingOverrides: Schema.optionalKey(
    Schema.Record(TrimmedNonEmptyString, SidebarProjectGroupingMode),
  ),
  sidebarProjectSortOrder: Schema.optionalKey(SidebarProjectSortOrder),
  sidebarThreadSortOrder: Schema.optionalKey(SidebarThreadSortOrder),
  sidebarThreadPreviewCount: Schema.optionalKey(SidebarThreadPreviewCount),
  timestampFormat: Schema.optionalKey(TimestampFormat),
  wordWrap: Schema.optionalKey(Schema.Boolean),
  sliderAnimationsEnabled: Schema.optionalKey(Schema.Boolean),
  animatedTrackFillEnabled: Schema.optionalKey(Schema.Boolean),
  nyanCatSliderMode: Schema.optionalKey(Schema.Boolean),
  colorizePermissions: Schema.optionalKey(Schema.Boolean),
  splashLoaderStyle: Schema.optionalKey(SplashLoaderStyle),
  splashLoaderPalette: Schema.optionalKey(SplashLoaderPalette),
  splashLoaderTheme: Schema.optionalKey(SplashLoaderTheme),
  splashMinimumHoldSeconds: Schema.optionalKey(SplashMinimumHoldSeconds),
  closeLoaderStyle: Schema.optionalKey(SplashLoaderStyle),
  closeLoaderPalette: Schema.optionalKey(SplashLoaderPalette),
  closeLoaderTheme: Schema.optionalKey(SplashLoaderTheme),
});
export type ClientSettingsPatch = typeof ClientSettingsPatch.Type;

// ── Project Workspace Shell (client-persisted) ──────────────────────

export const ProjectToolKind = Schema.Literals([
  "code",
  "agents",
  "server",
  "git",
  "browser",
  "testing",
  "custom_embed",
  "custom_process",
]);
export type ProjectToolKind = typeof ProjectToolKind.Type;

export const BrowserDevicePreset = Schema.Literals([
  "project-default",
  "mobile-s",
  "mobile-l",
  "tablet",
  "desktop",
  "wide",
  "custom",
]);
export type BrowserDevicePreset = typeof BrowserDevicePreset.Type;

export const DEFAULT_PROJECT_TOOL_ORDER = [
  "code",
  "agents",
  "server",
  "git",
  "browser",
  "testing",
] as const satisfies ReadonlyArray<ProjectToolKind>;

// Land on the lightweight Agents (chat) tab by default rather than the embedded
// editor. Defaulting to "code" made every fresh project open boot the heavy
// Code-OSS REH server immediately (server + workbench + extension host), which
// pegs the shared GPU/main process and makes the host UI freeze on first load —
// the Code boot now happens only when the user actually opens the Code tab.
export const DEFAULT_PROJECT_TOOL_KIND: ProjectToolKind = "agents";

const ProjectSettingId = TrimmedNonEmptyString;

export const BrowserPartitionMode = Schema.Literals(["shared", "isolated", "profile"]);
export type BrowserPartitionMode = typeof BrowserPartitionMode.Type;
export const DEFAULT_BROWSER_PARTITION_MODE: BrowserPartitionMode = "shared";

export function resolveBrowserPartition(input: {
  projectId: string;
  sessionId?: string | undefined;
  partitionMode?: BrowserPartitionMode | undefined;
  partitionProfile?: string | undefined;
}): string {
  const mode = input.partitionMode ?? DEFAULT_BROWSER_PARTITION_MODE;
  if (mode === "isolated") {
    const effectiveSessionId = input.sessionId ?? "browser";
    return `persist:tabs-browser:${input.projectId}:${effectiveSessionId}`;
  }
  if (mode === "profile") {
    const profile = (input.partitionProfile ?? "").trim() || "default";
    return `persist:tabs-browser:profile:${profile}`;
  }
  return `persist:tabs-browser:${input.projectId}`;
}

export const ProjectCustomEmbedDefinition = Schema.Struct({
  id: ProjectSettingId,
  label: TrimmedNonEmptyString,
  url: TrimmedString,
  resumeLastVisitedPage: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  lastVisitedUrl: Schema.optionalKey(TrimmedString),
  partitionMode: BrowserPartitionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_BROWSER_PARTITION_MODE)),
  ),
  partitionProfile: Schema.optionalKey(TrimmedString),
});
export type ProjectCustomEmbedDefinition = typeof ProjectCustomEmbedDefinition.Type;

export const ProjectToolDefinition = Schema.Struct({
  id: ProjectSettingId,
  kind: ProjectToolKind,
  label: TrimmedNonEmptyString,
  visible: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  customEmbedId: Schema.optionalKey(Schema.NullOr(ProjectSettingId)),
  serverProcessId: Schema.optionalKey(Schema.NullOr(ProjectSettingId)),
  terminalProcessId: Schema.optionalKey(Schema.NullOr(ProjectSettingId)),
});
export type ProjectToolDefinition = typeof ProjectToolDefinition.Type;

export const ProjectBrowserSettings = Schema.Struct({
  defaultUrl: TrimmedString.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
  openExternalByDefault: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  resumeLastVisitedPage: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  partitionMode: BrowserPartitionMode.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_BROWSER_PARTITION_MODE)),
  ),
  partitionProfile: Schema.optionalKey(TrimmedString),
});
export type ProjectBrowserSettings = typeof ProjectBrowserSettings.Type;

export const ProjectServerProcessDefinition = Schema.Struct({
  id: ProjectSettingId,
  label: TrimmedNonEmptyString,
  command: Schema.optionalKey(TrimmedString),
  commands: Schema.Array(TrimmedString).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  cwd: TrimmedString.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
  env: Schema.Record(Schema.String, Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed({})),
  ),
  autoStart: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
});
export type ProjectServerProcessDefinition = typeof ProjectServerProcessDefinition.Type;

export const ProjectServerPresetDefinition = Schema.Struct({
  id: ProjectSettingId,
  label: TrimmedNonEmptyString,
  command: Schema.optionalKey(TrimmedString),
  commands: Schema.Array(TrimmedString).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  cwd: TrimmedString.pipe(Schema.withDecodingDefault(Effect.succeed(""))),
  env: Schema.Record(Schema.String, Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed({})),
  ),
  autoStart: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  previewUrl: Schema.optionalKey(TrimmedString),
  autoOpenPreview: Schema.optionalKey(Schema.Boolean),
  previewOpenTarget: Schema.optionalKey(Schema.Literals(["in-app", "external"])),
  previewFocus: Schema.optionalKey(Schema.Boolean),
  dependsOn: Schema.optionalKey(Schema.Array(Schema.String)),
});
export type ProjectServerPresetDefinition = typeof ProjectServerPresetDefinition.Type;

export const ProjectWorkspaceSettings = Schema.Struct({
  tools: Schema.Array(ProjectToolDefinition).pipe(
    Schema.withDecodingDefault(
      Effect.succeed(
        DEFAULT_PROJECT_TOOL_ORDER.map((kind) => ({
          id: kind,
          kind,
          label:
            kind === "code"
              ? "Code"
              : kind === "agents"
                ? "Agents"
                : kind === "server"
                  ? "Server"
                  : kind === "git"
                    ? "Git"
                    : kind === "browser"
                      ? "Browser"
                      : "Testing",
          visible: true,
        })),
      ),
    ),
  ),
  browser: ProjectBrowserSettings.pipe(Schema.withDecodingDefault(Effect.succeed({}))),
  terminalProcesses: Schema.Array(ProjectServerProcessDefinition).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  serverPresets: Schema.Array(ProjectServerPresetDefinition).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  customEmbeds: Schema.Array(ProjectCustomEmbedDefinition).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});
export type ProjectWorkspaceSettings = typeof ProjectWorkspaceSettings.Type;

export const DEFAULT_PROJECT_WORKSPACE_SETTINGS: ProjectWorkspaceSettings = Schema.decodeSync(
  ProjectWorkspaceSettings,
)({});

export const ProjectWorkspaceSessionState = Schema.Struct({
  openProjectIds: Schema.Array(ProjectId).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  activeProjectId: Schema.NullOr(ProjectId).pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  // Ordered list of pending (unassigned) tab IDs. Each is a stable random string,
  // never a ProjectId. A pending tab shows the Welcome/landing screen until the
  // user picks a folder or recent project to resolve it into a real project tab.
  pendingTabIds: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  // Which slot is focused: either a real project ID or a pending tab ID. When
  // both activeProjectId and activePendingTabId are set, activePendingTabId wins
  // for determining what to render in the content area.
  activePendingTabId: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(null)),
  ),
  activeToolIdByProjectId: Schema.Record(ProjectId, ProjectSettingId).pipe(
    Schema.withDecodingDefault(Effect.succeed({})),
  ),
  rememberedThreadIdByProjectId: Schema.Record(ProjectId, ThreadId).pipe(
    Schema.withDecodingDefault(Effect.succeed({})),
  ),
});
export type ProjectWorkspaceSessionState = typeof ProjectWorkspaceSessionState.Type;
