import type { BankParser, ParseResult, ParsedTransaction } from "../types";
import { transactionHash } from "@/lib/utils";

/**
 * George (Erste Bank / Sparkasse) JSON export parser.
 *
 * Format: JSON array of transaction objects
 * Amount: { value: -6000, precision: 2, currency: "EUR" } — already in cents, signed
 * Date: ISO 8601 with timezone: "2026-03-20T00:00:00.000+0100"
 *
 * Key fields used:
 * - booking: transaction date
 * - amount.value: signed amount in cents (negative = expense)
 * - amount.currency: always EUR
 * - partnerName: counterparty (82% populated)
 * - partnerAccount.iban: counterparty IBAN (95% populated)
 * - reference: payment details, POS merchant info, ATM info
 * - referenceNumber: bank's unique transaction ID
 * - ownerAccountNumber: your own IBAN
 */

// --- George JSON transaction shape (only fields that matter) ---
interface GeorgeTransaction {
  booking: string; // "2026-03-20T00:00:00.000+0100"
  partnerName: string | null;
  partnerAccount: {
    iban: string;
    bic: string;
    number: string;
    bankCode: string;
    countryCode: string;
  } | null;
  amount: {
    value: number; // cents, signed (-6000 = -€60.00)
    precision: number; // always 2
    currency: string; // always "EUR"
  };
  reference: string | null; // POS details, SEPA ref, ATM info
  referenceNumber: string | null; // bank's internal ID
  ownerAccountNumber: string | null; // your IBAN
  ownerAccountTitle: string | null; // "Giro account"
  cardNumber: string | null;
  cardBrand: string | null;
  cardLocation: string | null;
  merchantName: string | null;
  sepaMandateId: string | null;
  sepaCreditorId: string | null;
  note: string | null;
  categories: unknown;
  e2eReference: string | null;
}

// --- Merchant extraction from reference field ---

/**
 * POS reference pattern:
 * "POS 12,60 AT K1 19.03. 20:13 SHELL SIEGENDORF 2950 WIEN 1140 040"
 *
 * Groups: amount, country, card, date, time, merchant+location
 */
const POS_REGEX =
  /^POS\s+[\d,.]+\s+\w{2}\s+K\d\s+\d{2}\.\d{2}\.\s+\d{2}:\d{2}\s+(.+?)(?:\s+\d{3,4}\s*\d{3})?$/;

/**
 * Terminal/vending reference pattern:
 * "GMS GOURMET 2241 K1 20.03. 08:16"
 * "TURMOEL 317 2140 K1 19.03. 18:19"
 *
 * Extract everything before "K<digit>"
 */
const TERMINAL_REGEX = /^(.+?)\s+K\d\s+\d{2}\.\d{2}\.\s+\d{2}:\d{2}/;

/**
 * ATM withdrawal pattern:
 * "AUTOMAT 00025353 K1 28.02. 17:28"
 */
const ATM_REGEX = /^AUTOMAT\s+\d+\s+K\d/;

/**
 * Extract a human-readable merchant name from the reference field.
 * Used when partnerName is null (card/POS/ATM transactions).
 */
