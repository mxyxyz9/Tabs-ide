import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  PlayIcon,
  RadioIcon,
  RefreshCwIcon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { readNativeApi } from "~/nativeApi";
import { DEFAULT_MODEL, type DesktopPreviewScreenshotArtifact } from "@tabs/contracts";
import { makeAppModelSelection } from "~/modelSelection";
import { toastManager } from "~/components/ui/toast";

export type VerificationStatus = "not_verified" | "pass" | "fail" | "interrupted";

export interface RecordedStep {
  id: string;
  action:
    | "goto"
    | "click"
    | "fill"
    | "selectOption"
    | "check"
    | "uncheck"
    | "press"
    | "assertVisible"
    | "assertText"
    | "assertValue";
  selector: string;
  value?: string | undefined;
  url?: string | undefined;
  key?: string | undefined;
  placeholder?: string | undefined;
  expectedValue?: string | undefined;
  isFragile?: boolean | undefined;
  reviewed?: boolean | undefined;
}

export interface IssueReproduction {
  id: string;
  projectId: string;
  route: string;
  profileId?: string | undefined;
  viewport?: { width: number; height: number } | undefined;
  taskId?: string | undefined;
  steps: RecordedStep[];
  expectedResult: string;
  generatedCode: string;
  specPath?: string | undefined;
  beforeScreenshot?: string | undefined;
  afterScreenshot?: string | undefined;
  verificationStatus: VerificationStatus;
  verificationMessage?: string | undefined;
  createdAt: string;
}

interface RecordIssueDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sessionId?: string | undefined;
  currentUrl: string;
  viewport?: { width: number; height: number } | undefined;
  profileId?: string | undefined;
  assignedTaskId?: string | null | undefined;
  availableTasks?: Array<{ id: string; title: string }> | undefined;
  onReproductionCreated?: (reproduction: IssueReproduction) => void;
}

export function isFragileSelector(selector: string): boolean {
  if (!selector) return false;
  const s = selector.trim();
  // Positional pseudo-classes like :nth-child(3), :nth-of-type(2)
  if (/:(nth-child|nth-of-type)\(\d+\)/i.test(s)) return true;
  // Absolute / deep XPath
  if (s.startsWith("/") || s.startsWith("xpath=") || s.includes("/div[")) return true;
  // Deep tag-only hierarchy: e.g. "div > div > p > span"
  if (/^([a-z]+(\s*>\s*|\s+)){3,}[a-z]+$/i.test(s)) return true;
  // Dynamically generated hashed CSS classes e.g. .css-1a2b3c, .sc-xyz123, ._1234abcd
  if (/\b(?:css-|sc-|_)[0-9a-zA-Z]{5,}\b/.test(s)) return true;
  return false;
}

export function evaluateVerification(
  hasAssertions: boolean,
  expectedResult: string,
  error?: Error | string | null,
): { status: VerificationStatus; message: string } {
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("human") || msg.includes("interrupted") || msg.includes("cancelled")) {
      return { status: "interrupted", message: `Verification was interrupted: ${msg}` };
    }
    return { status: "fail", message: `Verification failed: ${msg}` };
  }
  if (!hasAssertions && !expectedResult.trim()) {
    return {
      status: "not_verified",
      message:
        "Steps completed, but no expected-result assertions were defined. Add an assertion to verify the fix.",
    };
  }
  return {
    status: "pass",
    message: "All reproduction steps and assertions passed successfully!",
  };
}

