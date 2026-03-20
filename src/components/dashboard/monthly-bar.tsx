"use client";

import { useState } from "react";
import { BarList } from "@tremor/react";
import { formatCurrency } from "@/lib/utils";
import { ChartCard, type PeriodKey } from "@/components/charts/chart-card";

interface CategoryData {
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  count: number;
}

export function MonthlyBar({
  data,
  periodData,
}: {
  data: CategoryData[];
  periodData?: Record<PeriodKey, CategoryData[]>;
}) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const activeData = periodData?.[period] ?? data;

  if (activeData.length === 0) {
    return (
      <ChartCard
        title="Top Spending Categories"
        subtitle="Where your money goes"
        periodToggle={periodData ? { value: period, onChange: setPeriod } : undefined}
      >
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">📊</span>
          <p className="mt-2 text-sm">No category data for this period</p>
        </div>
      </ChartCard>
    );
  }

  const sorted = [...activeData].sort((a, b) => b.total - a.total);
  const topName = `${sorted[0]?.categoryIcon ?? ""} ${sorted[0]?.categoryName ?? ""}`.trim();
  const barData = sorted.slice(0, 8).map((d) => ({
    name: `${d.categoryIcon ?? ""} ${d.categoryName ?? "Uncategorized"}`.trim(),
    value: d.total / 100,
  }));

  return (
    <ChartCard
      title="Top Spending Categories"
      subtitle={`#1: ${topName}`}
      periodToggle={periodData ? { value: period, onChange: setPeriod } : undefined}
    >
      <BarList
        data={barData}
        valueFormatter={(v: number) => formatCurrency(Math.round(v * 100))}
        color="emerald"
        showAnimation
      />
    </ChartCard>
  );
}
