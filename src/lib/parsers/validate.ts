import type { ParsedTransaction } from "./types";

/**
 * Remove duplicate transactions by hash.
 * Also deduplicates against existing DB hashes.
 */
export function deduplicateTransactions(
  incoming: ParsedTransaction[],
  existingHashes: Set<string>
): {
  unique: ParsedTransaction[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  const unique: ParsedTransaction[] = [];
  let duplicateCount = 0;

  for (const tx of incoming) {
    if (existingHashes.has(tx.hash) || seen.has(tx.hash)) {
      duplicateCount++;
      continue;
    }
    seen.add(tx.hash);
    unique.push(tx);
  }

  return { unique, duplicateCount };
}

/**
 * Validate parsed statement with balance check.
 */
export function validateBalance(
  transactions: ParsedTransaction[],
  openingBalanceCents?: number,
  closingBalanceCents?: number
): string | null {
  if (openingBalanceCents == null || closingBalanceCents == null) return null;

  const sum = transactions.reduce((acc, tx) => {
    return acc + (tx.type === "income" ? tx.amountCents : -tx.amountCents);
  }, 0);

  const expected = openingBalanceCents + sum;
  if (expected !== closingBalanceCents) {
    const diff = Math.abs(expected - closingBalanceCents);
    return `Balance mismatch: expected ${closingBalanceCents} cents, computed ${expected} cents (diff: ${diff} cents). Some transactions may not have been parsed correctly.`;
  }

  return null;
}
