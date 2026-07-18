import { type ProjectWorkspaceSettings } from "@tabs/contracts/settings";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { MasterDetail, MasterDetailContent, MasterDetailItem, MasterDetailList, MasterDetailSidebar } from "./ui/master-detail";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { ServerPresetFormFields } from "./ServerPresetFormFields";

import { projectsAtom } from "../state/threads";
import { useAtomValue } from "@effect/atom-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Switch } from "./ui/switch";
import { cn } from "../lib/utils";
import {
  useProjectWorkspaceSettings,
  useWorkspaceActiveProjectId,
  workspaceShellActions,
} from "../state/workspaceShell";

function createCustomEmbedId() {
  return `embed-${crypto.randomUUID()}`;
}

function createCustomEmbedToolId(embedId: string) {
  return `custom-${embedId}`;
}

function createServerProcessId() {
  return `process-${crypto.randomUUID()}`;
}

function createServerProcessToolId(processId: string) {
  return `terminal-${processId}`;
}

function describeToolKind(kind: string) {
  switch (kind) {
    case "custom_embed":
      return "browser tab";
    case "custom_process":
      return "terminal tab";
    default:
      return kind;
  }
}

function reorderItems<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return [...items];
  }
  const reordered = [...items];
  const current = reordered[index];
  const target = reordered[nextIndex];
  if (!current || !target) {
    return reordered;
  }
  reordered[index] = target;
  reordered[nextIndex] = current;
  return reordered;
}

/**
 * Sortable wrapper for a toolbar-tool row. Provides the draggable node + drag
 * transform; the row renders its own drag handle via the `attributes`/`listeners`
 * passed to the render-prop child so the rest of the row stays interactive.
 */
