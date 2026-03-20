"use client";

import { ResponsiveCalendar } from "@nivo/calendar";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme } from "@/components/charts/nivo-theme";
import { formatCurrency } from "@/lib/utils";

interface CalendarData {
  day: string; // "YYYY-MM-DD"
  value: number; // spending in euros
}

export function SpendingCalendar({
  data,
  from,
  to,
}: {
  data: CalendarData[];
  from: string;
  to: string;
}) {
  if (data.length === 0) {
    return (
      <ChartCard title="Daily Spending Heatmap" subtitle="Your spending intensity over time">
        <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">📅</span>
          <p className="mt-2 text-sm">No daily spending data available</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Daily Spending Heatmap" subtitle="Your spending intensity over time">
      <div className="h-48">
        <ResponsiveCalendar
          data={data}
          from={from}
          to={to}
          theme={nivoTheme}
          emptyColor="oklch(0.16 0.005 270)"
          colors={["#064e3b", "#059669", "#fbbf24", "#ef4444"]}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          yearSpacing={40}
          monthBorderColor="oklch(0.24 0.01 270)"
          dayBorderWidth={2}
          dayBorderColor="oklch(0.11 0.005 270)"
          tooltip={({ day, value }) => (
            <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl">
              <span className="text-muted-foreground">{day}</span>
              <span className="ml-2 font-mono-nums font-semibold text-foreground">
                {value != null ? formatCurrency(Math.round(Number(value) * 100)) : "No data"}
              </span>
            </div>
          )}
        />
      </div>
    </ChartCard>
  );
}
