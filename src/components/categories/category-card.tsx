"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { SparkBarChart } from "@tremor/react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CategoryDialog } from "@/components/categories/category-dialog";

interface MonthlyAmount {
  month: string;
  amount: number;
}

interface ChildCategory {
  id: string;
  name: string;
  icon: string | null;
}

interface CategoryCardProps {
  id: string;
  name: string;
  nameDE: string | null;
  icon: string | null;
  color: string | null;
  expenseCents: number;
  incomeCents: number;
  transactionCount: number;
  period: string;
  periodLabel: string;
  monthlyData: MonthlyAmount[];
  children: ChildCategory[];
  onEdit?: (data: { name: string; nameDE: string; icon: string; color: string }) => void;
}

export function CategoryCard({
  id,
  name,
  nameDE,
  icon,
  color,
  expenseCents,
  incomeCents,
  transactionCount,
  period,
  periodLabel,
  monthlyData,
  children,
  onEdit,
}: CategoryCardProps) {
  const cardColor = color ?? "#64748b";

  return (
    <div className="group relative rounded-2xl border border-border/50 bg-card p-5 transition-all hover:border-border hover:bg-card/80">
      {/* Edit button */}
      {onEdit && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <CategoryDialog
            mode="edit"
            initial={{ id, name, nameDE, icon, color }}
            onSubmit={onEdit}
            trigger={
              <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            }
          />
        </div>
      )}

      <Link href={`/categories/${id}?period=${period}`} className="block">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
            style={{ backgroundColor: `${cardColor}18` }}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{name}</p>
            {nameDE && (
              <p className="text-[11px] text-muted-foreground truncate">
                {nameDE}
              </p>
            )}
          </div>
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: cardColor }}
          />
        </div>

        {/* Spending summary */}
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            {expenseCents > 0 || incomeCents > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  {expenseCents > 0 && (
                    <p className="text-lg font-bold font-mono-nums text-[var(--color-expense)]">
                      {formatCurrency(expenseCents)}
                    </p>
                  )}
                  {incomeCents > 0 && (
                    <p className={`font-bold font-mono-nums text-[var(--color-income)] ${expenseCents > 0 ? "text-sm" : "text-lg"}`}>
                      +{formatCurrency(incomeCents)}
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {transactionCount} tx {periodLabel}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No activity {periodLabel}</p>
            )}
          </div>
          {monthlyData.length > 0 && (
            <SparkBarChart
              data={monthlyData}
              categories={["amount"]}
              index="month"
              colors={[cardColor]}
              className="h-8 w-20"
            />
          )}
        </div>

        {children.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
            {children.map((child) => (
              <Badge
                key={child.id}
                variant="secondary"
                className="text-[11px] rounded-lg border-0 bg-muted/40"
              >
                {child.icon} {child.name}
              </Badge>
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}
