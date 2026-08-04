import type {
  FindingFeedbackVerdict,
  GitGenerateReviewResult,
  ModelSelection,
  ReviewFinding,
  ReviewHistoryRecordSchema,
} from "@tabs/contracts";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock,
  Code2,
  Copy,
  FileCode2,
  FileDiff,
  Filter,
  Flame,
  History,
  Info,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  ScanLine,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { readNativeApi } from "../../nativeApi";
import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";
import { useSettings, useUpdateSettings } from "../../hooks/useSettings";
import { toastManager } from "../ui/toast";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";
import { Card, GitModelPicker, SectionLabel } from "./gitPrimitives";
import { runBackgroundReview, useReviewStore, clearReviewError } from "./reviewStateStore";

/* ──────────────────────────────────────────
   Types & Utilities
────────────────────────────────────────── */

interface FindingFeedbackState {
  [findingId: string]: FindingFeedbackVerdict | "pending";
}

function categoryMeta(cat: string) {
  const lower = cat.toLowerCase();
  if (lower.includes("security")) {
    return {
      label: "Security",
      style: {
        color: "var(--sem-red)",
        backgroundColor: "var(--sem-red-soft)",
        borderColor: "var(--sem-red-border)",
      },
    };
  }
  if (lower.includes("api")) {
    return {
      label: "API Contract",
      style: {
        color: "var(--sem-purple)",
        backgroundColor: "var(--sem-purple-soft)",
        borderColor: "var(--sem-purple-soft)",
      },
    };
  }
  return {
    label: "Correctness",
    style: {
      color: "var(--sem-sky)",
      backgroundColor: "var(--sem-sky-soft)",
      borderColor: "var(--sem-sky-border)",
    },
  };
}

function parseCodeSnippet(body: string) {
  const codeBlockMatch = body.match(/```(?:[a-z0-9_-]*)\n([\s\S]*?)\n```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const textBefore = body.slice(0, codeBlockMatch.index).trim();
    const snippet = codeBlockMatch[1].trim();
    const textAfter = body.slice((codeBlockMatch.index || 0) + codeBlockMatch[0].length).trim();
    return { explanation: textBefore || textAfter || body, snippet };
  }
  return { explanation: body, snippet: null };
}

interface DiffLine {
  type: "add" | "del" | "hunk" | "ctx";
  text: string;
}

function CodeDiffViewer({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  const lines: DiffLine[] = useMemo(() => {
    const rawLines = snippet.split("\n");
    const hasDiffPrefix = rawLines.some(
      (l) => l.startsWith("+") || l.startsWith("-") || l.startsWith("@@"),
    );
    return rawLines.map((line) => {
      if (line.startsWith("@@")) return { type: "hunk", text: line };
      if (line.startsWith("+") && !line.startsWith("+++"))
        return { type: "add", text: hasDiffPrefix ? line.slice(1) : line };
      if (line.startsWith("-") && !line.startsWith("---"))
        return { type: "del", text: hasDiffPrefix ? line.slice(1) : line };
      return { type: "ctx", text: line };
    });
  }, [snippet]);

  const handleCopy = useCallback(() => {
    const textToCopy = lines.map((l) => l.text).join("\n");
    void navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [lines]);

  return (
    <div className="rounded-lg border border-border bg-[var(--bg-base,var(--background))] overflow-hidden my-2.5 shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40 text-[11px] font-semibold text-foreground font-mono">
        <span className="flex items-center gap-1.5">
          <FileDiff size={12} className="text-primary" />
          Suggested Betterment Diff
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Copy size={11} />
          {copied ? "Copied!" : "Copy Code"}
        </button>
      </div>

      <div className="p-0 font-mono text-[11px] leading-relaxed overflow-x-auto custom-scrollbar">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={`flex items-start px-3 py-0.5 border-l-2 select-text whitespace-pre font-mono ${
              line.type === "add"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                : line.type === "del"
                ? "bg-red-500/10 text-red-400 border-red-500"
                : line.type === "hunk"
                ? "bg-muted/60 text-purple-400 border-purple-500 font-bold"
                : "border-transparent text-foreground/90"
            }`}
          >
            <span className="w-6 shrink-0 text-right pr-2 opacity-40 select-none text-[10px]">
              {idx + 1}
            </span>
            <span className="w-4 shrink-0 font-bold select-none text-[11px]">
              {line.type === "add" ? "+" : line.type === "del" ? "-" : line.type === "hunk" ? "@@" : " "}
            </span>
            <span className="flex-1">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormattedMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");

  return (
    <div className="space-y-2 text-xs text-foreground/90 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
        const lineText = isBullet ? trimmed.slice(2) : trimmed;
        const parts = lineText.split(/(\*\*.*?\*\*|`.*?`)/g);

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pIdx} className="font-semibold text-foreground">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code
                key={pIdx}
                className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono text-[11px] border border-border/40"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0 mt-1.5" />
              <div className="flex-1">{renderedLine}</div>
            </div>
          );
        }

        return <p key={idx}>{renderedLine}</p>;
      })}
    </div>
  );
}

