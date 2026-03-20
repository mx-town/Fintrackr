"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PeriodKey = "month" | "3m" | "ytd" | "year";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: "Month",
  "3m": "3M",
  ytd: "YTD",
  year: "Year",
};

interface ChartCardBadge {
  label: string;
  variant: "positive" | "negative" | "neutral";
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  badge?: ChartCardBadge;
  action?: ReactNode;
  periodToggle?: { value: PeriodKey; onChange: (p: PeriodKey) => void };
  children: ReactNode;
  className?: string;
}

const badgeStyles: Record<ChartCardBadge["variant"], string> = {
  positive: "bg-emerald-500/15 text-emerald-400",
  negative: "bg-rose-500/15 text-rose-400",
  neutral: "bg-muted text-muted-foreground",
};

export function ChartCard({
  title,
  subtitle,
  badge,
  action,
  periodToggle,
  children,
  className,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:border-border/80",
        className
      )}
    >
      {/* Gradient sheen on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
      </div>

      <div className="relative">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-sm font-semibold text-foreground">
                {title}
              </h3>
              {badge && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    badgeStyles[badge.variant]
                  )}
                >
                  {badge.label}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {periodToggle && (
              <div className="flex items-center rounded-lg bg-muted/50 p-0.5">
                {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => periodToggle.onChange(key)}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-all",
                      periodToggle.value === key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {PERIOD_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
            {action && <div>{action}</div>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
