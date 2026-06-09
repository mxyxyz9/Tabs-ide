import { CircleDotIcon, GitBranchIcon, TerminalIcon } from "lucide-react";
import { CODE_CHROME_COMMANDS, type CodeChromeState } from "@tabs/shared/codeChrome";

import { cn } from "../../lib/utils";

interface CodeStatusBarProps {
  chrome: CodeChromeState;
  onRunCommand: (commandId: string) => void;
}

/**
 * Native status bar below the embedded editor (VS Code's own status bar is
 * hidden via settings). Minimal and themed: branch, dirty-editor count, and a
 * terminal toggle. Fed by chrome state pushed from the embedded workbench.
 */
export function CodeStatusBar(props: CodeStatusBarProps) {
  const { chrome } = props;
  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border/70 bg-background px-3 text-xs text-muted-foreground">
      {chrome.branch ? (
        <button
          type="button"
          onClick={() => props.onRunCommand("workbench.view.scm")}
          className="flex items-center gap-1 rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GitBranchIcon className="size-3.5" />
          <span className="max-w-40 truncate">{chrome.branch}</span>
        </button>
      ) : null}

      {chrome.dirtyCount > 0 ? (
        <span className="flex items-center gap-1">
          <CircleDotIcon className="size-3.5" />
          {chrome.dirtyCount} unsaved
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => props.onRunCommand(CODE_CHROME_COMMANDS.toggleTerminal)}
        className={cn(
          "ml-auto flex items-center gap-1 rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          chrome.panelOpen && "text-foreground",
        )}
      >
        <TerminalIcon className="size-3.5" />
        Terminal
      </button>
    </footer>
  );
}
