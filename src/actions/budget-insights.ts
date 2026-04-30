"use server";

import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, isNull, inArray } from "drizzle-orm";
import {
  getCategoryTier,
  TIER_TARGETS,
  type BudgetTier,
} from "@/lib/budget-plan/tiers";
import { computeNetSpending } from "@/lib/spending/net-spending";

export interface TierSummary {
  tier: "needs" | "wants" | "savings";
  amount: number; // cents
  pctOfIncome: number;
  target: number;
  diff: number; // pctOfIncome - target (positive = over)
}

export interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  tier: BudgetTier;
  amount: number; // cents
  pctOfExpenses: number;
  count: number;
}

export interface BudgetInsightsData {
  income: number; // cents
  totalExpenses: number; // cents
  tiers: TierSummary[];
  categories: CategoryBreakdown[];
  dailyBudget: number; // cents
  remainingBudget: number; // cents
  daysLeft: number;
  todaySpending: number; // cents
}

export async function getBudgetInsights(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<BudgetInsightsData | null> {
  // 1. Total income for the period
  const incomeRows = await db
    .select({
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "income"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    );

  const income = incomeRows[0]?.total ?? 0;

  // 2. Net spending by category (counterparty-based cross-category netting)
  const rawTx = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amountCents: transactions.amountCents,
      categoryId: transactions.categoryId,
      counterpartyName: transactions.counterpartyName,
      counterpartyIban: transactions.counterpartyIban,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    );

  const netMap = computeNetSpending(rawTx);

  // Fetch category metadata for categories that appear in the net spending map
  const catIds = [...netMap.keys()].filter((id): id is string => id !== null);
  const catRows =
    catIds.length > 0
      ? await db
          .select()
          .from(categories)
          .where(inArray(categories.id, catIds))
      : [];
  const catLookup = new Map(catRows.map((c) => [c.id, c]));

  // Build net-spending rows (only categories with net > 0)
  const byCategory = [...netMap.values()]
    .filter((e) => e.netSpending > 0)
    .map((e) => {
      const cat = e.categoryId ? catLookup.get(e.categoryId) : undefined;
      return {
        categoryId: e.categoryId,
        categoryName: cat?.name ?? null,
        categoryIcon: cat?.icon ?? null,
        categoryColor: cat?.color ?? null,
        budgetTier: cat?.budgetTier ?? null,
        total: e.netSpending,
        count: e.expenseCount,
      };
    })
    .sort((a, b) => b.total - a.total);

  if (income === 0 && byCategory.length === 0) return null;

  const totalExpenses = byCategory.reduce((sum, r) => sum + r.total, 0);

  // 3. Aggregate by tier — "other" tier is intentionally excluded so percentages
  // reflect only categories the user has classified. Unclassified spend stays
  // visible in the category breakdown table where it can be reassigned.
  const tierTotals: Record<string, number> = { needs: 0, wants: 0, savings: 0 };
  for (const row of byCategory) {
    const tier = getCategoryTier(row.categoryId, row.budgetTier);
    if (tier === "needs" || tier === "wants" || tier === "savings") {
      tierTotals[tier] += row.total;
    }
  }

  const tiers: TierSummary[] = (["needs", "wants", "savings"] as const).map(
    (tier) => {
      const amount = tierTotals[tier];
      const pctOfIncome = income > 0 ? (amount / income) * 100 : 0;
      const target = TIER_TARGETS[tier];
      return {
        tier,
        amount,
        pctOfIncome: Math.round(pctOfIncome * 10) / 10,
        target,
        diff: Math.round((pctOfIncome - target) * 10) / 10,
      };
    }
  );

  // 4. Category breakdown
  const categoriesBreakdown: CategoryBreakdown[] = byCategory.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryIcon: row.categoryIcon,
    categoryColor: row.categoryColor,
    tier: getCategoryTier(row.categoryId, row.budgetTier),
    amount: row.total,
    pctOfExpenses:
      totalExpenses > 0
        ? Math.round((row.total / totalExpenses) * 1000) / 10
        : 0,
    count: row.count,
  }));

  // 5. Daily budget calculation
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  const daysLeft = Math.max(
    1,
    Math.ceil(
      (endDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
  );

  // Ideal total expense budget = income * 80% (50 needs + 30 wants)
  const expenseBudget = income * 0.8;
  const remainingBudget = Math.max(0, expenseBudget - totalExpenses);
  const dailyBudget = Math.round(remainingBudget / daysLeft);

  // 6. Today's spending
  const todayStart = today;
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const todayRows = await db
    .select({
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, todayStart),
        lte(transactions.date, todayEnd),
        isNull(transactions.deletedAt)
      )
    );

  const todaySpending = todayRows[0]?.total ?? 0;

  return {
    income,
    totalExpenses,
    tiers,
    categories: categoriesBreakdown,
    dailyBudget,
    remainingBudget: Math.round(remainingBudget),
    daysLeft,
    todaySpending,
  };
}
