import React, { MouseEvent } from "react";
import { CheckSquare, Square, Layers, FileText } from "lucide-react";
import { DocumentItem } from "@/lib/api";
import { DocumentCard } from "./DocumentCard";
import { EmptyState } from "../common/EmptyState";

interface DocumentListProps {
  documents: DocumentItem[];
  selectedDocIds: string[];
  isComparing: boolean;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onCompare: () => void;
  onInspect: (doc: DocumentItem, e: MouseEvent) => void;
  onDelete: (id: string, e: MouseEvent) => void;
  onUploadClick?: () => void;
  className?: string;
}

export function DocumentList({
  documents,
  selectedDocIds,
  isComparing,
  onSelect,
  onSelectAll,
  onCompare,
  onInspect,
  onDelete,
  onUploadClick,
  className = "",
}: DocumentListProps) {
  const allSelected = documents.length > 0 && selectedDocIds.length === documents.length;

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents uploaded yet"
        description="Upload PDFs, Word docs, text, or scanned images to ask questions and extract grounded citations."
        action={
          onUploadClick
            ? {
                label: "Upload your first document",
                onClick: onUploadClick,
              }
            : undefined
        }
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-black/[0.08] bg-[#fafafa]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSelectAll}
            className="inline-flex items-center gap-2 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-medium text-[#444] shadow-xs hover:bg-[#f2f2f2] transition"
          >
            {allSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-[#171717]" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            <span>{allSelected ? "Deselect all" : "Select all"}</span>
          </button>

          <span className="text-xs text-[#777]">
            {selectedDocIds.length === 0
              ? `${documents.length} available`
              : `${selectedDocIds.length} of ${documents.length} selected`}
          </span>
        </div>

        {selectedDocIds.length >= 2 && (
          <button
            type="button"
            onClick={onCompare}
            disabled={isComparing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#000] disabled:opacity-50 transition"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Compare {selectedDocIds.length} Selected</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            selected={selectedDocIds.includes(doc.id)}
            onSelect={() => onSelect(doc.id)}
            onInspect={(e) => onInspect(doc, e)}
            onDelete={(e) => onDelete(doc.id, e)}
          />
        ))}
      </div>
    </div>
  );
}
