import {
  PREVIEW_AUTOMATION_OPERATIONS,
  type PreviewAutomationRequest,
  type PreviewAutomationResponse,
} from "@tabs/contracts";
import { useEffect } from "react";

import { readNativeApi } from "../nativeApi";
import { appAtomRegistry } from "../state/atomRegistry";
import { readModelStateAtom } from "../state/readModel";

const SUPPORTED_OPERATIONS = PREVIEW_AUTOMATION_OPERATIONS.filter(
  (operation) => operation !== "resize" && operation !== "recordingStart" && operation !== "recordingStop",
);

function errorResponse(
  clientId: string,
  connectionId: string,
  request: PreviewAutomationRequest,
  cause: unknown,
): PreviewAutomationResponse {
  return {
    clientId,
    connectionId,
    requestId: request.requestId,
    ok: false,
    error: {
      _tag: "PreviewAutomationExecutionError",
      message: cause instanceof Error ? cause.message : String(cause),
    },
  };
}

export function NativePreviewAutomationHost() {
  useEffect(() => {
    const api = readNativeApi();
    const bridge = window.desktopBridge;
    if (!api || !bridge) return;
    const clientId = `tabs-desktop-${crypto.randomUUID()}`;
    let disposed = false;
    let connectionId: string | null = null;

    const run = async (request: PreviewAutomationRequest): Promise<unknown> => {
      const thread = appAtomRegistry
        .get(readModelStateAtom)
        .threads.find((candidate) => candidate.id === request.threadId);
      if (!thread) throw new Error(`Thread ${request.threadId} is not available in this client.`);
      const sessionId = request.tabId ?? "browser";
      const input =
        typeof request.input === "object" && request.input !== null
          ? (request.input as Record<string, unknown>)
          : {};

      if (request.operation === "open") {
        const url = typeof input.url === "string" ? input.url : "";
        await bridge.ensureBrowserSession({ projectId: thread.projectId, sessionId, initialUrl: url });
        if (input.show !== false) {
          await bridge.activateBrowserSession({ projectId: thread.projectId, sessionId });
        }
        return bridge.runBrowserAutomation({
          projectId: thread.projectId,
          sessionId,
          operation: "status",
        });
      }
      if (request.operation === "navigate") {
        const url = typeof input.url === "string" ? input.url : null;
        if (!url) throw new Error("Native preview navigation requires a resolved URL.");
        await bridge.navigateBrowserSession({ projectId: thread.projectId, sessionId, url });
        return bridge.runBrowserAutomation({
          projectId: thread.projectId,
          sessionId,
          operation: "status",
        });
      }
      if (
        request.operation === "resize" ||
        request.operation === "recordingStart" ||
        request.operation === "recordingStop"
      ) {
        throw new Error(`Native preview operation ${request.operation} is not available yet.`);
      }
      return bridge.runBrowserAutomation({
        projectId: thread.projectId,
        sessionId,
        operation: request.operation,
        input,
      });
    };

    let unsubscribe = () => {};
    void api.server
      .getConfig()
      .then((config) => {
        if (disposed) return;
        unsubscribe = api.preview.automation.connect(
          {
            clientId,
            environmentId: config.environment.environmentId,
            supportedOperations: SUPPORTED_OPERATIONS,
          },
          (event) => {
            if (event.type === "connected") {
              connectionId = event.connectionId;
              return;
            }
            const responseConnectionId = event.connectionId || connectionId;
            if (!responseConnectionId) return;
            void run(event.request)
              .then((result) =>
                api.preview.automation.respond({
                  clientId,
                  connectionId: responseConnectionId,
                  requestId: event.request.requestId,
                  ok: true,
                  result,
                }),
              )
              .catch((cause) =>
                api.preview.automation.respond(
                  errorResponse(clientId, responseConnectionId, event.request, cause),
                ),
              );
          },
        );
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return null;
}
