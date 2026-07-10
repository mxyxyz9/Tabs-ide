import {
  DEFAULT_MODEL,
  type FilesystemBrowseEntry,
  type ResolvedKeybindingsConfig,
} from "@tabs/contracts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  FolderIcon,
  FolderPlusIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { OpenAddProjectCommandPaletteProvider } from "../commandPaletteContext";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { useTerminalStateStore } from "../terminalStateStore";
import { newCommandId, newProjectId } from "../lib/utils";
import { makeAppModelSelection } from "../modelSelection";
import { resolveShortcutCommand } from "../keybindings";
import {
  ADDON_ICON_CLASS,
  buildBrowseGroups,
  buildProjectActionItems,
  buildRootGroups,
  buildThreadActionItems,
  filterBrowseEntries,
  filterCommandPaletteGroups,
  getCommandPaletteInputPlaceholder,
  getCommandPaletteMode,
  ITEM_ICON_CLASS,
  RECENT_THREAD_LIMIT,
  type CommandPaletteActionItem,
  type CommandPaletteGroup,
  type CommandPaletteSubmenuItem,
  type CommandPaletteView,
} from "./CommandPalette.logic";
import { CommandPaletteResults } from "./CommandPaletteResults";
import { ProjectFavicon } from "./Sidebar";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandInput,
  CommandPanel,
  CommandFooter,
} from "./ui/command";

export function CommandPalette({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [openIntent, setOpenIntent] = useState<{ kind: "add-project" } | null>(null);

  const toggleOpen = useCallback(() => setOpen((prev) => !prev), []);
  const openAddProject = useCallback(() => {
    setOpen(true);
    setOpenIntent({ kind: "add-project" });
  }, []);
  const clearOpenIntent = useCallback(() => setOpenIntent(null), []);

  const { data: serverConfig } = useQuery(serverConfigQueryOptions());
  const keybindings = serverConfig?.keybindings ?? [];

  // Track active terminal state from store if route has threadId
  const params = useParams({ strict: false });
  const activeThreadId = (params as any).threadId ?? null;
  const terminalOpen = useTerminalStateStore((state) => {
    if (!activeThreadId) return false;
    const threadState = state.terminalStateByThreadId[activeThreadId];
    return threadState ? threadState.terminalOpen : false;
  });

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: false, // Default context fallback
          terminalOpen,
        },
      });
      if (command !== "commandPalette.toggle") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      toggleOpen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keybindings, terminalOpen, toggleOpen]);

  return (
    <OpenAddProjectCommandPaletteProvider openAddProject={openAddProject}>
      <CommandDialog open={open} onOpenChange={setOpen}>
        {children}
        <CommandPaletteDialog
          open={open}
          openIntent={openIntent}
          setOpen={setOpen}
          clearOpenIntent={clearOpenIntent}
          keybindings={keybindings}
        />
      </CommandDialog>
    </OpenAddProjectCommandPaletteProvider>
  );
}

function CommandPaletteDialog(props: {
  readonly open: boolean;
  readonly openIntent: { kind: "add-project" } | null;
  readonly setOpen: (open: boolean) => void;
  readonly clearOpenIntent: () => void;
  readonly keybindings: ResolvedKeybindingsConfig;
}) {
  if (!props.open) {
    return null;
  }

  return (
    <OpenCommandPaletteDialog
      openIntent={props.openIntent}
      setOpen={props.setOpen}
      clearOpenIntent={props.clearOpenIntent}
      keybindings={props.keybindings}
    />
  );
}

