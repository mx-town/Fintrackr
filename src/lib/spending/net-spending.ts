/**
 * Smart counterparty-based net spending calculation.
 *
 * 1. Counterparty netting: nets refunds by counterparty (IBAN or name) across
 *    categories, distributing proportionally to expense categories.
 * 2. Residual per-category netting: surplus income from counterparty groups
 *    (income > expenses) and income from income-only counterparties still
 *    offsets spending within the same category.
 * 3. Transactions with no counterparty data fall back to per-category netting.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NettableTransaction {
  id: string;
  type: "income" | "expense" | "transfer";
  amountCents: number;
  categoryId: string | null;
  counterpartyName: string | null;
  counterpartyIban: string | null;
}

export interface CategoryNetSpending {
  categoryId: string | null;
  grossExpenses: number;
  refunds: number;
  netSpending: number;
  expenseCount: number;
}

// ---------------------------------------------------------------------------
// Counterparty key
// ---------------------------------------------------------------------------

export function getCounterpartyKey(tx: NettableTransaction): string | null {
  // IBAN takes priority — normalize: strip spaces, uppercase, must be ≥15 chars
  if (tx.counterpartyIban) {
    const normalized = tx.counterpartyIban.replace(/\s/g, "").toUpperCase();
    if (normalized.length >= 15) {
      return `iban:${normalized}`;
    }
  }

  // Fall back to name — lowercase + trim, skip "Unknown" / empty
  if (tx.counterpartyName) {
    const name = tx.counterpartyName.trim().toLowerCase();
    if (name.length > 0 && name !== "unknown") {
      return `name:${name}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

interface CounterpartyGroup {
  /** expenses by categoryId → { total, count } */
  expenses: Map<string, { total: number; count: number }>;
  /** income by categoryId → total */
  incomeByCategory: Map<string, number>;
  totalExpenses: number;
  totalIncome: number;
}

export function computeNetSpending(
  transactions: NettableTransaction[]
): Map<string | null, CategoryNetSpending> {
  // Step 1: Partition into with-counterparty / without-counterparty
  const withCp: NettableTransaction[] = [];
  const withoutCp: NettableTransaction[] = [];

  for (const tx of transactions) {
    if (tx.type === "transfer") continue; // skip transfers entirely

    const key = getCounterpartyKey(tx);
    if (key !== null) {
      withCp.push(tx);
    } else {
      withoutCp.push(tx);
    }
  }

  // Step 2: Build counterparty groups (track income by category too)
  const cpGroups = new Map<string, CounterpartyGroup>();

  for (const tx of withCp) {
    const key = getCounterpartyKey(tx)!;
    let group = cpGroups.get(key);
    if (!group) {
      group = {
        expenses: new Map(),
        incomeByCategory: new Map(),
        totalExpenses: 0,
        totalIncome: 0,
      };
      cpGroups.set(key, group);
    }

    const catKey = tx.categoryId ?? "__uncategorized__";

    if (tx.type === "expense") {
      const entry = group.expenses.get(catKey) ?? { total: 0, count: 0 };
      entry.total += tx.amountCents;
      entry.count += 1;
      group.expenses.set(catKey, entry);
      group.totalExpenses += tx.amountCents;
    } else if (tx.type === "income") {
      // Any income from a known counterparty counts as a potential refund.
      // min(income, expenses) prevents salary from being netted
      // (employer with 0 expenses → appliedRefund = 0).
      group.totalIncome += tx.amountCents;
      group.incomeByCategory.set(
        catKey,
        (group.incomeByCategory.get(catKey) ?? 0) + tx.amountCents
      );
    }
  }

  // Result accumulator: categoryId → CategoryNetSpending
  const result = new Map<string | null, CategoryNetSpending>();

  function getOrCreate(categoryId: string | null): CategoryNetSpending {
    let entry = result.get(categoryId);
    if (!entry) {
      entry = {
        categoryId,
        grossExpenses: 0,
        refunds: 0,
        netSpending: 0,
        expenseCount: 0,
      };
      result.set(categoryId, entry);
    }
    return entry;
  }

  // Step 3: Counterparty netting + track surplus income
  // Surplus = income that exceeds the counterparty's total expenses.
  // This surplus is distributed back by income category for per-category netting.
  const surplusIncome = new Map<string, number>();

  for (const group of cpGroups.values()) {
    const appliedRefund = Math.min(group.totalIncome, group.totalExpenses);
    const surplus = group.totalIncome - appliedRefund;

    // Distribute refund proportionally to expense categories
    for (const [catKey, { total, count }] of group.expenses) {
      const categoryId = catKey === "__uncategorized__" ? null : catKey;
      const entry = getOrCreate(categoryId);

      entry.grossExpenses += total;
      entry.expenseCount += count;

      if (appliedRefund > 0 && group.totalExpenses > 0) {
        const share = (total / group.totalExpenses) * appliedRefund;
        entry.refunds += share;
      }
    }

    // Track surplus income by category for residual per-category netting
    if (surplus > 0 && group.totalIncome > 0) {
      for (const [catKey, amount] of group.incomeByCategory) {
        const share = (amount / group.totalIncome) * surplus;
        surplusIncome.set(catKey, (surplusIncome.get(catKey) ?? 0) + share);
      }
    }
  }

  // Step 4: No-counterparty group → per-category netting
  const noCpExpenses = new Map<string, { total: number; count: number }>();
  const noCpRefunds = new Map<string, number>();

  for (const tx of withoutCp) {
    const catKey = tx.categoryId ?? "__uncategorized__";

    if (tx.type === "expense") {
      const entry = noCpExpenses.get(catKey) ?? { total: 0, count: 0 };
      entry.total += tx.amountCents;
      entry.count += 1;
      noCpExpenses.set(catKey, entry);
    } else if (tx.type === "income" && tx.categoryId !== "cat_income") {
      noCpRefunds.set(catKey, (noCpRefunds.get(catKey) ?? 0) + tx.amountCents);
    }
  }

  for (const [catKey, { total, count }] of noCpExpenses) {
    const categoryId = catKey === "__uncategorized__" ? null : catKey;
    const entry = getOrCreate(categoryId);
    entry.grossExpenses += total;
    entry.expenseCount += count;
    entry.refunds += noCpRefunds.get(catKey) ?? 0;
  }

  // Step 5: Apply surplus income as additional per-category refunds.
  // This handles: (a) income-only counterparties (e.g. friend paying you back
  // with no matching expense), (b) surplus when income > expenses for a
  // counterparty. Excludes cat_income so salary is never netted.
  for (const [catKey, amount] of surplusIncome) {
    if (catKey === "cat_income") continue;
    const categoryId = catKey === "__uncategorized__" ? null : catKey;
    const entry = result.get(categoryId);
    if (entry) {
      entry.refunds += amount;
    }
  }

  // Step 6: Compute final netSpending for each category (never negative)
  for (const entry of result.values()) {
    entry.netSpending = Math.max(0, entry.grossExpenses - entry.refunds);
  }

  return result;
}
