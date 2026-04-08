import type { BudgetTier } from "./tiers";

export interface CategoryMonthlySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  tier: "needs" | "wants" | "savings";
  currentCents: number;
  previousMonthCents: number;
  avg3MonthCents: number;
  consecutiveMonthsRising: number;
  targetCents: number | null;
}

export interface CutSuggestion {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  tier: "needs" | "wants" | "savings";
  currentCents: number;
  baselineCents: number;
  savingsCents: number;
  pctChange: number;
  consecutiveMonthsRising: number;
  exceedsTarget: boolean;
  targetCents: number | null;
}

/**
 * Generates ranked cut suggestions from spending data.
 * Only includes categories where current spending exceeds the baseline (avg3Month)
 * or exceeds a custom target. Ranked by potential savings descending.
 */
export function generateCutSuggestions(
  categories: CategoryMonthlySpending[]
): CutSuggestion[] {
  const suggestions: CutSuggestion[] = [];

  for (const cat of categories) {
    const baselineCents = Math.min(cat.avg3MonthCents, cat.previousMonthCents);
    const exceedsTarget =
      cat.targetCents !== null && cat.currentCents > cat.targetCents;
    const isAboveBaseline = cat.currentCents > baselineCents && baselineCents > 0;

    if (!isAboveBaseline && !exceedsTarget) continue;

    const savingsCents = isAboveBaseline
      ? cat.currentCents - baselineCents
      : exceedsTarget
        ? cat.currentCents - cat.targetCents!
        : 0;

    const pctChange =
      baselineCents > 0
        ? Math.round(((cat.currentCents - baselineCents) / baselineCents) * 100)
        : 0;

    suggestions.push({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      categoryIcon: cat.categoryIcon,
      tier: cat.tier,
      currentCents: cat.currentCents,
      baselineCents,
      savingsCents,
      pctChange,
      consecutiveMonthsRising: cat.consecutiveMonthsRising,
      exceedsTarget,
      targetCents: cat.targetCents,
    });
  }

  suggestions.sort((a, b) => b.savingsCents - a.savingsCents);

  return suggestions;
}
