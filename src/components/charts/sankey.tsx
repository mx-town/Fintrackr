"use client";

import { ResponsiveSankey } from "@nivo/sankey";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme, categoryPalette } from "@/components/charts/nivo-theme";

interface SankeyData {
  nodes: { id: string; color?: string }[];
  links: { source: string; target: string; value: number }[];
}

export function MoneyFlowSankey({ data }: { data: SankeyData }) {
  if (!data.nodes.length || !data.links.length) {
    return (
      <ChartCard title="Money Flow" subtitle="How money moves between categories">
        <div className="flex h-96 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">🔀</span>
          <p className="mt-2 text-sm">No flow data available</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Money Flow" subtitle="How money moves between categories">
      <div className="h-96">
        <ResponsiveSankey
          data={data}
          theme={nivoTheme}
          margin={{ top: 20, right: 160, bottom: 20, left: 50 }}
          align="justify"
          colors={categoryPalette}
          nodeOpacity={1}
          nodeThickness={18}
          nodeSpacing={24}
          nodeBorderWidth={0}
          linkOpacity={0.4}
          linkHoverOpacity={0.7}
          linkContract={3}
          enableLinkGradient
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={16}
          labelTextColor={{ from: "color", modifiers: [["brighter", 1]] }}
          animate
        />
      </div>
    </ChartCard>
  );
}
