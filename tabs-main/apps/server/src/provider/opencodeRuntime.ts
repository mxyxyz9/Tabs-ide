import { pathToFileURL } from "node:url";

import type { ChatAttachment, ProviderApprovalDecision, RuntimeMode } from "@tabs/contracts";
import {
  createOpencodeClient,
  type Agent,
  type FilePartInput,
  type OpencodeClient,
  type PermissionRuleset,
  type ProviderListResponse,
  type QuestionAnswer,
  type QuestionRequest,
} from "@opencode-ai/sdk/v2";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Scope from "effect/Scope";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { isWindowsCommandNotFound } from "../processRunner";
import { collectStreamAsString } from "./providerSnapshot";
import { buildProviderChildEnvironment } from "../providerChildEnvironment.ts";
import {
  teardownEffectProcessTree,
  teardownProviderProcessTree,
} from "./supervisedProcessTeardown.ts";
import * as NetService from "@tabs/shared/Net";
const encodeUnknownJsonStringExit = Schema.encodeUnknownExit(Schema.UnknownFromJsonString);
const OPENCODE_EMPTY_CONFIG_CONTENT = "{}";

const OPENCODE_SERVER_READY_PREFIX = "opencode server listening";
const DEFAULT_OPENCODE_SERVER_TIMEOUT_MS = 5_000;
const DEFAULT_HOSTNAME = "127.0.0.1";
export const KILO_CREDENTIAL_STARTUP_RETRY_DELAYS_MS = [500, 1_500] as const;
export interface OpenCodeServerProcess {
  readonly url: string;
  readonly exitCode: Effect.Effect<number, never>;
}

export interface OpenCodeServerConnection {
  readonly url: string;
  readonly exitCode: Effect.Effect<number, never> | null;
  readonly external: boolean;
}

export interface OpenCodeCliModelDescriptor {
  readonly slug: string;
  readonly providerID: string;
  readonly modelID: string;
  readonly name: string;
  readonly variants: ReadonlyArray<string>;
  readonly supportedReasoningEfforts: ReadonlyArray<{
    readonly value: string;
    readonly label?: string;
    readonly description?: string;
  }>;
  readonly defaultReasoningEffort?: string;
  readonly contextWindowOptions?: ReadonlyArray<{
    readonly value: string;
    readonly label: string;
    readonly isDefault?: true;
  }>;
  readonly defaultContextWindow?: string;
  readonly isFree?: boolean;
}

const OPENCODE_RUNTIME_ERROR_TAG = "OpenCodeRuntimeError";
export class OpenCodeRuntimeError extends Data.TaggedError(OPENCODE_RUNTIME_ERROR_TAG)<{
  readonly operation: string;
  readonly cause?: unknown;
  readonly detail: string;
}> {
  static readonly is = (u: unknown): u is OpenCodeRuntimeError =>
    P.isTagged(u, OPENCODE_RUNTIME_ERROR_TAG);
}

function encodeJsonStringForDiagnostics(input: unknown): string | undefined {
  const result = encodeUnknownJsonStringExit(input);
  return Exit.isSuccess(result) ? result.value : undefined;
}

export function openCodeRuntimeErrorDetail(cause: unknown): string {
  if (OpenCodeRuntimeError.is(cause)) return cause.detail;
  if (cause instanceof Error && cause.message.trim().length > 0) return cause.message.trim();
  if (cause && typeof cause === "object") {
    // SDK v2 throws { response, request, error? } shapes — extract what's useful
    const anyCause = cause as Record<string, unknown>;
    const status = (anyCause.response as { status?: number } | undefined)?.status;
    const body = anyCause.error ?? anyCause.data ?? anyCause.body;
    const encodedBody = encodeJsonStringForDiagnostics(body ?? cause);
    if (encodedBody) {
      return `status=${status ?? "?"} body=${encodedBody}`;
    }
  }
  return String(cause);
}

