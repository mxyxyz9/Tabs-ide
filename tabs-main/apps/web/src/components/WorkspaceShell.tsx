import type { FileDiffMetadata, Hunk } from "@pierre/diffs";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  MessageId,
  type DesktopBrowserHostState,
  type DesktopBrowserSessionState,
  type DesktopCodeHostState,
  type GitApplyHunkMode,
  type ProjectId,
  ThreadId,
  type GitBranch,
  type GitStatusFile,
} from "@tabs/contracts";
import { type ProjectToolKind, type ProjectWorkspaceSettings } from "@tabs/contracts/settings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BugIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  FolderSearchIcon,
  GitBranchIcon,
  GlobeIcon,
  LoaderIcon,
  PlayIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCwIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  PanelTopCloseIcon,
  PanelTopOpenIcon,
  TerminalSquareIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useStore } from "../store";
import { useDesktopIconThemeSync } from "../hooks/useDesktopIconTheme";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useSettings } from "../hooks/useSettings";
import { useTheme } from "../hooks/useTheme";
import { isElectron } from "../env";
import { toGitUserFacingErrorMessage } from "../lib/gitErrorMessages";
import {
  gitBranchesQueryOptions,
  gitConflictSnapshotQueryOptions,
  gitDiffQueryOptions,
  gitHistoryQueryOptions,
  gitStashListQueryOptions,
  gitStatusQueryOptions,
} from "../lib/gitReactQuery";
import {
  buildSingleHunkPatch,
  getRenderablePatch,
  resolveFileDiffPath as resolvePatchFilePath,
} from "../lib/patchParsing";
import {
  projectReadFileQueryOptions,
  projectSearchEntriesQueryOptions,
} from "../lib/projectReactQuery";
import { cn, isWindowsPlatform, newCommandId, newProjectId, randomUUID } from "../lib/utils";

// On Windows the native title bar is hidden and the caption buttons are overlaid
// (Window Controls Overlay) at the top-right, so the top bar reserves space on
// the right instead of the macOS traffic-light space on the left.
const isWindowsDesktop =
  isElectron && typeof navigator !== "undefined" && isWindowsPlatform(navigator.platform);
import { ensureNativeApi, readNativeApi } from "../nativeApi";
import { openInPreferredEditor } from "../editorPreferences";
import GitCommitComposer from "./GitCommitComposer";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./ui/menu";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import ThreadTerminalDrawer from "./ThreadTerminalDrawer";
import { toastManager } from "./ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { getGitWorkspaceLayoutSection } from "./GitToolLayout.logic";
import type { GitWorkspaceMode, GitWorkspaceSwitchReason } from "./GitToolLayout.logic";
import {
  resolveProjectTools,
  useProjectWorkspaceSettings,
  useWorkspaceShellStore,
} from "../workspaceShellStore";
import { DEFAULT_THREAD_TERMINAL_ID, type Project, type Thread } from "../types";
import { type ProjectBrowserToolState } from "../workspaceShellStore";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";
import { projectScriptRuntimeEnv } from "../projectScripts";
import { PatchViewer } from "./PatchViewer";
import { VscodeEntryIcon } from "./chat/VscodeEntryIcon";
import { getCodeHostUnavailableMessage } from "./codeHost.logic";
import { CodeActivityRail } from "./code/CodeActivityRail";
import { CodeHeaderBar } from "./code/CodeHeaderBar";
import { CodeStatusBar } from "./code/CodeStatusBar";
import { DEFAULT_CODE_CHROME_STATE, type CodeChromeState } from "@tabs/shared/codeChrome";

const BROWSER_DEVICE_PRESETS = [
  { id: "project-default", label: "Project", width: null, height: null },
  { id: "mobile-s", label: "iPhone 14 Pro", width: 393, height: 852 },
  { id: "mobile-l", label: "iPhone 14 Pro Max", width: 430, height: 932 },
  { id: "tablet", label: "iPad Air", width: 820, height: 1180 },
  { id: "desktop", label: "Laptop 13", width: 1280, height: 800 },
  { id: "wide", label: "Large Desktop", width: 1600, height: 960 },
  { id: "custom", label: "Custom size", width: null, height: null },
] as const;

const GIT_WORKSPACE_MODE_STORAGE_KEY = "tabs:git-workspace-mode";

function formatBrowserViewportLabel(browserState: ProjectBrowserToolState): string {
  const selectedPreset =
    BROWSER_DEVICE_PRESETS.find((preset) => preset.id === browserState.devicePreset) ??
    BROWSER_DEVICE_PRESETS[0]!;
  if (selectedPreset.id !== "custom") {
    return selectedPreset.label;
  }
  if (browserState.customWidth && browserState.customHeight) {
    return `${selectedPreset.label} ${browserState.customWidth} x ${browserState.customHeight}`;
  }
  return selectedPreset.label;
}

function BrowserViewportSelector(props: {
  browserState: ProjectBrowserToolState;
  projectId: ProjectId;
  setBrowserViewport: (
    projectId: ProjectId,
    input: {
      devicePreset: ProjectBrowserToolState["devicePreset"];
      customWidth?: number | null;
      customHeight?: number | null;
      landscape?: boolean;
    },
  ) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const selectedPreset =
    BROWSER_DEVICE_PRESETS.find((preset) => preset.id === props.browserState.devicePreset) ??
    BROWSER_DEVICE_PRESETS[0]!;
  const [customWidthDraft, setCustomWidthDraft] = useState(
    String(props.browserState.customWidth ?? ""),
  );
  const [customHeightDraft, setCustomHeightDraft] = useState(
    String(props.browserState.customHeight ?? ""),
  );

  useEffect(() => {
    if (props.browserState.devicePreset !== "custom") {
      setCustomWidthDraft("");
      setCustomHeightDraft("");
      return;
    }
    setCustomWidthDraft(String(props.browserState.customWidth ?? ""));
    setCustomHeightDraft(String(props.browserState.customHeight ?? ""));
  }, [props.browserState.devicePreset]);

  const updateCustomWidth = (value: string) => {
    setCustomWidthDraft(value);
    const parsedWidth = Number.parseInt(value, 10);
    props.setBrowserViewport(props.projectId, {
      devicePreset: "custom",
      customWidth: value.trim().length === 0 || Number.isNaN(parsedWidth) ? null : parsedWidth,
    });
  };

  const updateCustomHeight = (value: string) => {
    setCustomHeightDraft(value);
    const parsedHeight = Number.parseInt(value, 10);
    props.setBrowserViewport(props.projectId, {
      devicePreset: "custom",
      customHeight: value.trim().length === 0 || Number.isNaN(parsedHeight) ? null : parsedHeight,
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={props.browserState.devicePreset}
        onValueChange={(devicePreset) =>
          props.setBrowserViewport(props.projectId, {
            devicePreset: devicePreset as ProjectBrowserToolState["devicePreset"],
          })
        }
        onOpenChange={props.onOpenChange}
      >
        <SelectTrigger
          size="xs"
          className="min-w-[10rem] rounded-full border-border/70 bg-card/70 px-3 text-xs font-medium text-foreground shadow-none hover:bg-accent/50"
        >
          {formatBrowserViewportLabel(props.browserState)}
        </SelectTrigger>
        <SelectPopup align="end" className="w-56">
          {BROWSER_DEVICE_PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{preset.label}</span>
                {preset.width && preset.height ? (
                  <span className="truncate text-[10px] text-muted-foreground/60">
                    {preset.width} x {preset.height}
                  </span>
                ) : null}
              </div>
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      {selectedPreset.id === "custom" ? (
        <div className="flex items-center gap-1.5">
          <Input
            className="h-7 w-20"
            inputMode="numeric"
            value={customWidthDraft}
            onChange={(event) => updateCustomWidth(event.target.value)}
            placeholder="Width"
          />
          <Input
            className="h-7 w-20"
            inputMode="numeric"
            value={customHeightDraft}
            onChange={(event) => updateCustomHeight(event.target.value)}
            placeholder="Height"
          />
        </div>
      ) : null}
    </div>
  );
}

function BrowserViewportHiddenNotice() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-5 z-40 w-[min(38rem,calc(100%-1.5rem))] -translate-x-1/2 px-3">
      <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background/95 px-4 py-3 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-xl">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/12 text-sky-300">
          <GlobeIcon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            Preview hidden for screen sizing
          </div>
          <div className="mt-0.5 text-sm leading-5 text-muted-foreground">
            Close the screen-size menu and the preview will return automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

const EMBED_LOAD_TIMEOUT_MS = 5000;
const DEFAULT_DESKTOP_CODE_HOST_STATE: DesktopCodeHostState = {
  available: false,
  mode: "external",
  entry: null,
  reason: null,
};
const DEFAULT_DESKTOP_BROWSER_HOST_STATE: DesktopBrowserHostState = {
  available: false,
  reason: null,
};
const CODE_HOST_OVERLAY_SELECTOR = [
  "[data-slot='menu-positioner']",
  "[data-slot='popover-positioner']",
  "[data-slot='dialog-backdrop']",
  "[data-slot='dialog-popup']",
  "[data-slot='alert-dialog-backdrop']",
  "[data-slot='alert-dialog-popup']",
  "[data-slot='command-dialog-backdrop']",
  "[data-slot='command-dialog-popup']",
].join(", ");

type EmbeddedWorkspaceMode = {
  enabled: boolean;
  workspaceRoot: string | null;
  tool: "agents" | "server" | "browser" | "code" | "git";
};

function resolveEmbeddedWorkspaceMode(): EmbeddedWorkspaceMode {
  if (typeof window === "undefined") {
    return { enabled: false, workspaceRoot: null, tool: "agents" };
  }

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") !== "1") {
      return { enabled: false, workspaceRoot: null, tool: "agents" };
    }

    const workspaceRoot = params.get("workspaceRoot")?.trim() || null;
    const requestedTool = params.get("tool")?.trim() || "agents";
    const tool =
      requestedTool === "server" ||
      requestedTool === "browser" ||
      requestedTool === "code" ||
      requestedTool === "git"
        ? requestedTool
        : "agents";

    return {
      enabled: true,
      workspaceRoot,
      tool,
    };
  } catch {
    return { enabled: false, workspaceRoot: null, tool: "agents" };
  }
}

function toolIcon(tool: ProjectToolKind) {
  switch (tool) {
    case "code":
      return <WorkflowIcon className="size-3.5" />;
    case "agents":
      return <BotIcon className="size-3.5" />;
    case "server":
      return <ServerIcon className="size-3.5" />;
    case "git":
      return <GitBranchIcon className="size-3.5" />;
    case "browser":
    case "custom_embed":
      return <GlobeIcon className="size-3.5" />;
    case "custom_process":
      return <TerminalSquareIcon className="size-3.5" />;
  }
}

function basenameOfPath(input: string): string {
  const parts = input.split(/[/\\]/g).filter(Boolean);
  return parts[parts.length - 1] ?? input;
}

function dirnameOfPath(input: string): string | null {
  const normalized = input.replace(/[/\\]+$/, "");
  const lastSeparator = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  if (lastSeparator <= 0) {
    return null;
  }
  return normalized.slice(0, lastSeparator);
}

function relativePathFromParent(parent: string, target: string): string | null {
  const normalizedParent = parent.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedTarget = target.replace(/\\/g, "/");
  const prefix = `${normalizedParent}/`;
  if (!normalizedTarget.startsWith(prefix)) {
    return null;
  }
  const relative = normalizedTarget.slice(prefix.length);
  return relative.length > 0 ? relative : null;
}

function createEmptyBrowserSessionState(
  projectId: ProjectId,
  sessionId = "browser",
): DesktopBrowserSessionState {
  return {
    projectId,
    sessionId,
    currentUrl: null,
    pageTitle: null,
    loading: false,
    canGoBack: false,
    canGoForward: false,
    devToolsOpen: false,
    lastError: null,
  };
}

function deriveRemoteSelectionParts(branch: GitBranch): {
  remoteName: string;
  remoteBranch: string;
} | null {
  if (!branch.isRemote) return null;
  if (branch.remoteName && branch.name.startsWith(`${branch.remoteName}/`)) {
    return {
      remoteName: branch.remoteName,
      remoteBranch: branch.name.slice(branch.remoteName.length + 1),
    };
  }
  const separatorIndex = branch.name.indexOf("/");
  if (separatorIndex <= 0) return null;
  return {
    remoteName: branch.name.slice(0, separatorIndex),
    remoteBranch: branch.name.slice(separatorIndex + 1),
  };
}

type GitConflictResolverMode = "manual" | "ai";

type GitAiConflictState =
  | {
      status: "idle";
      userMessageId: string | null;
      sourceMessageId: string | null;
      proposal: string | null;
      error: string | null;
    }
  | {
      status: "sending" | "waiting" | "ready" | "error";
      userMessageId: string;
      sourceMessageId: string | null;
      proposal: string | null;
      error: string | null;
    };

function buildPreviewPatch(relativePath: string, previousContents: string, nextContents: string) {
  if (previousContents === nextContents) {
    return "";
  }

  const previousLines = previousContents.split("\n");
  const nextLines = nextContents.split("\n");
  const maxLines = Math.max(previousLines.length, nextLines.length);
  const patchLines = [`--- a/${relativePath}`, `+++ b/${relativePath}`];
  patchLines.push(`@@ -1,${previousLines.length} +1,${nextLines.length} @@`);

  for (let index = 0; index < maxLines; index += 1) {
    const previousLine = previousLines[index];
    const nextLine = nextLines[index];

    if (previousLine === nextLine) {
      if (previousLine !== undefined) {
        patchLines.push(` ${previousLine}`);
      }
      continue;
    }

    if (previousLine !== undefined) {
      patchLines.push(`-${previousLine}`);
    }
    if (nextLine !== undefined) {
      patchLines.push(`+${nextLine}`);
    }
  }

  return `${patchLines.join("\n")}\n`;
}

function extractFirstCodeFence(text: string): string | null {
  const match = text.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  return match?.[1]?.replace(/\n$/, "") ?? null;
}

function buildConflictFixPrompt(input: {
  projectPath: string;
  relativePath: string;
  contents: string;
}) {
  return [
    `Resolve the Git merge conflict in \`${input.relativePath}\` inside the project \`${input.projectPath}\`.`,
    "",
    "Requirements:",
    "- Return the fully resolved file contents only.",
    "- Preserve valid code and remove all conflict markers.",
    "- Do not include explanation.",
    "- Put the final file contents inside one fenced code block.",
    "",
    "Current conflicted file:",
    "```",
    input.contents,
    "```",
  ].join("\n");
}

function classifyGitHistoryRef(ref: string) {
  if (ref === "HEAD" || ref.startsWith("HEAD -> ")) {
    return { label: ref, variant: "secondary" as const };
  }
  if (ref.startsWith("origin/") || ref.includes("/")) {
    return { label: ref, variant: "info" as const };
  }
  if (ref.startsWith("tag: ")) {
    return { label: ref, variant: "success" as const };
  }
  return { label: ref, variant: "outline" as const };
}

function resolveSelectedPatchFile(
  patch: string | null | undefined,
  selectedPath: string | null,
  cacheScope: string,
): FileDiffMetadata | null {
  if (!patch || !selectedPath) return null;
  const renderablePatch = getRenderablePatch(patch, cacheScope);
  if (!renderablePatch || renderablePatch.kind !== "files") {
    return null;
  }
  return (
    renderablePatch.files.find((fileDiff) => resolvePatchFilePath(fileDiff) === selectedPath) ??
    renderablePatch.files[0] ??
    null
  );
}

function resolveGitHunkActionModes(file: GitStatusFile | null): {
  modes: ReadonlyArray<GitApplyHunkMode>;
  unavailableReason: string | null;
} {
  if (!file) {
    return { modes: [], unavailableReason: "Select a changed file to review its hunks." };
  }
  if (file.conflicted) {
    return {
      modes: [],
      unavailableReason:
        "Resolve conflicts first. Hunk actions are unavailable for conflicted files.",
    };
  }
  if (file.untracked) {
    return {
      modes: [],
      unavailableReason:
        "Stage or discard the full untracked file first. Hunk actions are unavailable here.",
    };
  }
  if (file.staged && file.unstaged) {
    return {
      modes: [],
      unavailableReason:
        "This file has both staged and unstaged changes. Use whole-file actions first, then return to hunk actions.",
    };
  }
  if (file.staged) {
    return { modes: ["unstage"], unavailableReason: null };
  }
  if (file.unstaged) {
    return { modes: ["stage", "discard"], unavailableReason: null };
  }
  return { modes: [], unavailableReason: "No hunk actions are available for this file yet." };
}

type ServerPresetRuntimeStatus = "idle" | "stopped" | "running";

function moveListItem<T>(items: ReadonlyArray<T>, fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) {
    return next;
  }
  next.splice(toIndex, 0, moved);
  return next;
}

function resolveServerPresetRuntimeStatus(input: {
  processId: string;
  runningProcessIds: ReadonlySet<string>;
  terminalIds: ReadonlySet<string>;
}): ServerPresetRuntimeStatus {
  if (input.runningProcessIds.has(input.processId)) {
    return "running";
  }
  if (input.terminalIds.has(input.processId)) {
    return "stopped";
  }
  return "idle";
}

function sortProjectThreads(threads: ReadonlyArray<Thread>): Thread[] {
  return threads.toSorted((left, right) => {
    const rightTime = Date.parse(right.updatedAt ?? right.createdAt);
    const leftTime = Date.parse(left.updatedAt ?? left.createdAt);
    if (!Number.isNaN(rightTime) && !Number.isNaN(leftTime) && rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function resolveProjectDefaultBrowserUrl(
  _project: Project,
  settings: ProjectWorkspaceSettings,
): string {
  // Empty default = a blank "new tab" (don't force localhost:3000). The browser
  // tool renders a start state and waits for the user to enter a URL.
  return settings.browser.defaultUrl.trim();
}

function normalizeBrowserUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (/^[a-z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return `http://${trimmed}`;
}

function resolveProjectById(
  projects: ReadonlyArray<Project>,
  projectId: ProjectId | null,
): Project | null {
  return projectId ? (projects.find((project) => project.id === projectId) ?? null) : null;
}

function resolveMostRecentThreadForProject(
  projectId: ProjectId,
  threads: ReadonlyArray<Thread>,
): Thread | null {
  return sortProjectThreads(threads.filter((thread) => thread.projectId === projectId))[0] ?? null;
}

function resolveProjectAgentThread(
  projectId: ProjectId,
  threads: ReadonlyArray<Thread>,
  rememberedThreadId: ThreadId | null,
): Thread | null {
  const rememberedThread = rememberedThreadId
    ? threads.find((thread) => thread.id === rememberedThreadId && thread.projectId === projectId)
    : null;
  return rememberedThread ?? resolveMostRecentThreadForProject(projectId, threads);
}

function ProjectTabs(props: {
  projects: ReadonlyArray<Project>;
  openProjects: ReadonlyArray<Project>;
  activeProjectId: ProjectId | null;
  onActivateProject: (projectId: ProjectId) => void;
  onCloseProject: (projectId: ProjectId) => void;
  onCreateProject: () => void;
  onOpenProject: (projectId: ProjectId) => void;
}) {
  const closedProjects = props.projects.filter(
    (project) => !props.openProjects.some((openProject) => openProject.id === project.id),
  );

  return (
    <div
      className={cn(
        "drag-region flex items-end gap-3 overflow-x-auto border-b border-border/70 bg-linear-to-b from-background via-background to-card/85 px-3 pt-3",
        // Reserve space for the OS window controls: traffic lights (left) on
        // macOS/Linux, the overlaid caption buttons (right) on Windows.
        isElectron && (isWindowsDesktop ? "pr-[140px]" : "pl-[92px]"),
      )}
    >
      <div className="flex min-w-0 flex-1 items-end gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {props.openProjects.map((project) => {
          const active = project.id === props.activeProjectId;
          return (
            <div
              key={project.id}
              className={cn(
                "drag-region inline-flex min-w-[10rem] max-w-[15rem] items-center gap-3 rounded-t-[18px] border border-b-0 px-5 py-3 text-base transition-all",
                active
                  ? "relative -mb-px border-border/90 bg-card text-foreground shadow-[0_-1px_0_rgba(255,255,255,0.05)]"
                  : "border-transparent bg-black/16 text-muted-foreground/90 hover:bg-black/24 hover:text-foreground dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
              )}
            >
              <button
                type="button"
                onClick={() => props.onActivateProject(project.id)}
                className={cn(
                  "min-w-0 flex-1 truncate text-left leading-none",
                  active ? "font-semibold" : "font-medium",
                )}
              >
                {project.name}
              </button>
              <button
                type="button"
                className="no-drag rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/8"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onCloseProject(project.id);
                }}
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          );
        })}

        <Menu>
          <MenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="no-drag mb-2 shrink-0 rounded-full border border-border/60 bg-background/70 text-muted-foreground hover:bg-card hover:text-foreground"
              />
            }
          >
            <PlusIcon className="size-4" />
          </MenuTrigger>
          <MenuPopup align="start" side="bottom" className="min-w-56">
            <MenuItem onClick={props.onCreateProject}>Add Project From Folder</MenuItem>
            {closedProjects.length > 0 ? (
              <MenuItem
                disabled
                className="pointer-events-none mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground"
              >
                Reopen Project
              </MenuItem>
            ) : null}
            {closedProjects.length > 0 ? <Separator className="my-1" /> : null}
            {closedProjects.length === 0 ? (
              <MenuItem disabled>All projects already open</MenuItem>
            ) : (
              closedProjects.map((project) => (
                <MenuItem key={project.id} onClick={() => props.onOpenProject(project.id)}>
                  {project.name}
                </MenuItem>
              ))
            )}
          </MenuPopup>
        </Menu>
      </div>
    </div>
  );
}

