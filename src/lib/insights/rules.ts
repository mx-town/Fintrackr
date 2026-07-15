import { formatCurrency } from "@/lib/utils";

export interface CategoryPeriodTotal {
  key: string;
  name: string;
  currentCents: number;
  previousCents: number;
}

export interface TxSummary {
  description: string;
  counterpartyName: string | null;
  amountCents: number;
  categoryKey: string;
}

export type InsightKind =
  | "increase"
  | "decrease"
  | "new-category"
  | "unusual-expense"
  | "new-counterparty";

export interface Insight {
  kind: InsightKind;
  headline: string;
  detail: string;
  score: number;
}

export const MIN_DELTA_CENTS = 2500;
export const MIN_PERCENT = 20;
export const UNUSUAL_FACTOR = 3;
export const MAX_INSIGHTS = 5;

/** Biggest category increases/decreases vs. the previous period. */
export function categoryMovers(totals: CategoryPeriodTotal[]): Insight[] {
  const out: Insight[] = [];
  for (const t of totals) {
    const delta = t.currentCents - t.previousCents;
    if (Math.abs(delta) < MIN_DELTA_CENTS) continue;

    if (t.previousCents === 0) {
      out.push({
        kind: "new-category",
        headline: `${t.name} is new this period`,
        detail: `${formatCurrency(t.currentCents)} spent — nothing in the previous period`,
        score: t.currentCents,
      });
      continue;
    }

    const pct = (delta / t.previousCents) * 100;
    // For increases, require both the absolute threshold AND the % threshold.
    // For decreases, the absolute threshold alone is sufficient.
    if (delta > 0 && Math.abs(pct) < MIN_PERCENT) continue;

    out.push({
      kind: delta > 0 ? "increase" : "decrease",
      headline:
        delta > 0
          ? `${t.name} rose sharply vs. the previous period`
          : `${t.name} came down vs. the previous period`,
      detail: `${pct > 0 ? "+" : "−"}${Math.abs(Math.round(pct))} % · ${
        delta > 0 ? "+" : "−"
      }${formatCurrency(Math.abs(delta))}`,
      score: Math.abs(delta),
    });
  }
  return out;
}

/** Single expenses far above their category's typical size. */
export function unusualExpenses(
  current: TxSummary[],
  categoryMedianCents: Map<string, number>
): Insight[] {
  const out: Insight[] = [];
  for (const tx of current) {
    const median = categoryMedianCents.get(tx.categoryKey);
    if (!median || median <= 0) continue;
    if (tx.amountCents < MIN_DELTA_CENTS) continue;
    if (tx.amountCents <= median * UNUSUAL_FACTOR) continue;
    const label = tx.counterpartyName ?? tx.description;
    out.push({
      kind: "unusual-expense",
      headline: `Unusually large: ${formatCurrency(tx.amountCents)} at ${label}`,
      detail: `${(tx.amountCents / median).toFixed(1)}× the typical amount in this category`,
      score: tx.amountCents,
    });
  }
  return out;
}

/** Counterparties that did not appear in the previous period. */
export function newCounterparties(
  current: TxSummary[],
  previousNames: Set<string>
): Insight[] {
  const totals = new Map<string, { cents: number; count: number }>();
  for (const tx of current) {
    if (!tx.counterpartyName || previousNames.has(tx.counterpartyName)) continue;
    const e = totals.get(tx.counterpartyName) ?? { cents: 0, count: 0 };
    e.cents += tx.amountCents;
    e.count += 1;
    totals.set(tx.counterpartyName, e);
  }
  const out: Insight[] = [];
  for (const [name, { cents, count }] of totals) {
    if (cents < MIN_DELTA_CENTS) continue;
    out.push({
      kind: "new-counterparty",
      headline: `New counterparty: ${name}`,
      detail: `${count} payment${count === 1 ? "" : "s"} · ${formatCurrency(cents)} total`,
      score: cents,
    });
  }
  return out;
}

/** Top insights by significance. */
export function selectInsights(all: Insight[], max = MAX_INSIGHTS): Insight[] {
  return [...all].sort((a, b) => b.score - a.score).slice(0, max);
}
