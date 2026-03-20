"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createCategory, updateCategory } from "@/actions/categories";
import { CategoryCard } from "@/components/categories/category-card";
import { CategoryDialog } from "@/components/categories/category-dialog";

type PeriodKey = "month" | "3m" | "ytd" | "year";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: "Month",
  "3m": "3M",
  ytd: "YTD",
  year: "Year",
};

const PERIOD_DESCRIPTIONS: Record<PeriodKey, string> = {
  month: "this month",
  "3m": "last 3 months",
  ytd: "year to date",
  year: "last 12 months",
};

interface CategoryItem {
  id: string;
  name: string;
  nameDE: string | null;
  icon: string | null;
  color: string | null;
  monthlyData: { month: string; amount: number }[];
  periodSpending: Record<PeriodKey, { expense: number; income: number; count: number }>;
  children: { id: string; name: string; icon: string | null }[];
}

export function CategoriesGrid({ items }: { items: CategoryItem[] }) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCreate(data: { name: string; nameDE: string; icon: string; color: string }) {
    startTransition(async () => {
      try {
        await createCategory("local", {
          name: data.name,
          nameDE: data.nameDE || undefined,
          icon: data.icon,
          color: data.color,
        });
        toast.success(`Category "${data.name}" created`);
        router.refresh();
      } catch {
        toast.error("Failed to create category");
      }
    });
  }

  function handleEdit(catId: string, data: { name: string; nameDE: string; icon: string; color: string }) {
    startTransition(async () => {
      try {
        await updateCategory("local", catId, {
          name: data.name,
          nameDE: data.nameDE || undefined,
          icon: data.icon,
          color: data.color,
        });
        toast.success("Category updated");
        router.refresh();
      } catch {
        toast.error("Failed to update category");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header row: Add button + period toggle */}
      <div className="flex items-center justify-between">
        <CategoryDialog
          mode="create"
          onSubmit={handleCreate}
          trigger={
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Category
            </Button>
          }
        />

        <div className="flex items-center rounded-lg bg-muted/50 p-0.5">
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                period === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PERIOD_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
        {items.map((cat) => {
          const spending = cat.periodSpending[period];
          return (
            <CategoryCard
              key={cat.id}
              id={cat.id}
              name={cat.name}
              nameDE={cat.nameDE}
              icon={cat.icon}
              color={cat.color}
              expenseCents={spending.expense}
              incomeCents={spending.income}
              transactionCount={spending.count}
              period={period}
              periodLabel={PERIOD_DESCRIPTIONS[period]}
              monthlyData={cat.monthlyData}
              children={cat.children}
              onEdit={(data) => handleEdit(cat.id, data)}
            />
          );
        })}
      </div>
    </div>
  );
}
