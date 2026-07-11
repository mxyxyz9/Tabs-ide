import { Duration, Effect } from "effect";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { ProjectId, ThreadId, TrimmedNonEmptyString, TrimmedString } from "./baseSchemas";
import { DEFAULT_GIT_TEXT_GENERATION_MODEL, ProviderOptionSelections } from "./model";
import { ModelSelection } from "./orchestration";
import { ProviderInstanceConfig, ProviderInstanceId } from "./providerInstance";

// ── Client Settings (local-only) ───────────────────────────────

export const TimestampFormat = Schema.Literals(["locale", "12-hour", "24-hour"]);
export type TimestampFormat = typeof TimestampFormat.Type;
export const DEFAULT_TIMESTAMP_FORMAT: TimestampFormat = "locale";

export const DesktopIconTheme = Schema.Literals(["dark", "light"]);
export type DesktopIconTheme = typeof DesktopIconTheme.Type;
export const DEFAULT_DESKTOP_ICON_THEME: DesktopIconTheme = "dark";

export const SidebarProjectSortOrder = Schema.Literals(["updated_at", "created_at", "manual"]);
export type SidebarProjectSortOrder = typeof SidebarProjectSortOrder.Type;
export const DEFAULT_SIDEBAR_PROJECT_SORT_ORDER: SidebarProjectSortOrder = "updated_at";

export const SidebarThreadSortOrder = Schema.Literals(["updated_at", "created_at"]);
export type SidebarThreadSortOrder = typeof SidebarThreadSortOrder.Type;
export const DEFAULT_SIDEBAR_THREAD_SORT_ORDER: SidebarThreadSortOrder = "updated_at";

