import React from "react";
import { FileText, RefreshCw, Layers } from "lucide-react";
import { DocumentItem, DocumentChunk } from "@/lib/api";
import { Modal } from "../common/Modal";
import { StatusIndicator } from "../common/StatusIndicator";

interface DocumentViewerProps {
  document: DocumentItem | null;
  chunks: DocumentChunk[];
  loading: boolean;
  onClose: () => void;
}

export function DocumentViewer({
  document,
  chunks,
  loading,
  onClose,
}: DocumentViewerProps) {
  if (!document) return null;

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
    <Modal
      title={document.original_filename}
      icon={<FileText className="h-4 w-4" />}
      onClose={onClose}
      wide
    >
      <div className="space-y-6">
        {/* Metadata summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-black/[0.08] bg-[#fafafa]">
          <div>
            <div className="text-[11px] font-medium text-[#777] uppercase tracking-wider">Format</div>
            <div className="mt-1 text-xs font-semibold text-[#171717] uppercase">{document.file_type}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#777] uppercase tracking-wider">Size & Date</div>
            <div className="mt-1 text-xs font-semibold text-[#171717]">{formattedSize} · {formattedDate}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#777] uppercase tracking-wider">Pages / Chunks</div>
            <div className="mt-1 text-xs font-semibold text-[#171717]">
              {document.page_count || 0} pages · {document.chunk_count || chunks.length} chunks
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#777] uppercase tracking-wider">Status</div>
            <div className="mt-1">
              <StatusIndicator status={document.status} />
            </div>
          </div>
        </div>

        {/* Chunks Explorer */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#777] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Indexed Chunks & Semantic Text ({chunks.length})
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-[#777]">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-[#171717]" />
              Loading extracted chunks...
            </div>
          ) : chunks.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#888] bg-[#fbfbfb] rounded-xl border border-black/[0.06]">
              {document.status === "PROCESSING"
                ? "Document is currently processing. Chunks will appear once indexing is complete."
                : "No indexed chunks found for this document."}
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-xl border border-black/[0.08] bg-[#f9f9f9] p-4 text-left transition hover:border-black/[0.14]"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-black/[0.06] pb-2 text-[11px] text-[#777]">
                    <span className="font-semibold text-[#333]">
                      Chunk #{chunk.chunk_index + 1}
                      {chunk.section_title ? ` · ${chunk.section_title}` : ""}
                    </span>
                    <span className="rounded-md bg-white border border-black/[0.06] px-2 py-0.5 text-[10px]">
                      {chunk.page_number !== undefined && chunk.page_number !== null
                        ? `Page ${chunk.page_number}`
                        : "Section"}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#3f3f3f] font-mono">
                    {chunk.text_content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
