"use client";

import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";

interface KPIData {
  type: string;
  total: number;
  count: number;
}

interface KPICardsProps {
  data: KPIData[];
  previousIncome?: number;
  previousExpenses?: number;
}

function PctBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0;
  return (
    <span
      className={`mt-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        isUp ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
      }`}
    >
      {isUp ? "+" : ""}
      {pct.toFixed(1)}% vs last month
    </span>
  );
}

export function KPICards({ data, previousIncome, previousExpenses }: KPICardsProps) {
  const income = data.find((d) => d.type === "income")?.total ?? 0;
  const expenses = data.find((d) => d.type === "expense")?.total ?? 0;
  const incomeCount = data.find((d) => d.type === "income")?.count ?? 0;
  const expenseCount = data.find((d) => d.type === "expense")?.count ?? 0;
  const net = income - expenses;
  const savingsRate = income > 0 ? ((net / income) * 100).toFixed(1) : "0";

  const cards = [
    {
      title: "Income",
      value: formatCurrency(income),
      subtitle: `${incomeCount} transaction${incomeCount !== 1 ? "s" : ""}`,
      icon: TrendingUp,
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-[var(--color-income)]",
      valueColor: "text-[var(--color-income)]",
      borderColor: "border-emerald-500/10",
      comparison:
        previousIncome != null ? (
          <IncBadge current={income} previous={previousIncome} />
        ) : null,
    },
    {
      title: "Expenses",
      value: formatCurrency(expenses),
      subtitle: `${expenseCount} transaction${expenseCount !== 1 ? "s" : ""}`,
      icon: TrendingDown,
      gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
      iconBg: "bg-rose-500/15",
      iconColor: "text-[var(--color-expense)]",
      valueColor: "text-[var(--color-expense)]",
      borderColor: "border-rose-500/10",
      comparison:
        previousExpenses != null ? (
          <PctBadge current={expenses} previous={previousExpenses} />
        ) : null,
    },
    {
      title: "Net Savings",
      value: formatCurrency(Math.abs(net)),
      subtitle: net >= 0 ? "You're saving" : "Spending more than earning",
      prefix: net >= 0 ? "+" : "-",
      icon: Wallet,
      gradient: net >= 0
        ? "from-blue-500/10 via-blue-500/5 to-transparent"
        : "from-orange-500/10 via-orange-500/5 to-transparent",
      iconBg: net >= 0 ? "bg-blue-500/15" : "bg-orange-500/15",
      iconColor: net >= 0 ? "text-[var(--color-savings)]" : "text-[var(--color-warning)]",
      valueColor: net >= 0 ? "text-[var(--color-savings)]" : "text-[var(--color-warning)]",
      borderColor: net >= 0 ? "border-blue-500/10" : "border-orange-500/10",
      comparison: null,
    },
    {
      title: "Savings Rate",
      value: `${savingsRate}%`,
      subtitle: Number(savingsRate) >= 20 ? "On track" : "Below target",
      icon: PiggyBank,
      gradient:
        Number(savingsRate) >= 20
          ? "from-emerald-500/10 via-emerald-500/5 to-transparent"
          : "from-amber-500/10 via-amber-500/5 to-transparent",
      iconBg:
        Number(savingsRate) >= 20 ? "bg-emerald-500/15" : "bg-amber-500/15",
      iconColor:
        Number(savingsRate) >= 20
          ? "text-[var(--color-income)]"
          : Number(savingsRate) >= 10
            ? "text-[var(--color-warning)]"
            : "text-[var(--color-expense)]",
      valueColor:
        Number(savingsRate) >= 20
          ? "text-[var(--color-income)]"
          : Number(savingsRate) >= 10
            ? "text-[var(--color-warning)]"
            : "text-[var(--color-expense)]",
      borderColor:
        Number(savingsRate) >= 20
          ? "border-emerald-500/10"
          : "border-amber-500/10",
      comparison: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`group relative overflow-hidden rounded-2xl border ${card.borderColor} bg-card p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg shimmer-bg`}
        >
          {/* Gradient background */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none`}
          />

          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.title}
              </p>
              <div className={`rounded-xl p-2 ${card.iconBg} transition-transform group-hover:scale-110`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} strokeWidth={2} />
              </div>
            </div>
            <div className={`text-2xl font-heading font-bold font-mono-nums tracking-tight ${card.valueColor}`}>
              {card.prefix ?? ""}
              {card.value}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.subtitle}
            </p>
            {card.comparison && <div>{card.comparison}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function IncBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0;
  return (
    <span
      className={`mt-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
        isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
      }`}
    >
      {isUp ? "+" : ""}
      {pct.toFixed(1)}% vs last month
    </span>
  );
}
