"use client";

import { formatSignedCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function CurrencyDisplay({
  amountCents,
  type,
  currency = "EUR",
  className,
}: {
  amountCents: number;
  type: "income" | "expense" | "transfer";
  currency?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono-nums font-semibold",
        type === "income"
          ? "text-[var(--color-income)]"
          : type === "expense"
            ? "text-[var(--color-expense)]"
            : "text-muted-foreground",
        className
      )}
    >
      {formatSignedCurrency(amountCents, type, currency)}
    </span>
  );
}
