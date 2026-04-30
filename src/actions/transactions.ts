"use server";

import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, desc, sql, like, ne, or, inArray } from "drizzle-orm";
import { learnFromCorrection } from "@/lib/categorize/learn";
import { normalizeMerchant } from "@/lib/utils";

export async function getTransactions(
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    categoryIds?: string[];
    type?: "income" | "expense" | "transfer";
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const conditions = [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
  ];

  if (options.startDate) conditions.push(gte(transactions.date, options.startDate));
  if (options.endDate) conditions.push(lte(transactions.date, options.endDate));
  if (options.categoryId) conditions.push(eq(transactions.categoryId, options.categoryId));
  if (options.categoryIds && options.categoryIds.length > 0) conditions.push(inArray(transactions.categoryId, options.categoryIds));
  if (options.type) conditions.push(eq(transactions.type, options.type));
  if (options.search) conditions.push(like(transactions.description, `%${options.search}%`));

  const results = await db
    .select({
      transaction: transactions,
      category: categories,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);

  return results;
}

export async function updateTransactionCategory(
  userId: string,
  transactionId: string,
  categoryId: string
) {
  // Get the transaction first to learn from the correction
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    )
    .limit(1);

  if (!tx) throw new Error("Transaction not found");

  // Update the transaction
  await db
    .update(transactions)
    .set({
      categoryId,
      categorySource: "user",
      categoryConfidence: 1.0,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  // Learn from the correction (pass IBAN for exact-match rule creation)
  await learnFromCorrection(userId, tx.description, categoryId, tx.counterpartyIban);
}

/**
 * Get transactions that need user review.
 * Includes uncategorized transactions (NULL categoryId) and
 * AI/keyword-categorized transactions with confidence <= 0.6.
 * Uncategorized transactions sort first (highest priority).
 */
export async function getTransactionsForReview(userId: string) {
  return db
    .select({
      transaction: transactions,
      category: categories,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        or(
          isNull(transactions.categoryId),
          and(
            lte(transactions.categoryConfidence, 0.6),
            or(
              eq(transactions.categorySource, "ai"),
              eq(transactions.categorySource, "keyword")
            )
          )
        )
      )
    )
    .orderBy(
      sql`CASE WHEN ${transactions.categoryId} IS NULL THEN 0 ELSE 1 END`,
      transactions.categoryConfidence,
      desc(transactions.date)
    )
    .limit(50);
}

/**
 * Get all transactions matching a given transaction's counterpartyName or description.
 * Returns full transaction rows with category info for the preview dialog.
 */
export async function getMatchingTransactions(
  userId: string,
  transactionId: string
): Promise<{
  matches: {
    transaction: typeof transactions.$inferSelect;
    category: typeof categories.$inferSelect | null;
  }[];
  matchedBy: string;
}> {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    )
    .limit(1);

  if (!tx) return { matches: [], matchedBy: "" };

  // Prefer counterparty equality when available — it's the exact merchant
  // string the parser captured and is far more reliable than a substring
  // match against the raw description. Description-substring matching is
  // reserved for rows that lack any counterparty data, where it's the
  // only signal we have.
  let matchCondition;
  let matchedBy = "";

  if (tx.counterpartyName) {
    matchCondition = eq(transactions.counterpartyName, tx.counterpartyName);
    matchedBy = "counterparty";
  } else {
    const normalized = normalizeMerchant(tx.description);
    if (normalized.length >= 4) {
      matchCondition = like(transactions.description, `%${normalized}%`);
      matchedBy = "description";
    }
  }

  if (!matchCondition) return { matches: [], matchedBy: "" };

  const results = await db
    .select({
      transaction: transactions,
      category: categories,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        ne(transactions.id, transactionId),
        matchCondition
      )
    )
    .orderBy(desc(transactions.date))
    .limit(500);

  return { matches: results, matchedBy };
}

/**
 * Apply a category to the source transaction and selected matching transactions.
 * Optionally creates a categorization rule via learnFromCorrection.
 */
export async function applyCategoryToSelected(
  userId: string,
  sourceTransactionId: string,
  selectedTransactionIds: string[],
  categoryId: string,
  createRule: boolean
): Promise<{ updatedCount: number }> {
  // 1. Fetch source transaction
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, sourceTransactionId),
        eq(transactions.userId, userId)
      )
    )
    .limit(1);

  if (!tx) throw new Error("Transaction not found");

  // 2. Update source transaction
  await db
    .update(transactions)
    .set({
      categoryId,
      categorySource: "user",
      categoryConfidence: 1.0,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, sourceTransactionId));

  let updatedCount = 1;

  // 3. Update selected matching transactions in a single statement
  if (selectedTransactionIds.length > 0) {
    await db
      .update(transactions)
      .set({
        categoryId,
        categorySource: "user",
        categoryConfidence: 1.0,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.id, selectedTransactionIds)
        )
      );
    updatedCount += selectedTransactionIds.length;
  }

  // 4. Learn from correction if creating a rule
  if (createRule) {
    await learnFromCorrection(userId, tx.description, categoryId, tx.counterpartyIban);
  }

  return { updatedCount };
}

export async function deleteTransaction(
  userId: string,
  transactionId: string
) {
  await db
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    );
}
