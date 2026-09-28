import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-black/[0.06] bg-[#fafafa] ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-black/[0.08] shadow-sm mb-4">
        <Icon className="h-6 w-6 text-[#666]" />
      </div>
      <h3 className="text-sm font-semibold text-[#171717]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[#777]">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#000] transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