export const ClientSettingsSchema = Schema.Struct({
  confirmTabClose: Schema.Boolean.pipe(Schema.withDecodingDefault(() => true)),
  confirmThreadDelete: Schema.Boolean.pipe(Schema.withDecodingDefault(() => true)),
  desktopIconTheme: DesktopIconTheme.pipe(
    Schema.withDecodingDefault(() => DEFAULT_DESKTOP_ICON_THEME),
  ),
  diffWordWrap: Schema.Boolean.pipe(Schema.withDecodingDefault(() => false)),
  sidebarProjectSortOrder: SidebarProjectSortOrder.pipe(
    Schema.withDecodingDefault(() => DEFAULT_SIDEBAR_PROJECT_SORT_ORDER),
  ),
  sidebarThreadSortOrder: SidebarThreadSortOrder.pipe(
    Schema.withDecodingDefault(() => DEFAULT_SIDEBAR_THREAD_SORT_ORDER),
  ),
  timestampFormat: TimestampFormat.pipe(Schema.withDecodingDefault(() => DEFAULT_TIMESTAMP_FORMAT)),
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
        decode: (value) => Effect.succeed(value || fallback),
        encode: (value) => Effect.succeed(value),
      }),
    ),
    Schema.withDecodingDefault(() => fallback),
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
      Schema.withDecodingDefault(() => true),
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
      Schema.withDecodingDefault(() => ""),
      Schema.annotateKey({
        title: "CODEX_HOME path",
        description: "Custom Codex home and config directory.",
        providerSettingsForm: { placeholder: "~/.codex", clearWhenEmpty: "omit" },
      }),
    ),
    shadowHomePath: TrimmedString.pipe(
      Schema.withDecodingDefault(() => ""),
      Schema.annotateKey({
        title: "Shadow home path",
        description:
          "Account-specific Codex home. Keeps auth.json separate while sharing state from CODEX_HOME.",
        providerSettingsForm: { placeholder: "~/.codex-tabs/personal", clearWhenEmpty: "omit" },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(() => []),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  { order: ["binaryPath", "homePath", "shadowHomePath"] },
);
export type CodexSettings = typeof CodexSettings.Type;

export const ClaudeSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(() => true),
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
      Schema.withDecodingDefault(() => ""),
      Schema.annotateKey({
        title: "Claude HOME path",
        description:
          "Custom HOME used when running this Claude instance. Keeps .claude.json and .claude separate.",
        providerSettingsForm: { placeholder: "~", clearWhenEmpty: "omit" },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(() => []),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    launchArgs: Schema.String.pipe(
      Schema.withDecodingDefault(() => ""),
      Schema.annotateKey({
        title: "Launch arguments",
        description: "Additional CLI arguments passed on session start.",
        providerSettingsForm: { placeholder: "e.g. --chrome", clearWhenEmpty: "omit" },
      }),
    ),
  },
  { order: ["binaryPath", "homePath", "launchArgs"] },
);
export type ClaudeSettings = typeof ClaudeSettings.Type;

export const CursorSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(() => false),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("agent").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the Cursor agent binary.",
        providerSettingsForm: { placeholder: "agent", clearWhenEmpty: "omit" },
      }),
    ),
    apiEndpoint: TrimmedString.pipe(
      Schema.withDecodingDefault(() => ""),
      Schema.annotateKey({
        title: "API endpoint",
        description: "Override the Cursor API endpoint for this instance.",
        providerSettingsForm: { placeholder: "https://...", clearWhenEmpty: "omit" },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(() => []),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  { order: ["binaryPath", "apiEndpoint"] },
);
export type CursorSettings = typeof CursorSettings.Type;

export const GrokSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(() => true),
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
      Schema.withDecodingDefault(() => []),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  { order: ["binaryPath"] },
);
export type GrokSettings = typeof GrokSettings.Type;

export const OpenCodeSettings = makeProviderSettingsSchema(
  {
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(() => true),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting("opencode").pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: "Path to the OpenCode binary.",
        providerSettingsForm: { placeholder: "opencode", clearWhenEmpty: "omit" },
      }),
    ),
    serverUrl: TrimmedString.pipe(
      Schema.withDecodingDefault(() => ""),
      Schema.annotateKey({
        title: "Server URL",
        description: "Leave blank to let Tabs spawn the server when needed.",
        providerSettingsForm: { placeholder: "http://127.0.0.1:4096", clearWhenEmpty: "omit" },
      }),
    ),
    serverPassword: TrimmedString.pipe(
      Schema.withDecodingDefault(() => ""),
      Schema.annotateKey({
        title: "Server password",
        description: "Stored in plain text on disk.",
        providerSettingsForm: {
          control: "password",
          placeholder: "Optional",
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(() => []),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  },
  { order: ["binaryPath", "serverUrl", "serverPassword"] },
);
export type OpenCodeSettings = typeof OpenCodeSettings.Type;

export const ObservabilitySettings = Schema.Struct({
  otlpTracesUrl: TrimmedString.pipe(Schema.withDecodingDefault(() => "")),
  otlpMetricsUrl: TrimmedString.pipe(Schema.withDecodingDefault(() => "")),
});
export type ObservabilitySettings = typeof ObservabilitySettings.Type;

export const DEFAULT_AUTOMATIC_GIT_FETCH_INTERVAL = Duration.seconds(30);

export const ServerSettings = Schema.Struct({
  enableAssistantStreaming: Schema.Boolean.pipe(Schema.withDecodingDefault(() => false)),
  alwaysCreateTasks: Schema.Boolean.pipe(Schema.withDecodingDefault(() => false)),
  // Stored as plain milliseconds (not DurationFromMillis) so the decoded shape
  // equals the encoded shape — the settings-patch flow re-decodes a merged,
  // already-decoded `ServerSettings`, which a Duration transform would break.
  automaticGitFetchInterval: Schema.Number.pipe(
    Schema.withDecodingDefault(() => Duration.toMillis(DEFAULT_AUTOMATIC_GIT_FETCH_INTERVAL)),
  ),
  defaultThreadEnvMode: ThreadEnvMode.pipe(
    Schema.withDecodingDefault(() => "local" as const satisfies ThreadEnvMode),
  ),
  textGenerationModelSelection: ModelSelection.pipe(
    Schema.withDecodingDefault(() => ({
      instanceId: ProviderInstanceId.makeUnsafe("codex"),
      model: DEFAULT_GIT_TEXT_GENERATION_MODEL,
    })),
  ),

  // Legacy single-instance-per-driver settings. Source of truth until
  // `providerInstances` hydration fully replaces it (see providerInstance.ts).
  providers: Schema.Struct({
    codex: CodexSettings.pipe(Schema.withDecodingDefault(() => ({}))),
    claudeAgent: ClaudeSettings.pipe(Schema.withDecodingDefault(() => ({}))),
    cursor: CursorSettings.pipe(Schema.withDecodingDefault(() => ({}))),
    grok: GrokSettings.pipe(Schema.withDecodingDefault(() => ({}))),
    opencode: OpenCodeSettings.pipe(Schema.withDecodingDefault(() => ({}))),
  }).pipe(Schema.withDecodingDefault(() => ({}))),
  // New driver-agnostic instance map keyed by `ProviderInstanceId`; values are
  // `ProviderInstanceConfig` envelopes whose driver-specific config is opaque
  // (`Schema.Unknown`) so unknown-driver envelopes round-trip without loss.
  providerInstances: Schema.Record(ProviderInstanceId, ProviderInstanceConfig).pipe(
    Schema.withDecodingDefault(() => ({})),
  ),
  observability: ObservabilitySettings.pipe(Schema.withDecodingDefault(() => ({}))),
});
export type ServerSettings = typeof ServerSettings.Type;

export const DEFAULT_SERVER_SETTINGS: ServerSettings = Schema.decodeSync(ServerSettings)({});

export class ServerSettingsError extends Schema.TaggedErrorClass<ServerSettingsError>()(
  "ServerSettingsError",
  {
    settingsPath: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Server settings error at ${this.settingsPath}: ${this.detail}`;
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

const OpenCodeSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(TrimmedString),
  serverUrl: Schema.optionalKey(TrimmedString),
  serverPassword: Schema.optionalKey(TrimmedString),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

export const ServerSettingsPatch = Schema.Struct({
  enableAssistantStreaming: Schema.optionalKey(Schema.Boolean),
  alwaysCreateTasks: Schema.optionalKey(Schema.Boolean),
  automaticGitFetchInterval: Schema.optionalKey(Schema.Number),
  defaultThreadEnvMode: Schema.optionalKey(ThreadEnvMode),
  textGenerationModelSelection: Schema.optionalKey(ModelSelectionPatch),
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
      opencode: Schema.optionalKey(OpenCodeSettingsPatch),
    }),
  ),
  // Whole-map replacement for the instance config (partial entry patches are
  // intentionally out of scope; the web UI sends a fully-formed map).
  providerInstances: Schema.optionalKey(Schema.Record(ProviderInstanceId, ProviderInstanceConfig)),
});
export type ServerSettingsPatch = typeof ServerSettingsPatch.Type;

// ── Project Workspace Shell (client-persisted) ──────────────────────

export const ProjectToolKind = Schema.Literals([
  "code",
  "agents",
  "server",
  "git",
  "browser",
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
] as const satisfies ReadonlyArray<ProjectToolKind>;

// Land on the lightweight Agents (chat) tab by default rather than the embedded
// editor. Defaulting to "code" made every fresh project open boot the heavy
// Code-OSS REH server immediately (server + workbench + extension host), which
// pegs the shared GPU/main process and makes the host UI freeze on first load —
// the Code boot now happens only when the user actually opens the Code tab.
export const DEFAULT_PROJECT_TOOL_KIND: ProjectToolKind = "agents";

const ProjectSettingId = TrimmedNonEmptyString;

export const ProjectCustomEmbedDefinition = Schema.Struct({
  id: ProjectSettingId,
  label: TrimmedNonEmptyString,
  url: TrimmedString,
});
export type ProjectCustomEmbedDefinition = typeof ProjectCustomEmbedDefinition.Type;

export const ProjectToolDefinition = Schema.Struct({
  id: ProjectSettingId,
  kind: ProjectToolKind,
  label: TrimmedNonEmptyString,
  visible: Schema.Boolean.pipe(Schema.withDecodingDefault(() => true)),
  customEmbedId: Schema.optionalKey(Schema.NullOr(ProjectSettingId)),
  serverProcessId: Schema.optionalKey(Schema.NullOr(ProjectSettingId)),
});
export type ProjectToolDefinition = typeof ProjectToolDefinition.Type;

export const ProjectBrowserSettings = Schema.Struct({
  defaultUrl: TrimmedString.pipe(Schema.withDecodingDefault(() => "")),
  openExternalByDefault: Schema.Boolean.pipe(Schema.withDecodingDefault(() => false)),
});
export type ProjectBrowserSettings = typeof ProjectBrowserSettings.Type;

export const ProjectServerProcessDefinition = Schema.Struct({
  id: ProjectSettingId,
  label: TrimmedNonEmptyString,
  command: Schema.optionalKey(TrimmedString),
  commands: Schema.Array(TrimmedString).pipe(Schema.withDecodingDefault(() => [])),
  cwd: TrimmedString.pipe(Schema.withDecodingDefault(() => "")),
  env: Schema.Record(Schema.String, Schema.String).pipe(Schema.withDecodingDefault(() => ({}))),
  autoStart: Schema.Boolean.pipe(Schema.withDecodingDefault(() => false)),
});
export type ProjectServerProcessDefinition = typeof ProjectServerProcessDefinition.Type;

export const ProjectWorkspaceSettings = Schema.Struct({
  tools: Schema.Array(ProjectToolDefinition).pipe(
    Schema.withDecodingDefault(() =>
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
                  : "Browser",
        visible: true,
      })),
    ),
  ),
  browser: ProjectBrowserSettings.pipe(Schema.withDecodingDefault(() => ({}))),
  serverProcesses: Schema.Array(ProjectServerProcessDefinition).pipe(
    Schema.withDecodingDefault(() => []),
  ),
  customEmbeds: Schema.Array(ProjectCustomEmbedDefinition).pipe(
    Schema.withDecodingDefault(() => []),
  ),
});
export type ProjectWorkspaceSettings = typeof ProjectWorkspaceSettings.Type;

export const ProjectWorkspaceSessionState = Schema.Struct({
  openProjectIds: Schema.Array(ProjectId).pipe(Schema.withDecodingDefault(() => [])),
  activeProjectId: Schema.NullOr(ProjectId).pipe(Schema.withDecodingDefault(() => null)),
  // Ordered list of pending (unassigned) tab IDs. Each is a stable random string,
  // never a ProjectId. A pending tab shows the Welcome/landing screen until the
  // user picks a folder or recent project to resolve it into a real project tab.
  pendingTabIds: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(() => [])),
  // Which slot is focused: either a real project ID or a pending tab ID. When
  // both activeProjectId and activePendingTabId are set, activePendingTabId wins
  // for determining what to render in the content area.
  activePendingTabId: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefault(() => null)),
  activeToolIdByProjectId: Schema.Record(ProjectId, ProjectSettingId).pipe(
    Schema.withDecodingDefault(() => ({})),
  ),
  rememberedThreadIdByProjectId: Schema.Record(ProjectId, ThreadId).pipe(
    Schema.withDecodingDefault(() => ({})),
  ),
});
export type ProjectWorkspaceSessionState = typeof ProjectWorkspaceSessionState.Type;

