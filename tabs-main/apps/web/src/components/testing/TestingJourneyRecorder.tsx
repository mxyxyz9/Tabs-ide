import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import { ensureNativeApi } from "~/nativeApi";
import { useTestingData } from "./context";

export function TestingJourneyRecorder() {
  const {
    projectId,
    projectPath,
    generationModelSelection,
    normalizedTarget,
    refreshCases,
    refreshGenerationJobs,
  } = useTestingData();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [expectedText, setExpectedText] = useState("");
  const active = useRef(false);
  const request = (operation: "recordStart" | "recordStop" | "recordStatus") => {
    if (!window.desktopBridge) throw new Error("Journey recording requires the Tabs desktop app.");
    return window.desktopBridge.runBrowserAutomation({
      projectId,
      sessionId: `testing:${projectId}`,
      operation,
    });
  };
  useEffect(
    () => () => {
      if (active.current)
        void window.desktopBridge
          ?.runBrowserAutomation({
            projectId,
            sessionId: `testing:${projectId}`,
            operation: "recordStop",
          })
          .catch(() => undefined);
    },
    [projectId],
  );

  const toggle = async () => {
    setBusy(true);
    try {
      if (recording) {
        const result = (await request("recordStop")) as { code: string; count: number };
        active.current = false;
        setRecording(false);
        setCode(result.code);
        setMessage(
          `${result.count} actions captured. Review selectors, supply input data and add assertions before running.`,
        );
      } else {
        active.current = true;
        await request("recordStart");
        setRecording(true);
        setMessage(
          "Recording this preview. Navigate and interact, then stop. Typed values are never saved.",
        );
      }
    } catch (error) {
      if (!recording) active.current = false;
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const relativePath = `tests/e2e/recorded/journey-${crypto.randomUUID()}.spec.ts`;
      const reviewedCode = code.replace(
        'throw new Error("Add expected-result assertions to this recording");',
        `await expect(page.getByText(${JSON.stringify(expectedText.trim())}, { exact: true })).toBeVisible();`,
      );
      await ensureNativeApi().projects.writeFile({
        cwd: projectPath,
        relativePath,
        contents: reviewedCode,
      });
      await ensureNativeApi().testing.generateTests({
        projectId,
        projectPath,
        modelSelection: generationModelSelection,
        engine: "recording",
        recordedCode: reviewedCode,
        recordedExpectedResult: expectedText.trim(),
        ...(normalizedTarget ? { targetUrl: normalizedTarget } : {}),
      });
      await Promise.all([refreshCases(), refreshGenerationJobs()]);
      setMessage(
        `Saved ${relativePath} and a managed copy in Test runs. No AI was used. Review any input placeholders, then open Test runs to execute it.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 border-t p-3">
      <div className="flex items-center gap-3">
        <Button
          disabled={busy || !window.desktopBridge}
          aria-pressed={recording}
          onClick={() => void toggle()}
        >
          {recording ? "Stop and review journey" : "Record journey"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Top-level page only; structural selectors need review. Maximum 500 actions.
        </span>
      </div>
      <p role="status" className="text-sm">
        {message}
      </p>
      {code && !recording && (
        <>
          <label htmlFor="recorded-expected-text" className="text-sm">
            Expected visible text at the end
          </label>
          <Input
            id="recorded-expected-text"
            value={expectedText}
            onChange={(event) => setExpectedText(event.target.value)}
            placeholder="Exact text that proves the journey succeeded"
          />
          <label htmlFor="recorded-journey-code" className="text-sm">
            Recorded Playwright code
          </label>
          <Textarea
            id="recorded-journey-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="min-h-64 font-mono text-xs"
          />
          <Button
            disabled={busy || !code.trim() || !expectedText.trim()}
            onClick={() => void save()}
          >
            Save to repository and Test runs (no AI)
          </Button>
        </>
      )}
    </div>
  );
}
