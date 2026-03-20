/**
 * In-memory store for parsed transactions.
 * No data is persisted to disk or database — everything lives in server memory
 * and is lost on restart. This is intentional for privacy.
 */

import { DEFAULT_CATEGORIES } from "@/lib/db/seed-categories";

export interface StoredTransaction {
  id: string;
  date: Date;
  valueDate?: Date;
  description: string;
  rawDescription: string;
  type: "income" | "expense" | "transfer";
  amountCents: number;
  currency: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  bankReference?: string;
  hash: string;
  categoryId: string | null;
  categorySource: string | null;
  uploadId: string;
}

export interface StoredCategory {
  id: string;
  userId: string | null;
  parentId: string | null;
  name: string;
  nameDE: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number | null;
  isSystem: boolean;
  isHidden: boolean;
}

// Global singleton — survives HMR in dev
const globalStore = globalThis as unknown as {
  __fintrackr_transactions?: StoredTransaction[];
  __fintrackr_categories?: StoredCategory[];
};

if (!globalStore.__fintrackr_transactions) {
  globalStore.__fintrackr_transactions = [];
}

if (!globalStore.__fintrackr_categories) {
  globalStore.__fintrackr_categories = DEFAULT_CATEGORIES.map((c) => ({
    id: c.id,
    userId: null,
    parentId: "parentId" in c ? (c as { parentId: string }).parentId : null,
    name: c.name,
    nameDE: c.nameDE,
    icon: c.icon,
    color: c.color,
    sortOrder: c.sortOrder,
    isSystem: true,
    isHidden: false,
  }));
}

export const store = {
  get transactions(): StoredTransaction[] {
    return globalStore.__fintrackr_transactions!;
  },

  get categories(): StoredCategory[] {
    return globalStore.__fintrackr_categories!;
  },

  addTransactions(txs: StoredTransaction[]) {
    // Deduplicate by hash
    const existing = new Set(this.transactions.map((t) => t.hash));
    const unique = txs.filter((t) => !existing.has(t.hash));
    globalStore.__fintrackr_transactions!.push(...unique);
    return { added: unique.length, duplicates: txs.length - unique.length };
  },

  clear() {
    globalStore.__fintrackr_transactions = [];
  },
};
