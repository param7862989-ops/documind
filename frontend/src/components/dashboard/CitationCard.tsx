import React from "react";
import { FileText } from "lucide-react";
import { Citation } from "@/lib/api";

interface CitationCardProps {
  citation: Citation;
  onClick: () => void;
  className?: string;
}

export function CitationCard({
  citation,
  onClick,
  className = "",
}: CitationCardProps) {
  const pageLabel =
    citation.page_number !== undefined && citation.page_number !== null
      ? `p. ${citation.page_number}`
      : citation.section_title
      ? citation.section_title.length > 20
        ? citation.section_title.slice(0, 18) + "..."
        : citation.section_title
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View citation for ${citation.document_title}${pageLabel ? `, ${pageLabel}` : ""}`}
      className={`inline-flex max-w-[260px] items-center gap-2 rounded-lg border border-black/[0.1] bg-[#f8f8f8] px-2.5 py-1.5 text-left text-[11px] text-[#444] shadow-xs hover:bg-[#efefef] hover:border-black/[0.18] transition ${className}`}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-[#777]" />

      <span className="truncate font-medium">{citation.document_title}</span>

      {pageLabel && (
        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] text-[#666] border border-black/[0.06]">
          {pageLabel}
        </span>
      )}
    </button>
  );
}
