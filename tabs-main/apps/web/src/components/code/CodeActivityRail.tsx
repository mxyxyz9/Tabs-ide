import {
  BugIcon,
  FilesIcon,
  GitBranchIcon,
  MenuIcon,
  PuzzleIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import { type ComponentType, type CSSProperties, Fragment, useMemo } from "react";

import {
  CODE_ACTIVITY_ITEMS,
  CODE_CHROME_COMMANDS,
  CODE_MENU_BAR,
  type CodeActivityItem,
  type CodeChromeState,
} from "@tabs/shared/codeChrome";

import { cn } from "../../lib/utils";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useTheme } from "../../hooks/useTheme";

const ICONS: Record<CodeActivityItem["icon"], ComponentType<{ className?: string }>> = {
  files: FilesIcon,
  search: SearchIcon,
  "git-branch": GitBranchIcon,
  bug: BugIcon,
  puzzle: PuzzleIcon,
};

/**
 * A resolved custom-container icon ready to render. `codicon` renders the real
 * VS Code icon font glyph; `mask` renders an extension-shipped image (already a
 * data URI — see the integration extension) as a CSS mask tinted with the
 * current text color, matching how VS Code's own activity bar treats container
 * icons (monochrome, theme-tinted).
 */
type ResolvedRailIcon = { type: "codicon"; id: string } | { type: "mask"; url: string };

/** Render an image as a centered, contained CSS mask so `bg-current` tints it. */
function maskStyle(url: string): CSSProperties {
  const image = `url("${url}")`;
  return {
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
}

interface CodeActivityRailProps {
  chromeState: CodeChromeState;
  onRunCommand: (commandId: string) => void;
}

/**
 * Native replacement for VS Code's activity bar. Renders a vertical icon rail in
 * the gutter beside the embedded editor (VS Code's own activity bar is hidden via
 * settings). Clicking an item reveals the matching sidebar view inside the
 * embedded workbench through the command transport.
 */
export function CodeActivityRail(props: CodeActivityRailProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Memoize and sort dynamic custom items by (order ?? Number.MAX_SAFE_INTEGER) followed by label.localeCompare as a stable key.
  const customItems = useMemo(() => {
    if (!props.chromeState.activityBarItems) return [];
    return props.chromeState.activityBarItems.toSorted((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.label || "").localeCompare(b.label || "");
    });
  }, [props.chromeState.activityBarItems]);

  // Resolve each container's contributed icon into a directly-renderable form.
  // Image icons arrive as self-contained data URIs from the integration
  // extension (the rail is on a different origin than the Code server, so it
  // can't fetch `/vscode-remote-resource`), so no URL building is needed here.
  const customItemsWithIcons = useMemo(() => {
    return customItems.map((item) => {
      let resolvedIcon: ResolvedRailIcon | null = null;
      const icon = item.icon;
      if (icon) {
        if (icon.type === "themeIcon" && icon.value) {
          resolvedIcon = { type: "codicon", id: icon.value };
        } else if (icon.type === "uri" && icon.value) {
          resolvedIcon = { type: "mask", url: icon.value };
        } else if (icon.type === "themeUri") {
          const url = isDark ? (icon.dark ?? icon.value) : (icon.light ?? icon.value);
          if (url) {
            resolvedIcon = { type: "mask", url };
          }
        }
      }
      return { ...item, resolvedIcon };
    });
  }, [customItems, isDark]);

  return (
    <nav
      aria-label="Code views"
      className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border/70 bg-background py-2"
    >
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label="Application menu"
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-foreground"
            >
              <MenuIcon className="size-5" />
            </button>
          }
        />
        <MenuPopup side="right" align="start" sideOffset={8}>
          {CODE_MENU_BAR.map((menu) => (
            <MenuSub key={menu.id}>
              <MenuSubTrigger>{menu.label}</MenuSubTrigger>
              <MenuSubPopup>
                {menu.groups.map((group, groupIndex) => (
                  <Fragment key={`${menu.id}-${group.items[0]?.commandId ?? groupIndex}`}>
                    {groupIndex > 0 ? <MenuSeparator /> : null}
                    {group.items.map((entry) => {
                      const key = `${menu.id}-${entry.commandId}-${entry.label}`;
                      // Auto Save is a toggle: show a live checkmark from the
                      // workbench's files.autoSave state, and clicking runs the
                      // toggle command (which flips it back through the channel).
                      if (entry.commandId === "workbench.action.toggleAutoSave") {
                        return (
                          <MenuCheckboxItem
                            key={key}
                            checked={props.chromeState.autoSaveEnabled ?? false}
                            closeOnClick
                            onClick={() => props.onRunCommand(entry.commandId)}
                          >
                            {entry.label}
                          </MenuCheckboxItem>
                        );
                      }
                      return (
                        <MenuItem key={key} onClick={() => props.onRunCommand(entry.commandId)}>
                          {entry.label}
                          {entry.shortcut ? <MenuShortcut>{entry.shortcut}</MenuShortcut> : null}
                        </MenuItem>
                      );
                    })}
                  </Fragment>
                ))}
              </MenuSubPopup>
            </MenuSub>
          ))}
        </MenuPopup>
      </Menu>

      {CODE_ACTIVITY_ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = props.chromeState.activeViewId === item.id;
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

      {customItemsWithIcons.map((item) => {
        const active = props.chromeState.activeViewId === item.id;
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
                  {item.resolvedIcon?.type === "codicon" ? (
                    <span
                      aria-hidden
                      className={cn("codicon", `codicon-${item.resolvedIcon.id}`)}
                      style={{ fontSize: "20px" }}
                    />
                  ) : item.resolvedIcon?.type === "mask" ? (
                    <span
                      aria-hidden
                      className="size-5 bg-current"
                      style={maskStyle(item.resolvedIcon.url)}
                    />
                  ) : (
                    <PuzzleIcon className="size-5" />
                  )}
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
