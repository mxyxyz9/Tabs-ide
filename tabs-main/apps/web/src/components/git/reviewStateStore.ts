import type { GitGenerateReviewInput, GitGenerateReviewResult } from "@tabs/contracts";
import { useEffect, useState } from "react";
import { toastManager } from "../ui/toast";
import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";

export interface ActiveReviewState {
  status: "idle" | "running" | "done" | "error";
  result: GitGenerateReviewResult | null;
  error: string | null;
  isIncremental: boolean;
}

const store: Record<string, ActiveReviewState> = {};
const unreadBadge: Record<string, number | null> = {};
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getActiveReviewState(cwd: string): ActiveReviewState {
  return store[cwd] ?? { status: "idle", result: null, error: null, isIncremental: false };
}

export function getUnreadReviewCount(cwd: string): number | null {
  return unreadBadge[cwd] ?? null;
}

export function clearUnreadReviewCount(cwd: string): void {
  if (unreadBadge[cwd] !== null) {
    unreadBadge[cwd] = null;
    notify();
  }
}

export function updateActiveReviewState(cwd: string, state: ActiveReviewState): void {
  store[cwd] = state;
  notify();
}

export function clearReviewError(cwd: string): void {
  updateActiveReviewState(cwd, {
    status: "idle",
    result: null,
    error: null,
    isIncremental: false,
  });
}

export function runBackgroundReview(
  cwd: string,
  api: any,
  input: GitGenerateReviewInput,
  activePanel?: string,
): void {
  updateActiveReviewState(cwd, {
    status: "running",
    result: null,
    error: null,
    isIncremental: false,
  });

  api.git
    .generateReview(input)
    .then((result: GitGenerateReviewResult) => {
      updateActiveReviewState(cwd, {
        status: "done",
        result,
        error: null,
        isIncremental: result.isIncremental ?? false,
      });

      const total = result.findings.length;
      const errorCount = result.findings.filter((f) => f.severity === "error").length;
      const warnCount = result.findings.filter((f) => f.severity === "warning").length;

      if (total === 0) {
        toastManager.add({
          type: "success",
          title: "AI Code Review Completed",
          description: "All correctness and security passes ran clean — 0 issues found.",
        });
      } else {
        toastManager.add({
          type: "info",
          title: "AI Code Review Completed",
          description: `Found ${total} findings (${errorCount} errors, ${warnCount} warnings) in working tree.`,
        });
      }

      if (activePanel !== "review") {
        unreadBadge[cwd] = total;
        notify();
      }
    })
    .catch((err: unknown) => {
      const errorMsg = toGitUserFacingErrorMessage(err);
      updateActiveReviewState(cwd, {
        status: "error",
        result: null,
        error: errorMsg,
        isIncremental: false,
      });

      toastManager.add({
        type: "error",
        title: "AI Code Review Failed",
        description: errorMsg,
      });
    });
}

export function useReviewStore(cwd: string) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    review: getActiveReviewState(cwd),
    unreadCount: getUnreadReviewCount(cwd),
    clearUnread: () => clearUnreadReviewCount(cwd),
  };
}
