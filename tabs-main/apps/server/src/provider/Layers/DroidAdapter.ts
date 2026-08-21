import {
  ApprovalRequestId,
  type DroidSettings,
  EventId,
  type ProviderApprovalDecision,
  type ProviderRuntimeEvent,
  type ProviderSession,
  type ProviderUserInputAnswers,
  ProviderDriverKind,
  ProviderInstanceId,
  RuntimeRequestId,
  type ThreadId,
  TurnId,
} from "@tabs/contracts";
import { randomUUID as nodeRandomUUID } from "node:crypto";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as SynchronizedRef from "effect/SynchronizedRef";
import { ChildProcessSpawner } from "effect/unstable/process";
import * as EffectAcpErrors from "effect-acp/errors";
import type * as EffectAcpSchema from "effect-acp/schema";

import { resolveAttachmentPath } from "../../attachmentStore";
import { ServerConfig } from "../../config";
import {
  ProviderAdapterProcessError,
  ProviderAdapterRequestError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
} from "../Errors";
import { mapAcpToAdapterError } from "../acp/AcpAdapterSupport";
import { type AcpSessionRuntimeShape } from "../acp/AcpSessionRuntime";
import {
  makeAcpAssistantItemEvent,
  makeAcpContentDeltaEvent,
  makeAcpPlanUpdatedEvent,
  makeAcpRequestOpenedEvent,
  makeAcpRequestResolvedEvent,
  makeAcpToolCallEvent,
} from "../acp/AcpCoreRuntimeEvents";
import { parsePermissionRequest } from "../acp/AcpRuntimeModel";
import { makeAcpNativeLoggerFactory } from "../acp/AcpNativeLogging";
import {
  applyDroidAcpModelSelection,
  currentDroidModelIdFromSessionSetup,
  makeDroidAcpRuntime,
  resolveDroidAcpBaseModelId,
} from "../acp/DroidAcpSupport";
import { type DroidAdapterShape } from "../Services/DroidAdapter";
import { type EventNdjsonLogger, makeEventNdjsonLogger } from "./EventNdjsonLogger";

const encodeUnknownJsonStringExit = Schema.encodeUnknownExit(Schema.UnknownFromJsonString);

const PROVIDER = "droid" as ProviderDriverKind;
const DROID_RESUME_VERSION = 1 as const;

function encodeJsonStringForDiagnostics(input: unknown): string | undefined {
  const result = encodeUnknownJsonStringExit(input);
  return Exit.isSuccess(result) ? result.value : undefined;
}

export interface DroidAdapterLiveOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly nativeEventLogPath?: string;
  readonly nativeEventLogger?: EventNdjsonLogger;
  readonly instanceId?: ProviderInstanceId;
  readonly isModelAdvertised?: (modelId: string) => Effect.Effect<boolean, never, never>;
}

interface PendingApproval {
  readonly decision: Deferred.Deferred<ProviderApprovalDecision>;
}

type PendingUserInputResolution =
  | { readonly _tag: "answered"; readonly answers: ProviderUserInputAnswers }
  | { readonly _tag: "cancelled" };

interface PendingUserInput {
  readonly resolution: Deferred.Deferred<PendingUserInputResolution>;
}

interface DroidSessionContext {
  readonly threadId: ThreadId;
  readonly acpSessionId: string;
  session: ProviderSession;
  readonly scope: Scope.Closeable;
  readonly acp: AcpSessionRuntimeShape;
  notificationFiber: Fiber.Fiber<void, never> | undefined;
  readonly pendingApprovals: Map<ApprovalRequestId, PendingApproval>;
  readonly pendingUserInputs: Map<ApprovalRequestId, PendingUserInput>;
  turns: Array<{ id: TurnId; items: Array<unknown> }>;
  lastPlanFingerprint: string | undefined;
  activeTurnId: TurnId | undefined;
  currentModelId: string | undefined;
  stopped: boolean;
}

