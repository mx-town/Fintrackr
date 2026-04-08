import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { getBudgetScore } from "@/actions/budget-score";
import { getCutSuggestions } from "@/actions/cut-suggestions";
import { getBudgetInsights } from "@/actions/budget-insights";
import { getCategoryTargets } from "@/actions/category-targets";
import { MonthPicker } from "@/components/budget-plan/month-picker";
import { CutSuggestionsList } from "@/components/budget-plan/optimizer/cut-suggestions-list";
import { WhatIfSimulator, type SimulatorCategory } from "@/components/budget-plan/optimizer/what-if-simulator";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OptimizerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await ensureDb();
  const params = await searchParams;

  let targetDate = new Date();
  if (params.month) {
    const parsed = parseISO(params.month + "-01");
    if (!isNaN(parsed.getTime())) targetDate = parsed;
  }

  const currentMonth = format(targetDate, "yyyy-MM");
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);

  // Fetch all data in parallel
  const [budgetScore, suggestions, insightsData, targetMap] = await Promise.all([
    getBudgetScore(DEFAULT_USER_ID, targetDate),
    getCutSuggestions(DEFAULT_USER_ID, targetDate),
    getBudgetInsights(DEFAULT_USER_ID, monthStart, monthEnd),
    getCategoryTargets(DEFAULT_USER_ID),
  ]);

  // Build simulator categories from insights data
  const simulatorCategories: SimulatorCategory[] = [];
  if (insightsData) {
    for (const cat of insightsData.categories) {
      let tier = cat.tier as "needs" | "wants" | "savings";
      if (tier !== "needs" && tier !== "wants" && tier !== "savings") {
        tier = "wants";
      }

      const catId = cat.categoryId ?? "";
      simulatorCategories.push({
        categoryId: catId,
        categoryName: cat.categoryName ?? "Unknown",
        categoryIcon: cat.categoryIcon ?? null,
        tier,
        actualCents: cat.amount,
        targetCents: catId ? (targetMap.get(catId) ?? null) : null,
      });
    }
  }

  const backHref = params.month
    ? `/budget-plan?month=${params.month}`
    : "/budget-plan";

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Budget Optimizer</h1>
            <p className="text-sm text-muted-foreground">
              Find savings and simulate changes
            </p>
          </div>
        </div>
        <MonthPicker currentMonth={currentMonth} basePath="/budget-plan/optimizer" />
      </div>

      {!insightsData || !budgetScore ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
          <p className="font-medium">No data for this month</p>
          <p className="text-sm">
            Add income and expense transactions to see optimization suggestions.
          </p>
        </div>
      ) : (
        <>
          {/* Cut Suggestions */}
          <CutSuggestionsList suggestions={suggestions} />

          {/* Separator */}
          <div className="border-t" />

          {/* What-If Simulator */}
          <WhatIfSimulator
            userId={DEFAULT_USER_ID}
            incomeCents={insightsData.income}
            categories={simulatorCategories}
            currentScore={budgetScore}
          />
        </>
      )}
    </div>
  );
}
