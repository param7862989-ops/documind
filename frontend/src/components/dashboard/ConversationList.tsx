import React, { MouseEvent } from "react";
import { MessageSquare, Trash2, Plus } from "lucide-react";
import { Conversation } from "@/lib/api";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string, e: MouseEvent) => void;
  className?: string;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  className = "",
}: ConversationListProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Chat History ({conversations.length})
        </span>

        <button
          type="button"
          onClick={onNewChat}
          aria-label="Create new chat"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition"
        >
          <Plus className="h-3 w-3" />
          <span>New</span>
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-white/35">
          No conversations yet. Start a chat to begin.
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs transition cursor-pointer ${
                  isActive
                    ? "bg-white/15 text-white font-medium"
                    : "text-white/65 hover:bg-white/[0.08] hover:text-white"
                }`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-white/40"}`} />
                  <span className="truncate text-xs">{conv.title || "Conversation"}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => onDeleteConversation(conv.id, e)}
                  title="Delete conversation"
                  aria-label={`Delete conversation ${conv.title}`}
                  className="hidden rounded p-1 text-white/30 hover:bg-white/15 hover:text-rose-400 group-hover:block transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
