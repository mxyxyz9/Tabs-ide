import { useAtomValue } from "@effect/atom-react";
import type { DesktopCodeHostState, ServerProvider } from "@tabs/contracts";
import { PROVIDER_DISPLAY_NAMES } from "@tabs/contracts";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BotIcon,
  CheckCircle2Icon,
  CodeIcon,
  CpuIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderPlusIcon,
  GitBranchIcon,
  GlobeIcon,
  KeyRoundIcon,
  PlayIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TestTubeIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useCompleteOnboarding } from "../../onboarding/firstRun";
import { readNativeApi } from "../../nativeApi";
import { newCommandId, newProjectId } from "../../lib/utils";
import { readModelStateAtom } from "../../state/readModel";
import { serverConfigAtom, updateClientSettings, useClientSettings } from "../../state/settings";
import { ClaudeAI, OpenAI } from "../Icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export interface WelcomeWizardProps {
  readonly onDone?: () => void;
}

type WizardStep = 0 | 1 | 2 | 3;

interface CorePillar {
  readonly id: string;
  readonly title: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly badge: string;
  readonly description: string;
  readonly highlights: readonly string[];
}

const CORE_PILLARS: readonly CorePillar[] = [
  {
    id: "code",
    title: "Embedded Code-OSS",
    icon: CodeIcon,
    badge: "Core Editor",
    description:
      "A full, zero-compromise VS Code engine embedded natively inside Tabs with extension host, language servers, breadcrumbs, and split editors.",
    highlights: ["Native extensions support", "High-performance Monaco buffers", "Multi-file split views"],
  },
  {
    id: "agents",
    title: "Autonomous Agents",
    icon: BotIcon,
    badge: "AI Pair Programmer",
    description:
      "Multi-turn coding agents (Codex, Claude, etc.) that inspect files, run terminal commands, and draft changes with live diff reviews.",
    highlights: ["Parallel thread orchestration", "Visual checkpoint diffs", "Fine-grained approval gates"],
  },
  {
    id: "server",
    title: "Execution & Server",
    icon: CpuIcon,
    badge: "Runtime",
    description:
      "Integrated daemon managing processes, background tasks, port forwarding, and live command execution streams with instant restarts.",
    highlights: ["Live execution logs", "Port detection & proxying", "Isolated process sandboxing"],
  },
  {
    id: "git",
    title: "Visual Git Workflows",
    icon: GitBranchIcon,
    badge: "Version Control",
    description:
      "Visual branch trees, commit composer, unstaged diff reviews, worktree creation, and multi-PR stack management.",
    highlights: ["Multi-PR stack overview", "Worktree branch isolation", "Granular hunk staging"],
  },
  {
    id: "browser",
    title: "Native Browser Views",
    icon: GlobeIcon,
    badge: "Preview Engine",
    description:
      "Hardware-accelerated WebContentsView preview running alongside your code with responsive device emulation, console capture, and devtools.",
    highlights: ["Isolated browser sessions", "Viewport frame emulation", "Built-in inspect & devtools"],
  },
  {
    id: "testing",
    title: "Interactive Testing",
    icon: TestTubeIcon,
    badge: "Quality Assurance",
    description:
      "Integrated test runner and suite inspector. Run unit, integration, and UI tests directly in Tabs with visual assertion diffs.",
    highlights: ["Live test run status", "Assertion failure diffs", "Interactive watch modes"],
  },
];

