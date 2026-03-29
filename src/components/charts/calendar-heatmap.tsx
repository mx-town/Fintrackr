"use client";

import { useMemo } from "react";
import { ResponsiveCalendar } from "@nivo/calendar";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme } from "@/components/charts/nivo-theme";
import { formatCurrency } from "@/lib/utils";
import { Flame, Calendar, TrendingDown } from "lucide-react";

interface CalendarData {
  day: string; // "YYYY-MM-DD"
  value: number; // spending in euros
}

const HEATMAP_COLORS = [
  "#064e3b", // very low — dark emerald
  "#047857", // low — emerald
  "#059669", // moderate-low
  "#d97706", // moderate — amber
  "#ea580c", // moderate-high — orange
  "#dc2626", // high — red
  "#991b1b", // very high — dark red
];

export function SpendingCalendar({
  data,
  from,
  to,
}: {
  data: CalendarData[];
  from: string;
  to: string;
}) {
  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const totalEuros = values.reduce((s, v) => s + v, 0);
    const avg = totalEuros / data.length;
    const peak = data.reduce(
      (max, d) => (d.value > max.value ? d : max),
      data[0]
    );
    const low = data.reduce(
      (min, d) => (d.value < min.value ? d : min),
      data[0]
    );

    return { totalEuros, avg, peak, low, daysWithData: data.length };
  }, [data]);

  if (data.length === 0) {
    return (
      <ChartCard
        title="Daily Spending Heatmap"
        subtitle="Your spending intensity over time"
      >
        <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
          <Calendar className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm">No daily spending data available</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Daily Spending Heatmap"
      subtitle="Your spending intensity over time"
    >
      {/* Stats row */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Days Tracked
              </p>
              <p className="font-mono-nums text-sm font-semibold text-foreground">
                {stats.daysWithData}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
            <TrendingDown className="h-3.5 w-3.5 text-muted-foreground/60" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Daily Avg
              </p>
              <p className="font-mono-nums text-sm font-semibold text-foreground">
                {formatCurrency(Math.round(stats.avg * 100))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
            <Flame className="h-3.5 w-3.5 text-rose-400/60" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Peak Day
              </p>
              <p className="font-mono-nums text-sm font-semibold text-rose-400">
                {formatCurrency(Math.round(stats.peak.value * 100))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
            <TrendingDown className="h-3.5 w-3.5 text-emerald-400/60" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Lowest Day
              </p>
              <p className="font-mono-nums text-sm font-semibold text-emerald-400">
                {formatCurrency(Math.round(stats.low.value * 100))}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="h-48">
        <ResponsiveCalendar
          data={data}
          from={from}
          to={to}
          theme={nivoTheme}
          emptyColor="oklch(0.16 0.005 270)"
          colors={HEATMAP_COLORS}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          yearSpacing={40}
          monthBorderColor="oklch(0.24 0.01 270)"
          dayBorderWidth={2}
          dayBorderColor="oklch(0.11 0.005 270)"
          tooltip={({ day, value }) => (
            <div className="glass rounded-xl px-4 py-2.5 shadow-xl">
              <p className="text-[10px] text-muted-foreground">
                {new Date(day + "T00:00:00").toLocaleDateString("de-AT", {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <p className="mt-0.5 font-mono-nums text-sm font-semibold text-foreground">
                {value != null
                  ? formatCurrency(Math.round(Number(value) * 100))
                  : "No data"}
              </p>
            </div>
          )}
        />
      </div>

      {/* Color legend */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-[10px] text-muted-foreground">Less</span>
        <div className="flex gap-0.5">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: "oklch(0.16 0.005 270)" }}
          />
          {HEATMAP_COLORS.map((color, i) => (
            <div
              key={i}
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </ChartCard>
  );
}
