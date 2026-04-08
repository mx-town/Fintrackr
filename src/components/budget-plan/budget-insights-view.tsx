"use client";

import { formatCurrency, cn } from "@/lib/utils";
import { ChartCard } from "@/components/charts/chart-card";
import {
  TIER_COLORS,
  TIER_LABELS,
  type BudgetTier,
} from "@/lib/budget-plan/tiers";
import { ShieldCheck, Sparkles, PiggyBank, CalendarDays, TrendingUp, TrendingDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BudgetInsightsData } from "@/actions/budget-insights";
import { TierDonut } from "@/components/budget-plan/tier-donut";
import { CategoryTable } from "@/components/budget-plan/category-table";
import { BudgetScorecard } from "./budget-scorecard";
import { MoneyFlow } from "./money-flow";
import { OptimizerCta } from "./optimizer-cta";
import type { BudgetScore } from "@/lib/budget-plan/scoring";
import type { MoneyFlowData } from "./money-flow-list";

/* ------------------------------------------------------------------ */
/*  Tier KPI Card Config                                               */
/* ------------------------------------------------------------------ */

const TIER_CARD_CONFIG: Record<
  "needs" | "wants" | "savings",
  {
    icon: typeof ShieldCheck;
    gradient: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    borderColor: string;
  }
