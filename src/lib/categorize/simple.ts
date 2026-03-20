/**
 * Simple in-memory categorization without DB.
 * Uses merchant lookup + keyword matching.
 */

import { lookupMerchant } from "./merchants";
import { matchKeywords } from "./keywords";

export function categorizeInMemory(
  description: string,
  type: "income" | "expense" | "transfer"
): string | null {
  // Income transactions default to income category
  if (type === "income") {
    return "cat_income";
  }

  // Try merchant lookup first
  const merchant = lookupMerchant(description);
  if (merchant) return merchant;

  // Try keyword matching
  const keyword = matchKeywords(description);
  if (keyword) return keyword.categoryId;

  return null;
}
