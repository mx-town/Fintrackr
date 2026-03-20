"use client";

import { BarList } from "@tremor/react";
import { formatCurrency } from "@/lib/utils";
import { ChartCard } from "@/components/charts/chart-card";

interface MerchantData {
  name: string;
  value: number; // cents
}

interface TopMerchantsProps {
  data: MerchantData[];
  color: string;
}

export function TopMerchants({ data, color }: TopMerchantsProps) {
  if (data.length === 0) {
    return (
      <ChartCard title="Top Merchants" subtitle="No data yet">
        <div className="flex h-56 flex-col items-center justify-center text-muted-foreground">
          <span className="text-3xl">🏪</span>
          <p className="mt-2 text-sm">No merchant data for this category</p>
        </div>
      </ChartCard>
    );
  }

  const topName = data[0]?.name ?? "—";
  const barData = data.slice(0, 8).map((d) => ({
    name: d.name,
    value: d.value / 100,
  }));

  return (
    <ChartCard
      title="Top Merchants"
      subtitle={`#1: ${topName}`}
    >
      <BarList
        data={barData}
        valueFormatter={(v: number) => formatCurrency(Math.round(v * 100))}
        color={color}
        className="h-56"
        showAnimation
      />
    </ChartCard>
  );
}
