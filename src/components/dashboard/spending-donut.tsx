"use client";

import { useState, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { ChartCard, type PeriodKey } from "@/components/charts/chart-card";
import { PieChartIcon } from "lucide-react";
import type { DrilldownFilter } from "@/components/dashboard/transaction-drilldown";
import type { SerializedPeriodRanges } from "@/components/dashboard/dashboard-charts";

interface CategoryData {
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  count: number;
}

interface ChartEntry {
  name: string;
  icon: string;
  value: number;
  color: string;
  count: number;
  categoryId: string | null;
}

export function SpendingDonut({
  data,
  periodData,
  onDrilldown,
  periodRanges,
}: {
  data: CategoryData[];
  periodData?: Record<PeriodKey, CategoryData[]>;
  onDrilldown?: (filter: DrilldownFilter) => void;
  periodRanges?: SerializedPeriodRanges;
}) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeData = periodData?.[period] ?? data;

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(-1);
  }, []);

  if (activeData.length === 0) {
    return (
      <ChartCard
        title="Spending by Category"
        subtitle="Top categories this period"
        periodToggle={
          periodData ? { value: period, onChange: setPeriod } : undefined
        }
      >
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <PieChartIcon className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm">No spending data for this period</p>
        </div>
      </ChartCard>
    );
  }

  const sorted = [...activeData].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, 6);
  const chartData: ChartEntry[] = top.map((d) => ({
    name: d.categoryName ?? "Uncategorized",
    icon: d.categoryIcon ?? "\u{1F4E6}",
    value: d.total / 100,
    color: d.categoryColor ?? "#94a3b8",
    count: d.count,
    categoryId: d.categoryId,
  }));

  if (sorted.length > 6) {
    const otherTotal = sorted.slice(6).reduce((sum, d) => sum + d.total, 0);
    const otherCount = sorted.slice(6).reduce((sum, d) => sum + d.count, 0);
    chartData.push({
      name: "Other",
      icon: "\u{1F4CB}",
      value: otherTotal / 100,
      color: "#94a3b8",
      count: otherCount,
      categoryId: null,
    });
  }

  const handleCategoryClick = (item: ChartEntry) => {
    if (item.name === "Other" || !onDrilldown || !item.categoryId) return;
    const range = periodRanges?.[period];
    if (!range) return;
    onDrilldown({
      title: `${item.icon} ${item.name}`,
      subtitle: `${item.count} expense transactions`,
      type: "expense",
      categoryId: item.categoryId,
      startDate: range.start,
      endDate: range.end,
    });
  };

  const total = activeData.reduce((sum, d) => sum + d.total, 0);
  const grandTotal = total / 100;

  // Hovered item details for center label
  const hoveredItem = activeIndex >= 0 ? chartData[activeIndex] : null;

  return (
    <ChartCard
      title="Spending by Category"
      subtitle="Top categories this period"
      periodToggle={
        periodData ? { value: period, onChange: setPeriod } : undefined
      }
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
              innerRadius="52%"
              outerRadius="82%"
              paddingAngle={2}
              strokeWidth={0}
              animationDuration={800}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              onClick={(_: unknown, index: number) => handleCategoryClick(chartData[index])}
              className="cursor-pointer"
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  opacity={activeIndex === -1 || activeIndex === i ? 1 : 0.35}
                  className="transition-opacity duration-200"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label — shows hovered category or total */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {hoveredItem ? (
            <>
              <span className="text-lg">{hoveredItem.icon}</span>
              <span className="mt-1 font-mono-nums text-base font-bold text-foreground">
                {formatCurrency(Math.round(hoveredItem.value * 100))}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {hoveredItem.name}
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                {grandTotal > 0
                  ? ((hoveredItem.value / grandTotal) * 100).toFixed(1)
                  : "0"}
                % &middot; {hoveredItem.count} txns
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Spent
              </span>
              <span className="font-mono-nums text-lg font-bold text-foreground">
                {formatCurrency(total)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Top category callout */}
      {(() => {
        const topItem = chartData[0];
        if (!topItem) return null;
        const topPct =
          grandTotal > 0
            ? ((topItem.value / grandTotal) * 100).toFixed(0)
            : "0";
        return (
          <div className="mt-4 mb-3 rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Biggest:</span>{" "}
            {topItem.icon} {topItem.name} —{" "}
            {formatCurrency(Math.round(topItem.value * 100))} ({topPct}%)
          </div>
        );
      })()}

      {/* Interactive legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {chartData.map((item, i) => {
          const pct =
            grandTotal > 0
              ? ((item.value / grandTotal) * 100).toFixed(1)
              : "0";
          const isActive = activeIndex === -1 || activeIndex === i;
          return (
            <button
              key={i}
              className={`flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-all duration-200 hover:bg-muted/30 cursor-pointer ${
                isActive ? "opacity-100" : "opacity-40"
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(-1)}
              onClick={() => handleCategoryClick(item)}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-muted-foreground">
                {item.icon} {item.name}
              </span>
              <span className="ml-auto font-mono-nums text-foreground/70">
                {pct}%
              </span>
            </button>
          );
        })}
      </div>
    </ChartCard>
  );
}
