import Papa from "papaparse";
import type { BankParser, ParseResult } from "../types";
import { buildTransaction } from "../normalize";

/**
 * Raiffeisen Mein ELBA CSV export format:
 * Separator: semicolon (;)
 * Encoding: UTF-8
 * Headers: Kontonummer;Buchungsdatum;Wertstellungsdatum;Umsatztext;
 *          Zahlungsgrund;Betrag;W\u00E4hrung
 */
export const raiffeisenParser: BankParser = {
  bankId: "raiffeisen",
  bankName: "Raiffeisen (Mein ELBA)",
  supportedFormats: ["csv"],

  detect(content: string | Buffer, fileName: string): boolean {
    const text =
      typeof content === "string" ? content : content.toString("utf-8");
    const hasHeaders =
      text.includes("Kontonummer") && text.includes("Umsatztext");
    const isCsv = fileName.toLowerCase().endsWith(".csv");
    return isCsv && hasHeaders;
  },

  async parse(content: string | Buffer): Promise<ParseResult> {
    const text =
      typeof content === "string" ? content : content.toString("utf-8");
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
        const description =
          [row["Umsatztext"], row["Zahlungsgrund"]]
            .filter(Boolean)
            .join(" - ") || "";
        const tx = buildTransaction({
          date: row["Buchungsdatum"],
          valueDate: row["Wertstellungsdatum"],
          description,
          amount: row["Betrag"],
          currency: row["W\u00E4hrung"] || "EUR",
        });
        transactions.push(tx);
      } catch (e) {
        warnings.push(`Skipped row: ${(e as Error).message}`);
      }
    }

    return {
      transactions,
      bankName: "raiffeisen",
      format: "csv",
      warnings,
      errors,
    };
  },
};
