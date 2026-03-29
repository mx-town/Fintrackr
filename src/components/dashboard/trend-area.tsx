"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { ChartCard, type PeriodKey } from "@/components/charts/chart-card";
import { TrendingUp, Calendar, Zap } from "lucide-react";
import type { DrilldownFilter } from "@/components/dashboard/transaction-drilldown";

interface DailyData {
  date: string;
  total: number;
}

interface ChartPayloadItem {
  color: string;
  name: string;
  value: number;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const dateObj = new Date(label + "T00:00:00");
  const formatted = dateObj.toLocaleDateString("de-AT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {formatted}
      </p>
      <div className="space-y-1.5">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-mono-nums text-xs font-semibold text-foreground">
              {formatCurrency(Math.round(item.value * 100))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendArea({
  data,
  periodData,
  onDrilldown,
}: {
  data: DailyData[];
  periodData?: Record<PeriodKey, DailyData[]>;
  onDrilldown?: (filter: DrilldownFilter) => void;
}) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const activeData = periodData?.[period] ?? data;

  const { chartData, avgPerDay, peakDay, totalSpent } = useMemo(() => {
    if (activeData.length === 0)
      return {
        chartData: [],
        avgPerDay: 0,
        peakDay: { date: "", total: 0 },
        totalSpent: 0,
      };

    let cumulative = 0;
    let maxDay = { date: "", total: 0 };
    const totalCents = activeData.reduce((s, d) => s + d.total, 0);

    const processed = activeData.map((d) => {
      cumulative += d.total;
      if (d.total > maxDay.total) maxDay = { date: d.date, total: d.total };

      return {
        date: d.date,
        Daily: d.total / 100,
        Cumulative: cumulative / 100,
      };
    });

    return {
      chartData: processed,
      avgPerDay: totalCents / activeData.length / 100,
      peakDay: { date: maxDay.date, total: maxDay.total / 100 },
      totalSpent: totalCents / 100,
    };
  }, [activeData]);

  if (activeData.length === 0) {
    return (
      <ChartCard
        title="Spending Trend"
        subtitle="Daily and cumulative spending"
        periodToggle={
          periodData ? { value: period, onChange: setPeriod } : undefined
        }
      >
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm">No spending data for this period</p>
        </div>
      </ChartCard>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (state: any) => {
    if (!state?.activeLabel || !onDrilldown) return;
    const dateStr = String(state.activeLabel); // "yyyy-MM-dd"
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59.999");
    const formatted = dayStart.toLocaleDateString("de-AT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    onDrilldown({
      title: `Spending on ${formatted}`,
      subtitle: "All expense transactions for this day",
      type: "expense",
      startDate: dayStart.toISOString(),
      endDate: dayEnd.toISOString(),
    });
  };

  // Format x-axis tick
  const formatXTick = (value: string) => {
    const d = new Date(value + "T00:00:00");
    return d.toLocaleDateString("de-AT", { day: "numeric", month: "short" });
  };

  return (
    <ChartCard
      title="Spending Trend"
      subtitle={`${activeData.length} days tracked`}
      periodToggle={
        periodData ? { value: period, onChange: setPeriod } : undefined
      }
    >
      {/* Stats row */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/60" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </p>
            <p className="font-mono-nums text-sm font-semibold text-foreground">
              {formatCurrency(Math.round(totalSpent * 100))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <Calendar className="h-3.5 w-3.5 text-blue-400/60" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Daily Avg
            </p>
            <p className="font-mono-nums text-sm font-semibold text-blue-400">
              {formatCurrency(Math.round(avgPerDay * 100))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <Zap className="h-3.5 w-3.5 text-rose-400/60" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Peak
            </p>
            <p className="font-mono-nums text-sm font-semibold text-rose-400">
              {formatCurrency(Math.round(peakDay.total * 100))}
            </p>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 0, left: -10 }}
            onClick={handleChartClick}
            style={{ cursor: "pointer" }}
          >
            <defs>
              <linearGradient id="gradDaily" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="oklch(0.2 0.005 270)"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickFormatter={formatXTick}
              interval="preserveStartEnd"
              minTickGap={50}
              dy={8}
              fontSize={11}
              tick={{ fill: "oklch(0.45 0.01 80)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `€${v}`}
              width={55}
              fontSize={11}
              tick={{ fill: "oklch(0.45 0.01 80)" }}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{
                stroke: "oklch(0.72 0.19 160 / 30%)",
                strokeWidth: 1,
              }}
            />
            <ReferenceLine
              y={avgPerDay}
              stroke="#60a5fa"
              strokeDasharray="6 4"
              strokeWidth={1}
              strokeOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="Cumulative"
              name="Cumulative"
              stroke="#60a5fa"
              strokeWidth={2}
              fill="url(#gradCumulative)"
              animationDuration={800}
              dot={false}
              activeDot={{
                r: 4,
                fill: "#60a5fa",
                stroke: "oklch(0.11 0.005 270)",
                strokeWidth: 2,
              }}
            />
            <Area
              type="monotone"
              dataKey="Daily"
              name="Daily"
              stroke="#fb7185"
              strokeWidth={2}
              fill="url(#gradDaily)"
              animationDuration={800}
              dot={false}
              activeDot={{
                r: 4,
                fill: "#fb7185",
                stroke: "oklch(0.11 0.005 270)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#fb7185]" />
          <span className="text-[11px] text-muted-foreground">Daily</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#60a5fa]" />
          <span className="text-[11px] text-muted-foreground">Cumulative</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-[#60a5fa]/40" />
          <span className="text-[11px] text-muted-foreground">Avg/day</span>
        </div>
      </div>
    </ChartCard>
  );
}
