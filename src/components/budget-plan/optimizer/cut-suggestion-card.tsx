"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import type { CutSuggestion } from "@/lib/budget-plan/suggestions";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

interface CutSuggestionCardProps {
  suggestion: CutSuggestion;
}

export function CutSuggestionCard({ suggestion }: CutSuggestionCardProps) {
  const {
    categoryName,
    categoryIcon,
    tier,
    currentCents,
    baselineCents,
    savingsCents,
    pctChange,
    consecutiveMonthsRising,
    exceedsTarget,
    targetCents,
  } = suggestion;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {categoryIcon && <span className="text-lg">{categoryIcon}</span>}
          <div>
            <p className="font-medium">{categoryName}</p>
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: TIER_COLORS[tier] }}
              />
              <span className="text-xs text-muted-foreground">
                {TIER_LABELS[tier]}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums text-lg">
            {formatCurrency(currentCents)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            avg {formatCurrency(baselineCents)}
          </p>
        </div>
      </div>

      {/* Trend and savings info */}
      <div className="flex flex-wrap gap-2">
        {pctChange > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400">
            <TrendingUp className="h-3 w-3" />
            {pctChange}%
          </div>
        )}

        {consecutiveMonthsRising > 0 && (
          <div className="rounded-full bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 text-xs font-medium text-orange-700 dark:text-orange-400">
            Rising {consecutiveMonthsRising} month{consecutiveMonthsRising > 1 ? "s" : ""}
          </div>
        )}

        {exceedsTarget && targetCents !== null && (
          <div className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Over target ({formatCurrency(targetCents)})
          </div>
        )}
      </div>

      {/* Savings potential */}
      <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 p-2.5">
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Potential savings:{" "}
          <span className="font-semibold">{formatCurrency(savingsCents)}/mo</span>
          {" "}
          <span className="text-emerald-600 dark:text-emerald-500">
            ({formatCurrency(savingsCents * 12)}/yr)
          </span>
        </p>
      </div>
    </div>
  );
}
