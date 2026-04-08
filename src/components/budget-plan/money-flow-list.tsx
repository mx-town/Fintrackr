"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";

export interface MoneyFlowCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  amountCents: number;
  pctOfIncome: number;
  counterparties: { name: string; amountCents: number }[];
}

export interface MoneyFlowTier {
  tier: "needs" | "wants" | "savings";
  amountCents: number;
  pctOfIncome: number;
  categories: MoneyFlowCategory[];
}

export interface MoneyFlowData {
  incomeCents: number;
  tiers: MoneyFlowTier[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function MoneyFlowList({ data }: { data: MoneyFlowData }) {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {/* Income row */}
      <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-200 dark:border-emerald-800">
        <span className="font-medium">Income</span>
        <span className="font-semibold tabular-nums">
          {formatCurrency(data.incomeCents)}
        </span>
      </div>

      {/* Tier rows */}
      {data.tiers.map((tier) => (
        <div key={tier.tier}>
          <button
            onClick={() =>
              setExpandedTier(expandedTier === tier.tier ? null : tier.tier)
            }
            className={cn(
              "flex w-full items-center justify-between rounded-lg p-3 border transition-colors",
              "hover:bg-muted/50",
              expandedTier === tier.tier && "bg-muted/30"
            )}
          >
            <div className="flex items-center gap-2">
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedTier === tier.tier && "rotate-90"
                )}
              />
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: TIER_COLORS[tier.tier] }}
              />
              <span className="font-medium">{TIER_LABELS[tier.tier]}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {tier.pctOfIncome.toFixed(1)}%
              </span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(tier.amountCents)}
              </span>
            </div>
          </button>

          {/* Expanded categories */}
          {expandedTier === tier.tier && (
            <div className="ml-6 space-y-0.5 py-1">
              {tier.categories.map((cat) => (
                <div key={cat.categoryId}>
                  <button
                    onClick={() =>
                      setExpandedCat(
                        expandedCat === cat.categoryId ? null : cat.categoryId
                      )
                    }
                    className="flex w-full items-center justify-between rounded-md p-2 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {cat.counterparties.length > 0 && (
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform",
                            expandedCat === cat.categoryId && "rotate-90"
                          )}
                        />
                      )}
                      <span className="text-sm">
                        {cat.categoryIcon && `${cat.categoryIcon} `}
                        {cat.categoryName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {cat.pctOfIncome.toFixed(1)}%
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(cat.amountCents)}
                      </span>
                    </div>
                  </button>

                  {/* Expanded counterparties */}
                  {expandedCat === cat.categoryId &&
                    cat.counterparties.length > 0 && (
                      <div className="ml-8 space-y-0.5 py-1">
                        {cat.counterparties.map((cp) => (
                          <div
                            key={cp.name}
                            className="flex items-center justify-between rounded-md p-1.5 text-xs text-muted-foreground"
                          >
                            <span>{cp.name}</span>
                            <span className="tabular-nums">
                              {formatCurrency(cp.amountCents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
