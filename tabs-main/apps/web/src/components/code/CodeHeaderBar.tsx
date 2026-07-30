import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  GitBranchIcon,
  MessageSquareIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import { CODE_CHROME_COMMANDS, deriveActiveFileName } from "@tabs/shared/codeChrome";

import { cn } from "../../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface CodeHeaderBarProps {
  workspaceName: string;
  activeFilePath: string | null;
  /** Current git branch (from the embedded workbench's chrome state). */
  branch: string | null;
  /** Whether the bottom panel is maximised to fill the editor (drives the chevron). */
  panelMaximized: boolean;
  /** Whether the native AI side chat is open (drives the toggle highlight). */
  sideChatOpen: boolean;
  /** Toggle the native AI side chat (Tabs Agents chat, replaces Copilot). */
  onToggleSideChat: () => void;
  onRunCommand: (commandId: string) => void;
}

function HeaderAction(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={props.label}
            onClick={props.onClick}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {props.children}
          </button>
        }
      />
      <TooltipPopup side="bottom">{props.label}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * Native header bar above the embedded editor — the app-frame chrome that
 * replaces VS Code's title bar / command center. Left shows the workspace + the
 * active file; the centre hosts the "Go to file…" quick-open trigger; the right
 * carries the git branch, a run action and settings. Transparent so the shell's
 * own header background shows through. All actions route through the command
 * transport.
 */
export function CodeHeaderBar(props: CodeHeaderBarProps) {
  const fileName = deriveActiveFileName(props.activeFilePath);
  return (
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border/70 bg-transparent px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">
          {props.workspaceName}
        </span>
        {fileName ? (
          <>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate text-xs text-muted-foreground">{fileName}</span>
          </>
        ) : null}
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.quickOpen)}
              className="flex h-7 w-[34rem] max-w-[55%] items-center gap-2 rounded-md border border-border/70 bg-card/60 px-3 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SearchIcon className="size-3.5" />
              <span className="truncate">Go to file…</span>
            </button>
          }
        />
        <TooltipPopup side="bottom">Quick open file search</TooltipPopup>
      </Tooltip>

      <div className="flex flex-1 items-center justify-end gap-1">
        {props.branch ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`Branch: ${props.branch}`}
                  onClick={() => props.onRunCommand("workbench.view.scm")}
                  className="flex h-7 max-w-40 items-center gap-1 rounded-md px-1.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <GitBranchIcon className="size-3.5 shrink-0" />
                  <span className="truncate text-xs">{props.branch}</span>
                </button>
              }
            />
            <TooltipPopup side="bottom">{`Branch: ${props.branch}`}</TooltipPopup>
          </Tooltip>
        ) : null}
        <HeaderAction
          label="Run Task"
          onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.runTask)}
        >
          <PlayIcon className="size-4" />
        </HeaderAction>
        <HeaderAction
          label="Settings"
          onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.settings)}
        >
          <SettingsIcon className="size-4" />
        </HeaderAction>

        <span className="mx-1 h-4 w-px bg-border/70" />

        {/* VS Code layout controls: toggle primary sidebar / bottom panel /
            secondary sidebar — mirrors the editor's top-right layout cluster. */}
        <HeaderAction
          label="Toggle Sidebar"
          onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.toggleSidebar)}
        >
          <PanelLeftIcon className="size-4" />
        </HeaderAction>
        <HeaderAction
          label="Toggle Panel"
          onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.togglePanel)}
        >
          <PanelBottomIcon className="size-4" />
        </HeaderAction>
        {/* Maximise the bottom panel to fill the editor (Trae-style) and restore. */}
        <HeaderAction
          label={props.panelMaximized ? "Restore Panel" : "Maximize Panel"}
          onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.toggleMaximizedPanel)}
        >
          {props.panelMaximized ? (
            <ChevronsDownUpIcon className="size-4" />
          ) : (
            <ChevronsUpDownIcon className="size-4" />
          )}
        </HeaderAction>
        {/* Native AI side chat (Tabs Agents chat) — replaces VS Code's secondary
            sidebar / GitHub Copilot panel. */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Toggle AI Chat"
                aria-pressed={props.sideChatOpen}
                onClick={props.onToggleSideChat}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  props.sideChatOpen && "bg-accent text-foreground",
                )}
              >
                <MessageSquareIcon className="size-4" />
              </button>
            }
          />
          <TooltipPopup side="bottom">Toggle AI Chat</TooltipPopup>
        </Tooltip>
      </div>
    </header>
  );
}
