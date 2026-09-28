import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function Modal({
  title,
  icon,
  children,
  onClose,
  wide = false,
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-black/[0.1] bg-white shadow-2xl ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.08] px-5 py-4 bg-[#fafafa]">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-black/[0.08] text-[#555] shadow-xs">
                {icon}
              </div>
            )}
            <h2 id="modal-title" className="truncate text-sm font-semibold text-[#171717]">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[#888] hover:bg-black/[0.05] hover:text-[#171717] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
