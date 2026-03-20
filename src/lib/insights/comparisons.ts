import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

interface PeriodComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

/**
 * Compare current month to previous month spending.
 */
export async function getMonthOverMonth(
  userId: string
): Promise<PeriodComparison[]> {
  const now = new Date();
  const currentStart = startOfMonth(now);
  const currentEnd = endOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));

  const [current, previous] = await Promise.all([
    getMonthStats(userId, currentStart, currentEnd),
    getMonthStats(userId, prevStart, prevEnd),
  ]);

  const comparisons: PeriodComparison[] = [
    buildComparison("Total Spending", current.totalExpenses, previous.totalExpenses),
    buildComparison("Total Income", current.totalIncome, previous.totalIncome),
    buildComparison("Transaction Count", current.txCount, previous.txCount),
    buildComparison(
      "Avg Transaction",
      current.txCount > 0
        ? Math.round(current.totalExpenses / current.txCount)
        : 0,
      previous.txCount > 0
        ? Math.round(previous.totalExpenses / previous.txCount)
        : 0
    ),
  ];

  return comparisons;
}

async function getMonthStats(userId: string, start: Date, end: Date) {
  const results = await db
    .select({
      type: transactions.type,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, start),
        lte(transactions.date, end),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(transactions.type);

  const income = results.find((r) => r.type === "income")?.total ?? 0;
  const expenses = results.find((r) => r.type === "expense")?.total ?? 0;
  const txCount = results.reduce((sum, r) => sum + r.count, 0);

  return { totalIncome: income, totalExpenses: expenses, txCount };
}

function buildComparison(
  metric: string,
  current: number,
  previous: number
): PeriodComparison {
  const change = current - previous;
  const changePercent = previous > 0 ? (change / previous) * 100 : 0;
  return { metric, current, previous, change, changePercent: Math.round(changePercent) };
}
