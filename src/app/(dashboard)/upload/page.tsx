"use client";

import { useState } from "react";
import { Dropzone } from "@/components/upload/dropzone";
import { ProcessingStatus } from "@/components/upload/processing-status";
import { Shield } from "lucide-react";

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

export default function UploadPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        errors: [(error as Error).message],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Upload Bank Statement
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV or PDF bank statement from George (Erste), Raiffeisen, or
          BAWAG.
        </p>
      </div>

      <Dropzone onFileSelect={handleFileSelect} isProcessing={isProcessing} />

      <ProcessingStatus result={result} />

      {/* Privacy notice */}
      <div className="flex items-start gap-3 rounded-xl bg-muted/20 border border-border/30 p-4">
        <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground/80">
            Your data stays private
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Statements are processed locally and stored in an embedded database on your machine. Nothing is sent to external servers.
          </p>
        </div>
      </div>
    </div>
  );
}