function isRetryableKiloCredentialStartupFailure(cause: unknown): boolean {
  const detail = openCodeRuntimeErrorDetail(cause).toLowerCase();
  return (
    detail.includes('failed query: update "credential" set') ||
    detail.includes("failed query: update 'credential' set") ||
    detail.includes("failed query: update `credential` set") ||
    detail.includes("sqlite_busy") ||
    detail.includes("database is busy") ||
    detail.includes("database is locked")
  );
}

export const runOpenCodeSdk = <A>(
  operation: string,
  fn: () => Promise<A>,
): Effect.Effect<A, OpenCodeRuntimeError> =>
  Effect.tryPromise({
    try: fn,
    catch: (cause) =>
      new OpenCodeRuntimeError({
        operation,
        detail: openCodeRuntimeErrorDetail(cause),
        cause,
      }),
  }).pipe(Effect.withSpan(`opencode.${operation}`));

export interface OpenCodeCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

export interface OpenCodeInventory {
  readonly providerList: ProviderListResponse;
  readonly agents: ReadonlyArray<Agent>;
}

export interface ParsedOpenCodeModelSlug {
  readonly providerID: string;
  readonly modelID: string;
}

export interface OpenCodeRuntimeShape {
  /**
   * Spawns a local OpenCode server process. Its lifetime is bound to the caller's
   * `Scope.Scope` — the child is killed automatically when that scope closes.
   * Consumers that want a long-lived server must create and hold a scope explicitly
   * (see {@link Scope.make}) and close it when done.
   */
  readonly startOpenCodeServerProcess: (input: {
    readonly binaryPath: string;
    readonly environment?: NodeJS.ProcessEnv;
    readonly port?: number;
    readonly hostname?: string;
    readonly timeoutMs?: number;
  }) => Effect.Effect<OpenCodeServerProcess, OpenCodeRuntimeError, Scope.Scope>;
  /**
   * Returns a handle to either an externally-managed OpenCode server (when
   * `serverUrl` is provided — no lifetime is attached to the caller's scope) or a
   * freshly spawned local server whose lifetime is bound to the caller's scope.
   */
  readonly connectToOpenCodeServer: (input: {
    readonly binaryPath: string;
    readonly serverUrl?: string | null;
    readonly environment?: NodeJS.ProcessEnv;
    readonly port?: number;
    readonly hostname?: string;
    readonly timeoutMs?: number;
    readonly retryKiloCredentialStartup?: boolean;
  }) => Effect.Effect<OpenCodeServerConnection, OpenCodeRuntimeError, Scope.Scope>;
  readonly runOpenCodeCommand: (input: {
    readonly binaryPath: string;
    readonly args: ReadonlyArray<string>;
    readonly environment?: NodeJS.ProcessEnv;
  }) => Effect.Effect<OpenCodeCommandResult, OpenCodeRuntimeError>;
  readonly createOpenCodeSdkClient: (input: {
    readonly baseUrl: string;
    readonly directory: string;
    readonly serverPassword?: string;
  }) => OpencodeClient;
  readonly loadOpenCodeInventory: (
    client: OpencodeClient,
  ) => Effect.Effect<OpenCodeInventory, OpenCodeRuntimeError>;
}

function parseServerUrlFromOutput(output: string): string | null {
  for (const line of output.split("\n")) {
    if (!line.includes("server listening")) {
      continue;
    }
    const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
    return match?.[1] ?? null;
  }
  return null;
}

export function toOpenCodePermissionReply(
  decision: ProviderApprovalDecision,
): "once" | "always" | "reject" {
  switch (decision) {
    case "accept":
      return "once";
    case "acceptForSession":
      return "always";
    case "decline":
    case "cancel":
    default:
      return "reject";
  }
}

export function openCodeQuestionId(
  index: number,
  question: QuestionRequest["questions"][number],
): string {
  const header = question.header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
  return header.length > 0 ? `question-${index}-${header}` : `question-${index}`;
}

