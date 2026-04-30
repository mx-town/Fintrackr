"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  getMatchingTransactions,
  applyCategoryToSelected,
} from "@/actions/transactions";
import { formatSignedCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface MatchingTransaction {
  transaction: {
    id: string;
    date: Date;
    description: string;
    amountCents: number;
    type: "income" | "expense" | "transfer";
    currency: string;
    counterpartyName: string | null;
  };
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export function TransactionPreviewDialog({
  userId,
  transactionId,
  txDescription,
  categoryId,
  categoryName,
  onClose,
  onDone,
}: {
  userId: string;
  transactionId: string;
  txDescription: string;
  categoryId: string;
  categoryName: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [matches, setMatches] = useState<MatchingTransaction[]>([]);
  const [matchedBy, setMatchedBy] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getMatchingTransactions(userId, transactionId).then((result) => {
      setMatches(result.matches as MatchingTransaction[]);
      setMatchedBy(result.matchedBy);
      // Select all by default
      setSelected(
        new Set(result.matches.map((m) => m.transaction.id))
      );
      setLoading(false);
    });
  }, [userId, transactionId]);

  const allSelected = matches.length > 0 && selected.size === matches.length;
  const someSelected = selected.size > 0 && selected.size < matches.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(matches.map((m) => m.transaction.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleJustThisOne() {
    startTransition(async () => {
      await applyCategoryToSelected(
        userId,
        transactionId,
        [],
        categoryId,
        false
      );
      toast.success("Category updated");
      onClose();
      onDone?.();
      router.refresh();
    });
  }

  function handleApply() {
    startTransition(async () => {
      const selectedIds = Array.from(selected);
      const { updatedCount } = await applyCategoryToSelected(
        userId,
        transactionId,
        selectedIds,
        categoryId,
        true
      );
      toast.success(
        `Categorized ${updatedCount} transaction${updatedCount !== 1 ? "s" : ""}`
      );
      onClose();
      onDone?.();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply category</DialogTitle>
          <DialogDescription>
            Assign <strong>{categoryName}</strong> to{" "}
            <strong>{txDescription}</strong>
            {!loading && matches.length > 0 && (
              <>
                . Found{" "}
                <strong>
                  {matches.length} similar transaction
                  {matches.length !== 1 ? "s" : ""}
                </strong>{" "}
                (matched by {matchedBy}).
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {loading && (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-4 rounded-[4px]" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        )}

        {/* No matches */}
        {!loading && matches.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No other matching transactions found.
          </p>
        )}

        {/* Match list */}
        {!loading && matches.length > 0 && (
          <>
            {/* Select all / counter */}
            <div className="flex items-center justify-between border-b border-border/30 pb-2">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                />
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              <span className="text-xs text-muted-foreground font-mono-nums">
                {selected.size} of {matches.length} selected
              </span>
            </div>

            <ScrollArea className="max-h-[360px] -mx-4 px-4">
              <div className="space-y-0.5">
                {matches.map(({ transaction: tx, category }) => (
                  <label
                    key={tx.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selected.has(tx.id)}
                      onCheckedChange={() => toggleOne(tx.id)}
                    />
                    <span className="text-[11px] text-muted-foreground font-mono-nums w-[70px] shrink-0">
                      {format(new Date(tx.date), "dd.MM.yy")}
                    </span>
                    <span className="text-sm truncate flex-1 min-w-0">
                      {tx.counterpartyName || tx.description}
                    </span>
                    {category && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] shrink-0 rounded-md border-0"
                        style={{
                          backgroundColor: category.color
                            ? `${category.color}18`
                            : undefined,
                          color: category.color ?? undefined,
                        }}
                      >
                        {category.icon} {category.name}
                      </Badge>
                    )}
                    <span className="text-xs font-mono-nums shrink-0 w-[80px] text-right">
                      {formatSignedCurrency(tx.amountCents, tx.type, tx.currency)}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleJustThisOne} disabled={isPending}>
            Just this one
          </Button>
          {matches.length > 0 && (
            <Button onClick={handleApply} disabled={isPending || selected.size === 0}>
              Apply to {selected.size + 1}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
