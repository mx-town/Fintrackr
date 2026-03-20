export type BudgetPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

export interface Budget {
  id: string;
  userId: string;
  categoryId: string | null;
  name: string;
  amountCents: number;
  period: BudgetPeriod;
  currency: string;
  isActive: boolean;
  alertThreshold: number | null;
}

export interface BudgetWithSpending extends Budget {
  spentCents: number;
  percentUsed: number;
}
