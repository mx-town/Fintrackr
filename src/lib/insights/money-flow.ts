export interface FlowInput {
  name: string;
  totalCents: number;
}

export interface SankeyData {
  nodes: { id: string; color?: string }[];
  links: { source: string; target: string; value: number }[];
}

const BUDGET = "Budget";
const SAVINGS = "Savings";
const OTHER = "Other";
const MAX_EXPENSE_NODES = 8;

const toEuros = (cents: number) => Math.round(cents) / 100;

/** Category name that would collide with a structural node gets suffixed. */
const safeName = (name: string) =>
  name === BUDGET || name === SAVINGS ? `${name} (category)` : name;

/**
 * Build Sankey data: income categories → Budget → top expense categories
 * (rest folded into Other) + Savings for any surplus. Pure; amounts in cents
 * in, euros out.
 */
export function buildMoneyFlow(
  incomes: FlowInput[],
  expenses: FlowInput[]
): SankeyData {
  const activeIncomes = incomes.filter((i) => i.totalCents > 0);
  const activeExpenses = expenses.filter((e) => e.totalCents > 0);
  if (activeIncomes.length === 0 && activeExpenses.length === 0) {
    return { nodes: [], links: [] };
  }

  const sorted = [...activeExpenses].sort((a, b) => b.totalCents - a.totalCents);
  const top = sorted.slice(0, MAX_EXPENSE_NODES);
  const rest = sorted.slice(MAX_EXPENSE_NODES);

  const expenseTotals = new Map<string, number>();
  for (const e of top) {
    const name = safeName(e.name);
    expenseTotals.set(name, (expenseTotals.get(name) ?? 0) + e.totalCents);
  }
  const foldCents = rest.reduce((s, e) => s + e.totalCents, 0);
  if (foldCents > 0) {
    expenseTotals.set(OTHER, (expenseTotals.get(OTHER) ?? 0) + foldCents);
  }

  const totalIncome = activeIncomes.reduce((s, i) => s + i.totalCents, 0);
  const totalExpense = activeExpenses.reduce((s, e) => s + e.totalCents, 0);
  const savingsCents = totalIncome - totalExpense;

  const nodes: SankeyData["nodes"] = [];
  const links: SankeyData["links"] = [];

  for (const i of activeIncomes) {
    const name = safeName(i.name);
    nodes.push({ id: name });
    links.push({ source: name, target: BUDGET, value: toEuros(i.totalCents) });
  }
  nodes.push({ id: BUDGET });
  for (const [name, cents] of expenseTotals) {
    nodes.push({ id: name });
    links.push({ source: BUDGET, target: name, value: toEuros(cents) });
  }
  if (savingsCents > 0 && totalIncome > 0) {
    nodes.push({ id: SAVINGS });
    links.push({ source: BUDGET, target: SAVINGS, value: toEuros(savingsCents) });
  }

  return { nodes, links };
}
