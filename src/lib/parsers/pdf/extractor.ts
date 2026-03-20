// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import type { BankParser, ParseResult, ParsedTransaction } from "../types";
import { classifyAmount, cleanDescription } from "../normalize";
import { parseEurDate, transactionHash } from "@/lib/utils";

/**
 * Generic PDF bank statement parser.
 * Strategy:
 * 1. Extract all text with pdf-parse
 * 2. Split into lines
 * 3. Detect lines that start with a date pattern (DD.MM.YYYY)
 * 4. Extract amount (last number-like token on the line)
 * 5. Everything between date and amount is the description
 */
export const pdfExtractor: BankParser = {
  bankId: "pdf-generic",
  bankName: "PDF Statement (Generic)",
  supportedFormats: ["pdf"],

  detect(_content: string | Buffer, fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".pdf");
  },

  async parse(content: string | Buffer, _fileName: string): Promise<ParseResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    const buffer = typeof content === "string" ? Buffer.from(content) : content;
    const pdf = await pdfParse(buffer);
    const lines = pdf.text
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    const transactions: ParsedTransaction[] = [];
    const dateRegex = /^(\d{2}\.\d{2}\.\d{4})/;
    const amountRegex = /(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

    for (const line of lines) {
      const dateMatch = line.match(dateRegex);
      const amountMatch = line.match(amountRegex);

      if (dateMatch && amountMatch) {
        try {
          const dateStr = dateMatch[1];
          const amountStr = amountMatch[1];
          const descriptionPart = line
            .replace(dateRegex, "")
            .replace(amountRegex, "")
            .trim();

          const date = parseEurDate(dateStr);
          const { amountCents, type } = classifyAmount(amountStr);
          const description = cleanDescription(descriptionPart);

          transactions.push({
            date,
            description,
            rawDescription: line,
            amountCents,
            type,
            currency: "EUR",
            hash: transactionHash(date, amountCents, description),
          });
        } catch {
          warnings.push(
            `Could not parse PDF line: "${line.slice(0, 80)}..."`
          );
        }
      }
    }

    if (transactions.length === 0) {
      errors.push(
        "No transactions found in PDF. The format may not be supported \u2014 try exporting as CSV from your bank."
      );
    }

    return {
      transactions,
      bankName: "pdf-generic",
      format: "pdf-native",
      warnings,
      errors,
    };
  },
};
