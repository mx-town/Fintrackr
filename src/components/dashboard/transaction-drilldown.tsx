"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getTransactions } from "@/actions/transactions";
import { formatSignedCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export interface DrilldownFilter {
  title: string;
  subtitle: string;
  type?: "income" | "expense";
  categoryId?: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
}

type TxRow = Awaited<ReturnType<typeof getTransactions>>[number];

interface TransactionDrilldownProps {
  filter: DrilldownFilter | null;
  onClose: () => void;
  userId: string;
}

export function TransactionDrilldown({
  filter,
  onClose,
  userId,
}: TransactionDrilldownProps) {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!filter) {
      setRows([]);
      return;
    }

    startTransition(async () => {
      const results = await getTransactions(userId, {
        startDate: new Date(filter.startDate),
        endDate: new Date(filter.endDate),
        type: filter.type,
        categoryId: filter.categoryId,
        limit: 50,
      });
      setRows(results);
    });
  }, [filter, userId]);

  // Build link to /transactions with filters
  const txLink = filter
    ? `/transactions?from=${filter.startDate.slice(0, 10)}&to=${filter.endDate.slice(0, 10)}${filter.type ? `&type=${filter.type}` : ""}${filter.categoryId ? `&category=${filter.categoryId}` : ""}`
    : "/transactions";

  return (
    <Sheet open={!!filter} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{filter?.title ?? "Transactions"}</SheetTitle>
          <SheetDescription>{filter?.subtitle ?? ""}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 -mx-0">
          {isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No transactions found for this filter.
            </p>
          ) : (
            <div className="space-y-0.5">
              {rows.map(({ transaction: tx, category }) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30 group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: category?.color
                          ? `${category.color}15`
                          : "oklch(0.2 0.008 270)",
                      }}
                    >
                      {category?.icon ?? "\u{1F4E6}"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[180px]">
                        {tx.counterpartyName || tx.description}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground font-mono-nums">
                          {format(new Date(tx.date), "dd.MM.yyyy")}
                        </span>
                        <span className="text-muted-foreground/30">&middot;</span>
                        <span className="text-[11px] text-muted-foreground">
                          {category?.name ?? "Uncategorized"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-mono-nums text-sm font-semibold shrink-0 ${
                      tx.type === "income"
                        ? "text-[var(--color-income)]"
                        : "text-[var(--color-expense)]"
                    }`}
                  >
                    {formatSignedCurrency(tx.amountCents, tx.type, tx.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border/30">
          <Link
            href={txLink}
            className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            onClick={onClose}
          >
            View all in Transactions
            <ArrowRight className="h-4 w-4" />
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
