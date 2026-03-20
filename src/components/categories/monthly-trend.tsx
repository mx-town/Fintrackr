"use client";

import { BarChart } from "@tremor/react";
import { formatCurrency } from "@/lib/utils";
import { ChartCard } from "@/components/charts/chart-card";
import { PremiumTooltip } from "@/components/charts/chart-tooltip";

interface MonthData {
  month: string;
  total: number; // cents
}

interface MonthlyTrendProps {
  data: MonthData[];
  color: string;
}

export function MonthlyTrend({ data, color }: MonthlyTrendProps) {
  if (data.length === 0) {
    return (
      <ChartCard title="Monthly Trend" subtitle="No data yet">
        <div className="flex h-56 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">📊</span>
          <p className="mt-2 text-sm">No spending data for this category</p>
        </div>
      </ChartCard>
    );
  }

  const chartData = data.map((d) => ({
    month: d.month,
    Spending: d.total / 100,
  }));

  const avg = data.reduce((s, d) => s + d.total, 0) / data.length;

  return (
    <ChartCard
      title="Monthly Trend"
      subtitle={`Avg ${formatCurrency(Math.round(avg))}/month over ${data.length} months`}
    >
      <BarChart
        data={chartData}
        index="month"
        categories={["Spending"]}
        colors={[color]}
        showGridLines={false}
        valueFormatter={(v) => formatCurrency(Math.round(v * 100))}
        customTooltip={PremiumTooltip}
        className="h-56"
        showAnimation
        animationDuration={800}
      />
    </ChartCard>
  );
}