export function toOpenCodeQuestionAnswers(
  request: QuestionRequest,
  answers: Record<string, unknown>,
): Array<QuestionAnswer> {
  return request.questions.map((question, index) => {
    const raw =
      answers[openCodeQuestionId(index, question)] ??
      answers[question.header] ??
      answers[question.question];
    if (Array.isArray(raw)) {
      return raw.filter((value): value is string => typeof value === "string");
    }
    if (typeof raw === "string") {
      return raw.trim().length > 0 ? [raw] : [];
    }
    return [];
  });
}

function ensureRuntimeError(
  operation: OpenCodeRuntimeError["operation"],
  detail: string,
  cause: unknown,
): OpenCodeRuntimeError {
  return OpenCodeRuntimeError.is(cause)
    ? cause
    : new OpenCodeRuntimeError({ operation, detail, cause });
}

export interface OpenCodeRuntimeLiveOptions {
  readonly teardownProcessTree?: typeof teardownProviderProcessTree;
  readonly netService?: NetService.NetServiceShape;
}

const makeOpenCodeRuntime = (options?: OpenCodeRuntimeLiveOptions) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const platformNetService = yield* NetService.NetService;
    const netService = options?.netService ?? platformNetService;

    const runOpenCodeCommand: OpenCodeRuntimeShape["runOpenCodeCommand"] = (input) =>
      Effect.gen(function* () {
        const binary = input.binaryPath?.trim() || "opencode";
        const child = yield* spawner.spawn(
          ChildProcess.make(binary, [...input.args], {
            shell: process.platform === "win32",
            env: input.environment ?? process.env,
          }),
        );
        const [stdout, stderr, code] = yield* Effect.all(
          [
            collectStreamAsString(child.stdout),
            collectStreamAsString(child.stderr),
            child.exitCode,
          ],
          { concurrency: "unbounded" },
        );
        const exitCode = Number(code);
        if (isWindowsCommandNotFound(exitCode, stderr)) {
          return yield* new OpenCodeRuntimeError({
            operation: "runOpenCodeCommand",
            detail: `spawn ${input.binaryPath} ENOENT`,
          });
        }
        return {
          stdout,
          stderr,
          code: exitCode,
        } satisfies OpenCodeCommandResult;
      }).pipe(
        Effect.scoped,
        Effect.mapError((cause) =>
          ensureRuntimeError(
            "runOpenCodeCommand",
            `Failed to execute '${input.binaryPath} ${input.args.join(" ")}': ${openCodeRuntimeErrorDetail(cause)}`,
            cause,
          ),
        ),
      );

    const startOpenCodeServerProcess: OpenCodeRuntimeShape["startOpenCodeServerProcess"] = (
      input,
    ) =>
      Effect.gen(function* () {
        // Bind this server's lifetime to the caller's scope. When the caller's
        // scope closes, the spawned child is killed and all associated fibers
        // are interrupted automatically — no `close()` method needed.
        const runtimeScope = yield* Scope.Scope;

        const hostname = input.hostname ?? DEFAULT_HOSTNAME;
        const port =
          input.port ??
          (yield* netService.findAvailablePort(0).pipe(
            Effect.mapError(
              (cause) =>
                new OpenCodeRuntimeError({
                  operation: "startOpenCodeServerProcess",
                  detail: `Failed to find available port: ${openCodeRuntimeErrorDetail(cause)}`,
                  cause,
                }),
            ),
          ));
        const timeoutMs = input.timeoutMs ?? DEFAULT_OPENCODE_SERVER_TIMEOUT_MS;
        const args = ["serve", `--hostname=${hostname}`, `--port=${port}`];
        const binary = input.binaryPath?.trim() || "opencode";

        const child = yield* spawner
          .spawn(
            ChildProcess.make(binary, args, {
              detached: process.platform !== "win32",
              shell: process.platform === "win32",
              env: {
                ...(input.environment ?? process.env),
                OPENCODE_CONFIG_CONTENT: OPENCODE_EMPTY_CONFIG_CONTENT,
              },
            }),
          )
          .pipe(
            Effect.provideService(Scope.Scope, runtimeScope),
            Effect.mapError(
              (cause) =>
                new OpenCodeRuntimeError({
                  operation: "startOpenCodeServerProcess",
                  detail: `Failed to spawn OpenCode server process: ${openCodeRuntimeErrorDetail(cause)}`,
                  cause,
                }),
            ),
          );

        yield* Scope.addFinalizer(
          runtimeScope,
          Effect.tryPromise({
            try: () =>
              teardownEffectProcessTree(
                child,
                options?.teardownProcessTree ?? teardownProviderProcessTree,
              ),
            catch: (cause) =>
              new OpenCodeRuntimeError({
                operation: "stopOpenCodeServerProcess",
                detail: `Failed to prove OpenCode server process-tree exit: ${openCodeRuntimeErrorDetail(cause)}`,
                cause,
              }),
          }).pipe(Effect.asVoid, Effect.orDie),
        );

        const stdoutRef = yield* Ref.make("");
        const stderrRef = yield* Ref.make("");
        const readyDeferred = yield* Deferred.make<string, OpenCodeRuntimeError>();

        const setReadyFromStdoutChunk = (chunk: string) =>
          Ref.updateAndGet(stdoutRef, (stdout) => `${stdout}${chunk}`).pipe(
            Effect.flatMap((nextStdout) => {
              const parsed = parseServerUrlFromOutput(nextStdout);
              return parsed
                ? Deferred.succeed(readyDeferred, parsed).pipe(Effect.ignore)
                : Effect.void;
            }),
          );

        const stdoutFiber = yield* child.stdout.pipe(
          Stream.decodeText(),
          Stream.runForEach(setReadyFromStdoutChunk),
          Effect.ignore,
          Effect.forkIn(runtimeScope),
        );
        const stderrFiber = yield* child.stderr.pipe(
          Stream.decodeText(),
          Stream.runForEach((chunk) => Ref.update(stderrRef, (stderr) => `${stderr}${chunk}`)),
          Effect.ignore,
          Effect.forkIn(runtimeScope),
        );

        const exitFiber = yield* child.exitCode.pipe(
          Effect.flatMap((code) =>
            Effect.gen(function* () {
              const stdout = yield* Ref.get(stdoutRef);
              const stderr = yield* Ref.get(stderrRef);
              const exitCode = Number(code);
              yield* Deferred.fail(
                readyDeferred,
                new OpenCodeRuntimeError({
                  operation: "startOpenCodeServerProcess",
                  detail: [
                    `OpenCode server exited before startup completed (code: ${String(exitCode)}).`,
                    stdout.trim() ? `stdout:\n${stdout.trim()}` : null,
                    stderr.trim() ? `stderr:\n${stderr.trim()}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n\n"),
                  cause: { exitCode, stdout, stderr },
                }),
              ).pipe(Effect.ignore);
            }),
          ),
          Effect.ignore,
          Effect.forkIn(runtimeScope),
        );

        const readyExit = yield* Effect.exit(
          Deferred.await(readyDeferred).pipe(Effect.timeoutOption(timeoutMs)),
        );

        // Startup-time fibers are no longer needed once ready has resolved (either
        // way). The exit fiber is only interrupted on failure; on success it keeps
        // the caller's `exitCode` effect observable until the scope closes.
        yield* Fiber.interrupt(stdoutFiber).pipe(Effect.ignore);
        yield* Fiber.interrupt(stderrFiber).pipe(Effect.ignore);

        if (Exit.isFailure(readyExit)) {
          yield* Fiber.interrupt(exitFiber).pipe(Effect.ignore);
          const squashed = Cause.squash(readyExit.cause);
          return yield* ensureRuntimeError(
            "startOpenCodeServerProcess",
            `Failed while waiting for OpenCode server startup: ${openCodeRuntimeErrorDetail(squashed)}`,
            squashed,
          );
        }

        const readyOption = readyExit.value;
        if (Option.isNone(readyOption)) {
          yield* Fiber.interrupt(exitFiber).pipe(Effect.ignore);
          return yield* new OpenCodeRuntimeError({
            operation: "startOpenCodeServerProcess",
            detail: `Timed out waiting for OpenCode server start after ${timeoutMs}ms.`,
          });
        }

        return {
          url: readyOption.value,
          exitCode: child.exitCode.pipe(
            Effect.map(Number),
            Effect.orElseSucceed(() => 0),
          ),
        } satisfies OpenCodeServerProcess;
      });

    const connectToOpenCodeServer: OpenCodeRuntimeShape["connectToOpenCodeServer"] = (input) => {
      const serverUrl = input.serverUrl?.trim();
      if (serverUrl) {
        // We don't own externally-configured servers — no scope interaction.
        return Effect.succeed({
          url: serverUrl,
          exitCode: null,
          external: true,
        });
      }

      const startInput = {
        binaryPath: input.binaryPath,
        ...(input.environment !== undefined ? { environment: input.environment } : {}),
        ...(input.port !== undefined ? { port: input.port } : {}),
        ...(input.hostname !== undefined ? { hostname: input.hostname } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
      };
      const startServer = input.retryKiloCredentialStartup
        ? Effect.gen(function* () {
            let retryIndex = 0;
            while (true) {
              const attemptScope = yield* Scope.make();
              const attempt = yield* Effect.exit(
                startOpenCodeServerProcess(startInput).pipe(
                  Effect.provideService(Scope.Scope, attemptScope),
                ),
              );
              if (Exit.isSuccess(attempt)) {
                yield* Effect.addFinalizer(() => Scope.close(attemptScope, Exit.void));
                return attempt.value;
              }

              yield* Scope.close(attemptScope, Exit.void).pipe(Effect.ignore);
              const retryDelayMs = KILO_CREDENTIAL_STARTUP_RETRY_DELAYS_MS[retryIndex];
              const failure = Cause.squash(attempt.cause);
              if (retryDelayMs === undefined || !isRetryableKiloCredentialStartupFailure(failure)) {
                return yield* Effect.failCause(attempt.cause);
              }

              retryIndex += 1;
              yield* Effect.logWarning(
                "Kilo credential reconciliation failed during startup; retrying",
                { attempt: retryIndex + 1, delayMs: retryDelayMs },
              );
              yield* Effect.sleep(retryDelayMs);
            }
          })
        : startOpenCodeServerProcess(startInput);

      return startServer.pipe(
        Effect.map((server) => ({
          url: server.url,
          exitCode: server.exitCode,
          external: false,
        })),
      );
    };

    const createOpenCodeSdkClient: OpenCodeRuntimeShape["createOpenCodeSdkClient"] = (input) =>
      createOpencodeClient({
        baseUrl: input.baseUrl,
        directory: input.directory,
        ...(input.serverPassword
          ? {
              headers: {
                Authorization: `Basic ${Buffer.from(`opencode:${input.serverPassword}`, "utf8").toString("base64")}`,
              },
            }
          : {}),
        throwOnError: true,
      });

    const loadProviders = (client: OpencodeClient) =>
      runOpenCodeSdk("provider.list", () => client.provider.list()).pipe(
        Effect.filterMapOrFail(
          (list) =>
            list.data
              ? Result.succeed(list.data)
              : Result.fail(
                  new OpenCodeRuntimeError({
                    operation: "provider.list",
                    detail: "OpenCode provider list was empty.",
                  }),
                ),
          (result) => result,
        ),
      );

    const loadAgents = (client: OpencodeClient) =>
      runOpenCodeSdk("app.agents", () => client.app.agents()).pipe(
        Effect.map((result) => result.data ?? []),
      );

    const loadOpenCodeInventory: OpenCodeRuntimeShape["loadOpenCodeInventory"] = (client) =>
      Effect.all([loadProviders(client), loadAgents(client)], {
        concurrency: "unbounded",
      }).pipe(Effect.map(([providerList, agents]) => ({ providerList, agents })));

    return {
      startOpenCodeServerProcess,
      connectToOpenCodeServer,
      runOpenCodeCommand,
      createOpenCodeSdkClient,
      loadOpenCodeInventory,
    } satisfies OpenCodeRuntimeShape;
  });

export const OPENCODE_LOCAL_SERVER_IDLE_TTL_MS = 5 * 60_000;

export function buildOpenCodeServerProcessEnv(input: {
  readonly cliSpec?: { readonly dataDirectoryName: string };
  readonly experimentalWebSockets?: boolean;
  readonly baseEnv?: NodeJS.ProcessEnv;
}): NodeJS.ProcessEnv {
  return buildProviderChildEnvironment({
    provider: input.cliSpec?.dataDirectoryName === "kilo" ? "kilo" : "opencode",
    baseEnv: input.baseEnv ?? process.env,
    overrides: input.experimentalWebSockets ? { OPENCODE_EXPERIMENTAL_WEBSOCKETS: "true" } : {},
  });
}

export function parseOpenCodeCredentialProviderIDs(content: string): ReadonlyArray<string> {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    return Object.entries(parsed as Record<string, unknown>)
      .flatMap(([providerID, value]) =>
        value && typeof value === "object" && !Array.isArray(value) ? [providerID.trim()] : [],
      )
      .filter((providerID) => providerID.length > 0)
      .toSorted((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

export interface ParsedOpenCodeModelSlug {
  readonly providerID: string;
  readonly modelID: string;
}

export function parseOpenCodeModelSlug(
  slug: string | null | undefined,
): ParsedOpenCodeModelSlug | null {
  if (typeof slug !== "string") {
    return null;
  }
  const trimmed = slug.trim();
  const separator = trimmed.indexOf("/");
  if (separator <= 0 || separator === trimmed.length - 1) {
    return null;
  }
  return {
    providerID: trimmed.slice(0, separator),
    modelID: trimmed.slice(separator + 1),
  };
}

function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fallbackOpenCodeModelName(slug: string, parsedSlug: ParsedOpenCodeModelSlug): string {
  return trimToNull(parsedSlug.modelID) ?? slug;
}

function readJsonObjectBlock(
  source: string,
  startIndex: number,
): { readonly json: string; readonly nextIndex: number } | null {
  if (source[startIndex] !== "{") {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (!char) break;

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === "\\") {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          json: source.slice(startIndex, index + 1),
          nextIndex: index + 1,
        };
      }
    }
  }
  return null;
}

function parseOpenCodeCliModelJson(
  value: unknown,
  slug: string,
  parsedSlug: ParsedOpenCodeModelSlug,
): OpenCodeCliModelDescriptor {
  const object = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const providerID = trimToNull(object.providerID) ?? parsedSlug.providerID;
  const modelID = trimToNull(object.id) ?? parsedSlug.modelID;
  const name = trimToNull(object.name) ?? fallbackOpenCodeModelName(slug, parsedSlug);
  const variantsObject =
    object.variants && typeof object.variants === "object" && !Array.isArray(object.variants)
      ? (object.variants as Record<string, unknown>)
      : {};
  const variants = Object.keys(variantsObject)
    .map((variant) => variant.trim())
    .filter((variant) => variant.length > 0)
    .toSorted((left, right) => left.localeCompare(right));

  return {
    slug,
    providerID,
    modelID,
    name,
    variants,
    supportedReasoningEfforts: [],
    ...(typeof object.isFree === "boolean" ? { isFree: object.isFree } : {}),
  };
}

export function parseOpenCodeCliModelsOutput(
  output: string,
): ReadonlyArray<OpenCodeCliModelDescriptor> {
  const models = new Map<string, OpenCodeCliModelDescriptor>();
  let index = 0;

  while (index < output.length) {
    while (index < output.length && /\s/u.test(output[index]!)) {
      index += 1;
    }
    if (index >= output.length) break;

    const lineEnd = output.indexOf("\n", index);
    const nextLineIndex = lineEnd === -1 ? output.length : lineEnd + 1;
    const candidate = output.slice(index, lineEnd === -1 ? output.length : lineEnd).trim();
    index = nextLineIndex;

    const parsedSlug = parseOpenCodeModelSlug(candidate);
    if (!parsedSlug) continue;

    let descriptor: OpenCodeCliModelDescriptor = {
      slug: candidate,
      providerID: parsedSlug.providerID,
      modelID: parsedSlug.modelID,
      name: fallbackOpenCodeModelName(candidate, parsedSlug),
      variants: [],
      supportedReasoningEfforts: [],
    };

    while (index < output.length && /\s/u.test(output[index]!)) {
      index += 1;
    }

    if (output[index] === "{") {
      const block = readJsonObjectBlock(output, index);
      if (block) {
        try {
          descriptor = parseOpenCodeCliModelJson(JSON.parse(block.json), candidate, parsedSlug);
        } catch {
          // Fallback
        }
        index = block.nextIndex;
      }
    }

    models.set(descriptor.slug, descriptor);
  }

  return [...models.values()].toSorted(
    (left, right) => left.name.localeCompare(right.name) || left.slug.localeCompare(right.slug),
  );
}

export function toOpenCodeFileParts(input: {
  readonly attachments: ReadonlyArray<ChatAttachment> | undefined;
  readonly resolveAttachmentPath: (attachment: ChatAttachment) => string | null;
}): Array<FilePartInput> {
  const parts: Array<FilePartInput> = [];
  for (const attachment of input.attachments ?? []) {
    if (attachment.type !== "image") continue;
    const attachmentPath = input.resolveAttachmentPath(attachment);
    if (!attachmentPath) continue;
    parts.push({
      type: "file",
      mime: attachment.mimeType,
      filename: attachment.name,
      url: pathToFileURL(attachmentPath).href,
    });
  }
  return parts;
}

export function buildOpenCodePermissionRules(
  runtimeMode: RuntimeMode,
  interactionMode: string = "default",
): PermissionRuleset {
  if (interactionMode === "plan") {
    return [
      { permission: "*", pattern: "*", action: "deny" },
      { permission: "read", pattern: "*", action: "allow" },
      { permission: "glob", pattern: "*", action: "allow" },
      { permission: "grep", pattern: "*", action: "allow" },
      { permission: "list", pattern: "*", action: "allow" },
      { permission: "lsp", pattern: "*", action: "allow" },
      { permission: "webfetch", pattern: "*", action: "allow" },
      { permission: "websearch", pattern: "*", action: "allow" },
      { permission: "codesearch", pattern: "*", action: "allow" },
      { permission: "todoread", pattern: "*", action: "allow" },
      { permission: "todowrite", pattern: "*", action: "allow" },
      { permission: "question", pattern: "*", action: "allow" },
    ];
  }

  return runtimeMode === "full-access"
    ? [{ permission: "*", pattern: "*", action: "allow" }]
    : [
        { permission: "*", pattern: "*", action: "ask" },
        { permission: "bash", pattern: "*", action: "ask" },
        { permission: "edit", pattern: "*", action: "ask" },
        { permission: "webfetch", pattern: "*", action: "ask" },
        { permission: "websearch", pattern: "*", action: "ask" },
        { permission: "codesearch", pattern: "*", action: "ask" },
        { permission: "external_directory", pattern: "*", action: "ask" },
        { permission: "doom_loop", pattern: "*", action: "ask" },
        { permission: "question", pattern: "*", action: "allow" },
      ];
}

export class OpenCodeRuntime extends Context.Service<OpenCodeRuntime, OpenCodeRuntimeShape>()(
  "tabs/provider/opencodeRuntime",
) {}

export const makeOpenCodeRuntimeLive = (options?: OpenCodeRuntimeLiveOptions) =>
  Layer.effect(OpenCodeRuntime, makeOpenCodeRuntime(options)).pipe(Layer.provide(NetService.layer));

export const OpenCodeRuntimeLive = makeOpenCodeRuntimeLive();
