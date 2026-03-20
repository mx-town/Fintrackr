export type TransactionType = "income" | "expense" | "transfer";
export type CategorizationSource = "user" | "rule" | "keyword" | "ai" | "import";

export interface Transaction {
  id: string;
  userId: string;
  accountId: string | null;
  categoryId: string | null;
  date: Date;
  description: string;
  rawDescription: string | null;
  type: TransactionType;
  amountCents: number;
  currency: string;
  originalAmountCents: number | null;
  originalCurrency: string | null;
  exchangeRate: number | null;
  categorySource: CategorizationSource | null;
  categoryConfidence: number | null;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  bankReference: string | null;
  hash: string | null;
  isRecurring: boolean | null;
  recurringGroupId: string | null;
  notes: string | null;
  isExcludedFromBudget: boolean | null;
}
