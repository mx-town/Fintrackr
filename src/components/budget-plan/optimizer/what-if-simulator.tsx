"use client";

import { useState, useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, Save } from "lucide-react";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";
import { type BudgetScore } from "@/lib/budget-plan/scoring";
import { simulateBudget } from "@/actions/category-targets";
import { saveCategoryTargets } from "@/actions/category-targets";
import { ScoreComparison } from "./score-comparison";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { toast } from "sonner";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export interface SimulatorCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  tier: "needs" | "wants" | "savings";
  actualCents: number;
  targetCents: number | null;
}

interface WhatIfSimulatorProps {
  userId: string;
  incomeCents: number;
  categories: SimulatorCategory[];
  currentScore: BudgetScore;
}

export function WhatIfSimulator({
  userId,
  incomeCents,
  categories,
  currentScore,
}: WhatIfSimulatorProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaving] = useTransition();

  // Track adjusted amounts (cents)
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const cat of categories) {
      initial[cat.categoryId] = cat.actualCents;
    }
    return initial;
  });

  const [simulatedScore, setSimulatedScore] = useState<BudgetScore | null>(
    null
  );

  const totalActual = categories.reduce((s, c) => s + c.actualCents, 0);
  const totalAdjusted = Object.values(adjustments).reduce((s, v) => s + v, 0);
  const totalSavingsCents = Math.max(0, totalActual - totalAdjusted);

  const handleAdjust = useCallback(
    (categoryId: string, cents: number) => {
      const newAdj = { ...adjustments, [categoryId]: Math.max(0, cents) };
      setAdjustments(newAdj);

      // Debounced simulation via server action
      startTransition(async () => {
        const adjArray = categories.map((c) => ({
          categoryId: c.categoryId,
          amountCents: newAdj[c.categoryId] ?? c.actualCents,
          tier: c.tier,
          targetCents: c.targetCents,
        }));

        const result = await simulateBudget(incomeCents, adjArray);
        setSimulatedScore(result);
      });
    },
    [adjustments, categories, incomeCents]
  );

  const handleReset = () => {
    const initial: Record<string, number> = {};
    for (const cat of categories) {
      initial[cat.categoryId] = cat.actualCents;
    }
    setAdjustments(initial);
    setSimulatedScore(null);
  };

  const handleSaveTargets = () => {
    startSaving(async () => {
      const targets = categories
        .filter((c) => adjustments[c.categoryId] !== c.actualCents)
        .map((c) => ({
          categoryId: c.categoryId,
          amountCents: adjustments[c.categoryId],
        }));

      if (targets.length === 0) {
        toast.info("No changes to save");
        return;
      }

      const result = await saveCategoryTargets(userId, targets);
      if (result.success) {
        toast.success(`Saved ${targets.length} budget target${targets.length > 1 ? "s" : ""}`);
      } else {
        toast.error(result.error ?? "Failed to save targets");
      }
    });
  };

  // Group categories by tier
  const grouped = new Map<"needs" | "wants" | "savings", SimulatorCategory[]>();
  for (const tier of ["needs", "wants", "savings"] as const) {
    grouped.set(
      tier,
      categories
        .filter((c) => c.tier === tier)
        .sort((a, b) => b.actualCents - a.actualCents)
    );
  }

  const comparisonPanel = (
    <ScoreComparison
      currentScore={currentScore}
      simulatedScore={simulatedScore}
      totalSavingsCents={totalSavingsCents}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">What-If Simulator</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSaveTargets}
            disabled={isSaving || totalSavingsCents === 0}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Apply as targets
          </Button>
        </div>
      </div>

      <div className={cn("gap-6", isMobile ? "space-y-6" : "flex")}>
        {/* Category adjustments */}
        <div className={cn("space-y-6", isMobile ? "w-full" : "flex-1")}>
          {(["needs", "wants", "savings"] as const).map((tier) => {
            const cats = grouped.get(tier) ?? [];
            if (cats.length === 0) return null;

            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[tier] }}
                  />
                  <h3 className="text-sm font-semibold">
                    {TIER_LABELS[tier]}
                  </h3>
                </div>

                <div className="space-y-3">
                  {cats.map((cat) => {
                    const adjusted = adjustments[cat.categoryId] ?? cat.actualCents;
                    const maxVal = Math.max(cat.actualCents * 2, 1);
                    const isChanged = adjusted !== cat.actualCents;

                    return (
                      <div
                        key={cat.categoryId}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          isChanged && "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/10"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            {cat.categoryIcon && `${cat.categoryIcon} `}
                            {cat.categoryName}
                          </span>
                          <div className="flex items-center gap-2">
                            {isChanged && (
                              <span className="text-xs text-muted-foreground line-through tabular-nums">
                                {formatCurrency(cat.actualCents)}
                              </span>
                            )}
                            {isMobile ? (
                              <Input
                                type="number"
                                value={Math.round(adjusted / 100)}
                                onChange={(e) =>
                                  handleAdjust(
                                    cat.categoryId,
                                    Math.round(Number(e.target.value) * 100)
                                  )
                                }
                                className="w-24 h-8 text-right text-sm tabular-nums"
                                min={0}
                              />
                            ) : (
                              <span className="text-sm font-semibold tabular-nums w-20 text-right">
                                {formatCurrency(adjusted)}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isMobile && (
                          <Slider
                            value={[adjusted]}
                            onValueChange={(val) => {
                              const v = Array.isArray(val) ? val[0] : val;
                              handleAdjust(cat.categoryId, v as number);
                            }}
                            max={maxVal}
                            step={100} // 1 EUR steps
                            className="w-full"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Score comparison panel */}
        <div className={cn(isMobile ? "w-full" : "w-72 shrink-0")}>
          <div className="sticky top-4">{comparisonPanel}</div>
        </div>
      </div>
    </div>
  );
}
