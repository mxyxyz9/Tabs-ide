import {
  ChevronLeft,
  ChevronRight,
  FileDiff,
  FolderGit2,
  GitBranch as GitBranchIcon,
  GitCommit,
  GitPullRequest,
  Github,
  History as HistoryIcon,
  Package,
  Settings,
  Tag,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";

export type NavPanel =
  | "overview"
  | "changes"
  | "diff"
  | "branches"
  | "history"
  | "prs"
  | "tags"
  | "stashes"
  | "accounts"
  | "settings";

export interface NavItem {
  id: NavPanel;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: "changes" | "prs";
}

export const NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: FolderGit2, desc: "Repo health, quick actions, and sync status" },
  { id: "changes", label: "Changes", icon: GitCommit, badge: "changes", desc: "Stage, commit, and review working tree changes" },
  { id: "diff", label: "Diff", icon: FileDiff, desc: "Browse diffs for working tree files or past commits" },
  { id: "branches", label: "Branches", icon: GitBranchIcon, desc: "Switch, create, or rename branches" },
  { id: "history", label: "History", icon: HistoryIcon, desc: "Commit timeline for the current branch" },
  { id: "prs", label: "Pull requests", icon: GitPullRequest, badge: "prs", desc: "Open, review, and create pull requests" },
  { id: "tags", label: "Tags & releases", icon: Tag, desc: "Tag commits and draft releases" },
  { id: "stashes", label: "Stashes", icon: Package, desc: "Set changes aside and reapply them later" },
  { id: "accounts", label: "Accounts", icon: Users, desc: "Manage which GitHub account this project uses" },
  { id: "settings", label: "Settings", icon: Settings, desc: "Git identity, remotes, and repo-level config" },
];

function RailTooltip({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="relative group flex items-center justify-center">
      {children}
      <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-50">
        <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border bd-2 shadow-2xl" style={{ backgroundColor: "var(--bg-surface)", width: "190px" }}>
          <span className="fs-12 font-medium tx">{title}</span>
          {desc && (
            <span className="fs-10 tx-40" style={{ lineHeight: 1.4 }}>
              {desc}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  repoName,
  panel,
  setPanel,
  collapsed,
  setCollapsed,
  changeCount,
  prCount = 0,
  hasConflict,
}: {
  repoName: string;
  panel: NavPanel;
  setPanel: (p: NavPanel) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  changeCount: number;
  prCount?: number;
  hasConflict: boolean;
}) {
  const wrapStyle = { backgroundColor: "var(--bg-base)" };
  if (collapsed) {
    return (
      <div className="w-16 flex flex-col items-center border-r bd-1 shrink-0 h-full py-4 gap-2" style={wrapStyle}>
        <RailTooltip title={repoName} desc="Expand the sidebar for full labels and details">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="group relative w-8 h-8 rounded-lg bg-o1 hov-bg-o2 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <Github size={15} className="tx-70 group-hover:opacity-0 transition-opacity" />
            <ChevronRight size={14} className="absolute tx opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </RailTooltip>
        <div className="w-6 h-px bg-o2 shrink-0 my-1" />
        <div className="flex-1 flex flex-col items-center gap-2 w-full px-2 pt-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const isActive = panel === n.id;
            const count = n.badge === "changes" ? changeCount : n.badge === "prs" ? prCount : null;
            return (
              <RailTooltip key={n.id} title={n.label} desc={n.desc}>
                <button
                  type="button"
                  data-panel={n.id}
                  onClick={() => setPanel(n.id)}
                  className={`relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    isActive ? "bg-o2 ring-safe" : "bg-o1 hov-bg-o2"
                  }`}
                >
                  {isActive && <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ backgroundColor: "var(--fg)" }} />}
                  <Icon size={15} className="tx-70" />
                  {count ? (
                    <span
                      className="absolute -bottom-1 -right-1 h-4 px-1 rounded-full border bd-2 fs-9 font-mono flex items-center justify-center"
                      style={{
                        minWidth: "16px",
                        color: n.id === "changes" && hasConflict ? "var(--sem-red)" : "var(--fg-60)",
                        backgroundColor: "var(--bg-base)",
                      }}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              </RailTooltip>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 flex flex-col border-r bd-1 shrink-0 h-full" style={wrapStyle}>
      <div className="p-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-mono tracking-widest tx-30 uppercase">Source control</span>
          <div className="text-base font-semibold tx tracking-tight mt-0.5 truncate">{repoName}</div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 rounded-lg bg-o1 hov-bg-o2 border bd-2 hov-bd-3 flex items-center justify-center tx-60 hov-tx transition-all shrink-0 cursor-pointer"
          title="Collapse sidebar"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar px-2">
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = panel === n.id;
          const count = n.badge === "changes" ? changeCount : n.badge === "prs" ? prCount : null;
          return (
            <button
              key={n.id}
              type="button"
              data-panel={n.id}
              onClick={() => setPanel(n.id)}
              className={`group relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                isActive ? "bg-o1" : "hov-bg-o1"
              }`}
            >
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: "var(--fg)" }} />}
              <Icon size={14} className={isActive ? "tx" : "tx-40 ghov-tx-70"} />
              <span className={`fs-13 flex-1 truncate ${isActive ? "tx font-medium" : "tx-60 ghov-tx-90"}`}>{n.label}</span>
              {count ? (
                <span
                  className="fs-10 font-mono px-1.5 py-0.5 rounded-full bg-o1 border bd-1"
                  style={{ color: n.id === "changes" && hasConflict ? "var(--sem-red)" : "var(--fg-40)" }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
