import { EmptyState } from "@/components/shared/empty-state";
import { BudgetList } from "@/components/budgets/budget-list";
import { getBudgets } from "@/actions/budgets";
import { getCategories } from "@/actions/categories";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { PiggyBank } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  await ensureDb();

  const [budgets, categories] = await Promise.all([
    getBudgets(DEFAULT_USER_ID),
    getCategories(DEFAULT_USER_ID),
  ]);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Budgets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set spending limits and track your progress.
        </p>
      </div>

      {budgets.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={<PiggyBank className="h-8 w-8 text-muted-foreground" />}
            title="No budgets yet"
            description="Create your first budget to start tracking spending limits per category."
          />
          {/* Still show the create button via BudgetList even when empty */}
          <BudgetList
            budgets={[]}
            categories={categories}
            userId={DEFAULT_USER_ID}
          />
        </div>
      ) : (
        <BudgetList
          budgets={budgets}
          categories={categories}
          userId={DEFAULT_USER_ID}
        />
      )}
    </div>
  );
}
