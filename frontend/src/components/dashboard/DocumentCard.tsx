import React, { MouseEvent } from "react";
import { FileText, Eye, Trash2, CheckSquare, Square, Layers } from "lucide-react";
import { DocumentItem } from "@/lib/api";
import { StatusIndicator } from "../common/StatusIndicator";

interface DocumentCardProps {
  document: DocumentItem;
  selected: boolean;
  onSelect: () => void;
  onInspect: (e: MouseEvent) => void;
  onDelete: (e: MouseEvent) => void;
}

export function DocumentCard({
  document,
  selected,
  onSelect,
  onInspect,
  onDelete,
}: DocumentCardProps) {
  const formattedSize =
    document.file_size > 1024 * 1024
      ? `${(document.file_size / (1024 * 1024)).toFixed(2)} MB`
      : `${(document.file_size / 1024).toFixed(1)} KB`;

  const formattedDate = new Date(document.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      onClick={onSelect}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group flex items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-150 cursor-pointer ${
        selected
          ? "border-[#171717] bg-[#f9f9f9] shadow-xs"
          : "border-black/[0.08] bg-white hover:border-black/[0.16] hover:bg-[#fafafa]"
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          aria-label={selected ? `Deselect ${document.original_filename}` : `Select ${document.original_filename}`}
          className="shrink-0 text-[#888] hover:text-[#171717] focus:outline-hidden"
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-[#171717]" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f5] border border-black/[0.06] text-[#444]">
          <FileText className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-[#171717]" title={document.original_filename}>
            {document.original_filename}
          </h4>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#777]">
            <span className="uppercase font-medium text-[#555]">{document.file_type}</span>
            <span>·</span>
            <span>{formattedSize}</span>
            {document.page_count > 0 && (
              <>
                <span>·</span>
                <span>{document.page_count} {document.page_count === 1 ? "page" : "pages"}</span>
              </>
            )}
            {document.chunk_count > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {document.chunk_count} chunks
                </span>
              </>
            )}
            <span>·</span>
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <StatusIndicator status={document.status} />

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
          <button
            type="button"
            onClick={onInspect}
            title="Inspect document & chunks"
            aria-label={`Inspect ${document.original_filename}`}
            className="rounded-lg p-2 text-[#777] hover:bg-[#eee] hover:text-[#171717] transition"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            title="Delete document"
            aria-label={`Delete ${document.original_filename}`}
            className="rounded-lg p-2 text-[#777] hover:bg-rose-50 hover:text-rose-600 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
