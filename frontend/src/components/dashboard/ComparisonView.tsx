import React from "react";
import { Layers, FileText } from "lucide-react";
import { Citation } from "@/lib/api";
import { Modal } from "../common/Modal";
import { CitationCard } from "./CitationCard";

interface ComparisonViewProps {
  open: boolean;
  answer: string;
  citations: Citation[];
  onClose: () => void;
  onCitationClick: (citation: Citation) => void;
}

export function ComparisonView({
  open,
  answer,
  citations,
  onClose,
  onCitationClick,
}: ComparisonViewProps) {
  if (!open) return null;

  // Simple Markdown Table parser if tabular data is returned
  const hasTable = answer.includes("|") && answer.includes("---");

  function renderFormattedContent(text: string) {
    if (!hasTable) {
      return (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f2f2f] font-sans">
          {text}
        </div>
      );
    }

    const lines = text.split("\n");
    const tableLines: string[] = [];
    const nonTableLines: string[] = [];
    let inTable = false;

    for (const line of lines) {
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        inTable = true;
        tableLines.push(line.trim());
      } else {
        if (inTable && line.trim() === "") {
          inTable = false;
        }
        if (!inTable) {
          nonTableLines.push(line);
        }
      }
    }

    // Parse table rows
    const headerRow = tableLines[0]
      ? tableLines[0].split("|").filter((c) => c.trim().length > 0).map((c) => c.trim())
      : [];
    const bodyRows = tableLines.slice(2).map((row) =>
      row.split("|").filter((c) => c.trim().length > 0).map((c) => c.trim())
    );

    return (
      <div className="space-y-6">
        {nonTableLines.length > 0 && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f2f2f]">
            {nonTableLines.join("\n").trim()}
          </div>
        )}

        {headerRow.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-black/[0.1] shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#fafafa] border-b border-black/[0.08] text-[#555] uppercase tracking-wider font-semibold">
                <tr>
                  {headerRow.map((head, i) => (
                    <th key={i} className="p-3.5 border-r last:border-r-0 border-black/[0.06]">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] bg-white">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#fafafa] transition">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3.5 border-r last:border-r-0 border-black/[0.06] text-[#333] leading-relaxed">
                        {cell.startsWith("**") && cell.endsWith("**") ? (
                          <strong className="font-semibold text-[#171717]">{cell.slice(2, -2)}</strong>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <Modal
      title="Multi-Document Comparative Analysis"
      icon={<Layers className="h-4 w-4" />}
      onClose={onClose}
      wide
    >
      <div className="space-y-6">
        {renderFormattedContent(answer)}

        {citations && citations.length > 0 && (
          <div className="border-t border-black/[0.08] pt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#777] mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Independent Document Citations ({citations.length})
            </h4>

            <div className="flex flex-wrap gap-2">
              {citations.map((citation, idx) => (
                <CitationCard
                  key={idx}
                  citation={citation}
                  onClick={() => onCitationClick(citation)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
