"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface UploadResult {
  success: boolean;
  uploadId?: string;
  transactionCount?: number;
  duplicateCount?: number;
  bankDetected?: string;
  warnings?: string[];
  errors?: string[];
  processingTimeMs?: number;
}

export function ProcessingStatus({ result }: { result: UploadResult | null }) {
  if (!result) return null;

  return (
    <div
      className={`animate-fade-up rounded-2xl border p-6 ${
        result.success
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-rose-500/20 bg-rose-500/5"
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        {result.success ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
            <CheckCircle className="h-5 w-5 text-[var(--color-income)]" />
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15">
            <XCircle className="h-5 w-5 text-[var(--color-expense)]" />
          </div>
        )}
        <div>
          <h3 className="font-heading text-sm font-semibold">
            {result.success ? "Upload Successful" : "Upload Failed"}
          </h3>
          {result.processingTimeMs && (
            <p className="text-xs text-muted-foreground">
              Processed in {(result.processingTimeMs / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      </div>

      {result.success && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-card/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Transactions
            </p>
            <p className="text-xl font-heading font-bold font-mono-nums mt-1">
              {result.transactionCount}
            </p>
          </div>
          <div className="rounded-xl bg-card/50 p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Duplicates
            </p>
            <p className="text-xl font-heading font-bold font-mono-nums mt-1">
              {result.duplicateCount}
            </p>
          </div>
          {result.bankDetected && (
            <div className="rounded-xl bg-card/50 p-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Bank
              </p>
              <Badge variant="secondary" className="mt-1.5">
                {result.bankDetected}
              </Badge>
            </div>
          )}
        </div>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-[var(--color-warning)]"
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {result.errors && result.errors.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {result.errors.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-[var(--color-expense)]"
            >
              <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {e}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
