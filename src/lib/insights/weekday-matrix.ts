import { addDays, format, isSameYear, startOfDay } from "date-fns";

export interface TxLike {
  date: Date;
  amountCents: number;
}

export interface HeatmapSeries {
  id: string;
  data: { x: string; y: number }[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Monday = 0 … Sunday = 6 */
const dow = (d: Date) => (d.getDay() + 6) % 7;

/**
 * Average expense per weekday occurrence, per month, for the given range.
 * Averaging by occurrence keeps partial months honest.
 */
export function buildWeekdayMatrix(
  txs: TxLike[],
  start: Date,
  end: Date
): HeatmapSeries[] {
  if (txs.length === 0) return [];

  const monthLabel = (d: Date) =>
    isSameYear(start, end) ? format(d, "MMM") : format(d, "MMM yy");

  // Count weekday occurrences per month within the range.
  const monthOrder: string[] = [];
  const occurrences = new Map<string, number>(); // `${month}|${dow}`
  for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
    const m = monthLabel(d);
    if (!monthOrder.includes(m)) monthOrder.push(m);
    const key = `${m}|${dow(d)}`;
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }

  // Sum spending per month × weekday.
  const sums = new Map<string, number>();
  for (const tx of txs) {
    const key = `${monthLabel(tx.date)}|${dow(tx.date)}`;
    sums.set(key, (sums.get(key) ?? 0) + tx.amountCents);
  }

  return DAY_LABELS.map((label, di) => ({
    id: label,
    data: monthOrder.map((m) => {
      const key = `${m}|${di}`;
      const n = occurrences.get(key) ?? 0;
      const avgCents = n > 0 ? (sums.get(key) ?? 0) / n : 0;
      return { x: m, y: Math.round(avgCents) / 100 };
    }),
  }));
}

/**
 * Most/least expensive weekday averaged across all months (euros).
 * Only considers days with actual spending.
 */
export function weekdayTakeaway(
  rows: HeatmapSeries[]
): { most: { day: string; avg: number }; least: { day: string; avg: number } } | null {
  if (rows.length === 0) return null;
  const avgs = rows
    .map((r) => ({
      day: r.id,
      avg: r.data.reduce((s, d) => s + d.y, 0) / Math.max(r.data.length, 1),
    }))
    .filter((r) => r.avg > 0);
  if (avgs.length === 0) return null;
  const most = avgs.reduce((a, b) => (b.avg > a.avg ? b : a));
  const least = avgs.reduce((a, b) => (b.avg < a.avg ? b : a));
  return { most, least };
}
