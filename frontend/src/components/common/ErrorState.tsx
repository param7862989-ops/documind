import React from "react";
import { AlertCircle, X, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message,
  onDismiss,
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-900 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span className="truncate font-medium">{message}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-100 transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss error"
              className="rounded-lg p-1 text-rose-500 hover:bg-rose-100 hover:text-rose-800 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