> = {
  needs: {
    icon: ShieldCheck,
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    valueColor: "text-blue-400",
    borderColor: "border-blue-500/10",
  },
  wants: {
    icon: Sparkles,
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    valueColor: "text-amber-400",
    borderColor: "border-amber-500/10",
  },
  savings: {
    icon: PiggyBank,
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    valueColor: "text-emerald-400",
    borderColor: "border-emerald-500/10",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns true when the diff is "bad" (overspending or under-saving) */
function isTierOverBudget(tier: string, diff: number): boolean {
  return tier === "savings" ? diff < 0 : diff > 0;
}

export function TierBadge({ tier }: { tier: BudgetTier }) {
  const bgMap: Record<string, string> = {
    needs: "bg-blue-500/15 text-blue-400",
    wants: "bg-amber-500/15 text-amber-400",
    savings: "bg-emerald-500/15 text-emerald-400",
    income: "bg-emerald-500/15 text-emerald-400",
    other: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        bgMap[tier] ?? bgMap.other
      )}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface BudgetInsightsViewProps {
  data: BudgetInsightsData;
  budgetScore?: BudgetScore | null;
  moneyFlowData?: MoneyFlowData | null;
}

export function BudgetInsightsView({ data, budgetScore, moneyFlowData }: BudgetInsightsViewProps) {
  const { income, tiers, categories, dailyBudget, remainingBudget, daysLeft, todaySpending } =
    data;

  return (
    <div className="space-y-6 chart-stagger">
      {/* Budget Health Scorecard */}
      {budgetScore && (
        <BudgetScorecard score={budgetScore} />
      )}

      {/* Money Flow */}
      {moneyFlowData && (
        <MoneyFlow data={moneyFlowData} />
      )}

      {/* Optimizer CTA */}
      {budgetScore && (
        <OptimizerCta
          hasLowScore={budgetScore.tiers.some((t) => t.score < 50)}
        />
      )}

      {/* 1. Tier KPI Cards */}
      <section aria-label="Budget tier summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 stagger-children">
          {tiers.map((t) => {
            const cfg = TIER_CARD_CONFIG[t.tier];
            const Icon = cfg.icon;
            const isOver = isTierOverBudget(t.tier, t.diff);
            return (
              <article
                key={t.tier}
                aria-label={`${TIER_LABELS[t.tier]}: ${formatCurrency(t.amount)}, ${t.pctOfIncome}% of income`}
                className={`group relative overflow-hidden rounded-2xl border ${cfg.borderColor} bg-card p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg shimmer-bg`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} pointer-events-none`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {TIER_LABELS[t.tier]}
                    </p>
                    <div
                      className={`rounded-xl p-2 ${cfg.iconBg} transition-transform group-hover:scale-105`}
                    >
                      <Icon
                        className={`h-4 w-4 ${cfg.iconColor}`}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <div
                    className={`text-2xl font-heading font-bold font-mono-nums tracking-tight ${cfg.valueColor}`}
                  >
                    {formatCurrency(t.amount)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.pctOfIncome}% of income (target: {t.target}%)
                  </p>
                  <span
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                      isOver
                        ? "bg-rose-500/15 text-rose-400"
                        : "bg-emerald-500/15 text-emerald-400"
                    )}
                  >
                    {isOver ? (
                      <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-3 w-3" aria-hidden="true" />
                    )}
                    {t.diff > 0 ? "+" : ""}
                    {t.diff}pp vs target
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 2. 50/30/20 Comparison + Daily Budget */}
      <section aria-label="Budget comparison and daily allowance" className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* 50/30/20 Bars */}
        <div className="lg:col-span-3">
          <ChartCard
            title={
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                    50/30/20 Rule
                  </TooltipTrigger>
                  <TooltipContent>
                    The 50/30/20 rule suggests spending 50% on needs, 30% on wants, and saving 20%
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            }
            subtitle="How your spending compares to the ideal split"
          >
            <div className="space-y-5">
              <StackedBar
                label="Ideal"
                segments={[
                  { tier: "needs", pct: 50, displayLabel: "50%" },
                  { tier: "wants", pct: 30, displayLabel: "30%" },
                  { tier: "savings", pct: 20, displayLabel: "20%" },
                ]}
              />

              <ActualBar tiers={tiers} income={income} />

              {/* Per-tier diff rows */}
              <div className="space-y-2 pt-2 border-t border-border/30" role="list" aria-label="Tier differences">
                {tiers.map((t) => {
                  const isOver = isTierOverBudget(t.tier, t.diff);
                  return (
                    <div
                      key={t.tier}
                      role="listitem"
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              TIER_COLORS[t.tier as keyof typeof TIER_COLORS],
                          }}
                          aria-hidden="true"
                        />
                        <span className="text-muted-foreground">
                          {TIER_LABELS[t.tier]}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-mono-nums font-semibold",
                          isOver ? "text-rose-400" : "text-emerald-400"
                        )}
                      >
                        {isOver ? (
                          <TrendingUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-3 w-3" aria-hidden="true" />
                        )}
                        {t.diff > 0 ? "+" : ""}
                        {t.diff}pp
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Daily Budget Card */}
        <div className="lg:col-span-2">
          <DailyBudgetCard
            dailyBudget={dailyBudget}
            daysLeft={daysLeft}
            remainingBudget={remainingBudget}
            todaySpending={todaySpending}
            totalExpenses={data.totalExpenses}
            income={income}
          />
        </div>
      </section>

      {/* 3. Donut + Category Table */}
      <section aria-label="Spending breakdown" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TierDonut tiers={tiers} />
        <CategoryTable categories={categories} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stacked Bar (reusable for Ideal)                                   */
/* ------------------------------------------------------------------ */

function StackedBar({
  label,
  segments,
}: {
  label: string;
  segments: { tier: string; pct: number; displayLabel: string }[];
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <div className="flex h-8 overflow-hidden rounded-lg" role="img" aria-label={`${label}: ${segments.map((s) => `${TIER_LABELS[s.tier as keyof typeof TIER_LABELS]} ${s.displayLabel}`).join(", ")}`}>
        {segments.map((seg) => (
          <div
            key={seg.tier}
            className="flex items-center justify-center text-[10px] font-semibold text-white"
            style={{
              width: `${seg.pct}%`,
              backgroundColor:
                TIER_COLORS[seg.tier as keyof typeof TIER_COLORS],
            }}
          >
            {seg.displayLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Actual Stacked Bar                                                 */
/* ------------------------------------------------------------------ */

function ActualBar({
  tiers,
  income,
}: {
  tiers: BudgetInsightsData["tiers"];
  income: number;
}) {
  if (income === 0) {
    return (
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Actual
        </p>
        <div className="flex h-8 items-center justify-center rounded-lg bg-muted/30 text-xs text-muted-foreground">
          No income data
        </div>
      </div>
    );
  }

  const total = tiers.reduce((s, t) => s + t.amount, 0);
  const segments = tiers.map((t) => ({
    tier: t.tier,
    pct: total > 0 ? (t.amount / total) * 100 : 0,
    displayLabel: `${t.pctOfIncome}%`,
  }));

  return (
    <StackedBar
      label="Actual"
      segments={segments.filter((s) => s.pct > 0).map((s) => ({
        ...s,
        displayLabel: s.pct > 8 ? s.displayLabel : "",
      }))}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Daily Budget Card                                                  */
/* ------------------------------------------------------------------ */

function DailyBudgetCard({
  dailyBudget,
  daysLeft,
  remainingBudget,
  todaySpending,
  totalExpenses,
  income,
}: {
  dailyBudget: number;
  daysLeft: number;
  remainingBudget: number;
  todaySpending: number;
  totalExpenses: number;
  income: number;
}) {
  const budgetUsedPct = income > 0
    ? Math.min(100, Math.round((totalExpenses / (income * 0.8)) * 100))
    : 0;
  const isOverBudget = totalExpenses > income * 0.8;

  return (
    <article
      aria-label={`Daily budget: ${formatCurrency(dailyBudget)} per day, ${daysLeft} days left`}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 h-full transition-all duration-300 hover:border-border/80"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
      </div>
      <div className="relative space-y-6">
        <div className="flex items-center gap-2">
          <div className="rounded-xl p-2 bg-primary/15">
            <CalendarDays className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden="true" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Daily Budget
          </h3>
        </div>

        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Available per day
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="w-fit cursor-default text-3xl font-heading font-bold font-mono-nums tracking-tight text-foreground">
                {formatCurrency(dailyBudget)}
              </TooltipTrigger>
              <TooltipContent>
                Remaining expense budget divided by days left in the month
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <dl className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">Days left</dt>
            <dd className="font-mono-nums font-semibold text-foreground">
              {daysLeft}
            </dd>
          </div>
          <div className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">Remaining budget</dt>
            <dd className="font-mono-nums font-semibold text-foreground">
              {formatCurrency(remainingBudget)}
            </dd>
          </div>
          <div className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">Spent today</dt>
            <dd
              className={cn(
                "font-mono-nums font-semibold",
                todaySpending > dailyBudget
                  ? "text-rose-400"
                  : "text-foreground"
              )}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="cursor-default">
                    {formatCurrency(todaySpending)}
                    {todaySpending > dailyBudget && (
                      <span className="ml-1 text-[10px] font-normal">over limit</span>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    Daily budget: {formatCurrency(dailyBudget)} — Spent: {formatCurrency(todaySpending)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </dd>
          </div>
        </dl>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Budget used</span>
            <span className="font-mono-nums">{budgetUsedPct}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-muted/50 overflow-hidden"
            role="progressbar"
            aria-valuenow={budgetUsedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${budgetUsedPct}% of expense budget used`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isOverBudget ? "bg-rose-500" : "bg-primary"
              )}
              style={{
                width: `${budgetUsedPct}%`,
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
