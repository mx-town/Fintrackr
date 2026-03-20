import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const FRANKFURTER_BASE = "https://api.frankfurter.dev";

/**
 * Get exchange rate for a specific date and currency pair.
 * Checks cache first, then fetches from Frankfurter API (ECB rates).
 */
export async function getExchangeRate(
  date: Date,
  from: string = "EUR",
  to: string
): Promise<number> {
  if (from === to) return 1;

  const dateStr = date.toISOString().slice(0, 10);

  // Check cache
  const cached = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.baseCurrency, from),
        eq(exchangeRates.targetCurrency, to)
      )
    )
    .limit(1);

  if (cached.length > 0) return cached[0].rate;

  // Fetch from Frankfurter API
  const url = `${FRANKFURTER_BASE}/${dateStr}?from=${from}&to=${to}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rate: ${response.statusText}`);
  }

  const data = await response.json();
  const rate = data.rates[to];

  if (!rate) {
    throw new Error(`No rate found for ${from}/${to} on ${dateStr}`);
  }

  // Cache the rate
  await db
    .insert(exchangeRates)
    .values({
      date,
      baseCurrency: from,
      targetCurrency: to,
      rate,
      source: "ecb",
    })
    .onConflictDoNothing();

  return rate;
}
