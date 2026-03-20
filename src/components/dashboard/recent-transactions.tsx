"use client";

import { Badge } from "@/components/ui/badge";
import { formatSignedCurrency } from "@/lib/utils";
import { format } from "date-fns";

interface RecentTransaction {
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
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export function RecentTransactions({
  transactions,
}: {
  transactions: RecentTransaction[];
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="p-6 pb-4">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Recent Transactions
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your latest activity
        </p>
      </div>
      <div className="px-6 pb-6">
        <div className="space-y-1">
          {transactions.map(({ transaction: tx, category }, i) => (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-muted/30 group"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center gap-3.5">
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
                  <p className="text-sm font-medium truncate">
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
          {transactions.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No transactions yet. Upload a bank statement to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
