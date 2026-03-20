import { db } from "@/lib/db";
import { categorizationRules, transactions as txTable, categories } from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { lookupMerchant } from "./merchants";
import { matchKeywords } from "./keywords";
import { categorizeWithLLM } from "./llm";
import { normalizeMerchant } from "@/lib/utils";

interface TransactionInput {
  id: string;
  description: string;
  rawDescription?: string;
  amountCents: number;
  type: "income" | "expense" | "transfer";
  counterpartyName?: string;
  counterpartyIban?: string;
}

interface CategorizationResult {
  id: string;
  categoryId: string;
  confidence: number;
  source: "user" | "rule" | "keyword" | "ai";
}

/**
 * Build user context string from past categorized transactions.
 * Returns top 30 merchant -> category patterns from user/rule sources.
 */
async function buildUserContext(userId: string): Promise<string | undefined> {
  const patterns = await db
    .select({
      counterpartyName: txTable.counterpartyName,
      description: txTable.description,
      categoryName: categories.name,
      categoryId: txTable.categoryId,
    })
    .from(txTable)
    .innerJoin(categories, eq(txTable.categoryId, categories.id))
    .where(
      and(
        eq(txTable.userId, userId),
        isNull(txTable.deletedAt),
        inArray(txTable.categorySource, ["user", "rule"])
      )
    )
    .groupBy(txTable.counterpartyName, txTable.categoryId)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(30);

  if (patterns.length === 0) return undefined;

  return patterns
    .map((p) => {
      const name = p.counterpartyName || p.description.slice(0, 40);
      return `"${name}" -> ${p.categoryId} (${p.categoryName})`;
    })
    .join("\n");
}

/**
 * Three-tier categorization pipeline.
 * Processes transactions in order: User Rules -> Merchant -> Keywords -> LLM
 */
export async function categorizeTransactions(
  transactions: TransactionInput[],
  userId: string
): Promise<CategorizationResult[]> {
  const results: CategorizationResult[] = [];
  const uncategorized: TransactionInput[] = [];

  // Load user's custom rules
  const userRules = await db
    .select()
    .from(categorizationRules)
    .where(eq(categorizationRules.userId, userId))
    .orderBy(categorizationRules.priority);

  for (const tx of transactions) {
    const desc = tx.rawDescription || tx.description;

    // --- Tier 0: User-specific rules ---
    let matched = false;
    for (const rule of userRules) {
      const value =
        rule.matchField === "iban" ? tx.counterpartyIban || "" : desc;

      const isMatch =
        rule.matchType === "exact"
          ? value.toLowerCase() === rule.matchValue.toLowerCase()
          : rule.matchType === "contains"
            ? value.toLowerCase().includes(rule.matchValue.toLowerCase())
            : rule.matchType === "starts_with"
              ? value
                  .toLowerCase()
                  .startsWith(rule.matchValue.toLowerCase())
              : rule.matchType === "regex"
                ? new RegExp(rule.matchValue, "i").test(value)
                : false;

      if (isMatch) {
        results.push({
          id: tx.id,
          categoryId: rule.categoryId,
          confidence: 1.0,
          source: "user",
        });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // --- Tier 1: Global merchant lookup ---
    const merchantCat = lookupMerchant(desc);
    if (merchantCat) {
      results.push({
        id: tx.id,
        categoryId: merchantCat,
        confidence: 0.95,
        source: "rule",
      });
      continue;
    }

    // --- Tier 2: Keyword/regex patterns ---
    const keywordResult = matchKeywords(desc);
    if (keywordResult) {
      results.push({
        id: tx.id,
        categoryId: keywordResult.categoryId,
        confidence: keywordResult.confidence,
        source: "keyword",
      });
      continue;
    }

    // --- Tier 3: Queue for LLM ---
    uncategorized.push(tx);
  }

  // Batch LLM categorization for remaining
  if (uncategorized.length > 0) {
    // Build user context from past categorizations
    const userContext = await buildUserContext(userId);

    for (let i = 0; i < uncategorized.length; i += 50) {
      const batch = uncategorized.slice(i, i + 50);
      const llmResults = await categorizeWithLLM(batch, userContext);
      for (const r of llmResults) {
        results.push({
          id: r.id,
          categoryId: r.categoryId,
          confidence: r.confidence,
          source: "ai",
        });
      }
    }
  }

  return results;
}
