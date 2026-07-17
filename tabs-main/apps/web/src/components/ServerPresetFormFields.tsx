import React from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { ScrollArea } from "./ui/scroll-area";
import { ChevronUpIcon, ChevronDownIcon, XIcon, PlusIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { ServerProcessDraft } from "./ProjectWorkspaceSettingsSection";

export function ServerPresetFormFields(props: {
  preset: ServerProcessDraft;
  presetDrafts: ServerProcessDraft[];
  projectCwd: string;
  isEditing?: boolean;
  presetRowRef?: (node: HTMLDivElement | null) => void;
  updatePresetRow: (id: string, updater: (current: ServerProcessDraft) => ServerProcessDraft) => void;
  addCommandStep: (id: string) => void;
  updateCommandStep: (id: string, index: number, command: string) => void;
  moveCommandStep: (id: string, index: number, direction: -1 | 1) => void;
  removeCommandStep: (id: string, index: number) => void;
  movePresetRow?: (id: string, direction: -1 | 1) => void;
  removePresetRow?: (id: string) => void;
  index?: number;
  variant?: "card" | "plain";
}) {
  const {
    preset,
    presetDrafts,
    projectCwd,
    isEditing,
    presetRowRef,
    updatePresetRow,
    addCommandStep,
    updateCommandStep,
    moveCommandStep,
    removeCommandStep,
    movePresetRow,
    removePresetRow,
    index,
    variant = "card",
  } = props;

  const displayIndex = index ?? 0;

  return (
    <div
      key={preset.id}
      ref={(node) => {
        if (presetRowRef) presetRowRef(node);
      }}
      className={
        variant === "card"
          ? cn(
              "space-y-3 rounded-2xl border border-border/70 p-4",
              isEditing && "border-primary/50 ring-1 ring-primary/30",
            )
          : "space-y-4"
      }
    >
      {variant === "card" && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-foreground">Preset {displayIndex + 1}</div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              disabled={index === undefined || index === 0}
              onClick={() => movePresetRow?.(preset.id, -1)}
              aria-label={`Move preset ${displayIndex + 1} up`}
            >
              <ChevronUpIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              disabled={index === undefined || index === presetDrafts.length - 1}
              onClick={() => movePresetRow?.(preset.id, 1)}
              aria-label={`Move preset ${displayIndex + 1} down`}
            >
              <ChevronDownIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              onClick={() => removePresetRow?.(preset.id)}
              aria-label={`Delete preset ${displayIndex + 1}`}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Label</div>
                    <Input
                      value={preset.label}
                      onChange={(event) =>
                        updatePresetRow(preset.id, (current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      placeholder="Frontend"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">Command Steps</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addCommandStep(preset.id)}
                      >
                        <PlusIcon className="size-3.5" />
                        Add Step
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {preset.commands.map((command: string, commandIndex: number) => {
                        const stepKey = `${preset.id}-step-${commandIndex}`;
                        return (
                          <div key={stepKey} className="flex gap-2">
                            <div className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-border/70 bg-muted/20 text-xs font-medium text-muted-foreground">
                              {commandIndex + 1}
                            </div>
                            <Input
                              value={command}
                              onChange={(event) =>
                                updateCommandStep(preset.id, commandIndex, event.target.value)
                              }
                              placeholder={
                                commandIndex === 0
                                  ? "npm install"
                                  : commandIndex === 1
                                    ? "npm run dev"
                                    : "echo ready"
                              }
                            />
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              disabled={commandIndex === 0}
                              onClick={() => moveCommandStep(preset.id, commandIndex, -1)}
                              aria-label={`Move step ${commandIndex + 1} up`}
                            >
                              <ChevronUpIcon className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              disabled={commandIndex === preset.commands.length - 1}
                              onClick={() => moveCommandStep(preset.id, commandIndex, 1)}
                              aria-label={`Move step ${commandIndex + 1} down`}
                            >
                              <ChevronDownIcon className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              disabled={preset.commands.length === 1}
                              onClick={() => removeCommandStep(preset.id, commandIndex)}
                              aria-label={`Delete step ${commandIndex + 1}`}
                            >
                              <XIcon className="size-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Working Directory</div>
                    <Input
                      value={preset.cwd}
                      onChange={(event) =>
                        updatePresetRow(preset.id, (current) => ({
                          ...current,
                          cwd: event.target.value,
                        }))
                      }
                      placeholder={projectCwd}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Auto-start</div>
                      <div className="text-xs text-muted-foreground">
                        Launch this preset automatically when the Server tab opens.
                      </div>
                    </div>
                    <Switch
                      checked={preset.autoStart}
                      onCheckedChange={(checked) =>
                        updatePresetRow(preset.id, (current) => ({
                          ...current,
                          autoStart: Boolean(checked),
                        }))
                      }
                    />
                  </div>
                
                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <div className="text-sm font-medium text-foreground">Preview Configuration</div>
                    
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">URL Target</div>
                      <Input
                        value={preset.previewUrl || ""}
                        onChange={(event) =>
                          updatePresetRow(preset.id, (current) => ({
                            ...current,
                            previewUrl: event.target.value,
                          }))
                        }
                        placeholder="http://localhost:3000"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-medium text-foreground">Target Browser</div>
                      <select
                        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={preset.previewOpenTarget ?? "in-app"}
                        onChange={(e) =>
                          updatePresetRow(preset.id, (current) => ({
                            ...current,
                            previewOpenTarget: e.target.value as "in-app" | "external",
                          }))
                        }
                      >
                        <option value="in-app" className="bg-popover text-popover-foreground">Internal Browser</option>
                        <option value="external" className="bg-popover text-popover-foreground">System Browser</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">Auto-switch to browser</div>
                        <div className="text-xs text-muted-foreground">
                          Open the preview tab automatically when the server starts.
                        </div>
                      </div>
                      <Switch
                        checked={preset.autoOpenPreview ?? false}
                        onCheckedChange={(checked) =>
                          updatePresetRow(preset.id, (current) => ({
                            ...current,
                            autoOpenPreview: Boolean(checked),
                          }))
                        }
                      />
                    </div>
                  </div>
</div>
  );
}
