// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import type { BankParser, ParseResult, ParsedTransaction } from "../types";
import { cleanDescription } from "../normalize";
import { parseEurDate, transactionHash } from "@/lib/utils";

/**
 * Erste Bank / George PDF statement parser.
 *
 * Real Erste Bank PDF text structure (from pdf-parse v1):
 * - Lines can be single-line or multi-line transactions
 * - Date and amount are CONCATENATED at the end of the final line:
 *   "MCDONALDS 86 2360  K1   02.03. 19:1202.03.202621,80-"
 *   i.e. DD.MM.YYYY immediately followed by amount (with optional trailing -)
 * - Credits have no trailing -: "13.03.2026100,00"
 * - Multi-line: description lines, then final line ends with DD.MM.YYYYamount
 */
export const erstePdfParser: BankParser = {
  bankId: "erste-pdf",
  bankName: "Erste Bank / George (PDF)",
  supportedFormats: ["pdf"],

  detect(_content: string | Buffer, fileName: string): boolean {
    return fileName.toLowerCase().endsWith(".pdf");
  },

  async parse(content: string | Buffer, _fileName: string): Promise<ParseResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    const buffer = typeof content === "string" ? Buffer.from(content) : content;

    let pdfText: string;
    try {
      const pdf = await pdfParse(buffer);
      pdfText = pdf.text;
    } catch (e) {
      return {
        transactions: [],
        bankName: "erste-pdf",
        format: "pdf-erste",
        warnings: [],
        errors: [`Failed to extract PDF text: ${(e as Error).message}`],
      };
    }

    // Check if this is actually an Erste Bank statement
    const isErste =
      pdfText.includes("Kontoauszug") ||
      pdfText.includes("Alter Kontostand") ||
      pdfText.includes("Neuer Kontostand");

    if (!isErste) {
      return {
        transactions: [],
        bankName: "erste-pdf",
        format: "pdf-erste",
        warnings: [],
        errors: ["__NOT_ERSTE__"],
      };
    }

    const lines = pdfText
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    // Extract IBAN
    let accountIban: string | undefined;
    const ibanMatch = pdfText.match(/IBAN[:\s]*(AT\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/);
    if (ibanMatch) {
      accountIban = ibanMatch[1].replace(/\s/g, "");
    }

    // Extract old and new balance
    let openingBalanceCents: number | undefined;
    let closingBalanceCents: number | undefined;

    for (const line of lines) {
      // "Alter Kontostand" followed by a line with the balance, or on the same/next line
      if (/Alter Kontostand/i.test(line)) {
        const balMatch = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2}-?)$/);
        if (balMatch) {
          openingBalanceCents = parseErsteAmount(balMatch[1]);
        }
      }
      if (/Neuer Kontostand/i.test(line)) {
        const balMatch = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2}-?)$/);
        if (balMatch) {
          closingBalanceCents = parseErsteAmount(balMatch[1]);
        }
      }
    }

    // If balance was on the NEXT line after "Alter Kontostand"
    for (let i = 0; i < lines.length; i++) {
      if (/^Alter Kontostand$/i.test(lines[i]) || /^Old Balance$/i.test(lines[i])) {
        // Look at the next non-label line
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const m = lines[j].match(/^(\d{1,3}(?:\.\d{3})*,\d{2}-?)$/);
          if (m) {
            openingBalanceCents = parseErsteAmount(m[1]);
            break;
          }
        }
      }
      if (/Neuer Kontostand/i.test(lines[i])) {
        const inline = lines[i].match(/(\d{1,3}(?:\.\d{3})*,\d{2}-?)$/);
        if (inline) {
          closingBalanceCents = parseErsteAmount(inline[1]);
        }
      }
    }

    // Parse transactions
    // Pattern: lines ending with DD.MM.YYYY followed immediately by amount
    // e.g. "02.03.202621,80-" or "13.03.2026100,00"
    const txEndRegex = /(\d{2}\.\d{2}\.\d{4})(\d{1,3}(?:\.\d{3})*,\d{2}-?)\s*$/;

    const transactions: ParsedTransaction[] = [];
    let descriptionLines: string[] = [];

    // Find transaction section boundaries
    let inTransactions = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Start of transaction section
      if (/Buchungstext.*Booking\s*Text/i.test(line) || /Betr[äa]ge.*Amounts/i.test(line)) {
        inTransactions = true;
        descriptionLines = [];
        continue;
      }

      // End of transaction section
      if (/Neuer Kontostand/i.test(line)) {
        inTransactions = false;
        continue;
      }

      // Page header/footer — skip
      if (
        /^AT\d{2}\d{16}/.test(line) ||
        /^IBAN\s*Datum/i.test(line) ||
        /^Seite\/Page/i.test(line) ||
        /^Buchungstext.*Booking/i.test(line) ||
        line.length < 2
      ) {
        continue;
      }

      if (!inTransactions) continue;

      // Check if this line ends with date+amount pattern
      const txMatch = line.match(txEndRegex);

      if (txMatch) {
        const dateStr = txMatch[1];
        const amountStr = txMatch[2];

        // Everything before the date+amount on this line is part of the description
        const lineDesc = line.replace(txEndRegex, "").trim();
        if (lineDesc) {
          descriptionLines.push(lineDesc);
        }

        if (descriptionLines.length > 0) {
          try {
            const fullDescription = descriptionLines.join(" ");
            const description = cleanDescription(fullDescription);
            const amountCents = parseErsteAmount(amountStr);
            const isExpense = amountStr.endsWith("-");
            const absAmount = Math.abs(amountCents);
            const date = parseEurDate(dateStr);

            transactions.push({
              date,
              description,
              rawDescription: fullDescription,
              amountCents: absAmount,
              type: isExpense ? "expense" : "income",
              currency: "EUR",
              hash: transactionHash(date, absAmount, description),
            });
          } catch {
            warnings.push(
              `Could not parse transaction: "${descriptionLines.join(" ").slice(0, 60)}..."`
            );
          }
        }

        descriptionLines = [];
      } else {
        // Accumulate description lines
        descriptionLines.push(line);
      }
    }

    if (transactions.length === 0) {
      errors.push(
        "No transactions found in Erste Bank PDF. The format may have changed — try exporting as CSV from George."
      );
    }

    return {
      transactions,
      bankName: "Erste Bank",
      format: "pdf-erste",
      accountIban,
      openingBalanceCents,
      closingBalanceCents,
      warnings,
      errors,
    };
  },
};

/**
 * Parse Erste Bank amount format.
 * "1.234,56-" → -123456 (negative cents)
 * "1.234,56"  → 123456 (positive cents)
 */
function parseErsteAmount(raw: string): number {
  const isNegative = raw.endsWith("-");
  const cleaned = raw
    .replace(/-$/, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const euros = parseFloat(cleaned);
  if (isNaN(euros)) throw new Error(`Cannot parse Erste amount: "${raw}"`);
  const cents = Math.round(euros * 100);
  return isNegative ? -cents : cents;
}
