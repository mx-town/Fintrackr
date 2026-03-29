"use client";

import { useState, useCallback } from "react";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { SpendingDonut } from "@/components/dashboard/spending-donut";
import { TrendArea } from "@/components/dashboard/trend-area";
import { MonthlyBar } from "@/components/dashboard/monthly-bar";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import {
  TransactionDrilldown,
  type DrilldownFilter,
} from "@/components/dashboard/transaction-drilldown";
import type { PeriodKey } from "@/components/charts/chart-card";

interface CategoryData {
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  count: number;
}

interface DailyData {
  date: string;
  total: number;
}

interface RecentTx {
  transaction: {
    id: string;
    date: Date;
    description: string;
    amountCents: number;
    type: "income" | "expense" | "transfer";
    currency: string;
    counterpartyName: string | null;
  };
  category: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export interface SerializedPeriodRanges {
  month: { start: string; end: string };
  "3m": { start: string; end: string };
  ytd: { start: string; end: string };
  year: { start: string; end: string };
}

interface DashboardChartsProps {
  userId: string;
  totals: { type: string; total: number; count: number }[];
  previousIncome: number;
  previousExpenses: number;
  byCategory: CategoryData[];
  periodByCategory: Record<PeriodKey, CategoryData[]>;
  dailySpending: DailyData[];
  periodDailySpending: Record<PeriodKey, DailyData[]>;
  recent: RecentTx[];
  periodRanges: SerializedPeriodRanges;
  defaultDateRange: { start: string; end: string };
}

export function DashboardCharts({
  userId,
  totals,
  previousIncome,
  previousExpenses,
  byCategory,
  periodByCategory,
  dailySpending,
  periodDailySpending,
  recent,
  periodRanges,
  defaultDateRange,
}: DashboardChartsProps) {
  const [drilldownFilter, setDrilldownFilter] =
    useState<DrilldownFilter | null>(null);

  const onDrilldown = useCallback((filter: DrilldownFilter) => {
    setDrilldownFilter(filter);
  }, []);

  const onClose = useCallback(() => {
    setDrilldownFilter(null);
  }, []);

  return (
    <>
      <KPICards
        data={totals}
        previousIncome={previousIncome}
        previousExpenses={previousExpenses}
        onDrilldown={onDrilldown}
        dateRange={defaultDateRange}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpendingDonut
          data={byCategory}
          periodData={periodByCategory}
          onDrilldown={onDrilldown}
          periodRanges={periodRanges}
        />
        <TrendArea data={dailySpending} periodData={periodDailySpending} onDrilldown={onDrilldown} />
      </div>

      <MonthlyBar
        data={byCategory}
        periodData={periodByCategory}
        onDrilldown={onDrilldown}
        periodRanges={periodRanges}
      />

      <RecentTransactions transactions={recent} />

      <TransactionDrilldown
        filter={drilldownFilter}
        onClose={onClose}
        userId={userId}
      />
    </>
  );
}
