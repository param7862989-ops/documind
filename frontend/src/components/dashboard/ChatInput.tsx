import React, { useRef } from "react";
import { Send, RefreshCw, FileText, X } from "lucide-react";
import { DocumentItem } from "@/lib/api";

interface ChatInputProps {
  inputValue: string;
  isSending: boolean;
  hasDocuments: boolean;
  selectedDocIds: string[];
  documents: DocumentItem[];
  onInputChange: (val: string) => void;
  onSend: () => void;
  onRemoveDoc: (id: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  className?: string;
}

export function ChatInput({
  inputValue,
  isSending,
  hasDocuments,
  selectedDocIds,
  documents,
  onInputChange,
  onSend,
  onRemoveDoc,
  inputRef,
  className = "",
}: ChatInputProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const activeInputRef = inputRef || localRef;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || isSending || !hasDocuments) return;
    onSend();
  }

  const selectedDocs = documents.filter((d) => selectedDocIds.includes(d.id));

  return (
    <div className={`pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent px-3 pb-4 pt-12 sm:px-6 ${className}`}>
      <div className="pointer-events-auto mx-auto w-full max-w-3xl">
        {/* Active Context Badges */}
        {selectedDocs.length > 0 && (
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
            <span className="text-[11px] font-medium text-[#777] mr-1">Querying:</span>
            {selectedDocs.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1 text-xs text-[#444] shadow-xs"
              >
                <FileText className="h-3 w-3 text-[#777]" />
                <span className="max-w-[140px] truncate">{doc.original_filename}</span>
                <button
                  type="button"
                  onClick={() => onRemoveDoc(doc.id)}
                  aria-label={`Remove ${doc.original_filename} from context`}
                  className="rounded p-0.5 text-[#999] hover:bg-[#f0f0f0] hover:text-[#171717]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center rounded-2xl border border-black/[0.15] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] focus-within:border-[#171717] focus-within:ring-2 focus-within:ring-black/[0.05] transition-all"
        >
          <input
            ref={activeInputRef}
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={!hasDocuments || isSending}
            placeholder={
              hasDocuments
                ? "Ask a question about your documents or compare clauses..."
                : "Upload a document above to begin asking questions..."
            }
            className="h-14 w-full bg-transparent px-5 pr-14 text-sm text-[#171717] outline-hidden placeholder:text-[#999] disabled:cursor-not-allowed disabled:bg-gray-50/50"
            aria-label="Chat query input"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || !hasDocuments || isSending}
            aria-label="Send query"
            className="absolute right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[#171717] text-white transition hover:bg-[#000] disabled:bg-[#f0f0f0] disabled:text-[#bbb] disabled:cursor-not-allowed shadow-xs"
          >
            {isSending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>

        <p className="pt-2 text-center text-[10px] text-[#999]">
          Grounded responses backed by pgvector semantic retrieval and exact page citations.
        </p>
      </div>
    </div>
  );
}