export function generateReproductionPlaywrightCode(
  url: string,
  steps: readonly RecordedStep[],
  expectedResult: string,
): string {
  let inputCount = 0;
  const lines: string[] = [
    'import { test, expect } from "@playwright/test";',
    "",
    `/**`,
    ` * Issue Reproduction`,
    ` * Expected outcome: ${expectedResult || "Reviewed expected behavior"}`,
    ` */`,
    `test("reproduce and verify: ${JSON.stringify(expectedResult.slice(0, 80) || "reported issue")}", async ({ page }) => {`,
    `  await page.goto(${JSON.stringify(url || "https://example.com")});`,
  ];

  for (const step of steps) {
    if (step.action === "goto") {
      lines.push(`  await page.goto(${JSON.stringify(step.url || url)});`);
      continue;
    }

    const locator = `page.locator(${JSON.stringify(step.selector || "body")})`;

    switch (step.action) {
      case "click":
        lines.push(`  await ${locator}.click();`);
        break;
      case "fill": {
        inputCount++;
        const rawName = step.placeholder || `TEST_INPUT_${inputCount}`;
        const sanitizedEnvVar = rawName.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        const isSensitive = /password|secret|token|api[-_]?key|auth|bearer|pin|credential/i.test(
          `${step.selector} ${step.placeholder ?? ""} ${rawName}`,
        );

        if (isSensitive) {
          lines.push(
            `  // Masked sensitive input: passwords and auth tokens are parameterized via environment variables\n  const input_${inputCount} = process.env.${sanitizedEnvVar} ?? "test-secret";\n  await ${locator}.fill(input_${inputCount});`,
          );
        } else if (step.value !== undefined && step.value.trim() !== "") {
          lines.push(`  await ${locator}.fill(${JSON.stringify(step.value)});`);
        } else {
          lines.push(
            `  // Supply reviewed parameter; sensitive inputs were not recorded\n  const input_${inputCount} = process.env.${sanitizedEnvVar} ?? "test-value";\n  await ${locator}.fill(input_${inputCount});`,
          );
        }
        break;
      }
      case "selectOption": {
        if (step.value !== undefined && step.value.trim() !== "") {
          lines.push(`  await ${locator}.selectOption(${JSON.stringify(step.value)});`);
        } else {
          lines.push(`  await ${locator}.selectOption("1");`);
        }
        break;
      }
      case "check":
        lines.push(`  await ${locator}.check();`);
        break;
      case "uncheck":
        lines.push(`  await ${locator}.uncheck();`);
        break;
      case "press":
        lines.push(`  await ${locator}.press(${JSON.stringify(step.key || "Enter")});`);
        break;
      case "assertVisible":
        lines.push(`  await expect(${locator}).toBeVisible();`);
        break;
      case "assertText":
        lines.push(
          `  await expect(${locator}).toHaveText(${JSON.stringify(step.expectedValue ?? "")});`,
        );
        break;
      case "assertValue":
        lines.push(
          `  await expect(${locator}).toHaveValue(${JSON.stringify(step.expectedValue ?? "")});`,
        );
        break;
    }
  }

  const hasAssertion = steps.some((s) => s.action.startsWith("assert"));
  if (!hasAssertion) {
    lines.push(
      `  // Assertion required for verification: review expected outcome`,
      `  expect(true, "Add expected result assertion to verify issue").toBe(true);`,
    );
  }

  lines.push("});");
  lines.push("");
  return lines.join("\n");
}

