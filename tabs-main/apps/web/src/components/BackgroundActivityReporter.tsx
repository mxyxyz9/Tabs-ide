import { ThreadId, type BackgroundScope, type HostPowerSnapshot } from "@tabs/contracts";
import * as DateTime from "effect/DateTime";
import { useEffect } from "react";

import { ensureNativeApi } from "../nativeApi";

const CLIENT_ID_KEY = "tabs-background-client-id";

function clientId(): string {
  const existing = sessionStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}

function currentScopes(): BackgroundScope[] {
  const scopes: BackgroundScope[] = [{ type: "server-config" }, { type: "provider-status" }];
  const match = /\/chat\/([^/?#]+)/u.exec(window.location.pathname);
  if (match?.[1]) scopes.push({ type: "thread", threadId: ThreadId.make(match[1]) });
  return scopes;
}

export function BackgroundActivityReporter() {
  useEffect(() => {
    let recentlyInteracted = true;
    let lastInteraction = Date.now();
    const markInteraction = () => {
      lastInteraction = Date.now();
      recentlyInteracted = true;
    };
    const report = () => {
      recentlyInteracted = Date.now() - lastInteraction < 60_000;
      void ensureNativeApi()
        .server.reportClientActivity({
          clientId: clientId(),
          clientKind: window.desktopBridge ? "desktop-renderer" : "web",
          visible: document.visibilityState === "visible",
          focused: document.hasFocus(),
          recentlyInteracted,
          appState: document.visibilityState === "visible" ? "active" : "background",
          networkType: navigator.onLine ? "online" : "offline",
          scopes: currentScopes(),
          ttlMs: 45_000,
          observedAt: DateTime.nowUnsafe(),
        })
        .catch(() => undefined);
    };
    for (const event of ["pointerdown", "keydown", "focus", "online", "offline"] as const) {
      window.addEventListener(event, markInteraction, { passive: true });
    }
    document.addEventListener("visibilitychange", report);
    const interval = window.setInterval(report, 30_000);
    report();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", report);
      for (const event of ["pointerdown", "keydown", "focus", "online", "offline"] as const) {
        window.removeEventListener(event, markInteraction);
      }
    };
  }, []);

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge?.getHostPowerSnapshot) return;
    const report = (snapshot: HostPowerSnapshot) => {
      void ensureNativeApi()
        .server.reportHostPowerState(snapshot)
        .catch(() => undefined);
    };
    void bridge
      .getHostPowerSnapshot()
      .then(report)
      .catch(() => undefined);
    return bridge.onHostPowerSnapshot?.(report);
  }, []);
  return null;
}
