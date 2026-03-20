"use server";

import { db } from "@/lib/db";
import { budgets, transactions } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";

export async function getBudgets(userId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const allBudgets = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.isActive, true)));

  // Get current month spending per category
  const spending = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(transactions.categoryId);

  const spendingMap = new Map(
    spending.map((s) => [s.categoryId, s.total])
  );

  return allBudgets.map((budget) => ({
    ...budget,
    spentCents: spendingMap.get(budget.categoryId) ?? 0,
    percentUsed: budget.categoryId
      ? ((spendingMap.get(budget.categoryId) ?? 0) / budget.amountCents) * 100
      : 0,
  }));
}

export async function createBudget(
  userId: string,
  data: {
    name: string;
    categoryId: string;
    amountCents: number;
    period?: "weekly" | "monthly" | "quarterly" | "yearly";
  }
) {
  const [result] = await db
    .insert(budgets)
    .values({
      userId,
      ...data,
    })
    .returning();
  return result;
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  data: {
    name?: string;
    amountCents?: number;
    isActive?: boolean;
    alertThreshold?: number;
  }
) {
  await db
    .update(budgets)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)));
}