function ProjectToolBar(props: {
  activeToolId: string;
  availableTools: ReadonlyArray<{ id: string; kind: ProjectToolKind; label: string }>;
  onSelectTool: (toolId: string) => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card/85 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {props.availableTools.map((tool) => {
          const active = tool.id === props.activeToolId;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => props.onSelectTool(tool.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-cyan-500 text-black shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {toolIcon(tool.kind)}
              <span>{tool.label}</span>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 rounded-full"
        onClick={props.onOpenSettings}
      >
        <SettingsIcon className="size-4" />
        Settings
      </Button>
    </div>
  );
}

function AgentsThreadList(props: {
  project: Project;
  threads: ReadonlyArray<Thread>;
  activeThreadId: ThreadId | null;
  onSelectThread: (threadId: ThreadId) => void;
  onCreateThread: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0">
      <div className="flex w-72 shrink-0 flex-col border-r border-border/70 bg-card/40">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Agents
            </div>
            <div className="text-sm font-medium text-foreground">{props.project.name}</div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={props.onCreateThread}>
            <PlusIcon className="size-3.5" />
            Thread
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {props.threads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                No threads yet for this project.
              </div>
            ) : (
              props.threads.map((thread) => {
                const active = props.activeThreadId === thread.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => props.onSelectThread(thread.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent hover:border-border/70 hover:bg-accent/50",
                    )}
                  >
                    <div className="truncate text-sm font-medium text-foreground">
                      {thread.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {thread.modelSelection.provider} · {thread.runtimeMode}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {props.children}
      </div>
    </div>
  );
}

function FallbackCodeTool(props: { project: Project }) {
  const api = readNativeApi();
  const { resolvedTheme } = useTheme();
  const [query, setQuery] = useState("");
  const setCodeFocusedPath = useWorkspaceShellStore((state) => state.setCodeFocusedPath);
  const codeState = useWorkspaceShellStore(
    (state) =>
      state.codeStateByProjectId[props.project.id] ?? { lastFocusedPath: null, navigationNonce: 0 },
  );
  const trimmedQuery = query.trim();
  const focusedRelativePath = codeState.lastFocusedPath;
  const searchEntriesQuery = useQuery(
    projectSearchEntriesQueryOptions({
      cwd: props.project.cwd,
      query,
      enabled: trimmedQuery.length > 0,
    }),
  );
  const focusedFileQuery = useQuery(
    projectReadFileQueryOptions({
      cwd: props.project.cwd,
      relativePath: focusedRelativePath,
      enabled: focusedRelativePath !== null,
    }),
  );

  const focusFilePath = useCallback(
    (relativePath: string | null) => {
      setCodeFocusedPath(props.project.id, relativePath);
    },
    [props.project.id, setCodeFocusedPath],
  );

  const openProjectInEditor = useCallback(async () => {
    if (!api) return;
    await openInPreferredEditor(api, props.project.cwd);
  }, [api, props.project.cwd]);

  const openFileInEditor = useCallback(
    async (relativePath: string) => {
      if (!api) return;
      const targetPath = `${props.project.cwd}/${relativePath}`;
      focusFilePath(relativePath);
      await openInPreferredEditor(api, targetPath);
    },
    [api, focusFilePath, props.project.cwd],
  );

  const previewLines = useMemo(
    () => (focusedFileQuery.data?.contents ?? "").split("\n"),
    [focusedFileQuery.data?.contents],
  );
  const previewMetadata = useMemo(() => {
    const contents = focusedFileQuery.data?.contents ?? "";
    return {
      lineCount: previewLines.length,
      charCount: contents.length,
    };
  }, [focusedFileQuery.data?.contents, previewLines.length]);
  const previewRows = useMemo(
    () =>
      previewLines.map((line, lineIndex) => ({
        id: `${focusedRelativePath ?? "preview"}:${lineIndex + 1}:${line}`,
        number: lineIndex + 1,
        line,
      })),
    [focusedRelativePath, previewLines],
  );
  const previewUnavailable = focusedRelativePath === null;
  const previewErrored = focusedFileQuery.isError;

  return (
    <div className="grid h-full min-h-0 min-w-0 gap-4 p-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <Card className="min-h-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Code Workspace</CardTitle>
          <CardDescription>
            The shell is already persisting file handoff and project-root launch state here. A
            future Code-OSS mount can plug into this same surface without changing the workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" size="sm" onClick={() => void openProjectInEditor()}>
              <FolderSearchIcon className="size-3.5" />
              Open Project
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!focusedRelativePath}
              onClick={() => {
                if (!focusedRelativePath) return;
                void openFileInEditor(focusedRelativePath);
              }}
            >
              <ExternalLinkIcon className="size-3.5" />
              Open Focused File
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">Workspace Root</div>
                <div className="mt-1 break-all text-muted-foreground">{props.project.cwd}</div>
              </div>
              <Badge variant="outline">Nonce {codeState.navigationNonce}</Badge>
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-background/80 p-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Current Handoff
              </div>
              <div className="mt-2 break-all text-sm text-foreground">
                {focusedRelativePath ?? "Waiting for Git or Agents to hand off a file path."}
              </div>
            </div>
          </div>

          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Search files and folders in this project"
            />
          </div>
          <ScrollArea className="min-h-0 flex-1 rounded-xl border border-border/70">
            <div className="space-y-1 p-2">
              {trimmedQuery.length === 0 ? (
                focusedRelativePath ? (
                  <div className="rounded-xl border border-border/60 bg-background/70 p-2">
                    <div className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Last Focused File
                    </div>
                    <div className="flex items-center gap-2 rounded-lg px-2 py-2">
                      <VscodeEntryIcon
                        pathValue={focusedRelativePath}
                        kind="file"
                        theme={resolvedTheme}
                      />
                      <button
                        type="button"
                        onClick={() => focusFilePath(focusedRelativePath)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-medium text-foreground">
                          {basenameOfPath(focusedRelativePath)}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {focusedRelativePath}
                        </div>
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void openFileInEditor(focusedRelativePath)}
                      >
                        <ExternalLinkIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                    Start typing to search the project tree. When Git or Agents hands a file off to
                    Code, it will appear here too.
                  </div>
                )
              ) : searchEntriesQuery.isLoading ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">Searching...</div>
              ) : searchEntriesQuery.data?.entries.length ? (
                searchEntriesQuery.data.entries.map((entry) => (
                  <div
                    key={entry.path}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition-colors",
                      focusedRelativePath === entry.path && entry.kind === "file"
                        ? "border-primary/40 bg-primary/10"
                        : "hover:border-border/70 hover:bg-accent/50",
                    )}
                  >
                    <VscodeEntryIcon
                      pathValue={entry.path}
                      kind={entry.kind}
                      theme={resolvedTheme}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (entry.kind === "file") {
                          focusFilePath(entry.path);
                        }
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-medium text-foreground">
                        {basenameOfPath(entry.path)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{entry.path}</div>
                    </button>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {entry.kind}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void openFileInEditor(entry.path)}
                    >
                      <ExternalLinkIcon className="size-3.5" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  No files matched this query.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="min-h-0 overflow-hidden">
        <CardHeader className="border-b border-border/70">
          {focusedRelativePath ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate">{basenameOfPath(focusedRelativePath)}</CardTitle>
                <CardDescription className="mt-1 truncate">{focusedRelativePath}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{previewMetadata.lineCount} lines</Badge>
                <Badge variant="outline">{previewMetadata.charCount} chars</Badge>
              </div>
            </div>
          ) : (
            <>
              <CardTitle>Editor Host Ready</CardTitle>
              <CardDescription>
                Open the project in your preferred editor, or hand a file off here from Git and
                Agents. This is the shell surface Code-OSS will later replace.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col p-0">
          {previewUnavailable ? (
            <div className="flex h-full min-h-0 flex-col items-start justify-center gap-4 px-8 py-10">
              <Badge variant="outline" className="gap-1.5">
                <WorkflowIcon className="size-3.5" />
                Code Host
              </Badge>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-foreground">
                  Open a file or hand one off
                </h3>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Search the project tree on the left, open the whole repo in your preferred editor,
                  or let Git and Agents target this Code workspace with a persisted file path.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void openProjectInEditor()}>
                  <FolderSearchIcon className="size-3.5" />
                  Open Project
                </Button>
                <Button type="button" variant="outline" onClick={() => setQuery("src")}>
                  <SearchIcon className="size-3.5" />
                  Search Workspace
                </Button>
              </div>
            </div>
          ) : focusedFileQuery.isLoading ? (
            <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
              Loading file preview...
            </div>
          ) : previewErrored ? (
            <div className="flex h-full min-h-0 items-center justify-center px-8 text-sm text-muted-foreground">
              Unable to preview this file here. You can still open it in your preferred editor.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
                <span>Read-only preview</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!focusedRelativePath) return;
                    void openFileInEditor(focusedRelativePath);
                  }}
                >
                  <PencilIcon className="size-3.5" />
                  Open in Editor
                </Button>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="font-mono text-xs">
                  {previewRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[4rem_minmax(0,1fr)] border-b border-border/30 last:border-b-0"
                    >
                      <div className="select-none border-r border-border/40 px-3 py-1.5 text-right text-muted-foreground">
                        {row.number}
                      </div>
                      <pre className="overflow-x-auto px-4 py-1.5 whitespace-pre-wrap break-words text-foreground">
                        {row.line.length > 0 ? row.line : " "}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DesktopCodeTool(props: { project: Project }) {
  const api = readNativeApi();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [codeHostState, setCodeHostState] = useState<DesktopCodeHostState>(
    DEFAULT_DESKTOP_CODE_HOST_STATE,
  );
  const [hostReady, setHostReady] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);
  const codeState = useWorkspaceShellStore(
    (state) =>
      state.codeStateByProjectId[props.project.id] ?? { lastFocusedPath: null, navigationNonce: 0 },
  );
  // Native-chrome state pushed from the embedded workbench through the desktop
  // bridge (the integration extension reports view/panel/scm state over the
  // loopback control channel). Clicks forward allowlisted workbench commands.
  const [chromeState, setChromeState] = useState<CodeChromeState>(DEFAULT_CODE_CHROME_STATE);
  const projectId = props.project.id;
  const runCodeCommand = useCallback(
    (commandId: string) => {
      void window.desktopBridge?.runCodeCommand(projectId, commandId).catch(() => undefined);
    },
    [projectId],
  );
  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge?.onCodeChromeState) {
      return;
    }
    // Only apply state tagged for this project — several editors share the one
    // control channel.
    return bridge.onCodeChromeState((update) => {
      if (update.projectId === projectId) {
        setChromeState(update.state);
      }
    });
  }, [projectId]);

  const openProjectInEditor = useCallback(async () => {
    if (!api) return;
    await openInPreferredEditor(api, props.project.cwd);
  }, [api, props.project.cwd]);
  const shouldUseFallbackTool = !codeHostState.available || hostError !== null;

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge) {
      setCodeHostState(DEFAULT_DESKTOP_CODE_HOST_STATE);
      return;
    }
    let cancelled = false;
    void bridge
      .getCodeHostState()
      .then((state) => {
        if (!cancelled) {
          setCodeHostState(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCodeHostState(DEFAULT_DESKTOP_CODE_HOST_STATE);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge || !codeHostState.available) {
      setHostReady(false);
      return;
    }

    let cancelled = false;
    setHostReady(false);
    setHostError(null);
    void bridge
      .ensureCodeSession({
        projectId: props.project.id,
        workspaceRoot: props.project.cwd,
      })
      .then(() =>
        bridge.activateCodeSession({
          projectId: props.project.id,
        }),
      )
      .then(() => {
        if (!cancelled) {
          setHostReady(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHostReady(false);
          setHostError(
            error instanceof Error
              ? error.message
              : "Failed to start the local Code-OSS runtime for this project.",
          );
        }
      });

    return () => {
      cancelled = true;
      void bridge.hideCodeSession().catch(() => undefined);
    };
  }, [codeHostState.available, props.project.cwd, props.project.id]);

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge || !codeHostState.available || !codeState.lastFocusedPath) {
      return;
    }
    void bridge
      .openCodeFile({
        projectId: props.project.id,
        relativePath: codeState.lastFocusedPath,
        navigationNonce: codeState.navigationNonce,
      })
      .catch(() => undefined);
  }, [
    codeHostState.available,
    codeState.lastFocusedPath,
    codeState.navigationNonce,
    props.project.id,
  ]);

  useEffect(() => {
    const bridge = window.desktopBridge;
    const hostNode = hostRef.current;
    if (!bridge || !codeHostState.available || !hostNode) {
      return;
    }

    let frameId = 0;
    let lastSignature = "";
    const publishBounds = () => {
      frameId = 0;
      const rect = hostNode.getBoundingClientRect();
      const nextBounds = {
        projectId: props.project.id,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
      };
      const signature = [
        nextBounds.projectId,
        Math.round(nextBounds.x),
        Math.round(nextBounds.y),
        Math.round(nextBounds.width),
        Math.round(nextBounds.height),
        nextBounds.visible ? "1" : "0",
      ].join(":");
      if (signature === lastSignature) {
        return;
      }
      lastSignature = signature;
      void bridge.setCodeBounds(nextBounds).catch(() => undefined);
    };
    const scheduleBounds = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(publishBounds);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleBounds();
    });
    resizeObserver.observe(hostNode);
    window.addEventListener("resize", scheduleBounds);
    scheduleBounds();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleBounds);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      void bridge
        .setCodeBounds({
          projectId: props.project.id,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          visible: false,
        })
        .catch(() => undefined);
    };
  }, [codeHostState.available, props.project.id]);

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge || !codeHostState.available) {
      return;
    }

    let suspendedForOverlay = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const syncOverlayVisibility = () => {
      debounceTimer = null;
      const overlayOpen = document.querySelector(CODE_HOST_OVERLAY_SELECTOR) !== null;
      // Guard: only act when the overlay-open state actually changed, so a burst
      // of unrelated DOM mutations during layout settling can't thrash the view
      // by detaching/reattaching it.
      if (overlayOpen === suspendedForOverlay) {
        return;
      }

      suspendedForOverlay = overlayOpen;
      if (overlayOpen) {
        void bridge.hideCodeSession().catch(() => undefined);
        return;
      }

      void bridge
        .activateCodeSession({
          projectId: props.project.id,
        })
        .catch(() => undefined);
    };

    // Debounce 50ms: the MutationObserver fires rapidly while the layout settles;
    // coalesce bursts into a single trailing check (the state-diff guard above
    // then drops no-op transitions).
    const scheduleSync = () => {
      if (debounceTimer !== null) {
        return;
      }
      debounceTimer = setTimeout(syncOverlayVisibility, 50);
    };

    const observer = new MutationObserver(() => {
      scheduleSync();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-open", "data-closed", "hidden", "style", "class"],
    });
    scheduleSync();

    return () => {
      observer.disconnect();
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
    };
  }, [codeHostState.available, props.project.id]);

  if (shouldUseFallbackTool) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
        <div className="border-b border-border/70 bg-card/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                Embedded Code-OSS unavailable
              </div>
              <div className="text-xs text-muted-foreground">
                {getCodeHostUnavailableMessage(hostError ?? codeHostState.reason)}
              </div>
            </div>
            <Button type="button" size="sm" onClick={() => void openProjectInEditor()}>
              <FolderSearchIcon className="size-3.5" />
              Open In Editor
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <FallbackCodeTool project={props.project} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <CodeHeaderBar
        workspaceName={props.project.name}
        activeFilePath={codeState.lastFocusedPath}
        onRunCommand={runCodeCommand}
      />
      <div className="flex min-h-0 min-w-0 flex-1">
        <CodeActivityRail activeViewId={chromeState.activeViewId} onRunCommand={runCodeCommand} />
        {/* The BrowserView is positioned to exactly cover this host node (see the
            ResizeObserver effect above), so leaving it as a flex child inset by
            the rail/header/status bar automatically insets the native view. */}
        <div className="relative min-h-0 min-w-0 flex-1">
          <div ref={hostRef} className="absolute inset-0 min-h-0 min-w-0 bg-background" />
          {!hostReady ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/64 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border/70 bg-background/86 px-5 py-4 shadow-lg backdrop-blur-sm">
                {hostError ?? "Attaching stock Code-OSS for this project…"}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <CodeStatusBar chrome={chromeState} onRunCommand={runCodeCommand} />
    </div>
  );
}

function CodeTool(props: { project: Project }) {
  if (window.desktopBridge) {
    return <DesktopCodeTool project={props.project} />;
  }

  return <FallbackCodeTool project={props.project} />;
}

function readInitialGitWorkspaceMode(): GitWorkspaceMode {
  if (typeof window === "undefined") return "basic";
  const value = window.localStorage.getItem(GIT_WORKSPACE_MODE_STORAGE_KEY);
  return value === "advanced" ? "advanced" : "basic";
}

function emitGitWorkspaceTelemetry(
  event:
    | "git_mode_switched"
    | "git_mode_auto_switched"
    | "git_basic_primary_action_executed"
    | "git_advanced_action_executed"
    | "git_action_cancelled_confirm_dialog"
    | "git_advanced_drawer_opened"
    | "git_terminal_dock_toggled",
  detail?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("tabs:git-telemetry", {
      detail: {
        event,
        ...(detail ?? {}),
      },
    }),
  );
}

