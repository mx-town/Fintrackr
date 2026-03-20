"use server";

import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, isNull, desc } from "drizzle-orm";

export async function getDashboardData(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  // KPI: Total income, expenses, savings rate
  const totals = await db
    .select({
      type: transactions.type,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(transactions.type);

  // Spending by category
  const byCategory = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(
      transactions.categoryId,
      categories.name,
      categories.icon,
      categories.color
    )
    .orderBy(sql`SUM(${transactions.amountCents}) DESC`);

  // Daily spending for area chart
  const dailySpending = await db
    .select({
      date: sql<string>`DATE(${transactions.date})`.as("date"),
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(sql`DATE(${transactions.date})`)
    .orderBy(sql`DATE(${transactions.date})`);

  // Recent transactions
  const recent = await db
    .select({
      transaction: transactions,
      category: categories,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(eq(transactions.userId, userId), isNull(transactions.deletedAt))
    )
    .orderBy(desc(transactions.date))
    .limit(10);

  return { totals, byCategory, dailySpending, recent };
}

/**
 * Daily spending for the full year — feeds the calendar heatmap.
 */
export async function getCalendarData(userId: string, year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const rows = await db
    .select({
      day: sql<string>`DATE(${transactions.date})`.as("day"),
      value: sql<number>`SUM(${transactions.amountCents})`.as("value"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(sql`DATE(${transactions.date})`)
    .orderBy(sql`DATE(${transactions.date})`);

  return rows.map((r) => ({
    day: r.day,
    value: r.value / 100, // Convert cents to euros for display
  }));
}

/**
 * Hierarchical category totals — feeds treemap and sunburst.
 */
export async function getCategoryHierarchy(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      parentId: categories.parentId,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(
      transactions.categoryId,
      categories.name,
      categories.icon,
      categories.color,
      categories.parentId
    )
    .orderBy(sql`SUM(${transactions.amountCents}) DESC`);

  // Build treemap data
  const treemapChildren = rows.map((r) => ({
    name: r.categoryName ?? "Uncategorized",
    value: r.total / 100,
    color: r.categoryColor ?? "#94a3b8",
  }));

  const treemapData = {
    name: "Spending",
    children: treemapChildren,
  };

  // Build sunburst data (same flat structure for now, hierarchy can be added later)
  const sunburstData = {
    name: "All Spending",
    children: rows.map((r) => ({
      name: `${r.categoryIcon ?? ""} ${r.categoryName ?? "Uncategorized"}`.trim(),
      value: r.total / 100,
      color: r.categoryColor ?? "#94a3b8",
    })),
  };

  return { treemapData, sunburstData };
}
