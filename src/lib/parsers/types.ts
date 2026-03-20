export interface ParsedTransaction {
  date: Date;
  valueDate?: Date;
  description: string;
  rawDescription: string;
  amountCents: number;
  type: "income" | "expense" | "transfer";
  currency: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  bankReference?: string;
  hash: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  bankName: string;
  format: string;
  accountIban?: string;
  periodStart?: Date;
  periodEnd?: Date;
  openingBalanceCents?: number;
  closingBalanceCents?: number;
  warnings: string[];
  errors: string[];
}

export interface BankParser {
  bankId: string;
  bankName: string;
  supportedFormats: string[];
  detect: (content: string | Buffer, fileName: string) => boolean;
  parse: (content: string | Buffer, fileName: string) => Promise<ParseResult>;
}
