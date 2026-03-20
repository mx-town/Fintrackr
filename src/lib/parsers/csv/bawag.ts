import Papa from "papaparse";
import type { BankParser, ParseResult } from "../types";
import { buildTransaction } from "../normalize";

/**
 * BAWAG eBanking CSV export format:
 * Encoding: Windows-1252 (NOT UTF-8) — detect and convert
 * Separator: semicolon (;)
 * Headers: IBAN;Buchungsdatum;Valutadatum;Buchungstext;
 *          Zahlungsreferenz;W\u00E4hrung;Betrag (\u20AC);...
 */
export const bawagParser: BankParser = {
  bankId: "bawag",
  bankName: "BAWAG (eBanking)",
  supportedFormats: ["csv"],

  detect(content: string | Buffer, fileName: string): boolean {
    const text =
      typeof content === "string" ? content : decodeContent(content);
    const hasHeaders =
      text.includes("Buchungstext") &&
      (text.includes("Betrag") || text.includes("Betrag (\u20AC)"));
    const isCsv = fileName.toLowerCase().endsWith(".csv");
    // Distinguish from George: BAWAG has "Buchungstext", George has "Verwendungszweck"
    const isNotGeorge = !text.includes("Verwendungszweck");
    return isCsv && hasHeaders && isNotGeorge;
  },

  async parse(content: string | Buffer): Promise<ParseResult> {
    const text =
      typeof content === "string" ? content : decodeContent(content);
    const warnings: string[] = [];
    const errors: string[] = [];

    const { data, errors: parseErrors } = Papa.parse(text, {
      delimiter: ";",
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (parseErrors.length > 0) {
      warnings.push(
        ...parseErrors.map(
          (e: Papa.ParseError) =>
            `CSV parse warning: ${e.message} (row ${e.row})`
        )
      );
    }

    const transactions = [];

    for (const row of data as Record<string, string>[]) {
      try {
        const amountKey =
          Object.keys(row).find((k) => k.startsWith("Betrag")) || "Betrag";
        const tx = buildTransaction({
          date: row["Buchungsdatum"],
          valueDate: row["Valutadatum"],
          description: row["Buchungstext"] || row["Zahlungsreferenz"] || "",
          amount: row[amountKey],
          counterpartyIban: row["IBAN"],
          bankReference: row["Zahlungsreferenz"],
          currency: row["W\u00E4hrung"] || "EUR",
        });
        transactions.push(tx);
      } catch (e) {
        warnings.push(`Skipped row: ${(e as Error).message}`);
      }
    }

    return {
      transactions,
      bankName: "bawag",
      format: "csv",
      warnings,
      errors,
    };
  },
};

/**
 * BAWAG exports may use Windows-1252 encoding.
 * Try UTF-8 first, fall back to Windows-1252.
 */
function decodeContent(buffer: Buffer): string {
  const utf8 = buffer.toString("utf-8");
  // Check for common Windows-1252 artifacts (replacement chars)
  if (utf8.includes("\uFFFD")) {
    const decoder = new TextDecoder("windows-1252");
    return decoder.decode(buffer);
  }
  return utf8;
}