function FileContextDiffViewer({
  cwd,
  filePath,
  targetLine,
}: {
  cwd: string;
  filePath: string;
  targetLine: number;
}) {
  const api = readNativeApi();
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api || !cwd || !filePath) return;
    setLoading(true);
    setError(null);

    api.projects
      .readFile({ cwd, relativePath: filePath })
      .then((fileRes) => {
        if (fileRes?.contents) {
          const fileLines = fileRes.contents.split("\n");
          const start = Math.max(0, targetLine - 8);
          const end = Math.min(fileLines.length, targetLine + 8);
          const contextLines = fileLines
            .slice(start, end)
            .map((l, idx) => {
              const lineNum = start + idx + 1;
              const isTarget = lineNum === targetLine;
              return `${isTarget ? "+" : " "} ${l}`;
            })
            .join("\n");
          setDiffText(`@@ L${start + 1}-L${end} (Target: Line ${targetLine}) @@\n` + contextLines);
        } else {
          setDiffText("No file content available.");
        }
      })
      .catch((err: unknown) => {
        setError(toGitUserFacingErrorMessage(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [api, cwd, filePath, targetLine]);

  if (loading) {
    return (
      <div className="p-3 bg-muted/20 border border-border rounded-lg flex items-center gap-2 text-xs text-muted-foreground my-2">
        <Loader2 size={13} className="animate-spin text-primary" />
        <span>Loading file diff &amp; context around line {targetLine}…</span>
      </div>
    );
  }

  if (error || !diffText) {
    return (
      <div className="p-3 bg-muted/20 border border-border rounded-lg text-xs text-muted-foreground my-2">
        <span>Target file: {filePath} (Line {targetLine}).</span>
      </div>
    );
  }

  return <CodeDiffViewer snippet={diffText} />;
}

/* ──────────────────────────────────────────
   Finding Card Component
────────────────────────────────────────── */

function FindingCard({
  cwd,
  finding,
  feedbackState,
  onFeedback,
}: {
  cwd: string;
  finding: ReviewFinding;
  feedbackState: FindingFeedbackVerdict | "pending" | undefined;
  onFeedback: (id: string, verdict: FindingFeedbackVerdict) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showFileDiff, setShowFileDiff] = useState(false);
  const [copied, setCopied] = useState(false);

  const meta = categoryMeta(finding.category);
  const filename = finding.file.split("/").pop() ?? finding.file;
  const pathDir = finding.file.includes("/")
    ? finding.file.slice(0, finding.file.lastIndexOf("/"))
    : "";

  const { explanation, snippet } = useMemo(
    () => parseCodeSnippet(finding.body),
    [finding.body],
  );

  const handleCopySnippet = useCallback(() => {
    const textToCopy = snippet || finding.body;
    void navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [snippet, finding.body]);

  const isSuppressed = feedbackState === "false_positive";
  const isAccepted = feedbackState === "accepted";
  const isDismissed = feedbackState === "dismissed";
  const isPending = feedbackState === "pending";

  return (
    <Card
      className={`group transition-all overflow-hidden ${
        isSuppressed
          ? "opacity-40 border-border/40"
          : isAccepted
          ? "border-emerald-500/40 bg-emerald-500/5"
          : isDismissed
          ? "opacity-50 border-border/40"
          : "border-border/70 hover:border-border"
      }`}
    >
      {/* Top Banner Header */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((x) => !x)}
      >
        {/* Severity Icon */}
        <div className="mt-0.5 shrink-0">
          {finding.severity === "error" ? (
            <AlertCircle size={15} style={{ color: "var(--sem-red)" }} />
          ) : finding.severity === "warning" ? (
            <AlertTriangle size={15} style={{ color: "var(--sem-amber)" }} />
          ) : (
            <Info size={15} style={{ color: "var(--sem-sky)" }} />
          )}
        </div>

        {/* Title & Path */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border"
              style={meta.style}
            >
              {meta.label}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {finding.severity}
            </span>
            {finding.isNew === false && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground border border-border/40">
                unchanged
              </span>
            )}
            <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Confidence: {Math.round(finding.confidence * 100)}%
            </span>
          </div>

          <h3 className="text-xs font-semibold text-foreground leading-snug">
            {finding.title}
          </h3>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFileDiff((prev) => !prev);
              }}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground font-mono bg-muted/50 hover:bg-muted px-2 py-0.5 rounded border border-border/50 transition-colors cursor-pointer"
              title="Click to view file diff & context around target line"
            >
              <FileDiff size={12} className="text-primary shrink-0" />
              {pathDir && <span className="opacity-60">{pathDir}/</span>}
              <span className="text-foreground font-medium">{filename}</span>
              <span className="px-1 py-0.2 rounded bg-background text-foreground font-mono font-semibold">
                :L{finding.line}
              </span>
            </button>
          </div>
        </div>

        <div className="text-muted-foreground mt-0.5 shrink-0">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </div>

      {/* Expanded Details Body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/40 pt-3.5 space-y-3">
          <FormattedMarkdown text={explanation} />

          {snippet && <CodeDiffViewer snippet={snippet} />}

          {/* Interactive Target File Diff Drawer */}
          {showFileDiff && (
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center justify-between text-xs font-bold text-foreground mb-1">
                <span className="flex items-center gap-1.5 font-mono">
                  <FileDiff size={13} className="text-primary" />
                  Target File Diff Context: {filename}:L{finding.line}
                </span>
                <button
                  type="button"
                  onClick={() => setShowFileDiff(false)}
                  className="text-muted-foreground hover:text-foreground text-[11px]"
                >
                  Close
                </button>
              </div>
              <FileContextDiffViewer cwd={cwd} filePath={finding.file} targetLine={finding.line} />
            </div>
          )}

          {/* Action & Feedback Footer */}
          {!isSuppressed && !isDismissed && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                disabled={isPending || isAccepted}
                onClick={() => onFeedback(finding.id, "accepted")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50 ${
                  isAccepted
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    : "bg-muted hover:bg-muted/80 text-foreground border-border"
                }`}
              >
                {isPending ? <Loader2 size={11} className="animate-spin" /> : <ThumbsUp size={11} />}
                {isAccepted ? "Accepted" : "Accept Betterment"}
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => onFeedback(finding.id, "dismissed")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50"
              >
                <X size={11} />
                Dismiss
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => onFeedback(finding.id, "false_positive")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50"
              >
                <ThumbsDown size={11} />
                Mark False Positive
              </button>

              <button
                type="button"
                onClick={() => setShowFileDiff((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <FileDiff size={11} className="text-primary" />
                {showFileDiff ? "Hide File Diff" : "View File Diff"}
              </button>

              {!snippet && (
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Copy size={11} />
                  {copied ? "Copied!" : "Copy Details"}
                </button>
              )}
            </div>
          )}

          {isSuppressed && (
            <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
              <Info size={11} /> Marked as false positive — confidence will be discounted in future AI review passes.
            </p>
          )}
          {isDismissed && (
            <p className="text-[11px] text-muted-foreground italic">Dismissed.</p>
          )}
        </div>
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────
   Summary Section Component
────────────────────────────────────────── */

function SummarySection({ result }: { result: GitGenerateReviewResult }) {
  const [tab, setTab] = useState<"summary" | "changes" | "risk">("summary");

  const tabs = [
    { id: "summary" as const, label: "Overview Summary" },
    { id: "changes" as const, label: "Key Changes" },
    { id: "risk" as const, label: "Risk Assessment" },
  ];

  const content =
    tab === "summary"
      ? result.summary
      : tab === "changes"
      ? result.keyChanges
      : result.notesAndRisk;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-2 bg-muted/20">
        <SegmentedControl
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "summary", label: "Overview Summary" },
            { value: "changes", label: "Key Changes" },
            { value: "risk", label: "Risk Assessment" },
          ]}
        />
        {result.wasTruncated && (
          <span className="mr-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
            <AlertTriangle size={11} />
            Partial patch analyzed
          </span>
        )}
      </div>
      <div className="p-4">
        <FormattedMarkdown text={content} />
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────
   Main ReviewPanel Component
────────────────────────────────────────── */

export function ReviewPanel({ cwd, activePanel }: { cwd: string; activePanel?: string }) {
  const api = readNativeApi();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

  const { review } = useReviewStore(cwd);

  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const [isGeneratingRules, setIsGeneratingRules] = useState(false);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  const defaultModelSelection = useMemo<ModelSelection>(
    () =>
      (settings?.gitAi?.gitTextGenerationModelSelection as ModelSelection | undefined) ?? {
        instanceId: "gemini" as ModelSelection["instanceId"],
        model: "gemini-3.6-flash",
      },
    [settings?.gitAi?.gitTextGenerationModelSelection],
  );

  const [modelSelection, setModelSelection] = useState<ModelSelection>(defaultModelSelection);
  const [userHint, setUserHint] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<ReviewFinding["severity"] | null>(null);
  const [feedbackState, setFeedbackState] = useState<FindingFeedbackState>({});

  const [historyRecords, setHistoryRecords] = useState<ReadonlyArray<ReviewHistoryRecordSchema>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<ReviewHistoryRecordSchema | null>(null);

  // Sync userHint with saved project settings on mount / change
  useEffect(() => {
    if (settings?.gitAi?.customPromptInstructions !== undefined) {
      setUserHint(settings.gitAi.customPromptInstructions);
      if (settings.gitAi.customPromptInstructions.trim().length > 0) {
        setShowHint(true);
      }
    }
  }, [settings?.gitAi?.customPromptInstructions]);

  // Load history records
  const loadHistory = useCallback(async () => {
    if (!api) return;
    setIsLoadingHistory(true);
    try {
      const res = await api.git.getReviewHistory({ cwd });
      setHistoryRecords(res.records);
    } catch {
      // Ignore
    } finally {
      setIsLoadingHistory(false);
    }
  }, [api, cwd]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, review.status]);

  // Explicit Save Focus Rules Handler
  const handleSaveFocusRules = useCallback(() => {
    setIsSavingRules(true);
    updateSettings.updateSettings({
      gitAi: { customPromptInstructions: userHint },
    });
    setRulesSaved(true);
    setIsSavingRules(false);
    toastManager.add({ type: "success", title: "Saved review focus rules to project settings!" });
    setTimeout(() => setRulesSaved(false), 2500);
  }, [updateSettings, userHint]);

  // Auto-generate Focus Rules Handler
  const handleAutoGenerateRules = useCallback(async () => {
    if (!api || !cwd) return;
    setIsGeneratingRules(true);
    try {
      let pkgDetails = "";
      const pkgRes = await api.projects.readFile({ cwd, relativePath: "package.json" }).catch(() => null);
      if (pkgRes?.contents) {
        try {
          const parsed = JSON.parse(pkgRes.contents);
          const deps = Object.keys({ ...parsed.dependencies, ...parsed.devDependencies }).slice(0, 25);
          pkgDetails = `Project: ${parsed.name || "workspace"}, Dependencies: ${deps.join(", ")}`;
        } catch {
          // Ignore JSON parse error
        }
      }

      const promptText = [
        `Analyze repository code standards and stack for: ${cwd}`,
        pkgDetails ? `Stack context: ${pkgDetails}` : "",
        "Generate 4-6 concise, practical AI Review Focus Rules.",
        "Focus on breaking API changes, error boundaries, type safety, security flaws, and performance optimizations.",
      ].filter(Boolean).join("\n\n");

      const res = await api.git.generateDiffSummary({
        cwd,
        target: { kind: "working_tree" },
        modelSelection,
        userHint: promptText,
      });

      if (res?.summary) {
        const generatedRules = [
          `# AI Review Rules (${cwd.split("/").pop()})`,
          res.summary ? `\nFocus Standards:\n${res.summary}` : "",
          res.keyChanges ? `\nCritical Checklist:\n${res.keyChanges}` : "",
        ].join("\n");

        setUserHint(generatedRules);
        setShowHint(true);
        updateSettings.updateSettings({
          gitAi: { customPromptInstructions: generatedRules },
        });
        setRulesSaved(true);
        toastManager.add({ type: "success", title: "Auto-generated & saved review focus rules!" });
        setTimeout(() => setRulesSaved(false), 2500);
      }
    } catch (err) {
      toastManager.add({ type: "error", title: "Could not auto-generate rules", description: toGitUserFacingErrorMessage(err) });
    } finally {
      setIsGeneratingRules(false);
    }
  }, [api, cwd, modelSelection, updateSettings]);

  const handleRunReview = useCallback(
    (overrideHint?: string) => {
      if (!api) {
        toastManager.add({ type: "error", title: "API unavailable" });
        return;
      }
      const activeHint = overrideHint !== undefined ? overrideHint : userHint;
      setFeedbackState({});
      runBackgroundReview(
        cwd,
        api,
        {
          cwd,
          target: { kind: "working_tree" },
          modelSelection,
          ...(activeHint.trim() ? { userHint: activeHint.trim() } : {}),
        },
        activePanel,
      );
    },
    [api, cwd, modelSelection, userHint, activePanel],
  );

  const handleFeedback = useCallback(
    async (findingId: string, verdict: FindingFeedbackVerdict) => {
      if (!api) return;
      setFeedbackState((prev) => ({ ...prev, [findingId]: "pending" }));
      try {
        const finding = review.result?.findings.find((f) => f.id === findingId);
        if (!finding) return;
        const fingerprint = `${finding.file}:${finding.line}:${finding.category.toLowerCase()}`;
        await api.git.submitFindingFeedback({
          cwd,
          findingFingerprint: fingerprint,
          category: finding.category,
          verdict,
        });
        setFeedbackState((prev) => ({ ...prev, [findingId]: verdict }));
        if (verdict === "false_positive") {
          toastManager.add({
            type: "success",
            title: "Marked as false positive",
            description: "Confidence will be discounted in future AI review passes.",
          });
        }
      } catch (err) {
        toastManager.add({
          type: "error",
          title: "Could not submit feedback",
          description: toGitUserFacingErrorMessage(err),
        });
        setFeedbackState((prev) => {
          const next = { ...prev };
          delete next[findingId];
          return next;
        });
      }
    },
    [api, cwd, review.result?.findings],
  );

  const filteredFindings = useMemo(() => {
    const findings = review.result?.findings ?? [];
    return findings.filter((f) => {
      if (categoryFilter && f.category !== categoryFilter) return false;
      if (severityFilter && f.severity !== severityFilter) return false;
      return true;
    });
  }, [review.result?.findings, categoryFilter, severityFilter]);

  const allCategories = useMemo(
    () => [...new Set((review.result?.findings ?? []).map((f) => f.category))],
    [review.result?.findings],
  );

  const errorCount = useMemo(
    () => (review.result?.findings ?? []).filter((f) => f.severity === "error").length,
    [review.result?.findings],
  );
  const warnCount = useMemo(
    () => (review.result?.findings ?? []).filter((f) => f.severity === "warning").length,
    [review.result?.findings],
  );

  return (
    <div className="flex flex-col gap-5 pb-12">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
            <ScanLine size={18} className="text-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground tracking-tight">AI Code Review</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated multi-pass correctness, security &amp; code betterment suggestions
            </p>
          </div>
        </div>

        {/* View Switcher: Active AI Audit vs Audit Reports */}
        <SegmentedControl
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val);
            if (val === "current") setSelectedHistoryRecord(null);
          }}
          options={[
            { value: "current", label: "Active AI Audit" },
            {
              value: "history",
              label: (
                <span className="flex items-center gap-1.5">
                  <History size={13} />
                  Audit Reports ({historyRecords.length})
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* ── Active AI Audit Tab View ── */}
      {activeTab === "current" && (
        <>
          {/* Config Card */}
          <Card className="p-4 space-y-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              {/* Model picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={13} className="text-muted-foreground" />
                  AI Model Engine
                </label>
                <GitModelPicker selection={modelSelection} onSelect={setModelSelection} />
              </div>

              {/* Primary Action Button */}
              <div>
                <Button
                  onClick={() => void handleRunReview()}
                  disabled={review.status === "running"}
                  className="w-full h-9 gap-2 text-xs font-semibold cursor-pointer"
                >
                  {review.status === "running" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Running Multi-Pass Review…
                    </>
                  ) : (
                    <>
                      <ScanLine size={14} />
                      Start AI Code Review
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Collapsible Custom Instructions */}
            <div className="pt-3 border-t border-border/40">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowHint((s) => !s)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-foreground/80 transition-colors cursor-pointer"
                >
                  {showHint ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <SlidersHorizontal size={13} className="text-muted-foreground" />
                  Custom Instructions &amp; Review Focus
                  {userHint.trim().length > 0 && !showHint && (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono rounded bg-muted text-muted-foreground border border-border/40">
                      active
                    </span>
                  )}
                </button>

                {!showHint && (
                  <button
                    type="button"
                    disabled={isGeneratingRules}
                    onClick={() => void handleAutoGenerateRules()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingRules ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Wand2 size={12} />
                    )}
                    Auto-Generate Rules with AI
                  </button>
                )}
              </div>

              {showHint && (
                <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3 mt-3">
                  {/* Top Bar inside Sub-Card */}
                  <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        Project Focus Rules &amp; Guidelines
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isGeneratingRules}
                        onClick={() => void handleAutoGenerateRules()}
                        className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingRules ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Wand2 size={12} />
                        )}
                        Auto-Generate Rules with AI
                      </button>

                      <button
                        type="button"
                        disabled={isSavingRules}
                        onClick={handleSaveFocusRules}
                        className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 border border-border px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                      >
                        {rulesSaved ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Save size={12} />
                        )}
                        {rulesSaved ? "Saved!" : "Save Rules"}
                      </button>
                    </div>
                  </div>

                  {/* Code Editor Container */}
                  <div className="rounded-lg border border-border bg-[var(--bg-base,var(--background))] overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/30 text-[10px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileCode2 size={11} />
                        .tabs-review.json / Project Focus Prompt
                      </span>
                      <span>
                        {userHint.trim() ? `${userHint.split("\n").length} lines` : "Empty rules"}
                      </span>
                    </div>

                    <textarea
                      className="w-full bg-transparent px-3.5 py-3 text-xs text-[var(--fg,var(--foreground))] placeholder:text-muted-foreground/70 focus:outline-none resize-y font-mono leading-relaxed min-h-[135px]"
                      placeholder="e.g. Focus on null-safety, verify API breaking changes, enforce error handling on async functions…"
                      value={userHint}
                      onChange={(e) => setUserHint(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                    <Info size={12} className="shrink-0 opacity-70" />
                    <span>
                      These focus rules are automatically saved to your project settings and injected into all AI Code Review passes.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Running Status Banner */}
          {review.status === "running" && (
            <Card className="p-4 flex items-center gap-3 shadow-sm">
              <Loader2 size={18} className="animate-spin text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-foreground">Analyzing repository diff &amp; context…</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Evaluating static analysis context, symbols, Correctness &amp; Security passes
                </p>
              </div>
            </Card>
          )}

          {/* Error Banner */}
          {review.status === "error" && review.error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-red-500">Review Execution Error</h3>
                    <p className="text-xs text-red-500/90 font-mono mt-1 whitespace-pre-wrap">{review.error}</p>
                    {review.error.includes("503") || review.error.includes("demand") || review.error.includes("UNAVAILABLE") ? (
                      <p className="text-[11px] text-muted-foreground mt-2 font-sans flex items-center gap-1">
                        <Info size={11} className="shrink-0" />
                        Tip: Gemini AI servers are experiencing temporary high demand. Click <b>Retry AI Review</b> or switch model engine above.
                      </p>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => clearReviewError(cwd)}
                  className="text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer"
                  title="Dismiss Error"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-red-500/20">
                <button
                  type="button"
                  onClick={() => void handleRunReview()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} />
                  Retry AI Review
                </button>
                <button
                  type="button"
                  onClick={() => clearReviewError(cwd)}
                  className="px-3 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Results View */}
          {review.status === "done" && review.result && (
            <>
              {/* Top Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-3 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Total Findings
                  </span>
                  <div className="text-lg font-bold text-foreground">
                    {review.result.findings.length}
                  </div>
                </Card>

                <Card className="p-3 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={10} style={{ color: "var(--sem-red)" }} /> Errors
                  </span>
                  <div className="text-lg font-bold text-foreground">{errorCount}</div>
                </Card>

                <Card className="p-3 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={10} style={{ color: "var(--sem-amber)" }} /> Warnings
                  </span>
                  <div className="text-lg font-bold text-foreground">{warnCount}</div>
                </Card>

                <Card className="p-3 space-y-1 shadow-sm">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Wrench size={10} style={{ color: "var(--sem-sky)" }} /> Betterments
                  </span>
                  <div className="text-lg font-bold text-foreground">
                    {review.result.findings.length - errorCount - warnCount}
                  </div>
                </Card>
              </div>

              {/* Meta Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {review.isIncremental && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border border-border bg-muted text-foreground">
                    <Zap size={11} />
                    Incremental Review
                  </span>
                )}
                {review.result.passesRun.map((p) => (
                  <span
                    key={p}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-border bg-muted text-muted-foreground"
                  >
                    <CircleDot size={10} />
                    Pass: {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                ))}
              </div>

              {/* Zero Findings State */}
              {review.result.findings.length === 0 && (
                <Card className="p-6 text-center space-y-2 bg-muted/20">
                  <CheckCircle2 size={28} className="text-foreground mx-auto" />
                  <h3 className="text-sm font-bold text-foreground">Clean Code Review — No Issues Found</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    All configured correctness and security passes ran clean across your working tree changes.
                  </p>
                </Card>
              )}

              {/* Overview Summary Tabs */}
              <SummarySection result={review.result} />

              {/* Findings List */}
              {review.result.findings.length > 0 && (
                <div className="space-y-3 pt-2">
                  {/* Category & Severity Filter Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 mr-1">
                      <Filter size={11} /> Filter:
                    </span>
                    {(["error", "warning", "info"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverityFilter((prev) => (prev === s ? null : s))}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          severityFilter === s
                            ? "border-foreground bg-muted text-foreground font-semibold"
                            : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}

                    {allCategories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategoryFilter((prev) => (prev === c ? null : c))}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          categoryFilter === c
                            ? "border-foreground bg-muted text-foreground font-semibold"
                            : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    ))}

                    {(severityFilter !== null || categoryFilter !== null) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSeverityFilter(null);
                          setCategoryFilter(null);
                        }}
                        className="px-2 py-1 rounded text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <X size={10} /> Reset
                      </button>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="space-y-2.5">
                    {filteredFindings.map((f) => (
                      <FindingCard
                        key={f.id}
                        cwd={cwd}
                        finding={f}
                        feedbackState={feedbackState[f.id]}
                        onFeedback={handleFeedback}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Clean, De-cluttered Presets Section */}
          {(review.status === "idle" || review.status === "error") && (
            <div className="space-y-2">
              <SectionLabel
                action={
                  <span className="text-[10px] font-mono text-muted-foreground/60">
                    3 MODES AVAILABLE
                  </span>
                }
              >
                Review Presets &amp; Workflows
              </SectionLabel>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Security Audit Card */}
                <Card
                  onClick={() => void handleRunReview("Focus strictly on security vulnerabilities, unvalidated inputs, exposed secrets, and SQLi/XSS risks.")}
                  className="group p-4 flex flex-col justify-between hover:border-foreground/40 transition-colors cursor-pointer shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-[9px] font-mono font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        PRESET 01
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground opacity-60">SECURITY</span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                        <Lock size={15} className="text-foreground" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground group-hover:underline">
                          Security Audit
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Scan for exposed secrets, unvalidated inputs, injection risks, and auth flaws.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    <span>Run Security Scan</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Card>

                {/* Refactoring & Betterment Card */}
                <Card
                  onClick={() => void handleRunReview("Focus on code refactoring, performance bottlenecks, unhandled async promises, and memory optimizations.")}
                  className="group p-4 flex flex-col justify-between hover:border-foreground/40 transition-colors cursor-pointer shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-[9px] font-mono font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        PRESET 02
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground opacity-60">OPTIMIZE</span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                        <Flame size={15} className="text-foreground" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground group-hover:underline">
                          Refactoring &amp; Betterment
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Highlight code smells, performance bottlenecks, async leaks, and cleaner idioms.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    <span>Run Refactor Scan</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Card>

                {/* API & Type Safety Card */}
                <Card
                  onClick={() => void handleRunReview("Focus on TypeScript type safety, API breaking changes, schema contracts, and null dereference errors.")}
                  className="group p-4 flex flex-col justify-between hover:border-foreground/40 transition-colors cursor-pointer shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-[9px] font-mono font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        PRESET 03
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground opacity-60">TYPESAFE</span>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                        <Braces size={15} className="text-foreground" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground group-hover:underline">
                          API &amp; Type Safety
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Check schema backward compatibility, null-safety, and API contract breaks.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    <span>Run Type &amp; Contract Scan</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Audit History Tab View ── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {selectedHistoryRecord ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedHistoryRecord(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={13} /> Back to Audit History Log
              </button>

              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      Audit Report — {new Date(selectedHistoryRecord.timestamp).toLocaleString()}
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Model: {selectedHistoryRecord.modelUsed} · Branch: {selectedHistoryRecord.branchName}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
                    {selectedHistoryRecord.findings.length} findings
                  </span>
                </div>

                <SummarySection
                  result={{
                    summary: selectedHistoryRecord.summary,
                    keyChanges: selectedHistoryRecord.keyChanges,
                    notesAndRisk: selectedHistoryRecord.notesAndRisk,
                    findings: [...selectedHistoryRecord.findings],
                    passesRun: [...selectedHistoryRecord.passesRun],
                    targetScope: selectedHistoryRecord.targetScope as any,
                    wasTruncated: false,
                  }}
                />

                <div className="space-y-3">
                  <SectionLabel>Findings ({selectedHistoryRecord.findings.length})</SectionLabel>
                  {selectedHistoryRecord.findings.map((f) => (
                    <FindingCard
                      key={f.id}
                      cwd={cwd}
                      finding={f}
                      feedbackState={undefined}
                      onFeedback={() => {}}
                    />
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel className="mt-0">
                  Historical Audit Reports ({historyRecords.length})
                </SectionLabel>
                <Button onClick={() => void loadHistory()} className="gap-1 text-xs py-1 h-7">
                  <RefreshCw size={11} /> Refresh Log
                </Button>
              </div>

              {isLoadingHistory && (
                <div className="p-8 text-center">
                  <Loader2 size={20} className="animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Loading audit records…</p>
                </div>
              )}

              {!isLoadingHistory && historyRecords.length === 0 && (
                <Card className="p-8 text-center border-dashed">
                  <History size={24} className="text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">No historical audit records found</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Every AI Review run automatically archives an audit report here.
                  </p>
                </Card>
              )}

              {!isLoadingHistory && historyRecords.length > 0 && (
                <div className="space-y-2">
                  {historyRecords.map((rec) => (
                    <Card
                      key={rec.id}
                      onClick={() => setSelectedHistoryRecord(rec)}
                      className="group p-3.5 flex items-center justify-between gap-4 hover:border-foreground/50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-foreground truncate">
                            {rec.summary.slice(0, 75)}…
                          </span>
                          {rec.isIncremental && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-muted text-muted-foreground border border-border">
                              Incremental
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(rec.timestamp).toLocaleString()}
                          </span>
                          <span>Model: {rec.modelUsed}</span>
                          <span>Branch: {rec.branchName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-muted text-foreground border border-border">
                          {rec.findings.length} findings
                        </span>
                        <ChevronRight size={15} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
