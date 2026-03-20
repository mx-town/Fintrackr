import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format cents to EUR display string.
 * 1999 → "€19,99" (Austrian locale)
 */
export function formatCurrency(
  amountInCents: number,
  currency: string = "EUR",
  locale: string = "de-AT"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountInCents / 100);
}

/**
 * Format cents to signed display: +€500,00 or -€23,50
 */
export function formatSignedCurrency(
  amountInCents: number,
  type: "income" | "expense" | "transfer",
  currency: string = "EUR"
): string {
  const prefix = type === "income" ? "+" : type === "expense" ? "-" : "";
  return `${prefix}${formatCurrency(Math.abs(amountInCents), currency)}`;
}

/**
 * Parse European number format: "1.234,56" → 123456 (cents)
 */
export function parseEurAmount(raw: string): number {
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const euros = parseFloat(cleaned);
  if (isNaN(euros)) throw new Error(`Cannot parse amount: "${raw}"`);
  return Math.round(euros * 100);
}

/**
 * Parse European date: "DD.MM.YYYY" → Date
 */
export function parseEurDate(raw: string): Date {
  const [day, month, year] = raw.split(".").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Normalize merchant name for matching:
 * "BILLA DANKT  1234 WIEN" → "billa"
 */
export function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-zäöüß\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join(" ")
    .trim();
}

/**
 * Generate a deterministic hash for deduplication.
 * Based on: date + amount + description truncated
 */
export function transactionHash(
  date: Date,
  amountCents: number,
  description: string
): string {
  const raw = `${date.toISOString().slice(0, 10)}|${amountCents}|${description.slice(0, 50).toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
