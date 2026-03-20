"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

interface BudgetData {
  id: string;
  name: string;
  amountCents: number;
  spentCents: number;
  percentUsed: number;
  currency: string;
}

export function BudgetProgress({ budgets }: { budgets: BudgetData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Budget Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgets.map((budget) => {
          const percent = Math.min(budget.percentUsed, 100);
          const isOver = budget.percentUsed > 100;
          const isWarning = budget.percentUsed >= 80;

          return (
            <div key={budget.id} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{budget.name}</span>
                <span className="font-mono-nums text-muted-foreground">
                  {formatCurrency(budget.spentCents, budget.currency)} /{" "}
                  {formatCurrency(budget.amountCents, budget.currency)}
                </span>
              </div>
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
              {isOver && (
                <p className="text-xs text-[var(--color-expense)]">
                  Over budget by{" "}
                  {formatCurrency(
                    budget.spentCents - budget.amountCents,
                    budget.currency
                  )}
                </p>
              )}
            </div>
          );
        })}
        {budgets.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            No budgets set. Create one to track your spending.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
