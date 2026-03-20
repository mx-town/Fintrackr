import { parseEurAmount, parseEurDate, transactionHash } from "@/lib/utils";
import type { ParsedTransaction } from "./types";

/**
 * Determine transaction type from signed amount.
 * Austrian banks typically use:
 *   positive = income/credit
 *   negative = expense/debit
 */
export function classifyAmount(rawAmount: string): {
  amountCents: number;
  type: "income" | "expense";
} {
  const cents = parseEurAmount(rawAmount);
  return {
    amountCents: Math.abs(cents),
    type: cents >= 0 ? "income" : "expense",
  };
}

/**
 * Clean up description text from bank exports.
 */
export function cleanDescription(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Build a ParsedTransaction from raw fields.
 */
export function buildTransaction(fields: {
  date: string;
  valueDate?: string;
  description: string;
  amount: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  bankReference?: string;
  currency?: string;
}): ParsedTransaction {
  const { amountCents, type } = classifyAmount(fields.amount);
  const date = parseEurDate(fields.date);
  const description = cleanDescription(fields.description);

  return {
    date,
    valueDate: fields.valueDate ? parseEurDate(fields.valueDate) : undefined,
    description,
    rawDescription: fields.description,
    amountCents,
    type,
    currency: fields.currency ?? "EUR",
    counterpartyName: fields.counterpartyName?.trim(),
    counterpartyIban: fields.counterpartyIban?.trim(),
    bankReference: fields.bankReference?.trim(),
    hash: transactionHash(date, amountCents, description),
  };
}
