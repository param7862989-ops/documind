import React from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { DocumentStatus } from "@/lib/api";

interface StatusIndicatorProps {
  status: DocumentStatus | string;
  className?: string;
  showText?: boolean;
}

export function StatusIndicator({
  status,
  className = "",
  showText = true,
}: StatusIndicatorProps) {
  switch (status) {
    case "READY":
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 ${className}`}
          role="status"
          aria-label="Document status: Ready"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {showText && <span>Ready</span>}
        </span>
      );

    case "PROCESSING":
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 ${className}`}
          role="status"
          aria-label="Document status: Processing"
        >
          <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
          {showText && <span>Processing</span>}
        </span>
      );

    case "UPLOADING":
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60 ${className}`}
          role="status"
          aria-label="Document status: Uploading"
        >
          <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
          {showText && <span>Uploading</span>}
        </span>
      );

    case "FAILED":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60 ${className}`}
          role="status"
          aria-label="Document status: Failed"
        >
          <AlertCircle className="w-3 h-3 text-rose-600" />
          {showText && <span>Failed</span>}
        </span>
      );
  }
}
