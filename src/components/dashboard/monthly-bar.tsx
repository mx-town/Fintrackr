"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { ChartCard, type PeriodKey } from "@/components/charts/chart-card";
import { BarChart3 } from "lucide-react";
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

export function MonthlyBar({
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
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const activeData = periodData?.[period] ?? data;

  const { sorted, total, maxValue, topName } = useMemo(() => {
    const s = [...activeData].sort((a, b) => b.total - a.total);
    const t = activeData.reduce((sum, d) => sum + d.total, 0);
    const m = s[0]?.total ?? 0;
    const name = `${s[0]?.categoryIcon ?? ""} ${s[0]?.categoryName ?? ""}`.trim();
    return { sorted: s, total: t, maxValue: m, topName: name };
  }, [activeData]);

  if (activeData.length === 0) {
    return (
      <ChartCard
        title="Top Spending Categories"
        subtitle="Where your money goes"
        periodToggle={
          periodData ? { value: period, onChange: setPeriod } : undefined
        }
      >
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm">No category data for this period</p>
        </div>
      </ChartCard>
    );
  }

  const items = sorted.slice(0, 8);

  const handleCategoryClick = (d: CategoryData) => {
    if (!onDrilldown || !d.categoryId) return;
    const range = periodRanges?.[period];
    if (!range) return;
    onDrilldown({
      title: `${d.categoryIcon ?? "\u{1F4E6}"} ${d.categoryName ?? "Uncategorized"}`,
      subtitle: `${d.count} expense transactions`,
      type: "expense",
      categoryId: d.categoryId,
      startDate: range.start,
      endDate: range.end,
    });
  };

  return (
    <ChartCard
      title="Top Spending Categories"
      subtitle={`#1: ${topName}`}
      periodToggle={
        periodData ? { value: period, onChange: setPeriod } : undefined
      }
    >
      <div className="space-y-3">
        {items.map((d, i) => {
          const pct = total > 0 ? ((d.total / total) * 100).toFixed(1) : "0";
          const barWidth = maxValue > 0 ? (d.total / maxValue) * 100 : 0;
          const isHovered = hoveredIndex === i;
          const isDimmed = hoveredIndex !== -1 && hoveredIndex !== i;

          return (
            <div
              key={d.categoryId ?? i}
              className={`group rounded-lg px-2 py-1.5 transition-all duration-200 cursor-pointer ${
                isHovered ? "bg-muted/30" : ""
              } ${isDimmed ? "opacity-50" : "opacity-100"}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(-1)}
              onClick={() => handleCategoryClick(d)}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-xs"
                    style={{
                      backgroundColor: `${d.categoryColor ?? "#94a3b8"}15`,
                    }}
                  >
                    {d.categoryIcon ?? "\u{1F4E6}"}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {d.categoryName ?? "Uncategorized"}
                  </span>
                  <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {d.count} txn{d.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-nums text-xs font-semibold text-foreground">
                    {formatCurrency(d.total)}
                  </span>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${d.categoryColor ?? "#94a3b8"}15`,
                      color: d.categoryColor ?? "#94a3b8",
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: d.categoryColor ?? "#94a3b8",
                    opacity: isHovered ? 1 : 0.75,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
        <span className="text-xs text-muted-foreground">
          {items.length} categories &middot;{" "}
          {items.reduce((s, d) => s + d.count, 0)} transactions
        </span>
        <span className="font-mono-nums text-xs font-semibold text-foreground">
          {formatCurrency(total)}
        </span>
      </div>
    </ChartCard>
  );
}
