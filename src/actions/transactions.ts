"use server";

import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, desc, sql, like, ne, or } from "drizzle-orm";
import { learnFromCorrection } from "@/lib/categorize/learn";
import { normalizeMerchant } from "@/lib/utils";

export async function getTransactions(
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
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
 * Count how many other transactions match a given transaction
 * by counterpartyName or normalized description.
 */
export async function countMatchingTransactions(
  userId: string,
  transactionId: string
): Promise<{ count: number; matchedBy: string }> {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    )
    .limit(1);

  if (!tx) return { count: 0, matchedBy: "" };

  const matchConditions = [];
  let matchedBy = "";

  if (tx.counterpartyName) {
    matchConditions.push(eq(transactions.counterpartyName, tx.counterpartyName));
    matchedBy = "counterparty";
  }

  const normalized = normalizeMerchant(tx.description);
  if (normalized && normalized.length >= 3) {
    matchConditions.push(like(transactions.description, `%${normalized}%`));
    if (!matchedBy) matchedBy = "description";
    else matchedBy = "counterparty & description";
  }

  if (matchConditions.length === 0) return { count: 0, matchedBy: "" };

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        ne(transactions.id, transactionId),
        or(...matchConditions)
      )
    );

  return { count: Number(result.count), matchedBy };
}

/**
 * Bulk-categorize a transaction and all matching ones (by counterparty or description).
 * Updates ALL matching transactions, including previously user-categorized ones.
 */
export async function bulkCategorizeByTransaction(
  userId: string,
  transactionId: string,
  categoryId: string
): Promise<{ updatedCount: number }> {
  // 1. Fetch the clicked transaction
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    )
    .limit(1);

  if (!tx) throw new Error("Transaction not found");

  // 2. Update the clicked transaction
  await db
    .update(transactions)
    .set({
      categoryId,
      categorySource: "user",
      categoryConfidence: 1.0,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  let updatedCount = 1;

  // 3. Find matching transactions (by counterpartyName or normalized description)
  const matchConditions = [];
  if (tx.counterpartyName) {
    matchConditions.push(eq(transactions.counterpartyName, tx.counterpartyName));
  }
  const normalized = normalizeMerchant(tx.description);
  if (normalized && normalized.length >= 3) {
    matchConditions.push(like(transactions.description, `%${normalized}%`));
  }

  if (matchConditions.length > 0) {
    const matching = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          ne(transactions.id, transactionId),
          or(...matchConditions)
        )
      );

    if (matching.length > 0) {
      const ids = matching.map((m) => m.id);
      for (const id of ids) {
        await db
          .update(transactions)
          .set({
            categoryId,
            categorySource: "user",
            categoryConfidence: 1.0,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, id));
      }
      updatedCount += ids.length;
    }
  }

  // 4. Learn from correction for future auto-categorization
  await learnFromCorrection(userId, tx.description, categoryId, tx.counterpartyIban);

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
