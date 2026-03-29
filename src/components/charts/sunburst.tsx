"use client";

import { useMemo } from "react";
import { ResponsiveSunburst } from "@nivo/sunburst";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme, categoryPalette } from "@/components/charts/nivo-theme";
import { formatCurrency } from "@/lib/utils";
import { Target } from "lucide-react";

interface SunburstData {
  name: string;
  color?: string;
  children?: SunburstData[];
  value?: number;
}

export function CategorySunburst({ data }: { data: SunburstData }) {
  const hasChildren = data.children && data.children.length > 0;

  const grandTotal = useMemo(() => {
    function sumValues(node: SunburstData): number {
      if (node.value != null) return node.value;
      if (node.children)
        return node.children.reduce((s, c) => s + sumValues(c), 0);
      return 0;
    }
    return sumValues(data);
  }, [data]);

  const categoryCount = data.children?.length ?? 0;

  if (!hasChildren) {
    return (
      <ChartCard
        title="Category Drill-Down"
        subtitle="Hierarchical spending view"
      >
        <div className="flex h-80 flex-col items-center justify-center text-muted-foreground">
          <Target className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm">No category data to visualize</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Category Drill-Down"
      subtitle="Hierarchical spending view"
    >
      <div className="relative h-80">
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
          arcLabelsSkipAngle={12}
          animate
          tooltip={({ id, value, color }) => {
            const pct =
              grandTotal > 0
                ? (((value ?? 0) / grandTotal) * 100).toFixed(1)
                : "0";
            return (
              <div className="glass rounded-xl px-4 py-3 shadow-xl">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {id}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="font-mono-nums text-sm font-bold text-foreground">
                    {formatCurrency(Math.round((value ?? 0) * 100))}
                  </span>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${color}20`,
                      color: color,
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            );
          }}
        />

        {/* Center total overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Total
          </span>
          <span className="font-mono-nums text-base font-bold text-foreground">
            {formatCurrency(Math.round(grandTotal * 100))}
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            {categoryCount} categories
          </span>
        </div>
      </div>
    </ChartCard>
  );
}
