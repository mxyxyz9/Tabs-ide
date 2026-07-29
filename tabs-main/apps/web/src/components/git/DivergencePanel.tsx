import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Download,
  GitCompare,
  MousePointerClick,
  RefreshCw,
  Search,
  Telescope,
  Square,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { GitWatchedBranchStatus } from "@tabs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateGitQueries } from "../../lib/gitReactQuery";
import { toGitUserFacingErrorMessage } from "../../lib/gitErrorMessages";
import { readNativeApi } from "../../nativeApi";
import { toastManager } from "../ui/toast";
import { Badge, Btn, Card, Modal } from "./gitPrimitives";

type ViewMode = "active" | "spotlight" | "archived";

function useLocalStorageSet(key: string) {
  const [set, setSet] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  const save = useCallback(
    (next: string[]) => {
      setSet(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    },
    [key],
  );

  return [set, save] as const;
}

export function DivergencePanel({
  cwd,
  watchedBranchStatuses,
  isFullScan = false,
  isScanning = false,
  onScanAllBranches,
}: {
  cwd: string;
  watchedBranchStatuses: ReadonlyArray<GitWatchedBranchStatus>;
  isFullScan?: boolean;
  isScanning?: boolean;
  onScanAllBranches: () => void;
}) {
  const [confirmMergeBranch, setConfirmMergeBranch] = useState<string | null>(null);
  const [confirmRebaseBranch, setConfirmRebaseBranch] = useState<string | null>(null);

  // Search & Tab State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ViewMode>("active");

  // Selection mode — explicit toggle, not hover-driven
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBranchNames, setSelectedBranchNames] = useState<Set<string>>(new Set());

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedBranchNames(new Set());
  };

  // Per-repo persisted sets
  const [archivedBranches, saveArchivedBranches] = useLocalStorageSet(
    `tabs_archived_watched_branches_${cwd}`,
  );
  const [spotlightBranches, saveSpotlightBranches] = useLocalStorageSet(
    `tabs_spotlight_watched_branches_${cwd}`,
  );

  const archiveSet = useMemo(
    () => new Set(archivedBranches.map((b) => b.toLowerCase())),
    [archivedBranches],
  );
  const spotlightSet = useMemo(
    () => new Set(spotlightBranches.map((b) => b.toLowerCase())),
    [spotlightBranches],
  );

  // Derive the three lists
  const activeBranchList = useMemo(
    () =>
      watchedBranchStatuses.filter(
        (b) => !archiveSet.has(b.name.toLowerCase()) && !spotlightSet.has(b.name.toLowerCase()),
      ),
    [watchedBranchStatuses, archiveSet, spotlightSet],
  );

  const spotlightBranchList = useMemo(
    () =>
      watchedBranchStatuses.filter(
        (b) => spotlightSet.has(b.name.toLowerCase()) && !archiveSet.has(b.name.toLowerCase()),
      ),
    [watchedBranchStatuses, archiveSet, spotlightSet],
  );

  const archivedBranchList = useMemo(
    () => watchedBranchStatuses.filter((b) => archiveSet.has(b.name.toLowerCase())),
    [watchedBranchStatuses, archiveSet],
  );

  // Filtered list based on view + search
  const displayedBranches = useMemo(() => {
    const baseList =
      activeView === "active"
        ? activeBranchList
        : activeView === "spotlight"
          ? spotlightBranchList
          : archivedBranchList;
    if (!searchQuery.trim()) return baseList;
    const q = searchQuery.trim().toLowerCase();
    return baseList.filter((b) => b.name.toLowerCase().includes(q));
  }, [activeView, activeBranchList, spotlightBranchList, archivedBranchList, searchQuery]);

  // --- Archive toggle ---
  const handleToggleArchive = (branchName: string) => {
    const lc = branchName.toLowerCase();
    const isArchived = archiveSet.has(lc);
    if (isArchived) {
      saveArchivedBranches(archivedBranches.filter((b) => b.toLowerCase() !== lc));
      toastManager.add({ type: "info", title: `Removed ${branchName} from archive` });
    } else {
      // archiving also removes from spotlight
      saveSpotlightBranches(spotlightBranches.filter((b) => b.toLowerCase() !== lc));
      saveArchivedBranches([...archivedBranches, branchName]);
      toastManager.add({ type: "info", title: `Archived ${branchName}` });
    }
    setSelectedBranchNames((prev) => {
      const copy = new Set(prev);
      copy.delete(branchName);
      return copy;
    });
  };

  // --- Spotlight toggle ---
  const handleToggleSpotlight = (branchName: string) => {
    const lc = branchName.toLowerCase();
    const isSpotlit = spotlightSet.has(lc);
    if (isSpotlit) {
      saveSpotlightBranches(spotlightBranches.filter((b) => b.toLowerCase() !== lc));
      toastManager.add({ type: "info", title: `Removed ${branchName} from Spotlight` });
    } else {
      // spotlighting also removes from archive
      saveArchivedBranches(archivedBranches.filter((b) => b.toLowerCase() !== lc));
      saveSpotlightBranches([...spotlightBranches, branchName]);
      toastManager.add({ type: "info", title: `Added ${branchName} to Spotlight ✦` });
    }
    setSelectedBranchNames((prev) => {
      const copy = new Set(prev);
      copy.delete(branchName);
      return copy;
    });
  };

  // --- Bulk operations ---
  const handleBulkArchiveToggle = (archive: boolean) => {
    if (selectedBranchNames.size === 0) return;
    const targets = Array.from(selectedBranchNames);
    const targetSet = new Set(targets.map((t) => t.toLowerCase()));

    if (archive) {
      const nextArchived = Array.from(new Set([...archivedBranches, ...targets]));
      const nextSpotlight = spotlightBranches.filter((b) => !targetSet.has(b.toLowerCase()));
      saveArchivedBranches(nextArchived);
      saveSpotlightBranches(nextSpotlight);
      toastManager.add({
        type: "info",
        title: `Archived ${targets.length} branch${targets.length === 1 ? "" : "es"}`,
      });
    } else {
      saveArchivedBranches(archivedBranches.filter((b) => !targetSet.has(b.toLowerCase())));
      toastManager.add({
        type: "info",
        title: `Removed ${targets.length} branch${targets.length === 1 ? "" : "es"} from archive`,
      });
    }
    exitSelectMode();
  };

  const handleBulkSpotlightToggle = (spotlight: boolean) => {
    if (selectedBranchNames.size === 0) return;
    const targets = Array.from(selectedBranchNames);
    const targetSet = new Set(targets.map((t) => t.toLowerCase()));

    if (spotlight) {
      const nextSpotlight = Array.from(new Set([...spotlightBranches, ...targets]));
      const nextArchived = archivedBranches.filter((b) => !targetSet.has(b.toLowerCase()));
      saveSpotlightBranches(nextSpotlight);
      saveArchivedBranches(nextArchived);
      toastManager.add({
        type: "info",
        title: `Added ${targets.length} branch${targets.length === 1 ? "" : "es"} to Spotlight`,
      });
    } else {
      saveSpotlightBranches(spotlightBranches.filter((b) => !targetSet.has(b.toLowerCase())));
      toastManager.add({
        type: "info",
        title: `Removed ${targets.length} branch${targets.length === 1 ? "" : "es"} from Spotlight`,
      });
    }
    exitSelectMode();
  };

  // --- Selection helpers ---
  const handleToggleSelectAll = () => {
    if (selectedBranchNames.size === displayedBranches.length && displayedBranches.length > 0) {
      setSelectedBranchNames(new Set());
    } else {
      setSelectedBranchNames(new Set(displayedBranches.map((b) => b.name)));
    }
  };

  const toggleSelectOne = (branchName: string) => {
    setSelectedBranchNames((prev) => {
      const copy = new Set(prev);
      if (copy.has(branchName)) copy.delete(branchName);
      else copy.add(branchName);
      return copy;
    });
  };

  const switchView = (view: ViewMode) => {
    setActiveView(view);
    exitSelectMode();
    setSearchQuery("");
  };

  const api = readNativeApi();
  const queryClient = useQueryClient();

  const handleExecuteMerge = async (targetBranch: string) => {
    if (!api) return;
    try {
      await api.git.merge({ cwd, branch: targetBranch });
      await invalidateGitQueries(queryClient);
      setConfirmMergeBranch(null);
      toastManager.add({ type: "success", title: `Merged ${targetBranch} into current branch` });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Merge failed",
        description: toGitUserFacingErrorMessage(error),
      });
    }
  };

  const handleExecuteRebase = async (targetBranch: string) => {
    if (!api) return;
    try {
      await api.git.rebase({ cwd, branch: targetBranch });
      await invalidateGitQueries(queryClient);
      setConfirmRebaseBranch(null);
      toastManager.add({ type: "success", title: `Rebased current branch onto ${targetBranch}` });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Rebase failed",
        description: toGitUserFacingErrorMessage(error),
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare size={18} className="tx-70" />
            <h2 className="text-base font-semibold tx tracking-tight">Watched branch divergence</h2>
          </div>
          <p className="fs-12 tx-50 leading-relaxed mt-0.5">
            Compare all branches against your current HEAD. Spotlight key branches, archive noise.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="fs-10 font-mono uppercase tracking-wider tx-40 block">
              {isFullScan ? "Full scan view" : "Bounded scan view"}
            </span>
            <span className="fs-11 tx-60">
              {isFullScan ? "All branches checked" : "Top 30 active branches checked"}
            </span>
          </div>

          <Btn
            sm
            primary={!isFullScan}
            disabled={isScanning}
            onClick={onScanAllBranches}
            icon={RefreshCw}
          >
            {isScanning
              ? "Scanning all branches…"
              : isFullScan
                ? "Rescan all branches"
                : "Scan all branches"}
          </Btn>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 tx-40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search branches by name..."
            className="w-full pl-8 pr-8 py-1.5 fs-12 font-mono bg-o1 border bd-2 rounded-lg tx outline-none focus:border-sky-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 tx-40 hov-tx"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View Switcher — three tabs: Spotlight | Active | Archived */}
          <div className="flex items-center bg-o1 border bd-2 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => switchView("spotlight")}
              className={`flex items-center gap-1.5 px-3 py-1 fs-11 font-medium rounded-md transition-colors ${
                activeView === "spotlight" ? "font-semibold shadow-xs" : "tx-50 hov-tx"
              }`}
              style={
                activeView === "spotlight"
                  ? {
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-foreground)",
                    }
                  : undefined
              }
            >
              <Telescope size={11} />
              Spotlight ({spotlightBranchList.length})
            </button>
            <button
              type="button"
              onClick={() => switchView("active")}
              className={`px-3 py-1 fs-11 font-medium rounded-md transition-colors ${
                activeView === "active" ? "bg-o2 tx font-semibold shadow-xs" : "tx-50 hov-tx"
              }`}
            >
              Active ({activeBranchList.length})
            </button>
            <button
              type="button"
              onClick={() => switchView("archived")}
              className={`px-3 py-1 fs-11 font-medium rounded-md transition-colors ${
                activeView === "archived" ? "bg-o2 tx font-semibold shadow-xs" : "tx-50 hov-tx"
              }`}
            >
              Archived ({archivedBranchList.length})
            </button>
          </div>

          {/* Explicit Select Mode Toggle */}
          {!isSelectMode ? (
            <button
              type="button"
              onClick={() => setIsSelectMode(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 fs-11 font-medium rounded-md border bd-2 bg-o1 tx-50 hov-tx transition-colors"
              title="Enter selection mode"
            >
              <MousePointerClick size={13} />
              Select
            </button>
          ) : (
            <button
              type="button"
              onClick={exitSelectMode}
              className="flex items-center gap-1.5 px-2.5 py-1 fs-11 font-medium rounded-md border border-sky-700 bg-sky-900/30 text-sky-300 transition-colors"
            >
              <X size={13} />
              Done
            </button>
          )}
        </div>
      </div>

      {/* Bulk Operations Bar — only visible in selection mode with items selected */}
      {isSelectMode && selectedBranchNames.size > 0 && (
        <div className="flex items-center justify-between bg-sky-950/40 border border-sky-800/50 rounded-lg px-3.5 py-2.5 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 fs-12 font-mono text-sky-200 cursor-pointer"
            >
              {selectedBranchNames.size === displayedBranches.length ? (
                <CheckSquare size={15} className="text-sky-400" />
              ) : (
                <Square size={15} className="text-sky-400/60" />
              )}
              <span>Select all ({displayedBranches.length})</span>
            </button>
            <span className="tx-40">|</span>
            <span className="fs-12 font-mono text-sky-300 font-medium">
              {selectedBranchNames.size} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeView !== "spotlight" && (
              <Btn sm primary icon={Telescope} onClick={() => handleBulkSpotlightToggle(true)}>
                Add to Spotlight
              </Btn>
            )}
            {activeView === "spotlight" && (
              <Btn sm ghost icon={Telescope} onClick={() => handleBulkSpotlightToggle(false)}>
                Remove from Spotlight
              </Btn>
            )}
            {activeView !== "archived" && (
              <Btn sm ghost icon={Archive} onClick={() => handleBulkArchiveToggle(true)}>
                Archive
              </Btn>
            )}
            {activeView === "archived" && (
              <Btn sm ghost icon={ArchiveRestore} onClick={() => handleBulkArchiveToggle(false)}>
                Un-archive
              </Btn>
            )}
          </div>
        </div>
      )}

      {/* Main list */}
      {isScanning && watchedBranchStatuses.length === 0 ? (
        <Card className="p-8 text-center">
          <RefreshCw className="animate-spin mx-auto mb-3 tx-40" size={24} />
          <div className="fs-13 font-medium tx">Scanning all branches for divergence…</div>
          <p className="fs-11 tx-40 mt-1">Comparing all local and remote branches against HEAD</p>
        </Card>
      ) : displayedBranches.length === 0 ? (
        <Card className="p-8 text-center">
          {activeView === "spotlight" && (
            <Telescope
              className="mx-auto mb-3"
              size={24}
              style={{ color: "var(--primary)", opacity: 0.5 }}
            />
          )}
          <div className="fs-13 font-medium tx-60 mb-1">
            {searchQuery
              ? `No ${activeView} branches matching "${searchQuery}"`
              : activeView === "archived"
                ? "No archived branches"
                : activeView === "spotlight"
                  ? "No branches in Spotlight"
                  : "No active divergent branches found"}
          </div>
          <p className="fs-11 tx-40">
            {searchQuery
              ? "Try clearing your search query"
              : activeView === "archived"
                ? "Branches you archive will appear here."
                : activeView === "spotlight"
                  ? "Use the ✦ button on any branch to add it to Spotlight for quick access."
                  : "All watched branches are fully in sync with your current HEAD."}
          </p>
        </Card>
      ) : (
        <Card className="p-4">
          {/* List header */}
          <div className="flex items-center justify-between pb-2 border-b bd-1 mb-1">
            {isSelectMode ? (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-2 fs-11 font-mono tx-50 hov-tx cursor-pointer"
              >
                {selectedBranchNames.size > 0 &&
                selectedBranchNames.size === displayedBranches.length ? (
                  <CheckSquare size={14} className="text-sky-400" />
                ) : (
                  <Square size={14} className="tx-40" />
                )}
                <span>Select all ({displayedBranches.length})</span>
              </button>
            ) : (
              <span className="fs-10 font-mono uppercase tracking-wider tx-40">
                {activeView === "active"
                  ? "Active divergent branches"
                  : activeView === "spotlight"
                    ? "✦ Spotlight branches"
                    : "Archived branches"}
              </span>
            )}
            <span className="fs-11 font-mono tx-40">
              Showing {displayedBranches.length} branch{displayedBranches.length === 1 ? "" : "es"}
            </span>
          </div>

          {/* Rows */}
          <div className="flex flex-col">
            {displayedBranches.map((b, idx, arr) => {
              const isSelected = selectedBranchNames.has(b.name);
              const isSpotlit = spotlightSet.has(b.name.toLowerCase());
              return (
                <div
                  key={b.name}
                  className={`flex items-center justify-between gap-3 py-2.5 px-2 -mx-2 rounded-md transition-colors ${
                    isSelected ? "bg-o2" : "hov-bg-o1"
                  } ${idx === arr.length - 1 ? "" : "border-b bd-1"}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Checkbox — only visible in select mode */}
                    {isSelectMode && (
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(b.name)}
                        className="cursor-pointer shrink-0"
                        title={isSelected ? "Deselect" : "Select"}
                      >
                        {isSelected ? (
                          <CheckSquare size={14} className="text-sky-400" />
                        ) : (
                          <Square size={14} className="tx-40" />
                        )}
                      </button>
                    )}

                    <span className="fs-13 font-mono font-semibold tx-85 truncate">{b.name}</span>
                    {b.isRemote && <Badge tone="default">remote</Badge>}
                    {b.isDefault && <Badge tone="emerald">default</Badge>}

                    {b.behindCount > 0 && (
                      <span
                        className="flex items-center gap-0.5 fs-11 font-mono shrink-0"
                        style={{ color: "var(--sem-amber)" }}
                      >
                        <ArrowDown size={12} />
                        {b.behindCount} behind
                      </span>
                    )}
                    {b.aheadCount > 0 && (
                      <span
                        className="flex items-center gap-0.5 fs-11 font-mono shrink-0"
                        style={{ color: "var(--sem-emerald)" }}
                      >
                        <ArrowDown size={12} className="rotate-180" />
                        {b.aheadCount} ahead
                      </span>
                    )}
                  </div>

                  {/* Row actions */}
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <Btn sm ghost icon={Download} onClick={() => setConfirmMergeBranch(b.name)}>
                      Merge
                    </Btn>
                    <Btn sm ghost onClick={() => setConfirmRebaseBranch(b.name)}>
                      Rebase
                    </Btn>

                    {/* Spotlight toggle */}
                    <button
                      type="button"
                      title={isSpotlit ? "Remove from Spotlight" : "Add to Spotlight"}
                      onClick={() => handleToggleSpotlight(b.name)}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isSpotlit ? "text-amber-400 hov-bg-o1" : "tx-40 hov-tx hov-bg-o1"
                      }`}
                    >
                      <Telescope size={14} />
                    </button>

                    {/* Archive toggle */}
                    <button
                      type="button"
                      title={
                        activeView === "archived" ? "Remove from archive" : "Archive branch"
                      }
                      onClick={() => handleToggleArchive(b.name)}
                      className="p-1 rounded tx-40 hov-tx hov-bg-o1 transition-colors cursor-pointer"
                    >
                      {activeView === "archived" ? (
                        <ArchiveRestore size={14} />
                      ) : (
                        <Archive size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Confirmation Modals */}
      {confirmMergeBranch && (
        <Modal title={`Merge ${confirmMergeBranch}`} onClose={() => setConfirmMergeBranch(null)}>
          <p className="fs-12 tx-60 mb-4">
            This will merge commits from <strong>{confirmMergeBranch}</strong> into your current
            working branch.
          </p>
          <div className="flex justify-end gap-2">
            <Btn sm ghost onClick={() => setConfirmMergeBranch(null)}>
              Cancel
            </Btn>
            <Btn sm primary icon={Download} onClick={() => void handleExecuteMerge(confirmMergeBranch)}>
              Merge {confirmMergeBranch}
            </Btn>
          </div>
        </Modal>
      )}

      {confirmRebaseBranch && (
        <Modal
          title={`Rebase onto ${confirmRebaseBranch}`}
          onClose={() => setConfirmRebaseBranch(null)}
        >
          <p className="fs-12 tx-60 mb-4">
            This will rebase your current working branch commits onto{" "}
            <strong>{confirmRebaseBranch}</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <Btn sm ghost onClick={() => setConfirmRebaseBranch(null)}>
              Cancel
            </Btn>
            <Btn sm primary onClick={() => void handleExecuteRebase(confirmRebaseBranch)}>
              Rebase onto {confirmRebaseBranch}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
