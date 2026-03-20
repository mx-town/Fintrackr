import Papa from "papaparse";
import type { BankParser, ParseResult } from "../types";
import { buildTransaction } from "../normalize";

/**
 * George (Erste Bank) CSV export format:
 * Separator: semicolon (;)
 * Encoding: UTF-8
 * Headers: Buchungsdatum;Valutadatum;Auftraggeber/Empf\u00E4nger;IBAN;BIC;
 *          Zahlungsreferenz;Verwendungszweck;Betrag;W\u00E4hrung
 */
export const georgeParser: BankParser = {
  bankId: "george",
  bankName: "Erste Bank (George)",
  supportedFormats: ["csv"],

  detect(content: string | Buffer, fileName: string): boolean {
    const text =
      typeof content === "string" ? content : content.toString("utf-8");
    const hasGeorgeHeaders =
      text.includes("Buchungsdatum") &&
      text.includes("Verwendungszweck") &&
      text.includes("Betrag");
    const isCsv = fileName.toLowerCase().endsWith(".csv");
    return isCsv && hasGeorgeHeaders;
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
        const tx = buildTransaction({
          date: row["Buchungsdatum"],
          valueDate: row["Valutadatum"],
          description:
            row["Verwendungszweck"] || row["Zahlungsreferenz"] || "",
          amount: row["Betrag"],
          counterpartyName: row["Auftraggeber/Empf\u00E4nger"],
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
      bankName: "george",
      format: "csv",
      warnings,
      errors,
    };
  },
};
