import {
  BugIcon,
  FilesIcon,
  GitBranchIcon,
  PuzzleIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  CODE_ACTIVITY_ITEMS,
  CODE_CHROME_COMMANDS,
  type CodeActivityItem,
  type CodeActivityViewId,
} from "@tabs/shared/codeChrome";

import { cn } from "../../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const ICONS: Record<CodeActivityItem["icon"], ComponentType<{ className?: string }>> = {
  files: FilesIcon,
  search: SearchIcon,
  "git-branch": GitBranchIcon,
  bug: BugIcon,
  puzzle: PuzzleIcon,
};

interface CodeActivityRailProps {
  activeViewId: CodeActivityViewId | null;
  onRunCommand: (commandId: string) => void;
}

/**
 * Native replacement for VS Code's activity bar. Renders a vertical icon rail in
 * the gutter beside the embedded editor (VS Code's own activity bar is hidden via
 * settings). Clicking an item reveals the matching sidebar view inside the
 * embedded workbench through the command transport.
 */
export function CodeActivityRail(props: CodeActivityRailProps) {
  return (
    <nav
      aria-label="Code views"
      className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border/70 bg-background py-2"
    >
      {CODE_ACTIVITY_ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = props.activeViewId === item.id;
        return (
          <Tooltip key={item.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={item.label}
                  aria-pressed={active}
                  onClick={() => props.onRunCommand(item.commandId)}
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    active && "text-foreground",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  ) : null}
                  <Icon className="size-5" />
                </button>
              }
            />
            <TooltipPopup side="right">{item.label}</TooltipPopup>
          </Tooltip>
        );
      })}

      <div className="mt-auto">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Settings"
                onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.settings)}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SettingsIcon className="size-5" />
              </button>
            }
          />
          <TooltipPopup side="right">Settings</TooltipPopup>
        </Tooltip>
      </div>
    </nav>
  );
}
