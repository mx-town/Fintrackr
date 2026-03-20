"use client";

import { ResponsiveHeatMap } from "@nivo/heatmap";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme } from "@/components/charts/nivo-theme";

interface HeatmapSeries {
  id: string; // day of week
  data: { x: string; y: number }[]; // hour -> value
}

export function SpendingHeatmap({ data }: { data: HeatmapSeries[] }) {
  if (data.length === 0) {
    return (
      <ChartCard title="When Do You Spend?" subtitle="Spending patterns by day and time">
        <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">🕐</span>
          <p className="mt-2 text-sm">No timing data available</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="When Do You Spend?" subtitle="Spending patterns by day and time">
      <div className="h-64">
        <ResponsiveHeatMap
          data={data}
          theme={nivoTheme}
          margin={{ top: 30, right: 30, bottom: 30, left: 60 }}
          axisTop={{
            tickSize: 5,
            tickPadding: 5,
          }}
          colors={{
            type: "sequential",
            scheme: "reds",
          }}
          emptyColor="oklch(0.16 0.005 270)"
          borderWidth={1}
          borderColor="oklch(0.24 0.01 270)"
          animate
        />
      </div>
    </ChartCard>
  );
}
