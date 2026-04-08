"use client";

import { useState } from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";
import { MoneyFlowList, type MoneyFlowData } from "./money-flow-list";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

interface MoneyFlowProps {
  data: MoneyFlowData;
}

export function MoneyFlow({ data }: MoneyFlowProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  if (isMobile) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Where Your Money Goes</CardTitle>
        </CardHeader>
        <CardContent>
          <MoneyFlowList data={data} />
        </CardContent>
      </Card>
    );
  }

  // Build Sankey data: Income -> Tiers (level 1)
  // If a tier is expanded, also show Tier -> Categories (level 2)
  const nodes: { id: string; color?: string }[] = [
    { id: "Income", color: "#22c55e" },
  ];
  const links: { source: string; target: string; value: number }[] = [];

  for (const tier of data.tiers) {
    if (tier.amountCents <= 0) continue;
    const tierLabel = TIER_LABELS[tier.tier];
    nodes.push({ id: tierLabel, color: TIER_COLORS[tier.tier] });
    links.push({
      source: "Income",
      target: tierLabel,
      value: tier.amountCents / 100,
    });

    // If this tier is expanded, add category nodes
    if (expandedTier === tier.tier) {
      for (const cat of tier.categories) {
        if (cat.amountCents <= 0) continue;
        const catLabel = `${cat.categoryName}`;
        nodes.push({ id: catLabel, color: TIER_COLORS[tier.tier] });
        links.push({
          source: tierLabel,
          target: catLabel,
          value: cat.amountCents / 100,
        });
      }
    }
  }

  // Add unspent/savings remainder
  const totalSpent = data.tiers.reduce((s, t) => s + t.amountCents, 0);
  const remainder = data.incomeCents - totalSpent;
  if (remainder > 0) {
    nodes.push({ id: "Unallocated", color: "#94a3b8" });
    links.push({
      source: "Income",
      target: "Unallocated",
      value: remainder / 100,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Where Your Money Goes</CardTitle>
        <p className="text-xs text-muted-foreground">
          Click a tier to expand categories
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveSankey
            data={{ nodes, links }}
            margin={{ top: 10, right: 160, bottom: 10, left: 10 }}
            align="justify"
            colors={(node: { id: string; color?: string }) => node.color ?? "#94a3b8"}
            nodeOpacity={1}
            nodeHoverOpacity={1}
            nodeThickness={18}
            nodeSpacing={14}
            nodeBorderWidth={0}
            nodeBorderRadius={3}
            linkOpacity={0.3}
            linkHoverOpacity={0.6}
            linkContract={2}
            enableLinkGradient
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={12}
            labelTextColor={{ from: "color", modifiers: [["darker", 1]] }}
            nodeTooltip={({ node }) => (
              <div className="rounded-md bg-popover px-3 py-1.5 text-sm shadow-md border">
                <strong>{node.id}</strong>: {formatCurrency(node.value * 100)}
              </div>
            )}
            onClick={(nodeOrLink) => {
              // Check if it's a tier node click
              const tierEntry = data.tiers.find(
                (t) => TIER_LABELS[t.tier] === (nodeOrLink as { id?: string }).id
              );
              if (tierEntry) {
                setExpandedTier(
                  expandedTier === tierEntry.tier ? null : tierEntry.tier
                );
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
