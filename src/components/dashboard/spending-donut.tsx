"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
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

function DonutTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl">
      <div className="flex items-center gap-2.5">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: item.payload.fill }}
        />
        <span className="text-xs font-medium text-foreground">
          {item.name}
        </span>
      </div>
      <p className="mt-1.5 font-mono-nums text-sm font-semibold text-foreground">
        {formatCurrency(Math.round(item.value * 100))}
      </p>
    </div>
  );
}

export function SpendingDonut({
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
        title="Spending by Category"
        subtitle="Top categories this period"
        periodToggle={periodData ? { value: period, onChange: setPeriod } : undefined}
      >
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">📊</span>
          <p className="mt-2 text-sm">No spending data for this period</p>
        </div>
      </ChartCard>
    );
  }

  const top = activeData.slice(0, 6);
  const chartData = top.map((d) => ({
    name: `${d.categoryIcon ?? ""} ${d.categoryName ?? "Uncategorized"}`.trim(),
    value: d.total / 100,
    color: d.categoryColor ?? "#94a3b8",
  }));

  if (activeData.length > 6) {
    const otherTotal = activeData.slice(6).reduce((sum, d) => sum + d.total, 0);
    chartData.push({ name: "Other", value: otherTotal / 100, color: "#94a3b8" });
  }

  const total = activeData.reduce((sum, d) => sum + d.total, 0);
  const grandTotal = total / 100;

  return (
    <ChartCard
      title="Spending by Category"
      subtitle="Top categories this period"
      periodToggle={periodData ? { value: period, onChange: setPeriod } : undefined}
    >
      <div className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              strokeWidth={0}
              animationDuration={800}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-mono-nums text-lg font-bold text-foreground">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Top category callout */}
      {(() => {
        const topItem = chartData[0];
        if (!topItem) return null;
        const topPct = grandTotal > 0 ? ((topItem.value / grandTotal) * 100).toFixed(0) : "0";
        return (
          <div className="mt-4 mb-3 rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Biggest:</span>{" "}
            {topItem.name} — {formatCurrency(Math.round(topItem.value * 100))} ({topPct}%)
          </div>
        );
      })()}

      {/* Custom legend with percentages */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {chartData.map((item, i) => {
          const pct = grandTotal > 0 ? ((item.value / grandTotal) * 100).toFixed(1) : "0";
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-muted-foreground">{item.name}</span>
              <span className="ml-auto font-mono-nums text-foreground/70">{pct}%</span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
