"use client";

import { cn } from "@/lib/utils";
import { getScoreColor, type BudgetScore } from "@/lib/budget-plan/scoring";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";
import { ShieldCheck, ShoppingBag, PiggyBank, Activity } from "lucide-react";

const TIER_ICONS = {
  needs: ShieldCheck,
  wants: ShoppingBag,
  savings: PiggyBank,
} as const;

const SCORE_STYLES = {
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-500",
    label: "On track",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-500",
    label: "Needs attention",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-red-500",
    label: "Over budget",
  },
} as const;

interface BudgetScorecardProps {
  score: BudgetScore;
}

export function BudgetScorecard({ score }: BudgetScorecardProps) {
  const overallColor = getScoreColor(score.overall);
  const styles = SCORE_STYLES[overallColor];

  return (
    <>
      {/* Card 1: Overall Score */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border p-6 text-center",
          styles.bg,
          styles.border
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <Activity className={cn("h-5 w-5", styles.text)} />
          <p className="text-sm font-medium text-muted-foreground">
            Budget Health Score
          </p>
          <div className={cn("text-5xl font-bold tabular-nums", styles.text)}>
            {score.overall}
          </div>
          <p className={cn("text-sm font-medium", styles.text)}>
            {styles.label}
          </p>
        </div>
      </div>

      {/* Card 2: Per-Tier Scores */}
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Score by Tier
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {score.tiers.map((tierScore) => {
            const color = getScoreColor(tierScore.score);
            const tierStyles = SCORE_STYLES[color];
            const Icon = TIER_ICONS[tierScore.tier];

            return (
              <div
                key={tierScore.tier}
                className={cn(
                  "rounded-lg border p-4",
                  tierStyles.bg,
                  tierStyles.border
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("h-4 w-4", tierStyles.text)} />
                  <span className="text-sm font-medium">
                    {TIER_LABELS[tierScore.tier]}
                  </span>
                </div>
                <div className={cn("text-3xl font-bold tabular-nums", tierStyles.text)}>
                  {tierScore.score}
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Target</span>
                    <span>{tierScore.targetAdherence}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trend</span>
                    <span>{tierScore.trend}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Targets</span>
                    <span>{tierScore.customTargetCompliance}/100</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
