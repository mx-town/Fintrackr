"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { recategorizeTransactions } from "@/actions/categories";

export function RecategorizeButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const { updated, total } = await recategorizeTransactions(userId);
      if (total === 0) {
        toast.info("No uncategorized transactions found");
      } else {
        toast.success(`Re-categorized ${updated} of ${total} transactions`);
      }
    } catch (err) {
      toast.error("Re-categorization failed. Check console for details.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Categorizing..." : "Re-categorize"}
    </Button>
  );
}
