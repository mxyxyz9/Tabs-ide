/**
 * ChatMessageList Component
 * 
 * Extracted from the massive ChatView component to improve maintainability.
 * Handles message rendering, scrolling, and user interactions.
 */

import { useRef, useCallback, useMemo } from "react";
import type { ThreadId } from "@tabs/contracts";
import type { ChatMessage } from "../types";
import { MessagesTimeline } from "./MessagesTimeline";
import { cn } from "~/lib/utils";

export interface ChatMessageListProps {
  threadId: ThreadId;
  messages: ChatMessage[];
  className?: string;
  onScrollToBottom?: () => void;
  isNearBottom?: boolean;
  isLoading?: boolean;
  onMessageAction?: (messageId: string, action: string) => void;
}

export function ChatMessageList({
  threadId,
  messages,
  className,
  onScrollToBottom,
  isNearBottom = true,
  isLoading = false,
  onMessageAction,
}: ChatMessageListProps) {
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  
  // Memoize message processing to avoid unnecessary re-renders
  const processedMessages = useMemo(() => {
    return messages.map((message, index) => ({
      ...message,
      key: `${message.id}-${index}`,
      isLast: index === messages.length - 1,
      isFirst: index === 0,
    }));
  }, [messages]);

  const handleScrollToBottom = useCallback(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
    onScrollToBottom?.();
  }, [onScrollToBottom]);

  if (isLoading) {
    return (
      <div className={cn("flex-1 overflow-y-auto flex items-center justify-center", className)}>
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn("flex-1 overflow-y-auto flex items-center justify-center", className)}>
        <div className="text-center text-muted-foreground">
          <div className="mb-2">No messages yet</div>
          <div className="text-sm">Start a conversation to see messages here</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={messagesScrollRef} 
      className={cn("flex-1 overflow-y-auto relative", className)}
    >
      <MessagesTimeline
        threadId={threadId}
        messages={processedMessages}
        onMessageAction={onMessageAction}
      />
      
      {/* Scroll to bottom button - only show when not near bottom */}
      {!isNearBottom && (
        <button
          onClick={handleScrollToBottom}
          className="absolute bottom-4 right-4 rounded-full bg-primary p-2 shadow-lg hover:bg-primary/90 transition-colors z-10"
          aria-label="Scroll to bottom"
          type="button"
        >
          <svg 
            className="h-4 w-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}

ChatMessageList.displayName = "ChatMessageList";