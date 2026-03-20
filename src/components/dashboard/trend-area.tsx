"use client";

import { useState } from "react";
import { AreaChart } from "@tremor/react";
import { formatCurrency } from "@/lib/utils";
import { ChartCard, type PeriodKey } from "@/components/charts/chart-card";
import { PremiumTooltip } from "@/components/charts/chart-tooltip";

interface DailyData {
  date: string;
  total: number;
}

export function TrendArea({
  data,
  periodData,
}: {
  data: DailyData[];
  periodData?: Record<PeriodKey, DailyData[]>;
}) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const activeData = periodData?.[period] ?? data;

  if (activeData.length === 0) {
    return (
      <ChartCard
        title="Spending Trend"
        subtitle="Daily and cumulative spending"
        periodToggle={periodData ? { value: period, onChange: setPeriod } : undefined}
      >
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">📈</span>
          <p className="mt-2 text-sm">No spending data for this period</p>
        </div>
      </ChartCard>
    );
  }

  let cumulative = 0;
  const chartData = activeData.map((d) => {
    cumulative += d.total;
    return {
      date: d.date,
      "Daily Spending": d.total / 100,
      Cumulative: cumulative / 100,
    };
  });

  const totalCents = activeData.reduce((s, d) => s + d.total, 0);
  const avgPerDay = Math.round(totalCents / activeData.length);

  return (
    <ChartCard
      title="Spending Trend"
      subtitle={`Avg ${formatCurrency(avgPerDay)}/day over ${activeData.length} days`}
      periodToggle={periodData ? { value: period, onChange: setPeriod } : undefined}
    >
      <AreaChart
        data={chartData}
        index="date"
        categories={["Daily Spending", "Cumulative"]}
        colors={["rose", "blue"]}
        curveType="monotone"
        showGridLines={false}
        showGradient
        valueFormatter={(v) => formatCurrency(Math.round(v * 100))}
        customTooltip={PremiumTooltip}
        className="h-64"
        showAnimation
        animationDuration={1000}
      />
    </ChartCard>
  );
}
