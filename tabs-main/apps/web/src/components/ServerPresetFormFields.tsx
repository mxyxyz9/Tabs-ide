import React, { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { ScrollArea } from "./ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
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

  const [isBrowserSetupOpen, setIsBrowserSetupOpen] = useState(() => preset.autoOpenPreview || !!preset.previewUrl || preset.previewOpenTarget === "external");

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
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-foreground">Browser Tool Integration</div>
                      <Switch
                        checked={isBrowserSetupOpen}
                        onCheckedChange={(checked) => {
                          setIsBrowserSetupOpen(Boolean(checked));
                          if (!checked) {
                            updatePresetRow(preset.id, (current) => ({
                              ...current,
                              previewUrl: undefined,
                              autoOpenPreview: undefined,
                              previewOpenTarget: undefined,
                              previewFocus: undefined,
                            }));
                          }
                        }}
                      />
                    </div>
                    {isBrowserSetupOpen && (
                      <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-1">
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
                      <div className="flex bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => updatePresetRow(preset.id, (current) => ({...current, previewOpenTarget: "in-app"}))}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                            preset.previewOpenTarget !== "external" 
                              ? "bg-zinc-800 text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Internal Browser
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePresetRow(preset.id, (current) => ({...current, previewOpenTarget: "external"}))}
                          className={cn(
                            "text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                            preset.previewOpenTarget === "external" 
                              ? "bg-zinc-800 text-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Default Browser
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">Auto-switch to browser</div>
                        <div className="text-xs text-muted-foreground">
                          Open the browser tool tab automatically when the server starts.
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
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <div>
                      <div className="text-sm font-medium text-foreground mb-1">Dependencies</div>
                      <div className="text-xs text-muted-foreground">
                        Select presets that must start before this one. They will run automatically with a slight delay.
                      </div>
                    </div>
                    {presetDrafts.filter((p: any) => p.id !== preset.id).length > 0 ? (
                      <div className="space-y-2">
                        {presetDrafts.filter((p: any) => p.id !== preset.id).map((dep: any) => {
                          const isChecked = preset.dependsOn?.includes(dep.id) ?? false;
                          return (
                            <div key={dep.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-zinc-950/20 px-3 py-2.5">
                              <span className="text-sm font-medium text-zinc-300">{dep.label || "Untitled Preset"}</span>
                              <Switch
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  updatePresetRow(preset.id, (current) => {
                                    const currentDependsOn = current.dependsOn || [];
                                    const nextDependsOn = checked 
                                      ? [...currentDependsOn, dep.id] 
                                      : currentDependsOn.filter((id: string) => id !== dep.id);
                                    return { ...current, dependsOn: nextDependsOn };
                                  });
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/60 italic border border-border/40 rounded-xl px-3 py-3 text-center bg-zinc-950/20">
                        No other presets available to depend on.
                      </div>
                    )}
                  </div>
</div>
  );
}
