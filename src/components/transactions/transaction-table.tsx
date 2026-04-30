"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CategoryPicker } from "@/components/transactions/category-picker";
import { TransactionPreviewDialog } from "@/components/transactions/transaction-preview-dialog";
import { format } from "date-fns";

interface Transaction {
  transaction: {
    id: string;
    date: Date;
    description: string;
    amountCents: number;
    type: "income" | "expense" | "transfer";
    currency: string;
    counterpartyName: string | null;
    categoryId: string | null;
    categorySource: string | null;
    categoryConfidence: number | null;
  };
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export function TransactionTable({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const [pendingChange, setPendingChange] = useState<{
    txId: string;
    txDescription: string;
    categoryId: string;
    categoryName: string;
  } | null>(null);

  function handleCategoryChange(
    txId: string,
    categoryId: string,
    categoryName: string,
    txDescription: string
  ) {
    setPendingChange({ txId, categoryId, categoryName, txDescription });
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[100px_1fr_140px_120px] gap-4 px-5 py-3 border-b border-border/50 bg-muted/20">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Date
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Description
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Category
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Amount
        </span>
      </div>

      {/* Table body */}
      <div className="divide-y divide-border/30">
        {transactions.map(({ transaction: tx, category }) => (
          <div
            key={tx.id}
            className="grid grid-cols-[100px_1fr_140px_120px] gap-4 px-5 py-3.5 items-center transition-colors hover:bg-muted/20 group"
          >
            <span className="font-mono-nums text-[13px] text-muted-foreground tabular-nums">
              {format(new Date(tx.date), "dd.MM.yyyy")}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                {tx.counterpartyName || tx.description}
              </p>
              {tx.counterpartyName && (
                <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                  {tx.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <CategoryPicker
                currentCategory={category}
                categories={categories}
                onSelect={(catId, catName) =>
                  handleCategoryChange(
                    tx.id,
                    catId,
                    catName,
                    tx.counterpartyName || tx.description
                  )
                }
              />
              {tx.categoryConfidence != null &&
                tx.categoryConfidence <= 0.6 &&
                tx.categorySource !== "user" && (
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400"
                    title={`AI confidence: ${Math.round(tx.categoryConfidence * 100)}%`}
                  >
                    ?
                  </span>
                )}
            </div>
            <div className="text-right">
              <CurrencyDisplay
                amountCents={tx.amountCents}
                type={tx.type}
                currency={tx.currency}
              />
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No transactions found. Upload a bank statement to get started.
          </div>
        )}
      </div>

      {/* Preview dialog */}
      {pendingChange && (
        <TransactionPreviewDialog
          userId="local"
          transactionId={pendingChange.txId}
          txDescription={pendingChange.txDescription}
          categoryId={pendingChange.categoryId}
          categoryName={pendingChange.categoryName}
          onClose={() => setPendingChange(null)}
        />
      )}
    </div>
  );
}