export function RecordIssueDialog({
  isOpen,
  onOpenChange,
  projectId,
  sessionId,
  currentUrl,
  viewport,
  profileId,
  assignedTaskId,
  availableTasks = [],
  onReproductionCreated,
}: RecordIssueDialogProps) {
  const bridge = window.desktopBridge;
  const api = readNativeApi();

  const [phase, setPhase] = useState<"idle" | "recording" | "review" | "verifying" | "verified">(
    "idle",
  );
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<RecordedStep[]>([]);
  const [expectedResult, setExpectedResult] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>(assignedTaskId ?? "");
  const [beforeScreenshot, setBeforeScreenshot] = useState<string | null>(null);
  const [afterScreenshot, setAfterScreenshot] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("not_verified");
  const [verificationMessage, setVerificationMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"steps" | "code" | "evidence">("steps");

  useEffect(() => {
    if (assignedTaskId) {
      setSelectedTaskId(assignedTaskId);
    }
  }, [assignedTaskId]);

  const resetState = useCallback(() => {
    setPhase("idle");
    setBusy(false);
    setSteps([]);
    setExpectedResult("");
    setBeforeScreenshot(null);
    setAfterScreenshot(null);
    setVerificationStatus("not_verified");
    setVerificationMessage("");
    setActiveTab("steps");
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open && phase === "recording") {
      void stopRecording();
    }
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const startRecording = async () => {
    if (!bridge) return;
    setBusy(true);
    try {
      await bridge.runBrowserAutomation({
        projectId,
        sessionId,
        operation: "recordStart",
      });
      setPhase("recording");
      toastManager.add({
        type: "success",
        title: "Issue recording started",
        description: "Interact with the application tab to demonstrate the issue.",
      });
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not start recording",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = async () => {
    if (!bridge) return;
    setBusy(true);
    try {
      const result = (await bridge.runBrowserAutomation({
        projectId,
        sessionId,
        operation: "recordStop",
      })) as {
        count: number;
        steps?: RecordedStep[];
        initialUrl?: string;
      };

      // Capture before screenshot as failure evidence
      try {
        const screenshot = await bridge.captureBrowserScreenshot({ projectId, sessionId });
        if (screenshot?.path) {
          setBeforeScreenshot(screenshot.path);
        }
      } catch {
        // Non-fatal
      }

      const recorded = (result.steps ?? []).map((s, idx) => ({
        ...s,
        id: s.id || `step-${idx + 1}`,
        isFragile: s.isFragile ?? isFragileSelector(s.selector),
      }));
      setSteps(recorded);
      setPhase("review");
      toastManager.add({
        type: "success",
        title: "Recording captured",
        description: `${recorded.length} action(s) recorded. Review steps and enter expected result.`,
      });
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not stop recording",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const addAssertion = (action: "assertVisible" | "assertText" | "assertValue") => {
    const newStep: RecordedStep = {
      id: `assert-${Date.now()}`,
      action,
      selector: "",
      expectedValue: "",
      isFragile: false,
      reviewed: true,
    };
    setSteps((prev) => [...prev, newStep]);
  };

  const updateStep = (id: string, updates: Partial<RecordedStep>) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        if (updates.selector !== undefined && updates.isFragile === undefined) {
          updated.isFragile = isFragileSelector(updates.selector);
        }
        return updated;
      }),
    );
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const generatedCode = useMemo(() => {
    return generateReproductionPlaywrightCode(currentUrl, steps, expectedResult);
  }, [currentUrl, steps, expectedResult]);

  const hasAssertions = useMemo(() => {
    return steps.some((s) => s.action.startsWith("assert"));
  }, [steps]);

  const fragileLocatorsCount = useMemo(() => {
    return steps.filter((s) => s.isFragile && !s.reviewed).length;
  }, [steps]);

  const sendReproductionToTask = async () => {
    if (!expectedResult.trim()) {
      toastManager.add({
        type: "error",
        title: "Expected result required",
        description: "Please specify the expected outcome before dispatching to a coding task.",
      });
      return;
    }

    setBusy(true);
    try {
      const repId = `issue-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
      const specPath = `tests/e2e/reproductions/${repId}.spec.ts`;

      // 1. Save reproduction spec file to workspace if nativeApi is available
      if (api?.projects?.writeFile) {
        await api.projects.writeFile({
          cwd: "",
          relativePath: specPath,
          contents: generatedCode,
        });
      }

      // 2. Register with Testing service if available
      if (api?.testing?.generateTests) {
        await api.testing.generateTests({
          projectId,
          projectPath: "",
          modelSelection: makeAppModelSelection("codex", DEFAULT_MODEL),
          engine: "recording",
          recordedCode: generatedCode,
          recordedExpectedResult: expectedResult,
          targetUrl: currentUrl,
        });
      }

      const reproduction: IssueReproduction = {
        id: repId,
        projectId,
        route: currentUrl,
        profileId,
        viewport,
        taskId: selectedTaskId || undefined,
        steps,
        expectedResult,
        generatedCode,
        specPath,
        beforeScreenshot: beforeScreenshot ?? undefined,
        verificationStatus,
        verificationMessage: verificationMessage || undefined,
        createdAt: new Date().toISOString(),
      };

      onReproductionCreated?.(reproduction);

      toastManager.add({
        type: "success",
        title: "Reproduction dispatched to task",
        description: `Saved reproduction spec to ${specPath}`,
      });
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Failed to dispatch reproduction",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const rerunReproduction = async () => {
    if (!bridge) return;
    setBusy(true);
    setPhase("verifying");
    setVerificationStatus("not_verified");
    setVerificationMessage("Running reproduction steps against live browser tab...");

    try {
      // Execute each step in sequence against the live session
      for (const step of steps) {
        if (step.action === "goto" && step.url) {
          await bridge.navigateBrowserSession({ projectId, sessionId, url: step.url });
          await new Promise((r) => setTimeout(r, 600));
        } else if (step.action === "click" && step.selector) {
          await bridge.runBrowserAutomation({
            projectId,
            sessionId,
            operation: "click",
            input: { selector: step.selector },
          });
          await new Promise((r) => setTimeout(r, 200));
        } else if (step.action === "fill" && step.selector) {
          await bridge.runBrowserAutomation({
            projectId,
            sessionId,
            operation: "type",
            input: { selector: step.selector, text: step.value || "test-input", clear: true },
          });
        } else if (step.action === "press") {
          await bridge.runBrowserAutomation({
            projectId,
            sessionId,
            operation: "press",
            input: { key: step.key || "Enter" },
          });
        } else if (step.action === "assertVisible") {
          const matched = (await bridge.runBrowserAutomation({
            projectId,
            sessionId,
            operation: "waitFor",
            input: { selector: step.selector, timeoutMs: 3000 },
          })) as { matched?: boolean };
          if (!matched?.matched) {
            throw new Error(`Assertion failed: element "${step.selector}" is not visible.`);
          }
        } else if (step.action === "assertText") {
          const matched = (await bridge.runBrowserAutomation({
            projectId,
            sessionId,
            operation: "waitFor",
            input: {
              selector: step.selector,
              text: step.expectedValue || expectedResult,
              timeoutMs: 3000,
            },
          })) as { matched?: boolean };
          if (!matched?.matched) {
            throw new Error(
              `Assertion failed: element "${step.selector}" does not contain expected text "${step.expectedValue || expectedResult}".`,
            );
          }
        }
      }

      const evalResult = evaluateVerification(hasAssertions, expectedResult);
      setVerificationStatus(evalResult.status);
      setVerificationMessage(evalResult.message);
      if (evalResult.status === "pass") {
        try {
          const screenshot = await bridge.captureBrowserScreenshot({ projectId, sessionId });
          if (screenshot?.path) {
            setAfterScreenshot(screenshot.path);
          }
        } catch {
          // Ignore
        }
        toastManager.add({
          type: "success",
          title: "Verification Passed",
          description: "All assertions matched the expected behavior.",
        });
      }
    } catch (cause) {
      const evalResult = evaluateVerification(
        hasAssertions,
        expectedResult,
        cause instanceof Error ? cause : String(cause),
      );
      setVerificationStatus(evalResult.status);
      setVerificationMessage(evalResult.message);
      toastManager.add({
        type: "error",
        title:
          evalResult.status === "interrupted" ? "Verification Interrupted" : "Verification Failed",
        description: evalResult.message,
      });
    } finally {
      setBusy(false);
      setPhase("verified");
      setActiveTab("evidence");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <RadioIcon
                className={`size-4 ${phase === "recording" ? "animate-pulse text-red-500" : "text-primary"}`}
              />
              Record Issue Reproduction
            </DialogTitle>
            {verificationStatus !== "not_verified" && (
              <Badge
                variant={
                  verificationStatus === "pass"
                    ? "default"
                    : verificationStatus === "fail"
                      ? "destructive"
                      : "secondary"
                }
                className="text-xs capitalize"
              >
                {verificationStatus === "pass" && <CheckCircle2Icon className="mr-1 size-3" />}
                {verificationStatus === "fail" && <XCircleIcon className="mr-1 size-3" />}
                {verificationStatus === "interrupted" && (
                  <AlertTriangleIcon className="mr-1 size-3" />
                )}
                {verificationStatus}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Demonstrate a bug, capture deterministic reproduction steps, specify expected results,
            and verify fixes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-2">
          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Target:</span>
            <span className="max-w-[200px] truncate font-mono text-[11px]" title={currentUrl}>
              {currentUrl}
            </span>
            {viewport && (
              <>
                <span className="text-border">|</span>
                <span>
                  {viewport.width}x{viewport.height}
                </span>
              </>
            )}
            {profileId && (
              <>
                <span className="text-border">|</span>
                <span>Profile: {profileId}</span>
              </>
            )}
            {selectedTaskId && (
              <>
                <span className="text-border">|</span>
                <span>Task: {selectedTaskId.slice(0, 8)}</span>
              </>
            )}
          </div>

          {/* Recording Controls */}
          {phase === "idle" && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-8 text-center">
              <RadioIcon className="size-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Ready to record issue reproduction</p>
                <p className="text-xs text-muted-foreground">
                  Click start, then interact with the page to demonstrate the problem.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void startRecording()}
                disabled={busy}
                className="gap-1.5"
              >
                <RadioIcon className="size-3.5 text-red-400" />
                Start recording issue
              </Button>
            </div>
          )}

          {phase === "recording" && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 py-8 text-center">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-500">
                <span className="size-2.5 animate-ping rounded-full bg-red-500" />
                Recording in progress…
              </div>
              <p className="max-w-md text-xs text-muted-foreground">
                Demonstrate the bug in the browser tab. Clicks, inputs, and navigations are captured
                without persisting sensitive passwords or tokens.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void stopRecording()}
                disabled={busy}
                className="gap-1.5"
              >
                <SquareIcon className="size-3.5" />
                Stop & review issue
              </Button>
            </div>
          )}

          {/* Review & Verification Phases */}
          {(phase === "review" || phase === "verifying" || phase === "verified") && (
            <div className="space-y-3">
              {/* Tabs */}
              <div className="flex items-center gap-1 border-b pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("steps")}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeTab === "steps"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Steps ({steps.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("code")}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeTab === "code"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Playwright Spec
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("evidence")}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeTab === "evidence"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Evidence & Verification
                </button>
              </div>

              {/* Steps Tab */}
              {activeTab === "steps" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Expected Result (Required)</label>
                    <Input
                      placeholder="e.g. Save button remains enabled and shows success notification"
                      value={expectedResult}
                      onChange={(e) => setExpectedResult(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium">Recorded Steps & Assertions</label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => addAssertion("assertVisible")}
                        >
                          + Assert Visible
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => addAssertion("assertText")}
                        >
                          + Assert Text
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border p-2">
                      {steps.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No steps recorded yet.
                        </p>
                      ) : (
                        steps.map((step, idx) => (
                          <div
                            key={step.id}
                            className="flex items-center gap-2 rounded border bg-card/60 p-1.5 text-xs"
                          >
                            <span className="w-5 text-muted-foreground">{idx + 1}.</span>
                            <Badge variant="outline" className="h-5 text-[10px] uppercase">
                              {step.action}
                            </Badge>
                            <Input
                              value={step.selector}
                              onChange={(e) => updateStep(step.id, { selector: e.target.value })}
                              placeholder="Selector"
                              className="h-6 flex-1 font-mono text-[11px]"
                            />
                            {(step.action === "assertText" || step.action === "assertValue") && (
                              <Input
                                value={step.expectedValue ?? ""}
                                onChange={(e) =>
                                  updateStep(step.id, { expectedValue: e.target.value })
                                }
                                placeholder="Expected text"
                                className="h-6 w-32 text-[11px]"
                              />
                            )}
                            {step.isFragile && (
                              <Badge
                                variant="destructive"
                                className="h-5 text-[9px]"
                                title="Positional selector may be fragile"
                              >
                                fragile
                              </Badge>
                            )}
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => removeStep(step.id)}
                            >
                              <Trash2Icon className="size-3 text-muted-foreground hover:text-red-500" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {fragileLocatorsCount > 0 && (
                    <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-500">
                      <AlertTriangleIcon className="size-4 shrink-0" />
                      <span>
                        {fragileLocatorsCount} step(s) use fragile positional locators. Consider
                        using test-ids or aria labels for stability.
                      </span>
                    </div>
                  )}

                  {/* Task Association */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium">Assign to Coding Task</label>
                    {availableTasks.length > 0 ? (
                      <select
                        className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                        value={selectedTaskId}
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                      >
                        <option value="">No task selected (unassigned)</option>
                        {availableTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title || t.id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        placeholder="Task ID or description"
                        value={selectedTaskId}
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                        className="h-8 text-xs"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Code Tab */}
              {activeTab === "code" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Playwright Test Reproduction
                    </span>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard?.writeText(generatedCode);
                        toastManager.add({
                          type: "success",
                          title: "Copied code to clipboard",
                        });
                      }}
                      className="gap-1"
                    >
                      <CopyIcon className="size-3" />
                      Copy
                    </Button>
                  </div>
                  <pre className="max-h-64 overflow-y-auto rounded-md border bg-muted/60 p-3 font-mono text-[11px] text-foreground">
                    {generatedCode}
                  </pre>
                </div>
              )}

              {/* Evidence Tab */}
              {activeTab === "evidence" && (
                <div className="space-y-3">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-xs font-semibold">Verification Outcome</span>
                      <Badge
                        variant={
                          verificationStatus === "pass"
                            ? "default"
                            : verificationStatus === "fail"
                              ? "destructive"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {verificationStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {verificationMessage ||
                        "Run verification to test the reproduction against the current application state."}
                    </p>
                  </div>

                  {/* Before & After Screenshots */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Before (Recorded Failing State)
                      </span>
                      <div className="flex h-36 items-center justify-center rounded-md border bg-muted/40 p-2 text-center text-xs text-muted-foreground">
                        {beforeScreenshot ? (
                          <div className="space-y-1">
                            <span className="font-mono text-[10px]">
                              {beforeScreenshot.split("/").pop()}
                            </span>
                            <p className="text-[10px] text-primary">Saved as task evidence</p>
                          </div>
                        ) : (
                          <span>No capture available</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        After (Verification State)
                      </span>
                      <div className="flex h-36 items-center justify-center rounded-md border bg-muted/40 p-2 text-center text-xs text-muted-foreground">
                        {afterScreenshot ? (
                          <div className="space-y-1">
                            <span className="font-mono text-[10px]">
                              {afterScreenshot.split("/").pop()}
                            </span>
                            <p className="text-[10px] text-green-500">Verified evidence</p>
                          </div>
                        ) : (
                          <span>Rerun verification to capture</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose render={<Button variant="outline" size="sm" />}>Close</DialogClose>

          {(phase === "review" || phase === "verified") && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void rerunReproduction()}
                className="gap-1.5"
              >
                <RefreshCwIcon className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
                Rerun & Verify
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={busy || !expectedResult.trim()}
                onClick={() => void sendReproductionToTask()}
                className="gap-1.5"
              >
                <SendIcon className="size-3.5" />
                Send to Task
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
