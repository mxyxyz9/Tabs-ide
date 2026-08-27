import {
  BugIcon,
  FilesIcon,
  GitBranchIcon,
  MenuIcon,
  PuzzleIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import { type ComponentType, Fragment } from "react";
import {
  CODE_ACTIVITY_ITEMS,
  CODE_CHROME_COMMANDS,
  type CodeActivityItem,
  type CodeChromeState,
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
  chromeState: CodeChromeState;
  onRunCommand: (commandId: string) => void;
}

function RailButton(props: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={props.label}
            aria-pressed={props.active}
            onClick={props.onClick}
            className={cn(
              "group relative flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              props.active && "bg-accent/70 text-foreground",
            )}
          >
            {props.active ? (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
              />
            ) : null}
            {props.children}
          </button>
        }
      />
      <TooltipPopup side="right">{props.label}</TooltipPopup>
    </Tooltip>
  );
}

/** Stable Tabs activity rail backed only by allowlisted workbench commands. */
export function CodeActivityRail(props: CodeActivityRailProps) {
  return (
    <nav
      aria-label="Code views"
      className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border/70 bg-background py-2"
    >
      <RailButton
        label="Command palette"
        onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.commandPalette)}
      >
        <MenuIcon aria-hidden="true" className="size-[18px]" />
      </RailButton>
      {CODE_ACTIVITY_ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = props.chromeState.activeViewId === item.id;
        return (
          <Fragment key={item.id}>
            {item.id === "debug" ? (
              <span aria-hidden="true" className="my-1 h-px w-5 bg-border/70" />
            ) : null}
            <RailButton
              label={item.label}
              active={active}
              onClick={() => props.onRunCommand(item.commandId)}
            >
              <span aria-hidden="true">
                <Icon className="size-[18px]" />
              </span>
            </RailButton>
          </Fragment>
        );
      })}
      <div className="mt-auto">
        <RailButton
          label="Open settings"
          onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.settings)}
        >
          <SettingsIcon aria-hidden="true" className="size-[18px]" />
        </RailButton>
      </div>
    </nav>
  );
}