export function WelcomeWizard({ onDone }: WelcomeWizardProps) {
  const completeOnboarding = useCompleteOnboarding();
  const [step, setStep] = useState<WizardStep>(0);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("codex");
  const [codeHostState, setCodeHostState] = useState<DesktopCodeHostState | null>(null);
  const [isCheckingCodeHost, setIsCheckingCodeHost] = useState(false);

  const serverConfig = useAtomValue(serverConfigAtom);
  const clientSettings = useClientSettings();
  const readModel = useAtomValue(readModelStateAtom);
  const projects = readModel.projects;

  // Poll embedded Code-OSS readiness from desktop bridge
  const checkCodeHost = useCallback(async () => {
    setIsCheckingCodeHost(true);
    try {
      if (window.desktopBridge?.getCodeHostState) {
        const state = await window.desktopBridge.getCodeHostState();
        setCodeHostState(state);
      } else {
        setCodeHostState({
          available: false,
          mode: "external",
          entry: null,
          reason: "Running in non-electron web browser context",
        });
      }
    } catch (e) {
      setCodeHostState({
        available: false,
        mode: "external",
        entry: null,
        reason: String(e),
      });
    } finally {
      setIsCheckingCodeHost(false);
    }
  }, []);

  useEffect(() => {
    void checkCodeHost();
  }, [checkCodeHost]);

  const handleFinish = useCallback(async () => {
    if (selectedFolder) {
      const api = readNativeApi();
      if (api) {
        const projectId = newProjectId();
        const title = selectedFolder.split(/[/\\]/).findLast((s) => s.trim().length > 0) ?? selectedFolder;
        await api.orchestration.dispatchCommand({
          type: "project.create",
          commandId: newCommandId(),
          projectId,
          title,
          workspaceRoot: selectedFolder,
          defaultModelSelection: null,
          createdAt: new Date().toISOString(),
        }).catch((err) => {
          console.warn("[Onboarding] Failed to auto-create selected project", err);
        });
      }
    }

    if (selectedProvider) {
      updateClientSettings((current) => ({
        ...current,
        aiProvider: selectedProvider as typeof current.aiProvider,
      }));
    }

    await completeOnboarding();
    onDone?.();
  }, [completeOnboarding, onDone, selectedFolder, selectedProvider]);

  const handleSkip = useCallback(async () => {
    await completeOnboarding();
    onDone?.();
  }, [completeOnboarding, onDone]);

  const handlePickFolder = useCallback(async () => {
    const api = readNativeApi();
    if (api?.dialogs?.pickFolder) {
      const folder = await api.dialogs.pickFolder();
      if (folder) {
        setSelectedFolder(folder);
      }
    } else if (window.desktopBridge?.pickFolder) {
      const folder = await window.desktopBridge.pickFolder();
      if (folder) {
        setSelectedFolder(folder);
      }
    }
  }, []);

  const providers: readonly ServerProvider[] = serverConfig?.providers ?? [];

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-y-auto bg-background text-foreground select-none">
      {/* Background radial glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-96 w-full max-w-5xl bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_70%)]" />
        <div className="absolute bottom-0 right-1/4 h-72 w-96 bg-[radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.08),transparent_70%)]" />
      </div>

      {/* Top Header with Progress & Skip */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 text-primary shadow-sm shadow-primary/10">
            <SparklesIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">Tabs IDE</h1>
            <p className="text-xs text-muted-foreground">Setup & Platform Overview</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="hidden sm:flex items-center gap-2">
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 bg-primary"
                  : s < step
                    ? "w-4 bg-primary/40"
                    : "w-4 bg-muted"
              }`}
            />
          ))}
          <span className="ml-2 text-xs font-medium text-muted-foreground">
            Step {step + 1} of 4
          </span>
        </div>

        {/* Persistent Skip Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Skip setup
        </Button>
      </header>

      {/* Main Wizard Content Area */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-4 sm:px-8">
        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground/85 backdrop-blur-sm">
                <span>Tabs Platform Architecture</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-primary font-semibold">6 Core Pillars</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome to Tabs.
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Tabs is a high-performance, unified AI pair-programming workbench.
                Here is how the core systems work together to accelerate your workflow.
              </p>
            </div>

            {/* Live Code-OSS Readiness Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <CodeIcon className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Embedded Code-OSS Runtime
                    </span>
                    {codeHostState?.available ? (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] gap-1">
                        <CheckCircle2Icon className="size-3" /> Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] gap-1">
                        <RefreshCwIcon className={`size-3 ${isCheckingCodeHost ? "animate-spin" : ""}`} />
                        {codeHostState?.mode === "external" ? "External Host" : "Connecting"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {codeHostState?.available
                      ? `Native electron workbench active (${codeHostState.mode} mode)`
                      : codeHostState?.reason ?? "Checking embedded host..."}
                  </p>
                </div>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => void checkCodeHost()}
                disabled={isCheckingCodeHost}
                className="text-xs"
              >
                <RefreshCwIcon className={`size-3 mr-1.5 ${isCheckingCodeHost ? "animate-spin" : ""}`} />
                Re-check
              </Button>
            </div>

            {/* 6 Pillars Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CORE_PILLARS.map((pillar) => {
                const IconComponent = pillar.icon;
                return (
                  <div
                    key={pillar.id}
                    className="flex flex-col justify-between rounded-xl border border-border/70 bg-card/40 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-card/70 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                          <IconComponent className="size-4" />
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
                          {pillar.badge}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{pillar.title}</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>
                    <div className="mt-3.5 pt-2.5 border-t border-border/40 space-y-1">
                      {pillar.highlights.map((h, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="size-1 rounded-full bg-primary/60" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground/85 backdrop-blur-sm">
                <span>AI Providers</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-emerald-500 font-semibold">Offline Ready</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Coding Agents & Providers
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Tabs supports multiple AI model providers. Detect active credentials, configure keys,
                or use Tabs completely offline with local tools and embedded Code-OSS.
              </p>
            </div>

            {/* Offline notification card */}
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-800 dark:text-emerald-200">
              <ShieldCheckIcon className="size-5 shrink-0 text-emerald-500 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Full Offline Resilience:
                </span>{" "}
                If you are working offline, in an air-gapped environment, or haven't configured an API key yet,
                Tabs operates without error. You can still use the embedded editor, Git workflows, terminals,
                and browser views at any time.
              </div>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Codex Provider Card */}
              <div
                onClick={() => setSelectedProvider("codex")}
                className={`cursor-pointer rounded-xl border p-5 transition-all duration-200 ${
                  selectedProvider === "codex"
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                    : "border-border/70 bg-card/40 hover:border-border hover:bg-card/70"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-foreground/5 border border-border text-foreground">
                      <OpenAI className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">OpenAI / Codex</h3>
                        {selectedProvider === "codex" && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                            Selected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">GPT-4o, o3-mini, Codex App-Server</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                    Active
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Default native pair programmer. Uses official app-server daemon for autonomous code exploration,
                  structured diffs, and tool calls.
                </p>
              </div>

              {/* Claude Provider Card */}
              <div
                onClick={() => setSelectedProvider("claude")}
                className={`cursor-pointer rounded-xl border p-5 transition-all duration-200 ${
                  selectedProvider === "claude"
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                    : "border-border/70 bg-card/40 hover:border-border hover:bg-card/70"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-foreground/5 border border-border text-amber-500">
                      <ClaudeAI className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">Anthropic Claude</h3>
                        {selectedProvider === "claude" && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                            Selected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Claude 3.7 Sonnet, Claude 3.5 Haiku</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                    Ready
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Deep reasoning and architect workflows. Supports MCP servers, custom skills, and computer-use tools.
                </p>
              </div>
            </div>

            {/* Detected Server Providers List */}
            {providers.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                    Detected System Providers ({providers.length})
                  </span>
                  <span>Configured via server config</span>
                </div>
                <div className="divide-y divide-border/40">
                  {providers.map((p) => (
                    <div key={p.instanceId} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {p.displayName ?? PROVIDER_DISPLAY_NAMES[p.driver as keyof typeof PROVIDER_DISPLAY_NAMES] ?? p.driver}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          v{p.version ?? "latest"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.installed ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                            Installed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Not Installed
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground/85 backdrop-blur-sm">
                <span>Workspace Setup</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-primary font-semibold">Your Project</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Open or Add a Project
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Pick an existing directory on your machine, clone a remote Git repository,
                or start with a fresh blank workspace.
              </p>
            </div>

            {/* Folder Selection Actions */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div
                onClick={handlePickFolder}
                className="cursor-pointer group flex flex-col justify-between rounded-xl border border-dashed border-border/90 bg-card/40 p-6 transition-all duration-200 hover:border-primary hover:bg-card/70 hover:shadow-md"
              >
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                    <FolderPlusIcon className="size-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    Choose Local Folder...
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Open a native directory dialog to select any repo or folder on your computer.
                  </p>
                </div>
                <div className="mt-5">
                  <Button size="sm" variant="outline" className="w-full text-xs">
                    Browse Folders
                  </Button>
                </div>
              </div>

              <div
                onClick={() => setSelectedFolder(null)}
                className={`cursor-pointer flex flex-col justify-between rounded-xl border p-6 transition-all duration-200 ${
                  selectedFolder === null
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-primary/40"
                    : "border-border/70 bg-card/40 hover:border-border hover:bg-card/70"
                }`}
              >
                <div>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-foreground border border-border">
                    <FolderIcon className="size-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    Start with Empty Workspace
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Proceed into Tabs without pre-loading a project folder. You can add or create projects anytime from the sidebar or Command Palette.
                  </p>
                </div>
                <div className="mt-5">
                  <Button
                    size="sm"
                    variant={selectedFolder === null ? "default" : "outline"}
                    className="w-full text-xs"
                  >
                    Use Default Workspace
                  </Button>
                </div>
              </div>
            </div>

            {/* Selected Folder Preview */}
            {selectedFolder && (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderIcon className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">Selected Directory:</span>
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                        Ready to load
                      </Badge>
                    </div>
                    <code className="text-[11px] text-muted-foreground break-all mt-0.5 block font-mono">
                      {selectedFolder}
                    </code>
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setSelectedFolder(null)}
                  className="text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Recent Workspaces List if available */}
            {projects.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3">
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block">
                  Existing Workspace Projects
                </span>
                <div className="space-y-1.5">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedFolder(p.cwd)}
                      className={`cursor-pointer flex items-center justify-between rounded-lg p-2.5 text-xs transition-colors ${
                        selectedFolder === p.cwd
                          ? "bg-primary/10 text-foreground border border-primary/30"
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FolderIcon className="size-3.5" />
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground font-mono text-[10px]">{p.cwd}</span>
                      </div>
                      {selectedFolder === p.cwd && (
                        <CheckCircle2Icon className="size-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground/85 backdrop-blur-sm">
                <span>Confirmation</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-emerald-500 font-semibold">Ready to Build</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to Launch Tabs
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Your environment is configured. Here is a summary of your setup:
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card/40 p-4">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Editor
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <CodeIcon className="size-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Embedded Code-OSS</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {codeHostState?.available ? "Native desktop workbench" : "Standard editor"}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card/40 p-4">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  AI Model Provider
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <BotIcon className="size-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-foreground capitalize">
                    {selectedProvider}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Offline fallback enabled
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-card/40 p-4">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Initial Workspace
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <FolderIcon className="size-4 text-amber-500" />
                  <span className="text-sm font-semibold text-foreground truncate">
                    {selectedFolder
                      ? selectedFolder.split(/[/\\]/).findLast((s) => s.trim().length > 0) ?? selectedFolder
                      : "Default Workspace"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground truncate font-mono">
                  {selectedFolder ?? "Empty workspace"}
                </p>
              </div>
            </div>

            {/* Quick tips */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-3">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <SparklesIcon className="size-3.5 text-primary" /> Keyboard Shortcuts & Quick Tips
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">Cmd/Ctrl + K</kbd>
                  <span>Open Command Palette</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">Cmd/Ctrl + B</kbd>
                  <span>Toggle Sidebar</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">Cmd/Ctrl + `</kbd>
                  <span>Toggle Embedded Terminal</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">Cmd/Ctrl + ,</kbd>
                  <span>Open Settings & Diagnostics</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Controls */}
      <footer className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between border-t border-border/60 px-6 py-4 sm:px-8">
        <div>
          {step > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as WizardStep)}
              className="text-xs gap-1.5"
            >
              <ArrowLeftIcon className="size-3.5" /> Back
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              You can re-run this setup anytime in Settings.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => (s + 1) as WizardStep)}
              className="text-xs gap-1.5"
            >
              Next <ArrowRightIcon className="size-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void handleFinish()}
              className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 px-4"
            >
              <PlayIcon className="size-3.5 fill-current" /> Launch Tabs Workbench
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
