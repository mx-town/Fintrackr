"use server";

import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, isNull, desc } from "drizzle-orm";
import { buildMoneyFlow } from "@/lib/insights/money-flow";
import { buildWeekdayMatrix, weekdayTakeaway } from "@/lib/insights/weekday-matrix";
import {
  categoryMovers,
  unusualExpenses,
  newCounterparties,
  selectInsights,
  type CategoryPeriodTotal,
  type TxSummary,
} from "@/lib/insights/rules";

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

/**
 * Income → Budget → expense-category flows for the Sankey.
 */
export async function getMoneyFlow(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const rows = await db
    .select({
      type: transactions.type,
      categoryName: categories.name,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(transactions.type, categories.name);

  const incomes = rows
    .filter((r) => r.type === "income")
    .map((r) => ({ name: r.categoryName ?? "Other income", totalCents: r.total }));
  const expenses = rows
    .filter((r) => r.type === "expense")
    .map((r) => ({ name: r.categoryName ?? "Uncategorized", totalCents: r.total }));

  return buildMoneyFlow(incomes, expenses);
}

/**
 * Weekday × month average spending heatmap data + takeaway line.
 */
export async function getWeekdayMatrix(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const rows = await db
    .select({ date: transactions.date, amountCents: transactions.amountCents })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    );

  const matrix = buildWeekdayMatrix(rows, startDate, endDate);
  return { matrix, takeaway: weekdayTakeaway(matrix) };
}

const MIN_PREVIOUS_TX = 5;

/**
 * Rule-based "What stands out" insights: selected period vs. the previous
 * period of equal length.
 */
export async function getInsightPanelData(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  const fetchPeriod = (start: Date, end: Date) =>
    db
      .select({
        description: transactions.description,
        counterpartyName: transactions.counterpartyName,
        amountCents: transactions.amountCents,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          gte(transactions.date, start),
          lte(transactions.date, end),
          isNull(transactions.deletedAt)
        )
      );

  const [currentRows, prevRows] = await Promise.all([
    fetchPeriod(startDate, endDate),
    fetchPeriod(prevStart, prevEnd),
  ]);

  if (prevRows.length < MIN_PREVIOUS_TX) {
    return { insights: [], hidden: true as const };
  }

  const key = (r: { categoryId: string | null }) => r.categoryId ?? "uncategorized";

  const totalsMap = new Map<string, CategoryPeriodTotal>();
  for (const r of currentRows) {
    const k = key(r);
    const e = totalsMap.get(k) ?? {
      key: k,
      name: r.categoryName ?? "Uncategorized",
      currentCents: 0,
      previousCents: 0,
    };
    e.currentCents += r.amountCents;
    totalsMap.set(k, e);
  }
  for (const r of prevRows) {
    const k = key(r);
    const e = totalsMap.get(k) ?? {
      key: k,
      name: r.categoryName ?? "Uncategorized",
      currentCents: 0,
      previousCents: 0,
    };
    e.previousCents += r.amountCents;
    totalsMap.set(k, e);
  }

  // Median per category across BOTH periods (typical transaction size).
  const byCat = new Map<string, number[]>();
  for (const r of [...currentRows, ...prevRows]) {
    const k = key(r);
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(r.amountCents);
  }
  const medians = new Map<string, number>();
  for (const [k, values] of byCat) {
    const sorted = [...values].sort((a, b) => a - b);
    medians.set(k, sorted[Math.floor(sorted.length / 2)]);
  }

  const toSummary = (r: (typeof currentRows)[number]): TxSummary => ({
    description: r.description,
    counterpartyName: r.counterpartyName,
    amountCents: r.amountCents,
    categoryKey: key(r),
  });

  const prevNames = new Set(
    prevRows.map((r) => r.counterpartyName).filter((n): n is string => !!n)
  );

  const insights = selectInsights([
    ...categoryMovers([...totalsMap.values()]),
    ...unusualExpenses(currentRows.map(toSummary), medians),
    ...newCounterparties(currentRows.map(toSummary), prevNames),
  ]);

  return { insights, hidden: insights.length === 0 };
}