function settlePendingApprovalsAsCancelled(
  pendingApprovals: ReadonlyMap<ApprovalRequestId, PendingApproval>,
): Effect.Effect<void> {
  return Effect.forEach(
    Array.from(pendingApprovals.values()),
    (pending) => Deferred.succeed(pending.decision, "cancel").pipe(Effect.ignore),
    { discard: true },
  );
}

function settlePendingUserInputsAsCancelled(
  pendingUserInputs: ReadonlyMap<ApprovalRequestId, PendingUserInput>,
): Effect.Effect<void> {
  return Effect.forEach(
    Array.from(pendingUserInputs.values()),
    (pending) => Deferred.succeed(pending.resolution, { _tag: "cancelled" }).pipe(Effect.ignore),
    { discard: true },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDroidResume(raw: unknown): { sessionId: string } | undefined {
  if (!isRecord(raw)) return undefined;
  if (raw.schemaVersion !== DROID_RESUME_VERSION) return undefined;
  if (typeof raw.sessionId !== "string" || !raw.sessionId.trim()) return undefined;
  return { sessionId: raw.sessionId.trim() };
}

function selectPermissionOptionId(
  request: EffectAcpSchema.RequestPermissionRequest,
  decision: Exclude<ProviderApprovalDecision, "cancel">,
): string | undefined {
  const kind =
    decision === "acceptForSession"
      ? "allow_always"
      : decision === "accept"
        ? "allow_once"
        : "reject_once";
  const option = request.options.find((entry) => entry.kind === kind);
  return option?.optionId.trim() || undefined;
}

function selectAutoApprovedPermissionOption(
  request: EffectAcpSchema.RequestPermissionRequest,
): string | undefined {
  return (
    selectPermissionOptionId(request, "acceptForSession") ??
    selectPermissionOptionId(request, "accept")
  );
}

export function makeDroidAdapter(
  droidSettings: DroidSettings,
  options?: DroidAdapterLiveOptions,
): Effect.Effect<
  DroidAdapterShape,
  never,
  | Scope.Scope
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
  | ServerConfig
> {
  return Effect.gen(function* () {
    const boundInstanceId = options?.instanceId ?? ("droid" as ProviderInstanceId);
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const serverConfig = yield* Effect.service(ServerConfig);
    const nativeEventLogger =
      options?.nativeEventLogger ??
      (options?.nativeEventLogPath !== undefined
        ? yield* makeEventNdjsonLogger(options.nativeEventLogPath, { stream: "native" })
        : undefined);
    const makeAcpNativeLoggers = yield* makeAcpNativeLoggerFactory();

    const sessions = new Map<ThreadId, DroidSessionContext>();
    const threadLocksRef = yield* SynchronizedRef.make(new Map<string, Semaphore.Semaphore>());
    const runtimeEventPubSub = yield* PubSub.unbounded<ProviderRuntimeEvent>();

    const validateAdvertisedModel = (
      modelId: string | undefined,
      operation: string,
    ): Effect.Effect<void, ProviderAdapterValidationError> =>
      !modelId || !options?.isModelAdvertised
        ? Effect.void
        : options.isModelAdvertised(modelId).pipe(
            Effect.flatMap((advertised) =>
              advertised
                ? Effect.void
                : Effect.fail(
                    new ProviderAdapterValidationError({
                      provider: PROVIDER,
                      operation,
                      issue: `Droid model '${modelId}' is not in the current account catalog. Refresh providers and select an advertised model.`,
                    }),
                  ),
            ),
          );

    const nowIso = Effect.map(DateTime.now, DateTime.formatIso);
    const randomUUIDv4 = Effect.sync(() => nodeRandomUUID()).pipe(
      Effect.mapError(
        (cause) =>
          new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "crypto/randomUUIDv4",
            detail: "Failed to generate Droid runtime identifier.",
            cause,
          }),
      ),
    );
    const nextEventId = Effect.map(randomUUIDv4, (id) => id as EventId);
    const makeEventStamp = () => Effect.all({ eventId: nextEventId, createdAt: nowIso });
    const mapAcpCallbackFailure = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(
        Effect.mapError(
          (cause) =>
            new EffectAcpErrors.AcpTransportError({
              detail: "Failed to process Droid ACP callback.",
              cause,
            }),
        ),
      );

    const offerRuntimeEvent = (event: ProviderRuntimeEvent) =>
      PubSub.publish(runtimeEventPubSub, event).pipe(Effect.asVoid);

    const getThreadSemaphore = (threadId: string) =>
      SynchronizedRef.modifyEffect(threadLocksRef, (current) => {
        const existing: Option.Option<Semaphore.Semaphore> = Option.fromNullishOr(
          current.get(threadId),
        );
        return Option.match(existing, {
          onNone: () =>
            Semaphore.make(1).pipe(
              Effect.map((semaphore) => {
                const next = new Map(current);
                next.set(threadId, semaphore);
                return [semaphore, next] as const;
              }),
            ),
          onSome: (semaphore) => Effect.succeed([semaphore, current] as const),
        });
      });

    const withThreadLock = <A, E, R>(threadId: string, effect: Effect.Effect<A, E, R>) =>
      Effect.flatMap(getThreadSemaphore(threadId), (semaphore) => semaphore.withPermit(effect));

    const logNative = (threadId: ThreadId, method: string, payload: unknown) =>
      Effect.gen(function* () {
        if (!nativeEventLogger) return;
        const observedAt = yield* nowIso;
        yield* nativeEventLogger.write(
          {
            observedAt,
            event: {
              id: yield* randomUUIDv4,
              kind: "notification",
              provider: PROVIDER,
              createdAt: observedAt,
              method,
              threadId,
              payload,
            },
          },
          threadId,
        );
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.logWarning("Failed to write native Droid notification log.", {
            cause,
            threadId,
            method,
          }),
        ),
      );

    const emitPlanUpdate = (
      ctx: DroidSessionContext,
      payload: {
        readonly explanation?: string | null;
        readonly plan: ReadonlyArray<{
          readonly step: string;
          readonly status: "pending" | "inProgress" | "completed";
        }>;
      },
      rawPayload: unknown,
      method: string,
    ) =>
      Effect.gen(function* () {
        const fingerprint = `${ctx.activeTurnId ?? "no-turn"}:${encodeJsonStringForDiagnostics(payload) ?? "[unserializable payload]"}`;
        if (ctx.lastPlanFingerprint === fingerprint) {
          return;
        }
        ctx.lastPlanFingerprint = fingerprint;
        yield* offerRuntimeEvent(
          makeAcpPlanUpdatedEvent({
            stamp: yield* makeEventStamp(),
            provider: PROVIDER,
            threadId: ctx.threadId,
            turnId: ctx.activeTurnId,
            payload,
            source: "acp.jsonrpc",
            method,
            rawPayload,
          }),
        );
      });

    const requireSession = (
      threadId: ThreadId,
    ): Effect.Effect<DroidSessionContext, ProviderAdapterSessionNotFoundError> => {
      const ctx = sessions.get(threadId);
      if (!ctx || ctx.stopped) {
        return Effect.fail(
          new ProviderAdapterSessionNotFoundError({ provider: PROVIDER, threadId }),
        );
      }
      return Effect.succeed(ctx);
    };

    const stopSessionInternal = (ctx: DroidSessionContext) =>
      Effect.gen(function* () {
        if (ctx.stopped) return;
        ctx.stopped = true;
        yield* settlePendingApprovalsAsCancelled(ctx.pendingApprovals);
        yield* settlePendingUserInputsAsCancelled(ctx.pendingUserInputs);
        if (ctx.notificationFiber) {
          yield* Fiber.interrupt(ctx.notificationFiber);
        }
        yield* Effect.ignore(Scope.close(ctx.scope, Exit.void));
        sessions.delete(ctx.threadId);
        yield* offerRuntimeEvent({
          type: "session.exited",
          ...(yield* makeEventStamp()),
          provider: PROVIDER,
          threadId: ctx.threadId,
          payload: { exitKind: "graceful" },
        });
      });

    const startSession: DroidAdapterShape["startSession"] = (input) =>
      withThreadLock(
        input.threadId,
        Effect.gen(function* () {
          if (input.provider !== undefined && input.provider !== PROVIDER) {
            return yield* new ProviderAdapterValidationError({
              provider: PROVIDER,
              operation: "startSession",
              issue: `Expected provider '${PROVIDER}' but received '${input.provider}'.`,
            });
          }
          if (!input.cwd?.trim()) {
            return yield* new ProviderAdapterValidationError({
              provider: PROVIDER,
              operation: "startSession",
              issue: "cwd is required and must be non-empty.",
            });
          }

          const cwd = path.resolve(input.cwd.trim());
          const droidModelSelection =
            input.modelSelection?.instanceId === boundInstanceId ? input.modelSelection : undefined;
          const existing = sessions.get(input.threadId);
          if (existing && !existing.stopped) {
            yield* stopSessionInternal(existing);
          }

          const pendingApprovals = new Map<ApprovalRequestId, PendingApproval>();
          const pendingUserInputs = new Map<ApprovalRequestId, PendingUserInput>();
          const sessionScope = yield* Scope.make("sequential");
          let sessionScopeTransferred = false;
          yield* Effect.addFinalizer(() =>
            sessionScopeTransferred ? Effect.void : Scope.close(sessionScope, Exit.void),
          );

          const resumeSessionId = parseDroidResume(input.resumeCursor)?.sessionId;
          const acpNativeLoggers = makeAcpNativeLoggers({
            nativeEventLogger,
            provider: PROVIDER,
            threadId: input.threadId,
          });

          const acp = yield* makeDroidAcpRuntime({
            droidSettings,
            ...(options?.environment ? { environment: options.environment } : {}),
            childProcessSpawner,
            cwd,
            ...(resumeSessionId ? { resumeSessionId } : {}),
            clientInfo: { name: "tabs-ide", version: "0.0.0" },
            ...acpNativeLoggers,
          }).pipe(
            Effect.provideService(Scope.Scope, sessionScope),
            Effect.mapError(
              (cause) =>
                new ProviderAdapterProcessError({
                  provider: PROVIDER,
                  threadId: input.threadId,
                  detail: cause.message,
                  cause,
                }),
            ),
          );

          const started = yield* Effect.gen(function* () {
            yield* acp.handleRequestPermission((params) =>
              mapAcpCallbackFailure(
                Effect.gen(function* () {
                  yield* logNative(input.threadId, "session/request_permission", params);
                  if (input.runtimeMode === "full-access") {
                    const autoOptionId = selectAutoApprovedPermissionOption(params);
                    if (autoOptionId) {
                      return {
                        outcome: {
                          outcome: "selected",
                          optionId: autoOptionId,
                        },
                      } satisfies EffectAcpSchema.RequestPermissionResponse;
                    }
                  }

                  const parsed = parsePermissionRequest(params);
                  const requestId = (yield* randomUUIDv4) as ApprovalRequestId;
                  const decisionDeferred = yield* Deferred.make<ProviderApprovalDecision>();
                  pendingApprovals.set(requestId, { decision: decisionDeferred });

                  yield* offerRuntimeEvent(
                    makeAcpRequestOpenedEvent({
                      stamp: yield* makeEventStamp(),
                      provider: PROVIDER,
                      threadId: input.threadId,
                      turnId: sessions.get(input.threadId)?.activeTurnId,
                      requestId: requestId as unknown as RuntimeRequestId,
                      requestKind: parsed.requestKind,
                      payload: parsed.payload,
                      source: "acp.jsonrpc",
                      method: "session/request_permission",
                      rawPayload: params,
                    }),
                  );

                  const decision = yield* Deferred.await(decisionDeferred);
                  pendingApprovals.delete(requestId);
                  yield* offerRuntimeEvent(
                    makeAcpRequestResolvedEvent({
                      stamp: yield* makeEventStamp(),
                      provider: PROVIDER,
                      threadId: input.threadId,
                      turnId: sessions.get(input.threadId)?.activeTurnId,
                      requestId: requestId as unknown as RuntimeRequestId,
                      decision,
                      source: "acp.jsonrpc",
                      method: "session/request_permission",
                    }),
                  );

                  if (decision === "cancel") {
                    return {
                      outcome: { outcome: "cancelled" },
                    } satisfies EffectAcpSchema.RequestPermissionResponse;
                  }

                  const optionId = selectPermissionOptionId(params, decision);
                  if (!optionId) {
                    return {
                      outcome: { outcome: "cancelled" },
                    } satisfies EffectAcpSchema.RequestPermissionResponse;
                  }

                  return {
                    outcome: {
                      outcome: "selected",
                      optionId,
                    },
                  } satisfies EffectAcpSchema.RequestPermissionResponse;
                }),
              ),
            );

            yield* acp.handleReadTextFile((params) =>
              mapAcpCallbackFailure(
                Effect.gen(function* () {
                  yield* logNative(input.threadId, "fs/read_text_file", params);
                  const targetPath = path.isAbsolute(params.path)
                    ? params.path
                    : path.resolve(cwd, params.path);
                  const content = yield* fileSystem.readFileString(targetPath);
                  return { content };
                }),
              ),
            );

            yield* acp.handleWriteTextFile((params) =>
              mapAcpCallbackFailure(
                Effect.gen(function* () {
                  yield* logNative(input.threadId, "fs/write_text_file", params);
                  const targetPath = path.isAbsolute(params.path)
                    ? params.path
                    : path.resolve(cwd, params.path);
                  yield* fileSystem.writeFileString(targetPath, params.content);
                  return {};
                }),
              ),
            );

            return yield* acp
              .start()
              .pipe(
                Effect.mapError((cause) =>
                  mapAcpToAdapterError(PROVIDER, input.threadId, "session/start", cause),
                ),
              );
          });

          let currentModelId = currentDroidModelIdFromSessionSetup(started.sessionSetupResult);
          if (droidModelSelection?.model) {
            const requestedModelId = resolveDroidAcpBaseModelId(droidModelSelection.model);
            yield* validateAdvertisedModel(requestedModelId, "session/start");
            currentModelId = yield* applyDroidAcpModelSelection({
              runtime: acp,
              currentModelId,
              requestedModelId,
              mapError: (cause) =>
                mapAcpToAdapterError(PROVIDER, input.threadId, "session/set_model", cause),
            });
          }

          const startedAt = yield* nowIso;
          const session: ProviderSession = {
            threadId: input.threadId,
            provider: PROVIDER,
            providerInstanceId: boundInstanceId,
            status: "ready",
            runtimeMode: input.runtimeMode,
            cwd,
            ...(currentModelId ? { model: currentModelId } : {}),
            createdAt: startedAt,
            updatedAt: startedAt,
            resumeCursor: {
              schemaVersion: DROID_RESUME_VERSION,
              sessionId: started.sessionId,
            },
          };

          const ctx: DroidSessionContext = {
            threadId: input.threadId,
            acpSessionId: started.sessionId,
            session,
            scope: sessionScope,
            acp,
            notificationFiber: undefined,
            pendingApprovals,
            pendingUserInputs,
            turns: [],
            lastPlanFingerprint: undefined,
            activeTurnId: undefined,
            currentModelId,
            stopped: false,
          };

          ctx.notificationFiber = yield* Effect.fork(
            Stream.runForEach(acp.getEvents(), (parsedEvent) =>
              Effect.gen(function* () {
                switch (parsedEvent._tag) {
                  case "AssistantItemStarted":
                    yield* offerRuntimeEvent(
                      makeAcpAssistantItemEvent({
                        stamp: yield* makeEventStamp(),
                        provider: PROVIDER,
                        threadId: ctx.threadId,
                        turnId: ctx.activeTurnId,
                        itemId: parsedEvent.itemId,
                        source: "acp.jsonrpc",
                        method: "session/update",
                      }),
                    );
                    break;
                  case "ContentDelta":
                    yield* offerRuntimeEvent(
                      makeAcpContentDeltaEvent({
                        stamp: yield* makeEventStamp(),
                        provider: PROVIDER,
                        threadId: ctx.threadId,
                        turnId: ctx.activeTurnId,
                        itemId: parsedEvent.itemId,
                        delta: parsedEvent.delta,
                        source: "acp.jsonrpc",
                        method: "session/update",
                      }),
                    );
                    break;
                  case "PlanUpdated":
                    yield* emitPlanUpdate(
                      ctx,
                      parsedEvent.payload,
                      parsedEvent.rawPayload,
                      "session/update",
                    );
                    break;
                  case "ToolCallStarted":
                  case "ToolCallUpdated":
                  case "ToolCallFinished":
                    yield* offerRuntimeEvent(
                      makeAcpToolCallEvent({
                        stamp: yield* makeEventStamp(),
                        provider: PROVIDER,
                        threadId: ctx.threadId,
                        turnId: ctx.activeTurnId,
                        itemId: parsedEvent.itemId,
                        callState: parsedEvent.callState,
                        source: "acp.jsonrpc",
                        method: "session/update",
                      }),
                    );
                    break;
                }
              }),
            ),
          );

          sessionScopeTransferred = true;
          sessions.set(input.threadId, ctx);
          return session;
        }),
      );

    const sendTurn: DroidAdapterShape["sendTurn"] = (input) =>
      withThreadLock(
        input.threadId,
        Effect.gen(function* () {
          const ctx = yield* requireSession(input.threadId);
          const turnId = ((yield* randomUUIDv4) ?? `droid-turn-${Date.now()}`) as TurnId;
          ctx.activeTurnId = turnId;

          const droidModelSelection =
            input.modelSelection?.instanceId === boundInstanceId ? input.modelSelection : undefined;
          if (droidModelSelection?.model) {
            const requestedModelId = resolveDroidAcpBaseModelId(droidModelSelection.model);
            yield* validateAdvertisedModel(requestedModelId, "turn/send");
            ctx.currentModelId = yield* applyDroidAcpModelSelection({
              runtime: ctx.acp,
              currentModelId: ctx.currentModelId,
              requestedModelId,
              mapError: (cause) =>
                mapAcpToAdapterError(PROVIDER, input.threadId, "session/set_model", cause),
            });
            ctx.session = {
              ...ctx.session,
              ...(ctx.currentModelId ? { model: ctx.currentModelId } : {}),
              updatedAt: yield* nowIso,
            };
          }

          const promptText = input.input?.trim() || "";
          const resolvedAttachments = yield* Effect.forEach(
            input.attachments ?? [],
            (att) =>
              resolveAttachmentPath(serverConfig.cwd, att).pipe(
                Effect.map((absPath) => ({
                  type: "file" as const,
                  path: absPath,
                })),
                Effect.orElseSucceed(() => undefined),
              ),
            { concurrency: "unbounded" },
          ).pipe(
            Effect.map((items) =>
              items.filter((item): item is NonNullable<typeof item> => item !== undefined),
            ),
          );

          // Send turn via ACP prompt
          yield* Effect.fork(
            Effect.gen(function* () {
              yield* ctx.acp
                .prompt({
                  prompt: [
                    { type: "text", text: promptText },
                    ...resolvedAttachments.map((att) => ({
                      type: "resource" as const,
                      resource: { uri: `file://${att.path}`, text: "" },
                    })),
                  ],
                })
                .pipe(
                  Effect.mapError((cause) =>
                    mapAcpToAdapterError(PROVIDER, input.threadId, "session/prompt", cause),
                  ),
                );
            }).pipe(
              Effect.catchAll((err) =>
                offerRuntimeEvent({
                  type: "turn.failed",
                  ...Effect.runSync(makeEventStamp()),
                  provider: PROVIDER,
                  threadId: input.threadId,
                  turnId,
                  payload: { error: err.detail ?? err.message },
                }),
              ),
            ),
          );

          return {
            threadId: input.threadId,
            turnId,
            resumeCursor: ctx.session.resumeCursor,
          };
        }),
      );

    const interruptTurn: DroidAdapterShape["interruptTurn"] = (threadId) =>
      withThreadLock(
        threadId,
        Effect.gen(function* () {
          const ctx = yield* requireSession(threadId);
          yield* ctx.acp.cancel.pipe(
            Effect.mapError((cause) =>
              mapAcpToAdapterError(PROVIDER, threadId, "session/cancel", cause),
            ),
            Effect.catchAll(() => Effect.void),
          );
        }),
      );

    const respondToRequest: DroidAdapterShape["respondToRequest"] = (
      threadId,
      requestId,
      decision,
    ) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        const pending = ctx.pendingApprovals.get(requestId);
        if (!pending) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "respondToRequest",
            detail: `No pending approval request '${requestId}' for thread '${threadId}'.`,
          });
        }
        yield* Deferred.succeed(pending.decision, decision);
      });

    const respondToUserInput: DroidAdapterShape["respondToUserInput"] = (
      threadId,
      requestId,
      answers,
    ) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        const pending = ctx.pendingUserInputs.get(requestId);
        if (!pending) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "respondToUserInput",
            detail: `No pending user input request '${requestId}' for thread '${threadId}'.`,
          });
        }
        yield* Deferred.succeed(pending.resolution, { _tag: "answered", answers });
      });

    const stopSession: DroidAdapterShape["stopSession"] = (threadId) =>
      withThreadLock(
        threadId,
        Effect.gen(function* () {
          const ctx = sessions.get(threadId);
          if (ctx) {
            yield* stopSessionInternal(ctx);
          }
        }),
      );

    const listSessions: DroidAdapterShape["listSessions"] = () =>
      Effect.sync(() =>
        Array.from(sessions.values())
          .filter((ctx) => !ctx.stopped)
          .map((ctx) => ctx.session),
      );

    const hasSession: DroidAdapterShape["hasSession"] = (threadId) =>
      Effect.sync(() => {
        const ctx = sessions.get(threadId);
        return Boolean(ctx && !ctx.stopped);
      });

    const readThread: DroidAdapterShape["readThread"] = (threadId) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        return {
          threadId,
          turns: ctx.turns.map((t) => ({ id: t.id, items: [...t.items] })),
        };
      });

    const rollbackThread: DroidAdapterShape["rollbackThread"] = (threadId, numTurns) =>
      Effect.gen(function* () {
        const ctx = yield* requireSession(threadId);
        if (numTurns > 0) {
          ctx.turns = ctx.turns.slice(0, -numTurns);
        }
        return {
          threadId,
          turns: ctx.turns.map((t) => ({ id: t.id, items: [...t.items] })),
        };
      });

    const stopAll: DroidAdapterShape["stopAll"] = () =>
      Effect.forEach(Array.from(sessions.values()), (ctx) => stopSessionInternal(ctx), {
        discard: true,
      });

    return {
      provider: PROVIDER,
      capabilities: {
        sessionModelSwitch: "in-session",
        agentChat: "supported",
      },
      startSession,
      sendTurn,
      interruptTurn,
      respondToRequest,
      respondToUserInput,
      stopSession,
      listSessions,
      hasSession,
      readThread,
      rollbackThread,
      stopAll,
      streamEvents: Stream.fromPubSub(runtimeEventPubSub),
    } satisfies DroidAdapterShape;
  });
}
