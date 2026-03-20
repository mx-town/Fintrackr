"use client";

import { ResponsiveTreeMap } from "@nivo/treemap";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme, categoryPalette } from "@/components/charts/nivo-theme";
import { formatCurrency } from "@/lib/utils";

interface TreemapData {
  name: string;
  color?: string;
  children?: { name: string; value: number; color?: string }[];
  value?: number;
}

export function SpendingTreemap({ data }: { data: TreemapData }) {
  const hasChildren = data.children && data.children.length > 0;

  if (!hasChildren) {
    return (
      <ChartCard title="Spending Breakdown" subtitle="Category proportions at a glance">
        <div className="flex h-80 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">🧩</span>
          <p className="mt-2 text-sm">No spending data to break down</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Spending Breakdown" subtitle="Category proportions at a glance">
      <div className="h-80">
        <ResponsiveTreeMap
          data={data}
          identity="name"
          value="value"
          theme={nivoTheme}
          label={(e) =>
            `${e.id} (${formatCurrency(Math.round((e.value ?? 0) * 100))})`
          }
          labelSkipSize={40}
          parentLabelSize={20}
          colors={categoryPalette}
          borderWidth={2}
          borderColor="oklch(0.11 0.005 270)"
          animate
        />
      </div>
    </ChartCard>
  );
}
