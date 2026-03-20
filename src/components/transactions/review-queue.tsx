"use client";

import { useState, useTransition } from "react";
import { updateTransactionCategory } from "@/actions/transactions";
import { formatSignedCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amountCents: number;
  type: "income" | "expense" | "transfer";
  currency: string;
  counterpartyName: string | null;
  categoryConfidence: number | null;
  categorySource: string | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface ReviewItem {
  transaction: Transaction;
  category: Category | null;
}

export function ReviewQueue({
  transactions,
  categories,
  userId = "local",
}: {
  transactions: ReviewItem[];
  categories: Category[];
  userId?: string;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visible = transactions.filter(
    (t) => !dismissed.has(t.transaction.id)
  );

  function handleCategorySelect(txId: string, categoryId: string) {
    setDismissed((prev) => new Set(prev).add(txId));
    startTransition(async () => {
      await updateTransactionCategory(userId, txId, categoryId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {visible.map(({ transaction: tx, category }) => (
        <ReviewRow
          key={tx.id}
          tx={tx}
          currentCategory={category}
          categories={categories}
          onSelect={(catId) => handleCategorySelect(tx.id, catId)}
        />
      ))}
      {visible.length === 0 && transactions.length > 0 && (
        <div className="flex flex-col items-center py-12 text-center animate-fade-up">
          <span className="text-3xl">🎉</span>
          <p className="mt-2 text-sm font-medium text-foreground">
            All reviewed!
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Refreshing page...
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewRow({
  tx,
  currentCategory,
  categories,
  onSelect,
}: {
  tx: ReviewItem["transaction"];
  currentCategory: Category | null;
  categories: Category[];
  onSelect: (categoryId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const confidence = tx.categoryConfidence ?? 0;
  const confidencePct = Math.round(confidence * 100);

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 transition-all hover:border-border/80">
      {/* Transaction info row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Confidence indicator */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold font-mono-nums"
            style={{
              backgroundColor:
                confidence <= 0.3
                  ? "oklch(0.65 0.2 25 / 15%)"
                  : "oklch(0.7 0.16 55 / 15%)",
              color:
                confidence <= 0.3
                  ? "oklch(0.65 0.2 25)"
                  : "oklch(0.7 0.16 55)",
            }}
          >
            {confidencePct}%
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
              <span className="text-[11px] text-muted-foreground truncate">
                {tx.description}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Current AI guess */}
          {currentCategory && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs transition-colors hover:bg-amber-500/20"
            >
              <span className="text-amber-400">?</span>
              <span>{currentCategory.icon}</span>
              <span className="text-muted-foreground">
                {currentCategory.name}
              </span>
            </button>
          )}

          <span
            className={`font-mono-nums text-sm font-semibold ${
              tx.type === "income"
                ? "text-[var(--color-income)]"
                : "text-[var(--color-expense)]"
            }`}
          >
            {formatSignedCurrency(tx.amountCents, tx.type, tx.currency)}
          </span>
        </div>
      </div>

      {/* Category picker (expanded) */}
      {isOpen && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/30 pt-3 animate-fade-up">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                onSelect(cat.id);
                setIsOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-1.5 text-xs transition-all hover:border-primary/50 hover:bg-primary/10"
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
