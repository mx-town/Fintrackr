"use server";

import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { BudgetTier } from "@/lib/budget-plan/tiers";

const VALID_TIERS: BudgetTier[] = ["needs", "wants", "savings"];

export async function updateCategoryTier(
  userId: string,
  categoryId: string,
  tier: BudgetTier
): Promise<{ success: boolean; error?: string }> {
  if (!VALID_TIERS.includes(tier)) {
    return { success: false, error: "Invalid tier" };
  }

  await db
    .update(categories)
    .set({ budgetTier: tier })
    .where(
      and(eq(categories.id, categoryId), eq(categories.userId, userId))
    );

  revalidatePath("/budget-plan");

  return { success: true };
}
