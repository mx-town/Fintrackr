export type BudgetTier = "needs" | "wants" | "savings" | "income" | "other";

/**
 * Maps each category ID to a budget tier for 50/30/20 analysis.
 */
export const CATEGORY_TIER_MAP: Record<string, BudgetTier> = {
  // Needs (essentials)
  cat_groceries: "needs",
  cat_food: "needs",
  cat_public: "needs",
  cat_housing: "needs",
  cat_rent: "needs",
  cat_utilities: "needs",
  cat_health: "needs",
  cat_fees: "needs",
  cat_fuel: "needs",
  cat_transport: "needs",

  // Wants (nice to have)
  cat_dining: "wants",
  cat_coffee: "wants",
  cat_entertainment: "wants",
  cat_subscriptions: "wants",
  cat_shopping: "wants",
  cat_travel: "wants",
  cat_personal: "wants",
  cat_education: "wants",

  // Savings
  cat_savings: "savings",

  // Income
  cat_income: "income",

  // Other
  cat_other: "other",
};

export const TIER_LABELS: Record<BudgetTier, string> = {
  needs: "Needs",
  wants: "Wants",
  savings: "Savings",
  income: "Income",
  other: "Other",
};

export const TIER_COLORS: Record<BudgetTier, string> = {
  needs: "#3b82f6",   // blue
  wants: "#f59e0b",   // amber
  savings: "#22c55e", // green
  income: "#22c55e",
  other: "#94a3b8",
};

/** Target percentages of income (50/30/20 rule) */
export const TIER_TARGETS: Record<"needs" | "wants" | "savings", number> = {
  needs: 50,
  wants: 30,
  savings: 20,
};

export function getCategoryTier(
  categoryId: string | null,
  dbOverride?: string | null
): BudgetTier {
  if (dbOverride && ["needs", "wants", "savings", "income", "other"].includes(dbOverride)) {
    return dbOverride as BudgetTier;
  }
  if (!categoryId) return "other";
  return CATEGORY_TIER_MAP[categoryId] ?? "other";
}
