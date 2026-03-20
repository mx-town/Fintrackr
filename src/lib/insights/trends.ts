import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and, gte, isNull, sql } from "drizzle-orm";
import { subMonths, format } from "date-fns";

interface MonthlyTrend {
  month: string; // "YYYY-MM"
  income: number;
  expenses: number;
  net: number;
}

/**
 * Get monthly spending/income trends for the last N months.
 */
export async function getMonthlyTrends(
  userId: string,
  months: number = 12
): Promise<MonthlyTrend[]> {
  const since = subMonths(new Date(), months);

  const results = await db
    .select({
      month: sql<string>`TO_CHAR(${transactions.date}, 'YYYY-MM')`.as("month"),
      type: transactions.type,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, since),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(sql`TO_CHAR(${transactions.date}, 'YYYY-MM')`, transactions.type)
    .orderBy(sql`TO_CHAR(${transactions.date}, 'YYYY-MM')`);

  // Group by month
  const monthMap = new Map<
    string,
    { income: number; expenses: number }
  >();

  for (const row of results) {
    const existing = monthMap.get(row.month) ?? { income: 0, expenses: 0 };
    if (row.type === "income") existing.income = row.total;
    else if (row.type === "expense") existing.expenses = row.total;
    monthMap.set(row.month, existing);
  }

  return Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    income: data.income,
    expenses: data.expenses,
    net: data.income - data.expenses,
  }));
}
