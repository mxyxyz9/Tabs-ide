import {
  DEFAULT_MODEL,
  type FilesystemBrowseEntry,
  type ResolvedKeybindingsConfig,
} from "@tabs/contracts";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "@effect/atom-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  FolderIcon,
  FolderPlusIcon,
  SettingsIcon,
  SquarePenIcon,
  GitBranchIcon,
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
import { Badge } from "~/components/ui/badge";
import { toastManager } from "~/components/ui/toast";
import {
  GitHubIcon,
  GitLabIcon,
  AzureDevOpsIcon,
  BitbucketIcon,
} from "~/components/Icons";
import { OpenAddProjectCommandPaletteProvider } from "../commandPaletteContext";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { useSourceControlDiscovery } from "~/lib/sourceControlReactQuery";
import { readNativeApi } from "../nativeApi";
import { readModelStateAtom } from "../state/readModel";
import { useKeybindings } from "../state/settings";
import { useThreadTerminalState } from "../state/terminal";
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

  const keybindings = useKeybindings();

  // Track active terminal state from store if route has threadId
  const params = useParams({ strict: false });
  const activeThreadId = (params as any).threadId ?? null;
  const terminalOpen = useThreadTerminalState(activeThreadId)?.terminalOpen ?? false;

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

  const projects = useAtomValue(readModelStateAtom, (state) => state.projects);
  const threads = useAtomValue(readModelStateAtom, (state) => state.threads);

  const { handleNewThread } = useHandleNewThread();

  const [viewStack, setViewStack] = useState<CommandPaletteView[]>([]);
  const currentView = viewStack.at(-1) ?? null;

  const [addProjectCloneFlow, setAddProjectCloneFlow] = useState<{
    step: "repository" | "confirm";
    provider: "github" | "gitlab" | "azure-devops" | "bitbucket" | "git-url";
    repositoryInput?: string | undefined;
    remoteUrl?: string | undefined;
    repository?: any | undefined;
  } | null>(null);

  const { data: sourceControlDiscovery } = useSourceControlDiscovery();

  const getProviderBadge = useCallback((providerKind: string) => {
    if (!sourceControlDiscovery) return null;
    const provider = sourceControlDiscovery.sourceControlProviders.find((p) => p.kind === providerKind);
    if (!provider) return null;
    if (provider.status === "available" && provider.auth.status === "authenticated") return null;
    if (providerKind === "bitbucket" && provider.auth.status === "authenticated") return null;

    return (
      <Badge variant="warning" className="ml-2 py-0 h-4 text-[10px]">
        Setup Required
      </Badge>
    );
  }, [sourceControlDiscovery]);

  // Filesystem browse states
  const [browseEntries, setBrowseEntries] = useState<FilesystemBrowseEntry[]>([]);
  const [parentPath, setParentPath] = useState("");
  const [isBrowsePending, setIsBrowsePending] = useState(false);

  const params = useParams({ strict: false });
  const currentThreadId = (params as any).threadId ?? null;
  const currentThread = threads.find((thread) => thread.id === currentThreadId);
  const currentProjectId = currentThread?.projectId ?? null;
  const currentProjectCwd = projects.find((project) => project.id === currentProjectId)?.cwd ?? null;

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

  const [isRemoteProjectLookingUp, setIsRemoteProjectLookingUp] = useState(false);
  const [isRemoteProjectCloning, setIsRemoteProjectCloning] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "github":
        return <GitHubIcon className={ITEM_ICON_CLASS} />;
      case "gitlab":
        return <GitLabIcon className={ITEM_ICON_CLASS} />;
      case "azure-devops":
        return <AzureDevOpsIcon className={ITEM_ICON_CLASS} />;
      case "bitbucket":
        return <BitbucketIcon className={ITEM_ICON_CLASS} />;
      default:
        return <FolderIcon className={ITEM_ICON_CLASS} />;
    }
  };

  const remoteProjectContext = useMemo(() => {
    if (!addProjectCloneFlow || addProjectCloneFlow.step !== "confirm") {
      return null;
    }
    return {
      title: addProjectCloneFlow.repository?.nameWithOwner ?? addProjectCloneFlow.repositoryInput,
      description: addProjectCloneFlow.remoteUrl ?? addProjectCloneFlow.repositoryInput,
      icon: getProviderIcon(addProjectCloneFlow.provider),
    };
  }, [addProjectCloneFlow]);

  const handleLookupRepository = useCallback(async () => {
    if (!addProjectCloneFlow || addProjectCloneFlow.step !== "repository" || isRemoteProjectLookingUp) {
      return;
    }
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) return;

    if (addProjectCloneFlow.provider === "git-url") {
      let repoName = "cloned-repo";
      const parts = trimmedQuery.split("/");
      const lastPart = parts.pop() || "";
      repoName = lastPart.replace(/\.git$/, "") || "cloned-repo";

      setAddProjectCloneFlow({
        step: "confirm",
        provider: "git-url",
        repositoryInput: trimmedQuery,
        remoteUrl: trimmedQuery,
      });
      setQuery(`~/projects/${repoName}`);
      setLookupError(null);
      return;
    }

    const api = readNativeApi();
    if (!api) return;

    setIsRemoteProjectLookingUp(true);
    setLookupError(null);
    try {
      const result = await api.server.lookupRepository({
        provider: addProjectCloneFlow.provider,
        repository: trimmedQuery,
      });
      setIsRemoteProjectLookingUp(false);
      
      let repoName = "cloned-repo";
      const parts = result.nameWithOwner.split("/");
      repoName = parts.pop() || "cloned-repo";

      setAddProjectCloneFlow({
        step: "confirm",
        provider: addProjectCloneFlow.provider,
        repositoryInput: trimmedQuery,
        remoteUrl: result.sshUrl || result.url,
        repository: result,
      });
      setQuery(`~/projects/${repoName}`);
    } catch (err: any) {
      setIsRemoteProjectLookingUp(false);
      setLookupError(err?.message || "Repository lookup failed. Make sure the repository exists and you are authenticated.");
    }
  }, [addProjectCloneFlow, query]);

  const triggerClone = useCallback(async (
    provider: string,
    repository: string | undefined,
    destinationPath: string,
    remoteUrl?: string
  ) => {
    const api = readNativeApi();
    if (!api) {
      setLookupError("Connection to the server is not available.");
      return;
    }
    setIsRemoteProjectCloning(true);
    setLookupError(null);
    try {
      const input = {
        provider: provider === "git-url" ? "unknown" as const : provider as any,
        repository: provider === "git-url" ? undefined : repository,
        remoteUrl: remoteUrl || (provider === "git-url" ? repository : undefined),
        destinationPath,
      };
      const result = await api.server.cloneRepository(input);
      if (result && result.cwd) {
        setOpen(false);
        setAddProjectCloneFlow(null);
        await addProjectFromPath(result.cwd);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clone failed. Please try again.";
      setLookupError(message);
    } finally {
      setIsRemoteProjectCloning(false);
    }
  }, [addProjectFromPath]);

  const openAddProjectSourcesView = useCallback(() => {
    setViewStack((prev) => [
      ...prev,
      {
        addonIcon: <GitBranchIcon className={ADDON_ICON_CLASS} />,
        groups: [
          {
            value: "sources",
            label: "Clone Repository",
            items: [
              {
                kind: "action" as const,
                value: "action:add-project:git-url",
                searchTerms: ["git", "url", "clone", "remote"],
                title: "Git URL",
                description: "Clone from a remote URL",
                icon: <FolderIcon className={ITEM_ICON_CLASS} />,
                keepOpen: true,
                run: async () => {
                  setAddProjectCloneFlow({ step: "repository", provider: "git-url" });
                  setQuery("");
                },
              },
              {
                kind: "action" as const,
                value: "action:add-project:github",
                searchTerms: ["github", "gh", "clone"],
                title: "GitHub repository",
                description: "Clone GitHub owner/repo",
                icon: <GitHubIcon className={ITEM_ICON_CLASS} />,
                titleTrailingContent: getProviderBadge("github"),
                keepOpen: true,
                run: async () => {
                  setAddProjectCloneFlow({ step: "repository", provider: "github" });
                  setQuery("");
                },
              },
              {
                kind: "action" as const,
                value: "action:add-project:azure-devops",
                searchTerms: ["azure", "devops", "az", "clone"],
                title: "Azure DevOps repository",
                description: "Clone Azure DevOps project/repository",
                icon: <AzureDevOpsIcon className={ITEM_ICON_CLASS} />,
                titleTrailingContent: getProviderBadge("azure-devops"),
                keepOpen: true,
                run: async () => {
                  setAddProjectCloneFlow({ step: "repository", provider: "azure-devops" });
                  setQuery("");
                },
              },
              {
                kind: "action" as const,
                value: "action:add-project:bitbucket",
                searchTerms: ["bitbucket", "clone"],
                title: "Bitbucket repository",
                description: "Clone Bitbucket workspace/repository",
                icon: <BitbucketIcon className={ITEM_ICON_CLASS} />,
                titleTrailingContent: getProviderBadge("bitbucket"),
                keepOpen: true,
                run: async () => {
                  setAddProjectCloneFlow({ step: "repository", provider: "bitbucket" });
                  setQuery("");
                },
              },
              {
                kind: "action" as const,
                value: "action:add-project:gitlab",
                searchTerms: ["gitlab", "glab", "clone"],
                title: "GitLab repository",
                description: "Clone GitLab group/project",
                icon: <GitLabIcon className={ITEM_ICON_CLASS} />,
                titleTrailingContent: getProviderBadge("gitlab"),
                keepOpen: true,
                run: async () => {
                  setAddProjectCloneFlow({ step: "repository", provider: "gitlab" });
                  setQuery("");
                },
              },
            ],
          },
        ],
      },
    ]);
    setQuery("");
  }, [openAddProjectFlow, getProviderBadge]);

  useEffect(() => {
    if (openIntent?.kind === "add-project") {
      clearOpenIntent();
      void openAddProjectSourcesView();
    }
  }, [clearOpenIntent, openAddProjectSourcesView, openIntent]);

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
      openAddProjectSourcesView();
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
    if (addProjectCloneFlow) {
      return [];
    }
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
    () => {
      if (addProjectCloneFlow) {
        return [];
      }
      return filterCommandPaletteGroups({
        activeGroups,
        query,
        isInSubmenu: currentView !== null,
        projectSearchItems,
        threadSearchItems: [],
      });
    },
    [activeGroups, query, currentView, projectSearchItems, addProjectCloneFlow]
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
      console.log("[DIAG] handleKeyDown: Enter key pressed. addProjectCloneFlow =", addProjectCloneFlow, "query =", query);
      toastManager.add({
        type: "info",
        title: "[DIAG] Enter Pressed",
        description: `flow active: ${!!addProjectCloneFlow}, query: "${query}"`,
      });
      if (addProjectCloneFlow) {
        const trimmedQuery = query.trim();
        toastManager.add({
          type: "info",
          title: `[DIAG] step is: ${addProjectCloneFlow.step}`,
          description: `trimmedQuery: "${trimmedQuery}"`,
        });
        if (trimmedQuery.length > 0) {
          if (addProjectCloneFlow.step === "repository") {
            console.log("[DIAG] handleKeyDown: Enter in repository step. Invoking handleLookupRepository.");
            toastManager.add({
              type: "info",
              title: "[DIAG] Triggering Lookup",
              description: `Calling handleLookupRepository for "${trimmedQuery}"`,
            });
            void handleLookupRepository();
          } else if (addProjectCloneFlow.step === "confirm") {
            console.log("[DIAG] handleKeyDown: Enter in confirm step. Invoking triggerClone.");
            toastManager.add({
              type: "info",
              title: "[DIAG] Triggering Clone",
              description: `Calling triggerClone for provider=${addProjectCloneFlow.provider}, destinationPath="${trimmedQuery}"`,
            });
            void triggerClone(
              addProjectCloneFlow.provider,
              addProjectCloneFlow.repositoryInput,
              trimmedQuery,
              addProjectCloneFlow.remoteUrl
            );
          }
        }
        return;
      }

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
      if (addProjectCloneFlow) {
        event.preventDefault();
        if (addProjectCloneFlow.step === "confirm") {
          setAddProjectCloneFlow({
            step: "repository",
            provider: addProjectCloneFlow.provider,
          });
          setQuery(addProjectCloneFlow.repositoryInput ?? "");
        } else {
          setAddProjectCloneFlow(null);
          setQuery("");
        }
        return;
      }
      if (currentView) {
        event.preventDefault();
        setViewStack((prev) => prev.slice(0, -1));
        setQuery("");
        setHighlightedItemValue(null);
      }
    } else if (event.key === "Backspace" && query.length === 0) {
      if (addProjectCloneFlow) {
        event.preventDefault();
        if (addProjectCloneFlow.step === "confirm") {
          setAddProjectCloneFlow({
            step: "repository",
            provider: addProjectCloneFlow.provider,
          });
          setQuery(addProjectCloneFlow.repositoryInput ?? "");
        } else {
          setAddProjectCloneFlow(null);
          setQuery("");
        }
        return;
      }
      if (currentView) {
        event.preventDefault();
        setViewStack((prev) => prev.slice(0, -1));
        setQuery("");
        setHighlightedItemValue(null);
      }
    }
  };

  const mode = getCommandPaletteMode({ currentView, isBrowsing });
  let placeholder = getCommandPaletteInputPlaceholder(mode);
  if (addProjectCloneFlow) {
    if (addProjectCloneFlow.step === "repository") {
      placeholder = addProjectCloneFlow.provider === "git-url"
        ? "Enter Git repository clone URL..."
        : `Enter repository (e.g. owner/repo) for ${addProjectCloneFlow.provider === "azure-devops" ? "Azure DevOps" : addProjectCloneFlow.provider}...`;
    } else if (addProjectCloneFlow.step === "confirm") {
      placeholder = "Enter absolute clone destination path (e.g. ~/projects/my-app)...";
    }
  }

  return (
    <CommandDialogPopup data-command-palette>
      <Command>
        <div className="flex items-center border-b px-3">
          {(currentView || addProjectCloneFlow) && (
            <button
              onClick={() => {
                if (addProjectCloneFlow) {
                  if (addProjectCloneFlow.step === "confirm") {
                    setAddProjectCloneFlow({
                      step: "repository",
                      provider: addProjectCloneFlow.provider,
                      repositoryInput: addProjectCloneFlow.repositoryInput,
                    });
                    setQuery(addProjectCloneFlow.repositoryInput ?? "");
                    setLookupError(null);
                  } else {
                    setAddProjectCloneFlow(null);
                    setQuery("");
                    setLookupError(null);
                  }
                } else {
                  setViewStack((prev) => prev.slice(0, -1));
                  setQuery("");
                  setHighlightedItemValue(null);
                }
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
            {...(addProjectCloneFlow?.step === "repository" && query.trim().length > 0
              ? {
                  endAddon: (
                    <button
                      type="button"
                      disabled={isRemoteProjectLookingUp}
                      className="flex items-center gap-1.5 rounded-sm bg-accent border border-border/40 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-accent/80 transition-colors pointer-events-auto"
                      onClick={() => void handleLookupRepository()}
                    >
                      {isRemoteProjectLookingUp ? "Looking up..." : addProjectCloneFlow.provider === "git-url" ? "Continue" : "Lookup"}
                      <kbd className="opacity-75 text-[9px] font-sans">Enter</kbd>
                    </button>
                  ),
                }
              : {})}
          />
        </div>
        <CommandPanel className="max-h-[300px] overflow-y-auto">
          {remoteProjectContext ? (
            <div className="p-2 pb-0">
              <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                Repository
              </div>
              <div className="flex min-h-8 items-center gap-2 rounded-sm px-2 py-1.5 bg-accent/30 border border-border/40">
                {remoteProjectContext.icon}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-foreground text-sm font-medium">
                    {remoteProjectContext.title}
                  </span>
                  <span className="truncate text-muted-foreground/70 text-xs">
                    {remoteProjectContext.description}
                  </span>
                </span>
              </div>
            </div>
          ) : null}

          {isRemoteProjectLookingUp ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <span className="animate-spin text-lg">⌛</span>
              <span>Looking up repository on {addProjectCloneFlow?.provider === "azure-devops" ? "Azure DevOps" : addProjectCloneFlow?.provider}...</span>
            </div>
          ) : isRemoteProjectCloning ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <span className="animate-spin text-lg">⚡</span>
              <span>Cloning repository to destination...</span>
            </div>
          ) : isBrowsePending ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading directories...
            </div>
          ) : lookupError ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-destructive">{lookupError}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Press Backspace or Esc to go back and try again.
              </p>
            </div>
          ) : (
            <CommandPaletteResults
              groups={filteredGroups}
              highlightedItemValue={highlightedItemValue}
              isActionsOnly={query.startsWith(">")}
              keybindings={keybindings}
              onExecuteItem={handleExecuteItem}
              {...(addProjectCloneFlow?.step === "repository"
                ? {
                    emptyStateMessage:
                      addProjectCloneFlow.provider === "git-url"
                        ? "Enter a Git clone URL and press Enter to continue."
                        : `Enter a repository path (e.g. owner/repo) and press Enter to look it up on ${addProjectCloneFlow.provider === "azure-devops" ? "Azure DevOps" : addProjectCloneFlow.provider}.`,
                  }
                : addProjectCloneFlow?.step === "confirm"
                  ? { emptyStateMessage: "Choose a destination path and press Enter to clone." }
                  : {})}
            />
          )}
        </CommandPanel>
        <CommandFooter>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-xs">
              <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">↑↓</kbd> Navigate
            </span>
            {addProjectCloneFlow?.step === "repository" ? (
              <span className="flex items-center gap-1 text-xs">
                <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">Enter</kbd> {addProjectCloneFlow.provider === "git-url" ? "Continue" : "Lookup"}
              </span>
            ) : addProjectCloneFlow?.step === "confirm" ? (
              <span className="flex items-center gap-1 text-xs">
                <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">Enter</kbd> Clone
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs">
                <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">Enter</kbd> Select
              </span>
            )}
            {(currentView || addProjectCloneFlow) && (
              <span className="flex items-center gap-1 text-xs">
                <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">Backspace</kbd> Back
              </span>
            )}
            <span className="flex items-center gap-1 text-xs">
              <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-sans">Esc</kbd> Close
            </span>
          </div>
        </CommandFooter>
      </Command>
    </CommandDialogPopup>
  );
}