function GitTool(props: {
  project: Project;
  activeThreadId: ThreadId | null;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  onOpenAgents: () => void | Promise<void>;
  onCreateAgentsThread: () => void | Promise<void>;
}) {
  const {
    project,
    activeThreadId,
    terminalAvailable,
    terminalOpen,
    onToggleTerminal,
    onOpenAgents,
    onCreateAgentsThread,
  } = props;
  const api = readNativeApi();
  const queryClient = useQueryClient();
  const gitStatusQuery = useQuery(gitStatusQueryOptions(project.cwd));
  const branchesQuery = useQuery(gitBranchesQueryOptions(project.cwd));
  const historyQuery = useQuery(gitHistoryQueryOptions({ cwd: project.cwd, limit: 40 }));
  const stashQuery = useQuery(gitStashListQueryOptions(project.cwd));
  const [branchDraft, setBranchDraft] = useState("");
  const [branchToolsTarget, setBranchToolsTarget] = useState("");
  const [branchToolsSearch, setBranchToolsSearch] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [operationBranch, setOperationBranch] = useState("");
  const [operationBranchSearch, setOperationBranchSearch] = useState("");
  const [upstreamSelection, setUpstreamSelection] = useState("");
  const [upstreamSearch, setUpstreamSearch] = useState("");
  const [stashMessage, setStashMessage] = useState("");
  const [branchManagerOpen, setBranchManagerOpen] = useState(false);
  const [advancedActionsOpen, setAdvancedActionsOpen] = useState(false);
  const [stashPanelOpen, setStashPanelOpen] = useState(false);
  const [gitWorkspaceMode, setGitWorkspaceMode] = useState<GitWorkspaceMode>(() =>
    readInitialGitWorkspaceMode(),
  );
  const [gitTaskInFlight, setGitTaskInFlight] = useState<string | null>(null);
  const [discardAllConfirmOpen, setDiscardAllConfirmOpen] = useState(false);
  const [discardAllConfirmText, setDiscardAllConfirmText] = useState("");
  const [deleteBranchConfirmOpen, setDeleteBranchConfirmOpen] = useState(false);
  const [deleteBranchConfirmText, setDeleteBranchConfirmText] = useState("");
  const [resolverFilePath, setResolverFilePath] = useState<string | null>(null);
  const [resolverMode, setResolverMode] = useState<GitConflictResolverMode>("manual");
  const [resolverDraft, setResolverDraft] = useState("");
  const [resolverDirty, setResolverDirty] = useState(false);
  const [aiConflictState, setAiConflictState] = useState<GitAiConflictState>({
    status: "idle",
    userMessageId: null,
    sourceMessageId: null,
    proposal: null,
    error: null,
  });
  const gitToolState = useWorkspaceShellStore(
    (state) =>
      state.gitStateByProjectId[project.id] ?? { selectedPath: null, selectedCommit: null },
  );
  const selectedPath = gitToolState.selectedPath;
  const selectedCommit = gitToolState.selectedCommit;
  const setSelectedPath = useWorkspaceShellStore((state) => state.setGitSelectedPath);
  const setSelectedCommit = useWorkspaceShellStore((state) => state.setGitSelectedCommit);
  const activeAgentsThread = useStore((state) =>
    activeThreadId ? (state.threads.find((thread) => thread.id === activeThreadId) ?? null) : null,
  );

  const allBranches = useMemo(
    () => branchesQuery.data?.branches ?? [],
    [branchesQuery.data?.branches],
  );
  const activeBranch = branchesQuery.data?.branches.find((branch) => branch.current) ?? null;
  const localBranches = useMemo(
    () => allBranches.filter((branch) => !branch.isRemote),
    [allBranches],
  );
  const remoteBranches = useMemo(
    () => allBranches.filter((branch) => branch.isRemote),
    [allBranches],
  );
  const branchToolOptions = localBranches.map((branch) => branch.name);
  const upstreamOptions = remoteBranches.filter((branch) => deriveRemoteSelectionParts(branch));
  const operationBranchOptions = useMemo(
    () => [
      ...localBranches
        .filter((branch) => !branch.current)
        .map((branch) => ({
          value: branch.name,
          label: branch.name,
          kind: "local" as const,
        })),
      ...remoteBranches
        .filter((branch) => {
          const remote = deriveRemoteSelectionParts(branch);
          return remote !== null && remote.remoteBranch !== "HEAD";
        })
        .map((branch) => ({
          value: branch.name,
          label: branch.name,
          kind: "remote" as const,
        })),
    ],
    [localBranches, remoteBranches],
  );
  const localOperationBranchOptions = operationBranchOptions.filter(
    (branch) => branch.kind === "local",
  );
  const remoteOperationBranchOptions = operationBranchOptions.filter(
    (branch) => branch.kind === "remote",
  );
  const branchToolsSearchQuery = branchToolsSearch.trim().toLowerCase();
  const upstreamSearchQuery = upstreamSearch.trim().toLowerCase();
  const operationBranchSearchQuery = operationBranchSearch.trim().toLowerCase();
  const filteredBranchToolOptions = useMemo(
    () =>
      branchToolOptions.filter((branchName) =>
        branchToolsSearchQuery.length === 0
          ? true
          : branchName.toLowerCase().includes(branchToolsSearchQuery),
      ),
    [branchToolOptions, branchToolsSearchQuery],
  );
  const filteredUpstreamOptions = useMemo(
    () =>
      upstreamOptions.filter((branch) =>
        upstreamSearchQuery.length === 0
          ? true
          : branch.name.toLowerCase().includes(upstreamSearchQuery),
      ),
    [upstreamOptions, upstreamSearchQuery],
  );
  const filteredLocalOperationBranchOptions = useMemo(
    () =>
      localOperationBranchOptions.filter((branch) =>
        operationBranchSearchQuery.length === 0
          ? true
          : branch.label.toLowerCase().includes(operationBranchSearchQuery),
      ),
    [localOperationBranchOptions, operationBranchSearchQuery],
  );
  const filteredRemoteOperationBranchOptions = useMemo(
    () =>
      remoteOperationBranchOptions.filter((branch) =>
        operationBranchSearchQuery.length === 0
          ? true
          : branch.label.toLowerCase().includes(operationBranchSearchQuery),
      ),
    [operationBranchSearchQuery, remoteOperationBranchOptions],
  );
  const changedFiles = gitStatusQuery.data?.workingTree.files ?? [];
  const gitTotals = gitStatusQuery.data?.workingTree ?? null;
  const stagedFiles = gitStatusQuery.data?.staged?.files ?? [];
  const conflictedFiles = useMemo(
    () => gitStatusQuery.data?.conflicted?.files ?? [],
    [gitStatusQuery.data?.conflicted?.files],
  );
  const untrackedFiles = gitStatusQuery.data?.untracked?.files ?? [];
  const unstagedFiles =
    gitStatusQuery.data?.unstaged?.files.filter((file) => !file.conflicted && !file.untracked) ??
    [];
  const branchHeadline = activeBranch?.name ?? gitStatusQuery.data?.branch ?? "Detached HEAD";
  const branchSubline = gitStatusQuery.data?.hasUpstream
    ? `Tracking upstream · Ahead ${gitStatusQuery.data.aheadCount} · Behind ${gitStatusQuery.data.behindCount}`
    : "No upstream configured";
  const currentOperation = gitStatusQuery.data?.operation ?? null;
  const historyCommits = historyQuery.data?.commits ?? [];
  const stashEntries = stashQuery.data?.entries ?? [];
  const activeHistoryCommit = selectedCommit
    ? (historyCommits.find((commit) => commit.sha === selectedCommit) ?? null)
    : null;
  const branchToolsBranch =
    localBranches.find((branch) => branch.name === branchToolsTarget) ?? activeBranch ?? null;
  const selectedUpstreamBranch =
    remoteBranches.find((branch) => branch.name === upstreamSelection) ?? null;
  const activeConflictedFile = resolverFilePath
    ? (conflictedFiles.find((file) => file.path === resolverFilePath) ?? null)
    : null;
  const activeConflictedFileIndex = activeConflictedFile
    ? conflictedFiles.findIndex((file) => file.path === activeConflictedFile.path)
    : -1;
  const totalConflictCount = conflictedFiles.length;
  const diffQuery = useQuery(
    gitDiffQueryOptions({
      cwd: project.cwd,
      path: selectedPath,
      commit: selectedPath ? null : (activeHistoryCommit?.sha ?? null),
    }),
  );
  const conflictSnapshotQuery = useQuery(
    gitConflictSnapshotQueryOptions({
      cwd: project.cwd,
      path: resolverFilePath,
      enabled: resolverFilePath !== null,
    }),
  );
  const conflictFileQuery = useQuery(
    projectReadFileQueryOptions({
      cwd: project.cwd,
      relativePath: resolverFilePath,
      enabled: resolverFilePath !== null,
    }),
  );
  const resolverPatch =
    resolverMode === "ai" && resolverFilePath && aiConflictState.proposal
      ? buildPreviewPatch(
          resolverFilePath,
          conflictFileQuery.data?.contents ?? "",
          aiConflictState.proposal,
        )
      : resolverFilePath && resolverDirty
        ? buildPreviewPatch(resolverFilePath, conflictFileQuery.data?.contents ?? "", resolverDraft)
        : null;
  const selectedWorkingTreeFile = selectedPath
    ? (changedFiles.find((file) => file.path === selectedPath) ?? null)
    : null;
  const selectedPatchFile = useMemo(
    () => resolveSelectedPatchFile(diffQuery.data?.patch, selectedPath, `git-shell:${project.id}`),
    [diffQuery.data?.patch, project.id, selectedPath],
  );
  const selectedPatchHunks = selectedPatchFile?.hunks ?? [];
  const hunkActionState = useMemo(
    () => resolveGitHunkActionModes(selectedWorkingTreeFile),
    [selectedWorkingTreeFile],
  );

  useEffect(() => {
    if (operationBranchOptions.length === 0) {
      if (operationBranch.length > 0) {
        setOperationBranch("");
      }
      return;
    }
    if (!operationBranchOptions.some((branch) => branch.value === operationBranch)) {
      setOperationBranch(operationBranchOptions[0]?.value ?? "");
    }
  }, [operationBranch, operationBranchOptions]);

  useEffect(() => {
    if (branchToolOptions.length === 0) {
      if (branchToolsTarget.length > 0) {
        setBranchToolsTarget("");
      }
      return;
    }
    if (!branchToolOptions.includes(branchToolsTarget)) {
      setBranchToolsTarget(activeBranch?.name ?? branchToolOptions[0] ?? "");
    }
  }, [activeBranch?.name, branchToolOptions, branchToolsTarget]);

  useEffect(() => {
    setRenameDraft(branchToolsTarget);
  }, [branchToolsTarget]);

  useEffect(() => {
    if (upstreamOptions.length === 0) {
      if (upstreamSelection.length > 0) {
        setUpstreamSelection("");
      }
      return;
    }
    const targetLocalName = branchToolsTarget.trim();
    const matchingRemote =
      targetLocalName.length > 0
        ? upstreamOptions.find((branch) => {
            const remote = deriveRemoteSelectionParts(branch);
            return remote?.remoteBranch === targetLocalName;
          })
        : null;
    const preferredSelection = matchingRemote?.name ?? upstreamOptions[0]?.name ?? "";
    if (!upstreamOptions.some((branch) => branch.name === upstreamSelection)) {
      setUpstreamSelection(preferredSelection);
    }
  }, [branchToolsTarget, upstreamOptions, upstreamSelection]);

  useEffect(() => {
    if (!resolverFilePath) {
      setResolverDraft("");
      setResolverDirty(false);
      setAiConflictState({
        status: "idle",
        userMessageId: null,
        sourceMessageId: null,
        proposal: null,
        error: null,
      });
      return;
    }
    if (conflictFileQuery.data?.relativePath !== resolverFilePath) {
      return;
    }
    setResolverDraft(conflictFileQuery.data.contents);
    setResolverDirty(false);
  }, [conflictFileQuery.data, resolverFilePath]);

  useEffect(() => {
    if (
      resolverMode !== "ai" ||
      aiConflictState.status !== "waiting" ||
      !activeAgentsThread ||
      !aiConflictState.userMessageId
    ) {
      return;
    }

    const requestIndex = activeAgentsThread.messages.findIndex(
      (message) => message.id === aiConflictState.userMessageId,
    );
    if (requestIndex < 0) {
      return;
    }

    const proposalMessage =
      activeAgentsThread.messages
        .slice(requestIndex + 1)
        .find(
          (message) => message.role === "assistant" && !message.streaming && message.text.trim(),
        ) ?? null;
    if (!proposalMessage) {
      return;
    }

    const proposal = extractFirstCodeFence(proposalMessage.text) ?? proposalMessage.text.trim();
    setAiConflictState({
      status: "ready",
      userMessageId: aiConflictState.userMessageId,
      sourceMessageId: proposalMessage.id,
      proposal,
      error: null,
    });
  }, [activeAgentsThread, aiConflictState, resolverMode]);

  const branchCreateMutation = useMutation({
    mutationFn: async (branchName: string) => {
      if (!api) throw new Error("Git API unavailable.");
      await api.git.createBranch({ cwd: project.cwd, branch: branchName });
      return branchName;
    },
    onSuccess: async (branchName) => {
      setBranchDraft("");
      await queryClient.invalidateQueries({ queryKey: ["git"] });
      toastManager.add({
        type: "success",
        title: `Created branch "${branchName}"`,
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not create branch",
        description: toGitUserFacingErrorMessage(error),
      });
    },
  });

  const branchRenameMutation = useMutation({
    mutationFn: async (input: { oldBranch: string; newBranch: string }) => {
      if (!api) throw new Error("Git API unavailable.");
      return api.git.renameBranch({
        cwd: project.cwd,
        oldBranch: input.oldBranch,
        newBranch: input.newBranch,
      });
    },
    onSuccess: async (result, input) => {
      setBranchToolsTarget(result.branch);
      setRenameDraft(result.branch);
      await queryClient.invalidateQueries({ queryKey: ["git"] });
      toastManager.add({
        type: "success",
        title: `Renamed ${input.oldBranch} to ${result.branch}`,
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not rename branch",
        description: toGitUserFacingErrorMessage(error),
      });
    },
  });

  const branchDeleteMutation = useMutation({
    mutationFn: async (input: { branch: string; force?: boolean }) => {
      if (!api) throw new Error("Git API unavailable.");
      await api.git.deleteBranch({ cwd: project.cwd, branch: input.branch, force: input.force });
      return input.branch;
    },
    onSuccess: async (branchName) => {
      if (branchToolsTarget === branchName) {
        const fallbackBranch =
          localBranches.find((branch) => branch.current)?.name ??
          localBranches.find((branch) => branch.name !== branchName)?.name ??
          "";
        setBranchToolsTarget(fallbackBranch);
      }
      await queryClient.invalidateQueries({ queryKey: ["git"] });
      toastManager.add({
        type: "success",
        title: `Deleted ${branchName}`,
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not delete branch",
        description: toGitUserFacingErrorMessage(error),
      });
    },
  });

  const branchUpstreamMutation = useMutation({
    mutationFn: async (input: { branch: string; remoteName: string; remoteBranch: string }) => {
      if (!api) throw new Error("Git API unavailable.");
      await api.git.setBranchUpstream({
        cwd: project.cwd,
        branch: input.branch,
        remoteName: input.remoteName,
        remoteBranch: input.remoteBranch,
      });
      return input;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["git"] });
      toastManager.add({
        type: "success",
        title: `Tracking ${result.remoteName}/${result.remoteBranch}`,
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not set upstream",
        description: toGitUserFacingErrorMessage(error),
      });
    },
  });

  const invalidateGit = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["git"] });
  }, [queryClient]);

  const runGitTask = useCallback(
    async (input: {
      id: string;
      title: string;
      task: () => Promise<void>;
      successTitle?: string;
      onSuccess?: () => void;
      invalidateOnError?: boolean;
    }) => {
      setGitTaskInFlight(input.id);
      try {
        await input.task();
        await invalidateGit();
        input.onSuccess?.();
        if (input.successTitle) {
          toastManager.add({
            type: "success",
            title: input.successTitle,
          });
        }
      } catch (error) {
        if (input.invalidateOnError) {
          await invalidateGit();
        }
        toastManager.add({
          type: "error",
          title: input.title,
          description: toGitUserFacingErrorMessage(error),
        });
      } finally {
        setGitTaskInFlight(null);
      }
    },
    [invalidateGit],
  );

  const branchCheckoutMutation = useMutation({
    mutationFn: async (branchName: string) => {
      if (!api) throw new Error("Git API unavailable.");
      await api.git.checkout({ cwd: project.cwd, branch: branchName });
      return branchName;
    },
    onSuccess: async (branchName) => {
      await queryClient.invalidateQueries({ queryKey: ["git"] });
      toastManager.add({
        type: "success",
        title: `Checked out "${branchName}"`,
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not switch branch",
        description: toGitUserFacingErrorMessage(error),
      });
    },
  });

  const openFileInEditor = useCallback(
    async (relativePath: string) => {
      if (!api) return;
      await openInPreferredEditor(api, `${project.cwd}/${relativePath}`);
    },
    [api, project.cwd],
  );

  const selectWorkingTreeFile = useCallback(
    (filePath: string) => {
      setResolverFilePath(null);
      setResolverDirty(false);
      setAiConflictState({
        status: "idle",
        userMessageId: null,
        sourceMessageId: null,
        proposal: null,
        error: null,
      });
      setSelectedCommit(project.id, null);
      setSelectedPath(project.id, selectedPath === filePath ? null : filePath);
    },
    [project.id, selectedPath, setSelectedCommit, setSelectedPath],
  );

  const openConflictResolver = useCallback(
    (filePath: string, mode: GitConflictResolverMode) => {
      setSelectedCommit(project.id, null);
      setSelectedPath(project.id, filePath);
      setResolverMode(mode);
      setResolverFilePath(filePath);
      setAiConflictState({
        status: "idle",
        userMessageId: null,
        sourceMessageId: null,
        proposal: null,
        error: null,
      });
    },
    [project.id, setSelectedCommit, setSelectedPath],
  );

  const closeConflictResolver = useCallback(() => {
    setResolverFilePath(null);
    setResolverDirty(false);
    setAiConflictState({
      status: "idle",
      userMessageId: null,
      sourceMessageId: null,
      proposal: null,
      error: null,
    });
  }, []);

  const navigateConflictResolver = useCallback(
    (direction: -1 | 1) => {
      if (conflictedFiles.length <= 1 || activeConflictedFileIndex < 0) return;
      const nextIndex =
        (activeConflictedFileIndex + direction + conflictedFiles.length) % conflictedFiles.length;
      const nextFile = conflictedFiles[nextIndex];
      if (!nextFile) return;
      openConflictResolver(nextFile.path, resolverMode);
    },
    [activeConflictedFileIndex, conflictedFiles, openConflictResolver, resolverMode],
  );

  const handleStageFile = useCallback(
    (file: GitStatusFile) => {
      if (!api) return;
      void runGitTask({
        id: `stage:${file.path}`,
        title: "Could not stage file",
        successTitle: `Staged ${basenameOfPath(file.path)}`,
        task: () => api.git.stageFiles({ cwd: project.cwd, paths: [file.path] }),
      });
    },
    [api, project.cwd, runGitTask],
  );

  const handleUnstageFile = useCallback(
    (file: GitStatusFile) => {
      if (!api) return;
      void runGitTask({
        id: `unstage:${file.path}`,
        title: "Could not unstage file",
        successTitle: `Unstaged ${basenameOfPath(file.path)}`,
        task: () => api.git.unstageFiles({ cwd: project.cwd, paths: [file.path] }),
      });
    },
    [api, project.cwd, runGitTask],
  );

  const handleDiscardFile = useCallback(
    async (file: GitStatusFile) => {
      if (!api) return;
      const confirmed = await api.dialogs.confirm(
        `Discard changes for ${file.path}? This cannot be undone.`,
      );
      if (!confirmed) return;
      void runGitTask({
        id: `discard:${file.path}`,
        title: "Could not discard file changes",
        successTitle: `Discarded changes in ${basenameOfPath(file.path)}`,
        onSuccess: () => {
          if (selectedPath === file.path) {
            setSelectedPath(project.id, null);
          }
        },
        task: () =>
          api.git.discardChanges({
            cwd: project.cwd,
            paths: [file.path],
            discardStaged: file.staged ?? false,
            discardUnstaged: file.unstaged ?? false,
            discardUntracked: file.untracked ?? false,
          }),
      });
    },
    [api, project.cwd, project.id, runGitTask, selectedPath, setSelectedPath],
  );

  const handleApplyHunk = useCallback(
    (hunk: Hunk, mode: GitApplyHunkMode) => {
      if (!api || !selectedPath || !selectedPatchFile) return;
      const patch = buildSingleHunkPatch(selectedPatchFile, hunk);
      const verb = mode === "stage" ? "Staged" : mode === "unstage" ? "Unstaged" : "Discarded";
      void runGitTask({
        id: `hunk:${mode}:${selectedPath}:${hunk.hunkSpecs ?? hunk.additionStart}`,
        title:
          mode === "stage"
            ? "Could not stage hunk"
            : mode === "unstage"
              ? "Could not unstage hunk"
              : "Could not discard hunk",
        successTitle: `${verb} hunk in ${basenameOfPath(selectedPath)}`,
        task: () =>
          api.git.applyHunk({
            cwd: project.cwd,
            path: selectedPath,
            patch,
            mode,
          }),
      });
    },
    [api, project.cwd, runGitTask, selectedPatchFile, selectedPath],
  );

  const executeDiscardAll = useCallback(() => {
    if (!api) return;
    emitGitWorkspaceTelemetry("git_advanced_action_executed", { action: "discard_all" });
    void runGitTask({
      id: "discard:all",
      title: "Could not discard all changes",
      successTitle: "Discarded all local changes",
      onSuccess: () => setSelectedPath(project.id, null),
      task: () =>
        api.git.discardChanges({
          cwd: project.cwd,
          discardStaged: true,
          discardUnstaged: true,
          discardUntracked: true,
        }),
    });
  }, [api, project.cwd, project.id, runGitTask, setSelectedPath]);

  const handleDiscardAll = useCallback(() => {
    setDiscardAllConfirmText("");
    setDiscardAllConfirmOpen(true);
  }, []);

  const handleFetchLatest = useCallback(() => {
    if (!api) return;
    void runGitTask({
      id: "fetch:latest",
      title: "Could not fetch latest changes",
      successTitle: "Fetched latest remote changes",
      task: () => api.git.fetch({ cwd: project.cwd }),
    });
  }, [api, project.cwd, runGitTask]);

  const handlePullLatest = useCallback(() => {
    if (!api) return;
    void runGitTask({
      id: "pull:latest",
      title: "Could not pull latest changes",
      successTitle: "Pulled latest changes",
      invalidateOnError: true,
      task: () => api.git.pull({ cwd: project.cwd }).then(() => undefined),
    });
  }, [api, project.cwd, runGitTask]);

  const handlePushCurrentBranch = useCallback(() => {
    if (!api) return;
    void runGitTask({
      id: "push:current",
      title: "Could not push branch",
      successTitle: `Pushed ${branchHeadline}`,
      invalidateOnError: true,
      task: () => api.git.push({ cwd: project.cwd }).then(() => undefined),
    });
  }, [api, branchHeadline, project.cwd, runGitTask]);

  const handleSaveStash = useCallback(() => {
    if (!api) return;
    emitGitWorkspaceTelemetry("git_advanced_action_executed", { action: "stash_save" });
    void runGitTask({
      id: "stash:save",
      title: "Could not create stash",
      successTitle: "Saved stash",
      onSuccess: () => setStashMessage(""),
      task: () =>
        api.git.saveStash({
          cwd: project.cwd,
          ...(stashMessage.trim().length > 0 ? { message: stashMessage.trim() } : {}),
          includeUntracked: true,
        }),
    });
  }, [api, project.cwd, runGitTask, stashMessage]);

  const handleRenameBranch = useCallback(() => {
    const oldBranch = branchToolsBranch?.name ?? "";
    const newBranch = renameDraft.trim();
    if (!oldBranch || !newBranch || oldBranch === newBranch) return;
    branchRenameMutation.mutate({ oldBranch, newBranch });
  }, [branchRenameMutation, branchToolsBranch?.name, renameDraft]);

  const executeDeleteBranch = useCallback(() => {
    if (!branchToolsBranch || branchToolsBranch.current) return;
    emitGitWorkspaceTelemetry("git_advanced_action_executed", {
      action: "delete_branch",
      branch: branchToolsBranch.name,
    });
    branchDeleteMutation.mutate({ branch: branchToolsBranch.name, force: true });
  }, [branchDeleteMutation, branchToolsBranch]);

  const handleDeleteBranch = useCallback(() => {
    if (!branchToolsBranch || branchToolsBranch.current) return;
    setDeleteBranchConfirmText("");
    setDeleteBranchConfirmOpen(true);
  }, [branchToolsBranch]);

  const handleSetUpstream = useCallback(() => {
    if (!branchToolsBranch || !selectedUpstreamBranch) return;
    const parts = deriveRemoteSelectionParts(selectedUpstreamBranch);
    if (!parts) return;
    branchUpstreamMutation.mutate({
      branch: branchToolsBranch.name,
      remoteName: parts.remoteName,
      remoteBranch: parts.remoteBranch,
    });
  }, [branchToolsBranch, branchUpstreamMutation, selectedUpstreamBranch]);

  const handleApplyStash = useCallback(
    (stashRef: string, pop: boolean) => {
      if (!api) return;
      void runGitTask({
        id: `${pop ? "stash:pop" : "stash:apply"}:${stashRef}`,
        title: pop ? "Could not pop stash" : "Could not apply stash",
        successTitle: pop ? `Popped ${stashRef}` : `Applied ${stashRef}`,
        task: () => api.git.applyStash({ cwd: project.cwd, stashRef, pop }),
      });
    },
    [api, project.cwd, runGitTask],
  );

  const handleDropStash = useCallback(
    async (stashRef: string) => {
      if (!api) return;
      const confirmed = await api.dialogs.confirm(`Drop ${stashRef}? This cannot be undone.`);
      if (!confirmed) return;
      void runGitTask({
        id: `stash:drop:${stashRef}`,
        title: "Could not drop stash",
        successTitle: `Dropped ${stashRef}`,
        task: () => api.git.dropStash({ cwd: project.cwd, stashRef }),
      });
    },
    [api, project.cwd, runGitTask],
  );

  const handleResolveConflictSide = useCallback(
    async (file: GitStatusFile, side: "ours" | "theirs") => {
      if (!api) return;
      const confirmed = await api.dialogs.confirm(
        `Use ${side} for ${file.path}? This will replace the conflicted file contents and mark it resolved.`,
      );
      if (!confirmed) return;
      void runGitTask({
        id: `conflict:${side}:${file.path}`,
        title: `Could not use ${side} version`,
        successTitle: `Resolved ${basenameOfPath(file.path)} with ${side}`,
        task: () =>
          api.git.resolveConflict({
            cwd: project.cwd,
            path: file.path,
            side,
          }),
      });
    },
    [api, project.cwd, runGitTask],
  );

  const handleSaveResolverDraft = useCallback(
    async (markResolved: boolean) => {
      if (!api || !resolverFilePath) return;
      const trimmedPath = resolverFilePath;
      void runGitTask({
        id: markResolved ? `resolver:save-stage:${trimmedPath}` : `resolver:save:${trimmedPath}`,
        title: markResolved ? "Could not save and mark resolved" : "Could not save conflict draft",
        successTitle: markResolved
          ? `Saved and marked ${basenameOfPath(trimmedPath)} resolved`
          : `Saved ${basenameOfPath(trimmedPath)}`,
        task: async () => {
          await api.projects.writeFile({
            cwd: project.cwd,
            relativePath: trimmedPath,
            contents: resolverDraft,
          });
          if (markResolved) {
            await api.git.stageFiles({ cwd: project.cwd, paths: [trimmedPath] });
          }
        },
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: ["projects", "read-file", project.cwd, trimmedPath],
          });
          setResolverDirty(false);
          if (markResolved) {
            setResolverFilePath(null);
          }
        },
      });
    },
    [api, project.cwd, queryClient, resolverDraft, resolverFilePath, runGitTask],
  );

  const handleGenerateAiConflictFix = useCallback(async () => {
    if (!api || !resolverFilePath || !activeAgentsThread) {
      toastManager.add({
        type: "error",
        title: "AI conflict fix unavailable",
        description:
          "Open or create an Agents thread for this project before requesting an AI fix.",
      });
      return;
    }
    if (!conflictFileQuery.data) {
      toastManager.add({
        type: "error",
        title: "AI conflict fix unavailable",
        description: "The conflicted file is still loading.",
      });
      return;
    }

    const commandId = newCommandId();
    const messageId = MessageId.makeUnsafe(randomUUID());
    const createdAt = new Date().toISOString();
    const prompt = buildConflictFixPrompt({
      projectPath: project.cwd,
      relativePath: resolverFilePath,
      contents: conflictFileQuery.data.contents,
    });

    setAiConflictState({
      status: "sending",
      userMessageId: messageId,
      sourceMessageId: null,
      proposal: null,
      error: null,
    });

    try {
      await api.orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId,
        threadId: activeAgentsThread.id,
        message: {
          messageId,
          role: "user",
          text: prompt,
          attachments: [],
        },
        modelSelection: activeAgentsThread.modelSelection,
        runtimeMode: activeAgentsThread.runtimeMode,
        interactionMode: activeAgentsThread.interactionMode,
        createdAt,
      });
      setAiConflictState({
        status: "waiting",
        userMessageId: messageId,
        sourceMessageId: null,
        proposal: null,
        error: null,
      });
      toastManager.add({
        type: "success",
        title: "Sent conflict to Agents",
        description: "Waiting for an AI resolution proposal.",
      });
    } catch (error) {
      setAiConflictState({
        status: "error",
        userMessageId: messageId,
        sourceMessageId: null,
        proposal: null,
        error: error instanceof Error ? error.message : String(error),
      });
      toastManager.add({
        type: "error",
        title: "Could not request AI conflict fix",
        description: toGitUserFacingErrorMessage(error),
      });
    }
  }, [activeAgentsThread, api, conflictFileQuery.data, project.cwd, resolverFilePath]);

  const handleAcceptAiConflictFix = useCallback(() => {
    if (!aiConflictState.proposal || !resolverFilePath) return;
    setResolverDraft(aiConflictState.proposal);
    setResolverDirty(true);
    setResolverMode("manual");
    toastManager.add({
      type: "success",
      title: "AI proposal loaded",
      description: "Review the proposed resolution, then save and mark it resolved.",
    });
  }, [aiConflictState.proposal, resolverFilePath]);

  const handleRejectAiConflictFix = useCallback(() => {
    setAiConflictState((current) => ({
      ...current,
      status: "idle",
      sourceMessageId: null,
      proposal: null,
      error: null,
    }));
  }, []);

  const handleStartMerge = useCallback(() => {
    if (!api || operationBranch.trim().length === 0) return;
    emitGitWorkspaceTelemetry("git_advanced_action_executed", {
      action: "start_merge",
      branch: operationBranch,
    });
    void runGitTask({
      id: `merge:${operationBranch}`,
      title: "Could not start merge",
      successTitle: `Merged ${operationBranch}`,
      invalidateOnError: true,
      task: () => api.git.merge({ cwd: project.cwd, branch: operationBranch }),
    });
  }, [api, operationBranch, project.cwd, runGitTask]);

  const handleStartRebase = useCallback(() => {
    if (!api || operationBranch.trim().length === 0) return;
    emitGitWorkspaceTelemetry("git_advanced_action_executed", {
      action: "start_rebase",
      branch: operationBranch,
    });
    void runGitTask({
      id: `rebase:${operationBranch}`,
      title: "Could not start rebase",
      successTitle: `Rebased onto ${operationBranch}`,
      invalidateOnError: true,
      task: () => api.git.rebase({ cwd: project.cwd, branch: operationBranch }),
    });
  }, [api, operationBranch, project.cwd, runGitTask]);

  const handleContinueOperation = useCallback(() => {
    if (!api || !currentOperation) return;
    void runGitTask({
      id: `continue:${currentOperation.kind}`,
      title: `Could not continue ${currentOperation.kind}`,
      successTitle: `Continued ${currentOperation.kind}`,
      invalidateOnError: true,
      task: () =>
        api.git.continueOperation({
          cwd: project.cwd,
          kind: currentOperation.kind,
        }),
    });
  }, [api, currentOperation, project.cwd, runGitTask]);

  const handleAbortOperation = useCallback(async () => {
    if (!api || !currentOperation) return;
    const confirmed = await api.dialogs.confirm(
      `Abort the current ${currentOperation.kind}? Any in-progress merge/rebase state will be discarded.`,
    );
    if (!confirmed) return;
    void runGitTask({
      id: `abort:${currentOperation.kind}`,
      title: `Could not abort ${currentOperation.kind}`,
      successTitle: `Aborted ${currentOperation.kind}`,
      invalidateOnError: true,
      task: () =>
        api.git.abortOperation({
          cwd: project.cwd,
          kind: currentOperation.kind,
        }),
    });
  }, [api, currentOperation, project.cwd, runGitTask]);

  const handleSkipRebase = useCallback(() => {
    if (!api || currentOperation?.kind !== "rebase") return;
    void runGitTask({
      id: "rebase:skip",
      title: "Could not skip rebase step",
      successTitle: "Skipped current rebase step",
      invalidateOnError: true,
      task: () => api.git.skipRebase({ cwd: project.cwd }),
    });
  }, [api, currentOperation, project.cwd, runGitTask]);

  const branchToolsBusy =
    gitTaskInFlight !== null ||
    branchRenameMutation.isPending ||
    branchDeleteMutation.isPending ||
    branchUpstreamMutation.isPending;
  const syncActionsDisabled =
    gitTaskInFlight !== null || currentOperation !== null || conflictedFiles.length > 0;
  const hasWorkingTreeChanges = changedFiles.length > 0;
  const hasBlockingConflicts = conflictedFiles.length > 0;
  const hasDetachedHead = gitStatusQuery.data?.branch === null;
  const detachedHeadBlockedBasic =
    hasDetachedHead && stagedFiles.length === 0 && !hasWorkingTreeChanges;
  const blockingSwitchReason: GitWorkspaceSwitchReason | null =
    currentOperation !== null
      ? "active_operation"
      : hasBlockingConflicts
        ? "conflicts"
        : detachedHeadBlockedBasic
          ? "detached_head_blocked"
          : null;
  const syncSummary = gitStatusQuery.data?.hasUpstream
    ? `Ahead ${gitStatusQuery.data.aheadCount} · Behind ${gitStatusQuery.data.behindCount}`
    : "No upstream";
  const diffSummary = `+${gitTotals?.insertions ?? 0} / -${gitTotals?.deletions ?? 0}`;
  const overviewSection = getGitWorkspaceLayoutSection("overview");
  const changesSection = getGitWorkspaceLayoutSection("changes");
  const diffSection = getGitWorkspaceLayoutSection("diff");
  const branchesSection = getGitWorkspaceLayoutSection("branches");
  const advancedActionsSection = getGitWorkspaceLayoutSection("advanced-actions");
  const historySection = getGitWorkspaceLayoutSection("history");
  const stashesSection = getGitWorkspaceLayoutSection("stashes");
  const isBasicMode = gitWorkspaceMode === "basic";

  useEffect(() => {
    window.localStorage.setItem(GIT_WORKSPACE_MODE_STORAGE_KEY, gitWorkspaceMode);
  }, [gitWorkspaceMode]);

  useEffect(() => {
    if (gitWorkspaceMode !== "basic" || !blockingSwitchReason) return;
    setGitWorkspaceMode("advanced");
    emitGitWorkspaceTelemetry("git_mode_auto_switched", { reason: blockingSwitchReason });
  }, [blockingSwitchReason, gitWorkspaceMode]);

  const handleWorkspaceModeChange = useCallback((mode: GitWorkspaceMode) => {
    setGitWorkspaceMode(mode);
    emitGitWorkspaceTelemetry("git_mode_switched", { mode });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (event.altKey && event.key === "1") {
        event.preventDefault();
        handleWorkspaceModeChange("basic");
        return;
      }
      if (event.altKey && event.key === "2") {
        event.preventDefault();
        handleWorkspaceModeChange("advanced");
        return;
      }
      if (!isBasicMode) return;

      if (event.key === "]") {
        event.preventDefault();
        if (changedFiles.length === 0) return;
        const selectedIndex = changedFiles.findIndex((file) => file.path === selectedPath);
        const nextIndex = selectedIndex < 0 ? 0 : (selectedIndex + 1) % changedFiles.length;
        const next = changedFiles[nextIndex];
        if (next) {
          selectWorkingTreeFile(next.path);
        }
        return;
      }
      if (event.key === "[") {
        event.preventDefault();
        if (changedFiles.length === 0) return;
        const selectedIndex = changedFiles.findIndex((file) => file.path === selectedPath);
        const nextIndex =
          selectedIndex < 0
            ? Math.max(0, changedFiles.length - 1)
            : (selectedIndex - 1 + changedFiles.length) % changedFiles.length;
        const next = changedFiles[nextIndex];
        if (next) {
          selectWorkingTreeFile(next.path);
        }
        return;
      }
      if (event.key.toLowerCase() === "s" && selectedWorkingTreeFile?.unstaged) {
        event.preventDefault();
        handleStageFile(selectedWorkingTreeFile);
        return;
      }
      if (event.key.toLowerCase() === "u" && selectedWorkingTreeFile?.staged) {
        event.preventDefault();
        handleUnstageFile(selectedWorkingTreeFile);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    changedFiles,
    handleStageFile,
    handleUnstageFile,
    handleWorkspaceModeChange,
    isBasicMode,
    selectWorkingTreeFile,
    selectedPath,
    selectedWorkingTreeFile,
  ]);

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-cols-1 content-start gap-6 overflow-x-hidden overflow-y-auto px-6 py-8 max-w-[1700px] mx-auto">
      <div className="flex flex-col min-h-0 min-w-0 gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <GitBranchIcon className="size-6 text-primary" />
              Git Workspace
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your repository, commit changes, and sync with remotes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-full shadow-sm"
              onClick={() => {
                emitGitWorkspaceTelemetry("git_terminal_dock_toggled", {
                  open: !terminalOpen,
                });
                onToggleTerminal();
              }}
              disabled={!terminalAvailable}
            >
              {terminalOpen ? "Hide Terminal" : "Show Terminal"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-full shadow-sm"
              onClick={() => {
                const nextMode = isBasicMode ? "advanced" : "basic";
                if (nextMode === "advanced") {
                  emitGitWorkspaceTelemetry("git_advanced_drawer_opened");
                }
                handleWorkspaceModeChange(nextMode);
              }}
            >
              {isBasicMode ? "Advanced" : "Close Advanced"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl border border-border/40 bg-background/50 backdrop-blur-xl shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Current Branch
              </div>
              {gitStatusQuery.data?.pr ? (
                <Badge size="sm" variant="outline" className="shadow-none text-[10px] py-0 h-5">
                  PR #{gitStatusQuery.data.pr.number}
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-1 text-xl font-semibold text-foreground truncate">
              {branchHeadline}
            </h2>
            <div className="mt-1 text-xs text-muted-foreground truncate">{branchSubline}</div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 border-r border-border/40 pr-4 mr-1">
              <span
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded-md",
                  stagedFiles.length > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                {stagedFiles.length} staged
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded-md",
                  hasWorkingTreeChanges
                    ? "bg-amber-500/10 text-amber-500"
                    : "text-muted-foreground",
                )}
              >
                {changedFiles.length} changed
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded-md",
                  hasBlockingConflicts
                    ? "bg-destructive/10 text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {conflictedFiles.length} conflicts
              </span>
              <span className="text-xs font-medium px-2 py-1 rounded-md text-muted-foreground">
                ↑ {gitStatusQuery.data?.aheadCount ?? 0}
              </span>
              <span className="text-xs font-medium px-2 py-1 rounded-md text-muted-foreground">
                ↓ {gitStatusQuery.data?.behindCount ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-full shadow-sm"
                disabled={syncActionsDisabled}
                onClick={handleFetchLatest}
              >
                Fetch
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full bg-background"
                disabled={syncActionsDisabled}
                onClick={handlePullLatest}
              >
                Pull
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full bg-background"
                disabled={syncActionsDisabled}
                onClick={handlePushCurrentBranch}
              >
                Push
              </Button>
            </div>
          </div>
        </div>

        {currentOperation ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {currentOperation.kind === "merge" ? "Merge in progress" : "Rebase in progress"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {currentOperation.status === "conflicted"
                    ? `Resolve the ${conflictedFiles.length} conflicted file${conflictedFiles.length === 1 ? "" : "s"}, then continue or abort.`
                    : "Git is waiting for the next step. Continue when the working tree is ready."}
                </div>
              </div>
              <Badge
                size="sm"
                variant={currentOperation.status === "conflicted" ? "error" : "secondary"}
                className="shadow-none"
              >
                {currentOperation.status === "conflicted" ? "Needs attention" : "In progress"}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={gitTaskInFlight !== null}
                onClick={handleContinueOperation}
              >
                Continue
              </Button>
              {currentOperation.kind === "rebase" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={gitTaskInFlight !== null}
                  onClick={handleSkipRebase}
                >
                  Skip
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full text-destructive hover:text-destructive"
                disabled={gitTaskInFlight !== null}
                onClick={() => void handleAbortOperation()}
              >
                Abort
              </Button>
            </div>
          </div>
        ) : null}

        <GitCommitComposer
          gitCwd={project.cwd}
          activeThreadId={activeThreadId}
          gitStatus={gitStatusQuery.data ?? null}
          branchList={branchesQuery.data ?? null}
          stagedFiles={stagedFiles}
          externalBusy={gitTaskInFlight !== null}
          workspaceMode={gitWorkspaceMode}
        />

        <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-2xl border border-border/40 bg-background/50 backdrop-blur-xl shadow-sm p-5">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-border/40 pb-4 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {changesSection.title}
                </h3>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {changesSection.description}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {conflictedFiles.length > 0 && (
                  <Badge size="sm" variant="error" className="shadow-none">
                    {conflictedFiles.length} conflicts
                  </Badge>
                )}
                {untrackedFiles.length > 0 && (
                  <Badge size="sm" variant="outline" className="shadow-none">
                    {untrackedFiles.length} untracked
                  </Badge>
                )}
                {unstagedFiles.length > 0 && (
                  <Badge size="sm" variant="outline" className="shadow-none">
                    {unstagedFiles.length} unstaged
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <GitChangeSection
                title="Conflicts"
                description="Files blocked by merge or rebase conflicts."
                files={conflictedFiles}
                selectedPath={selectedPath}
                emptyLabel="No conflicts."
                selectLabel="Resolve"
                actionDisabled={gitTaskInFlight !== null}
                onSelectFile={selectWorkingTreeFile}
                onResolveFile={(file) => openConflictResolver(file.path, "manual")}
                onFixWithAi={(file) => openConflictResolver(file.path, "ai")}
                onOpenFile={openFileInEditor}
                onStageFile={handleStageFile}
                onUseOurs={(file) => void handleResolveConflictSide(file, "ours")}
                onUseTheirs={(file) => void handleResolveConflictSide(file, "theirs")}
                onDiscardFile={handleDiscardFile}
              />
              <GitChangeSection
                title="Staged"
                description="Included in the next commit."
                files={stagedFiles}
                selectedPath={selectedPath}
                emptyLabel="Nothing staged."
                selectLabel="Review"
                actionDisabled={gitTaskInFlight !== null}
                onSelectFile={selectWorkingTreeFile}
                onUnstageFile={handleUnstageFile}
                onDiscardFile={handleDiscardFile}
              />
              <GitChangeSection
                title="Unstaged"
                description="Modified files not yet added to the index."
                files={unstagedFiles}
                selectedPath={selectedPath}
                emptyLabel="No unstaged tracked files."
                selectLabel="Review"
                actionDisabled={gitTaskInFlight !== null}
                onSelectFile={selectWorkingTreeFile}
                onStageFile={handleStageFile}
                onDiscardFile={handleDiscardFile}
              />
              <GitChangeSection
                title="Untracked"
                description="New files not yet added to Git."
                files={untrackedFiles}
                selectedPath={selectedPath}
                emptyLabel="No untracked files."
                selectLabel="Review"
                actionDisabled={gitTaskInFlight !== null}
                onSelectFile={selectWorkingTreeFile}
                onStageFile={handleStageFile}
                onDiscardFile={handleDiscardFile}
              />
              {!hasWorkingTreeChanges ? (
                <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  {gitStatusQuery.isLoading ? "Loading changes..." : "Working tree is clean."}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-border/40 bg-background/50 backdrop-blur-xl shadow-sm p-5 flex flex-col min-h-[500px]">
            <div className="flex min-w-0 flex-row items-start justify-between gap-4 border-b border-border/40 pb-4 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {diffSection.title}
                </h3>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {resolverFilePath
                    ? resolverMode === "manual"
                      ? "Resolve this conflicted file directly inside the Git workspace."
                      : "Review the conflicted file in the shared resolver surface before accepting an AI fix."
                    : selectedPath
                      ? "Live working-tree diff for the selected file."
                      : activeHistoryCommit
                        ? "Unified patch for the selected commit."
                        : "Select a changed file or commit to inspect its patch."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {resolverFilePath ? (
                  <Badge
                    size="sm"
                    variant={resolverMode === "manual" ? "secondary" : "outline"}
                    className="shadow-none"
                  >
                    {resolverMode === "manual" ? "Manual Resolver" : "AI Conflict Fix"}
                  </Badge>
                ) : selectedPath ? (
                  <Badge size="sm" variant="secondary" className="shadow-none">
                    Working tree
                  </Badge>
                ) : activeHistoryCommit ? (
                  <Badge size="sm" variant="outline" className="shadow-none">
                    Commit patch
                  </Badge>
                ) : null}
                {!resolverFilePath && diffQuery.data ? (
                  <>
                    <Badge size="sm" variant="success" className="shadow-none">
                      +{diffQuery.data.stats.insertions}
                    </Badge>
                    <Badge size="sm" variant="error" className="shadow-none">
                      -{diffQuery.data.stats.deletions}
                    </Badge>
                    <Badge size="sm" variant="outline" className="shadow-none">
                      {diffQuery.data.stats.filesChanged} file
                      {diffQuery.data.stats.filesChanged === 1 ? "" : "s"}
                    </Badge>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex min-h-0 flex-col gap-4 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {resolverFilePath ? (
                  <>
                    <Badge size="sm" variant="outline">
                      Conflicts {activeConflictedFileIndex >= 0 ? activeConflictedFileIndex + 1 : 1}{" "}
                      / {Math.max(totalConflictCount, 1)}
                    </Badge>
                    <Badge size="sm" variant="secondary">
                      {resolverFilePath}
                    </Badge>
                    {totalConflictCount > 1 ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigateConflictResolver(-1)}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigateConflictResolver(1)}
                        >
                          Next
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!api || !resolverFilePath}
                      onClick={() => {
                        if (!api || !resolverFilePath) return;
                        void openInPreferredEditor(api, `${project.cwd}/${resolverFilePath}`).catch(
                          () => undefined,
                        );
                      }}
                    >
                      Open In Editor
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={closeConflictResolver}>
                      Close Resolver
                    </Button>
                  </>
                ) : selectedPath ? (
                  <>
                    <Badge size="sm" variant="secondary">
                      {selectedPath}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!api || !selectedPath) return;
                        void openInPreferredEditor(api, `${project.cwd}/${selectedPath}`).catch(
                          () => undefined,
                        );
                      }}
                    >
                      Open In Editor
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedPath(project.id, null)}
                    >
                      Clear File
                    </Button>
                  </>
                ) : activeHistoryCommit ? (
                  <>
                    <Badge size="sm" variant="outline">
                      {activeHistoryCommit.shortSha}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {activeHistoryCommit.subject}
                    </span>
                  </>
                ) : null}
              </div>

              {resolverFilePath ? (
                <div className="grid min-h-0 flex-1 gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="flex min-h-0 flex-col gap-3 rounded-xl border border-border/70 bg-background/40 p-4">
                    {conflictedFiles.length > 1 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            Conflicted Files
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge size="sm" variant="outline">
                              {activeConflictedFileIndex >= 0 ? activeConflictedFileIndex + 1 : 1} /{" "}
                              {conflictedFiles.length}
                            </Badge>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              onClick={() => navigateConflictResolver(-1)}
                              aria-label="Previous conflicted file"
                            >
                              <ChevronUpIcon className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              onClick={() => navigateConflictResolver(1)}
                              aria-label="Next conflicted file"
                            >
                              <ChevronDownIcon className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <ScrollArea className="max-h-28 rounded-xl border border-border/70 bg-background/60">
                          <div className="flex gap-2 p-2">
                            {conflictedFiles.map((file) => (
                              <Button
                                key={`resolver-switch:${file.path}`}
                                type="button"
                                size="sm"
                                variant={resolverFilePath === file.path ? "secondary" : "outline"}
                                className="max-w-60 justify-start truncate"
                                onClick={() => openConflictResolver(file.path, resolverMode)}
                              >
                                {basenameOfPath(file.path)}
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-medium text-foreground">
                          {resolverMode === "manual"
                            ? "Manual conflict resolver"
                            : "AI conflict fix"}
                        </div>
                        {resolverMode === "manual" ? (
                          <Badge size="sm" variant={resolverDirty ? "outline" : "secondary"}>
                            {resolverDirty ? "Editing" : "Ready"}
                          </Badge>
                        ) : aiConflictState.status === "waiting" ? (
                          <Badge size="sm" variant="outline">
                            Waiting for Agents
                          </Badge>
                        ) : aiConflictState.proposal ? (
                          <Badge size="sm" variant="secondary">
                            Proposal Ready
                          </Badge>
                        ) : aiConflictState.status === "error" ? (
                          <Badge size="sm" variant="error">
                            Error
                          </Badge>
                        ) : (
                          <Badge size="sm" variant="outline">
                            Ready to Generate
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {resolverMode === "manual"
                          ? "Compare the base, ours, and theirs versions, then edit the final resolved file here before marking it resolved."
                          : "Generate an AI proposal into this same resolver, review the patch on the right, then accept or reject it."}
                      </p>
                    </div>
                    {resolverMode === "manual" ? (
                      conflictSnapshotQuery.isLoading ? (
                        <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-4 text-sm text-muted-foreground">
                          Loading base / ours / theirs…
                        </div>
                      ) : (
                        <div className="grid gap-3 2xl:grid-cols-3">
                          <GitConflictTextPane
                            title="Base"
                            description="Shared ancestor"
                            contents={conflictSnapshotQuery.data?.baseContents}
                          />
                          <GitConflictTextPane
                            title="Ours"
                            description="Current branch"
                            contents={conflictSnapshotQuery.data?.oursContents}
                          />
                          <GitConflictTextPane
                            title="Theirs"
                            description="Incoming change"
                            contents={conflictSnapshotQuery.data?.theirsContents}
                          />
                        </div>
                      )
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={gitTaskInFlight !== null}
                        onClick={() => {
                          if (activeConflictedFile) {
                            void handleResolveConflictSide(activeConflictedFile, "ours");
                          }
                        }}
                      >
                        Use Ours
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={gitTaskInFlight !== null}
                        onClick={() => {
                          if (activeConflictedFile) {
                            void handleResolveConflictSide(activeConflictedFile, "theirs");
                          }
                        }}
                      >
                        Use Theirs
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          resolverMode === "ai" ||
                          gitTaskInFlight !== null ||
                          conflictFileQuery.isLoading ||
                          resolverFilePath === null
                        }
                        onClick={() => void handleSaveResolverDraft(false)}
                      >
                        Save Draft
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          resolverMode === "ai" ||
                          gitTaskInFlight !== null ||
                          conflictFileQuery.isLoading ||
                          resolverFilePath === null
                        }
                        onClick={() => void handleSaveResolverDraft(true)}
                      >
                        Save & Mark Resolved
                      </Button>
                      {resolverMode === "ai" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              aiConflictState.status === "sending" ||
                              aiConflictState.status === "waiting" ||
                              !activeAgentsThread ||
                              conflictFileQuery.isLoading
                            }
                            onClick={() => void handleGenerateAiConflictFix()}
                          >
                            {aiConflictState.status === "sending" ||
                            aiConflictState.status === "waiting"
                              ? "Generating..."
                              : "Generate Fix"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!aiConflictState.proposal}
                            onClick={handleAcceptAiConflictFix}
                          >
                            Accept Fix
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!aiConflictState.proposal}
                            onClick={handleRejectAiConflictFix}
                          >
                            Reject
                          </Button>
                          {!activeAgentsThread ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void onOpenAgents()}
                              >
                                Open Agents
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void onCreateAgentsThread()}
                              >
                                Create Thread
                              </Button>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {resolverMode === "ai" ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
                        {!activeAgentsThread
                          ? "AI conflict fix uses this project's Agents runtime. Open Agents or create a thread, then generate the fix from this same panel."
                          : aiConflictState.status === "waiting"
                            ? "The conflict was sent to the current Agents thread. Waiting for the assistant to return a fully resolved file."
                            : aiConflictState.status === "error"
                              ? (aiConflictState.error ?? "Could not generate an AI conflict fix.")
                              : aiConflictState.proposal
                                ? "AI produced a proposed resolution. Review the patch on the right, then accept or reject it."
                                : "Use Generate Fix to send this conflicted file to the current Agents thread and review the returned proposal here."}
                      </div>
                    ) : conflictFileQuery.isLoading ? (
                      <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                        Loading conflicted file...
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            Resolved Output
                          </div>
                          <Badge size="sm" variant={resolverDirty ? "outline" : "secondary"}>
                            {resolverDirty ? "Editing" : "Synced"}
                          </Badge>
                        </div>
                        <Textarea
                          value={resolverDraft}
                          onChange={(event) => {
                            setResolverDraft(event.target.value);
                            setResolverDirty(true);
                          }}
                          className="min-h-[22rem] flex-1 resize-none font-mono text-xs leading-6"
                          placeholder="Conflicted file contents will load here."
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-0 flex-col rounded-xl border border-border/70 bg-background/40">
                    <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">Patch Preview</div>
                        <div className="text-xs text-muted-foreground">
                          {resolverPatch
                            ? resolverMode === "ai"
                              ? "AI resolution preview."
                              : "Unsaved resolution preview."
                            : "Current working-tree diff for this conflicted file."}
                        </div>
                      </div>
                      {resolverMode === "manual" && resolverDirty ? (
                        <Badge size="sm" variant="outline">
                          Unsaved changes
                        </Badge>
                      ) : null}
                    </div>
                    {resolverPatch ? (
                      <PatchViewer patch={resolverPatch} onOpenFile={openFileInEditor} />
                    ) : diffQuery.isLoading ? (
                      <div className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
                        Loading diff...
                      </div>
                    ) : diffQuery.data ? (
                      <PatchViewer patch={diffQuery.data.patch} onOpenFile={openFileInEditor} />
                    ) : (
                      <div className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
                        No patch available yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : diffQuery.isLoading ? (
                <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                  Loading diff...
                </div>
              ) : diffQuery.data ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  {selectedPath ? (
                    <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-foreground">Hunk Actions</div>
                          <div className="text-xs text-muted-foreground">
                            Apply hunks from the current diff without dropping to the CLI.
                          </div>
                        </div>
                        {hunkActionState.unavailableReason ? (
                          <Badge size="sm" variant="outline">
                            Disabled
                          </Badge>
                        ) : (
                          <Badge size="sm" variant="secondary">
                            {selectedPatchHunks.length} hunk
                            {selectedPatchHunks.length === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </div>
                      {hunkActionState.unavailableReason ? (
                        <div className="mt-3 rounded-lg border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
                          {hunkActionState.unavailableReason}
                        </div>
                      ) : selectedPatchHunks.length === 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
                          No hunks were parsed from this diff.
                        </div>
                      ) : (
                        <ScrollArea className="mt-3 h-36 rounded-lg border border-border/70">
                          <div className="space-y-2 p-2">
                            {selectedPatchHunks.map((hunk, index) => (
                              <div
                                key={`${selectedPath}:hunk:${hunk.deletionStart}:${hunk.additionStart}:${hunk.deletionLineIndex}:${hunk.additionLineIndex}`}
                                className="rounded-lg border border-border/70 bg-card/40 px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-medium text-foreground">
                                      Hunk {index + 1}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {hunk.hunkSpecs ??
                                        `-${hunk.deletionStart} +${hunk.additionStart}`}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {hunkActionState.modes.includes("stage") ? (
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="outline"
                                        disabled={gitTaskInFlight !== null}
                                        onClick={() => handleApplyHunk(hunk, "stage")}
                                      >
                                        Stage Hunk
                                      </Button>
                                    ) : null}
                                    {hunkActionState.modes.includes("unstage") ? (
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="outline"
                                        disabled={gitTaskInFlight !== null}
                                        onClick={() => handleApplyHunk(hunk, "unstage")}
                                      >
                                        Unstage Hunk
                                      </Button>
                                    ) : null}
                                    {hunkActionState.modes.includes("discard") ? (
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="ghost"
                                        disabled={gitTaskInFlight !== null}
                                        onClick={() => handleApplyHunk(hunk, "discard")}
                                      >
                                        Discard Hunk
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  ) : null}
                  <PatchViewer
                    patch={diffQuery.data.patch}
                    onOpenFile={selectedPath ? openFileInEditor : undefined}
                  />
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                  {changedFiles.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Quick Open Changed File
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {changedFiles.slice(0, 8).map((file) => (
                          <Button
                            key={`diff-quick-open:${file.path}`}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="max-w-80 justify-start truncate"
                            onClick={() => selectWorkingTreeFile(file.path)}
                          >
                            {file.path}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    Select a changed file for a live working-tree diff, or choose a commit from the
                    history list to inspect its patch here.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isBasicMode ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px]"
            onClick={() => handleWorkspaceModeChange("basic")}
          />
          <div className="fixed right-0 top-0 z-40 grid h-full w-[min(30rem,92vw)] min-h-0 min-w-0 gap-4 overflow-y-auto border-l border-border/70 bg-background/96 p-4 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
            <Card className="min-h-0 min-w-0 overflow-hidden">
              <CardHeader className="min-w-0 border-b border-border/60 pb-4">
                <CardTitle>{branchesSection.title}</CardTitle>
                <CardDescription className="break-words">
                  {branchesSection.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-6">
                <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    New Branch
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={branchDraft}
                      onChange={(event) => setBranchDraft(event.target.value)}
                      placeholder="new-branch-name"
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        const next = branchDraft.trim();
                        if (next.length === 0) return;
                        branchCreateMutation.mutate(next);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={branchDraft.trim().length === 0 || branchCreateMutation.isPending}
                      onClick={() => branchCreateMutation.mutate(branchDraft.trim())}
                    >
                      <PlusIcon className="size-3.5" />
                      Create
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Local
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      {localBranches.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Remote
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      {remoteBranches.length}
                    </div>
                  </div>
                </div>
                <ScrollArea className="min-h-0 flex-1 rounded-xl border border-border/70">
                  <div className="space-y-1 p-2">
                    {branchesQuery.data?.branches.length ? (
                      branchesQuery.data.branches.map((branch: GitBranch) => (
                        <div
                          key={`${branch.isRemote ? "remote" : "local"}:${branch.name}`}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm",
                            branchToolsTarget === branch.name && !branch.isRemote
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/60 bg-background/30",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => {
                                if (!branch.isRemote) {
                                  setBranchToolsTarget(branch.name);
                                }
                              }}
                            >
                              <div className="truncate font-medium text-foreground">
                                {branch.name}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {branch.isRemote
                                  ? branch.remoteName
                                    ? `Remote · ${branch.remoteName}`
                                    : "Remote"
                                  : branch.isDefault
                                    ? "Default branch"
                                    : "Local branch"}
                              </div>
                            </button>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {branch.current ? (
                                <Badge size="sm" variant="secondary">
                                  Current
                                </Badge>
                              ) : null}
                              {!branch.isRemote ? (
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  disabled={branch.current || branchCheckoutMutation.isPending}
                                  onClick={() => branchCheckoutMutation.mutate(branch.name)}
                                >
                                  Checkout
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        {branchesQuery.isLoading ? "Loading branches..." : "No branch data yet."}
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <Collapsible open={branchManagerOpen} onOpenChange={setBranchManagerOpen}>
                  <div className="rounded-xl border border-border/70 bg-background/60">
                    <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-left">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">Branch management</div>
                        <div className="mt-1 break-words text-xs text-muted-foreground">
                          Rename, connect upstream, or remove a branch when needed.
                        </div>
                      </div>
                      <div className="shrink-0">
                        {branchManagerOpen ? (
                          <ChevronUpIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDownIcon className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-border/70">
                      <div className="space-y-3 p-3">
                        <Select
                          value={branchToolsTarget}
                          onValueChange={(value) => setBranchToolsTarget(value ?? "")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a local branch" />
                          </SelectTrigger>
                          <SelectPopup>
                            <div className="px-2 py-2">
                              <Input
                                value={branchToolsSearch}
                                onChange={(event) => setBranchToolsSearch(event.target.value)}
                                onKeyDown={(event) => event.stopPropagation()}
                                placeholder="Search local branches"
                              />
                            </div>
                            <SelectSeparator />
                            {filteredBranchToolOptions.length ? (
                              filteredBranchToolOptions.map((branchName) => (
                                <SelectItem key={branchName} value={branchName}>
                                  {branchName}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                No local branches found.
                              </div>
                            )}
                          </SelectPopup>
                        </Select>
                        <div className="flex gap-2">
                          <Input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            placeholder="rename-branch"
                            disabled={!branchToolsBranch}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                handleRenameBranch();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              !branchToolsBranch ||
                              renameDraft.trim().length === 0 ||
                              renameDraft.trim() === branchToolsBranch.name ||
                              branchToolsBusy
                            }
                            onClick={handleRenameBranch}
                          >
                            <PencilIcon className="size-3.5" />
                            Rename
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={upstreamSelection}
                            onValueChange={(value) => setUpstreamSelection(value ?? "")}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Choose a remote branch" />
                            </SelectTrigger>
                            <SelectPopup>
                              <div className="px-2 py-2">
                                <Input
                                  value={upstreamSearch}
                                  onChange={(event) => setUpstreamSearch(event.target.value)}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  placeholder="Search remote branches"
                                />
                              </div>
                              <SelectSeparator />
                              {filteredUpstreamOptions.length ? (
                                filteredUpstreamOptions.map((branch) => (
                                  <SelectItem key={branch.name} value={branch.name}>
                                    <span className="flex min-w-0 items-center justify-between gap-2">
                                      <span className="truncate">{branch.name}</span>
                                      <Badge size="sm" variant="info">
                                        Remote
                                      </Badge>
                                    </span>
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  No remote branches found.
                                </div>
                              )}
                            </SelectPopup>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              !branchToolsBranch || !selectedUpstreamBranch || branchToolsBusy
                            }
                            onClick={handleSetUpstream}
                          >
                            Track
                          </Button>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="justify-start text-destructive hover:text-destructive"
                          disabled={
                            !branchToolsBranch || branchToolsBranch.current || branchToolsBusy
                          }
                          onClick={() => void handleDeleteBranch()}
                        >
                          <XIcon className="size-3.5" />
                          Delete Branch
                        </Button>
                        <Badge size="sm" variant="error">
                          Destructive
                        </Badge>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="min-w-0 border-b border-border/60 pb-4">
                <CardTitle>{advancedActionsSection.title}</CardTitle>
                <CardDescription className="break-words">
                  {advancedActionsSection.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <Collapsible open={advancedActionsOpen} onOpenChange={setAdvancedActionsOpen}>
                  <div className="rounded-xl border border-border/70 bg-background/60">
                    <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-left">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">Merge / Rebase</div>
                        <div className="mt-1 break-words text-xs text-muted-foreground">
                          Start or resume long-running branch operations.
                        </div>
                      </div>
                      <div className="shrink-0">
                        {advancedActionsOpen ? (
                          <ChevronUpIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDownIcon className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-border/70">
                      <div className="space-y-3 p-3">
                        {currentOperation ? (
                          <div className="rounded-lg border border-border/70 bg-background/50 p-3 text-sm text-muted-foreground">
                            The active {currentOperation.kind} is already surfaced in the main
                            workspace above.
                          </div>
                        ) : (
                          <>
                            <Select
                              value={operationBranch}
                              onValueChange={(value) => setOperationBranch(value ?? "")}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose a branch" />
                              </SelectTrigger>
                              <SelectPopup className="max-h-80">
                                <div className="px-2 py-2">
                                  <Input
                                    value={operationBranchSearch}
                                    onChange={(event) =>
                                      setOperationBranchSearch(event.target.value)
                                    }
                                    onKeyDown={(event) => event.stopPropagation()}
                                    placeholder="Search branches"
                                  />
                                </div>
                                <SelectSeparator />
                                {filteredLocalOperationBranchOptions.length ? (
                                  <SelectGroup>
                                    <SelectGroupLabel>Local Branches</SelectGroupLabel>
                                    {filteredLocalOperationBranchOptions.map((branch) => (
                                      <SelectItem key={branch.value} value={branch.value}>
                                        <span className="flex min-w-0 items-center justify-between gap-2">
                                          <span className="truncate">{branch.label}</span>
                                          <Badge size="sm" variant="success">
                                            Local
                                          </Badge>
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ) : null}
                                {filteredLocalOperationBranchOptions.length &&
                                filteredRemoteOperationBranchOptions.length ? (
                                  <SelectSeparator />
                                ) : null}
                                {filteredRemoteOperationBranchOptions.length ? (
                                  <SelectGroup>
                                    <SelectGroupLabel>Remote Branches</SelectGroupLabel>
                                    {filteredRemoteOperationBranchOptions.map((branch) => (
                                      <SelectItem key={branch.value} value={branch.value}>
                                        <span className="flex min-w-0 items-center justify-between gap-2">
                                          <span className="truncate">{branch.label}</span>
                                          <Badge size="sm" variant="info">
                                            Remote
                                          </Badge>
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ) : null}
                                {filteredLocalOperationBranchOptions.length === 0 &&
                                filteredRemoteOperationBranchOptions.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-muted-foreground">
                                    No branches found.
                                  </div>
                                ) : null}
                              </SelectPopup>
                            </Select>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={operationBranch.length === 0 || gitTaskInFlight !== null}
                                onClick={handleStartMerge}
                              >
                                Merge Into Current
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={operationBranch.length === 0 || gitTaskInFlight !== null}
                                onClick={handleStartRebase}
                              >
                                Rebase Onto Selected
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={changedFiles.length === 0 || gitTaskInFlight !== null}
                    onClick={() => void handleSaveStash()}
                  >
                    Stash Changes
                    <Badge size="sm" variant="secondary">
                      Risky
                    </Badge>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={changedFiles.length === 0 || gitTaskInFlight !== null}
                    onClick={() => void handleDiscardAll()}
                  >
                    Discard All
                    <Badge size="sm" variant="error">
                      Destructive
                    </Badge>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="min-h-0 min-w-0">
              <CardHeader className="min-w-0 border-b border-border/60 pb-4">
                <CardTitle>{historySection.title}</CardTitle>
                <CardDescription className="break-words">
                  {historySection.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid min-h-0 gap-4 pt-6">
                <ScrollArea className="min-h-0 rounded-xl border border-border/70">
                  <div className="space-y-1 p-2">
                    {historyCommits.length ? (
                      historyCommits.map((commit, index) => (
                        <button
                          key={commit.sha}
                          type="button"
                          onClick={() => {
                            setSelectedPath(project.id, null);
                            setSelectedCommit(
                              project.id,
                              selectedCommit === commit.sha && !selectedPath ? null : commit.sha,
                            );
                          }}
                          className={cn(
                            "flex w-full gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
                            activeHistoryCommit?.sha === commit.sha &&
                              !selectedPath &&
                              "bg-primary/10",
                          )}
                        >
                          <div className="relative flex w-5 shrink-0 justify-center pt-1">
                            {index < historyCommits.length - 1 ? (
                              <span className="absolute top-5 h-[calc(100%-0.25rem)] w-px bg-linear-to-b from-primary/50 via-border/80 to-border/40" />
                            ) : null}
                            <span
                              className={cn(
                                "relative z-10 mt-0.5 size-2.5 rounded-full border bg-card shadow-sm",
                                commit.isHead
                                  ? "border-primary bg-primary shadow-[0_0_0_4px_rgba(59,130,246,0.14)]"
                                  : "border-primary/40",
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">
                              {commit.subject}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{commit.shortSha}</span>
                              <span>{commit.authorName}</span>
                              <span>{formatGitTimestamp(commit.authoredAt)}</span>
                            </div>
                            {commit.refs.length ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {commit.refs.slice(0, 4).map((ref) => {
                                  const refInfo = classifyGitHistoryRef(ref);
                                  return (
                                    <Badge
                                      key={`${commit.sha}:${ref}`}
                                      size="sm"
                                      variant={refInfo.variant}
                                    >
                                      {refInfo.label}
                                    </Badge>
                                  );
                                })}
                                {commit.refs.length > 4 ? (
                                  <Badge size="sm" variant="outline">
                                    +{commit.refs.length - 4} more
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          {commit.isHead ? (
                            <Badge size="sm" variant="secondary">
                              HEAD
                            </Badge>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        {historyQuery.isLoading ? "Loading commit history..." : "No commits yet."}
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <Collapsible open={stashPanelOpen} onOpenChange={setStashPanelOpen}>
                  <div className="rounded-xl border border-border/70 bg-background/60">
                    <CollapsibleTrigger className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-left">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {stashesSection.title}
                        </div>
                        <div className="mt-1 break-words text-xs text-muted-foreground">
                          {stashesSection.description}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge size="sm" variant="outline">
                          {stashEntries.length}
                        </Badge>
                        {stashPanelOpen ? (
                          <ChevronUpIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDownIcon className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-border/70">
                      <div className="space-y-3 p-3">
                        <div className="space-y-2">
                          <Input
                            value={stashMessage}
                            onChange={(event) => setStashMessage(event.target.value)}
                            placeholder="Optional stash message"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={changedFiles.length === 0 || gitTaskInFlight !== null}
                            onClick={() => void handleSaveStash()}
                          >
                            Save Stash
                          </Button>
                        </div>
                        <Separator />
                        <ScrollArea className="h-56 rounded-lg border border-border/70">
                          <div className="space-y-2 p-2">
                            {stashEntries.length ? (
                              stashEntries.map((entry) => (
                                <div
                                  key={entry.stashRef}
                                  className="rounded-lg border border-border/70 bg-card/40 p-2"
                                >
                                  <div className="text-sm font-medium text-foreground">
                                    {entry.stashRef}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {entry.message}
                                  </div>
                                  <div className="mt-1 text-[11px] text-muted-foreground/80">
                                    {entry.shortSha} · {formatGitTimestamp(entry.createdAt)}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="outline"
                                      disabled={gitTaskInFlight !== null}
                                      onClick={() => handleApplyStash(entry.stashRef, false)}
                                    >
                                      Apply
                                    </Button>
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="outline"
                                      disabled={gitTaskInFlight !== null}
                                      onClick={() => handleApplyStash(entry.stashRef, true)}
                                    >
                                      Pop
                                    </Button>
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="ghost"
                                      disabled={gitTaskInFlight !== null}
                                      onClick={() => void handleDropStash(entry.stashRef)}
                                    >
                                      Drop
                                    </Button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-2 py-3 text-sm text-muted-foreground">
                                {stashQuery.isLoading ? "Loading stashes..." : "No stashes yet."}
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Dialog open={discardAllConfirmOpen} onOpenChange={setDiscardAllConfirmOpen}>
        <DialogPopup>
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Discard all local changes?</DialogTitle>
              <DialogDescription>
                This is destructive and cannot be undone. Type <code>DISCARD</code> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={discardAllConfirmText}
              onChange={(event) => setDiscardAllConfirmText(event.target.value)}
              placeholder="Type DISCARD"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDiscardAllConfirmOpen(false);
                  emitGitWorkspaceTelemetry("git_action_cancelled_confirm_dialog", {
                    action: "discard_all",
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={discardAllConfirmText.trim() !== "DISCARD"}
                onClick={() => {
                  setDiscardAllConfirmOpen(false);
                  executeDiscardAll();
                }}
              >
                Discard All
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>

      <Dialog open={deleteBranchConfirmOpen} onOpenChange={setDeleteBranchConfirmOpen}>
        <DialogPopup>
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Delete branch {branchToolsBranch?.name}?</DialogTitle>
              <DialogDescription>
                This can permanently remove branch history if forced. Type{" "}
                <code>{`DELETE ${branchToolsBranch?.name ?? ""}`}</code> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={deleteBranchConfirmText}
              onChange={(event) => setDeleteBranchConfirmText(event.target.value)}
              placeholder={`Type DELETE ${branchToolsBranch?.name ?? ""}`}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteBranchConfirmOpen(false);
                  emitGitWorkspaceTelemetry("git_action_cancelled_confirm_dialog", {
                    action: "delete_branch",
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  deleteBranchConfirmText.trim() !== `DELETE ${branchToolsBranch?.name ?? ""}`
                }
                onClick={() => {
                  setDeleteBranchConfirmOpen(false);
                  executeDeleteBranch();
                }}
              >
                Delete Branch
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

function formatGitTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function GitChangeSection(props: {
  title: string;
  description: string;
  files: ReadonlyArray<GitStatusFile>;
  selectedPath: string | null;
  emptyLabel: string;
  selectLabel: string;
  actionDisabled: boolean;
  onSelectFile: (filePath: string) => void;
  onResolveFile?: (file: GitStatusFile) => void;
  onFixWithAi?: (file: GitStatusFile) => void;
  onOpenFile?: (filePath: string) => void | Promise<void>;
  onStageFile?: (file: GitStatusFile) => void;
  onUnstageFile?: (file: GitStatusFile) => void;
  onUseOurs?: (file: GitStatusFile) => void;
  onUseTheirs?: (file: GitStatusFile) => void;
  onDiscardFile: (file: GitStatusFile) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {props.title}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{props.description}</div>
      </div>
      {props.files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
          {props.emptyLabel}
        </div>
      ) : (
        <div className="space-y-1">
          {props.files.map((file) => (
            <div
              key={`${props.title}:${file.path}`}
              className={cn(
                "rounded-lg border px-3 py-2",
                props.selectedPath === file.path
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-background/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => props.onSelectFile(file.path)}
                >
                  <div className="truncate text-sm font-medium text-foreground">{file.path}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>+{file.insertions}</span>
                    <span>-{file.deletions}</span>
                    {props.selectedPath === file.path ? (
                      <Badge size="sm" variant="secondary">
                        {props.selectLabel}
                      </Badge>
                    ) : null}
                  </div>
                </button>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {props.onResolveFile ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={props.actionDisabled}
                      onClick={() => props.onResolveFile?.(file)}
                    >
                      Resolve
                    </Button>
                  ) : null}
                  {props.onFixWithAi ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={props.actionDisabled}
                      onClick={() => props.onFixWithAi?.(file)}
                    >
                      Fix with AI
                    </Button>
                  ) : null}
                  {props.onOpenFile ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={props.actionDisabled}
                      onClick={() => void props.onOpenFile?.(file.path)}
                    >
                      Open
                    </Button>
                  ) : null}
                  {props.onUseOurs ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={props.actionDisabled}
                      onClick={() => props.onUseOurs?.(file)}
                    >
                      Use Ours
                    </Button>
                  ) : null}
                  {props.onUseTheirs ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={props.actionDisabled}
                      onClick={() => props.onUseTheirs?.(file)}
                    >
                      Use Theirs
                    </Button>
                  ) : null}
                  {props.onStageFile ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={props.actionDisabled}
                      onClick={() => props.onStageFile?.(file)}
                    >
                      {props.title === "Conflicts" ? "Mark Resolved" : "Stage"}
                    </Button>
                  ) : null}
                  {props.onUnstageFile ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={props.actionDisabled}
                      onClick={() => props.onUnstageFile?.(file)}
                    >
                      Unstage
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    disabled={props.actionDisabled}
                    onClick={() => props.onDiscardFile(file)}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GitConflictTextPane(props: {
  title: string;
  description: string;
  contents: string | null | undefined;
}) {
  return (
    <div className="min-h-0 rounded-xl border border-border/70 bg-background/60">
      <div className="border-b border-border/70 px-3 py-2">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {props.title}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{props.description}</div>
      </div>
      <ScrollArea className="h-44">
        <pre className="px-3 py-2 font-mono text-[11px] leading-5 whitespace-pre-wrap text-foreground/90">
          {props.contents?.length ? props.contents : "No contents available for this stage."}
        </pre>
      </ScrollArea>
    </div>
  );
}

function DesktopBrowserTool(props: {
  project: Project;
  projectSettings: ProjectWorkspaceSettings;
}) {
  const api = readNativeApi();
  const bridge = window.desktopBridge;
  const browserState = useWorkspaceShellStore((state) => {
    const existing = state.browserStateByProjectId[props.project.id];
    if (existing) {
      return existing;
    }
    return {
      currentUrl: resolveProjectDefaultBrowserUrl(props.project, props.projectSettings),
      devicePreset: "project-default",
      customWidth: null,
      customHeight: null,
      landscape: false,
    } as const;
  });
  const setBrowserCurrentUrl = useWorkspaceShellStore((state) => state.setBrowserCurrentUrl);
  const setBrowserViewport = useWorkspaceShellStore((state) => state.setBrowserViewport);
  const [draftUrl, setDraftUrl] = useState(browserState.currentUrl);
  const [hostState, setHostState] = useState<DesktopBrowserHostState>(
    DEFAULT_DESKTOP_BROWSER_HOST_STATE,
  );
  const [sessionState, setSessionState] = useState<DesktopBrowserSessionState>(
    createEmptyBrowserSessionState(props.project.id),
  );
  const [viewportSelectorOpen, setViewportSelectorOpen] = useState(false);
  const [isChromeExpanded, setIsChromeExpanded] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setDraftUrl(browserState.currentUrl);
  }, [browserState.currentUrl]);

  const normalizedUrl = normalizeBrowserUrl(
    browserState.currentUrl ||
      resolveProjectDefaultBrowserUrl(props.project, props.projectSettings),
  );

  useEffect(() => {
    if (!bridge) {
      return;
    }

    let disposed = false;
    void bridge
      .getBrowserHostState()
      .then((nextState) => {
        if (disposed) return;
        setHostState(nextState);
      })
      .catch(() => undefined);
    void bridge
      .getBrowserSessionState({ projectId: props.project.id })
      .then((nextState) => {
        if (disposed || !nextState) return;
        setSessionState(nextState);
      })
      .catch(() => undefined);
    void bridge
      .ensureBrowserSession({
        projectId: props.project.id,
        initialUrl: normalizedUrl,
      })
      .then(() =>
        bridge.activateBrowserSession({
          projectId: props.project.id,
        }),
      )
      .catch(() => undefined);

    const unsubscribe = bridge.onBrowserSessionState((nextState) => {
      if (nextState.projectId !== props.project.id || nextState.sessionId !== "browser") {
        return;
      }
      setSessionState(nextState);
    });

    return () => {
      disposed = true;
      unsubscribe();
      lastRequestedUrlRef.current = null;
      void bridge.hideBrowserSession().catch(() => undefined);
    };
  }, [bridge, props.project.id]);

  useEffect(() => {
    if (!bridge || !hostState.available || normalizedUrl.length === 0) {
      return;
    }
    if (sessionState.currentUrl === normalizedUrl) {
      lastRequestedUrlRef.current = normalizedUrl;
      return;
    }
    if (lastRequestedUrlRef.current === normalizedUrl) {
      return;
    }
    lastRequestedUrlRef.current = normalizedUrl;
    void bridge
      .navigateBrowserSession({
        projectId: props.project.id,
        url: normalizedUrl,
      })
      .catch(() => {
        if (lastRequestedUrlRef.current === normalizedUrl) {
          lastRequestedUrlRef.current = null;
        }
      });
  }, [bridge, hostState.available, normalizedUrl, props.project.id, sessionState.currentUrl]);

  useEffect(() => {
    if (!sessionState.currentUrl || sessionState.currentUrl === browserState.currentUrl) {
      return;
    }
    setBrowserCurrentUrl(props.project.id, sessionState.currentUrl);
  }, [browserState.currentUrl, props.project.id, sessionState.currentUrl, setBrowserCurrentUrl]);

  const selectedPreset =
    BROWSER_DEVICE_PRESETS.find((preset) => preset.id === browserState.devicePreset) ??
    BROWSER_DEVICE_PRESETS[0]!;
  const baseWidth =
    selectedPreset.id === "custom" ? browserState.customWidth : selectedPreset.width;
  const baseHeight =
    selectedPreset.id === "custom" ? browserState.customHeight : selectedPreset.height;
  const viewportWidth = browserState.landscape ? baseHeight : baseWidth;
  const viewportHeight = browserState.landscape ? baseWidth : baseHeight;

  useEffect(() => {
    if (!bridge || !hostState.available) {
      return;
    }
    const hostNode = hostRef.current;
    if (!hostNode) {
      return;
    }

    let frameId = 0;
    let lastSignature = "";
    const publishBounds = () => {
      frameId = 0;
      const rect = hostNode.getBoundingClientRect();
      const nextBounds = {
        projectId: props.project.id,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0,
      };
      const signature = [
        nextBounds.x,
        nextBounds.y,
        nextBounds.width,
        nextBounds.height,
        nextBounds.visible ? 1 : 0,
      ].join(":");
      if (signature === lastSignature) {
        return;
      }
      lastSignature = signature;
      void bridge.setBrowserBounds(nextBounds).catch(() => undefined);
    };
    const scheduleBounds = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(publishBounds);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleBounds();
    });
    resizeObserver.observe(hostNode);
    window.addEventListener("resize", scheduleBounds);
    scheduleBounds();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleBounds);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      void bridge
        .setBrowserBounds({
          projectId: props.project.id,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          visible: false,
        })
        .catch(() => undefined);
    };
  }, [bridge, hostState.available, props.project.id]);

  useEffect(() => {
    if (!bridge || !hostState.available) return;
    if (viewportSelectorOpen) {
      void bridge.hideBrowserSession().catch(() => undefined);
    } else {
      void bridge
        .activateBrowserSession({
          projectId: props.project.id,
        })
        .catch(() => undefined);
    }
  }, [bridge, hostState.available, viewportSelectorOpen, props.project.id]);

  useEffect(() => {
    if (!bridge || !hostState.available) {
      return;
    }

    let suspendedForOverlay = false;
    let frameId = 0;

    const syncOverlayVisibility = () => {
      frameId = 0;
      const overlayOpen = document.querySelector(CODE_HOST_OVERLAY_SELECTOR) !== null;
      if (overlayOpen === suspendedForOverlay) {
        return;
      }

      suspendedForOverlay = overlayOpen;
      if (overlayOpen) {
        void bridge.hideBrowserSession().catch(() => undefined);
        return;
      }

      void bridge
        .activateBrowserSession({
          projectId: props.project.id,
        })
        .catch(() => undefined);
    };

    const scheduleSync = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(syncOverlayVisibility);
    };

    const observer = new MutationObserver(() => {
      scheduleSync();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-open", "data-closed", "hidden", "style", "class"],
    });
    scheduleSync();

    return () => {
      observer.disconnect();
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [bridge, hostState.available, props.project.id]);

  if (!bridge || !hostState.available) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 p-4">
        <Card className="overflow-hidden border-border/70 bg-card/70 backdrop-blur-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Embedded browser unavailable</CardTitle>
            <CardDescription>
              {hostState.reason ??
                "This desktop session does not expose the embedded browser host. Open the page in your external browser instead."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button type="button" onClick={() => void api?.shell.openExternal(normalizedUrl)}>
              <ExternalLinkIcon className="size-3.5" />
              Open In Browser
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <Card className="relative z-20">
        <CardContent className="space-y-1.5 p-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              disabled={!sessionState.canGoBack}
              onClick={() =>
                void bridge.goBackBrowserSession({
                  projectId: props.project.id,
                })
              }
            >
              <ArrowLeftIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              disabled={!sessionState.canGoForward}
              onClick={() =>
                void bridge.goForwardBrowserSession({
                  projectId: props.project.id,
                })
              }
            >
              <ArrowRightIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() =>
                void bridge.reloadBrowserSession({
                  projectId: props.project.id,
                })
              }
            >
              <RefreshCwIcon className="size-3.5" />
              Refresh
            </Button>
            <Button
              type="button"
              size="xs"
              variant={sessionState.devToolsOpen ? "secondary" : "outline"}
              onClick={() =>
                void bridge.toggleBrowserDevTools({
                  projectId: props.project.id,
                })
              }
            >
              <BugIcon className="size-3.5" />
              Inspect
            </Button>
            <div className="flex min-w-[12rem] flex-1 items-center gap-1.5">
              <Input
                className="h-8"
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  setBrowserCurrentUrl(props.project.id, normalizeBrowserUrl(draftUrl));
                }}
                placeholder="Enter a URL"
              />
              <Button
                type="button"
                size="xs"
                onClick={() =>
                  setBrowserCurrentUrl(props.project.id, normalizeBrowserUrl(draftUrl))
                }
              >
                Go
              </Button>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void api?.shell.openExternal(sessionState.currentUrl ?? normalizedUrl)}
            >
              <ExternalLinkIcon className="size-3.5" />
              External
            </Button>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  setBrowserViewport(props.project.id, {
                    devicePreset: browserState.devicePreset,
                    landscape: !browserState.landscape,
                  })
                }
              >
                <RotateCwIcon className="size-3.5" />
                {browserState.landscape ? "Portrait" : "Landscape"}
              </Button>
              <BrowserViewportSelector
                browserState={browserState}
                projectId={props.project.id}
                setBrowserViewport={setBrowserViewport}
                onOpenChange={setViewportSelectorOpen}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card p-1.5">
        {viewportSelectorOpen ? <BrowserViewportHiddenNotice /> : null}
        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden">
          <div
            className="relative overflow-hidden rounded-xl border border-border/70 bg-background shadow-lg"
            style={{
              width: viewportWidth ? `min(${viewportWidth}px, 100%)` : "100%",
              height: viewportHeight ? `min(${viewportHeight}px, 100%)` : "100%",
              minHeight: viewportHeight ? undefined : "100%",
            }}
          >
            <div ref={hostRef} className="absolute inset-0 bg-background" />
            {sessionState.loading ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-center justify-center border-b border-border/70 bg-background/80 text-sm text-muted-foreground backdrop-blur-sm">
                <LoaderIcon className="mr-2 size-4 animate-spin" />
                Loading page...
              </div>
            ) : null}
            {sessionState.lastError ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
                <Card className="pointer-events-auto max-w-lg">
                  <CardHeader>
                    <CardTitle>Page load failed</CardTitle>
                    <CardDescription>{sessionState.lastError}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        void bridge.reloadBrowserSession({
                          projectId: props.project.id,
                        })
                      }
                    >
                      <RefreshCwIcon className="size-3.5" />
                      Retry
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void api?.shell.openExternal(sessionState.currentUrl ?? normalizedUrl)
                      }
                    >
                      <ExternalLinkIcon className="size-3.5" />
                      Open In Browser
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbeddedBrowserTool(props: {
  project: Project;
  projectSettings: ProjectWorkspaceSettings;
}) {
  const api = readNativeApi();
  const browserState = useWorkspaceShellStore((state) => {
    const existing = state.browserStateByProjectId[props.project.id];
    if (existing) {
      return existing;
    }
    return {
      currentUrl: resolveProjectDefaultBrowserUrl(props.project, props.projectSettings),
      devicePreset: "project-default",
      customWidth: null,
      customHeight: null,
      landscape: false,
    } as const;
  });
  const setBrowserCurrentUrl = useWorkspaceShellStore((state) => state.setBrowserCurrentUrl);
  const setBrowserViewport = useWorkspaceShellStore((state) => state.setBrowserViewport);
  const [draftUrl, setDraftUrl] = useState(browserState.currentUrl);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewportSelectorOpen, setViewportSelectorOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setDraftUrl(browserState.currentUrl);
  }, [browserState.currentUrl]);

  const normalizedUrl = normalizeBrowserUrl(
    browserState.currentUrl ||
      resolveProjectDefaultBrowserUrl(props.project, props.projectSettings),
  );

  useEffect(() => {
    setEmbedBlocked(false);
    setLoading(true);
    const timeoutId = window.setTimeout(() => {
      setEmbedBlocked(true);
      setLoading(false);
    }, EMBED_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [normalizedUrl]);

  const selectedPreset =
    BROWSER_DEVICE_PRESETS.find((preset) => preset.id === browserState.devicePreset) ??
    BROWSER_DEVICE_PRESETS[0]!;
  const baseWidth =
    selectedPreset.id === "custom" ? browserState.customWidth : selectedPreset.width;
  const baseHeight =
    selectedPreset.id === "custom" ? browserState.customHeight : selectedPreset.height;
  const viewportWidth = browserState.landscape ? baseHeight : baseWidth;
  const viewportHeight = browserState.landscape ? baseWidth : baseHeight;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <Card className="relative z-20">
        <CardContent className="space-y-1.5 p-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => iframeRef.current?.contentWindow?.location.reload()}
            >
              <RefreshCwIcon className="size-3.5" />
              Refresh
            </Button>
            <div className="flex min-w-[12rem] flex-1 items-center gap-1.5">
              <Input
                className="h-8"
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  setBrowserCurrentUrl(props.project.id, normalizeBrowserUrl(draftUrl));
                }}
                placeholder="Enter a URL"
              />
              <Button
                type="button"
                size="xs"
                onClick={() =>
                  setBrowserCurrentUrl(props.project.id, normalizeBrowserUrl(draftUrl))
                }
              >
                Go
              </Button>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void api?.shell.openExternal(normalizedUrl)}
            >
              <ExternalLinkIcon className="size-3.5" />
              External
            </Button>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  setBrowserViewport(props.project.id, {
                    devicePreset: browserState.devicePreset,
                    landscape: !browserState.landscape,
                  })
                }
              >
                <RotateCwIcon className="size-3.5" />
                {browserState.landscape ? "Portrait" : "Landscape"}
              </Button>
              <BrowserViewportSelector
                browserState={browserState}
                projectId={props.project.id}
                setBrowserViewport={setBrowserViewport}
                onOpenChange={setViewportSelectorOpen}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card p-1.5">
        {viewportSelectorOpen ? <BrowserViewportHiddenNotice /> : null}
        {embedBlocked ? (
          <div className="flex h-full min-h-[24rem] items-center justify-center">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Embedded preview blocked</CardTitle>
                <CardDescription>
                  This URL did not finish loading inside the IDE shell. Open it in your browser
                  instead.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" onClick={() => void api?.shell.openExternal(normalizedUrl)}>
                  <ExternalLinkIcon className="size-3.5" />
                  Open In Browser
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex h-full min-h-0 items-center justify-center overflow-hidden">
            <div
              className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-lg"
              style={{
                width: viewportWidth ? `min(${viewportWidth}px, 100%)` : "100%",
                height: viewportHeight ? `min(${viewportHeight}px, 100%)` : "100%",
                minHeight: viewportHeight ? undefined : "100%",
              }}
            >
              {loading ? (
                <div className="flex h-12 items-center justify-center border-b border-border/70 bg-muted/30 text-sm text-muted-foreground">
                  <LoaderIcon className="mr-2 size-4 animate-spin" />
                  Loading preview...
                </div>
              ) : null}
              <iframe
                ref={iframeRef}
                title={`${props.project.name} preview`}
                src={normalizedUrl}
                sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
                className="h-full w-full bg-white"
                style={{ visibility: viewportSelectorOpen ? "hidden" : "visible" }}
                onLoad={() => {
                  setLoading(false);
                  setEmbedBlocked(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BrowserTool(props: { project: Project; projectSettings: ProjectWorkspaceSettings }) {
  if (window.desktopBridge) {
    return <DesktopBrowserTool project={props.project} projectSettings={props.projectSettings} />;
  }

  return <EmbeddedBrowserTool project={props.project} projectSettings={props.projectSettings} />;
}

function DesktopCustomEmbedTool(props: {
  project: Project;
  title: string;
  url: string;
  sessionId: string;
}) {
  const api = readNativeApi();
  const bridge = window.desktopBridge;
  const projectSettings = useProjectWorkspaceSettings(props.project.id);
  const browserState = useWorkspaceShellStore((state) => {
    const existing = state.browserStateByProjectId[props.project.id];
    if (existing) {
      return existing;
    }
    return {
      currentUrl: normalizeBrowserUrl(props.url),
      devicePreset: "project-default",
      customWidth: null,
      customHeight: null,
      landscape: false,
    } as const;
  });
  const setBrowserViewport = useWorkspaceShellStore((state) => state.setBrowserViewport);
  const [hostState, setHostState] = useState<DesktopBrowserHostState>(
    DEFAULT_DESKTOP_BROWSER_HOST_STATE,
  );
  const [sessionState, setSessionState] = useState<DesktopBrowserSessionState>(
    createEmptyBrowserSessionState(props.project.id, props.sessionId),
  );
  const [viewportSelectorOpen, setViewportSelectorOpen] = useState(false);
  const [isChromeExpanded, setIsChromeExpanded] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedUrlRef = useRef<string | null>(null);
  const sessionKey = `${props.project.id}:${props.sessionId}`;
  const storedUrl = useWorkspaceShellStore((state) => state.browserUrlBySessionKey[sessionKey]);
  const setBrowserSessionUrl = useWorkspaceShellStore((state) => state.setBrowserSessionUrl);
  // A custom tab reopens at the URL the user last navigated to (persisted),
  // falling back to its configured URL; editing the configured URL takes over.
  const configuredUrl = normalizeBrowserUrl(props.url);
  const normalizedUrl = normalizeBrowserUrl(storedUrl ?? props.url);
  // Editable address bar for the custom embed. Navigating here writes the
  // per-session URL (NOT the shared per-project browser state — see the
  // navigate effect below), which recomputes `normalizedUrl` and drives the
  // BrowserView. Lets the user recover a tab whose page broke by editing the
  // URL and reloading, without going back to Settings.
  const [draftUrl, setDraftUrl] = useState(normalizedUrl);
  const submitDraftUrl = () => {
    const nextUrl = normalizeBrowserUrl(draftUrl);
    if (nextUrl.length === 0) {
      return;
    }
    setBrowserSessionUrl(props.project.id, props.sessionId, nextUrl);
  };
  const prevConfiguredUrlRef = useRef(configuredUrl);
  useEffect(() => {
    if (prevConfiguredUrlRef.current !== configuredUrl) {
      prevConfiguredUrlRef.current = configuredUrl;
      setBrowserSessionUrl(props.project.id, props.sessionId, configuredUrl);
    }
  }, [configuredUrl, props.project.id, props.sessionId, setBrowserSessionUrl]);
  useEffect(() => {
    const current = sessionState.currentUrl;
    if (current && current !== storedUrl) {
      setBrowserSessionUrl(props.project.id, props.sessionId, current);
    }
  }, [sessionState.currentUrl, storedUrl, setBrowserSessionUrl, props.project.id, props.sessionId]);
  // Keep the address bar reflecting where the embed actually is (e.g. after the
  // user clicks a link inside it or navigates), like a real browser URL bar.
  useEffect(() => {
    setDraftUrl(sessionState.currentUrl ?? normalizedUrl);
  }, [sessionState.currentUrl, normalizedUrl]);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    let disposed = false;
    void bridge
      .getBrowserHostState()
      .then((nextState) => {
        if (disposed) return;
        setHostState(nextState);
      })
      .catch(() => undefined);
    void bridge
      .getBrowserSessionState({ projectId: props.project.id, sessionId: props.sessionId })
      .then((nextState) => {
        if (disposed || !nextState) return;
        setSessionState(nextState);
      })
      .catch(() => undefined);
    void bridge
      .ensureBrowserSession({
        projectId: props.project.id,
        sessionId: props.sessionId,
        initialUrl: normalizedUrl,
      })
      .then(() =>
        bridge.activateBrowserSession({
          projectId: props.project.id,
          sessionId: props.sessionId,
        }),
      )
      .catch(() => undefined);

    const unsubscribe = bridge.onBrowserSessionState((nextState) => {
      if (nextState.projectId !== props.project.id || nextState.sessionId !== props.sessionId) {
        return;
      }
      setSessionState(nextState);
    });

    return () => {
      disposed = true;
      unsubscribe();
      lastRequestedUrlRef.current = null;
      void bridge.hideBrowserSession().catch(() => undefined);
    };
  }, [bridge, normalizedUrl, props.project.id, props.sessionId]);

  useEffect(() => {
    if (!bridge || !hostState.available || normalizedUrl.length === 0) {
      return;
    }
    if (sessionState.currentUrl === normalizedUrl) {
      lastRequestedUrlRef.current = normalizedUrl;
      return;
    }
    if (lastRequestedUrlRef.current === normalizedUrl) {
      return;
    }
    lastRequestedUrlRef.current = normalizedUrl;
    // A custom embed is pinned to its configured URL — it must NOT write into
    // the shared per-project browser state (that would clobber the main
    // Browser tab's persisted URL on relaunch).
    void bridge
      .navigateBrowserSession({
        projectId: props.project.id,
        sessionId: props.sessionId,
        url: normalizedUrl,
      })
      .catch(() => {
        if (lastRequestedUrlRef.current === normalizedUrl) {
          lastRequestedUrlRef.current = null;
        }
      });
  }, [bridge, hostState.available, normalizedUrl, props.project.id, sessionState.currentUrl]);

  const selectedPreset =
    BROWSER_DEVICE_PRESETS.find((preset) => preset.id === browserState.devicePreset) ??
    BROWSER_DEVICE_PRESETS[0]!;
  const baseWidth =
    selectedPreset.id === "custom" ? browserState.customWidth : selectedPreset.width;
  const baseHeight =
    selectedPreset.id === "custom" ? browserState.customHeight : selectedPreset.height;
  const viewportWidth = browserState.landscape ? baseHeight : baseWidth;
  const viewportHeight = browserState.landscape ? baseWidth : baseHeight;

  useEffect(() => {
    if (!bridge || !hostState.available) {
      return;
    }
    const hostNode = hostRef.current;
    if (!hostNode) {
      return;
    }

    let frameId = 0;
    let lastSignature = "";
    const publishBounds = () => {
      frameId = 0;
      const rect = hostNode.getBoundingClientRect();
      const nextBounds = {
        projectId: props.project.id,
        sessionId: props.sessionId,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0,
      };
      const signature = [
        nextBounds.x,
        nextBounds.y,
        nextBounds.width,
        nextBounds.height,
        nextBounds.visible ? 1 : 0,
      ].join(":");
      if (signature === lastSignature) {
        return;
      }
      lastSignature = signature;
      void bridge.setBrowserBounds(nextBounds).catch(() => undefined);
    };
    const scheduleBounds = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(publishBounds);
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleBounds();
    });
    resizeObserver.observe(hostNode);
    window.addEventListener("resize", scheduleBounds);
    scheduleBounds();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleBounds);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      void bridge
        .setBrowserBounds({
          projectId: props.project.id,
          sessionId: props.sessionId,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          visible: false,
        })
        .catch(() => undefined);
    };
  }, [bridge, hostState.available, props.project.id]);

  useEffect(() => {
    if (!bridge || !hostState.available) return;
    if (viewportSelectorOpen) {
      void bridge.hideBrowserSession().catch(() => undefined);
    } else {
      void bridge
        .activateBrowserSession({
          projectId: props.project.id,
          sessionId: props.sessionId,
        })
        .catch(() => undefined);
    }
  }, [bridge, hostState.available, viewportSelectorOpen, props.project.id]);

  useEffect(() => {
    if (!bridge || !hostState.available) {
      return;
    }

    let suspendedForOverlay = false;
    let frameId = 0;

    const syncOverlayVisibility = () => {
      frameId = 0;
      const overlayOpen = document.querySelector(CODE_HOST_OVERLAY_SELECTOR) !== null;
      if (overlayOpen === suspendedForOverlay) {
        return;
      }

      suspendedForOverlay = overlayOpen;
      if (overlayOpen) {
        void bridge.hideBrowserSession().catch(() => undefined);
        return;
      }

      void bridge
        .activateBrowserSession({
          projectId: props.project.id,
          sessionId: props.sessionId,
        })
        .catch(() => undefined);
    };

    const scheduleSync = () => {
      if (frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(syncOverlayVisibility);
    };

    const observer = new MutationObserver(() => {
      scheduleSync();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-open", "data-closed", "hidden", "style", "class"],
    });
    scheduleSync();

    return () => {
      observer.disconnect();
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [bridge, hostState.available, props.project.id]);

  if (!bridge || !hostState.available) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 p-4">
        <Card className="overflow-hidden border-border/70 bg-card/70 backdrop-blur-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Embedded browser unavailable</CardTitle>
            <CardDescription>
              {hostState.reason ??
                "This desktop session does not expose the embedded browser host. Open the page in your external browser instead."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button type="button" onClick={() => void api?.shell.openExternal(normalizedUrl)}>
              <ExternalLinkIcon className="size-3.5" />
              Open In Browser
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-2 p-2">
      {isChromeExpanded ? (
        <Card className="relative z-20">
          <CardContent className="space-y-1.5 p-2">
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                disabled={!sessionState.canGoBack}
                onClick={() =>
                  void bridge.goBackBrowserSession({
                    projectId: props.project.id,
                    sessionId: props.sessionId,
                  })
                }
              >
                <ArrowLeftIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                disabled={!sessionState.canGoForward}
                onClick={() =>
                  void bridge.goForwardBrowserSession({
                    projectId: props.project.id,
                    sessionId: props.sessionId,
                  })
                }
              >
                <ArrowRightIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  void bridge.reloadBrowserSession({
                    projectId: props.project.id,
                    sessionId: props.sessionId,
                  })
                }
              >
                <RefreshCwIcon className="size-3.5" />
                Refresh
              </Button>
              <Button
                type="button"
                size="xs"
                variant={sessionState.devToolsOpen ? "secondary" : "outline"}
                onClick={() =>
                  void bridge.toggleBrowserDevTools({
                    projectId: props.project.id,
                    sessionId: props.sessionId,
                  })
                }
              >
                <BugIcon className="size-3.5" />
                Inspect
              </Button>
              <div className="flex min-w-[12rem] flex-1 items-center gap-1.5 px-1.5">
                <Input
                  className="h-8"
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    submitDraftUrl();
                  }}
                  placeholder="Enter a URL"
                  aria-label={`${props.title} URL`}
                />
                <Button type="button" size="xs" onClick={submitDraftUrl}>
                  Go
                </Button>
              </div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  void api?.shell.openExternal(sessionState.currentUrl ?? normalizedUrl)
                }
              >
                <ExternalLinkIcon className="size-3.5" />
                External
              </Button>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    setBrowserViewport(props.project.id, {
                      devicePreset: browserState.devicePreset,
                      landscape: !browserState.landscape,
                    })
                  }
                >
                  <RotateCwIcon className="size-3.5" />
                  {browserState.landscape ? "Portrait" : "Landscape"}
                </Button>
                <BrowserViewportSelector
                  browserState={browserState}
                  projectId={props.project.id}
                  setBrowserViewport={setBrowserViewport}
                  onOpenChange={setViewportSelectorOpen}
                />
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  onClick={() => setIsChromeExpanded(false)}
                  aria-label="Collapse custom tab controls"
                >
                  <PanelTopCloseIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Rendered IN FLOW (not as an absolute overlay): the native BrowserView
        // always paints on top of the DOM, so an overlay here would be hidden
        // behind the page and the user could never reach these controls — e.g.
        // to bail out of a site that fails inside the embed (figma renders its
        // own client-side-error page that Tabs can't detect). Keeping the row in
        // flow positions the view below it, so Controls/External stay clickable.
        <div className="flex items-center justify-end">
          <div className="inline-flex items-center overflow-hidden rounded-full border border-border/80 bg-background/85 shadow-sm backdrop-blur-sm">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="rounded-none px-3"
              onClick={() => setIsChromeExpanded(true)}
              aria-label="Show custom tab controls"
            >
              <PanelTopOpenIcon className="size-3.5" />
              Controls
            </Button>
            <div className="h-4 w-px bg-border/80" />
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="rounded-none px-3"
              onClick={() => void api?.shell.openExternal(sessionState.currentUrl ?? normalizedUrl)}
              aria-label={`Open ${props.title} externally`}
            >
              <ExternalLinkIcon className="size-3.5" />
              External
            </Button>
          </div>
        </div>
      )}

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card p-1.5">
        {viewportSelectorOpen ? <BrowserViewportHiddenNotice /> : null}
        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden">
          <div
            className="relative overflow-hidden rounded-xl border border-border/70 bg-background shadow-lg"
            style={{
              width: viewportWidth ? `min(${viewportWidth}px, 100%)` : "100%",
              height: viewportHeight ? `min(${viewportHeight}px, 100%)` : "100%",
              minHeight: viewportHeight ? undefined : "100%",
            }}
          >
            <div ref={hostRef} className="absolute inset-0 bg-background" />
            {sessionState.loading ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-center justify-center border-b border-border/70 bg-background/80 text-sm text-muted-foreground backdrop-blur-sm">
                <LoaderIcon className="mr-2 size-4 animate-spin" />
                Loading page...
              </div>
            ) : null}
            {sessionState.lastError ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
                <Card className="pointer-events-auto max-w-lg">
                  <CardHeader>
                    <CardTitle>Page load failed</CardTitle>
                    <CardDescription>{sessionState.lastError}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        void bridge.reloadBrowserSession({
                          projectId: props.project.id,
                          sessionId: props.sessionId,
                        })
                      }
                    >
                      <RefreshCwIcon className="size-3.5" />
                      Retry
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void api?.shell.openExternal(sessionState.currentUrl ?? normalizedUrl)
                      }
                    >
                      <ExternalLinkIcon className="size-3.5" />
                      Open In Browser
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomEmbedTool(props: {
  project: Project;
  title: string;
  url: string;
  sessionId: string;
}) {
  if (window.desktopBridge) {
    return (
      <DesktopCustomEmbedTool
        project={props.project}
        title={props.title}
        url={props.url}
        sessionId={props.sessionId}
      />
    );
  }

  const api = readNativeApi();
  const [loading, setLoading] = useState(true);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const normalizedUrl = normalizeBrowserUrl(props.url);

  useEffect(() => {
    setLoading(true);
    setEmbedBlocked(false);
    const timeoutId = window.setTimeout(() => {
      setLoading(false);
      setEmbedBlocked(true);
    }, EMBED_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [normalizedUrl]);

  if (normalizedUrl.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Embed URL missing</CardTitle>
            <CardDescription>
              This custom tool does not have a URL yet. Add one in project settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{props.title}</div>
            <div className="truncate text-xs text-muted-foreground">{normalizedUrl}</div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void api?.shell.openExternal(normalizedUrl)}
          >
            <ExternalLinkIcon className="size-3.5" />
            External
          </Button>
        </CardContent>
      </Card>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/70 bg-card p-4">
        {embedBlocked ? (
          <div className="flex h-full min-h-[24rem] items-center justify-center">
            <Card className="max-w-lg">
              <CardHeader>
                <CardTitle>Embedding blocked</CardTitle>
                <CardDescription>
                  This site cannot be shown inside the IDE shell. Open it in your browser instead.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" onClick={() => void api?.shell.openExternal(normalizedUrl)}>
                  <ExternalLinkIcon className="size-3.5" />
                  Open In Browser
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full overflow-hidden rounded-2xl border border-border/70 bg-background">
            {loading ? (
              <div className="flex h-12 items-center justify-center border-b border-border/70 bg-muted/30 text-sm text-muted-foreground">
                <LoaderIcon className="mr-2 size-4 animate-spin" />
                Loading embed...
              </div>
            ) : null}
            <iframe
              title={props.title}
              src={normalizedUrl}
              sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
              className="h-full min-h-[32rem] w-full bg-white"
              onLoad={() => {
                setLoading(false);
                setEmbedBlocked(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CustomProcessTool(props: {
  project: Project;
  process: ProjectWorkspaceSettings["serverProcesses"][number];
  threadId: ThreadId;
  terminalState: NonNullable<ReturnType<typeof selectThreadTerminalState>>;
  focusRequestId: number;
  onRunProcess: (processId: string) => void;
  onRestartProcess: (processId: string) => void;
  onStopProcess: (processId: string) => void;
  onActivateTerminal: (terminalId: string) => void;
  onCloseTerminal: (terminalId: string) => void;
  onHeightChange: (height: number) => void;
}) {
  const autoStartedRef = useRef(false);
  const commands = useMemo(
    () =>
      props.process.commands
        .map((command) => command.trim())
        .filter((command) => command.length > 0),
    [props.process.commands],
  );
  const isRunning = Boolean(props.terminalState?.runningTerminalIds.includes(props.process.id));
  const hasTerminal = Boolean(props.terminalState?.terminalIds.includes(props.process.id));

  useEffect(() => {
    autoStartedRef.current = false;
  }, [props.process.id]);

  useEffect(() => {
    if (commands.length === 0 || isRunning || autoStartedRef.current) {
      return;
    }
    autoStartedRef.current = true;
    props.onRunProcess(props.process.id);
  }, [commands.length, isRunning, props.onRunProcess, props.process.id]);

  if (commands.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Terminal commands missing</CardTitle>
            <CardDescription>
              Add one or more commands in project settings before using this terminal tab.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      <div className="pointer-events-none absolute right-3 top-3 z-20">
        <div className="pointer-events-auto inline-flex items-center overflow-hidden rounded-md border border-border/80 bg-background/80 shadow-sm backdrop-blur-sm">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="rounded-none"
            onClick={() => props.onRestartProcess(props.process.id)}
            aria-label={`Restart ${props.process.label}`}
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
          <div className="h-4 w-px bg-border/80" />
          {isRunning ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="rounded-none"
              onClick={() => props.onStopProcess(props.process.id)}
              aria-label={`Stop ${props.process.label}`}
            >
              <PanelTopCloseIcon className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="rounded-none"
              onClick={() => props.onRunProcess(props.process.id)}
              aria-label={`Start ${props.process.label}`}
            >
              <PlayIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {hasTerminal && props.terminalState ? (
        <ThreadTerminalDrawer
          key={`${props.threadId}:${props.process.id}`}
          variant="embedded"
          showControls={false}
          threadId={props.threadId}
          cwd={props.process.cwd.trim().length > 0 ? props.process.cwd : props.project.cwd}
          runtimeEnv={projectScriptRuntimeEnv({
            project: { cwd: props.project.cwd },
            worktreePath: null,
          })}
          height={props.terminalState.terminalHeight}
          terminalIds={[props.process.id]}
          activeTerminalId={props.process.id}
          terminalGroups={[{ id: `group-${props.process.id}`, terminalIds: [props.process.id] }]}
          activeTerminalGroupId={`group-${props.process.id}`}
          focusRequestId={props.focusRequestId}
          onSplitTerminal={() => {}}
          onNewTerminal={() => {}}
          onActiveTerminalChange={props.onActivateTerminal}
          onCloseTerminal={props.onCloseTerminal}
          onHeightChange={props.onHeightChange}
          onAddTerminalContext={() => {}}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Starting {props.process.label}</CardTitle>
              <CardDescription>
                Running{" "}
                {commands.length === 1 ? "the configured command" : "the configured commands"} in
                the embedded terminal.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  );
}

function ServerTool(props: {
  project: Project;
  projectSettings: ProjectWorkspaceSettings;
  onOpenSettings: () => void;
  onRunProcess: (processId: string) => void;
  onRestartProcess: (processId: string) => void;
  onStopProcess: (processId: string) => void;
  onOpenProcessTerminal: (processId: string) => void;
  onRevealTerminal: () => void;
  onHideTerminal: () => void;
  onCloseAllTerminals: () => void;
  onSavePresets: (
    presets: Array<{
      id: string;
      label: string;
      commands: string[];
      cwd: string;
      autoStart: boolean;
    }>,
  ) => void;
  terminalVisible: boolean;
  terminalContent: ReactNode;
  terminalIds: ReadonlyArray<string>;
  runningProcessIds: ReadonlyArray<string>;
  activeTerminalId: string | null;
  hasTerminalWorkspace: boolean;
}) {
  // Server presets and custom "terminal tab" embeds share one `serverProcesses`
  // array (a custom_process tool references its process via `serverProcessId`).
  // The Server tab must only surface presets the user added *here* — never the
  // processes that back standalone terminal tabs (e.g. gemini/claude).
  const processes = useMemo(() => {
    const customProcessIds = new Set(
      props.projectSettings.tools.flatMap((tool) =>
        tool.kind === "custom_process" && tool.serverProcessId != null
          ? [tool.serverProcessId]
          : [],
      ),
    );
    return props.projectSettings.serverProcesses.filter(
      (process) => !customProcessIds.has(process.id),
    );
  }, [props.projectSettings.serverProcesses, props.projectSettings.tools]);
  const terminalIdSet = new Set(props.terminalIds);
  const runningProcessIdSet = new Set(props.runningProcessIds);
  const [presetsExpanded, setPresetsExpanded] = useState(false);
  const hasRunnableCommands = useCallback(
    (commands: ReadonlyArray<string>) => commands.some((command) => command.trim().length > 0),
    [],
  );
  const togglePresetsExpanded = useCallback(() => {
    setPresetsExpanded((current) => !current);
  }, []);
  const normalizePresetDraft = useCallback(
    (preset: {
      id: string;
      label: string;
      commands: string[];
      cwd: string;
      autoStart: boolean;
    }) => ({
      id: preset.id,
      label: preset.label.trim(),
      commands: preset.commands
        .map((command) => command.trim())
        .filter((command) => command.length > 0),
      cwd: preset.cwd.trim(),
      autoStart: preset.autoStart,
    }),
    [],
  );
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [presetDialogMode, setPresetDialogMode] = useState<"add" | "manage">("manage");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const createBlankPreset = useCallback(
    () => ({
      id: `process-${randomUUID()}`,
      label: "",
      commands: [""],
      cwd: props.project.cwd,
      autoStart: false,
    }),
    [props.project.cwd],
  );
  const [presetDrafts, setPresetDrafts] = useState<
    Array<{ id: string; label: string; commands: string[]; cwd: string; autoStart: boolean }>
  >([]);
  const presetRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const resetPresetDrafts = useCallback(() => {
    setPresetDrafts(
      presetDialogMode === "add"
        ? [createBlankPreset()]
        : processes.length > 0
          ? processes.map((process) => ({
              id: process.id,
              label: process.label,
              commands: process.commands.length > 0 ? [...process.commands] : [""],
              cwd: process.cwd,
              autoStart: process.autoStart,
            }))
          : [createBlankPreset()],
    );
  }, [createBlankPreset, presetDialogMode, processes]);
  useEffect(() => {
    if (!isPresetDialogOpen) return;
    resetPresetDrafts();
  }, [isPresetDialogOpen, resetPresetDrafts]);
  useEffect(() => {
    if (!isPresetDialogOpen || !editingPresetId) return;
    const row = presetRowRefs.current[editingPresetId];
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const timer = window.setTimeout(() => {
      const input = row.querySelector("input");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [editingPresetId, isPresetDialogOpen, presetDrafts]);
  const addPresetRow = useCallback(() => {
    setPresetDrafts((current) => [...current, createBlankPreset()]);
  }, [createBlankPreset]);
  const movePresetRow = useCallback((presetId: string, direction: -1 | 1) => {
    setPresetDrafts((current) => {
      const presetIndex = current.findIndex((preset) => preset.id === presetId);
      if (presetIndex < 0) return current;
      const nextIndex = presetIndex + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      return moveListItem(current, presetIndex, nextIndex);
    });
  }, []);
  const updatePresetRow = useCallback(
    (
      presetId: string,
      updater: (preset: {
        id: string;
        label: string;
        commands: string[];
        cwd: string;
        autoStart: boolean;
      }) => {
        id: string;
        label: string;
        commands: string[];
        cwd: string;
        autoStart: boolean;
      },
    ) => {
      setPresetDrafts((current) =>
        current.map((preset) => (preset.id === presetId ? updater(preset) : preset)),
      );
    },
    [],
  );
  const addCommandStep = useCallback((presetId: string) => {
    setPresetDrafts((current) =>
      current.map((preset) =>
        preset.id === presetId ? { ...preset, commands: [...preset.commands, ""] } : preset,
      ),
    );
  }, []);
  const moveCommandStep = useCallback(
    (presetId: string, commandIndex: number, direction: -1 | 1) => {
      setPresetDrafts((current) =>
        current.map((preset) => {
          if (preset.id !== presetId) return preset;
          const nextIndex = commandIndex + direction;
          if (nextIndex < 0 || nextIndex >= preset.commands.length) return preset;
          return { ...preset, commands: moveListItem(preset.commands, commandIndex, nextIndex) };
        }),
      );
    },
    [],
  );
  const updateCommandStep = useCallback((presetId: string, commandIndex: number, value: string) => {
    setPresetDrafts((current) =>
      current.map((preset) =>
        preset.id === presetId
          ? {
              ...preset,
              commands: preset.commands.map((command, index) =>
                index === commandIndex ? value : command,
              ),
            }
          : preset,
      ),
    );
  }, []);
  const removeCommandStep = useCallback((presetId: string, commandIndex: number) => {
    setPresetDrafts((current) =>
      current.map((preset) => {
        if (preset.id !== presetId) return preset;
        const nextCommands = preset.commands.filter((_, index) => index !== commandIndex);
        return { ...preset, commands: nextCommands.length > 0 ? nextCommands : [""] };
      }),
    );
  }, []);
  const removePresetRow = useCallback(
    (presetId: string) => {
      setPresetDrafts((current) => {
        const next = current.filter((preset) => preset.id !== presetId);
        return next.length > 0 ? next : [createBlankPreset()];
      });
    },
    [createBlankPreset],
  );
  const hasIncompletePreset = presetDrafts.some((preset) => {
    const normalizedPreset = normalizePresetDraft(preset);
    const hasAnyValue =
      preset.label.trim().length > 0 ||
      preset.cwd.trim().length > 0 ||
      preset.autoStart ||
      preset.commands.some((command) => command.trim().length > 0);
    return (
      hasAnyValue && (normalizedPreset.label.length === 0 || normalizedPreset.commands.length === 0)
    );
  });
  const hasAtLeastOnePreset = presetDrafts.some((preset) => {
    const normalizedPreset = normalizePresetDraft(preset);
    return normalizedPreset.label.length > 0 && normalizedPreset.commands.length > 0;
  });
  const savePresets = useCallback(() => {
    if (hasIncompletePreset) return;
    const nextPresets = presetDrafts
      .map(normalizePresetDraft)
      .filter((preset) => preset.label.length > 0 && preset.commands.length > 0);
    props.onSavePresets(
      presetDialogMode === "add"
        ? [
            ...processes.map((process) => ({
              id: process.id,
              label: process.label,
              commands: [...process.commands],
              cwd: process.cwd,
              autoStart: process.autoStart,
            })),
            ...nextPresets,
          ]
        : nextPresets,
    );
    setPresetDialogMode("manage");
    setEditingPresetId(null);
    setIsPresetDialogOpen(false);
  }, [hasIncompletePreset, normalizePresetDraft, presetDialogMode, presetDrafts, processes, props]);
  const editingPreset = editingPresetId
    ? (processes.find((process) => process.id === editingPresetId) ?? null)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={props.terminalVisible ? props.onHideTerminal : props.onRevealTerminal}
          >
            <TerminalSquareIcon className="size-3.5" />
            {props.terminalVisible ? "Hide Terminal" : "Open Terminal"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setPresetDialogMode("add");
              setEditingPresetId(null);
              setIsPresetDialogOpen(true);
            }}
          >
            <PlusIcon className="size-3.5" />
            Add Preset
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={props.onOpenSettings}>
            <SettingsIcon className="size-3.5" />
            Settings
          </Button>
          {processes.length > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={togglePresetsExpanded}>
              {presetsExpanded ? (
                <PanelTopCloseIcon className="size-3.5" />
              ) : (
                <PanelTopOpenIcon className="size-3.5" />
              )}
              {presetsExpanded ? "Collapse Presets" : "Expand Presets"}
            </Button>
          ) : null}
          {props.hasTerminalWorkspace ? (
            <Button
              type="button"
              size="sm"
              variant="destructive-outline"
              onClick={props.onCloseAllTerminals}
            >
              <XIcon className="size-3.5" />
              Close All
            </Button>
          ) : null}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {processes.length === 0
            ? "Start with a clean terminal or add named presets for one-click server workflows."
            : "Use the same terminal UI as Agents. The buttons above launch your configured server presets and run each preset's steps in order."}
        </div>
        {processes.length > 0 ? (
          <ScrollArea className="mt-4 w-full">
            <div className="flex items-start gap-3 pb-1">
              {processes.map((process) => {
                const status = resolveServerPresetRuntimeStatus({
                  processId: process.id,
                  runningProcessIds: runningProcessIdSet,
                  terminalIds: terminalIdSet,
                });
                const hasTerminal = terminalIdSet.has(process.id);
                const isActive = props.activeTerminalId === process.id;
                const isExpanded = presetsExpanded;
                const primaryLabel =
                  status === "running" ? "Open" : status === "stopped" ? "Run Again" : "Run";
                const badgeVariant =
                  status === "running" ? "success" : status === "stopped" ? "warning" : "outline";
                const badgeLabel =
                  status === "running" ? "Running" : status === "stopped" ? "Stopped" : "Idle";
                const visibleCommands = process.commands.filter(
                  (command) => command.trim().length > 0,
                );
                const visibleCommandRows = visibleCommands.reduce<
                  Array<{ key: string; command: string; stepNumber: number }>
                >((rows, command) => {
                  const duplicateCount = rows.filter((row) => row.command === command).length;
                  rows.push({
                    key: `${process.id}-${command || "blank"}-${duplicateCount}`,
                    command,
                    stepNumber: rows.length + 1,
                  });
                  return rows;
                }, []);

                if (!isExpanded) {
                  return (
                    <div
                      key={process.id}
                      className={cn(
                        "flex shrink-0 items-center overflow-hidden rounded-full border border-input bg-popover shadow-xs/5",
                        isActive && "border-primary/35 bg-accent/60",
                      )}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!hasRunnableCommands(process.commands)}
                        onClick={() =>
                          status === "running"
                            ? props.onOpenProcessTerminal(process.id)
                            : props.onRunProcess(process.id)
                        }
                        className={cn(
                          "max-w-[14rem] rounded-none border-0 bg-transparent px-3 shadow-none hover:bg-transparent",
                          isActive && "text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block size-2 rounded-full",
                            status === "running"
                              ? "bg-success"
                              : status === "stopped"
                                ? "bg-warning"
                                : "bg-muted-foreground/50",
                          )}
                        />
                        <span className="truncate">{process.label}</span>
                      </Button>
                    </div>
                  );
                }

                return (
                  <Card
                    key={process.id}
                    className={cn(
                      "w-[24rem] shrink-0 border-border/70 bg-card/70 shadow-xs",
                      isActive && "border-primary/35 bg-card shadow-primary/8 shadow-lg",
                    )}
                  >
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="truncate text-[1.3rem] leading-none">
                            {process.label}
                          </CardTitle>
                          <CardDescription className="truncate text-sm">
                            {process.cwd.trim().length > 0 ? process.cwd : props.project.cwd}
                          </CardDescription>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          <Badge variant={badgeVariant} size="sm" className="rounded-full px-2.5">
                            <span
                              className={cn(
                                "inline-block size-1.5 rounded-full",
                                status === "running"
                                  ? "bg-success"
                                  : status === "stopped"
                                    ? "bg-warning"
                                    : "bg-muted-foreground/50",
                              )}
                            />
                            {badgeLabel}
                          </Badge>
                          {process.autoStart ? (
                            <Badge variant="secondary" size="sm" className="rounded-full px-2.5">
                              Auto-start
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      <div className="space-y-2">
                        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Command Steps
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/60 px-3 py-3 font-mono text-xs leading-6 text-muted-foreground">
                          {visibleCommandRows.length > 0 ? (
                            visibleCommandRows.map((row) => (
                              <div key={row.key} className="truncate">
                                <span className="mr-2 text-[10px] font-medium text-muted-foreground/70">
                                  {row.stepNumber}.
                                </span>
                                {row.command}
                              </div>
                            ))
                          ) : (
                            <span>No command steps configured</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={!hasRunnableCommands(process.commands)}
                          onClick={() =>
                            status === "running"
                              ? props.onOpenProcessTerminal(process.id)
                              : props.onRunProcess(process.id)
                          }
                        >
                          <PlayIcon className="size-3.5" />
                          {primaryLabel}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPresetDialogMode("manage");
                            setEditingPresetId(process.id);
                            setIsPresetDialogOpen(true);
                          }}
                        >
                          <PencilIcon className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!hasRunnableCommands(process.commands)}
                          onClick={() => props.onRestartProcess(process.id)}
                        >
                          <RefreshCwIcon className="size-3.5" />
                          Restart
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!hasTerminal}
                          onClick={() => props.onStopProcess(process.id)}
                        >
                          <XIcon className="size-3.5" />
                          Stop
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        {props.terminalVisible ? (
          props.terminalContent
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <Card className="w-full max-w-2xl border-border/70 bg-card/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Server Workspace</CardTitle>
                <CardDescription>
                  Open a terminal for manual work or save presets like `Frontend` and `Backend` that
                  run in one click.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button type="button" onClick={props.onRevealTerminal}>
                  <TerminalSquareIcon className="size-3.5" />
                  Open Terminal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPresetDialogMode("add");
                    setEditingPresetId(null);
                    setIsPresetDialogOpen(true);
                  }}
                >
                  <PlusIcon className="size-3.5" />
                  Add Preset
                </Button>
                <Button type="button" variant="ghost" onClick={props.onOpenSettings}>
                  <SettingsIcon className="size-3.5" />
                  Settings
                </Button>
                {props.hasTerminalWorkspace ? (
                  <Button
                    type="button"
                    variant="destructive-outline"
                    onClick={props.onCloseAllTerminals}
                  >
                    <XIcon className="size-3.5" />
                    Close All
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Dialog
        open={isPresetDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPresetDialogMode("manage");
            setEditingPresetId(null);
          }
          setIsPresetDialogOpen(open);
        }}
      >
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {presetDialogMode === "add"
                ? "Add Preset"
                : editingPreset
                  ? `Edit ${editingPreset.label}`
                  : "Server Presets"}
            </DialogTitle>
            <DialogDescription>
              {presetDialogMode === "add"
                ? "Create a new one-click preset with ordered command steps."
                : editingPreset
                  ? "Update this preset's label, command steps, working directory, and auto-start behavior."
                  : "Create and manage one-click presets like `Frontend` or `Backend`, each with ordered command steps."}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {presetDialogMode === "add"
                    ? "New Preset"
                    : editingPreset
                      ? "Editing Preset"
                      : "Presets"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {presetDialogMode === "add"
                    ? "Start with a blank preset. You can add more blank presets here if needed."
                    : editingPreset
                      ? "You can still add or reorder other presets here, but the highlighted row is the one you opened from the Server card."
                      : "Add and arrange server presets in the order you want to see them."}
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addPresetRow}>
                <PlusIcon className="size-3.5" />
                {presetDialogMode === "add" || editingPreset ? "Add Another Preset" : "Add Preset"}
              </Button>
            </div>

            <div className="space-y-3">
              {presetDrafts.map((preset, index) => (
                <div
                  key={preset.id}
                  ref={(node) => {
                    presetRowRefs.current[preset.id] = node;
                  }}
                  className={cn(
                    "space-y-3 rounded-2xl border border-border/70 p-4",
                    editingPresetId === preset.id && "border-primary/50 ring-1 ring-primary/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground">Preset {index + 1}</div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => movePresetRow(preset.id, -1)}
                        aria-label={`Move preset ${index + 1} up`}
                      >
                        <ChevronUpIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        disabled={index === presetDrafts.length - 1}
                        onClick={() => movePresetRow(preset.id, 1)}
                        aria-label={`Move preset ${index + 1} down`}
                      >
                        <ChevronDownIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="outline"
                        onClick={() => removePresetRow(preset.id)}
                        aria-label={`Delete preset ${index + 1}`}
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Label</div>
                    <Input
                      value={preset.label}
                      onChange={(event) =>
                        updatePresetRow(preset.id, (current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      placeholder="Frontend"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">Command Steps</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addCommandStep(preset.id)}
                      >
                        <PlusIcon className="size-3.5" />
                        Add Step
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {preset.commands.map((command, commandIndex) => {
                        const stepKey = `${preset.id}-step-${commandIndex}`;
                        return (
                          <div key={stepKey} className="flex gap-2">
                            <div className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-border/70 bg-muted/20 text-xs font-medium text-muted-foreground">
                              {commandIndex + 1}
                            </div>
                            <Input
                              value={command}
                              onChange={(event) =>
                                updateCommandStep(preset.id, commandIndex, event.target.value)
                              }
                              placeholder={
                                commandIndex === 0
                                  ? "npm install"
                                  : commandIndex === 1
                                    ? "npm run dev"
                                    : "echo ready"
                              }
                            />
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              disabled={commandIndex === 0}
                              onClick={() => moveCommandStep(preset.id, commandIndex, -1)}
                              aria-label={`Move step ${commandIndex + 1} up`}
                            >
                              <ChevronUpIcon className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              disabled={commandIndex === preset.commands.length - 1}
                              onClick={() => moveCommandStep(preset.id, commandIndex, 1)}
                              aria-label={`Move step ${commandIndex + 1} down`}
                            >
                              <ChevronDownIcon className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              disabled={preset.commands.length === 1}
                              onClick={() => removeCommandStep(preset.id, commandIndex)}
                              aria-label={`Delete step ${commandIndex + 1}`}
                            >
                              <XIcon className="size-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Working Directory</div>
                    <Input
                      value={preset.cwd}
                      onChange={(event) =>
                        updatePresetRow(preset.id, (current) => ({
                          ...current,
                          cwd: event.target.value,
                        }))
                      }
                      placeholder={props.project.cwd}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Auto-start</div>
                      <div className="text-xs text-muted-foreground">
                        Launch this preset automatically when the Server tab opens.
                      </div>
                    </div>
                    <Switch
                      checked={preset.autoStart}
                      onCheckedChange={(checked) =>
                        updatePresetRow(preset.id, (current) => ({
                          ...current,
                          autoStart: Boolean(checked),
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            {hasIncompletePreset ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Each preset needs a label and at least one command step before saving.
              </div>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsPresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={savePresets}
              disabled={hasIncompletePreset || !hasAtLeastOnePreset}
            >
              Save Presets
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

export function WorkspaceShell(props: { agentsContent: ReactNode; settingsContent: ReactNode }) {
  useDesktopIconThemeSync();
  const navigate = useNavigate();
  const location = useLocation();
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });
  const projects = useStore((state) => state.projects);
  const threads = useStore((state) => state.threads);
  const { handleNewThread } = useHandleNewThread();
  const workspaceState = useWorkspaceShellStore((state) => state);
  const syncProjects = useWorkspaceShellStore((state) => state.syncProjects);
  const openProject = useWorkspaceShellStore((state) => state.openProject);
  const closeProject = useWorkspaceShellStore((state) => state.closeProject);
  const setActiveProject = useWorkspaceShellStore((state) => state.setActiveProject);
  const setActiveTool = useWorkspaceShellStore((state) => state.setActiveTool);
  const setCodeFocusedPath = useWorkspaceShellStore((state) => state.setCodeFocusedPath);
  const rememberThread = useWorkspaceShellStore((state) => state.rememberThread);
  const upsertProjectSettings = useWorkspaceShellStore((state) => state.upsertProjectSettings);
  const settings = useSettings();
  // Close a project tab, optionally asking for confirmation first. Gated by the
  // "Confirm before closing a tab" setting (Settings → General).
  const requestCloseProject = useCallback(
    async (projectId: ProjectId): Promise<boolean> => {
      if (settings.confirmTabClose) {
        const confirmed = await (readNativeApi() ?? ensureNativeApi()).dialogs.confirm(
          "Close this tab? Anything unsaved in it may be lost.",
        );
        if (!confirmed) return false;
      }
      closeProject(projectId);
      return true;
    },
    [closeProject, settings.confirmTabClose],
  );
  const threadsHydrated = useStore((state) => state.threadsHydrated);
  const embeddedMode = useMemo(() => resolveEmbeddedWorkspaceMode(), []);
  const embeddedProjectCreateRequestedRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait for the server read model to actually arrive before syncing. Until
    // then `projects` is the empty initial state, and syncing against it would
    // filter the persisted `openProjectIds` (and active tab) down to nothing
    // and then persist that empty result — wiping the restored workspace on
    // every launch. `threadsHydrated` flips true only once the snapshot (with
    // its projects) has been applied, so gating on it preserves the saved tabs.
    if (!threadsHydrated) {
      return;
    }
    syncProjects(projects, threads);
  }, [projects, syncProjects, threads, threadsHydrated]);

  useEffect(() => {
    if (!embeddedMode.enabled || !embeddedMode.workspaceRoot || !threadsHydrated) {
      return;
    }

    const existingProject =
      projects.find((project) => project.cwd === embeddedMode.workspaceRoot) ?? null;
    if (existingProject) {
      embeddedProjectCreateRequestedRef.current = null;
      openProject(existingProject.id);

      const projectSettings = workspaceState.projectSettingsByProjectId[existingProject.id];
      const toolId = projectSettings
        ? (resolveProjectTools(projectSettings).find(
            (tool) => tool.kind === embeddedMode.tool || tool.id === embeddedMode.tool,
          )?.id ?? null)
        : null;

      if (workspaceState.session.activeProjectId !== existingProject.id) {
        setActiveProject(existingProject.id);
      }
      if (toolId) {
        setActiveTool(existingProject.id, toolId);
      }
      if (location.pathname === "/settings") {
        void navigate({ to: "/" });
      }
      return;
    }

    if (embeddedProjectCreateRequestedRef.current === embeddedMode.workspaceRoot) {
      return;
    }

    const api = readNativeApi();
    if (!api) {
      return;
    }

    embeddedProjectCreateRequestedRef.current = embeddedMode.workspaceRoot;
    void api.orchestration
      .dispatchCommand({
        type: "project.create",
        commandId: newCommandId(),
        projectId: newProjectId(),
        title: basenameOfPath(embeddedMode.workspaceRoot),
        workspaceRoot: embeddedMode.workspaceRoot,
        defaultModelSelection: {
          provider: "codex",
          model: DEFAULT_MODEL_BY_PROVIDER.codex,
        },
        createdAt: new Date().toISOString(),
      })
      .catch((error) => {
        embeddedProjectCreateRequestedRef.current = null;
        toastManager.add({
          type: "error",
          title: "Could not attach workspace",
          description:
            error instanceof Error ? error.message : "The embedded workspace could not be created.",
        });
      });
  }, [
    embeddedMode.enabled,
    embeddedMode.tool,
    embeddedMode.workspaceRoot,
    location.pathname,
    navigate,
    openProject,
    projects,
    setActiveProject,
    setActiveTool,
    threadsHydrated,
    workspaceState.projectSettingsByProjectId,
    workspaceState.session.activeProjectId,
  ]);

  const activeThread = routeThreadId
    ? (threads.find((thread) => thread.id === routeThreadId) ?? null)
    : null;
  const routeProjectId = activeThread?.projectId ?? null;

  useEffect(() => {
    if (!routeThreadId || !routeProjectId) {
      return;
    }
    rememberThread(routeProjectId, routeThreadId);
    if (workspaceState.session.activeProjectId !== routeProjectId) {
      setActiveProject(routeProjectId);
    }
    setActiveTool(routeProjectId, "agents");
  }, [
    rememberThread,
    routeProjectId,
    routeThreadId,
    setActiveProject,
    setActiveTool,
    workspaceState.session.activeProjectId,
  ]);

  const activeProject = resolveProjectById(projects, workspaceState.session.activeProjectId);
  const openProjects = workspaceState.session.openProjectIds
    .map((projectId) => projects.find((project) => project.id === projectId) ?? null)
    .filter((project): project is Project => project !== null);
  const activeProjectSettings = useProjectWorkspaceSettings(activeProject?.id ?? null);
  const resolvedTools = activeProjectSettings ? resolveProjectTools(activeProjectSettings) : [];
  const activeToolId = activeProject
    ? (workspaceState.session.activeToolIdByProjectId[activeProject.id] ??
      resolvedTools[0]?.id ??
      "agents")
    : null;
  const activeTool = activeToolId
    ? (resolvedTools.find((tool) => tool.id === activeToolId) ?? null)
    : null;
  const activeToolSettings = resolvedTools;
  const availableTools = resolvedTools.map((tool) => ({
    id: tool.id,
    kind: tool.kind,
    label: tool.label,
  }));

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    void bridge.syncCodeSessions(workspaceState.session.openProjectIds).catch(() => undefined);
  }, [workspaceState.session.openProjectIds]);

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    void bridge.syncBrowserSessions(workspaceState.session.openProjectIds).catch(() => undefined);
  }, [workspaceState.session.openProjectIds]);

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge || activeTool?.kind === "code") {
      return;
    }
    void bridge.hideCodeSession().catch(() => undefined);
  }, [activeTool?.kind]);

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge || activeTool?.kind === "browser" || activeTool?.kind === "custom_embed") {
      return;
    }
    void bridge.hideBrowserSession().catch(() => undefined);
  }, [activeTool?.kind]);

  const focusProject = useCallback(
    async (projectId: ProjectId) => {
      openProject(projectId);
      if (location.pathname === "/settings") {
        return;
      }
      const targetToolId = workspaceState.session.activeToolIdByProjectId[projectId] ?? "agents";
      const targetToolKind =
        workspaceState.projectSettingsByProjectId[projectId]?.tools.find(
          (tool) => tool.id === targetToolId,
        )?.kind ?? (targetToolId === "agents" ? "agents" : null);
      if (targetToolKind === "agents") {
        const rememberedThread = resolveProjectAgentThread(
          projectId,
          threads,
          workspaceState.session.rememberedThreadIdByProjectId[projectId] ?? null,
        );
        if (rememberedThread) {
          await navigate({
            to: "/$threadId",
            params: { threadId: rememberedThread.id },
          });
          return;
        }
      }
      await navigate({ to: "/" });
    },
    [
      location.pathname,
      navigate,
      openProject,
      threads,
      workspaceState.projectSettingsByProjectId,
      workspaceState.session.activeToolIdByProjectId,
      workspaceState.session.rememberedThreadIdByProjectId,
    ],
  );

  const handleCreateProject = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    const cwd = await api.dialogs.pickFolder();
    if (!cwd) return;
    const existing = projects.find((project) => project.cwd === cwd);
    if (existing) {
      await focusProject(existing.id);
      return;
    }

    const projectId = newProjectId();
    const createdAt = new Date().toISOString();
    await api.orchestration.dispatchCommand({
      type: "project.create",
      commandId: newCommandId(),
      projectId,
      title: basenameOfPath(cwd),
      workspaceRoot: cwd,
      defaultModelSelection: {
        provider: "codex",
        model: DEFAULT_MODEL_BY_PROVIDER.codex,
      },
      createdAt,
    });
    openProject(projectId);
    setActiveProject(projectId);
    setActiveTool(projectId, "code");
    await navigate({ to: "/" });
  }, [focusProject, navigate, openProject, projects, setActiveProject, setActiveTool]);

  // Browser-like tab keyboard shortcuts, driven by application-menu accelerators
  // (cmd/ctrl + T / W / 1..9 / shift+[ ] / ctrl+Tab). Using menu accelerators —
  // not a window keydown listener — means they fire even when focus is inside an
  // embedded Code-OSS or Browser BrowserView, so they work everywhere in Tabs.
  const tabShortcutStateRef = useRef({
    openProjects,
    activeProjectId: workspaceState.session.activeProjectId,
  });
  tabShortcutStateRef.current = {
    openProjects,
    activeProjectId: workspaceState.session.activeProjectId,
  };
  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    return bridge.onMenuAction((action) => {
      const { openProjects: tabs, activeProjectId } = tabShortcutStateRef.current;
      const activate = (index: number) => {
        const target = tabs[index];
        if (target) setActiveProject(target.id);
      };
      const currentIndex = tabs.findIndex((project) => project.id === activeProjectId);
      const base = currentIndex < 0 ? 0 : currentIndex;
      switch (action) {
        case "tab-new":
          void handleCreateProject();
          return;
        case "tab-close":
          if (activeProjectId) void requestCloseProject(activeProjectId);
          return;
        case "tab-next":
          if (tabs.length > 0) activate((base + 1) % tabs.length);
          return;
        case "tab-prev":
          if (tabs.length > 0) activate((base - 1 + tabs.length) % tabs.length);
          return;
        default: {
          const goMatch = /^tab-go-([1-9])$/.exec(action);
          if (goMatch && tabs.length > 0) {
            const requested = Number(goMatch[1]);
            activate(requested === 9 ? tabs.length - 1 : Math.min(requested - 1, tabs.length - 1));
          }
        }
      }
    });
  }, [handleCreateProject, requestCloseProject, setActiveProject]);

  const ensureProjectForWorkspaceRoot = useCallback(
    async (workspaceRoot: string): Promise<ProjectId> => {
      const existing = projects.find((project) => project.cwd === workspaceRoot);
      if (existing) {
        openProject(existing.id);
        return existing.id;
      }

      const projectId = newProjectId();
      await ensureNativeApi().orchestration.dispatchCommand({
        type: "project.create",
        commandId: newCommandId(),
        projectId,
        title: basenameOfPath(workspaceRoot),
        workspaceRoot,
        defaultModelSelection: {
          provider: "codex",
          model: DEFAULT_MODEL_BY_PROVIDER.codex,
        },
        createdAt: new Date().toISOString(),
      });
      openProject(projectId);
      return projectId;
    },
    [openProject, projects],
  );

  const handleOpenProjectRepository = useCallback(async () => {
    await handleCreateProject();
  }, [handleCreateProject]);

  const handleOpenProjectFile = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    const filePath = await api.dialogs.pickFile();
    if (!filePath) return;

    const workspaceRoot = dirnameOfPath(filePath);
    if (!workspaceRoot) {
      toastManager.add({
        type: "error",
        title: "Could not open file",
        description: "The selected file does not have a usable parent folder.",
      });
      return;
    }

    const relativePath = relativePathFromParent(workspaceRoot, filePath);
    if (!relativePath) {
      toastManager.add({
        type: "error",
        title: "Could not open file",
        description: "Tabs could not resolve the selected file inside its project folder.",
      });
      return;
    }

    const projectId = await ensureProjectForWorkspaceRoot(workspaceRoot);
    setActiveProject(projectId);
    setActiveTool(projectId, "code");
    setCodeFocusedPath(projectId, relativePath);
    await navigate({ to: "/" });
  }, [
    ensureProjectForWorkspaceRoot,
    navigate,
    setActiveProject,
    setActiveTool,
    setCodeFocusedPath,
  ]);

  const openAgentsForProject = useCallback(
    async (projectId: ProjectId) => {
      const targetThread = resolveProjectAgentThread(
        projectId,
        threads,
        workspaceState.session.rememberedThreadIdByProjectId[projectId] ?? null,
      );
      setActiveProject(projectId);
      setActiveTool(projectId, "agents");
      if (targetThread) {
        await navigate({
          to: "/$threadId",
          params: { threadId: targetThread.id },
        });
        return;
      }
      await navigate({ to: "/" });
    },
    [
      navigate,
      setActiveProject,
      setActiveTool,
      threads,
      workspaceState.session.rememberedThreadIdByProjectId,
    ],
  );

  const createAgentsThreadForProject = useCallback(
    async (projectId: ProjectId) => {
      setActiveProject(projectId);
      setActiveTool(projectId, "agents");
      await handleNewThread(projectId, {
        envMode: settings.defaultThreadEnvMode,
      });
    },
    [handleNewThread, setActiveProject, setActiveTool, settings.defaultThreadEnvMode],
  );

  const handleSelectTool = useCallback(
    async (toolId: string) => {
      if (!activeProject || !activeToolSettings) {
        return;
      }
      const nextTool =
        activeToolSettings.find((tool) => tool.id === toolId) ?? activeToolSettings[0] ?? null;
      if (!nextTool) {
        return;
      }
      setActiveTool(activeProject.id, nextTool.id);
      if (location.pathname === "/settings") {
        return;
      }
      if (nextTool.kind === "agents") {
        const nextThread = resolveProjectAgentThread(
          activeProject.id,
          threads,
          workspaceState.session.rememberedThreadIdByProjectId[activeProject.id] ?? null,
        );
        if (nextThread) {
          await navigate({
            to: "/$threadId",
            params: { threadId: nextThread.id },
          });
          return;
        }
      } else if (location.pathname !== "/") {
        await navigate({ to: "/" });
      }
    },
    [
      activeProject,
      activeToolSettings,
      location.pathname,
      navigate,
      setActiveTool,
      threads,
      workspaceState.session.rememberedThreadIdByProjectId,
    ],
  );

  // Tool-switching shortcuts (cmd/ctrl+alt+1..9 → the Nth visible tool of the
  // active project), via menu accelerators so they work everywhere — including
  // inside the embedded editor/browser views.
  const toolShortcutRef = useRef({ availableTools, switchTool: handleSelectTool });
  toolShortcutRef.current = { availableTools, switchTool: handleSelectTool };
  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    return bridge.onMenuAction((action) => {
      const match = /^tool-go-([1-9])$/.exec(action);
      if (!match) return;
      const { availableTools: tools, switchTool } = toolShortcutRef.current;
      const target = tools[Number(match[1]) - 1];
      if (target) void switchTool(target.id);
    });
  }, []);

  const rememberedThreadId = activeProject
    ? (workspaceState.session.rememberedThreadIdByProjectId[activeProject.id] ?? null)
    : null;
  const rememberedThread =
    rememberedThreadId && activeProject
      ? (threads.find(
          (thread) => thread.id === rememberedThreadId && thread.projectId === activeProject.id,
        ) ?? null)
      : null;
  const gitActionThreadId = rememberedThread?.id ?? routeThreadId ?? null;
  const gitTerminalThreadId = activeProject ? ThreadId.makeUnsafe(`git:${activeProject.id}`) : null;
  const serverThreadId = activeProject ? ThreadId.makeUnsafe(`server:${activeProject.id}`) : null;
  const gitTerminalState = useTerminalStateStore((state) =>
    gitTerminalThreadId
      ? selectThreadTerminalState(state.terminalStateByThreadId, gitTerminalThreadId)
      : null,
  );
  const serverTerminalState = useTerminalStateStore((state) =>
    serverThreadId
      ? selectThreadTerminalState(state.terminalStateByThreadId, serverThreadId)
      : null,
  );
  // Custom "terminal tab" embeds (gemini/codex/etc.) must run in their OWN
  // terminal thread — never the shared `server:<project>` thread — so their
  // terminals don't leak into the Server tab's terminal list. Only the active
  // custom_process tab needs a live thread at a time.
  const activeCustomProcessId =
    activeTool?.kind === "custom_process" ? (activeTool.serverProcessId ?? null) : null;
  const customProcessThreadId =
    activeProject && activeCustomProcessId
      ? ThreadId.makeUnsafe(`server:${activeProject.id}:custom:${activeCustomProcessId}`)
      : null;
  const customProcessTerminalState = useTerminalStateStore((state) =>
    customProcessThreadId
      ? selectThreadTerminalState(state.terminalStateByThreadId, customProcessThreadId)
      : null,
  );
  const storeSetTerminalOpen = useTerminalStateStore((state) => state.setTerminalOpen);
  const storeSetTerminalHeight = useTerminalStateStore((state) => state.setTerminalHeight);
  const storeSplitTerminal = useTerminalStateStore((state) => state.splitTerminal);
  const storeNewTerminal = useTerminalStateStore((state) => state.newTerminal);
  const storeSetActiveTerminal = useTerminalStateStore((state) => state.setActiveTerminal);
  const storeCloseTerminal = useTerminalStateStore((state) => state.closeTerminal);
  const storeClearTerminalState = useTerminalStateStore((state) => state.clearTerminalState);
  const [shellTerminalFocusRequestId, setShellTerminalFocusRequestId] = useState(0);

  const setGitTerminalOpen = useCallback(
    (open: boolean) => {
      if (!gitTerminalThreadId) return;
      storeSetTerminalOpen(gitTerminalThreadId, open);
    },
    [gitTerminalThreadId, storeSetTerminalOpen],
  );
  const toggleGitTerminalVisibility = useCallback(() => {
    if (!gitTerminalThreadId || !gitTerminalState) return;
    setGitTerminalOpen(!gitTerminalState.terminalOpen);
    if (!gitTerminalState.terminalOpen) {
      setShellTerminalFocusRequestId((value) => value + 1);
    }
  }, [gitTerminalState, gitTerminalThreadId, setGitTerminalOpen]);
  const setGitTerminalHeight = useCallback(
    (height: number) => {
      if (!gitTerminalThreadId) return;
      storeSetTerminalHeight(gitTerminalThreadId, height);
    },
    [gitTerminalThreadId, storeSetTerminalHeight],
  );
  const splitGitTerminal = useCallback(() => {
    if (!gitTerminalThreadId) return;
    storeSplitTerminal(gitTerminalThreadId, `terminal-${randomUUID()}`);
    setShellTerminalFocusRequestId((value) => value + 1);
  }, [gitTerminalThreadId, storeSplitTerminal]);
  const createNewGitTerminal = useCallback(() => {
    if (!gitTerminalThreadId) return;
    storeNewTerminal(gitTerminalThreadId, `terminal-${randomUUID()}`);
    setShellTerminalFocusRequestId((value) => value + 1);
  }, [gitTerminalThreadId, storeNewTerminal]);
  const activateGitTerminal = useCallback(
    (terminalId: string) => {
      if (!gitTerminalThreadId) return;
      storeSetActiveTerminal(gitTerminalThreadId, terminalId);
      setShellTerminalFocusRequestId((value) => value + 1);
    },
    [gitTerminalThreadId, storeSetActiveTerminal],
  );
  const closeGitTerminal = useCallback(
    (terminalId: string) => {
      const api = readNativeApi();
      if (!gitTerminalThreadId || !api || !gitTerminalState) return;
      const isFinalTerminal = gitTerminalState.terminalIds.length <= 1;
      const fallbackExitWrite = () =>
        api.terminal
          .write({ threadId: gitTerminalThreadId, terminalId, data: "exit\n" })
          .catch(() => undefined);
      if ("close" in api.terminal && typeof api.terminal.close === "function") {
        void (async () => {
          if (isFinalTerminal) {
            await api.terminal
              .clear({ threadId: gitTerminalThreadId, terminalId })
              .catch(() => undefined);
          }
          await api.terminal.close({
            threadId: gitTerminalThreadId,
            terminalId,
            deleteHistory: true,
          });
        })().catch(() => fallbackExitWrite());
      } else {
        void fallbackExitWrite();
      }
      storeCloseTerminal(gitTerminalThreadId, terminalId);
      setShellTerminalFocusRequestId((value) => value + 1);
    },
    [gitTerminalState, gitTerminalThreadId, storeCloseTerminal],
  );
  const setServerTerminalOpen = useCallback(
    (open: boolean) => {
      if (!serverThreadId) return;
      storeSetTerminalOpen(serverThreadId, open);
    },
    [serverThreadId, storeSetTerminalOpen],
  );
  const revealServerTerminal = useCallback(() => {
    if (!serverThreadId) return;
    setServerTerminalOpen(true);
    setShellTerminalFocusRequestId((value) => value + 1);
  }, [serverThreadId, setServerTerminalOpen]);
  const hideServerTerminal = useCallback(() => {
    if (!serverThreadId) return;
    setServerTerminalOpen(false);
  }, [serverThreadId, setServerTerminalOpen]);
  const setServerTerminalHeight = useCallback(
    (height: number) => {
      if (!serverThreadId) return;
      storeSetTerminalHeight(serverThreadId, height);
    },
    [serverThreadId, storeSetTerminalHeight],
  );
  const splitServerTerminal = useCallback(() => {
    if (!serverThreadId) return;
    storeSplitTerminal(serverThreadId, `terminal-${randomUUID()}`);
    setShellTerminalFocusRequestId((value) => value + 1);
  }, [serverThreadId, storeSplitTerminal]);
  const createNewServerTerminal = useCallback(() => {
    if (!serverThreadId) return;
    storeNewTerminal(serverThreadId, `terminal-${randomUUID()}`);
    setShellTerminalFocusRequestId((value) => value + 1);
  }, [serverThreadId, storeNewTerminal]);
  const activateServerTerminal = useCallback(
    (terminalId: string) => {
      if (!serverThreadId) return;
      storeSetActiveTerminal(serverThreadId, terminalId);
      setShellTerminalFocusRequestId((value) => value + 1);
    },
    [serverThreadId, storeSetActiveTerminal],
  );
  const focusServerProcessTerminal = useCallback(
    (terminalId: string) => {
      if (!serverThreadId || !serverTerminalState?.terminalIds.includes(terminalId)) return;
      revealServerTerminal();
      activateServerTerminal(terminalId);
    },
    [
      activateServerTerminal,
      revealServerTerminal,
      serverTerminalState?.terminalIds,
      serverThreadId,
    ],
  );
  // ── Thread-parameterized terminal/process cores ──────────────────────
  // Shared by the Server tab (server thread) and each custom terminal tab
  // (its own isolated thread) so the two never cross-contaminate.
  const openProcessTerminal = useCallback(
    async (input: {
      threadId: ThreadId;
      terminalState: ReturnType<typeof selectThreadTerminalState> | null;
      process: ProjectWorkspaceSettings["serverProcesses"][number];
      reveal: boolean;
    }) => {
      const api = readNativeApi();
      if (!api || !activeProject) return;
      const commands = input.process.commands
        .map((command) => command.trim())
        .filter((command) => command.length > 0);
      if (commands.length === 0) return;
      const terminalId = input.process.id || DEFAULT_THREAD_TERMINAL_ID;
      const cwd = input.process.cwd.trim().length > 0 ? input.process.cwd : activeProject.cwd;
      const env = input.process.env;
      if (input.reveal) {
        storeSetTerminalOpen(input.threadId, true);
      }
      if (input.terminalState?.terminalIds.includes(terminalId)) {
        storeSetActiveTerminal(input.threadId, terminalId);
      } else {
        storeNewTerminal(input.threadId, terminalId);
      }
      setShellTerminalFocusRequestId((value) => value + 1);
      try {
        await api.terminal.open({ threadId: input.threadId, terminalId, cwd, env });
        for (const command of commands) {
          await api.terminal.write({ threadId: input.threadId, terminalId, data: `${command}\r` });
        }
      } catch (error) {
        toastManager.add({
          type: "error",
          title: `Could not run "${input.process.label}"`,
          description: error instanceof Error ? error.message : "Terminal startup failed.",
        });
      }
    },
    [activeProject, storeNewTerminal, storeSetActiveTerminal, storeSetTerminalOpen],
  );
  const closeThreadTerminal = useCallback(
    async (input: {
      threadId: ThreadId;
      terminalState: ReturnType<typeof selectThreadTerminalState> | null;
      terminalId: string;
      clearIfFinal: boolean;
    }) => {
      const api = readNativeApi();
      const isFinalTerminal = (input.terminalState?.terminalIds.length ?? 0) <= 1;
      const fallbackExitWrite = () =>
        api?.terminal
          .write({ threadId: input.threadId, terminalId: input.terminalId, data: "exit\n" })
          .catch(() => undefined) ?? Promise.resolve();
      if (api && "close" in api.terminal && typeof api.terminal.close === "function") {
        try {
          if (input.clearIfFinal && isFinalTerminal) {
            await api.terminal
              .clear({ threadId: input.threadId, terminalId: input.terminalId })
              .catch(() => undefined);
          }
          await api.terminal.close({
            threadId: input.threadId,
            terminalId: input.terminalId,
            deleteHistory: true,
          });
        } catch {
          await fallbackExitWrite().catch(() => undefined);
        }
      } else {
        await fallbackExitWrite().catch(() => undefined);
      }
      storeCloseTerminal(input.threadId, input.terminalId);
      setShellTerminalFocusRequestId((value) => value + 1);
    },
    [storeCloseTerminal],
  );
  const closeServerTerminal = useCallback(
    (terminalId: string) => {
      const api = readNativeApi();
      if (!serverThreadId || !api || !serverTerminalState) return;
      const isFinalTerminal = serverTerminalState.terminalIds.length <= 1;
      const fallbackExitWrite = () =>
        api.terminal
          .write({ threadId: serverThreadId, terminalId, data: "exit\n" })
          .catch(() => undefined);
      if ("close" in api.terminal && typeof api.terminal.close === "function") {
        void (async () => {
          if (isFinalTerminal) {
            await api.terminal
              .clear({ threadId: serverThreadId, terminalId })
              .catch(() => undefined);
          }
          await api.terminal.close({ threadId: serverThreadId, terminalId, deleteHistory: true });
        })().catch(() => fallbackExitWrite());
      } else {
        void fallbackExitWrite();
      }
      storeCloseTerminal(serverThreadId, terminalId);
      setShellTerminalFocusRequestId((value) => value + 1);
    },
    [serverTerminalState, serverThreadId, storeCloseTerminal],
  );
  const stopServerProcess = useCallback(
    async (processId: string) => {
      const api = readNativeApi();
      if (!serverThreadId || !serverTerminalState?.terminalIds.includes(processId)) {
        return;
      }
      const fallbackExitWrite = () =>
        api?.terminal.write({ threadId: serverThreadId, terminalId: processId, data: "exit\n" }) ??
        Promise.resolve();

      try {
        if (api && "close" in api.terminal && typeof api.terminal.close === "function") {
          await api.terminal.close({
            threadId: serverThreadId,
            terminalId: processId,
            deleteHistory: true,
          });
        } else {
          await fallbackExitWrite();
        }
      } catch {
        await fallbackExitWrite().catch(() => undefined);
      } finally {
        storeCloseTerminal(serverThreadId, processId);
        setShellTerminalFocusRequestId((value) => value + 1);
      }
    },
    [serverTerminalState?.terminalIds, serverThreadId, storeCloseTerminal],
  );
  const runServerProcess = useCallback(
    async (processId: string) => {
      if (!activeProjectSettings || !serverThreadId) return;
      const process = activeProjectSettings.serverProcesses.find((entry) => entry.id === processId);
      if (!process) return;
      revealServerTerminal();
      await openProcessTerminal({
        threadId: serverThreadId,
        terminalState: serverTerminalState,
        process,
        reveal: true,
      });
    },
    [
      activeProjectSettings,
      openProcessTerminal,
      revealServerTerminal,
      serverTerminalState,
      serverThreadId,
    ],
  );
  const restartServerProcess = useCallback(
    async (processId: string) => {
      await stopServerProcess(processId);
      await runServerProcess(processId);
    },
    [runServerProcess, stopServerProcess],
  );
  // ── Custom terminal-tab handlers (isolated per-process thread) ────────
  const runCustomProcess = useCallback(
    async (process: ProjectWorkspaceSettings["serverProcesses"][number], threadId: ThreadId) => {
      await openProcessTerminal({
        threadId,
        terminalState: selectThreadTerminalState(
          useTerminalStateStore.getState().terminalStateByThreadId,
          threadId,
        ),
        process,
        reveal: true,
      });
    },
    [openProcessTerminal],
  );
  const stopCustomProcess = useCallback(
    async (terminalId: string, threadId: ThreadId) => {
      await closeThreadTerminal({
        threadId,
        terminalState: selectThreadTerminalState(
          useTerminalStateStore.getState().terminalStateByThreadId,
          threadId,
        ),
        terminalId,
        clearIfFinal: false,
      });
    },
    [closeThreadTerminal],
  );
  const closeAllServerTerminals = useCallback(async () => {
    const api = readNativeApi();
    if (!serverThreadId || !serverTerminalState) {
      return;
    }
    const terminalIds = [...new Set(serverTerminalState.terminalIds)];
    await Promise.all(
      terminalIds.map(async (terminalId) => {
        const fallbackExitWrite = () =>
          api?.terminal.write({ threadId: serverThreadId, terminalId, data: "exit\n" }) ??
          Promise.resolve();

        try {
          if (api && "close" in api.terminal && typeof api.terminal.close === "function") {
            await api.terminal.close({ threadId: serverThreadId, terminalId, deleteHistory: true });
          } else {
            await fallbackExitWrite();
          }
        } catch {
          await fallbackExitWrite().catch(() => undefined);
        }
      }),
    );
    storeClearTerminalState(serverThreadId);
    serverAutoStartedProcessIdsRef.current.clear();
    setShellTerminalFocusRequestId((value) => value + 1);
  }, [serverTerminalState, serverThreadId, storeClearTerminalState]);

  const serverAutoStartedProcessIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    serverAutoStartedProcessIdsRef.current.clear();
  }, [activeProject?.id]);
  useEffect(() => {
    if (activeTool?.kind !== "server") {
      serverAutoStartedProcessIdsRef.current.clear();
    }
  }, [activeTool?.kind]);
  useEffect(() => {
    if (activeTool?.kind !== "server" || !activeProjectSettings) return;
    // Processes backing custom terminal tabs auto-start in their own tab — the
    // Server tab must not also launch them in the shared server thread.
    const customProcessIds = new Set(
      activeProjectSettings.tools.flatMap((tool) =>
        tool.kind === "custom_process" && tool.serverProcessId != null
          ? [tool.serverProcessId]
          : [],
      ),
    );
    for (const process of activeProjectSettings.serverProcesses) {
      if (customProcessIds.has(process.id)) continue;
      if (!process.autoStart || process.commands.every((command) => command.trim().length === 0)) {
        continue;
      }
      if (serverAutoStartedProcessIdsRef.current.has(process.id)) continue;
      serverAutoStartedProcessIdsRef.current.add(process.id);
      void runServerProcess(process.id);
    }
  }, [activeProjectSettings, activeTool?.kind, runServerProcess]);

  const gitTool = activeProject ? (
    <GitTool
      project={activeProject}
      activeThreadId={gitActionThreadId}
      terminalAvailable
      terminalOpen={Boolean(gitTerminalState?.terminalOpen)}
      onToggleTerminal={toggleGitTerminalVisibility}
      onOpenAgents={() => openAgentsForProject(activeProject.id)}
      onCreateAgentsThread={() => createAgentsThreadForProject(activeProject.id)}
    />
  ) : null;
  const browserTool =
    activeProject && activeProjectSettings ? (
      <BrowserTool project={activeProject} projectSettings={activeProjectSettings} />
    ) : null;
  const serverTool =
    activeProject && activeProjectSettings ? (
      <ServerTool
        project={activeProject}
        projectSettings={activeProjectSettings}
        onOpenSettings={() => void navigate({ to: "/settings" })}
        onRunProcess={(processId) => void runServerProcess(processId)}
        onRestartProcess={(processId) => void restartServerProcess(processId)}
        onStopProcess={(processId) => void stopServerProcess(processId)}
        onOpenProcessTerminal={focusServerProcessTerminal}
        onRevealTerminal={revealServerTerminal}
        onHideTerminal={hideServerTerminal}
        onCloseAllTerminals={() => void closeAllServerTerminals()}
        onSavePresets={(presets) =>
          upsertProjectSettings(activeProject.id, (current) => {
            // Preserve the processes that back custom terminal tabs — the Server
            // preset editor only manages presets created in the Server tab.
            const customProcessIds = new Set(
              current.tools.flatMap((tool) =>
                tool.kind === "custom_process" && tool.serverProcessId != null
                  ? [tool.serverProcessId]
                  : [],
              ),
            );
            return {
              ...current,
              serverProcesses: [
                ...current.serverProcesses.filter((process) => customProcessIds.has(process.id)),
                ...presets.map((preset) => ({
                  id: preset.id,
                  label: preset.label,
                  commands: preset.commands,
                  cwd: preset.cwd,
                  env: {},
                  autoStart: preset.autoStart,
                })),
              ],
            };
          })
        }
        terminalVisible={Boolean(serverTerminalState?.terminalOpen)}
        terminalIds={serverTerminalState?.terminalIds ?? []}
        runningProcessIds={serverTerminalState?.runningTerminalIds ?? []}
        activeTerminalId={serverTerminalState?.activeTerminalId ?? null}
        hasTerminalWorkspace={Boolean(
          serverTerminalState &&
          (serverTerminalState.terminalOpen ||
            serverTerminalState.runningTerminalIds.length > 0 ||
            serverTerminalState.terminalIds.some(
              (terminalId) => terminalId !== DEFAULT_THREAD_TERMINAL_ID,
            )),
        )}
        terminalContent={
          serverThreadId && serverTerminalState ? (
            <ThreadTerminalDrawer
              key={serverThreadId}
              variant="embedded"
              threadId={serverThreadId}
              cwd={activeProject.cwd}
              runtimeEnv={projectScriptRuntimeEnv({
                project: { cwd: activeProject.cwd },
                worktreePath: null,
              })}
              height={serverTerminalState.terminalHeight}
              terminalIds={serverTerminalState.terminalIds}
              activeTerminalId={serverTerminalState.activeTerminalId}
              terminalGroups={serverTerminalState.terminalGroups}
              activeTerminalGroupId={serverTerminalState.activeTerminalGroupId}
              focusRequestId={shellTerminalFocusRequestId}
              onSplitTerminal={splitServerTerminal}
              onNewTerminal={createNewServerTerminal}
              onActiveTerminalChange={activateServerTerminal}
              onCloseTerminal={closeServerTerminal}
              onHeightChange={setServerTerminalHeight}
              onAddTerminalContext={() => {}}
            />
          ) : null
        }
      />
    ) : null;
  const codeTool = activeProject ? <CodeTool project={activeProject} /> : null;
  const customEmbedTool =
    activeProject && activeProjectSettings && activeTool?.kind === "custom_embed"
      ? (() => {
          const embed = activeTool.customEmbedId
            ? (activeProjectSettings.customEmbeds.find(
                (entry) => entry.id === activeTool.customEmbedId,
              ) ?? null)
            : null;
          return embed ? (
            // Key by embed id so switching between custom browser tabs mounts a
            // fresh instance per session. Without it React reuses one instance
            // and only swaps props; the bounds/session effects (which don't list
            // sessionId as a dep) then never re-run for the newly selected tab,
            // leaving its BrowserView unpositioned (blank). The underlying
            // BrowserView is kept alive in the main process, so this does not
            // reload page content.
            <CustomEmbedTool
              key={embed.id}
              project={activeProject}
              title={embed.label}
              url={embed.url}
              sessionId={`custom-${embed.id}`}
            />
          ) : null;
        })()
      : null;
  const customProcessTool =
    activeProject &&
    activeProjectSettings &&
    activeTool?.kind === "custom_process" &&
    customProcessThreadId
      ? (() => {
          const process = activeTool.serverProcessId
            ? (activeProjectSettings.serverProcesses.find(
                (entry) => entry.id === activeTool.serverProcessId,
              ) ?? null)
            : null;
          const threadId = customProcessThreadId;
          return process ? (
            <CustomProcessTool
              key={process.id}
              project={activeProject}
              process={process}
              threadId={threadId}
              terminalState={customProcessTerminalState ?? selectThreadTerminalState({}, threadId)}
              focusRequestId={shellTerminalFocusRequestId}
              onRunProcess={() => void runCustomProcess(process, threadId)}
              onRestartProcess={() => {
                void (async () => {
                  await stopCustomProcess(process.id, threadId);
                  await runCustomProcess(process, threadId);
                })();
              }}
              onStopProcess={() => void stopCustomProcess(process.id, threadId)}
              onActivateTerminal={(terminalId) => {
                storeSetActiveTerminal(threadId, terminalId);
                setShellTerminalFocusRequestId((value) => value + 1);
              }}
              onCloseTerminal={(terminalId) => void stopCustomProcess(terminalId, threadId)}
              onHeightChange={(height) => storeSetTerminalHeight(threadId, height)}
            />
          ) : null;
        })()
      : null;

  const isSettingsRoute = location.pathname === "/settings";
  const shouldHideShellChrome = embeddedMode.enabled;
  const isEmbeddedWorkspacePending =
    embeddedMode.enabled &&
    Boolean(embeddedMode.workspaceRoot) &&
    (!activeProject || activeProject.cwd !== embeddedMode.workspaceRoot || !activeProjectSettings);

  let content: ReactNode;
  if (!threadsHydrated) {
    content = (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  } else if (isEmbeddedWorkspacePending) {
    content = (
      <div className="flex h-full items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md space-y-3">
          <div className="text-base font-medium text-foreground">Attaching workspace…</div>
          <div className="text-sm text-muted-foreground">
            Connecting the embedded Tabs panel to {embeddedMode.workspaceRoot}.
          </div>
        </div>
      </div>
    );
  } else if (isSettingsRoute) {
    content = props.settingsContent;
  } else if (!activeProject || !activeProjectSettings) {
    const recentProjects = projects
      .toSorted((left, right) =>
        (right.updatedAt ?? right.createdAt ?? "").localeCompare(
          left.updatedAt ?? left.createdAt ?? "",
        ),
      )
      .slice(0, 6);
    content = (
      <div className="flex h-full min-h-0 overflow-auto bg-background px-10 py-12">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <div className="space-y-2">
            <h1 className="text-4xl font-medium tracking-tight text-foreground">Welcome</h1>
            <p className="text-base text-muted-foreground">
              Open a local project to start using the workspace shell.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="space-y-5">
              <div>
                <div className="text-xl font-medium text-foreground">Start</div>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent/40"
                  onClick={() => void handleCreateProject()}
                >
                  <PlusIcon className="size-4 text-muted-foreground" />
                  <span>Add Project...</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent/40"
                  onClick={() => void handleOpenProjectFile()}
                >
                  <FolderSearchIcon className="size-4 text-muted-foreground" />
                  <span>Open File...</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent/40"
                  onClick={() => void handleOpenProjectRepository()}
                >
                  <GitBranchIcon className="size-4 text-muted-foreground" />
                  <span>Open Repository...</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent/40"
                  onClick={() => void navigate({ to: "/settings" })}
                >
                  <SettingsIcon className="size-4 text-muted-foreground" />
                  <span>Workspace Settings</span>
                </button>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="text-xl font-medium text-foreground">Recent</div>
              </div>
              {recentProjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                  No recent projects yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {recentProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-4 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/40"
                      onClick={() => void focusProject(project.id)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {project.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{project.cwd}</div>
                      </div>
                      <div className="shrink-0 pt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
                        Open
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  } else if (activeTool?.kind === "agents") {
    content = (
      <AgentsThreadList
        project={activeProject}
        threads={sortProjectThreads(
          threads.filter((thread) => thread.projectId === activeProject.id),
        )}
        activeThreadId={routeThreadId}
        onSelectThread={(threadId) =>
          void navigate({
            to: "/$threadId",
            params: { threadId },
          })
        }
        onCreateThread={() =>
          void handleNewThread(activeProject.id, {
            envMode: settings.defaultThreadEnvMode,
          })
        }
      >
        {props.agentsContent}
      </AgentsThreadList>
    );
  } else if (activeTool?.kind === "code") {
    content = codeTool;
  } else if (activeTool?.kind === "server") {
    content = serverTool;
  } else if (activeTool?.kind === "git") {
    content = gitTool;
  } else if (activeTool?.kind === "custom_embed") {
    content = customEmbedTool;
  } else if (activeTool?.kind === "custom_process") {
    content = customProcessTool;
  } else {
    content = browserTool;
  }

  return (
    <div className="flex h-dvh min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      {shouldHideShellChrome ? null : (
        <ProjectTabs
          projects={projects}
          openProjects={openProjects}
          activeProjectId={activeProject?.id ?? null}
          onActivateProject={(projectId) => void focusProject(projectId)}
          onCloseProject={(projectId) => {
            const wasActive = workspaceState.session.activeProjectId === projectId;
            void requestCloseProject(projectId).then((closed) => {
              if (!closed || !wasActive) return;
              const fallbackProjectId =
                workspaceState.session.openProjectIds.find((id) => id !== projectId) ?? null;
              if (fallbackProjectId) {
                void focusProject(fallbackProjectId);
              } else {
                void navigate({ to: "/" });
              }
            });
          }}
          onCreateProject={() => void handleCreateProject()}
          onOpenProject={(projectId) => void focusProject(projectId)}
        />
      )}

      {!shouldHideShellChrome && !isSettingsRoute && activeProject && availableTools.length > 0 ? (
        <ProjectToolBar
          activeToolId={activeTool?.id ?? ""}
          availableTools={availableTools}
          onSelectTool={(toolId) => void handleSelectTool(toolId)}
          onOpenSettings={() => void navigate({ to: "/settings" })}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{content}</div>

      {!shouldHideShellChrome &&
      activeTool?.kind === "git" &&
      activeProject &&
      gitTerminalThreadId &&
      gitTerminalState?.terminalOpen ? (
        <ThreadTerminalDrawer
          key={gitTerminalThreadId}
          threadId={gitTerminalThreadId}
          cwd={activeProject.cwd}
          runtimeEnv={projectScriptRuntimeEnv({
            project: { cwd: activeProject.cwd },
            worktreePath: null,
          })}
          height={gitTerminalState.terminalHeight}
          terminalIds={gitTerminalState.terminalIds}
          activeTerminalId={gitTerminalState.activeTerminalId}
          terminalGroups={gitTerminalState.terminalGroups}
          activeTerminalGroupId={gitTerminalState.activeTerminalGroupId}
          focusRequestId={shellTerminalFocusRequestId}
          onSplitTerminal={splitGitTerminal}
          onNewTerminal={createNewGitTerminal}
          onActiveTerminalChange={activateGitTerminal}
          onCloseTerminal={closeGitTerminal}
          onHeightChange={setGitTerminalHeight}
          onAddTerminalContext={() => {}}
        />
      ) : null}
    </div>
  );
}
