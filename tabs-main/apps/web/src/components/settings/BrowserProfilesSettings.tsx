import { type BrowserProfileDefinition } from "@tabs/contracts/settings";
import { type BrowserProfileDomainInfo } from "@tabs/contracts";
import {
  FingerprintIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  RotateCcwIcon,
  LayersIcon,
  CheckIcon,
  GlobeIcon,
  ExternalLinkIcon,
  XIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettings, useUpdateSettings } from "../../hooks/useSettings";
import { useAtomValue } from "@effect/atom-react";
import { projectsAtom } from "../../state/threads";
import { workspaceShellActions, workspaceShellAtom } from "../../state/workspaceShell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { useConfirm } from "../../hooks/useConfirm";
import { toastManager } from "../ui/toast";
import { cn } from "../../lib/utils";
import { removeBrowserProfileAssignments } from "./browserProfileAssignments";

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f43f5e", // Rose
  "#6366f1", // Indigo
];

interface QuickPortal {
  name: string;
  url: string;
}

const DEFAULT_PORTALS: QuickPortal[] = [
  { name: "Google", url: "https://accounts.google.com" },
  { name: "ChatGPT", url: "https://chatgpt.com" },
  { name: "Figma", url: "https://www.figma.com/login" },
  { name: "GitHub", url: "https://github.com/login" },
  { name: "Linear", url: "https://linear.app/login" },
];