function OpenCommandPaletteDialog(props: {
  readonly openIntent: { kind: "add-project" } | null;
  readonly setOpen: (open: boolean) => void;
  readonly clearOpenIntent: () => void;
  readonly keybindings: ResolvedKeybindingsConfig;
}) {
  const navigate = useNavigate();
  const { clearOpenIntent, openIntent, setOpen, keybindings } = props;

  const [query, setQuery] = useState("");
  const [highlightedItemValue, setHighlightedItemValue] = useState<string | null>(null);

  const projects = useStore((state) => state.projects);
  const threads = useStore((state) => state.threads);

  const { handleNewThread } = useHandleNewThread();

  const [viewStack, setViewStack] = useState<CommandPaletteView[]>([]);
  const currentView = viewStack.at(-1) ?? null;

  // Filesystem browse states
  const [browseEntries, setBrowseEntries] = useState<FilesystemBrowseEntry[]>([]);
  const [parentPath, setParentPath] = useState("");
  const [isBrowsePending, setIsBrowsePending] = useState(false);

  const params = useParams({ strict: false });
  const currentThreadId = (params as any).threadId ?? null;
  const currentThread = useStore((state) =>
    state.threads.find((t) => t.id === currentThreadId)
  );
  const currentProjectId = currentThread?.projectId ?? null;
  const currentProjectCwd = useStore((state) =>
    state.projects.find((p) => p.id === currentProjectId)?.cwd ?? null
  );

  // Checks if the search query is a local path query
  const isFilesystemBrowseQuery = (val: string): boolean => {
    const trimmed = val.trim();
    return (
      trimmed.startsWith("./") ||
      trimmed.startsWith("../") ||
      trimmed.startsWith("~/") ||
      trimmed.startsWith("/") ||
      trimmed.startsWith(".\\") ||
      trimmed.startsWith("..\\")
    );
  };

  const isBrowsing = isFilesystemBrowseQuery(query);

  const getBrowseDirectoryPath = (val: string): string => {
    const trimmed = val.trim();
    if (trimmed.endsWith("/") || trimmed.endsWith("\\")) {
      return trimmed;
    }
    const parts = trimmed.split(/[/\\]/);
    parts.pop();
    const dir = parts.join("/");
    return dir.length === 0 ? "/" : dir;
  };

  const getBrowseLeafPathSegment = (val: string): string => {
    const trimmed = val.trim();
    const parts = trimmed.split(/[/\\]/);
    return parts.pop() ?? "";
  };

  const browseDirectoryPath = isBrowsing ? getBrowseDirectoryPath(query) : "";
  const browseFilterQuery = isBrowsing && !query.trim().endsWith("/") && !query.trim().endsWith("\\")
    ? getBrowseLeafPathSegment(query)
    : "";

  useEffect(() => {
    if (!isBrowsing || browseDirectoryPath.length === 0) {
      setBrowseEntries([]);
      return;
    }

    const api = readNativeApi();
    if (!api) return;

    let active = true;
    setIsBrowsePending(true);

    api.projects
      .filesystemBrowse({
        partialPath: browseDirectoryPath,
        ...(currentProjectCwd ? { cwd: currentProjectCwd } : {}),
      })
      .then((res) => {
        if (!active) return;
        setBrowseEntries([...res.entries]);
        setParentPath(res.parentPath);
        setIsBrowsePending(false);
      })
      .catch(() => {
        if (!active) return;
        setBrowseEntries([]);
        setIsBrowsePending(false);
      });

    return () => {
      active = false;
    };
  }, [isBrowsing, browseDirectoryPath, currentProjectCwd]);

  const addProjectFromPath = useCallback(
    async (cwd: string) => {
      const api = readNativeApi();
      if (!api) return;

      const projectId = newProjectId();
      const createdAt = new Date().toISOString();
      const title = cwd.split(/[/\\]/).findLast((s) => s.trim().length > 0) ?? cwd;

      try {
        await api.orchestration.dispatchCommand({
          type: "project.create",
          commandId: newCommandId(),
          projectId,
          title,
          workspaceRoot: cwd,
          defaultModelSelection: makeAppModelSelection("codex", DEFAULT_MODEL),
          createdAt,
        });
        await handleNewThread(projectId).catch(() => undefined);
      } catch (error) {
        console.error("Failed to add project", error);
      }
    },
    [handleNewThread]
  );

  const openProjectFromSearch = useMemo(
    () => async (project: (typeof projects)[number]) => {
      // Find latest thread or create new
      const projectThreads = threads.filter((t) => t.projectId === project.id);
      if (projectThreads.length > 0) {
        // Sort and select latest
        const sorted = [...projectThreads].sort(
          (a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt)
        );
        const latest = sorted[0];
        if (latest) {
          void navigate({
            to: "/$threadId",
            params: { threadId: latest.id },
          });
          return;
        }
      }
      await handleNewThread(project.id);
    },
    [navigate, handleNewThread, threads]
  );

  const projectSearchItems = useMemo(
    () =>
      buildProjectActionItems({
        projects,
        valuePrefix: "project",
        icon: (project) => (
          <ProjectFavicon
            cwd={project.cwd}
            className={ITEM_ICON_CLASS}
          />
        ),
        runProject: openProjectFromSearch,
      }),
    [openProjectFromSearch, projects]
  );

  const projectThreadItems = useMemo(
    () =>
      projects.map((project) => ({
        kind: "action" as const,
        value: `new-thread-in:${project.id}`,
        searchTerms: [project.name, project.cwd],
        title: project.name,
        description: project.cwd,
        icon: <ProjectFavicon cwd={project.cwd} className={ITEM_ICON_CLASS} />,
        run: async () => {
          await handleNewThread(project.id);
        },
      })),
    [handleNewThread, projects]
  );

  const recentThreadItems = useMemo(
    () =>
      buildThreadActionItems({
        threads,
        activeThreadId: currentThreadId,
        projectTitleById: new Map(projects.map((p) => [p.id, p.name])),
        sortOrder: "updated_at",
        icon: <SquarePenIcon className={ITEM_ICON_CLASS} />,
        runThread: async (thread) => {
          void navigate({
            to: "/$threadId",
            params: { threadId: thread.id },
          });
        },
        limit: RECENT_THREAD_LIMIT,
      }),
    [threads, projects, navigate, currentThreadId]
  );

  const openAddProjectFlow = useCallback(async () => {
    const api = readNativeApi();
    if (!api) return;
    const pickedPath = await api.dialogs.pickFolder();
    if (pickedPath) {
      setOpen(false);
      await addProjectFromPath(pickedPath);
    }
  }, [addProjectFromPath, setOpen]);

  useEffect(() => {
    if (openIntent?.kind === "add-project") {
      clearOpenIntent();
      void openAddProjectFlow();
    }
  }, [clearOpenIntent, openAddProjectFlow, openIntent]);

  const actionItems: Array<CommandPaletteActionItem | CommandPaletteSubmenuItem> = [];

  if (projects.length > 0) {
    const activeProject = projects.find((p) => p.id === currentProjectId);
    if (activeProject) {
      actionItems.push({
        kind: "action",
        value: "action:new-thread",
        searchTerms: ["new thread", "chat", "create", "draft"],
        title: (
          <>
            New thread in <span className="font-semibold">{activeProject.name}</span>
          </>
        ),
        icon: <SquarePenIcon className={ITEM_ICON_CLASS} />,
        shortcutCommand: "chat.new",
        run: async () => {
          await handleNewThread(activeProject.id);
        },
      });
    }

    actionItems.push({
      kind: "submenu",
      value: "action:new-thread-in",
      searchTerms: ["new thread", "project", "pick", "choose", "select"],
      title: "New thread in...",
      icon: <SquarePenIcon className={ITEM_ICON_CLASS} />,
      addonIcon: <SquarePenIcon className={ADDON_ICON_CLASS} />,
      groups: [{ value: "projects", label: "Projects", items: projectThreadItems }],
    });
  }

  actionItems.push({
    kind: "action",
    value: "action:add-project",
    searchTerms: [
      "add project",
      "folder",
      "directory",
      "browse",
      "clone",
      "remote",
      "repository",
      "repo",
      "git",
    ],
    title: "Add project",
    icon: <FolderPlusIcon className={ITEM_ICON_CLASS} />,
    keepOpen: true,
    run: async () => {
      await openAddProjectFlow();
    },
  });

  actionItems.push({
    kind: "action",
    value: "action:settings",
    searchTerms: ["settings", "preferences", "configuration", "keybindings"],
    title: "Open settings",
    icon: <SettingsIcon className={ITEM_ICON_CLASS} />,
    run: async () => {
      void navigate({ to: "/settings" });
    },
  });

  const rootGroups = buildRootGroups({ actionItems, recentThreadItems });

  const activeGroups = useMemo(() => {
    if (currentView) {
      return currentView.groups;
    }
    if (isBrowsing) {
      const { filteredEntries } = filterBrowseEntries({
        browseEntries,
        browseFilterQuery,
        highlightedItemValue,
      });
      return buildBrowseGroups({
        browseEntries: filteredEntries,
        browseQuery: query,
        canBrowseUp: query.trim() !== "/" && parentPath.length > 0,
        upIcon: <ArrowLeftIcon className={ITEM_ICON_CLASS} />,
        directoryIcon: <FolderIcon className={ITEM_ICON_CLASS} />,
        browseUp: () => {
          setQuery(parentPath + "/");
        },
        browseTo: (name) => {
          const sep = query.endsWith("/") || query.endsWith("\\") ? "" : "/";
          setQuery(query + sep + name + "/");
        },
      });
    }
    return rootGroups;
  }, [
    currentView,
    isBrowsing,
    browseEntries,
    browseFilterQuery,
    highlightedItemValue,
    query,
    parentPath,
    rootGroups,
  ]);

  const filteredGroups = useMemo(
    () =>
      filterCommandPaletteGroups({
        activeGroups,
        query,
        isInSubmenu: currentView !== null,
        projectSearchItems,
        threadSearchItems: [],
      }),
    [activeGroups, query, currentView, projectSearchItems]
  );

  const flatItems = useMemo(
    () => filteredGroups.flatMap((g) => g.items),
    [filteredGroups]
  );

  // Sync highlighting
  useEffect(() => {
    if (flatItems.length === 0) {
      setHighlightedItemValue(null);
      return;
    }
    const currentIdx = flatItems.findIndex((item) => item.value === highlightedItemValue);
    if (currentIdx === -1) {
      setHighlightedItemValue(flatItems[0]?.value ?? null);
    }
  }, [flatItems, highlightedItemValue]);

  const handleExecuteItem = useCallback(
    async (item: CommandPaletteActionItem | CommandPaletteSubmenuItem) => {
      if (item.kind === "submenu") {
        setViewStack((prev) => [...prev, item]);
        setQuery("");
        setHighlightedItemValue(null);
        return;
      }
      if (!item.keepOpen) {
        setOpen(false);
      }
      await item.run();
    },
    [setOpen]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const idx = flatItems.findIndex((item) => item.value === highlightedItemValue);
      const nextIdx = idx === -1 || idx === flatItems.length - 1 ? 0 : idx + 1;
      setHighlightedItemValue(flatItems[nextIdx]?.value ?? null);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const idx = flatItems.findIndex((item) => item.value === highlightedItemValue);
      const prevIdx = idx === -1 || idx === 0 ? flatItems.length - 1 : idx - 1;
      setHighlightedItemValue(flatItems[prevIdx]?.value ?? null);
    } else if (event.key === "Enter") {
      event.preventDefault();
      // If browsing filesystem and press Enter on an exact match or query path, add it as project
      if (isBrowsing && !isBrowsePending) {
        const exactMatch = flatItems.find(
          (item) => item.value.startsWith("browse:") && item.title === browseFilterQuery
        );
        if (exactMatch) {
          void handleExecuteItem(exactMatch);
          return;
        }
        // Fallback: Add query directory directly as project
        setOpen(false);
        void addProjectFromPath(query);
        return;
      }

      const highlightedItem = flatItems.find((item) => item.value === highlightedItemValue);
      if (highlightedItem) {
        void handleExecuteItem(highlightedItem);
      }
    } else if (event.key === "Escape") {
      if (currentView) {
        event.preventDefault();
        setViewStack((prev) => prev.slice(0, -1));
        setQuery("");
        setHighlightedItemValue(null);
      }
    } else if (event.key === "Backspace" && query.length === 0) {
      if (currentView) {
        event.preventDefault();
        setViewStack((prev) => prev.slice(0, -1));
        setQuery("");
        setHighlightedItemValue(null);
      }
    }
  };

  const mode = getCommandPaletteMode({ currentView, isBrowsing });
  const placeholder = getCommandPaletteInputPlaceholder(mode);

  return (
    <CommandDialogPopup data-command-palette>
      <Command>
        <div className="flex items-center border-b px-3">
          {currentView && (
            <button
              onClick={() => {
                setViewStack((prev) => prev.slice(0, -1));
                setQuery("");
                setHighlightedItemValue(null);
              }}
              className="mr-2 flex size-6 items-center justify-center rounded-sm hover:bg-muted"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
          )}
          <CommandInput
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <CommandPanel className="max-h-[300px] overflow-y-auto">
          {isBrowsePending ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading directories...
            </div>
          ) : (
            <CommandPaletteResults
              groups={filteredGroups}
              highlightedItemValue={highlightedItemValue}
              isActionsOnly={query.startsWith(">")}
              keybindings={keybindings}
              onExecuteItem={handleExecuteItem}
            />
          )}
        </CommandPanel>
        <CommandFooter>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">Enter</kbd> Select
            </span>
            {currentView && (
              <span className="flex items-center gap-1">
                <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">Esc</kbd> Back
              </span>
            )}
          </div>
        </CommandFooter>
      </Command>
    </CommandDialogPopup>
  );
}
