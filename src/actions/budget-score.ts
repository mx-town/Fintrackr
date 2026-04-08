"use server";

import { db } from "@/lib/db";
import { transactions, categories, categoryTargets } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { computeNetSpending } from "@/lib/spending/net-spending";
import { getCategoryTier, type BudgetTier } from "@/lib/budget-plan/tiers";
import {
  computeBudgetScore,
  type BudgetScore,
  type TierSpending,
  type CategorySpendingHistory,
} from "@/lib/budget-plan/scoring";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
} from "date-fns";

export async function getBudgetScore(
  userId: string,
  month: Date
): Promise<BudgetScore | null> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // Get current month transactions
  const currentTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd)
      )
    );

  if (currentTxs.length === 0) return null;

  // Get income
  const incomeCents = currentTxs
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  if (incomeCents <= 0) return null;

  // Get current net spending by category
  const netSpending = computeNetSpending(currentTxs);

  // Get category metadata
  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map((c) => [c.id, c]));

  // Build current tier spending
  const tierTotals: Record<"needs" | "wants" | "savings", number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };

  for (const [catId, spending] of netSpending) {
    if (!catId || spending.netSpending <= 0) continue;
    const cat = catMap.get(catId);
    const tier = getCategoryTier(catId, cat?.budgetTier);
    if (tier === "needs" || tier === "wants" || tier === "savings") {
      tierTotals[tier] += spending.netSpending;
    } else if (tier === "other") {
      tierTotals.wants += spending.netSpending; // "other" buckets into wants
    }
  }

  const tierSpending: TierSpending[] = [
    { tier: "needs", amountCents: tierTotals.needs },
    { tier: "wants", amountCents: tierTotals.wants },
    { tier: "savings", amountCents: tierTotals.savings },
  ];

  // Get previous 3 months for trend
  const tierAvg3MonthCents: Record<"needs" | "wants" | "savings", number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };

  for (let i = 1; i <= 3; i++) {
    const prevMonth = subMonths(month, i);
    const prevStart = startOfMonth(prevMonth);
    const prevEnd = endOfMonth(prevMonth);

    const prevTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, prevStart),
          lte(transactions.date, prevEnd)
        )
      );

    const prevNet = computeNetSpending(prevTxs);

    for (const [catId, spending] of prevNet) {
      if (!catId || spending.netSpending <= 0) continue;
      const cat = catMap.get(catId);
      const tier = getCategoryTier(catId, cat?.budgetTier);
      if (tier === "needs" || tier === "wants" || tier === "savings") {
        tierAvg3MonthCents[tier] += spending.netSpending;
      } else if (tier === "other") {
        tierAvg3MonthCents.wants += spending.netSpending;
      }
    }
  }

  // Average the 3-month totals
  tierAvg3MonthCents.needs = Math.round(tierAvg3MonthCents.needs / 3);
  tierAvg3MonthCents.wants = Math.round(tierAvg3MonthCents.wants / 3);
  tierAvg3MonthCents.savings = Math.round(tierAvg3MonthCents.savings / 3);

  // Get custom targets
  const targets = await db
    .select()
    .from(categoryTargets)
    .where(eq(categoryTargets.userId, userId));

  const targetMap = new Map(targets.map((t) => [t.categoryId, t.amountCents]));

  // Build category spending histories by tier
  const tierHistories: Record<"needs" | "wants" | "savings", CategorySpendingHistory[]> = {
    needs: [],
    wants: [],
    savings: [],
  };

  for (const [catId, spending] of netSpending) {
    if (!catId || spending.netSpending <= 0) continue;
    const cat = catMap.get(catId);
    let tier = getCategoryTier(catId, cat?.budgetTier);
    if (tier === "other") tier = "wants" as BudgetTier;
    if (tier !== "needs" && tier !== "wants" && tier !== "savings") continue;

    tierHistories[tier as "needs" | "wants" | "savings"].push({
      categoryId: catId,
      tier: tier as "needs" | "wants" | "savings",
      currentAmountCents: spending.netSpending,
      avg3MonthCents: 0,
      targetCents: targetMap.get(catId) ?? null,
    });
  }

  return computeBudgetScore(
    incomeCents,
    tierSpending,
    tierHistories,
    tierAvg3MonthCents
  );
}
