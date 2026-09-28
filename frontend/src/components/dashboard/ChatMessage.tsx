import React, { useState } from "react";
import { Sparkles, Copy, Check, BookOpen, User as UserIcon } from "lucide-react";
import { Message, Citation, User as UserType } from "@/lib/api";
import { CitationCard } from "./CitationCard";

interface ChatMessageProps {
  message: Message;
  index?: number;
  user: UserType | null;
  onCitationClick: (citation: Citation) => void;
}

export function ChatMessage({
  message,
  user,
  onCitationClick,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  }

  return (
    <div
      className={`flex gap-3 sm:gap-4 py-5 group ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#171717] text-white shadow-xs">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div
        className={`max-w-[88%] sm:max-w-[80%] ${
          isUser ? "order-first text-right" : "text-left"
        }`}
      >
        <div
          className={`text-sm leading-relaxed p-4 rounded-2xl ${
            isUser
              ? "bg-[#171717] text-white inline-block text-left rounded-tr-xs"
              : "bg-[#f8f8f8] border border-black/[0.08] text-[#2f2f2f] rounded-tl-xs"
          }`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Assistant Footer Actions & Citations */}
        {!isUser && (
          <div className="mt-3 space-y-3">
            {/* Copy action */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                title="Copy response"
                aria-label="Copy AI response"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-[#777] hover:bg-[#f0f0f0] hover:text-[#171717] transition opacity-80 group-hover:opacity-100"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Citations List */}
            {message.citations && message.citations.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#777] uppercase tracking-wider mb-2">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Sources & Citations ({message.citations.length})</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {message.citations.map((citation, citIdx) => (
                    <CitationCard
                      key={citIdx}
                      citation={citation}
                      onClick={() => onCitationClick(citation)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e5e5e5] text-[#444] font-semibold text-xs">
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
        </div>
      )}
    </div>
  );
}
