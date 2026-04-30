"use client";

import { useState, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/charts/chart-card";
import { TIER_COLORS, TIER_LABELS } from "@/lib/budget-plan/tiers";
import type { BudgetInsightsData } from "@/actions/budget-insights";

const formatEur = (value: number) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(
    value
  );

export function TierDonut({ tiers }: { tiers: BudgetInsightsData["tiers"] }) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(-1);
  }, []);

  const chartData = tiers.map((t) => ({
    name: TIER_LABELS[t.tier],
    value: t.amount / 100,
    color: TIER_COLORS[t.tier as keyof typeof TIER_COLORS],
    pct: t.pctOfIncome,
  }));

  const grandTotal = chartData.reduce((s, d) => s + d.value, 0);
  const hoveredItem = activeIndex >= 0 ? chartData[activeIndex] : null;

  return (
    <ChartCard
      title="Needs / Wants / Savings"
      subtitle="Tier distribution of your spending"
    >
      <div className="relative h-64" role="img" aria-label={`Donut chart: ${chartData.map((d) => `${d.name} ${d.pct}%`).join(", ")}`}>
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
              animationDuration={400}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  opacity={activeIndex === -1 || activeIndex === i ? 1 : 0.35}
                  className="transition-opacity duration-200"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {hoveredItem ? (
            <>
              <span className="font-mono-nums text-base font-bold text-foreground">
                {formatEur(hoveredItem.value)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {hoveredItem.name}
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                {hoveredItem.pct}% of income
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Spent
              </span>
              <span className="font-mono-nums text-lg font-bold text-foreground">
                {formatEur(grandTotal)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1.5">
        {chartData.map((item, i) => {
          const isActive = activeIndex === -1 || activeIndex === i;
          return (
            <button
              key={item.name}
              type="button"
              aria-label={`${item.name}: ${item.pct}% of income, ${formatEur(item.value)}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-all duration-200",
                "hover:bg-muted/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                isActive ? "opacity-100" : "opacity-40"
              )}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(-1)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(-1)}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="truncate text-muted-foreground">
                {item.name}
              </span>
              <span className="ml-auto font-mono-nums text-foreground/70">
                {item.pct}%
              </span>
            </button>
          );
        })}
      </div>
    </ChartCard>
  );
}
