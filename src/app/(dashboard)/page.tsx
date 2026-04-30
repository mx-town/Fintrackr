import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Upload } from "lucide-react";
import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { eq, and, gte, lte, isNull, desc, asc, count } from "drizzle-orm";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";
import { computeNetSpending } from "@/lib/spending/net-spending";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await ensureDb();

  const params = await searchParams;
  const startDate = params.from
    ? new Date(params.from)
    : startOfMonth(new Date());
  const endDate = params.to ? new Date(params.to) : endOfMonth(new Date());

  // Previous period (same length, shifted back)
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  // Query transactions for the period
  const allTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, DEFAULT_USER_ID),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .orderBy(desc(transactions.date));

  if (allTx.length === 0) {
    // Check if transactions exist outside the selected date range
    const [anyTx] = await db
      .select({ total: count() })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, DEFAULT_USER_ID),
          isNull(transactions.deletedAt)
        )
      );

    const hasDataElsewhere = (anyTx?.total ?? 0) > 0;

    // Find the date range of existing data
    let dataRangeHint: { from: string; to: string; label: string } | null = null;
    if (hasDataElsewhere) {
      const [oldest] = await db
        .select({ date: transactions.date })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, DEFAULT_USER_ID),
            isNull(transactions.deletedAt)
          )
        )
        .orderBy(asc(transactions.date))
        .limit(1);
      const [newest] = await db
        .select({ date: transactions.date })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, DEFAULT_USER_ID),
            isNull(transactions.deletedAt)
          )
        )
        .orderBy(desc(transactions.date))
        .limit(1);

      if (oldest && newest) {
        const from = startOfMonth(oldest.date);
        const to = endOfMonth(newest.date);
        dataRangeHint = {
          from: format(from, "yyyy-MM-dd"),
          to: format(to, "yyyy-MM-dd"),
          label: `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`,
        };
      }
    }

    return (
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your financial overview
            </p>
          </div>
          <DateRangePicker />
        </div>
        {hasDataElsewhere ? (
          <EmptyState
            icon={<Upload className="h-8 w-8 text-muted-foreground" />}
            title="No transactions in this period"
            description={
              dataRangeHint
                ? `Your transactions are in a different date range (${dataRangeHint.label}). Adjust the date picker or click below to view them.`
                : "Try adjusting the date range to find your transactions."
            }
            actionLabel="Show All Transactions"
            actionHref={dataRangeHint ? `/?from=${dataRangeHint.from}&to=${dataRangeHint.to}` : "/transactions"}
          />
        ) : (
          <EmptyState
            icon={<Upload className="h-8 w-8 text-muted-foreground" />}
            title="No transactions yet"
            description="Upload your first bank statement (JSON, CSV, or PDF) from George, Raiffeisen, or BAWAG to see your dashboard."
            actionLabel="Upload Statement"
            actionHref="/upload"
          />
        )}
      </div>
    );
  }

  // Build KPI totals
  const income = allTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amountCents, 0);
  const expenses = allTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amountCents, 0);

  const totals = [
    {
      type: "income",
      total: income,
      count: allTx.filter((t) => t.type === "income").length,
    },
    {
      type: "expense",
      total: expenses,
      count: allTx.filter((t) => t.type === "expense").length,
    },
  ];

  // Query previous period for comparison
  const prevTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, DEFAULT_USER_ID),
        gte(transactions.date, prevStart),
        lte(transactions.date, prevEnd),
        isNull(transactions.deletedAt)
      )
    );

  const previousIncome = prevTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amountCents, 0);
  const previousExpenses = prevTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amountCents, 0);

  // Get categories
  const cats = await db.select().from(categories);
  const catMap = new Map(cats.map((c) => [c.id, c]));

  // --- Fetch broad 12-month window for all period computations ---
  // Use the user-selected endDate as anchor so period toggles work with any date range
  const anchor = endDate;
  const yearStart = startOfYear(anchor);
  const twelveMonthsAgo = subMonths(startOfMonth(anchor), 11);
  const broadStart = yearStart < twelveMonthsAgo ? yearStart : twelveMonthsAgo;

  const broadTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, DEFAULT_USER_ID),
        gte(transactions.date, broadStart),
        lte(transactions.date, endOfMonth(anchor)),
        isNull(transactions.deletedAt)
      )
    )
    .orderBy(desc(transactions.date));

  // Aggregation helper
  type CatData = { categoryId: string | null; categoryName: string | null; categoryIcon: string | null; categoryColor: string | null; total: number; count: number };
  type DailyData = { date: string; total: number };

  function aggregateTransactions(txList: typeof broadTx) {
    // Counterparty-based cross-category net spending
    const netMap = computeNetSpending(txList);

    const byCategory: CatData[] = [...netMap.values()]
      .filter((e) => e.netSpending > 0)
      .map((e) => {
        const cat = e.categoryId ? catMap.get(e.categoryId) : undefined;
        return {
          categoryId: e.categoryId,
          categoryName: cat?.name ?? "Uncategorized",
          categoryIcon: cat?.icon ?? "\u{1F4E6}",
          categoryColor: cat?.color ?? "#64748b",
          total: e.netSpending,
          count: e.expenseCount,
        };
      });

    // Daily spending — keep simple per-day netting (same-day refunds offset)
    const dailyMap = new Map<string, number>();
    for (const tx of txList) {
      if (tx.type === "expense") {
        const day = format(tx.date, "yyyy-MM-dd");
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + tx.amountCents);
      } else if (tx.type === "income" && tx.categoryId !== "cat_income") {
        const day = format(tx.date, "yyyy-MM-dd");
        const current = dailyMap.get(day);
        if (current !== undefined) {
          dailyMap.set(day, Math.max(0, current - tx.amountCents));
        }
      }
    }

    const dailySpending: DailyData[] = Array.from(dailyMap.entries())
      .map(([date, total]) => ({ date, total }))
      .filter((d) => d.total > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    return { byCategory, dailySpending };
  }

  // Period date ranges — anchored to the user-selected end date
  const periodRanges = {
    month: { start: startOfMonth(anchor), end: endOfMonth(anchor) },
    "3m": { start: startOfMonth(subMonths(anchor, 2)), end: endOfMonth(anchor) },
    ytd: { start: startOfYear(anchor), end: anchor },
    year: { start: subMonths(startOfMonth(anchor), 11), end: endOfMonth(anchor) },
  } as const;

  type PKey = keyof typeof periodRanges;
  const periodByCategory = {} as Record<PKey, CatData[]>;
  const periodDailySpending = {} as Record<PKey, DailyData[]>;

  for (const [key, range] of Object.entries(periodRanges) as [PKey, { start: Date; end: Date }][]) {
    const filtered = broadTx.filter((tx) => tx.date >= range.start && tx.date <= range.end);
    const agg = aggregateTransactions(filtered);
    periodByCategory[key] = agg.byCategory;
    periodDailySpending[key] = agg.dailySpending;
  }

  // Default period data (from the user-selected date range)
  const { byCategory, dailySpending } = aggregateTransactions(allTx);

  // Recent transactions (last 10)
  const recent = allTx.slice(0, 10).map((tx) => ({
    transaction: tx,
    category: tx.categoryId ? (catMap.get(tx.categoryId) ?? null) : null,
  }));

  const periodLabel = `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;

  // Serialize period ranges as ISO strings for the client component
  const serializedPeriodRanges = {
    month: { start: periodRanges.month.start.toISOString(), end: periodRanges.month.end.toISOString() },
    "3m": { start: periodRanges["3m"].start.toISOString(), end: periodRanges["3m"].end.toISOString() },
    ytd: { start: periodRanges.ytd.start.toISOString(), end: periodRanges.ytd.end.toISOString() },
    year: { start: periodRanges.year.start.toISOString(), end: periodRanges.year.end.toISOString() },
  };

  const defaultDateRange = {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };

  return (
    <div className="space-y-6 p-6 lg:p-8 chart-stagger">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {periodLabel} &middot; {allTx.length} transactions
          </p>
        </div>
        <DateRangePicker />
      </div>

      <DashboardCharts
        userId={DEFAULT_USER_ID}
        totals={totals}
        previousIncome={previousIncome}
        previousExpenses={previousExpenses}
        byCategory={byCategory}
        periodByCategory={periodByCategory}
        dailySpending={dailySpending}
        periodDailySpending={periodDailySpending}
        recent={recent}
        periodRanges={serializedPeriodRanges}
        defaultDateRange={defaultDateRange}
      />
    </div>
  );
}
