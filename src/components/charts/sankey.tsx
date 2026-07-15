"use client";

import { ResponsiveSankey } from "@nivo/sankey";
import { ChartCard } from "@/components/charts/chart-card";
import { nivoTheme } from "@/components/charts/nivo-theme";

interface SankeyData {
  nodes: { id: string; color?: string }[];
  links: { source: string; target: string; value: number }[];
}

// categoryPalette reordered so #60a5fa (blue) and #a78bfa (purple) are never
// adjacent — nearly indistinguishable under deuteranopia (ΔE 0.3), and sankey
// nodes sit vertically next to each other in palette order.
const sankeyPalette = [
  "#34d399", // emerald
  "#fb923c", // orange
  "#60a5fa", // blue
  "#f472b6", // pink
  "#a78bfa", // purple
  "#fbbf24", // amber
  "#22d3ee", // cyan
  "#c084fc", // violet
  "#2dd4bf", // teal
  "#fb7185", // rose
  "#818cf8", // indigo
  "#94a3b8", // slate
];

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
          colors={sankeyPalette}
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
