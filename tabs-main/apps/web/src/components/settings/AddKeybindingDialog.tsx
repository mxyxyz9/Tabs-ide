import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { WhenExpressionBuilder } from "./KeybindingsSettings";
import type { KeybindingCommand, KeybindingRule } from "@tabs/contracts";
import type { KeybindingRow, WhenVariableOption } from "./keybindingsSettings.logic";
import { useState } from "react";

interface AddKeybindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandOptions: readonly KeybindingCommand[];
  allRows: readonly KeybindingRow[];
  variables: readonly WhenVariableOption[];
  isSaving: boolean;
  onSave: (rule: KeybindingRule) => void;
  platform: string;
}

export function AddKeybindingDialog({
  open,
  onOpenChange,
  commandOptions,
  allRows,
  variables,
  isSaving,
  onSave,
  platform,
}: AddKeybindingDialogProps) {
  const [command, setCommand] = useState<KeybindingCommand | "">("");
  const [key, setKey] = useState("");
  const [whenNode, setWhenNode] = useState<any>(undefined);

  const handleSave = () => {
    if (!command || !key) return;
    
    onSave({
      command: command as KeybindingCommand,
      key,
      ...(whenNode ? { when: undefined } : {}),
    });
    
    setCommand("");
    setKey("");
    setWhenNode(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Keybinding</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Command</label>
            <Select value={command} onValueChange={(value) => setCommand(value as KeybindingCommand)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a command" />
              </SelectTrigger>
              <SelectContent>
                {commandOptions.map((cmd) => (
                  <SelectItem key={cmd} value={cmd}>
                    {cmd}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Keybinding</label>
            <Input
              placeholder="Press your keybinding"
              value={key}
              onChange={(e) => setKey(e.currentTarget.value)}
            />
          </div>

          <WhenExpressionBuilder
            value={whenNode}
            variables={variables}
            onChange={setWhenNode}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !command || !key}>
              {isSaving ? "Saving..." : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