function extractMerchantFromReference(reference: string): string | null {
  if (!reference) return null;

  // ATM withdrawal
  if (ATM_REGEX.test(reference)) {
    return "ATM Withdrawal";
  }

  // POS transaction — merchant name after datetime
  const posMatch = reference.match(POS_REGEX);
  if (posMatch) {
    return posMatch[1]
      .replace(/\s+\d{4,}\s+\d{3}$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // Terminal/vending machine — everything before K<digit>
  const termMatch = reference.match(TERMINAL_REGEX);
  if (termMatch) {
    return termMatch[1]
      .replace(/\s+\d{3,}$/, "")
      .replace(/\s+\d{3,}$/, "") // second pass for "317 2140" style
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return null;
}

// --- Main parser ---

export const georgeJsonParser: BankParser = {
  bankId: "george-json",
  bankName: "Erste Bank (George JSON)",
  supportedFormats: ["json"],

  detect(content: string | Buffer, fileName: string): boolean {
    if (!fileName.toLowerCase().endsWith(".json")) return false;

    try {
      const text =
        typeof content === "string" ? content : content.toString("utf-8");
      const trimmed = text.trimStart();
      if (!trimmed.startsWith("[")) return false;

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) return false;

      const first = parsed[0];
      return (
        "booking" in first &&
        "amount" in first &&
        "partnerName" in first &&
        "ownerAccountNumber" in first &&
        typeof first.amount === "object" &&
        "value" in first.amount &&
        "precision" in first.amount
      );
    } catch {
      return false;
    }
  },

  async parse(content: string | Buffer): Promise<ParseResult> {
    const text =
      typeof content === "string" ? content : content.toString("utf-8");
    const warnings: string[] = [];
    const errors: string[] = [];

    let raw: GeorgeTransaction[];
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return {
        transactions: [],
        bankName: "george-json",
        format: "json",
        warnings: [],
        errors: [`Invalid JSON: ${(e as Error).message}`],
      };
    }

    if (!Array.isArray(raw) || raw.length === 0) {
      return {
        transactions: [],
        bankName: "george-json",
        format: "json",
        warnings: [],
        errors: ["JSON file is empty or not an array."],
      };
    }

    const transactions: ParsedTransaction[] = [];
    let accountIban: string | undefined;

    for (let i = 0; i < raw.length; i++) {
      const tx = raw[i];

      try {
        // --- Date ---
        const date = new Date(tx.booking);
        if (isNaN(date.getTime())) {
          warnings.push(`Row ${i}: Invalid date "${tx.booking}"`);
          continue;
        }

        // --- Amount (already in cents, signed) ---
        const rawValue = tx.amount.value;
        const amountCents = Math.abs(rawValue);
        const type = rawValue >= 0 ? "income" : "expense";
        const currency = tx.amount.currency || "EUR";

        // --- Description ---
        const merchantFromRef = tx.reference
          ? extractMerchantFromReference(tx.reference)
          : null;

        const description = buildDescription(tx, merchantFromRef);
        const rawDescription = [tx.partnerName, tx.reference]
          .filter(Boolean)
          .join(" | ");

        // --- Counterparty ---
        const counterpartyName =
          tx.partnerName || tx.merchantName || merchantFromRef || "Unknown";
        const counterpartyIban = tx.partnerAccount?.iban || undefined;

        // --- Account detection ---
        if (!accountIban && tx.ownerAccountNumber) {
          accountIban = tx.ownerAccountNumber;
        }

        // --- Hash for deduplication ---
        // Use referenceNumber (bank's unique ID) when available
        const hash = tx.referenceNumber
          ? hashString(tx.referenceNumber)
          : transactionHash(date, amountCents, description);

        transactions.push({
          date,
          description,
          rawDescription,
          amountCents,
          type,
          currency,
          counterpartyName: counterpartyName || undefined,
          counterpartyIban,
          bankReference: tx.referenceNumber || undefined,
          hash,
        });
      } catch (e) {
        warnings.push(`Row ${i}: ${(e as Error).message}`);
      }
    }

    // --- Period detection ---
    const dates = transactions.map((t) => t.date.getTime());
    const periodStart =
      dates.length > 0 ? new Date(Math.min(...dates)) : undefined;
    const periodEnd =
      dates.length > 0 ? new Date(Math.max(...dates)) : undefined;

    return {
      transactions,
      bankName: "george-json",
      format: "json",
      accountIban,
      periodStart,
      periodEnd,
      warnings,
      errors,
    };
  },
};

// --- Helpers ---

/**
 * Build a clean, human-readable description.
 * Priority: partnerName > extracted merchant > reference (truncated)
 */
function buildDescription(
  tx: GeorgeTransaction,
  merchantFromRef: string | null
): string {
  const parts: string[] = [];

  if (tx.partnerName) {
    parts.push(tx.partnerName);
  } else if (merchantFromRef) {
    parts.push(merchantFromRef);
  }

  if (tx.reference) {
    const ref = tx.reference.trim();
    const isDuplicate =
      tx.partnerName &&
      ref.toLowerCase().startsWith(tx.partnerName.toLowerCase());
    const isTechnical =
      merchantFromRef && (ref.startsWith("POS ") || ATM_REGEX.test(ref));

    if (!isDuplicate && !isTechnical && ref.length > 0) {
      const cleanRef = ref
        .replace(/^SEPA-Gutschrift\s*/i, "")
        .replace(/^SEPA-Lastschrift\s*/i, "")
        .trim();
      if (cleanRef && cleanRef !== tx.partnerName) {
        parts.push(cleanRef);
      }
    }
  }

  return parts.join(" — ") || "Unknown transaction";
}

/**
 * Simple string hash (same algorithm as transactionHash in utils.ts).
 * Used when we have a bank referenceNumber for dedup.
 */
function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
