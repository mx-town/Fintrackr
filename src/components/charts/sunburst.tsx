"use client";

import { ResponsiveSunburst } from "@nivo/sunburst";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme, categoryPalette } from "@/components/charts/nivo-theme";

interface SunburstData {
  name: string;
  color?: string;
  children?: SunburstData[];
  value?: number;
}

export function CategorySunburst({ data }: { data: SunburstData }) {
  const hasChildren = data.children && data.children.length > 0;

  if (!hasChildren) {
    return (
      <ChartCard title="Category Drill-Down" subtitle="Hierarchical spending view">
        <div className="flex h-80 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">🎯</span>
          <p className="mt-2 text-sm">No category data to visualize</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Category Drill-Down" subtitle="Hierarchical spending view">
      <div className="h-80">
        <ResponsiveSunburst
          data={data}
          theme={nivoTheme}
          margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
          id="name"
          value="value"
          cornerRadius={4}
          borderWidth={2}
          borderColor="oklch(0.11 0.005 270)"
          colors={categoryPalette}
          enableArcLabels
          arcLabelsSkipAngle={10}
          animate
        />
      </div>
    </ChartCard>
  );
}
