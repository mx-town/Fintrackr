import { db } from "@/lib/db";
import { categorizationRules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { normalizeMerchant } from "@/lib/utils";

/**
 * When a user re-categorizes a transaction, record the correction.
 * If the transaction has a counterpartyIban, create an exact IBAN rule (highest priority).
 * Also create/update a description-contains rule for fuzzy matching.
 */
export async function learnFromCorrection(
  userId: string,
  description: string,
  newCategoryId: string,
  counterpartyIban?: string | null
): Promise<void> {
  // --- IBAN-exact rule (highest priority, one correction = permanent fix) ---
  if (counterpartyIban && counterpartyIban.length >= 15) {
    const ibanNormalized = counterpartyIban.replace(/\s/g, "").toUpperCase();

    const existingIban = await db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.matchField, "iban"),
          eq(categorizationRules.matchValue, ibanNormalized),
          eq(categorizationRules.isAutoLearned, true)
        )
      )
      .limit(1);

    if (existingIban.length > 0) {
      await db
        .update(categorizationRules)
        .set({
          categoryId: newCategoryId,
          hitCount: (existingIban[0].hitCount ?? 0) + 1,
        })
        .where(eq(categorizationRules.id, existingIban[0].id));
    } else {
      await db.insert(categorizationRules).values({
        userId,
        categoryId: newCategoryId,
        matchType: "exact",
        matchValue: ibanNormalized,
        matchField: "iban",
        isAutoLearned: true,
        hitCount: 1,
        priority: 5,
      });
    }
  }

  // --- Description-contains rule (fuzzy fallback) ---
  const normalized = normalizeMerchant(description);
  if (!normalized || normalized.length < 3) return;

  const existing = await db
    .select()
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.userId, userId),
        eq(categorizationRules.matchValue, normalized),
        eq(categorizationRules.matchField, "description"),
        eq(categorizationRules.isAutoLearned, true)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const rule = existing[0];
    await db
      .update(categorizationRules)
      .set({
        categoryId: newCategoryId,
        hitCount: (rule.hitCount ?? 0) + 1,
      })
      .where(eq(categorizationRules.id, rule.id));
  } else {
    await db.insert(categorizationRules).values({
      userId,
      categoryId: newCategoryId,
      matchType: "contains",
      matchValue: normalized,
      matchField: "description",
      isAutoLearned: true,
      hitCount: 1,
      priority: 10,
    });
  }
}
