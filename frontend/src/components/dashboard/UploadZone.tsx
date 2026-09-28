import React, { useState, useRef } from "react";
import { Upload, FileUp, AlertCircle } from "lucide-react";

interface UploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  isUploading: boolean;
  disabled?: boolean;
  className?: string;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"];
const MAX_SIZE_MB = 50;

export function UploadZone({
  onFilesSelected,
  isUploading,
  disabled = false,
  className = "",
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateFiles(files: FileList | File[]): File[] {
    const valid: File[] = [];
    setDragError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setDragError(`Unsupported file format '${ext}'.`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setDragError(`File '${file.name}' exceeds ${MAX_SIZE_MB}MB.`);
        continue;
      }
      valid.push(file);
    }
    return valid;
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = validateFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateFiles(e.target.files);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
      e.target.value = "";
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isUploading}
        aria-label="Upload document files"
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && !disabled && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload document zone. Drag and drop files here or click to browse."
        className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? "border-[#171717] bg-[#f5f5f5] scale-[0.99]"
            : "border-black/[0.12] bg-[#fafafa] hover:border-black/[0.25] hover:bg-[#f5f5f5]"
        } ${isUploading || disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-black/[0.08] shadow-sm mb-3 transition group-hover:scale-105">
          {isDragOver ? (
            <FileUp className="h-6 w-6 text-[#171717]" />
          ) : (
            <Upload className="h-6 w-6 text-[#555]" />
          )}
        </div>

        <h3 className="text-sm font-semibold text-[#171717]">
          {isDragOver ? "Drop files to upload" : "Drag and drop documents here"}
        </h3>

        <p className="mt-1 text-xs text-[#777]">
          or <span className="font-medium text-[#171717] underline underline-offset-2">browse files</span> from your computer
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-[#888]">
          <span className="rounded-md bg-white border border-black/[0.06] px-2 py-0.5">PDF</span>
          <span className="rounded-md bg-white border border-black/[0.06] px-2 py-0.5">DOCX</span>
          <span className="rounded-md bg-white border border-black/[0.06] px-2 py-0.5">TXT</span>
          <span className="rounded-md bg-white border border-black/[0.06] px-2 py-0.5">Scanned Images</span>
          <span className="text-[#aaa]">· Max {MAX_SIZE_MB}MB</span>
        </div>

        {dragError && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{dragError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
