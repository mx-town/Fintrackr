"use client";

import { cn } from "@/lib/utils";
import { getScoreColor, type BudgetScore } from "@/lib/budget-plan/scoring";
import { TIER_LABELS } from "@/lib/budget-plan/tiers";
import { ArrowRight } from "lucide-react";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

const COLOR_MAP = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
} as const;

interface ScoreComparisonProps {
  currentScore: BudgetScore;
  simulatedScore: BudgetScore | null;
  totalSavingsCents: number;
}

export function ScoreComparison({
  currentScore,
  simulatedScore,
  totalSavingsCents,
}: ScoreComparisonProps) {
  const simScore = simulatedScore ?? currentScore;
  const scoreDiff = simScore.overall - currentScore.overall;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Impact Preview</h3>

      {/* Overall score comparison */}
      <div className="rounded-lg border p-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground">Overall Score</p>
        <div className="flex items-center justify-center gap-3">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              COLOR_MAP[getScoreColor(currentScore.overall)]
            )}
          >
            {currentScore.overall}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              COLOR_MAP[getScoreColor(simScore.overall)]
            )}
          >
            {simScore.overall}
          </span>
          {scoreDiff !== 0 && (
            <span
              className={cn(
                "text-sm font-medium",
                scoreDiff > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {scoreDiff > 0 ? "+" : ""}
              {scoreDiff}
            </span>
          )}
        </div>
      </div>

      {/* Per-tier scores */}
      <div className="space-y-2">
        {simScore.tiers.map((tier) => {
          const currentTier = currentScore.tiers.find(
            (t) => t.tier === tier.tier
          );
          const diff = tier.score - (currentTier?.score ?? 0);

          return (
            <div
              key={tier.tier}
              className="flex items-center justify-between text-sm"
            >
              <span>{TIER_LABELS[tier.tier]}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-muted-foreground">
                  {currentTier?.score ?? 0}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    COLOR_MAP[getScoreColor(tier.score)]
                  )}
                >
                  {tier.score}
                </span>
                {diff !== 0 && (
                  <span
                    className={cn(
                      "text-xs",
                      diff > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Savings summary */}
      {totalSavingsCents > 0 && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 space-y-1 text-center">
          <p className="text-sm text-muted-foreground">Monthly savings</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatCurrency(totalSavingsCents)}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">
            {formatCurrency(totalSavingsCents * 12)}/year
          </p>
        </div>
      )}
    </div>
  );
}
