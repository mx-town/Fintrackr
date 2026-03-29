"use client";

import { useMemo } from "react";
import { ResponsiveTreeMap } from "@nivo/treemap";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme, categoryPalette } from "@/components/charts/nivo-theme";
import { formatCurrency } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";

interface TreemapChild {
  name: string;
  value: number;
  color?: string;
}

interface TreemapData {
  name: string;
  color?: string;
  children?: TreemapChild[];
  value?: number;
}

export function SpendingTreemap({ data }: { data: TreemapData }) {
  const hasChildren = data.children && data.children.length > 0;

  const grandTotal = useMemo(() => {
    if (!data.children) return 0;
    return data.children.reduce((s, c) => s + (c.value ?? 0), 0);
  }, [data]);

  if (!hasChildren) {
    return (
      <ChartCard
        title="Spending Breakdown"
        subtitle="Category proportions at a glance"
      >
        <div className="flex h-80 flex-col items-center justify-center text-muted-foreground">
          <LayoutGrid className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm">No spending data to break down</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Spending Breakdown"
      subtitle="Category proportions at a glance"
    >
      <div className="h-80">
        <ResponsiveTreeMap
          data={data}
          identity="name"
          value="value"
          theme={nivoTheme}
          label={(e) => {
            const pct =
              grandTotal > 0
                ? ((e.value ?? 0) / grandTotal * 100).toFixed(0)
                : "0";
            return `${e.id} (${pct}%)`;
          }}
          labelSkipSize={40}
          parentLabelSize={20}
          colors={categoryPalette}
          borderWidth={2}
          borderColor="oklch(0.11 0.005 270)"
          animate
          tooltip={({ node }) => {
            const pct =
              grandTotal > 0
                ? ((node.value ?? 0) / grandTotal * 100).toFixed(1)
                : "0";
            return (
              <div className="glass rounded-xl px-4 py-3 shadow-xl">
                <p className="text-xs font-semibold text-foreground">
                  {node.id}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-mono-nums text-sm font-bold text-foreground">
                    {formatCurrency(Math.round((node.value ?? 0) * 100))}
                  </span>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${node.color}20`,
                      color: node.color,
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            );
          }}
        />
      </div>
    </ChartCard>
  );
}
