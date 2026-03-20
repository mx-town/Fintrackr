"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [".json", ".csv", ".pdf", ".xml"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
}

export function Dropzone({ onFileSelect, isProcessing }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    setError(null);
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_TYPES.join(", ")}`);
      return false;
    }
    if (file.size > MAX_SIZE) {
      setError("File too large. Maximum size: 10MB");
      return false;
    }
    return true;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) onFileSelect(file);
    },
    [onFileSelect, validateFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validateFile(file)) onFileSelect(file);
    },
    [onFileSelect, validateFile]
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border/50 hover:border-border hover:bg-muted/20",
        isProcessing && "opacity-50 pointer-events-none"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent pointer-events-none" />

      <label className="relative flex flex-col items-center justify-center py-16 px-8 cursor-pointer">
        <div
          className={cn(
            "relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300",
            isDragging
              ? "bg-primary/15 scale-110"
              : "bg-muted/40"
          )}
        >
          {isProcessing ? (
            <FileText className="h-7 w-7 text-primary animate-pulse" />
          ) : (
            <Upload
              className={cn(
                "h-7 w-7 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )}
            />
          )}
          {isDragging && (
            <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-primary animate-pulse" />
          )}
        </div>

        <div className="text-center space-y-2">
          <p className="font-heading text-base font-semibold">
            {isProcessing
              ? "Processing your statement..."
              : "Drop your bank statement here"}
          </p>
          <p className="text-sm text-muted-foreground">
            or <span className="text-primary font-medium">browse files</span>
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {["JSON", "CSV", "PDF", "XML"].map((type) => (
              <span
                key={type}
                className="inline-flex items-center rounded-lg bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {type}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60 pt-1">
            Supports: George JSON (recommended), George CSV, Raiffeisen, BAWAG &middot; Max 10MB
          </p>
        </div>
        <input
          type="file"
          accept=".json,.csv,.pdf,.xml"
          className="hidden"
          onChange={handleChange}
          disabled={isProcessing}
        />
      </label>

      {error && (
        <div className="mx-6 mb-6 flex items-center gap-2 rounded-xl bg-[var(--color-expense)]/10 px-4 py-3 text-sm text-[var(--color-expense)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
