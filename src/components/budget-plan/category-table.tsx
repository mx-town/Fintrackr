"use client";

import { useState, useTransition } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import { ChartCard } from "@/components/charts/chart-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TierBadge } from "@/components/budget-plan/budget-insights-view";
import { TIER_COLORS, TIER_LABELS, type BudgetTier } from "@/lib/budget-plan/tiers";
import { updateCategoryTier } from "@/actions/update-category-tier";
import type { CategoryBreakdown } from "@/actions/budget-insights";

const FILTER_OPTIONS: { value: BudgetTier | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs", label: "Needs" },
  { value: "wants", label: "Wants" },
  { value: "savings", label: "Savings" },
];

const ASSIGNABLE_TIERS: BudgetTier[] = ["needs", "wants", "savings"];

export function CategoryTable({
  categories,
}: {
  categories: CategoryBreakdown[];
}) {
  const [tierFilter, setTierFilter] = useState<BudgetTier | "all">("all");

  const filtered =
    tierFilter === "all"
      ? categories
      : categories.filter((cat) => cat.tier === tierFilter);

  return (
    <ChartCard
      title="Category Breakdown"
      subtitle="Spending per category with tier classification"
      action={
        <div className="flex items-center rounded-lg bg-muted/50 p-0.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTierFilter(opt.value)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                tierFilter === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.value !== "all" && (
                <span
                  className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[opt.value] }}
                  aria-hidden="true"
                />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Txns</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((cat, i) => (
              <TableRow key={cat.categoryId ?? i}>
                <TableCell className="font-medium">
                  <span className="mr-1.5" role="img" aria-label={cat.categoryName ?? "Category"}>
                    {cat.categoryIcon ?? "\u{1F4E6}"}
                  </span>
                  {cat.categoryName ?? "Uncategorized"}
                </TableCell>
                <TableCell>
                  {cat.tier === "other" && cat.categoryId ? (
                    <TierSelector
                      categoryId={cat.categoryId}
                      currentTier={cat.tier}
                    />
                  ) : (
                    <TierBadge tier={cat.tier} />
                  )}
                </TableCell>
                <TableCell className="text-right font-mono-nums">
                  {formatCurrency(cat.amount)}
                </TableCell>
                <TableCell className="text-right font-mono-nums text-muted-foreground">
                  {cat.pctOfExpenses}%
                </TableCell>
                <TableCell className="text-right font-mono-nums text-muted-foreground">
                  {cat.count}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  {tierFilter === "all"
                    ? "No expense categories yet"
                    : `No ${TIER_LABELS[tierFilter].toLowerCase()} categories`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  );
}

function TierSelector({
  categoryId,
  currentTier,
}: {
  categoryId: string;
  currentTier: BudgetTier;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSelect = (tier: BudgetTier) => {
    setOpen(false);
    startTransition(async () => {
      await updateCategoryTier(categoryId, tier);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "cursor-pointer rounded-md border border-dashed border-muted-foreground/30 px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:border-primary/50 hover:bg-primary/5",
          "bg-muted text-muted-foreground",
          isPending && "opacity-50"
        )}
      >
        {isPending ? "..." : TIER_LABELS[currentTier]}
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Assign tier
        </p>
        {ASSIGNABLE_TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => handleSelect(tier)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: TIER_COLORS[tier] }}
              aria-hidden="true"
            />
            {TIER_LABELS[tier]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
