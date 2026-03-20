import type { BankParser, ParseResult } from "./types";
import { georgeJsonParser } from "./json/george";
import { georgeParser } from "./csv/george";
import { raiffeisenParser } from "./csv/raiffeisen";
import { bawagParser } from "./csv/bawag";
import { erstePdfParser } from "./pdf/erste-pdf";
import { pdfExtractor } from "./pdf/extractor";

/**
 * Ordered parser registry.
 * First matching parser wins.
 * JSON first (best quality), then CSV, then PDF (worst).
 */
const PARSERS: BankParser[] = [
  georgeJsonParser, // George JSON export (recommended)
  georgeParser,
  raiffeisenParser,
  bawagParser,
  erstePdfParser, // Erste Bank PDFs
  pdfExtractor, // Generic PDF fallback — always last
];

/**
 * Auto-detect the bank and format, then parse.
 */
export async function parseStatement(
  content: string | Buffer,
  fileName: string
): Promise<ParseResult> {
  for (const parser of PARSERS) {
    if (parser.detect(content, fileName)) {
      console.log(`[Parser] Detected: ${parser.bankName} (${parser.bankId})`);
      const result = await parser.parse(content, fileName);
      // If parser signals it can't handle this file, try the next one
      if (result.errors.length === 1 && result.errors[0] === "__NOT_ERSTE__") {
        continue;
      }
      return result;
    }
  }

  return {
    transactions: [],
    bankName: "unknown",
    format: "unknown",
    warnings: [],
    errors: [
      `Could not detect bank format for "${fileName}". Supported: George JSON (recommended), George CSV, Raiffeisen CSV, BAWAG CSV, PDF statements.`,
    ],
  };
}
