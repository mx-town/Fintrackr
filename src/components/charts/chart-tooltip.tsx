"use client";

import { formatCurrency } from "@/lib/utils";
import type { CustomTooltipProps } from "@tremor/react";

/**
 * Glass-morphism tooltip for cartesian charts (area, bar, line).
 * Compatible with Tremor's customTooltip prop.
 */
export function PremiumTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl">
      {label && (
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: (item.color as string) ?? "#94a3b8" }}
            />
            <span className="text-xs text-muted-foreground">
              {String(item.name ?? "")}
            </span>
            <span className="ml-auto font-mono-nums text-xs font-semibold text-foreground">
              {formatCurrency(Math.round(Number(item.value ?? 0) * 100))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Glass-morphism tooltip for donut/pie charts.
 * Compatible with Tremor's customTooltip prop.
 */
export function DonutTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const item = payload[0];

  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl">
      <div className="flex items-center gap-2.5">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: (item.color as string) ?? "#94a3b8" }}
        />
        <span className="text-xs font-medium text-foreground">
          {String(item.name ?? "")}
        </span>
      </div>
      <p className="mt-1.5 font-mono-nums text-sm font-semibold text-foreground">
        {formatCurrency(Math.round(Number(item.value ?? 0) * 100))}
      </p>
    </div>
  );
}
