"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { createBudget, updateBudget } from "@/actions/budgets";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface BudgetWithSpending {
  id: string;
  name: string;
  categoryId: string | null;
  amountCents: number;
  period: string;
  currency: string;
  alertThreshold: number | null;
  isActive: boolean;
  spentCents: number;
  percentUsed: number;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export function BudgetList({
  budgets,
  categories,
  userId,
}: {
  budgets: BudgetWithSpending[];
  categories: Category[];
  userId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDeactivate(budgetId: string) {
    startTransition(async () => {
      await updateBudget(userId, budgetId, { isActive: false });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {budgets.length} active budget{budgets.length !== 1 ? "s" : ""}
        </p>
        <CreateBudgetDialog categories={categories} userId={userId} />
      </div>

      {/* Budget cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const percent = Math.min(budget.percentUsed, 100);
          const isOver = budget.percentUsed > 100;
          const isWarning =
            budget.percentUsed >= (budget.alertThreshold ?? 80) * 100 &&
            !isOver;
          const remaining = budget.amountCents - budget.spentCents;
          const cat = categories.find((c) => c.id === budget.categoryId);

          return (
            <div
              key={budget.id}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 transition-all hover:border-border/80"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  {cat && (
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                      style={{
                        backgroundColor: cat.color
                          ? `${cat.color}15`
                          : "oklch(0.2 0.008 270)",
                      }}
                    >
                      {cat.icon ?? "📦"}
                    </span>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold">{budget.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {budget.period}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeactivate(budget.id)}
                  className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  title="Remove budget"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Progress */}
              <div className="mt-4 space-y-2">
                <Progress
                  value={percent}
                  className={
                    isOver
                      ? "[&>div]:bg-[var(--color-expense)]"
                      : isWarning
                        ? "[&>div]:bg-[var(--color-warning)]"
                        : "[&>div]:bg-[var(--color-income)]"
                  }
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono-nums text-muted-foreground">
                    {formatCurrency(budget.spentCents, budget.currency)} /{" "}
                    {formatCurrency(budget.amountCents, budget.currency)}
                  </span>
                  <span className="font-mono-nums font-semibold">
                    {Math.round(budget.percentUsed)}%
                  </span>
                </div>
              </div>

              {/* Status line */}
              {isOver ? (
                <p className="mt-2 text-xs text-[var(--color-expense)]">
                  Over budget by{" "}
                  {formatCurrency(
                    Math.abs(remaining),
                    budget.currency
                  )}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatCurrency(remaining, budget.currency)} remaining
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreateBudgetDialog({
  categories,
  userId,
}: {
  categories: Category[];
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<string>("monthly");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name || !categoryId || !amount) return;

    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;

    startTransition(async () => {
      await createBudget(userId, {
        name,
        categoryId,
        amountCents,
        period: period as "weekly" | "monthly" | "quarterly" | "yearly",
      });
      setOpen(false);
      setName("");
      setCategoryId("");
      setAmount("");
      setPeriod("monthly");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Budget
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Budget</DialogTitle>
          <DialogDescription>
            Set a spending limit for a category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="budget-name">Name</Label>
            <Input
              id="budget-name"
              placeholder="e.g. Groceries Budget"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-amount">Amount (EUR)</Label>
            <Input
              id="budget-amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="500.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v ?? "monthly")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={<Button variant="outline">Cancel</Button>}
          />
          <Button onClick={handleCreate} disabled={isPending || !name || !categoryId || !amount}>
            {isPending ? "Creating..." : "Create Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
