import React from "react";
import { RefreshCw, FileText, CheckCircle2, AlertCircle } from "lucide-react";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface UploadProgressProps {
  items: UploadItem[];
  className?: string;
}

export function UploadProgress({ items, className = "" }: UploadProgressProps) {
  if (items.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-xl border border-black/[0.08] bg-white p-3 shadow-xs"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f5] text-[#555]">
            <FileText className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="truncate text-[#171717]">{item.file.name}</span>
              <span className="text-[11px] text-[#777]">
                {(item.file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>

            {item.status === "uploading" && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
                <div
                  className="h-full bg-[#171717] transition-all duration-200"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}

            {item.status === "error" && (
              <p className="mt-1 text-[11px] text-rose-600 truncate">
                {item.error || "Upload failed."}
              </p>
            )}
          </div>

          <div className="shrink-0">
            {item.status === "uploading" && (
              <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
            )}
            {item.status === "success" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            {item.status === "error" && (
              <AlertCircle className="h-4 w-4 text-rose-600" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
