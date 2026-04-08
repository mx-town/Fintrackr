"use server";

import { db } from "@/lib/db";
import { categoryTargets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { computeBudgetScore, type BudgetScore, type TierSpending, type CategorySpendingHistory } from "@/lib/budget-plan/scoring";
import { TIER_TARGETS } from "@/lib/budget-plan/tiers";

export interface CategoryTargetInput {
  categoryId: string;
  amountCents: number;
}

export async function saveCategoryTargets(
  userId: string,
  targets: CategoryTargetInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const target of targets) {
      await db
        .delete(categoryTargets)
        .where(
          and(
            eq(categoryTargets.userId, userId),
            eq(categoryTargets.categoryId, target.categoryId)
          )
        );

      await db.insert(categoryTargets).values({
        id: nanoid(),
        userId,
        categoryId: target.categoryId,
        amountCents: target.amountCents,
        period: "monthly",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    revalidatePath("/budget-plan");
    revalidatePath("/budget-plan/optimizer");
    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to save targets" };
  }
}

export async function getCategoryTargets(
  userId: string
): Promise<Map<string, number>> {
  const targets = await db
    .select()
    .from(categoryTargets)
    .where(eq(categoryTargets.userId, userId));

  return new Map(targets.map((t) => [t.categoryId, t.amountCents]));
}

export async function simulateBudget(
  incomeCents: number,
  adjustments: { categoryId: string; amountCents: number; tier: "needs" | "wants" | "savings"; targetCents: number | null }[]
): Promise<BudgetScore> {
  const tierTotals: Record<"needs" | "wants" | "savings", number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };

  for (const adj of adjustments) {
    tierTotals[adj.tier] += adj.amountCents;
  }

  const tierSpending: TierSpending[] = [
    { tier: "needs", amountCents: tierTotals.needs },
    { tier: "wants", amountCents: tierTotals.wants },
    { tier: "savings", amountCents: tierTotals.savings },
  ];

  const tierHistories: Record<"needs" | "wants" | "savings", CategorySpendingHistory[]> = {
    needs: [],
    wants: [],
    savings: [],
  };

  for (const adj of adjustments) {
    tierHistories[adj.tier].push({
      categoryId: adj.categoryId,
      tier: adj.tier,
      currentAmountCents: adj.amountCents,
      avg3MonthCents: 0,
      targetCents: adj.targetCents,
    });
  }

  const tierAvg3MonthCents: Record<"needs" | "wants" | "savings", number> = {
    needs: tierTotals.needs,
    wants: tierTotals.wants,
    savings: tierTotals.savings,
  };

  return computeBudgetScore(incomeCents, tierSpending, tierHistories, tierAvg3MonthCents);
}