function SortableToolRow({
  id,
  children,
}: {
  id: string;
  children: (handle: Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10")}
    >
      {children({ attributes, listeners })}
    </div>
  );
}

function mergeToolGroup(
  currentTools: ProjectWorkspaceSettings["tools"],
  replacementTools: ProjectWorkspaceSettings["tools"],
  kind: "custom_embed" | "custom_process",
  fallbackAfterKind: ProjectWorkspaceSettings["tools"][number]["kind"],
) {
  const firstExistingIndex = currentTools.findIndex((tool) => tool.kind === kind);
  const fallbackIndex = currentTools.findIndex((tool) => tool.kind === fallbackAfterKind);
  const filteredTools = currentTools.filter((tool) => tool.kind !== kind);
  const insertionIndex =
    firstExistingIndex >= 0
      ? Math.min(firstExistingIndex, filteredTools.length)
      : fallbackIndex >= 0
        ? Math.min(fallbackIndex + 1, filteredTools.length)
        : filteredTools.length;

  return [
    ...filteredTools.slice(0, insertionIndex),
    ...replacementTools,
    ...filteredTools.slice(insertionIndex),
  ];
}

function buildCustomEmbedToolsFromDrafts(drafts: readonly CustomEmbedDraft[]) {
  return drafts.map((draft) => ({
    id: createCustomEmbedToolId(draft.id),
    kind: "custom_embed" as const,
    label: draft.label.trim().length > 0 ? draft.label.trim() : "Untitled browser tab",
    visible: draft.visible,
    customEmbedId: draft.id,
  }));
}

function buildCustomProcessToolsFromDrafts(drafts: readonly ServerProcessDraft[]) {
  return drafts.map((draft) => ({
    id: createServerProcessToolId(draft.id),
    kind: "custom_process" as const,
    label: draft.label.trim().length > 0 ? draft.label.trim() : "Untitled terminal",
    visible: draft.visible,
    terminalProcessId: draft.id,
  }));
}

interface CustomEmbedDraft {
  id: string;
  label: string;
  url: string;
  visible: boolean;
  isNew: boolean;
  originalLabel: string;
  originalUrl: string;
  originalVisible: boolean;
}

export interface ServerProcessDraft {
  id: string;
  label: string;
  commands: string[];
  cwd: string;
  autoStart: boolean;
  visible: boolean;
  isNew: boolean;
  originalLabel: string;
  originalCommands: string[];
  originalCwd: string;
  originalAutoStart: boolean;
  originalVisible: boolean;
  previewUrl?: string | undefined;
  autoOpenPreview?: boolean | undefined;
  previewOpenTarget?: "in-app" | "external" | undefined;
  previewFocus?: boolean | undefined;
  dependsOn?: readonly string[] | undefined;
  originalPreviewUrl?: string | undefined;
  originalAutoOpenPreview?: boolean | undefined;
  originalPreviewOpenTarget?: "in-app" | "external" | undefined;
  originalPreviewFocus?: boolean | undefined;
  originalDependsOn?: readonly string[] | undefined;
}

function createCustomEmbedDrafts(settings: ProjectWorkspaceSettings): CustomEmbedDraft[] {
  return (settings.customEmbeds ?? []).map((embed) => {
    const tool = (settings.tools ?? []).find(
      (entry) => entry.kind === "custom_embed" && entry.customEmbedId === embed.id,
    );
    return {
      id: embed.id,
      label: embed.label,
      url: embed.url,
      visible: tool?.visible ?? true,
      isNew: false,
      originalLabel: embed.label,
      originalUrl: embed.url,
      originalVisible: tool?.visible ?? true,
    };
  });
}

function createTerminalProcessDrafts(settings: ProjectWorkspaceSettings): ServerProcessDraft[] {
  return (settings.terminalProcesses ?? []).map((process) => {
    const tool = (settings.tools ?? []).find(
      (entry) => entry.kind === "custom_process" && entry.terminalProcessId === process.id,
    );
    return {
      id: process.id,
      label: process.label,
      commands: process.commands.length > 0 ? [...process.commands] : [""],
      cwd: process.cwd,
      autoStart: process.autoStart,
      visible: tool?.visible ?? true,
      isNew: false,
      originalLabel: process.label,
      originalCommands: process.commands.length > 0 ? [...process.commands] : [""],
      originalCwd: process.cwd,
      originalAutoStart: process.autoStart,
      originalVisible: tool?.visible ?? true,
    };
  });
}


function createServerPresetDrafts(settings: ProjectWorkspaceSettings): ServerProcessDraft[] {
  return settings.serverPresets.map((process) => {
    return {
      id: process.id,
      label: process.label,
      commands: process.commands.length > 0 ? [...process.commands] : [""],
      cwd: process.cwd,
      autoStart: process.autoStart,
      visible: true,
      isNew: false,
      originalLabel: process.label,
      originalCommands: process.commands.length > 0 ? [...process.commands] : [""],
      originalCwd: process.cwd,
      originalAutoStart: process.autoStart,
      originalVisible: true,
      previewUrl: process.previewUrl,
      autoOpenPreview: process.autoOpenPreview,
      previewOpenTarget: process.previewOpenTarget,
      previewFocus: process.previewFocus,
      dependsOn: process.dependsOn,
      originalPreviewUrl: process.previewUrl,
      originalAutoOpenPreview: process.autoOpenPreview,
      originalPreviewOpenTarget: process.previewOpenTarget,
      originalPreviewFocus: process.previewFocus,
      originalDependsOn: process.dependsOn,
    };
  });
}

function isCustomEmbedDraftDirty(draft: CustomEmbedDraft) {
  return (
    draft.isNew ||
    draft.label !== draft.originalLabel ||
    draft.url !== draft.originalUrl ||
    draft.visible !== draft.originalVisible
  );
}

function isServerProcessDraftDirty(draft: ServerProcessDraft) {
  return (
    draft.isNew ||
    draft.label !== draft.originalLabel ||
    draft.cwd !== draft.originalCwd ||
    draft.autoStart !== draft.originalAutoStart ||
    draft.visible !== draft.originalVisible ||
    draft.previewUrl !== draft.originalPreviewUrl ||
    draft.autoOpenPreview !== draft.originalAutoOpenPreview ||
    draft.previewOpenTarget !== draft.originalPreviewOpenTarget ||
    draft.previewFocus !== draft.originalPreviewFocus ||
    JSON.stringify(draft.dependsOn) !== JSON.stringify(draft.originalDependsOn) ||
    draft.commands.length !== draft.originalCommands.length ||
    draft.commands.some((command, index) => command !== draft.originalCommands[index])
  );
}

export function ProjectWorkspaceSettingsSection() {
  const activeProjectId = useWorkspaceActiveProjectId();
  const activeProject = useAtomValue(projectsAtom, (state) =>
    activeProjectId
      ? (state.find((project) => project.id === activeProjectId) ?? null)
      : null,
  );
  const projectSettings = useProjectWorkspaceSettings(activeProjectId);
  const upsertProjectSettings = workspaceShellActions.upsertProjectSettings;
  const [customEmbedDrafts, setCustomEmbedDrafts] = useState<CustomEmbedDraft[]>([]);
  const [serverProcessDrafts, setServerProcessDrafts] = useState<ServerProcessDraft[]>([]);
  const [expandedToolbarToolIds, setExpandedToolbarToolIds] = useState<Record<string, boolean>>({});

  const [serverPresetDrafts, setServerPresetDrafts] = useState<ServerProcessDraft[]>([]);
  const [activeCustomEmbedId, setActiveCustomEmbedId] = useState<string | null>(null);
  const [activeServerProcessId, setActiveServerProcessId] = useState<string | null>(null);
  const [activeServerPresetId, setActiveServerPresetId] = useState<string | null>(null);

  const [pendingToggle, setPendingToggle] = useState<{
    toolId: string;
    toolLabel: string;
    toolKind: string;
    nextVisible: boolean;
  } | null>(null);

  const confirmToggle = useCallback(() => {
    if (!pendingToggle || !activeProjectId) return;
    const { toolId, toolKind, nextVisible } = pendingToggle;
    if (toolKind === "custom_embed") {
      setCustomEmbedDrafts((current) =>
        current.map((entry) =>
          createCustomEmbedToolId(entry.id) === toolId
            ? { ...entry, visible: nextVisible, originalVisible: nextVisible }
            : entry,
        ),
      );
    } else if (toolKind === "custom_process") {
      setServerProcessDrafts((current) =>
        current.map((entry) =>
          createServerProcessToolId(entry.id) === toolId
            ? { ...entry, visible: nextVisible, originalVisible: nextVisible }
            : entry,
        ),
      );
    }
    upsertProjectSettings(activeProjectId, (current) => ({
      ...current,
      tools: (current.tools ?? []).map((entry) =>
        entry.id === toolId ? { ...entry, visible: nextVisible } : entry,
      ),
    }));
    setPendingToggle(null);
  }, [activeProjectId, pendingToggle, upsertProjectSettings]);

  useEffect(() => {
    if (!projectSettings) {
      setCustomEmbedDrafts([]);
      setServerProcessDrafts([]);
      setServerPresetDrafts([]);
      return;
    }
    setCustomEmbedDrafts(createCustomEmbedDrafts(projectSettings));
    setServerProcessDrafts(createTerminalProcessDrafts(projectSettings));
    setServerPresetDrafts(createServerPresetDrafts(projectSettings));
  }, [projectSettings, activeProjectId]);

  const customEmbedsDirty = useMemo(
    () => customEmbedDrafts.some(isCustomEmbedDraftDirty),
    [customEmbedDrafts],
  );
  
  const serverPresetsDirty = useMemo(
    () => serverPresetDrafts.some(isServerProcessDraftDirty),
    [serverPresetDrafts],
  );

  const serverProcessesDirty = useMemo(
    () => serverProcessDrafts.some(isServerProcessDraftDirty),
    [serverProcessDrafts],
  );
  const toolbarPreviewTools = useMemo(() => {
    return projectSettings?.tools ?? [];
  }, [projectSettings?.tools]);

  const dndSensors = useSensors(
    // Require a small drag distance so taps/clicks on the row still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!activeProjectId || !activeProject || !projectSettings) {
    return (
      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Project Workspace
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>No active project</CardTitle>
            <CardDescription>
              Open or select a project tab first. These settings are persisted per project.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const projectId = activeProjectId;

  // Drag-to-reorder the toolbar tools. The preview list is a merge of saved
  // tools and (when edited) draft custom tabs/terminals, so persist the new
  // order to both the saved tool list and the draft arrays by rank.
  const handleReorderTools = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = toolbarPreviewTools.map((tool) => tool.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const rank = new Map(arrayMove(ids, from, to).map((id, position) => [id, position]));
    const rankOf = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
    upsertProjectSettings(projectId, (current) => ({
      ...current,
      tools: [...current.tools].sort((a, b) => rankOf(a.id) - rankOf(b.id)),
    }));
    setCustomEmbedDrafts((current) =>
      [...current].sort(
        (a, b) => rankOf(createCustomEmbedToolId(a.id)) - rankOf(createCustomEmbedToolId(b.id)),
      ),
    );
    setServerProcessDrafts((current) =>
      [...current].sort(
        (a, b) => rankOf(createServerProcessToolId(a.id)) - rankOf(createServerProcessToolId(b.id)),
      ),
    );
  };

  const removeCustomEmbedDraft = (embedId: string) => {
    setCustomEmbedDrafts((current) => current.filter((entry) => entry.id !== embedId));
  };

  const removeServerProcessDraft = (processId: string) => {
    setServerProcessDrafts((current) => current.filter((entry) => entry.id !== processId));
  };

  const saveCustomEmbeds = () => {
    upsertProjectSettings(projectId, (current) => {
      const nextCustomEmbeds = customEmbedDrafts.map((draft) => ({
        id: draft.id,
        label: draft.label.trim().length > 0 ? draft.label.trim() : "Untitled tab",
        url: draft.url.trim(),
      }));
      const nextCustomEmbedTools = customEmbedDrafts.map((draft, index) => ({
        id: createCustomEmbedToolId(draft.id),
        kind: "custom_embed" as const,
        label:
          nextCustomEmbeds[index]?.label ??
          (draft.label.trim().length > 0 ? draft.label.trim() : "Untitled tab"),
        visible: draft.visible,
        customEmbedId: draft.id,
      }));

      return {
        ...current,
        customEmbeds: nextCustomEmbeds,
        tools: mergeToolGroup(current.tools, nextCustomEmbedTools, "custom_embed", "browser"),
      };
    });
  };

  const saveServerProcesses = () => {
    upsertProjectSettings(projectId, (current) => {
      const nextServerProcesses = serverProcessDrafts.map((draft) => ({
        id: draft.id,
        label: draft.label.trim().length > 0 ? draft.label.trim() : "Untitled terminal",
        commands: draft.commands,
        cwd: draft.cwd,
        env: {},
        autoStart: draft.autoStart,
      }));
      const nextProcessTools = serverProcessDrafts.map((draft, index) => ({
        id: createServerProcessToolId(draft.id),
        kind: "custom_process" as const,
        label:
          nextServerProcesses[index]?.label ??
          (draft.label.trim().length > 0 ? draft.label.trim() : "Untitled terminal"),
        visible: draft.visible,
        terminalProcessId: draft.id,
      }));

      return {
        ...current,
        terminalProcesses: nextServerProcesses,
        tools: mergeToolGroup(current.tools, nextProcessTools, "custom_process", "server"),
      };
    });
  };

  const saveServerPresets = () => {
    upsertProjectSettings(projectId, (current) => ({
      ...current,
      serverPresets: serverPresetDrafts.map((draft) => {
        const res: any = {
          id: draft.id,
          label: draft.label.trim().length > 0 ? draft.label.trim() : "Untitled preset",
          commands: draft.commands,
          cwd: draft.cwd,
          env: {},
          autoStart: draft.autoStart,
        };
        if (draft.previewUrl !== undefined) res.previewUrl = draft.previewUrl;
        if (draft.autoOpenPreview !== undefined) res.autoOpenPreview = draft.autoOpenPreview;
        if (draft.previewOpenTarget !== undefined) res.previewOpenTarget = draft.previewOpenTarget;
        if (draft.previewFocus !== undefined) res.previewFocus = draft.previewFocus;
        if (draft.dependsOn !== undefined) res.dependsOn = draft.dependsOn;
        return res;
      }),
    }));
    setServerPresetDrafts((current) =>
      current.map((draft) => ({
        ...draft,
        isNew: false,
        originalLabel: draft.label,
        originalCommands: [...draft.commands],
        originalCwd: draft.cwd,
        originalAutoStart: draft.autoStart,
        originalPreviewUrl: draft.previewUrl,
        originalAutoOpenPreview: draft.autoOpenPreview,
        originalPreviewOpenTarget: draft.previewOpenTarget,
        originalPreviewFocus: draft.previewFocus,
        originalDependsOn: draft.dependsOn,
      })),
    );
  };

  const resetCustomEmbeds = () => {
    setCustomEmbedDrafts(createCustomEmbedDrafts(projectSettings));
  };

  
  const resetServerPresets = () => {
    setServerPresetDrafts(createServerPresetDrafts(projectSettings));
  };

  const resetServerProcesses = () => {
    setServerProcessDrafts(createTerminalProcessDrafts(projectSettings));
  };

  const updatePresetRow = useCallback((id: string, updater: (current: ServerProcessDraft) => ServerProcessDraft) => {
    setServerPresetDrafts((current) =>
      current.map((entry) => (entry.id === id ? updater(entry) : entry)),
    );
  }, []);

  const addCommandStep = useCallback((id: string) => {
    setServerPresetDrafts((current) =>
      current.map((entry) =>
        entry.id === id
          ? { ...entry, commands: [...entry.commands, ""] }
          : entry,
      ),
    );
  }, []);

  const updateCommandStep = useCallback((id: string, commandIndex: number, command: string) => {
    setServerPresetDrafts((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              commands: entry.commands.map((step, stepIndex) =>
                stepIndex === commandIndex ? command : step,
              ),
            }
          : entry,
      ),
    );
  }, []);

  const moveCommandStep = useCallback((id: string, commandIndex: number, direction: -1 | 1) => {
    setServerPresetDrafts((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const targetIndex = commandIndex + direction;
        if (targetIndex < 0 || targetIndex >= entry.commands.length) return entry;
        const nextCommands = [...entry.commands];
        const temp = nextCommands[commandIndex]!;
        nextCommands[commandIndex] = nextCommands[targetIndex]!;
        nextCommands[targetIndex] = temp;
        return { ...entry, commands: nextCommands };
      }),
    );
  }, []);

  const removeCommandStep = useCallback((id: string, commandIndex: number) => {
    setServerPresetDrafts((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              commands: entry.commands.filter((_, stepIndex) => stepIndex !== commandIndex),
            }
          : entry,
      ),
    );
  }, []);

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Project Workspace
        </h2>

        <Card>
          <CardHeader>
            <CardTitle>{activeProject.name}</CardTitle>
            <CardDescription>{activeProject.cwd}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-foreground">Toolbar Tools</div>
                <div className="text-xs text-muted-foreground">
                  Toggle and reorder the tools shown in the project toolbar.
                </div>
              </div>
              <div className="space-y-2">
                <DndContext
                  sensors={dndSensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={handleReorderTools}
                >
                  <SortableContext
                    items={toolbarPreviewTools.map((toolItem) => toolItem.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {toolbarPreviewTools.map((tool) => {
                      const isExpanded = expandedToolbarToolIds[tool.id] === true;
                      const embedDraft =
                        tool.kind === "custom_embed"
                          ? (customEmbedDrafts.find(
                              (entry) => createCustomEmbedToolId(entry.id) === tool.id,
                            ) ?? null)
                          : null;
                      const processDraft =
                        tool.kind === "custom_process"
                          ? (serverProcessDrafts.find(
                              (entry) => createServerProcessToolId(entry.id) === tool.id,
                            ) ?? null)
                          : null;

                      return (
                        <SortableToolRow key={tool.id} id={tool.id}>
                          {({ attributes, listeners }) => (
                            <div className="rounded-xl border border-border/70 px-3 py-2">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  aria-label={`Drag to reorder ${tool.label}`}
                                  className="-ms-1 shrink-0 cursor-grab touch-none rounded-md p-1 text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                                  {...attributes}
                                  {...listeners}
                                >
                                  <GripVerticalIcon className="size-4" />
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-foreground">
                                    {tool.label}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {describeToolKind(tool.kind)}
                                  </div>
                                </div>
                                <Switch
                                  checked={tool.visible}
                                  onCheckedChange={(checked) => {
                                    const nextVisible = Boolean(checked);
                                    setPendingToggle({
                                      toolId: tool.id,
                                      toolLabel: tool.label,
                                      toolKind: tool.kind,
                                      nextVisible,
                                    });
                                  }}
                                  aria-label={`Toggle ${tool.label}`}
                                />
                              </div>

                            </div>
                          )}
                        </SortableToolRow>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-foreground">Browser Default URL</div>
                <div className="text-xs text-muted-foreground">
                  The Browser tool loads this URL by default for the active project.
                </div>
              </div>
              <Input
                value={projectSettings.browser.defaultUrl}
                onChange={(event) =>
                  upsertProjectSettings(activeProjectId, (current) => ({
                    ...current,
                    browser: {
                      ...current.browser,
                      defaultUrl: event.target.value,
                    },
                  }))
                }
                placeholder="http://localhost:3000"
              />
            </div>

                        <div className="space-y-4 pt-4 border-t border-border/40">
              <div>
                <div className="text-sm font-medium text-foreground">Project Tools</div>
                <div className="text-xs text-muted-foreground">
                  Manage your project-specific browser tabs, background terminals, or server presets.
                </div>
              </div>
              <Tabs defaultValue="browser">
                <TabsList className="mb-4">
                  <TabsTrigger value="browser">Browser Tabs</TabsTrigger>
                  <TabsTrigger value="terminal">Terminal Tabs</TabsTrigger>
                  <TabsTrigger value="preset">Server Presets</TabsTrigger>
                </TabsList>

                <TabsContent value="browser" className="mt-0">
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Add project-specific URLs like Figma, Linear, Notion, or internal tools. Save to
                      add them into the toolbar, then fine-tune placement above in Toolbar Tools.
                    </div>
                    <MasterDetail>
                      <MasterDetailSidebar>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            const newId = createCustomEmbedId();
                            setCustomEmbedDrafts((current) => [
                              {
                                id: newId,
                                label: "",
                                url: "",
                                visible: true,
                                isNew: true,
                                originalLabel: "",
                                originalUrl: "",
                                originalVisible: true,
                              },
                              ...current,
                            ]);
                            setActiveCustomEmbedId(newId);
                          }}
                        >
                          <PlusIcon className="mr-2 size-3.5" />
                          Add Tab
                        </Button>
                        <MasterDetailList>
                          {customEmbedDrafts.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No tabs
                            </div>
                          ) : (
                            customEmbedDrafts.map((draft, index) => (
                              <MasterDetailItem
                                key={draft.id}
                                label={draft.label.trim() || "Untitled"}
                                isActive={activeCustomEmbedId === draft.id}
                                isUnsaved={isCustomEmbedDraftDirty(draft)}
                                onSelect={() => setActiveCustomEmbedId(draft.id)}
                              />
                            ))
                          )}
                        </MasterDetailList>
                      </MasterDetailSidebar>
                      <MasterDetailContent>
                        {(() => {
                          const activeDraft = customEmbedDrafts.find((d) => d.id === activeCustomEmbedId) || customEmbedDrafts[0];
                          if (!activeDraft) return (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                              Select a tab or create a new one.
                            </div>
                          );
                          const isDirty = isCustomEmbedDraftDirty(activeDraft);
                          return (
                            <div className="space-y-4 flex flex-col h-full min-h-0 justify-between">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-medium">{activeDraft.label || "Untitled"}</h3>
                                  {isDirty && <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Unsaved</span>}
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                      Label
                                    </div>
                                    <Input
                                      value={activeDraft.label}
                                      onChange={(event) =>
                                        setCustomEmbedDrafts((current) =>
                                          current.map((entry) =>
                                            entry.id === activeDraft.id
                                              ? { ...entry, label: event.target.value }
                                              : entry,
                                          ),
                                        )
                                      }
                                      placeholder="Figma"
                                    />
                                  </div>
                                  <div>
                                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                      Custom URL
                                    </div>
                                    <Input
                                      value={activeDraft.url}
                                      onChange={(event) =>
                                        setCustomEmbedDrafts((current) =>
                                          current.map((entry) =>
                                            entry.id === activeDraft.id
                                              ? { ...entry, url: event.target.value }
                                              : entry,
                                          ),
                                        )
                                      }
                                      placeholder="https://www.figma.com/file/..."
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs text-muted-foreground">
                                      Show this browser tab in the toolbar once you save it.
                                    </div>
                                    <Switch
                                      checked={activeDraft.visible}
                                      onCheckedChange={(checked) =>
                                        setCustomEmbedDrafts((current) =>
                                          current.map((entry) =>
                                            entry.id === activeDraft.id
                                              ? { ...entry, visible: Boolean(checked) }
                                              : entry,
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="pt-6 flex items-center justify-between border-t border-border/40 mt-6">
                                <Button
                                  type="button"
                                  variant="destructive-outline"
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to delete this tab?")) {
                                      setCustomEmbedDrafts((current) => current.filter((entry) => entry.id !== activeDraft.id));
                                      if (activeCustomEmbedId === activeDraft.id) setActiveCustomEmbedId(null);
                                    }
                                  }}
                                >
                                  <Trash2Icon className="mr-2 size-3.5" />
                                  Delete Tab
                                </Button>
                                <div className="flex items-center gap-2">
                                  <Button type="button" variant="ghost" onClick={resetCustomEmbeds} disabled={!customEmbedsDirty}>
                                    Cancel
                                  </Button>
                                  <Button type="button" onClick={saveCustomEmbeds} disabled={!customEmbedsDirty}>
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </MasterDetailContent>
                    </MasterDetail>
                  </div>
                </TabsContent>

                <TabsContent value="terminal" className="mt-0">
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Add project-specific terminal tools that auto-run predefined commands when the
                      tab opens. Save to add them into the toolbar, then reorder them above if needed.
                    </div>
                    <MasterDetail>
                      <MasterDetailSidebar>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            const newId = createServerProcessId();
                            setServerProcessDrafts((current) => [
                              {
                                id: newId,
                                label: "",
                                commands: [""],
                                cwd: activeProject.cwd,
                                autoStart: false,
                                visible: true,
                                isNew: true,
                                originalLabel: "",
                                originalCommands: [""],
                                originalCwd: activeProject.cwd,
                                originalAutoStart: false,
                                originalVisible: true,
                              },
                              ...current,
                            ]);
                            setActiveServerProcessId(newId);
                          }}
                        >
                          <PlusIcon className="mr-2 size-3.5" />
                          Add Terminal
                        </Button>
                        <MasterDetailList>
                          {serverProcessDrafts.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No terminals
                            </div>
                          ) : (
                            serverProcessDrafts.map((draft, index) => (
                              <MasterDetailItem
                                key={draft.id}
                                label={draft.label.trim() || "Untitled"}
                                isActive={activeServerProcessId === draft.id}
                                isUnsaved={isServerProcessDraftDirty(draft)}
                                onSelect={() => setActiveServerProcessId(draft.id)}
                              />
                            ))
                          )}
                        </MasterDetailList>
                      </MasterDetailSidebar>
                      <MasterDetailContent>
                        {(() => {
                          const activeDraft = serverProcessDrafts.find((d) => d.id === activeServerProcessId) || serverProcessDrafts[0];
                          if (!activeDraft) return (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                              Select a terminal or create a new one.
                            </div>
                          );
                          const isDirty = isServerProcessDraftDirty(activeDraft);
                          return (
                            <div className="space-y-4 flex flex-col h-full min-h-0 justify-between">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-medium">{activeDraft.label || "Untitled"}</h3>
                                  {isDirty && <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Unsaved</span>}
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                      Label
                                    </div>
                                    <Input
                                      value={activeDraft.label}
                                      onChange={(event) =>
                                        setServerProcessDrafts((current) =>
                                          current.map((entry) =>
                                            entry.id === activeDraft.id
                                              ? { ...entry, label: event.target.value }
                                              : entry,
                                          ),
                                        )
                                      }
                                      placeholder="OpenCore"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                      <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                        Commands
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setServerProcessDrafts((current) =>
                                            current.map((entry) =>
                                              entry.id === activeDraft.id
                                                ? { ...entry, commands: [...entry.commands, ""] }
                                                : entry,
                                            ),
                                          )
                                        }
                                      >
                                        <PlusIcon className="size-3.5 mr-2" />
                                        Add Step
                                      </Button>
                                    </div>
                                    <div className="space-y-2">
                                      {activeDraft.commands.map((command, commandIndex) => (
                                        <div key={`${activeDraft.id}-step-${commandIndex}`} className="flex gap-2">
                                          <Input
                                            value={command}
                                            onChange={(event) =>
                                              setServerProcessDrafts((current) =>
                                                current.map((entry) =>
                                                  entry.id === activeDraft.id
                                                    ? {
                                                        ...entry,
                                                        commands: entry.commands.map((step, stepIndex) =>
                                                          stepIndex === commandIndex ? event.target.value : step,
                                                        ),
                                                      }
                                                    : entry,
                                                ),
                                              )
                                            }
                                            placeholder={commandIndex === 0 ? "npm install" : "npm run dev"}
                                          />
                                          <Button
                                            type="button"
                                            size="icon"
                                            variant="outline"
                                            disabled={activeDraft.commands.length === 1}
                                            onClick={() =>
                                              setServerProcessDrafts((current) =>
                                                current.map((entry) =>
                                                  entry.id === activeDraft.id
                                                    ? {
                                                        ...entry,
                                                        commands: entry.commands.filter((_, stepIndex) => stepIndex !== commandIndex),
                                                      }
                                                    : entry,
                                                ),
                                              )
                                            }
                                          >
                                            <Trash2Icon className="size-3.5" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                      Working Directory
                                    </div>
                                    <Input
                                      value={activeDraft.cwd}
                                      onChange={(event) =>
                                        setServerProcessDrafts((current) =>
                                          current.map((entry) =>
                                            entry.id === activeDraft.id
                                              ? { ...entry, cwd: event.target.value }
                                              : entry,
                                          ),
                                        )
                                      }
                                      placeholder={activeProject.cwd}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs text-muted-foreground">
                                      Show this terminal in the toolbar once you save it.
                                    </div>
                                    <Switch
                                      checked={activeDraft.visible}
                                      onCheckedChange={(checked) =>
                                        setServerProcessDrafts((current) =>
                                          current.map((entry) =>
                                            entry.id === activeDraft.id
                                              ? { ...entry, visible: Boolean(checked) }
                                              : entry,
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs text-muted-foreground">
                                      Auto-start this terminal when its tab or the Server tool is first opened.
                                    </div>
                                    <Switch
                                      checked={activeDraft.autoStart}
                                      onCheckedChange={(checked) =>
                                        setServerProcessDrafts((current) =>
                                          current.map((entry) =>
                                            entry.id === activeDraft.id
                                              ? { ...entry, autoStart: Boolean(checked) }
                                              : entry,
                                          ),
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="pt-6 flex items-center justify-between border-t border-border/40 mt-6">
                                <Button
                                  type="button"
                                  variant="destructive-outline"
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to delete this terminal?")) {
                                      setServerProcessDrafts((current) => current.filter((entry) => entry.id !== activeDraft.id));
                                      if (activeServerProcessId === activeDraft.id) setActiveServerProcessId(null);
                                    }
                                  }}
                                >
                                  <Trash2Icon className="mr-2 size-3.5" />
                                  Delete Terminal
                                </Button>
                                <div className="flex items-center gap-2">
                                  <Button type="button" variant="ghost" onClick={resetServerProcesses} disabled={!serverProcessesDirty}>
                                    Cancel
                                  </Button>
                                  <Button type="button" onClick={saveServerProcesses} disabled={!serverProcessesDirty}>
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </MasterDetailContent>
                    </MasterDetail>
                  </div>
                </TabsContent>

                <TabsContent value="preset" className="mt-0">
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Create and manage one-click presets like `Frontend` or `Backend`, each with ordered command steps.
                    </div>
                    <MasterDetail>
                      <MasterDetailSidebar>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            const newId = createServerProcessId();
                            setServerPresetDrafts((current) => [
                              {
                                id: newId,
                                label: "",
                                commands: [""],
                                cwd: activeProject.cwd,
                                autoStart: false,
                                visible: true,
                                isNew: true,
                                originalLabel: "",
                                originalCommands: [""],
                                originalCwd: activeProject.cwd,
                                originalAutoStart: false,
                                originalVisible: true,
                              },
                              ...current,
                            ]);
                            setActiveServerPresetId(newId);
                          }}
                        >
                          <PlusIcon className="mr-2 size-3.5" />
                          Add Preset
                        </Button>
                        <MasterDetailList>
                          {serverPresetDrafts.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No presets
                            </div>
                          ) : (
                            serverPresetDrafts.map((draft, index) => (
                              <MasterDetailItem
                                key={draft.id}
                                label={draft.label.trim() || "Untitled"}
                                isActive={activeServerPresetId === draft.id}
                                isUnsaved={isServerProcessDraftDirty(draft)}
                                onSelect={() => setActiveServerPresetId(draft.id)}
                              />
                            ))
                          )}
                        </MasterDetailList>
                      </MasterDetailSidebar>
                      <MasterDetailContent>
                        {(() => {
                          const activeDraft = serverPresetDrafts.find((d) => d.id === activeServerPresetId) || serverPresetDrafts[0];
                          if (!activeDraft) return (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                              Select a preset or create a new one.
                            </div>
                          );
                          const isDirty = isServerProcessDraftDirty(activeDraft);
                          return (
                            <div className="space-y-4 flex flex-col h-full min-h-0 justify-between">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-medium">{activeDraft.label || "Untitled"}</h3>
                                  {isDirty && <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Unsaved</span>}
                                </div>
                                <ServerPresetFormFields
                                  preset={activeDraft}
                                  presetDrafts={serverPresetDrafts}
                                  projectCwd={activeProject.cwd}
                                  variant="plain"
                                  updatePresetRow={updatePresetRow}
                                  addCommandStep={addCommandStep}
                                  updateCommandStep={updateCommandStep}
                                  moveCommandStep={moveCommandStep}
                                  removeCommandStep={removeCommandStep}
                                />
                              </div>
                              <div className="pt-6 flex items-center justify-between border-t border-border/40 mt-6">
                                <Button
                                  type="button"
                                  variant="destructive-outline"
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to delete this preset?")) {
                                      setServerPresetDrafts((current) => current.filter((entry) => entry.id !== activeDraft.id));
                                      if (activeServerPresetId === activeDraft.id) setActiveServerPresetId(null);
                                    }
                                  }}
                                >
                                  <Trash2Icon className="mr-2 size-3.5" />
                                  Delete Preset
                                </Button>
                                <div className="flex items-center gap-2">
                                  <Button type="button" variant="ghost" onClick={resetServerPresets} disabled={!serverPresetsDirty}>
                                    Cancel
                                  </Button>
                                  <Button type="button" onClick={saveServerPresets} disabled={!serverPresetsDirty}>
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </MasterDetailContent>
                    </MasterDetail>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

          </CardContent>
        </Card>
      </section>

      <AlertDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle?.nextVisible ? "Show" : "Hide"} {pendingToggle?.toolLabel ?? "tool"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.nextVisible
                ? `This will show "${pendingToggle?.toolLabel}" in your project toolbar. The change is saved immediately.`
                : `This will hide "${pendingToggle?.toolLabel}" from your project toolbar. You can re-enable it anytime from Settings.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={
                <Button variant="outline" onClick={() => setPendingToggle(null)}>
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={() => {
                confirmToggle();
              }}
            >
              {pendingToggle?.nextVisible ? "Show" : "Hide"} {pendingToggle?.toolLabel ?? "tool"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
