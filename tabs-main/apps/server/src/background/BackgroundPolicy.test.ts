import { expect, it } from "@effect/vitest";
import { AuthSessionId, RpcClientId } from "@tabs/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { ServerSettingsService } from "../serverSettings.ts";
import { make } from "./BackgroundPolicy.ts";

const makePolicy = make.pipe(Effect.provide(ServerSettingsService.layerTest()));

it.effect("runs demanded work for a visible active client", () =>
  Effect.gen(function* () {
    const policy = yield* makePolicy;
    yield* policy.reportClientActivity(AuthSessionId.make("session-1"), RpcClientId.make(1), {
      clientId: "desktop-1",
      clientKind: "desktop-renderer",
      visible: true,
      focused: true,
      recentlyInteracted: true,
      scopes: [{ type: "provider-status" }],
      observedAt: yield* DateTime.now,
    });
    expect(yield* policy.hasDemand({ type: "provider-status" })).toBe(true);
    expect(yield* policy.shouldRunScopeWork({ type: "provider-status" })).toBe(true);
    expect(yield* policy.shouldRunOpportunisticWork).toBe(true);
  }),
);

it.effect("pauses work under serious thermal pressure", () =>
  Effect.gen(function* () {
    const policy = yield* makePolicy;
    const now = yield* DateTime.now;
    yield* policy.reportClientActivity(AuthSessionId.make("session-1"), RpcClientId.make(1), {
      clientId: "desktop-1",
      clientKind: "desktop-renderer",
      visible: true,
      focused: true,
      recentlyInteracted: true,
      scopes: [{ type: "diagnostics" }],
      observedAt: now,
    });
    yield* policy.reportHostPowerState({
      source: "electron-main",
      idle: "false",
      idleSeconds: 0,
      locked: "false",
      suspended: false,
      onBattery: "false",
      lowPowerMode: "false",
      thermalState: "serious",
      stale: false,
      updatedAt: now,
    });
    expect(yield* policy.shouldRunScopeWork({ type: "diagnostics" })).toBe(false);
    expect(yield* policy.shouldRunOpportunisticWork).toBe(false);
  }),
);

it.effect("removes every lease owned by a disconnected RPC client", () =>
  Effect.gen(function* () {
    const policy = yield* makePolicy;
    const sessionId = AuthSessionId.make("session-1");
    const rpcClientId = RpcClientId.make(7);
    yield* policy.reportClientActivity(sessionId, rpcClientId, {
      clientId: "window-a",
      clientKind: "web",
      visible: true,
      focused: true,
      recentlyInteracted: false,
      scopes: [{ type: "server-config" }],
      observedAt: yield* DateTime.now,
    });
    yield* policy.removeRpcClient(sessionId, rpcClientId);
    expect((yield* policy.snapshot).leases).toHaveLength(0);
  }),
);
