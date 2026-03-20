import { KPICards } from "@/components/dashboard/kpi-cards";
import { SpendingDonut } from "@/components/dashboard/spending-donut";
import { MonthlyBar } from "@/components/dashboard/monthly-bar";
import { TrendArea } from "@/components/dashboard/trend-area";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Upload } from "lucide-react";
import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { eq, and, gte, lte, isNull, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";

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
        <EmptyState
          icon={<Upload className="h-8 w-8 text-muted-foreground" />}
          title="No transactions yet"
          description="Upload your first bank statement (CSV or PDF) from George, Raiffeisen, or BAWAG to see your dashboard."
          actionLabel="Upload Statement"
          actionHref="/upload"
        />
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
  const now = new Date();
  const yearStart = startOfYear(now);
  const twelveMonthsAgo = subMonths(startOfMonth(now), 11);
  const broadStart = yearStart < twelveMonthsAgo ? yearStart : twelveMonthsAgo;

  const broadTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, DEFAULT_USER_ID),
        gte(transactions.date, broadStart),
        lte(transactions.date, endOfMonth(now)),
        isNull(transactions.deletedAt)
      )
    )
    .orderBy(desc(transactions.date));

  // Aggregation helper
  type CatData = { categoryId: string | null; categoryName: string | null; categoryIcon: string | null; categoryColor: string | null; total: number; count: number };
  type DailyData = { date: string; total: number };

  function aggregateTransactions(txList: typeof broadTx) {
    const byCatMap = new Map<string, { total: number; count: number }>();
    const dailyMap = new Map<string, number>();

    for (const tx of txList.filter((t) => t.type === "expense")) {
      const key = tx.categoryId ?? "uncategorized";
      const p = byCatMap.get(key) ?? { total: 0, count: 0 };
      byCatMap.set(key, { total: p.total + tx.amountCents, count: p.count + 1 });

      const day = format(tx.date, "yyyy-MM-dd");
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + tx.amountCents);
    }

    const byCategory: CatData[] = Array.from(byCatMap.entries()).map(([catId, { total, count }]) => {
      const cat = catMap.get(catId);
      return {
        categoryId: catId === "uncategorized" ? null : catId,
        categoryName: cat?.name ?? "Uncategorized",
        categoryIcon: cat?.icon ?? "\u{1F4E6}",
        categoryColor: cat?.color ?? "#64748b",
        total,
        count,
      };
    });

    const dailySpending: DailyData[] = Array.from(dailyMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { byCategory, dailySpending };
  }

  // Period date ranges
  const periodRanges = {
    month: { start: startOfMonth(now), end: endOfMonth(now) },
    "3m": { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) },
    ytd: { start: startOfYear(now), end: now },
    year: { start: subMonths(startOfMonth(now), 11), end: endOfMonth(now) },
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

      <KPICards
        data={totals}
        previousIncome={previousIncome}
        previousExpenses={previousExpenses}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpendingDonut data={byCategory} periodData={periodByCategory} />
        <TrendArea data={dailySpending} periodData={periodDailySpending} />
      </div>

      <MonthlyBar data={byCategory} periodData={periodByCategory} />

      <RecentTransactions transactions={recent} />
    </div>
  );
}
