import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, isNull, asc } from "drizzle-orm";
import { normalizeMerchant } from "@/lib/utils";
import { nanoid } from "nanoid";
import { differenceInDays } from "date-fns";

const RECURRING_INTERVALS = [7, 14, 30, 60, 90, 365];
const TOLERANCE_DAYS = 3;

interface RecurringGroup {
  groupId: string;
  merchant: string;
  interval: number;
  transactionIds: string[];
  averageAmountCents: number;
  lastDate: Date;
}

/**
 * Detect recurring transactions by grouping by normalized merchant
 * and checking for regular intervals.
 */
export async function detectRecurring(
  userId: string
): Promise<RecurringGroup[]> {
  const allTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(asc(transactions.date));

  // Group by normalized merchant
  const merchantGroups = new Map<
    string,
    { id: string; date: Date; amountCents: number }[]
  >();

  for (const tx of allTx) {
    const merchant = normalizeMerchant(tx.description);
    if (!merchant || merchant.length < 3) continue;

    const group = merchantGroups.get(merchant) ?? [];
    group.push({ id: tx.id, date: tx.date, amountCents: tx.amountCents });
    merchantGroups.set(merchant, group);
  }

  const recurringGroups: RecurringGroup[] = [];

  for (const [merchant, txs] of merchantGroups) {
    if (txs.length < 3) continue;

    // Calculate intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < txs.length; i++) {
      intervals.push(differenceInDays(txs[i].date, txs[i - 1].date));
    }

    // Find median interval
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Check if median is close to a known recurring interval
    const matchedInterval = RECURRING_INTERVALS.find(
      (ri) => Math.abs(median - ri) <= TOLERANCE_DAYS
    );

    if (matchedInterval) {
      const groupId = nanoid();
      const avgAmount =
        txs.reduce((sum, t) => sum + t.amountCents, 0) / txs.length;

      recurringGroups.push({
        groupId,
        merchant,
        interval: matchedInterval,
        transactionIds: txs.map((t) => t.id),
        averageAmountCents: Math.round(avgAmount),
        lastDate: txs[txs.length - 1].date,
      });
    }
  }

  return recurringGroups;
}
