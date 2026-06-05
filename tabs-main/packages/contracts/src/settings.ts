import { Effect } from "effect";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { ProjectId, ThreadId, TrimmedNonEmptyString, TrimmedString } from "./baseSchemas";
import {
  ClaudeModelOptions,
  CodexModelOptions,
  DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER,
} from "./model";
import { ModelSelection } from "./orchestration";

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

export const CodexSettings = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(() => true)),
  binaryPath: makeBinaryPathSetting("codex"),
  homePath: TrimmedString.pipe(Schema.withDecodingDefault(() => "")),
  customModels: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(() => [])),
});
export type CodexSettings = typeof CodexSettings.Type;

export const ClaudeSettings = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefault(() => true)),
  binaryPath: makeBinaryPathSetting("claude"),
  customModels: Schema.Array(Schema.String).pipe(Schema.withDecodingDefault(() => [])),
});
export type ClaudeSettings = typeof ClaudeSettings.Type;

export const ServerSettings = Schema.Struct({
  enableAssistantStreaming: Schema.Boolean.pipe(Schema.withDecodingDefault(() => false)),
  defaultThreadEnvMode: ThreadEnvMode.pipe(
    Schema.withDecodingDefault(() => "local" as const satisfies ThreadEnvMode),
  ),
  textGenerationModelSelection: ModelSelection.pipe(
    Schema.withDecodingDefault(() => ({
      provider: "codex" as const,
      model: DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER.codex,
    })),
  ),

  // Provider specific settings
  providers: Schema.Struct({
    codex: CodexSettings.pipe(Schema.withDecodingDefault(() => ({}))),
    claudeAgent: ClaudeSettings.pipe(Schema.withDecodingDefault(() => ({}))),
  }).pipe(Schema.withDecodingDefault(() => ({}))),
});
export type ServerSettings = typeof ServerSettings.Type;

export const DEFAULT_SERVER_SETTINGS: ServerSettings = Schema.decodeSync(ServerSettings)({});

// ── Unified type ─────────────────────────────────────────────────────

export type UnifiedSettings = ServerSettings & ClientSettings;
export const DEFAULT_UNIFIED_SETTINGS: UnifiedSettings = {
  ...DEFAULT_SERVER_SETTINGS,
  ...DEFAULT_CLIENT_SETTINGS,
};

// ── Server Settings Patch (replace with a Schema.deepPartial if available) ──────────────────────────────────────────

const CodexModelOptionsPatch = Schema.Struct({
  reasoningEffort: Schema.optionalKey(CodexModelOptions.fields.reasoningEffort),
  fastMode: Schema.optionalKey(CodexModelOptions.fields.fastMode),
});

const ClaudeModelOptionsPatch = Schema.Struct({
  thinking: Schema.optionalKey(ClaudeModelOptions.fields.thinking),
  effort: Schema.optionalKey(ClaudeModelOptions.fields.effort),
  fastMode: Schema.optionalKey(ClaudeModelOptions.fields.fastMode),
});

const ModelSelectionPatch = Schema.Union([
  Schema.Struct({
    provider: Schema.optionalKey(Schema.Literal("codex")),
    model: Schema.optionalKey(TrimmedNonEmptyString),
    options: Schema.optionalKey(CodexModelOptionsPatch),
  }),
  Schema.Struct({
    provider: Schema.optionalKey(Schema.Literal("claudeAgent")),
    model: Schema.optionalKey(TrimmedNonEmptyString),
    options: Schema.optionalKey(ClaudeModelOptionsPatch),
  }),
]);

const CodexSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(Schema.String),
  homePath: Schema.optionalKey(Schema.String),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

const ClaudeSettingsPatch = Schema.Struct({
  enabled: Schema.optionalKey(Schema.Boolean),
  binaryPath: Schema.optionalKey(Schema.String),
  customModels: Schema.optionalKey(Schema.Array(Schema.String)),
});

export const ServerSettingsPatch = Schema.Struct({
  enableAssistantStreaming: Schema.optionalKey(Schema.Boolean),
  defaultThreadEnvMode: Schema.optionalKey(ThreadEnvMode),
  textGenerationModelSelection: Schema.optionalKey(ModelSelectionPatch),
  providers: Schema.optionalKey(
    Schema.Struct({
      codex: Schema.optionalKey(CodexSettingsPatch),
      claudeAgent: Schema.optionalKey(ClaudeSettingsPatch),
    }),
  ),
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
  activeToolIdByProjectId: Schema.Record(ProjectId, ProjectSettingId).pipe(
    Schema.withDecodingDefault(() => ({})),
  ),
  rememberedThreadIdByProjectId: Schema.Record(ProjectId, ThreadId).pipe(
    Schema.withDecodingDefault(() => ({})),
  ),
});
export type ProjectWorkspaceSessionState = typeof ProjectWorkspaceSessionState.Type;
