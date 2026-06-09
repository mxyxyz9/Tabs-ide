import { PanelLeftIcon, PanelBottomIcon, SearchIcon, TerminalIcon } from "lucide-react";
import { CODE_CHROME_COMMANDS, deriveActiveFileName } from "@tabs/shared/codeChrome";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface CodeHeaderBarProps {
  workspaceName: string;
  activeFilePath: string | null;
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
 * replaces VS Code's title bar / command center. Shows the workspace name and
 * the active file, plus quick global actions (quick open, command palette,
 * toggle sidebar / panel / terminal) routed through the command transport.
 */
export function CodeHeaderBar(props: CodeHeaderBarProps) {
  const fileName = deriveActiveFileName(props.activeFilePath);
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 bg-background px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">{props.workspaceName}</span>
        {fileName ? (
          <>
            <span className="text-muted-foreground/60">/</span>
            <span className="truncate text-sm text-muted-foreground">{fileName}</span>
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.quickOpen)}
        className="ml-auto flex h-7 max-w-64 flex-1 items-center gap-2 rounded-md border border-border/70 bg-card/60 px-2.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SearchIcon className="size-3.5" />
        <span className="truncate">Go to file…</span>
      </button>

      <div className="flex items-center gap-0.5">
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
        <HeaderAction
          label="Toggle Terminal"
          onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.toggleTerminal)}
        >
          <TerminalIcon className="size-4" />
        </HeaderAction>
      </div>
    </header>
  );
}
