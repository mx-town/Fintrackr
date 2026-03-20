import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface SpendingAnomaly {
  categoryId: string;
  categoryName: string;
  currentMonthCents: number;
  averageCents: number;
  percentChange: number;
  message: string;
}

/**
 * Detect spending anomalies by comparing current month
 * to the rolling 3-month average per category.
 */
export async function detectAnomalies(
  userId: string
): Promise<SpendingAnomaly[]> {
  const now = new Date();
  const currentStart = startOfMonth(now);
  const currentEnd = endOfMonth(now);
  const threeMonthsAgo = startOfMonth(subMonths(now, 3));

  // Current month spending by category
  const currentSpending = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, currentStart),
        lte(transactions.date, currentEnd),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(transactions.categoryId, categories.name);

  // Rolling 3-month average by category
  const historicalSpending = await db
    .select({
      categoryId: transactions.categoryId,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, threeMonthsAgo),
        lte(transactions.date, subMonths(currentStart, 0)),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(transactions.categoryId);

  const histMap = new Map(
    historicalSpending.map((h) => [h.categoryId, h.total / 3])
  );

  const anomalies: SpendingAnomaly[] = [];

  for (const current of currentSpending) {
    const avg = histMap.get(current.categoryId);
    if (!avg || avg === 0) continue;

    const percentChange = ((current.total - avg) / avg) * 100;

    if (percentChange > 50) {
      anomalies.push({
        categoryId: current.categoryId ?? "",
        categoryName: current.categoryName ?? "Unknown",
        currentMonthCents: current.total,
        averageCents: Math.round(avg),
        percentChange: Math.round(percentChange),
        message: `You spent ${Math.round(percentChange)}% more on ${current.categoryName} this month compared to your 3-month average (${formatCurrency(current.total)} vs ${formatCurrency(Math.round(avg))})`,
      });
    }
  }

  return anomalies.sort((a, b) => b.percentChange - a.percentChange);
}
