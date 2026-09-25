import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  DicesIcon,
  FolderOpenIcon,
  ImageIcon,
  LayoutGridIcon,
  PlusIcon,
  PowerOffIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import {
  SettingsSection,
  SettingsRow,
  SettingsSectionHeader,
} from "./SettingsLayout";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { useTheme } from "../../hooks/useTheme";
import {
  WALLPAPERS,
  WALLPAPER_CATEGORIES,
  type WallpaperCategory,
  type WallpaperOption,
  getInitialAgentWallpaper,
  saveAgentWallpaperPreference,
  getIsAgentWallpaperEnabled,
  saveIsAgentWallpaperEnabled,
  getCustomWallpapers,
  addCustomWallpaper,
  removeCustomWallpaper,
  getAllAgentWallpapers,
  getAllThreadWallpaperAssignments,
  clearThreadWallpaper,
  AGENT_WALLPAPER_CHANGE_EVENT,
} from "../onboarding/wallpapers";
import { WallpaperGalleryModal } from "../onboarding/WallpaperGalleryModal";

export default function WallpaperSettings() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";

  const [isEnabled, setIsEnabled] = useState<boolean>(() => getIsAgentWallpaperEnabled());
  const [activeWallpaper, setActiveWallpaper] = useState<WallpaperOption>(() =>
    getInitialAgentWallpaper(),
  );
  const [customWallpapers, setCustomWallpapers] = useState<readonly WallpaperOption[]>(() =>
    getCustomWallpapers(),
  );
  const [threadAssignments, setThreadAssignments] = useState<Record<string, string>>(() =>
    getAllThreadWallpaperAssignments(),
  );
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<WallpaperCategory>("All");
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [customLabelInput, setCustomLabelInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state on events
  const syncState = useCallback(() => {
    setIsEnabled(getIsAgentWallpaperEnabled());
    setActiveWallpaper(getInitialAgentWallpaper());
    setCustomWallpapers(getCustomWallpapers());
    setThreadAssignments(getAllThreadWallpaperAssignments());
  }, []);

  useEffect(() => {
    window.addEventListener(AGENT_WALLPAPER_CHANGE_EVENT, syncState);
    window.addEventListener("storage", syncState);
    return () => {
      window.removeEventListener(AGENT_WALLPAPER_CHANGE_EVENT, syncState);
      window.removeEventListener("storage", syncState);
    };
  }, [syncState]);

  const handleToggle = (checked: boolean) => {
    saveIsAgentWallpaperEnabled(checked);
    setIsEnabled(checked);
  };

  const handleSelect = (wp: WallpaperOption) => {
    saveAgentWallpaperPreference(wp.url);
    setActiveWallpaper(wp);
  };

  const handleShuffle = () => {
    const all = getAllAgentWallpapers();
    const others = all.filter((w) => w.url !== activeWallpaper.url);
    const random = others[Math.floor(Math.random() * others.length)] ?? all[0]!;
    handleSelect(random);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const added = addCustomWallpaper({
          label: cleanName || "Custom Anime Scene",
          url: dataUrl,
          description: "Uploaded custom image",
        });
        setCustomWallpapers(getCustomWallpapers());
        handleSelect(added);
        setShowAddCustom(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddUrl = () => {
    if (!customUrlInput.trim()) return;
    const added = addCustomWallpaper({
      label: customLabelInput.trim() || "Custom Anime Scene",
      url: customUrlInput.trim(),
      description: "Added via URL",
    });
    setCustomUrlInput("");
    setCustomLabelInput("");
    setCustomWallpapers(getCustomWallpapers());
    handleSelect(added);
    setShowAddCustom(false);
  };

  const handleDeleteCustom = (id: string) => {
    removeCustomWallpaper(id);
    setCustomWallpapers(getCustomWallpapers());
    // If the active wallpaper was deleted, fall back to default
    if (activeWallpaper.id === id) {
      handleSelect(WALLPAPERS[0]!);
    }
  };

  const handleClearThreadAssignment = (threadId: string) => {
    clearThreadWallpaper(threadId);
    setThreadAssignments(getAllThreadWallpaperAssignments());
  };

  const allWallpapers = getAllAgentWallpapers();
  const filteredWallpapers = useMemo(() => {
    if (selectedCategory === "All") return allWallpapers;
    return allWallpapers.filter((w) => w.category === selectedCategory);
  }, [allWallpapers, selectedCategory]);

  const threadEntries = Object.entries(threadAssignments);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Main Feature Toggle Section ───────────────────────────── */}
      <SettingsSection
        title="Workspace Wallpapers"
        description="Anime aesthetic landscapes for the agent chat area with interactive controls and animated wave-halftone particles."
      >
        <SettingsRow
          title="Enable Workspace Wallpapers"
          description="Off by default for a classic dark IDE look. When enabled, displays anime backgrounds in the workspace that gracefully blend with Light and Dark modes."
          control={<Switch checked={isEnabled} onCheckedChange={handleToggle} />}
        />
      </SettingsSection>

      {/* ── Active Wallpaper & Preview Card ──────────────────────── */}
      {isEnabled && (
        <SettingsSection
          title="Active Wallpaper"
          description="Currently active workspace wallpaper. Adapts automatically to Light and Dark mode."
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card/60 p-4">
            <div className="flex items-center gap-4">
              <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl border border-border shadow-md">
                <img
                  src={activeWallpaper.url}
                  alt={activeWallpaper.label}
                  className="size-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {activeWallpaper.label}
                  </span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/50">
                    {activeWallpaper.category}
                  </span>
                  {activeWallpaper.isCustom && (
                    <span className="rounded-full bg-sky-500/20 text-sky-400 px-2 py-0.5 text-[10px] font-medium border border-sky-400/30">
                      Custom
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {activeWallpaper.description}
                </p>
                <span className="text-[11px] text-muted-foreground/70 mt-1">
                  {isLight
                    ? "☀️ Light Mode: Artwork at top, washed into radiant white canvas"
                    : "🌙 Dark Mode: Neutral dark vignette & depth mask"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShuffle}
                className="gap-1.5 cursor-pointer"
              >
                <DicesIcon className="size-3.5 text-amber-500" />
                <span>Surprise Me</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsGalleryOpen(true)}
                className="gap-1.5 cursor-pointer"
              >
                <LayoutGridIcon className="size-3.5" />
                <span>Full Gallery ({allWallpapers.length})</span>
              </Button>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* ── Custom Wallpaper Manager ─────────────────────────────── */}
      <SettingsSection
        title="Custom Wallpapers"
        description="Add your own favorite anime images from your computer or web URLs."
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {customWallpapers.length === 0
                ? "No custom wallpapers added yet."
                : `${customWallpapers.length} custom image${customWallpapers.length === 1 ? "" : "s"} imported.`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddCustom((prev) => !prev)}
              className="gap-1.5 cursor-pointer"
            >
              <PlusIcon className="size-3.5" />
              <span>Add Custom Wallpaper</span>
            </Button>
          </div>

          {showAddCustom && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 cursor-pointer"
                >
                  <UploadIcon className="size-3.5 text-sky-500" />
                  <span>Upload Local File</span>
                </Button>
                <span className="text-xs text-muted-foreground">or paste URL:</span>
              </div>

              <div className="flex flex-1 items-center gap-2 max-w-md">
                <Input
                  type="text"
                  value={customLabelInput}
                  onChange={(e) => setCustomLabelInput(e.target.value)}
                  placeholder="Scene Name (optional)"
                  className="h-8 text-xs"
                />
                <Input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-xs flex-1"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddUrl}
                  disabled={!customUrlInput.trim()}
                  className="cursor-pointer"
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {customWallpapers.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {customWallpapers.map((wp) => {
                const isActive = wp.url === activeWallpaper.url;
                return (
                  <div
                    key={wp.id}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-xl border transition-all",
                      isActive
                        ? "border-sky-500 ring-2 ring-sky-500/40 bg-sky-500/5"
                        : "border-border/70 bg-card/40 hover:border-border",
                    )}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                      <img src={wp.url} alt={wp.label} className="size-full object-cover" />
                      {isActive && (
                        <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-black shadow-xs">
                          <CheckIcon className="size-3 stroke-[3]" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteCustom(wp.id)}
                        className="absolute left-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-md bg-black/60 text-red-400 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                        title="Delete custom wallpaper"
                      >
                        <Trash2Icon className="size-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="text-xs font-medium text-foreground truncate">
                        {wp.label}
                      </span>
                      {!isActive && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleSelect(wp)}
                          className="h-6 text-[10px] cursor-pointer"
                        >
                          Use
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* ── Per-Thread Wallpaper Assignments ──────────────────────── */}
      <SettingsSection
        title="Per-Thread Wallpapers"
        description="Wallpapers assigned specifically to individual chat threads."
      >
        {threadEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
            No threads currently have custom wallpapers assigned. When chatting in any thread, you can
            select "This thread only" from the wallpaper menu.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {threadEntries.map(([threadId, url]) => {
              const matched = allWallpapers.find((w) => w.url === url);
              return (
                <div
                  key={threadId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative aspect-video w-16 overflow-hidden rounded-lg border border-border">
                      <img src={url} alt="" className="size-full object-cover" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        Thread: {threadId.slice(0, 16)}...
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {matched?.label ?? "Custom Wallpaper"}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleClearThreadAssignment(threadId)}
                    className="gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RotateCcwIcon className="size-3" />
                    <span>Reset to Default</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>

      {/* ── Curated Wallpapers Browser ────────────────────────────── */}
      <SettingsSection
        title="Curated Gallery"
        description="Browse all 30 high-resolution anime scenes and click to set as active."
      >
        <div className="flex flex-col gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {WALLPAPER_CATEGORIES.map((cat) => {
              const isCatSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-all shrink-0 cursor-pointer border",
                    isCatSelected
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredWallpapers.map((wp) => {
              const isSelected = wp.url === activeWallpaper.url;
              return (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => handleSelect(wp)}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 cursor-pointer select-none focus:outline-none",
                    isSelected
                      ? "border-sky-500 ring-2 ring-sky-500/40 bg-sky-500/10 shadow-md scale-[1.02]"
                      : "border-border/70 bg-card/40 hover:border-border hover:shadow-md hover:scale-[1.01]",
                  )}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                    <img
                      src={wp.url}
                      alt={wp.label}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-mono font-medium text-white/80 border border-white/10">
                      {wp.category}
                    </span>
                    {isSelected && (
                      <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-black shadow-xs">
                        <CheckIcon className="size-3 stroke-[3]" />
                      </div>
                    )}
                    <span className="absolute bottom-1.5 left-2 right-2 text-xs font-bold text-white truncate drop-shadow-md">
                      {wp.label}
                    </span>
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] text-muted-foreground leading-tight line-clamp-1">
                      {wp.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* ── Full Modal ────────────────────────────────────────────── */}
      <WallpaperGalleryModal
        isOpen={isGalleryOpen}
        activeWallpaperUrl={activeWallpaper.url}
        theme={resolvedTheme}
        onSelectWallpaper={(wp) => {
          handleSelect(wp);
          setIsGalleryOpen(false);
        }}
        onDisableWallpaper={() => {
          handleToggle(false);
          setIsGalleryOpen(false);
        }}
        onClose={() => setIsGalleryOpen(false)}
        wallpapers={allWallpapers}
      />
    </div>
  );
}
