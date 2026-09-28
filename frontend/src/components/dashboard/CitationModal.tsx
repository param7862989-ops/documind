import React from "react";
import { BookOpen, FileText, Quote } from "lucide-react";
import { Citation } from "@/lib/api";
import { Modal } from "../common/Modal";

interface CitationModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export function CitationModal({ citation, onClose }: CitationModalProps) {
  if (!citation) return null;

  return (
    <Modal
      title="Verified Source Citation"
      icon={<BookOpen className="h-4 w-4" />}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Source metadata card */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-black/[0.08] bg-[#fafafa]">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-black/[0.06] text-[#444]">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-[#171717]">
              {citation.document_title}
            </h4>
            <div className="text-[11px] text-[#777] mt-0.5">
              {citation.page_number !== undefined && citation.page_number !== null
                ? `Page ${citation.page_number}`
                : "General Section"}
              {citation.section_title ? ` · Section: ${citation.section_title}` : ""}
              {citation.score !== undefined ? ` · Match Confidence: ${(citation.score * 100).toFixed(0)}%` : ""}
            </div>
          </div>
        </div>

        {/* Verbatim excerpt */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#777] mb-2 flex items-center gap-1.5">
            <Quote className="w-3.5 h-3.5" />
            Verbatim Source Excerpt
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-[#f9f9f9] p-4">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#2f2f2f] font-mono">
              “{citation.excerpt}”
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