function slugifyProfileId(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function BrowserProfilesSettings() {
  const settings = useSettings();
  const { updateSettings } = useUpdateSettings();
  const { confirm, confirmDialog } = useConfirm();
  const projects = useAtomValue(projectsAtom);
  const shellState = useAtomValue(workspaceShellAtom);

  const profiles: readonly BrowserProfileDefinition[] = useMemo(() => {
    return settings.browserProfiles && settings.browserProfiles.length > 0
      ? settings.browserProfiles
      : [
          { id: "personal", label: "Personal", color: "#3b82f6", createdAt: 0 },
          { id: "work", label: "Work", color: "#10b981", createdAt: 0 },
        ];
  }, [settings.browserProfiles]);

  // Compute live usage across all projects in the workspace
  const usageByProfileId = useMemo(() => {
    const map = new Map<string, Array<{ projectName: string; tabName: string }>>();
    for (const project of projects) {
      const pSettings = shellState.projectSettingsByProjectId[project.id];
      if (!pSettings) continue;

      // Check default browser tool
      if (pSettings.browser.partitionMode === "profile") {
        const profileId = (pSettings.browser.partitionProfile ?? "").trim();
        if (profileId) {
          const list = map.get(profileId) ?? [];
          list.push({ projectName: project.name || "Untitled Project", tabName: "Browser" });
          map.set(profileId, list);
        }
      }

      // Check custom embeds
      for (const embed of pSettings.customEmbeds ?? []) {
        if (embed.partitionMode === "profile") {
          const profileId = (embed.partitionProfile ?? "").trim();
          if (profileId) {
            const list = map.get(profileId) ?? [];
            list.push({
              projectName: project.name || "Untitled Project",
              tabName: embed.label || "Custom Tab",
            });
            map.set(profileId, list);
          }
        }
      }
    }
    return map;
  }, [projects, shellState.projectSettingsByProjectId]);
  const hasNamedProfileAssignments = useMemo(
    () => Array.from(usageByProfileId.values()).some((assignments) => assignments.length > 0),
    [usageByProfileId],
  );

  // Live domain & auth inspection per profile
  const [profileDomains, setProfileDomains] = useState<Record<string, BrowserProfileDomainInfo[]>>(
    {},
  );
  const refreshDomains = useCallback(async () => {
    if (!window.desktopBridge?.getBrowserProfileDomains) return;
    const res: Record<string, BrowserProfileDomainInfo[]> = {};
    for (const p of profiles) {
      try {
        const domains = await window.desktopBridge.getBrowserProfileDomains({ profileId: p.id });
        res[p.id] = domains;
      } catch {
        res[p.id] = [];
      }
    }
    setProfileDomains(res);
  }, [profiles]);

  useEffect(() => {
    refreshDomains();
  }, [refreshDomains]);

  useEffect(() => {
    const subscribe = window.desktopBridge?.onBrowserProfileDataChanged;
    if (!subscribe) return;
    return subscribe(() => void refreshDomains());
  }, [refreshDomains]);

  // Quick portals customized by user
  const [customPortals, setCustomPortals] = useState<QuickPortal[]>(() => {
    try {
      const raw = localStorage.getItem("tabs:custom-login-portals:v1");
      return raw ? JSON.parse(raw) : DEFAULT_PORTALS;
    } catch {
      return DEFAULT_PORTALS;
    }
  });

  const [isAddingPortal, setIsAddingPortal] = useState(false);
  const [newPortalName, setNewPortalName] = useState("");
  const [newPortalUrl, setNewPortalUrl] = useState("");

  const handleAddCustomPortal = () => {
    const name = newPortalName.trim();
    let url = newPortalUrl.trim();
    if (!name || !url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    const updated = [...customPortals, { name, url }];
    setCustomPortals(updated);
    try {
      localStorage.setItem("tabs:custom-login-portals:v1", JSON.stringify(updated));
    } catch {}
    setIsAddingPortal(false);
    setNewPortalName("");
    setNewPortalUrl("");
  };

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BrowserProfileDefinition | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [idDraft, setIdDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [colorDraft, setColorDraft] = useState("#3b82f6");
  const [clearingProfileId, setClearingProfileId] = useState<string | null>(null);

  // In-Dialog Interactive Login & Session Tester
  const [testingProfile, setTestingProfile] = useState<BrowserProfileDefinition | null>(null);
  const [testUrl, setTestUrl] = useState<string>("https://accounts.google.com");
  const [selectedLoginUrl, setSelectedLoginUrl] = useState<string>("https://accounts.google.com");
  const [loginWindowOpen, setLoginWindowOpen] = useState(false);

  const openCreateModal = () => {
    setEditingProfile(null);
    setLabelDraft("");
    setIdDraft("");
    setDescriptionDraft("");
    setColorDraft(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)] ?? "#3b82f6");
    setModalOpen(true);
  };

  const openEditModal = (profile: BrowserProfileDefinition) => {
    setEditingProfile(profile);
    setLabelDraft(profile.label);
    setIdDraft(profile.id);
    setDescriptionDraft(profile.description ?? "");
    setColorDraft(profile.color ?? "#3b82f6");
    setModalOpen(true);
  };

  const handleSaveProfile = () => {
    const trimmedLabel = labelDraft.trim();
    if (!trimmedLabel) return;

    const finalId = (editingProfile ? idDraft : idDraft.trim() || slugifyProfileId(trimmedLabel))
      .toLowerCase()
      .trim();

    if (!finalId) return;

    if (!editingProfile && profiles.some((p) => p.id === finalId)) {
      toastManager.add({
        type: "error",
        title: "Profile ID already exists",
        description: `A profile with ID "${finalId}" already exists. Please choose a different name or ID.`,
      });
      return;
    }

    const nextProfile: BrowserProfileDefinition = {
      id: finalId,
      label: trimmedLabel,
      ...(descriptionDraft.trim() ? { description: descriptionDraft.trim() } : {}),
      color: colorDraft,
      createdAt: editingProfile?.createdAt || Date.now(),
    };

    const nextProfiles = editingProfile
      ? profiles.map((p) => (p.id === editingProfile.id ? nextProfile : p))
      : [...profiles, nextProfile];

    updateSettings({ browserProfiles: nextProfiles });
    setModalOpen(false);
    toastManager.add({
      type: "success",
      title: editingProfile ? "Profile updated" : "Profile created",
      description: `Browser profile "${trimmedLabel}" has been saved.`,
    });
  };

  const handleDeleteProfile = async (profile: BrowserProfileDefinition) => {
    const usage = usageByProfileId.get(profile.id) ?? [];
    const message =
      usage.length > 0
        ? `Delete profile "${profile.label}"?\n\nThis profile is currently used in ${usage.length} tab(s) across your projects. Deleting it will leave those tabs using fallback sessions.`
        : `Delete profile "${profile.label}"?\n\nAre you sure you want to delete this browser profile? This cannot be undone.`;

    const confirmed = await confirm(message);
    if (!confirmed) return;

    try {
      for (const project of projects) {
        const current = shellState.projectSettingsByProjectId[project.id];
        if (!current) continue;
        const browserUsesProfile =
          current.browser.partitionMode === "profile" &&
          current.browser.partitionProfile === profile.id;
        const embedsUseProfile = current.customEmbeds.some(
          (embed) => embed.partitionMode === "profile" && embed.partitionProfile === profile.id,
        );
        if (!browserUsesProfile && !embedsUseProfile) continue;
        workspaceShellActions.upsertProjectSettings(project.id, (settings) =>
          removeBrowserProfileAssignments(settings, profile.id),
        );
      }
      await window.desktopBridge?.clearBrowserProfileData?.({ profileId: profile.id });
      const nextProfiles = profiles.filter((p) => p.id !== profile.id);
      updateSettings({ browserProfiles: nextProfiles });
      toastManager.add({
        type: "success",
        title: "Profile deleted",
        description: `Profile "${profile.label}" was cleared and its assigned tabs now use their project session.`,
      });
    } catch {
      toastManager.add({
        type: "error",
        title: "Could not delete profile",
        description: "The profile was kept because its session data could not be cleared safely.",
      });
    }
  };

  const handleClearSessionData = async (profile: BrowserProfileDefinition) => {
    const confirmed = await confirm(
      `Clear all session data for "${profile.label}"?\n\nThis will log out all accounts, clear cookies, LocalStorage, and cache for all browser tabs assigned to the "${profile.label}" profile. Other profiles will not be affected.`,
    );

    if (!confirmed) return;

    setClearingProfileId(profile.id);
    try {
      if (window.desktopBridge?.clearBrowserProfileData) {
        await window.desktopBridge.clearBrowserProfileData({ profileId: profile.id });
      }
      toastManager.add({
        type: "success",
        title: "Session data cleared",
        description: `Successfully logged out and cleared all cookies for "${profile.label}".`,
      });
      await refreshDomains();
    } catch {
      toastManager.add({
        type: "error",
        title: "Failed to clear session data",
        description: "An error occurred while communicating with the desktop session manager.",
      });
    } finally {
      setClearingProfileId(null);
    }
  };

  const handleClearSingleDomain = async (profile: BrowserProfileDefinition, domain: string) => {
    const confirmed = await confirm(
      `Log out of ${domain} for profile "${profile.label}"?\n\nThis will clear cookies and session data for ${domain} only. Other logins (e.g. Google, Figma) will stay logged in.`,
    );
    if (!confirmed) return;

    try {
      if (window.desktopBridge?.clearBrowserProfileDomain) {
        await window.desktopBridge.clearBrowserProfileDomain({
          profileId: profile.id,
          domain,
        });
        toastManager.add({
          type: "success",
          title: `Logged out of ${domain}`,
          description: `Session cleared for ${domain} in "${profile.label}".`,
        });
        await refreshDomains();
      }
    } catch {
      toastManager.add({
        type: "error",
        title: "Failed to clear domain session",
        description: `Could not remove cookies for ${domain}.`,
      });
    }
  };

  const openLoginModal = (
    profile: BrowserProfileDefinition,
    initialUrl = "https://accounts.google.com",
  ) => {
    setTestingProfile(profile);
    setTestUrl(initialUrl);
    setSelectedLoginUrl(initialUrl);
    void refreshDomains();
  };

  const openNativeProfileWindow = async (profile: BrowserProfileDefinition, rawUrl: string) => {
    let url = rawUrl.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    setTestUrl(url);
    setSelectedLoginUrl(url);
    setLoginWindowOpen(true);
    try {
      await window.desktopBridge?.openBrowserProfileLoginWindow?.({ profileId: profile.id, url });
      await refreshDomains();
      toastManager.add({
        type: "success",
        title: "Profile window closed",
        description: `Stored-site information for "${profile.label}" has been refreshed.`,
      });
    } catch {
      toastManager.add({
        type: "error",
        title: "Could not open profile window",
        description: "The native browser session could not be opened.",
      });
    } finally {
      setLoginWindowOpen(false);
    }
  };

  useEffect(() => {
    if (!testingProfile) return;
    const timer = window.setInterval(() => void refreshDomains(), 2_000);
    return () => window.clearInterval(timer);
  }, [refreshDomains, testingProfile]);

  return (
    <div className="space-y-6">
      {confirmDialog}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FingerprintIcon className="size-5 text-primary" />
            Browser Profiles & Login Isolation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create named profiles (e.g. Work, Personal, Client A) to share logins across tabs and
            projects while keeping separate accounts completely isolated.
          </p>
        </div>
        <Button onClick={openCreateModal} className="shrink-0 gap-1.5 cursor-pointer">
          <PlusIcon className="size-4" />
          Create Profile
        </Button>
      </div>

      {!hasNamedProfileAssignments ? (
        <div
          role="note"
          className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
        >
          <span className="font-medium text-foreground">Your current logins are per project.</span>{" "}
          Personal and Work are optional named profiles and currently have no assigned browser tabs,
          so project cookies do not appear in these cards. Per-project sessions remain isolated and
          do not keep an extra browser process running.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((profile) => {
          const usage = usageByProfileId.get(profile.id) ?? [];
          const domains = profileDomains[profile.id] ?? [];
          const sessionHintDomains = domains.filter((d) => d.hasSessionHint);
          const otherDomains = domains.filter((d) => !d.hasSessionHint);
          const isClearing = clearingProfileId === profile.id;

          return (
            <Card
              key={profile.id}
              className="relative overflow-hidden border border-border/70 bg-card hover:border-border transition-all shadow-xs"
            >
              <CardHeader className="pt-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="size-3.5 rounded-full shrink-0 ring-1 ring-border"
                      style={{ backgroundColor: profile.color || "#3b82f6" }}
                    />
                    <CardTitle className="text-base font-semibold truncate">
                      {profile.label}
                    </CardTitle>
                    <Badge variant="outline" className="text-[11px] font-mono shrink-0">
                      profile:{profile.id}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => openEditModal(profile)}
                      title="Edit Profile"
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleDeleteProfile(profile)}
                      title="Delete Profile"
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {profile.description ? (
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    {profile.description}
                  </CardDescription>
                ) : (
                  <CardDescription className="text-xs text-muted-foreground/60 italic mt-1">
                    No description provided
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Active Assignments */}
                <div className="rounded-lg bg-muted/40 border border-border/50 p-2.5 text-xs space-y-1.5">
                  <div className="font-medium text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <LayersIcon className="size-3.5 text-foreground/70" />
                      Active Assignments
                    </span>
                    <span className="font-mono text-[11px]">
                      {usage.length} {usage.length === 1 ? "tab" : "tabs"}
                    </span>
                  </div>
                  {usage.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {usage.map((u) => (
                        <span
                          key={`${u.projectName}:${u.tabName}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background/80 border border-border/60 text-[11px] text-foreground"
                        >
                          <span className="font-medium">{u.projectName}:</span>
                          <span className="text-muted-foreground">{u.tabName}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground/70">
                      Not currently assigned to any tabs or projects.
                    </div>
                  )}
                </div>

                {/* Logged-In Sessions & Stored Site Data */}
                <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 text-xs space-y-2">
                  <div className="font-medium text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ShieldCheckIcon className="size-3.5 text-primary" />
                      Stored Sites in This Profile
                    </span>
                    <span className="font-mono text-[11px]">
                      {domains.length} {domains.length === 1 ? "site" : "sites"}
                    </span>
                  </div>
                  {sessionHintDomains.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {sessionHintDomains.map((item) => (
                        <span
                          key={item.domain}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/30 text-[11px] text-foreground group"
                        >
                          <span
                            className="size-1.5 rounded-full bg-amber-500 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-medium">{item.domain}</span>
                          <span className="text-[10px] text-muted-foreground">session data</span>
                          <button
                            type="button"
                            onClick={() => handleClearSingleDomain(profile, item.domain)}
                            title={`Log out of ${item.domain}`}
                            className="text-muted-foreground hover:text-destructive cursor-pointer opacity-70 hover:opacity-100"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : otherDomains.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {otherDomains.map((item) => (
                        <span
                          key={item.domain}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-background/90 border border-border/70 text-[11px] text-muted-foreground group"
                        >
                          <span>{item.domain}</span>
                          <span className="text-[10px] opacity-60 font-mono">
                            ({item.cookieCount})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleClearSingleDomain(profile, item.domain)}
                            title={`Clear ${item.domain}`}
                            className="text-muted-foreground hover:text-destructive cursor-pointer opacity-70 hover:opacity-100"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground/70">
                      No site data in this named profile. Existing per-project logins are stored
                      separately.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-muted-foreground font-mono">
                    persist:tabs-browser:profile:{profile.id}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => openLoginModal(profile)}
                      className="h-7 text-xs text-foreground hover:bg-accent cursor-pointer gap-1.5"
                      title="Log in or test website logins for this profile"
                    >
                      <GlobeIcon className="size-3 text-primary" />
                      Open Profile
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleClearSessionData(profile)}
                      disabled={isClearing}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1.5"
                      title="Clear cookies, storage, and log out of all tabs using this profile"
                    >
                      <RotateCcwIcon className={cn("size-3", isClearing && "animate-spin")} />
                      Clear All Sessions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Native profile-window launcher and stored-site inspector */}
      <Dialog
        open={testingProfile !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTestingProfile(null);
            refreshDomains();
          }
        }}
      >
        <DialogContent showCloseButton={false} className="p-6 space-y-4 sm:max-w-3xl">
          <DialogHeader className="p-0 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="size-3.5 rounded-full shrink-0 ring-1 ring-border"
                  style={{ backgroundColor: testingProfile?.color || "#3b82f6" }}
                />
                <DialogTitle className="text-base font-semibold truncate">
                  Profile Session & Login: {testingProfile?.label}
                </DialogTitle>
                <Badge variant="outline" className="text-[11px] font-mono shrink-0">
                  profile:{testingProfile?.id}
                </Badge>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    setTestingProfile(null);
                    refreshDomains();
                  }}
                  className="size-7 text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-accent/60 transition-colors"
                  title="Close"
                  aria-label="Close profile session dialog"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            </div>
            <DialogDescription className="text-xs">
              Open a native browser window backed by this profile. Chromium stores its cookies and
              site data in the profile partition and shares them only with tabs assigned to it.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex items-start gap-2 px-3 py-2.5 bg-muted/30 border border-border/50 rounded-lg text-xs"
            role="note"
          >
            <ShieldCheckIcon className="mt-0.5 size-3.5 text-primary shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground text-[11px] leading-relaxed">
                A stored cookie is not proof that an account is currently signed in. Google and some
                OAuth providers may reject application-controlled browser windows; use their native
                Tabs integration when available.
              </span>
            </div>
          </div>

          {/* Quick Login Portals Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span className="flex items-center gap-1.5">
                <SparklesIcon className="size-3.5 text-primary" />
                Quick Login Portals
              </span>
              {!isAddingPortal && (
                <button
                  type="button"
                  onClick={() => setIsAddingPortal(true)}
                  className="text-xs text-primary hover:underline font-normal normal-case flex items-center gap-1 cursor-pointer"
                >
                  <PlusIcon className="size-3" />
                  Add Custom Portal
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {customPortals.map((item) => (
                <Button
                  key={item.name}
                  size="xs"
                  variant={selectedLoginUrl === item.url ? "default" : "outline"}
                  className="text-xs h-7 gap-1.5 cursor-pointer"
                  onClick={() => {
                    setTestUrl(item.url);
                    setSelectedLoginUrl(item.url);
                  }}
                >
                  <ExternalLinkIcon className="size-3 opacity-70" />
                  {item.name}
                </Button>
              ))}
            </div>

            {isAddingPortal && (
              <div className="flex items-center gap-2 p-2.5 bg-muted/40 border border-border/60 rounded-lg text-xs">
                <Input
                  value={newPortalName}
                  onChange={(e) => setNewPortalName(e.target.value)}
                  placeholder="Portal Name (e.g. Notion)"
                  className="h-7 text-xs flex-1"
                  autoFocus
                />
                <Input
                  value={newPortalUrl}
                  onChange={(e) => setNewPortalUrl(e.target.value)}
                  placeholder="https://notion.so/login"
                  className="h-7 text-xs flex-1"
                />
                <Button size="xs" onClick={handleAddCustomPortal} className="h-7 cursor-pointer">
                  Save
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setIsAddingPortal(false)}
                  className="h-7 cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Address Bar */}
          <div className="flex items-center gap-2">
            <Input
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (testingProfile) void openNativeProfileWindow(testingProfile, testUrl);
                }
              }}
              placeholder="Enter URL to log in (e.g. https://chatgpt.com)..."
              className="h-8 text-xs font-mono"
            />
            <Button
              size="xs"
              className="h-8 px-3 text-xs cursor-pointer shrink-0"
              onClick={() =>
                testingProfile && void openNativeProfileWindow(testingProfile, testUrl)
              }
              disabled={loginWindowOpen}
            >
              <ExternalLinkIcon className="size-3.5" />
              {loginWindowOpen ? "Window open…" : "Open native window"}
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">Stored sites</span>
              <span className="text-[11px] text-muted-foreground" aria-live="polite">
                {loginWindowOpen ? "Watching for session changes…" : "Up to date"}
              </span>
            </div>
            {testingProfile && (profileDomains[testingProfile.id]?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {(profileDomains[testingProfile.id] ?? []).map((item) => (
                  <span
                    key={item.domain}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px]",
                      item.hasSessionHint
                        ? "bg-amber-500/10 border border-amber-500/30 text-foreground font-medium"
                        : "bg-background border border-border/70 text-muted-foreground",
                    )}
                  >
                    {item.hasSessionHint && (
                      <span
                        className="size-1.5 rounded-full bg-amber-500 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span>{item.domain}</span>
                    <span className="text-[10px] opacity-70">{item.cookieCount} cookies</span>
                    <button
                      type="button"
                      onClick={() => handleClearSingleDomain(testingProfile, item.domain)}
                      title={`Clear stored data for ${item.domain}`}
                      aria-label={`Clear stored data for ${item.domain}`}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No cookies or stored sites have been detected for this profile.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
            <Button
              size="sm"
              onClick={() => {
                setTestingProfile(null);
                refreshDomains();
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Profile Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md p-6 space-y-4">
          <DialogHeader className="p-0 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <FingerprintIcon className="size-5 text-primary" />
                {editingProfile ? "Edit Browser Profile" : "Create Browser Profile"}
              </DialogTitle>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer rounded-md"
                title="Close"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure a named session profile to isolate cookies, logins, and accounts across your
              browser tabs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground block mb-1.5">
                Profile Name
              </label>
              <Input
                value={labelDraft}
                onChange={(e) => {
                  setLabelDraft(e.target.value);
                  if (!editingProfile) {
                    setIdDraft(slugifyProfileId(e.target.value));
                  }
                }}
                placeholder="e.g. Work Team, Client Acme, Personal"
                className="text-xs h-9"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground block mb-1.5">
                Profile Identifier / Slug
              </label>
              <Input
                value={idDraft}
                onChange={(e) => setIdDraft(slugifyProfileId(e.target.value))}
                placeholder="e.g. work, client-acme"
                disabled={Boolean(editingProfile)}
                className="text-xs h-9 font-mono"
              />
              <span className="text-[11px] text-muted-foreground mt-1.5 block">
                Maps to Electron partition:{" "}
                <code className="font-mono text-foreground font-semibold">
                  persist:tabs-browser:profile:{idDraft || "..."}
                </code>
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground block mb-1.5">
                Description (Optional)
              </label>
              <Input
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                placeholder="e.g. Primary work Figma and Linear logins"
                className="text-xs h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground block mb-1.5">
                Color Accent
              </label>
              <div className="flex items-center gap-3 pt-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColorDraft(color)}
                    className={cn(
                      "size-8 rounded-full transition-all cursor-pointer flex items-center justify-center ring-offset-2 ring-offset-background",
                      colorDraft === color
                        ? "ring-2 ring-primary scale-110 shadow-sm"
                        : "hover:scale-105 opacity-85 hover:opacity-100",
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {colorDraft === color && (
                      <CheckIcon className="size-4 text-white drop-shadow-md stroke-[2.5]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveProfile} disabled={!labelDraft.trim()}>
              {editingProfile ? "Save Changes" : "Create Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
