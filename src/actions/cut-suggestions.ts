"use server";

import { db } from "@/lib/db";
import { transactions, categories, categoryTargets } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { computeNetSpending } from "@/lib/spending/net-spending";
import { getCategoryTier } from "@/lib/budget-plan/tiers";
import {
  generateCutSuggestions,
  type CategoryMonthlySpending,
  type CutSuggestion,
} from "@/lib/budget-plan/suggestions";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export async function getCutSuggestions(
  userId: string,
  month: Date
): Promise<CutSuggestion[]> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // Fetch current month
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

  const currentNet = computeNetSpending(currentTxs);

  // Fetch previous month
  const prevStart = startOfMonth(subMonths(month, 1));
  const prevEnd = endOfMonth(subMonths(month, 1));
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

  // Fetch 3-month average (months -1, -2, -3)
  const monthlyNets: Map<string | null, number>[] = [];
  for (let i = 1; i <= 3; i++) {
    const mStart = startOfMonth(subMonths(month, i));
    const mEnd = endOfMonth(subMonths(month, i));
    const mTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, mStart),
          lte(transactions.date, mEnd)
        )
      );
    const mNet = computeNetSpending(mTxs);
    const catTotals = new Map<string | null, number>();
    for (const [catId, s] of mNet) {
      catTotals.set(catId, s.netSpending);
    }
    monthlyNets.push(catTotals);
  }

  // Compute consecutive months rising (check up to 6 months back)
  const risingMonths = new Map<string, number>();
  const allCatIds = new Set<string>();
  for (const [catId] of currentNet) {
    if (catId) allCatIds.add(catId);
  }

  for (const catId of allCatIds) {
    let consecutive = 0;
    let prevAmount = currentNet.get(catId)?.netSpending ?? 0;
    for (let i = 1; i <= 6; i++) {
      const mStart = startOfMonth(subMonths(month, i));
      const mEnd = endOfMonth(subMonths(month, i));
      const mTxs = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, mStart),
            lte(transactions.date, mEnd)
          )
        );
      const mNet = computeNetSpending(mTxs);
      const mAmount = mNet.get(catId)?.netSpending ?? 0;
      if (prevAmount > mAmount && mAmount > 0) {
        consecutive++;
        prevAmount = mAmount;
      } else {
        break;
      }
    }
    risingMonths.set(catId, consecutive);
  }

  // Get category metadata and targets
  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map((c) => [c.id, c]));

  const targets = await db
    .select()
    .from(categoryTargets)
    .where(eq(categoryTargets.userId, userId));
  const targetMap = new Map(targets.map((t) => [t.categoryId, t.amountCents]));

  // Build CategoryMonthlySpending array
  const catSpending: CategoryMonthlySpending[] = [];

  for (const [catId, spending] of currentNet) {
    if (!catId || spending.netSpending <= 0) continue;
    const cat = catMap.get(catId);
    if (!cat) continue;

    let tier = getCategoryTier(catId, cat.budgetTier);
    if (tier === "other") tier = "wants";
    if (tier !== "needs" && tier !== "wants" && tier !== "savings") continue;

    const prevSpending = prevNet.get(catId)?.netSpending ?? 0;
    const avg3Month = Math.round(
      monthlyNets.reduce((sum, m) => sum + (m.get(catId) ?? 0), 0) / 3
    );

    catSpending.push({
      categoryId: catId,
      categoryName: cat.nameDE || cat.name,
      categoryIcon: cat.icon,
      tier: tier as "needs" | "wants" | "savings",
      currentCents: spending.netSpending,
      previousMonthCents: prevSpending,
      avg3MonthCents: avg3Month,
      consecutiveMonthsRising: risingMonths.get(catId) ?? 0,
      targetCents: targetMap.get(catId) ?? null,
    });
  }

  return generateCutSuggestions(catSpending);
}
