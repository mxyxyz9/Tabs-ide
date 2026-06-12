import { RotateCcwIcon, SearchIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";

import type { KeybindingRule, ResolvedKeybindingsConfig } from "@tabs/contracts";

import { cn } from "../../lib/utils";
import { formatShortcutLabel } from "../../keybindings";
import { parseKeybindingShortcut } from "@tabs/shared/keybindings";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Kbd } from "../ui/kbd";
import {
  buildKeybindingRows,
  commandLabel,
  type KeybindingRow,
  keybindingFromKeyboardEvent,
  parseWhenExpressionDraft,
} from "./keybindingsSettings.logic";

export interface KeybindingsSettingsProps {
  readonly keybindings: ResolvedKeybindingsConfig;
  readonly onUpsert: (rule: KeybindingRule) => Promise<unknown> | unknown;
  readonly onRemove: (rule: KeybindingRule) => Promise<unknown> | unknown;
  readonly platform?: string;
}

function ruleFromRow(row: KeybindingRow, patch: { key?: string; when?: string }): KeybindingRule {
  const when = patch.when !== undefined ? patch.when : row.when;
  const normalizedWhen = when.trim().length > 0 ? when.trim() : undefined;
  return {
    command: row.command,
    key: patch.key ?? row.key,
    ...(normalizedWhen ? { when: normalizedWhen } : {}),
  };
}

function ShortcutLabel({ keyInput, platform }: { keyInput: string; platform: string }) {
  const shortcut = parseKeybindingShortcut(keyInput);
  if (!shortcut) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }
  return <Kbd className="px-1.5">{formatShortcutLabel(shortcut, platform)}</Kbd>;
}

export function KeybindingsSettings({
  keybindings,
  onUpsert,
  onRemove,
  platform = typeof navigator === "undefined" ? "" : navigator.platform,
}: KeybindingsSettingsProps) {
  const [query, setQuery] = useState("");
  const [recordingRowId, setRecordingRowId] = useState<string | null>(null);
  const [whenEditRowId, setWhenEditRowId] = useState<string | null>(null);
  const [whenDraft, setWhenDraft] = useState("");
  const [whenError, setWhenError] = useState<string | null>(null);
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const recordInputRef = useRef<HTMLInputElement | null>(null);

  const rows = useMemo(() => buildKeybindingRows(keybindings, query), [keybindings, query]);

  const runSave = (rowId: string, action: Promise<unknown> | unknown) => {
    setPendingRowId(rowId);
    void Promise.resolve(action).finally(() => {
      setPendingRowId((current) => (current === rowId ? null : current));
    });
  };

  const handleRecordKeyDown = (row: KeybindingRow, event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecordingRowId(null);
      return;
    }
    const nextKey = keybindingFromKeyboardEvent(event, platform);
    if (!nextKey || nextKey === row.key) {
      if (nextKey === row.key) setRecordingRowId(null);
      return;
    }
    setRecordingRowId(null);
    runSave(row.id, onUpsert(ruleFromRow(row, { key: nextKey })));
  };

  const beginWhenEdit = (row: KeybindingRow) => {
    setWhenEditRowId(row.id);
    setWhenDraft(row.when);
    setWhenError(null);
  };

  const commitWhenEdit = (row: KeybindingRow) => {
    const parsed = parseWhenExpressionDraft(whenDraft);
    if (!parsed.ok) {
      setWhenError(parsed.message);
      return;
    }
    setWhenEditRowId(null);
    setWhenError(null);
    if (whenDraft.trim() === row.when.trim()) return;
    runSave(row.id, onUpsert(ruleFromRow(row, { when: whenDraft })));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search keybindings"
          className="h-8 pl-8 text-sm"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-border/70">
        <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(150px,0.9fr)_minmax(150px,1fr)_70px] items-center border-b border-border/70 bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <div>Command</div>
          <div>Keys</div>
          <div>When</div>
          <div className="text-right">Source</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No keybindings match “{query}”.
          </div>
        ) : (
          rows.map((row) => {
            const isRecording = recordingRowId === row.id;
            const isEditingWhen = whenEditRowId === row.id;
            const isPending = pendingRowId === row.id;
            return (
              <div
                key={row.id}
                className={cn(
                  "grid grid-cols-[minmax(180px,1.2fr)_minmax(150px,0.9fr)_minmax(150px,1fr)_70px] items-center px-4 py-1.5 text-sm even:bg-muted/15 hover:bg-accent/40",
                  isPending && "opacity-60",
                )}
              >
                {/* Command */}
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-foreground">
                      {commandLabel(row.command)}
                    </span>
                    {row.conflicts.length > 0 ? (
                      <TriangleAlertIcon
                        className="size-3.5 shrink-0 text-amber-500"
                        aria-label={`Conflicts with ${row.conflicts.join(", ")}`}
                      />
                    ) : null}
                  </div>
                  <span className="truncate text-[11px] text-muted-foreground/70">
                    {row.command}
                  </span>
                </div>

                {/* Keys */}
                <div className="pr-3">
                  {isRecording ? (
                    <Input
                      ref={recordInputRef}
                      autoFocus
                      readOnly
                      value=""
                      placeholder="Press shortcut…"
                      onKeyDown={(event) => handleRecordKeyDown(row, event)}
                      onBlur={() => setRecordingRowId(null)}
                      className="h-7 w-full text-xs"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRecordingRowId(row.id)}
                      className="inline-flex min-h-7 items-center rounded-md border border-transparent px-1 hover:border-border/70 hover:bg-background/60"
                      title="Click, then press a shortcut to rebind"
                    >
                      <ShortcutLabel keyInput={row.key} platform={platform} />
                    </button>
                  )}
                </div>

                {/* When */}
                <div className="pr-3">
                  {isEditingWhen ? (
                    <div className="flex flex-col gap-1">
                      <Input
                        autoFocus
                        value={whenDraft}
                        onChange={(event) => {
                          setWhenDraft(event.target.value);
                          setWhenError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitWhenEdit(row);
                          } else if (event.key === "Escape") {
                            setWhenEditRowId(null);
                            setWhenError(null);
                          }
                        }}
                        onBlur={() => commitWhenEdit(row)}
                        placeholder="Always"
                        className="h-7 w-full text-xs"
                      />
                      {whenError ? (
                        <span className="text-[11px] text-destructive">{whenError}</span>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginWhenEdit(row)}
                      className="inline-flex min-h-7 items-center rounded-md border border-transparent px-1 text-xs hover:border-border/70 hover:bg-background/60"
                      title="Click to edit the when condition"
                    >
                      {row.when.length > 0 ? (
                        <code className="text-foreground/90">{row.when}</code>
                      ) : (
                        <span className="text-muted-foreground">Always</span>
                      )}
                    </button>
                  )}
                </div>

                {/* Source + actions */}
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      row.source === "Custom"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground/70",
                    )}
                  >
                    {row.source === "Custom" ? "Custom" : ""}
                  </span>
                  {row.source === "Custom" ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="size-6 p-0"
                      title="Reset to default"
                      aria-label={`Reset ${commandLabel(row.command)} to default`}
                      onClick={() => runSave(row.id, onRemove(ruleFromRow(row, {})))}
                    >
                      <RotateCcwIcon className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
