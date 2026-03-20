"use server";

import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schema";
import { eq, and, or, isNull, lte } from "drizzle-orm";
import { categorizeTransactions } from "@/lib/categorize/engine";

export async function getCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(
      or(eq(categories.userId, userId), isNull(categories.userId))
    )
    .orderBy(categories.sortOrder);
}

export async function createCategory(
  userId: string,
  data: {
    name: string;
    nameDE?: string;
    icon?: string;
    color?: string;
    parentId?: string;
  }
) {
  const [result] = await db
    .insert(categories)
    .values({
      userId,
      ...data,
    })
    .returning();
  return result;
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  data: {
    name?: string;
    nameDE?: string;
    icon?: string;
    color?: string;
    isHidden?: boolean;
  }
) {
  await db
    .update(categories)
    .set(data)
    .where(
      and(
        eq(categories.id, categoryId),
        or(eq(categories.userId, userId), isNull(categories.userId))
      )
    );
}

/**
 * Re-run categorization on uncategorized transactions and low-confidence cat_other.
 * Returns the number of transactions that were (re)categorized.
 */
export async function recategorizeTransactions(
  userId: string
): Promise<{ updated: number; total: number }> {
  // Fetch uncategorized (null categoryId) + low-confidence cat_other
  const uncategorized = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        or(
          isNull(transactions.categoryId),
          and(
            eq(transactions.categoryId, "cat_other"),
            lte(transactions.categoryConfidence, 0.3)
          )
        )
      )
    );

  if (uncategorized.length === 0) {
    return { updated: 0, total: 0 };
  }

  const toCateg = uncategorized.map((tx) => ({
    id: tx.id,
    description: tx.description,
    rawDescription: tx.rawDescription ?? undefined,
    amountCents: tx.amountCents,
    type: tx.type as "income" | "expense" | "transfer",
    counterpartyName: tx.counterpartyName ?? undefined,
    counterpartyIban: tx.counterpartyIban ?? undefined,
  }));

  const results = await categorizeTransactions(toCateg, userId);

  let updated = 0;
  for (const cat of results) {
    // Only update if we got a real category (not cat_other with 0.0)
    if (cat.categoryId !== "cat_other" || cat.confidence > 0.3) {
      await db
        .update(transactions)
        .set({
          categoryId: cat.categoryId,
          categorySource: cat.source,
          categoryConfidence: cat.confidence,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, cat.id));
      updated++;
    }
  }

  return { updated, total: uncategorized.length };
}
