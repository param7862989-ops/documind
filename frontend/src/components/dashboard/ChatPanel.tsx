import React, { useRef, useEffect } from "react";
import { Sparkles, FileText, ChevronRight, RefreshCw } from "lucide-react";
import { Message, Citation, DocumentItem, User as UserType } from "@/lib/api";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  documents: DocumentItem[];
  selectedDocIds: string[];
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  user: UserType | null;
  onInputChange: (val: string) => void;
  onSend: (prompt?: string) => void;
  onCitationClick: (citation: Citation) => void;
  onRemoveSelectedDoc: (id: string) => void;
  onUploadClick?: () => void;
  className?: string;
}

const SUGGESTIONS = [
  {
    title: "Summarize key terms",
    description: "Extract main obligations, timelines, and deliverables.",
  },
  {
    title: "Identify termination clauses",
    description: "Find notice periods, early termination fees, and renewal conditions.",
  },
  {
    title: "Review financial obligations",
    description: "Locate pricing terms, fee schedules, and payment penalties.",
  },
  {
    title: "Cross-check governing law",
    description: "Determine legal jurisdiction, liability caps, and dispute venues.",
  },
];

export function ChatPanel({
  documents,
  selectedDocIds,
  messages,
  inputValue,
  isSending,
  user,
  onInputChange,
  onSend,
  onCitationClick,
  onRemoveSelectedDoc,
  onUploadClick,
  className = "",
}: ChatPanelProps) {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasDocuments = documents.length > 0;

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col ${className}`}>
      {/* Scrollable Message Thread */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center max-w-2xl mx-auto text-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f5] border border-black/[0.08] shadow-xs mb-5">
              <Sparkles className="h-6 w-6 text-[#171717]" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171717]">
              How can I assist your document review?
            </h2>

            <p className="mt-2.5 text-xs sm:text-sm text-[#666] max-w-md leading-relaxed">
              Ask targeted questions, verify contract provisions, and extract citations grounded in your uploaded files.
            </p>

            {!hasDocuments ? (
              <div className="mt-8 p-6 rounded-2xl border border-black/[0.08] bg-[#fafafa] max-w-sm text-center">
                <FileText className="h-6 w-6 mx-auto text-[#777] mb-2" />
                <h4 className="text-xs font-semibold text-[#171717]">No documents available</h4>
                <p className="text-[11px] text-[#777] mt-1 mb-4">
                  Upload a PDF, DOCX, TXT or image file to begin querying.
                </p>
                {onUploadClick && (
                  <button
                    type="button"
                    onClick={onUploadClick}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#171717] px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-[#000] transition"
                  >
                    Upload Document
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    onClick={() => onSend(suggestion.title)}
                    className="group flex flex-col justify-between p-4 rounded-xl border border-black/[0.08] bg-white hover:border-black/[0.2] hover:bg-[#fafafa] shadow-xs transition"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-[#171717] group-hover:text-black">
                        {suggestion.title}
                      </h4>
                      <p className="text-[11px] text-[#777] mt-1 leading-normal">
                        {suggestion.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center text-[11px] font-medium text-[#888] group-hover:text-[#171717]">
                      <span>Ask query</span>
                      <ChevronRight className="h-3.5 w-3.5 ml-1 transition group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-2">
            {messages.map((message, idx) => (
              <ChatMessage
                key={message.id || idx}
                message={message}
                index={idx}
                user={user}
                onCitationClick={onCitationClick}
              />
            ))}

            {isSending && (
              <div className="flex gap-3.5 py-4 items-center animate-in fade-in">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#171717] text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-[#f8f8f8] border border-black/[0.08] px-4 py-3 text-xs text-[#666]">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#171717]" />
                  <span>Searching document chunks and synthesizing answer...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      {/* Fixed Composer Form */}
      <ChatInput
        inputValue={inputValue}
        isSending={isSending}
        hasDocuments={hasDocuments}
        selectedDocIds={selectedDocIds}
        documents={documents}
        onInputChange={onInputChange}
        onSend={() => onSend()}
        onRemoveDoc={onRemoveSelectedDoc}
        inputRef={inputRef}
      />
    </div>
  );
}
