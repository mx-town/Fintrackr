import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingDown, TrendingUp, Hash, Percent } from "lucide-react";
import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { eq, and, gte, lte, isNull, desc, inArray } from "drizzle-orm";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { MonthlyTrend } from "@/components/categories/monthly-trend";
import { TopMerchants } from "@/components/categories/top-merchants";
import { TransactionTable } from "@/components/transactions/transaction-table";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ from?: string; to?: string; period?: string }>;
}) {
  await ensureDb();

  const { categoryId } = await params;
  const sp = await searchParams;

  // Find the category
  const allCats = await db.select().from(categories);
  const category = allCats.find((c) => c.id === categoryId);
  if (!category) notFound();

  // Collect this category + its children
  const childCats = allCats.filter((c) => c.parentId === categoryId);
  const categoryIds = [categoryId, ...childCats.map((c) => c.id)];

  // Date range — respect period param from categories grid
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (sp.from && sp.to) {
    startDate = new Date(sp.from);
    endDate = new Date(sp.to);
  } else if (sp.period === "3m") {
    startDate = startOfMonth(subMonths(now, 2));
    endDate = endOfMonth(now);
  } else if (sp.period === "ytd") {
    startDate = startOfYear(now);
    endDate = now;
  } else if (sp.period === "year") {
    startDate = subMonths(startOfMonth(now), 11);
    endDate = endOfMonth(now);
  } else {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  }

  // Previous period (same length, shifted back)
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  // Current period transactions
  const currentTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, DEFAULT_USER_ID),
        inArray(transactions.categoryId, categoryIds),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .orderBy(desc(transactions.date));

  // Previous period transactions (for comparison)
  const prevTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, DEFAULT_USER_ID),
        inArray(transactions.categoryId, categoryIds),
        gte(transactions.date, prevStart),
        lte(transactions.date, prevEnd),
        isNull(transactions.deletedAt)
      )
    );

  // KPIs — count both income and expense (skip transfers)
  const nonTransfer = currentTx.filter((t) => t.type !== "transfer");
  const expenseCents = nonTransfer
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amountCents, 0);
  const incomeCents = nonTransfer
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amountCents, 0);
  const totalActivity = expenseCents + incomeCents;
  const txCount = nonTransfer.length;

  const prevNonTransfer = prevTx.filter((t) => t.type !== "transfer");
  const prevExpenseCents = prevNonTransfer
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amountCents, 0);
  const prevIncomeCents = prevNonTransfer
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amountCents, 0);
  const prevTotalActivity = prevExpenseCents + prevIncomeCents;
  const pctChange =
    prevTotalActivity > 0
      ? ((totalActivity - prevTotalActivity) / prevTotalActivity) * 100
      : null;

  // Last 6 months for trend chart
  const sixMonthsAgo = subMonths(startOfMonth(now), 5);
  const trendTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, DEFAULT_USER_ID),
        inArray(transactions.categoryId, categoryIds),
        gte(transactions.date, sixMonthsAgo),
        isNull(transactions.deletedAt)
      )
    );

  const monthlyMap = new Map<string, number>();
  for (const tx of trendTx) {
    const key = format(tx.date, "MMM yy");
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + tx.amountCents);
  }

  // Build ordered monthly data
  const monthlyData: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = format(d, "MMM yy");
    monthlyData.push({ month: key, total: monthlyMap.get(key) ?? 0 });
  }

  // Top merchants (include both income and expense, skip transfers)
  const merchantMap = new Map<string, number>();
  for (const tx of nonTransfer) {
    const name = tx.counterpartyName || tx.description;
    merchantMap.set(name, (merchantMap.get(name) ?? 0) + tx.amountCents);
  }
  const merchants = Array.from(merchantMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Transaction list with categories
  const catMap = new Map(allCats.map((c) => [c.id, c]));
  const txWithCategory = currentTx.map((tx) => ({
    transaction: tx,
    category: tx.categoryId ? (catMap.get(tx.categoryId) ?? null) : null,
  }));

  const cardColor = category.color ?? "#64748b";
  const periodLabel =
    sp.period === "3m" ? "Last 3 months" :
    sp.period === "ytd" ? "Year to date" :
    sp.period === "year" ? "Last 12 months" :
    `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;

  return (
    <div className="space-y-6 p-6 lg:p-8 chart-stagger">
      {/* Back link */}
      <Link
        href="/categories"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Categories
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
          style={{ backgroundColor: `${cardColor}20` }}
        >
          {category.icon}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              {category.name}
            </h1>
            {pctChange !== null && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                  pctChange > 0
                    ? "bg-rose-500/15 text-rose-400"
                    : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {pctChange > 0 ? "+" : ""}
                {pctChange.toFixed(1)}% vs last period
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {category.nameDE ? `${category.nameDE} · ` : ""}
            {expenseCents > 0 && incomeCents > 0
              ? `${formatCurrency(expenseCents)} spent · ${formatCurrency(incomeCents)} earned`
              : incomeCents > 0
                ? `${formatCurrency(incomeCents)} earned`
                : `${formatCurrency(expenseCents)} spent`}
            {" · "}{periodLabel}
            {childCats.length > 0 &&
              ` · includes ${childCats.map((c) => c.name).join(", ")}`}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 stagger-children">
        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {incomeCents > 0 && expenseCents === 0 ? "Total Earned" : "Total Spent"}
            </p>
            <div className={`rounded-xl p-2 ${incomeCents > 0 && expenseCents === 0 ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
              {incomeCents > 0 && expenseCents === 0 ? (
                <TrendingUp className="h-4 w-4 text-[var(--color-income)]" strokeWidth={2} />
              ) : (
                <TrendingDown className="h-4 w-4 text-[var(--color-expense)]" strokeWidth={2} />
              )}
            </div>
          </div>
          <p className={`text-2xl font-heading font-bold font-mono-nums ${incomeCents > 0 && expenseCents === 0 ? "text-[var(--color-income)]" : "text-[var(--color-expense)]"}`}>
            {formatCurrency(incomeCents > 0 && expenseCents === 0 ? incomeCents : expenseCents)}
          </p>
          {incomeCents > 0 && expenseCents > 0 && (
            <p className="mt-1 text-sm font-mono-nums text-[var(--color-income)]">
              +{formatCurrency(incomeCents)} earned
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Transactions
            </p>
            <div className="rounded-xl p-2 bg-blue-500/15">
              <Hash className="h-4 w-4 text-[var(--color-savings)]" strokeWidth={2} />
            </div>
          </div>
          <p className="text-2xl font-heading font-bold font-mono-nums text-[var(--color-savings)]">
            {txCount}
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              vs Last Period
            </p>
            <div
              className={`rounded-xl p-2 ${
                pctChange !== null && pctChange > 0
                  ? "bg-rose-500/15"
                  : "bg-emerald-500/15"
              }`}
            >
              {pctChange !== null && pctChange > 0 ? (
                <TrendingUp className="h-4 w-4 text-[var(--color-expense)]" strokeWidth={2} />
              ) : (
                <TrendingDown className="h-4 w-4 text-[var(--color-income)]" strokeWidth={2} />
              )}
            </div>
          </div>
          <p
            className={`text-2xl font-heading font-bold font-mono-nums ${
              pctChange !== null && pctChange > 0
                ? "text-[var(--color-expense)]"
                : "text-[var(--color-income)]"
            }`}
          >
            {pctChange !== null ? `${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}%` : "—"}
          </p>
          {pctChange !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              was {formatCurrency(prevTotalActivity)}
            </p>
          )}
        </div>
      </div>

      {/* Charts: Monthly Trend + Top Merchants */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MonthlyTrend data={monthlyData} color={cardColor} />
        <TopMerchants data={merchants} color={cardColor} />
      </div>

      {/* Transactions */}
      <div>
        <h2 className="font-heading text-lg font-semibold mb-4">
          Transactions
        </h2>
        <TransactionTable transactions={txWithCategory} categories={allCats} />
      </div>
    </div>
  );
}
