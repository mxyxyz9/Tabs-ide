/**
 * ChatComposer Component
 *
 * Extracted from the massive ChatView component to improve maintainability.
 * Handles message composition, input validation, and provider integration.
 *
 * This is a simplified version that can be gradually integrated with the existing
 * ChatView component while maintaining compatibility.
 */

import { useState, useCallback, useMemo } from "react";
import type {
  ProviderKind,
  ModelSelection,
  ThreadId,
  ProviderApprovalDecision,
  ResolvedKeybindingsConfig,
  ServerProvider,
  ApprovalRequestId,
} from "@tabs/contracts";
import { Button } from "../ui/button";
import { BotIcon, ListTodoIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
export interface ChatComposerProps {
  threadId: ThreadId;
  className?: string;
  provider?: ProviderKind;
  modelSelection?: ModelSelection;
  availableProviders?: readonly ServerProvider[];
  keybindings?: ResolvedKeybindingsConfig;
  isDisabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
  pendingApprovals?: {
    requestId: ApprovalRequestId;
    isResponding: boolean;
    onRespondToApproval: (
      requestId: ApprovalRequestId,
      decision: ProviderApprovalDecision,
    ) => Promise<void>;
  }[];
  pendingUserInputs?: any[];
  proposedPlans?: { title: string; id: string }[];
  placeholder?: string;
  onSendMessage?: (message: string, terminalContextIds?: string[]) => void;
  onProviderChange?: (provider: ProviderKind, model: string) => void;
  onCommandSelect?: (command: string) => void;
  onApprovalAction?: (
    requestId: ApprovalRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<void>;
  onUserInputSubmit?: (inputId: string, value: string) => void;
  onPlanFollowUp?: (planId: string) => void;
}

export function ChatComposer({
  threadId,
  className,
  provider = "codex",
  modelSelection,
  availableProviders = [],
  keybindings = [],
  isDisabled = false,
  isLoading = false,
  error = null,
  pendingApprovals = [],
  pendingUserInputs = [],
  proposedPlans = [],
  placeholder = "Type your message...",
  onSendMessage,
  onProviderChange,
  onCommandSelect,
  onApprovalAction,
  onUserInputSubmit,
  onPlanFollowUp,
}: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [showCommands, setShowCommands] = useState(false);

  const isSendDisabled = useMemo(() => {
    return isDisabled || isLoading || !message.trim();
  }, [isDisabled, isLoading, message]);

  const handleSend = useCallback(() => {
    if (isSendDisabled) return;

    const trimmedMessage = message.trim();
    if (trimmedMessage) {
      onSendMessage?.(trimmedMessage, []);
      setMessage("");
    }
  }, [message, isSendDisabled, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleProviderSelect = useCallback(
    (newProvider: ProviderKind, model: string) => {
      onProviderChange?.(newProvider, model);
    },
    [onProviderChange],
  );

  if (isLoading) {
    return (
      <div className={cn("p-4 border-t bg-background", className)}>
        <div className="flex items-center justify-center text-muted-foreground">
          <BotIcon className="h-4 w-4 mr-2 animate-pulse" />
          Preparing composer...
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 p-4 border-t bg-background", className)}>
      {/* Error Banner */}
      {error && (
        <div className="pt-3 mx-auto max-w-3xl">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      {/* Provider Status */}
      {availableProviders.find((p) => p.instanceId === provider && p.status !== "ready") && (
        <div className="pt-3 mx-auto max-w-3xl">
          <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
            Provider {provider} has limited availability
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingApprovals.map((approval) => (
            <div key={approval.requestId} className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={approval.isResponding}
                onClick={() => void approval.onRespondToApproval(approval.requestId, "decline")}
              >
                Decline
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={approval.isResponding}
                onClick={() => void approval.onRespondToApproval(approval.requestId, "accept")}
              >
                Accept
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Main Composer Input */}
      <div className="relative">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          className="min-h-[100px] resize-none"
          rows={4}
        />
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={provider}
            onValueChange={(value) =>
              handleProviderSelect(value as ProviderKind, modelSelection?.model || "gpt-4")
            }
            disabled={isDisabled}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {availableProviders.map((p) => (
                <SelectItem key={p.instanceId} value={p.instanceId}>
                  {p.instanceId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCommands(!showCommands)}
            disabled={isDisabled}
            className="text-muted-foreground"
          >
            <ListTodoIcon className="h-4 w-4 mr-1" />
            Commands
          </Button>

          <Button onClick={handleSend} disabled={isSendDisabled} size="sm" className="min-w-[80px]">
            {isLoading ? (
              <>
                <BotIcon className="h-4 w-4 mr-1 animate-pulse" />
                Sending...
              </>
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

ChatComposer.displayName = "ChatComposer";
