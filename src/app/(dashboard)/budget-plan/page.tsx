import { EmptyState } from "@/components/shared/empty-state";
import { BudgetInsightsView } from "@/components/budget-plan/budget-insights-view";
import { MonthPicker } from "@/components/budget-plan/month-picker";
import { Upload } from "lucide-react";
import { getBudgetInsights } from "@/actions/budget-insights";
import { getBudgetScore } from "@/actions/budget-score";
import type { MoneyFlowData } from "@/components/budget-plan/money-flow-list";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth, format, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

export default async function BudgetPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await ensureDb();

  const params = await searchParams;
  const now = new Date();

  // Support ?month=2026-03 to view a specific month
  let targetDate = now;
  if (params.month) {
    const parsed = parseISO(params.month + "-01");
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);

  const data = await getBudgetInsights(DEFAULT_USER_ID, monthStart, monthEnd);
  const budgetScore = await getBudgetScore(DEFAULT_USER_ID, targetDate);

  // Build money flow data from budget insights
  const moneyFlowData: MoneyFlowData | null = data
    ? (() => {
        const tierMap = new Map<"needs" | "wants" | "savings", {
          amountCents: number;
          pctOfIncome: number;
          categories: MoneyFlowData["tiers"][0]["categories"];
        }>();

        for (const tier of ["needs", "wants", "savings"] as const) {
          tierMap.set(tier, { amountCents: 0, pctOfIncome: 0, categories: [] });
        }

        for (const cat of data.categories) {
          let tier = cat.tier as "needs" | "wants" | "savings";
          if (tier !== "needs" && tier !== "wants" && tier !== "savings") {
            tier = "wants";
          }
          const entry = tierMap.get(tier)!;
          entry.amountCents += cat.amount;
          entry.categories.push({
            categoryId: cat.categoryId ?? "",
            categoryName: cat.categoryName ?? "Unknown",
            categoryIcon: cat.categoryIcon ?? null,
            amountCents: cat.amount,
            pctOfIncome:
              data.income > 0
                ? Math.round((cat.amount / data.income) * 1000) / 10
                : 0,
            counterparties: [],
          });
        }

        const tiers = (["needs", "wants", "savings"] as const).map((t) => {
          const entry = tierMap.get(t)!;
          return {
            tier: t,
            amountCents: entry.amountCents,
            pctOfIncome:
              data.income > 0
                ? Math.round((entry.amountCents / data.income) * 1000) / 10
                : 0,
            categories: entry.categories.sort(
              (a, b) => b.amountCents - a.amountCents,
            ),
          };
        });

        return { incomeCents: data.income, tiers };
      })()
    : null;

  if (!data) {
    // Find the most recent month that has transaction data
    const [latest] = await db
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

    const latestMonthHint = latest
      ? {
          month: format(latest.date, "yyyy-MM"),
          label: format(latest.date, "MMMM yyyy"),
        }
      : null;

    const currentMonth = format(targetDate, "yyyy-MM");

    return (
      <div className="space-y-6 p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Budget Plan
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              50/30/20 rule analysis
            </p>
          </div>
          <MonthPicker currentMonth={currentMonth} />
        </div>
        {latestMonthHint ? (
          <EmptyState
            icon={<Upload className="h-8 w-8 text-muted-foreground" />}
            title="No data for this month"
            description={`Your most recent transactions are in ${latestMonthHint.label}. Click below to view that month's budget analysis.`}
            actionLabel={`View ${latestMonthHint.label}`}
            actionHref={`/budget-plan?month=${latestMonthHint.month}`}
          />
        ) : (
          <EmptyState
            icon={<Upload className="h-8 w-8 text-muted-foreground" />}
            title="No data to analyze"
            description="Upload your bank statements to see how your spending compares to the 50/30/20 rule."
            actionLabel="Upload Transactions"
            actionHref="/upload"
          />
        )}
      </div>
    );
  }

  const currentMonth = format(targetDate, "yyyy-MM");

  return (
    <div className="space-y-6 p-6 lg:p-8 chart-stagger">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Budget Plan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            50/30/20 rule analysis
          </p>
        </div>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      <BudgetInsightsView
          userId={DEFAULT_USER_ID}
          data={data}
          budgetScore={budgetScore}
          moneyFlowData={moneyFlowData}
        />
    </div>
  );
}
