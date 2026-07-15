# Insights Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fixed current-year Insights page into a period-aware analysis page with a money-flow Sankey, a weekday×month spending heatmap, and a rule-based "What stands out" panel.

**Architecture:** Server components fetch aggregates via Drizzle/SQLite in `src/actions/insights.ts`; all new business logic lives as pure, unit-tested functions in `src/lib/insights/`; existing (currently unused) chart components `MoneyFlowSankey` and `SpendingHeatmap` get wired up. Three shippable stages per the spec (`docs/superpowers/specs/2026-07-07-insights-redesign-design.md`).

**Tech Stack:** Next.js 16 App Router (server components, awaited `searchParams`), Drizzle ORM + better-sqlite3, @nivo charts, date-fns v4, Vitest (new).

**Quality bar:** professional look & feel — reuse existing card/empty-state/tooltip idioms, no placeholder UI. Chart color order must never put `#60a5fa` next to `#a78bfa` (CVD).

**Verification requirement (user-mandated):** every claim of "works" must be backed by pasted log output — Vitest results, build output, and a running server whose rendered `/insights` HTML is checked with curl (Task 8).

**Caution:** This repo's Next.js may differ from training data (see AGENTS.md). Before Task 2, skim `node_modules/next/dist/docs/` for the app-router `searchParams` guide; the existing dashboard pattern (awaited `searchParams` promise) is the source of truth.

**Note on existing `src/lib/insights/`:** `anomalies.ts`, `comparisons.ts`, `recurring.ts`, `trends.ts` are dead code (imported nowhere) and DB-coupled. Do NOT extend or delete them in this plan; new files live alongside.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `vitest.config.ts` | create | Vitest config with `@` alias |
| `package.json` | modify | add `"test": "vitest run"` script |
| `src/lib/date-params.ts` | create | shared `parseDateParam` (moved from dashboard page) |
| `src/lib/date-params.test.ts` | create | tests for it |
| `src/app/(dashboard)/page.tsx` | modify | import shared helper, delete local copy |
| `src/app/(dashboard)/insights/page.tsx` | modify | period control + new sections |
| `src/lib/insights/money-flow.ts` | create | pure `buildMoneyFlow` |
| `src/lib/insights/money-flow.test.ts` | create | tests |
| `src/lib/insights/weekday-matrix.ts` | create | pure `buildWeekdayMatrix` + `weekdayTakeaway` |
| `src/lib/insights/weekday-matrix.test.ts` | create | tests |
| `src/lib/insights/rules.ts` | create | pure insight rules + ranking |
| `src/lib/insights/rules.test.ts` | create | tests |
| `src/actions/insights.ts` | modify | add `getMoneyFlow`, `getWeekdayMatrix`, `getInsightPanelData` |
| `src/components/charts/spending-heatmap.tsx` | modify | accept `title`/`subtitle`/`footer` props |
| `src/components/insights/insight-panel.tsx` | create | "What stands out" card panel |

---

### Task 1: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 2: Add test script to `package.json`**

In `"scripts"`, after `"lint": "eslint"` add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Verify vitest runs (expect "no test files" — that's the correct baseline)**

Run: `npm run test`
Expected: exits reporting no test files found (non-zero exit is fine at this point).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "chore: add vitest config and test script"
```

---

### Task 2: Shared `parseDateParam` helper (Stage 1 groundwork)

**Files:**
- Create: `src/lib/date-params.ts`, `src/lib/date-params.test.ts`
- Modify: `src/app/(dashboard)/page.tsx:14-20` (delete local copy, import shared)

- [ ] **Step 1: Write the failing test — `src/lib/date-params.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseDateParam } from "./date-params";

describe("parseDateParam", () => {
  it("parses a valid ISO date", () => {
    const d = parseDateParam("2026-07-07");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6);
  });

  it("returns null for undefined", () => {
    expect(parseDateParam(undefined)).toBeNull();
  });

  it("rejects non-ISO formats", () => {
    expect(parseDateParam("07.07.2026")).toBeNull();
    expect(parseDateParam("2026-7-7")).toBeNull();
  });

  it("rejects impossible dates", () => {
    expect(parseDateParam("2026-13-40")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/date-params.test.ts`
Expected: FAIL — cannot resolve `./date-params`.

- [ ] **Step 3: Implement `src/lib/date-params.ts`**

```ts
import { parseISO, isValid } from "date-fns";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a `from`/`to` query param. Returns null unless the value is a
 * strictly-formatted, real ISO date (YYYY-MM-DD).
 */
export function parseDateParam(value: string | undefined): Date | null {
  if (!value || !ISO_DATE_RE.test(value)) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/date-params.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Deduplicate the dashboard page**

In `src/app/(dashboard)/page.tsx`:
- Delete lines 14–20 (the `ISO_DATE_RE` const and local `parseDateParam` function).
- Add import: `import { parseDateParam } from "@/lib/date-params";`
- Remove now-unused `parseISO, isValid` from the date-fns import (keep the rest).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/date-params.ts src/lib/date-params.test.ts "src/app/(dashboard)/page.tsx"
git commit -m "refactor: extract shared parseDateParam helper with tests"
```

---

### Task 3: Period control on the Insights page (Stage 1)

**Files:**
- Modify: `src/app/(dashboard)/insights/page.tsx`

- [ ] **Step 1: Rewrite the page header/data plumbing**

Replace the entire top of `src/app/(dashboard)/insights/page.tsx` down to the `hasData` check with:

```tsx
import { EmptyState } from "@/components/shared/empty-state";
import { SpendingCalendar } from "@/components/charts/calendar-heatmap";
import { SpendingTreemap } from "@/components/charts/treemap";
import { CategorySunburst } from "@/components/charts/sunburst";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Upload } from "lucide-react";
import { getCalendarData, getCategoryHierarchy } from "@/actions/insights";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { parseDateParam } from "@/lib/date-params";
import { startOfYear, endOfYear, format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await ensureDb();

  const params = await searchParams;
  const now = new Date();
  const startDate = parseDateParam(params.from) ?? startOfYear(now);
  const endDate = parseDateParam(params.to) ?? endOfYear(now);

  // The calendar is inherently year-based: show the year containing endDate.
  const calendarYear = endDate.getFullYear();
  const calendarFrom = startOfYear(endDate);
  const calendarTo = endOfYear(endDate);

  const [calendarData, hierarchy] = await Promise.all([
    getCalendarData(DEFAULT_USER_ID, calendarYear),
    getCategoryHierarchy(DEFAULT_USER_ID, startDate, endDate),
  ]);

  const hasData =
    calendarData.length > 0 ||
    (hierarchy.treemapData.children && hierarchy.treemapData.children.length > 0);

  const periodLabel = `${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`;
```

- [ ] **Step 2: Update both returned layouts**

Both the empty state and the data branch get a flex header with the picker; the subtitle shows `periodLabel`. Data branch header:

```tsx
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Insights
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel} · spending patterns and category analysis
          </p>
        </div>
        <DateRangePicker />
      </div>
```

Use the same header (with `Deep dive into your spending patterns` subtitle replaced by `periodLabel` text as above) in the empty-state branch too. `SpendingCalendar` receives `from={format(calendarFrom, "yyyy-MM-dd")}` and `to={format(calendarTo, "yyyy-MM-dd")}`. Leave the two "Coming soon" placeholder divs untouched in this task (Task 5/6 replace them).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Verify in the running app (logs!)**

```bash
npm run dev &   # capture output
sleep 8
curl -s "http://localhost:3000/insights?from=2026-01-01&to=2026-03-31" | grep -o "Jan 1, 2026 – Mar 31, 2026" | head -1
curl -s "http://localhost:3000/insights?from=BOGUS&to=ALSO_BOGUS" | grep -oE "Jan 1, 2026 – Dec 31, 2026" | head -1
```

Expected: first grep prints the selected period; second prints the current-year fallback. Keep the log output for the final report.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/insights/page.tsx"
git commit -m "feat(insights): period control via from/to query params"
```

---

### Task 4: Money-flow builder (pure) — Stage 2a

**Files:**
- Create: `src/lib/insights/money-flow.ts`, `src/lib/insights/money-flow.test.ts`

- [ ] **Step 1: Write the failing tests — `src/lib/insights/money-flow.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildMoneyFlow } from "./money-flow";

const inc = (name: string, totalCents: number) => ({ name, totalCents });

describe("buildMoneyFlow", () => {
  it("returns empty data when there is nothing to show", () => {
    expect(buildMoneyFlow([], [])).toEqual({ nodes: [], links: [] });
  });

  it("links incomes into Budget and Budget into expenses, in euros", () => {
    const flow = buildMoneyFlow(
      [inc("Salary", 280000)],
      [inc("Housing", 95000), inc("Groceries", 38000)]
    );
    expect(flow.links).toContainEqual({ source: "Salary", target: "Budget", value: 2800 });
    expect(flow.links).toContainEqual({ source: "Budget", target: "Housing", value: 950 });
    expect(flow.nodes.map((n) => n.id)).toContain("Budget");
  });

  it("adds a Savings node only when income exceeds expenses", () => {
    const surplus = buildMoneyFlow([inc("Salary", 100000)], [inc("Rent", 60000)]);
    expect(surplus.links).toContainEqual({ source: "Budget", target: "Savings", value: 400 });

    const deficit = buildMoneyFlow([inc("Salary", 50000)], [inc("Rent", 60000)]);
    expect(deficit.nodes.find((n) => n.id === "Savings")).toBeUndefined();
  });

  it("folds categories beyond the top 8 into Other", () => {
    const expenses = Array.from({ length: 11 }, (_, i) =>
      inc(`Cat${i}`, (11 - i) * 1000)
    );
    const flow = buildMoneyFlow([inc("Salary", 100000)], expenses);
    const targets = flow.links
      .filter((l) => l.source === "Budget" && l.target !== "Savings")
      .map((l) => l.target);
    expect(targets).toHaveLength(9); // top 8 + "Other"
    expect(targets).toContain("Other");
    // Other = Cat8(3000) + Cat9(2000) + Cat10(1000) = 60 €
    expect(flow.links.find((l) => l.target === "Other")!.value).toBe(60);
  });

  it("merges the fold into an existing Other category instead of duplicating", () => {
    const expenses = [
      inc("Other", 90000),
      ...Array.from({ length: 9 }, (_, i) => inc(`Cat${i}`, (9 - i) * 1000)),
    ];
    const flow = buildMoneyFlow([inc("Salary", 200000)], expenses);
    const otherLinks = flow.links.filter((l) => l.target === "Other");
    expect(otherLinks).toHaveLength(1);
  });

  it("renames a category that collides with the Budget node id", () => {
    const flow = buildMoneyFlow([inc("Salary", 10000)], [inc("Budget", 5000)]);
    expect(flow.links).toContainEqual({
      source: "Budget",
      target: "Budget (category)",
      value: 50,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/insights/money-flow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/insights/money-flow.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/insights/money-flow.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights/money-flow.ts src/lib/insights/money-flow.test.ts
git commit -m "feat(insights): pure money-flow sankey builder"
```

---

### Task 5: Money-flow query + wire Sankey into the page (Stage 2a)

**Files:**
- Modify: `src/actions/insights.ts` (append), `src/app/(dashboard)/insights/page.tsx`

- [ ] **Step 1: Append `getMoneyFlow` to `src/actions/insights.ts`**

```ts
import { buildMoneyFlow } from "@/lib/insights/money-flow";

/**
 * Income → Budget → expense-category flows for the Sankey.
 */
export async function getMoneyFlow(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const rows = await db
    .select({
      type: transactions.type,
      categoryName: categories.name,
      total: sql<number>`SUM(${transactions.amountCents})`.as("total"),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    )
    .groupBy(transactions.type, categories.name);

  const incomes = rows
    .filter((r) => r.type === "income")
    .map((r) => ({ name: r.categoryName ?? "Other income", totalCents: r.total }));
  const expenses = rows
    .filter((r) => r.type === "expense")
    .map((r) => ({ name: r.categoryName ?? "Uncategorized", totalCents: r.total }));

  return buildMoneyFlow(incomes, expenses);
}
```

(The imports `db`, `transactions`, `categories`, `eq/and/gte/lte/sql/isNull` already exist at the top of the file.)

- [ ] **Step 2: Wire into the page**

In `src/app/(dashboard)/insights/page.tsx`:
- Add imports:

```tsx
import { MoneyFlowSankey } from "@/components/charts/sankey";
import { getMoneyFlow } from "@/actions/insights";
```

- Extend the parallel fetch:

```tsx
  const [calendarData, hierarchy, moneyFlow] = await Promise.all([
    getCalendarData(DEFAULT_USER_ID, calendarYear),
    getCategoryHierarchy(DEFAULT_USER_ID, startDate, endDate),
    getMoneyFlow(DEFAULT_USER_ID, startDate, endDate),
  ]);
```

- Replace the first "Coming soon" placeholder div (the one with 🔀 / "Money Flow") with:

```tsx
        <MoneyFlowSankey data={moneyFlow} />
```

The `grid-cols-2` wrapper stays; the second placeholder is replaced in Task 6.

- [ ] **Step 3: Typecheck, then verify against the running server (logs!)**

```bash
npx tsc --noEmit
curl -s "http://localhost:3000/insights?from=2026-01-01&to=2026-06-30" | grep -c "Money Flow"
```

Expected: `tsc` clean; grep count ≥ 1. Save output.

- [ ] **Step 4: Commit**

```bash
git add src/actions/insights.ts "src/app/(dashboard)/insights/page.tsx"
git commit -m "feat(insights): wire money-flow sankey with real data"
```

---

### Task 6: Weekday×month heatmap (Stage 2b)

**Files:**
- Create: `src/lib/insights/weekday-matrix.ts`, `src/lib/insights/weekday-matrix.test.ts`
- Modify: `src/components/charts/spending-heatmap.tsx`, `src/actions/insights.ts`, `src/app/(dashboard)/insights/page.tsx`

- [ ] **Step 1: Write the failing tests — `src/lib/insights/weekday-matrix.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildWeekdayMatrix, weekdayTakeaway } from "./weekday-matrix";

// June 2026: Mon Jun 1 … Tue Jun 30 (4 Saturdays: 6, 13, 20, 27)
const tx = (iso: string, cents: number) => ({
  date: new Date(`${iso}T00:00:00`),
  amountCents: cents,
});

describe("buildWeekdayMatrix", () => {
  it("averages by weekday occurrence, not raw sum", () => {
    const rows = buildWeekdayMatrix(
      [tx("2026-06-06", 4000), tx("2026-06-13", 2000)], // two of four Saturdays
      new Date("2026-06-01T00:00:00"),
      new Date("2026-06-30T23:59:59")
    );
    const sat = rows.find((r) => r.id === "Sat")!;
    // (4000 + 2000) / 4 Saturdays = 1500 cents = 15 €
    expect(sat.data).toEqual([{ x: "Jun", y: 15 }]);
  });

  it("orders rows Mon..Sun and columns chronologically", () => {
    const rows = buildWeekdayMatrix(
      [tx("2026-05-04", 1000), tx("2026-06-01", 1000)],
      new Date("2026-05-01T00:00:00"),
      new Date("2026-06-30T23:59:59")
    );
    expect(rows.map((r) => r.id)).toEqual([
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    ]);
    expect(rows[0].data.map((d) => d.x)).toEqual(["May", "Jun"]);
  });

  it("only counts weekday occurrences inside the range (partial months)", () => {
    // Range covers only Jun 1–7: exactly one of each weekday.
    const rows = buildWeekdayMatrix(
      [tx("2026-06-06", 3000)],
      new Date("2026-06-01T00:00:00"),
      new Date("2026-06-07T23:59:59")
    );
    const sat = rows.find((r) => r.id === "Sat")!;
    expect(sat.data).toEqual([{ x: "Jun", y: 30 }]); // ÷1, not ÷4
  });

  it("labels columns with the year when the range spans years", () => {
    const rows = buildWeekdayMatrix(
      [tx("2025-12-01", 1000), tx("2026-01-05", 1000)],
      new Date("2025-12-01T00:00:00"),
      new Date("2026-01-31T23:59:59")
    );
    expect(rows[0].data.map((d) => d.x)).toEqual(["Dec 25", "Jan 26"]);
  });

  it("returns [] when there are no transactions", () => {
    expect(
      buildWeekdayMatrix([], new Date("2026-06-01"), new Date("2026-06-30"))
    ).toEqual([]);
  });
});

describe("weekdayTakeaway", () => {
  it("names the most and least expensive weekday", () => {
    const rows = buildWeekdayMatrix(
      [tx("2026-06-06", 8000), tx("2026-06-02", 1000)], // Sat vs Tue
      new Date("2026-06-01T00:00:00"),
      new Date("2026-06-30T23:59:59")
    );
    const t = weekdayTakeaway(rows)!;
    expect(t.most.day).toBe("Sat");
    expect(t.least.day).toBe("Tue");
    expect(t.most.avg).toBeGreaterThan(t.least.avg);
  });

  it("returns null for empty input", () => {
    expect(weekdayTakeaway([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/insights/weekday-matrix.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/insights/weekday-matrix.ts`**

```ts
import { addDays, format, isSameYear, startOfDay } from "date-fns";

export interface TxLike {
  date: Date;
  amountCents: number;
}

export interface HeatmapSeries {
  id: string;
  data: { x: string; y: number }[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Monday = 0 … Sunday = 6 */
const dow = (d: Date) => (d.getDay() + 6) % 7;

/**
 * Average expense per weekday occurrence, per month, for the given range.
 * Averaging by occurrence keeps partial months honest.
 */
export function buildWeekdayMatrix(
  txs: TxLike[],
  start: Date,
  end: Date
): HeatmapSeries[] {
  if (txs.length === 0) return [];

  const monthLabel = (d: Date) =>
    isSameYear(start, end) ? format(d, "MMM") : format(d, "MMM yy");

  // Count weekday occurrences per month within the range.
  const monthOrder: string[] = [];
  const occurrences = new Map<string, number>(); // `${month}|${dow}`
  for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
    const m = monthLabel(d);
    if (!monthOrder.includes(m)) monthOrder.push(m);
    const key = `${m}|${dow(d)}`;
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }

  // Sum spending per month × weekday.
  const sums = new Map<string, number>();
  for (const tx of txs) {
    const key = `${monthLabel(tx.date)}|${dow(tx.date)}`;
    sums.set(key, (sums.get(key) ?? 0) + tx.amountCents);
  }

  return DAY_LABELS.map((label, di) => ({
    id: label,
    data: monthOrder.map((m) => {
      const key = `${m}|${di}`;
      const n = occurrences.get(key) ?? 0;
      const avgCents = n > 0 ? (sums.get(key) ?? 0) / n : 0;
      return { x: m, y: Math.round(avgCents) / 100 };
    }),
  }));
}

/**
 * Most/least expensive weekday averaged across all months (euros).
 */
export function weekdayTakeaway(
  rows: HeatmapSeries[]
): { most: { day: string; avg: number }; least: { day: string; avg: number } } | null {
  if (rows.length === 0) return null;
  const avgs = rows.map((r) => ({
    day: r.id,
    avg: r.data.reduce((s, d) => s + d.y, 0) / Math.max(r.data.length, 1),
  }));
  const most = avgs.reduce((a, b) => (b.avg > a.avg ? b : a));
  const least = avgs.reduce((a, b) => (b.avg < a.avg ? b : a));
  return { most, least };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/insights/weekday-matrix.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Make `SpendingHeatmap` configurable**

In `src/components/charts/spending-heatmap.tsx`, change the component signature and card usage:

```tsx
export function SpendingHeatmap({
  data,
  title = "When Do You Spend?",
  subtitle = "Spending patterns by day and time",
  footer,
}: {
  data: HeatmapSeries[];
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}) {
```

Use `title`/`subtitle` in both `ChartCard` usages (empty and filled), and render `footer` (when provided) directly below the chart div inside the filled branch:

```tsx
        {footer ? <div className="mt-3 text-sm text-muted-foreground">{footer}</div> : null}
```

- [ ] **Step 6: Append `getWeekdayMatrix` to `src/actions/insights.ts`**

```ts
import { buildWeekdayMatrix, weekdayTakeaway } from "@/lib/insights/weekday-matrix";

/**
 * Weekday × month average spending heatmap data + takeaway line.
 */
export async function getWeekdayMatrix(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const rows = await db
    .select({ date: transactions.date, amountCents: transactions.amountCents })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNull(transactions.deletedAt)
      )
    );

  const matrix = buildWeekdayMatrix(rows, startDate, endDate);
  return { matrix, takeaway: weekdayTakeaway(matrix) };
}
```

- [ ] **Step 7: Wire into the page**

In `src/app/(dashboard)/insights/page.tsx`:
- Import `SpendingHeatmap` and `getWeekdayMatrix`; add `formatCurrency` from `@/lib/utils`.
- Extend `Promise.all` with `getWeekdayMatrix(DEFAULT_USER_ID, startDate, endDate)` as `weekday`.
- Replace the second placeholder div (🕐 / "Spending by Time") with:

```tsx
        <SpendingHeatmap
          data={weekday.matrix}
          title="Which days cost you money?"
          subtitle="Average spending by weekday and month"
          footer={
            weekday.takeaway && weekday.takeaway.most.avg > 0 ? (
              <span>
                <strong className="text-foreground">
                  {weekday.takeaway.most.day}
                </strong>{" "}
                is your most expensive day —{" "}
                {formatCurrency(Math.round(weekday.takeaway.most.avg * 100))} on
                average vs. {formatCurrency(Math.round(weekday.takeaway.least.avg * 100))}{" "}
                on {weekday.takeaway.least.day}.
              </span>
            ) : undefined
          }
        />
```

(Check `formatCurrency`'s expected unit in `src/lib/utils.ts` first — if it takes euros, drop the `* 100`.)

- [ ] **Step 8: Full test run, typecheck, live verification (logs!)**

```bash
npm run test && npx tsc --noEmit
curl -s "http://localhost:3000/insights?from=2026-01-01&to=2026-06-30" | grep -c "Which days cost you money?"
```

Expected: all tests pass; grep ≥ 1. Save output.

- [ ] **Step 9: Commit**

```bash
git add src/lib/insights/weekday-matrix.ts src/lib/insights/weekday-matrix.test.ts src/components/charts/spending-heatmap.tsx src/actions/insights.ts "src/app/(dashboard)/insights/page.tsx"
git commit -m "feat(insights): weekday x month spending heatmap with takeaway"
```

---

### Task 7: "What stands out" panel (Stage 3)

**Files:**
- Create: `src/lib/insights/rules.ts`, `src/lib/insights/rules.test.ts`, `src/components/insights/insight-panel.tsx`
- Modify: `src/actions/insights.ts`, `src/app/(dashboard)/insights/page.tsx`

- [ ] **Step 1: Write the failing tests — `src/lib/insights/rules.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  categoryMovers,
  unusualExpenses,
  newCounterparties,
  selectInsights,
  MIN_DELTA_CENTS,
} from "./rules";

describe("categoryMovers", () => {
  it("reports a rise only above both thresholds (20% AND 25 €)", () => {
    const out = categoryMovers([
      { key: "c1", name: "Restaurants", currentCents: 35640, previousCents: 27000 },
      { key: "c2", name: "Coffee", currentCents: 1300, previousCents: 1000 },   // +30% but tiny
      { key: "c3", name: "Rent", currentCents: 96000, previousCents: 93000 },   // big € but +3%
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("increase");
    expect(out[0].headline).toContain("Restaurants");
  });

  it("reports decreases too", () => {
    const out = categoryMovers([
      { key: "c1", name: "Groceries", currentCents: 30280, previousCents: 34400 },
    ]);
    expect(out[0].kind).toBe("decrease");
  });

  it("phrases a zero baseline as new, never a percent", () => {
    const out = categoryMovers([
      { key: "c1", name: "Fitness", currentCents: 8970, previousCents: 0 },
    ]);
    expect(out[0].kind).toBe("new-category");
    expect(out[0].headline).not.toContain("%");
    expect(out[0].detail).not.toContain("%");
  });
});

describe("unusualExpenses", () => {
  it("flags a transaction above 3x the category median (and above the floor)", () => {
    const medians = new Map([["shopping", 4500]]);
    const out = unusualExpenses(
      [
        { description: "MediaMarkt", counterpartyName: "MediaMarkt", amountCents: 28999, categoryKey: "shopping" },
        { description: "Socks", counterpartyName: null, amountCents: 900, categoryKey: "shopping" },
      ],
      medians
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("unusual-expense");
    expect(out[0].headline).toContain("MediaMarkt");
  });

  it("ignores small categories where 3x median is under the floor", () => {
    const medians = new Map([["coffee", 300]]);
    const out = unusualExpenses(
      [{ description: "Fancy beans", counterpartyName: null, amountCents: 1000, categoryKey: "coffee" }],
      medians
    );
    expect(out).toHaveLength(0); // 1000 < MIN_DELTA_CENTS
    expect(MIN_DELTA_CENTS).toBe(2500);
  });
});

describe("newCounterparties", () => {
  it("flags counterparties unseen in the previous period with >= 25 € total", () => {
    const out = newCounterparties(
      [
        { description: "x", counterpartyName: "Urban Sports Club", amountCents: 2990, categoryKey: "c" },
        { description: "x", counterpartyName: "Urban Sports Club", amountCents: 2990, categoryKey: "c" },
        { description: "x", counterpartyName: "Billa", amountCents: 5000, categoryKey: "c" },
        { description: "x", counterpartyName: "Tiny GmbH", amountCents: 300, categoryKey: "c" },
      ],
      new Set(["Billa"])
    );
    expect(out).toHaveLength(1);
    expect(out[0].headline).toContain("Urban Sports Club");
  });
});

describe("selectInsights", () => {
  it("returns at most 5, highest score first", () => {
    const mk = (score: number) => ({
      kind: "increase" as const,
      headline: `h${score}`,
      detail: "",
      score,
    });
    const out = selectInsights([mk(1), mk(9), mk(5), mk(7), mk(3), mk(8)]);
    expect(out.map((i) => i.score)).toEqual([9, 8, 7, 5, 3]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/insights/rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/insights/rules.ts`**

```ts
import { formatCurrency } from "@/lib/utils";

export interface CategoryPeriodTotal {
  key: string;
  name: string;
  currentCents: number;
  previousCents: number;
}

export interface TxSummary {
  description: string;
  counterpartyName: string | null;
  amountCents: number;
  categoryKey: string;
}

export type InsightKind =
  | "increase"
  | "decrease"
  | "new-category"
  | "unusual-expense"
  | "new-counterparty";

export interface Insight {
  kind: InsightKind;
  headline: string;
  detail: string;
  score: number;
}

export const MIN_DELTA_CENTS = 2500;
export const MIN_PERCENT = 20;
export const UNUSUAL_FACTOR = 3;
export const MAX_INSIGHTS = 5;

/** Biggest category increases/decreases vs. the previous period. */
export function categoryMovers(totals: CategoryPeriodTotal[]): Insight[] {
  const out: Insight[] = [];
  for (const t of totals) {
    const delta = t.currentCents - t.previousCents;
    if (Math.abs(delta) < MIN_DELTA_CENTS) continue;

    if (t.previousCents === 0) {
      out.push({
        kind: "new-category",
        headline: `${t.name} is new this period`,
        detail: `${formatCurrency(t.currentCents)} spent — nothing in the previous period`,
        score: t.currentCents,
      });
      continue;
    }

    const pct = (delta / t.previousCents) * 100;
    if (Math.abs(pct) < MIN_PERCENT) continue;

    out.push({
      kind: delta > 0 ? "increase" : "decrease",
      headline:
        delta > 0
          ? `${t.name} rose sharply vs. the previous period`
          : `${t.name} came down vs. the previous period`,
      detail: `${pct > 0 ? "+" : "−"}${Math.abs(Math.round(pct))} % · ${
        delta > 0 ? "+" : "−"
      }${formatCurrency(Math.abs(delta))}`,
      score: Math.abs(delta),
    });
  }
  return out;
}

/** Single expenses far above their category's typical size. */
export function unusualExpenses(
  current: TxSummary[],
  categoryMedianCents: Map<string, number>
): Insight[] {
  const out: Insight[] = [];
  for (const tx of current) {
    const median = categoryMedianCents.get(tx.categoryKey);
    if (!median || median <= 0) continue;
    if (tx.amountCents < MIN_DELTA_CENTS) continue;
    if (tx.amountCents <= median * UNUSUAL_FACTOR) continue;
    const label = tx.counterpartyName ?? tx.description;
    out.push({
      kind: "unusual-expense",
      headline: `Unusually large: ${formatCurrency(tx.amountCents)} at ${label}`,
      detail: `${(tx.amountCents / median).toFixed(1)}× the typical amount in this category`,
      score: tx.amountCents,
    });
  }
  return out;
}

/** Counterparties that did not appear in the previous period. */
export function newCounterparties(
  current: TxSummary[],
  previousNames: Set<string>
): Insight[] {
  const totals = new Map<string, { cents: number; count: number }>();
  for (const tx of current) {
    if (!tx.counterpartyName || previousNames.has(tx.counterpartyName)) continue;
    const e = totals.get(tx.counterpartyName) ?? { cents: 0, count: 0 };
    e.cents += tx.amountCents;
    e.count += 1;
    totals.set(tx.counterpartyName, e);
  }
  const out: Insight[] = [];
  for (const [name, { cents, count }] of totals) {
    if (cents < MIN_DELTA_CENTS) continue;
    out.push({
      kind: "new-counterparty",
      headline: `New counterparty: ${name}`,
      detail: `${count} payment${count === 1 ? "" : "s"} · ${formatCurrency(cents)} total`,
      score: cents,
    });
  }
  return out;
}

/** Top insights by significance. */
export function selectInsights(all: Insight[], max = MAX_INSIGHTS): Insight[] {
  return [...all].sort((a, b) => b.score - a.score).slice(0, max);
}
```

**Note:** before implementing, check `formatCurrency` in `src/lib/utils.ts` — this code assumes it takes **cents**. If it takes euros, divide by 100 at every call site above and in Task 6's footer.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/insights/rules.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Append `getInsightPanelData` to `src/actions/insights.ts`**

```ts
import {
  categoryMovers,
  unusualExpenses,
  newCounterparties,
  selectInsights,
  type CategoryPeriodTotal,
  type TxSummary,
} from "@/lib/insights/rules";

const MIN_PREVIOUS_TX = 5;

/**
 * Rule-based "What stands out" insights: selected period vs. the previous
 * period of equal length.
 */
export async function getInsightPanelData(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  const fetchPeriod = (start: Date, end: Date) =>
    db
      .select({
        description: transactions.description,
        counterpartyName: transactions.counterpartyName,
        amountCents: transactions.amountCents,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          gte(transactions.date, start),
          lte(transactions.date, end),
          isNull(transactions.deletedAt)
        )
      );

  const [currentRows, prevRows] = await Promise.all([
    fetchPeriod(startDate, endDate),
    fetchPeriod(prevStart, prevEnd),
  ]);

  if (prevRows.length < MIN_PREVIOUS_TX) {
    return { insights: [], hidden: true as const };
  }

  const key = (r: { categoryId: string | null }) => r.categoryId ?? "uncategorized";

  // Per-category totals for both periods.
  const totalsMap = new Map<string, CategoryPeriodTotal>();
  for (const r of currentRows) {
    const k = key(r);
    const e = totalsMap.get(k) ?? {
      key: k,
      name: r.categoryName ?? "Uncategorized",
      currentCents: 0,
      previousCents: 0,
    };
    e.currentCents += r.amountCents;
    totalsMap.set(k, e);
  }
  for (const r of prevRows) {
    const k = key(r);
    const e = totalsMap.get(k) ?? {
      key: k,
      name: r.categoryName ?? "Uncategorized",
      currentCents: 0,
      previousCents: 0,
    };
    e.previousCents += r.amountCents;
    totalsMap.set(k, e);
  }

  // Median per category across BOTH periods (typical transaction size).
  const byCat = new Map<string, number[]>();
  for (const r of [...currentRows, ...prevRows]) {
    const k = key(r);
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(r.amountCents);
  }
  const medians = new Map<string, number>();
  for (const [k, values] of byCat) {
    const sorted = [...values].sort((a, b) => a - b);
    medians.set(k, sorted[Math.floor(sorted.length / 2)]);
  }

  const toSummary = (r: (typeof currentRows)[number]): TxSummary => ({
    description: r.description,
    counterpartyName: r.counterpartyName,
    amountCents: r.amountCents,
    categoryKey: key(r),
  });

  const prevNames = new Set(
    prevRows.map((r) => r.counterpartyName).filter((n): n is string => !!n)
  );

  const insights = selectInsights([
    ...categoryMovers([...totalsMap.values()]),
    ...unusualExpenses(currentRows.map(toSummary), medians),
    ...newCounterparties(currentRows.map(toSummary), prevNames),
  ]);

  return { insights, hidden: insights.length === 0 };
}
```

- [ ] **Step 6: Create `src/components/insights/insight-panel.tsx`**

```tsx
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle } from "lucide-react";
import type { Insight, InsightKind } from "@/lib/insights/rules";

const KIND_STYLES: Record<
  InsightKind,
  { icon: React.ReactNode; chip: string; delta: string }
> = {
  increase: {
    icon: <TrendingUp className="h-4 w-4" />,
    chip: "bg-rose-500/15 text-rose-400",
    delta: "text-rose-400",
  },
  decrease: {
    icon: <TrendingDown className="h-4 w-4" />,
    chip: "bg-primary/15 text-primary",
    delta: "text-primary",
  },
  "new-category": {
    icon: <Sparkles className="h-4 w-4" />,
    chip: "bg-blue-500/15 text-blue-400",
    delta: "text-blue-400",
  },
  "new-counterparty": {
    icon: <Sparkles className="h-4 w-4" />,
    chip: "bg-blue-500/15 text-blue-400",
    delta: "text-blue-400",
  },
  "unusual-expense": {
    icon: <AlertTriangle className="h-4 w-4" />,
    chip: "bg-amber-500/15 text-amber-400",
    delta: "text-amber-400",
  },
};

export function InsightPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <h3 className="text-sm font-semibold">What stands out</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Compared with the previous period of the same length
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight, i) => {
          const s = KIND_STYLES[insight.kind];
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
            >
              <span
                className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${s.chip}`}
              >
                {s.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug">{insight.headline}</p>
                <p className={`mt-1 font-mono text-xs ${s.delta}`}>
                  {insight.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire into the page**

In `src/app/(dashboard)/insights/page.tsx`:
- Imports: `InsightPanel` and `getInsightPanelData`.
- Extend `Promise.all` with `getInsightPanelData(DEFAULT_USER_ID, startDate, endDate)` as `panel`.
- Directly below the page header (before `SpendingCalendar`), render:

```tsx
      {!panel.hidden && <InsightPanel insights={panel.insights} />}
```

- [ ] **Step 8: Full verification (logs!)**

```bash
npm run test && npx tsc --noEmit && npm run lint
curl -s "http://localhost:3000/insights?from=2026-04-01&to=2026-06-30" | grep -c "What stands out"
```

Expected: all green; grep ≥ 1 for a range whose previous quarter has ≥ 5 transactions. Save output.

- [ ] **Step 9: Commit**

```bash
git add src/lib/insights/rules.ts src/lib/insights/rules.test.ts src/components/insights/insight-panel.tsx src/actions/insights.ts "src/app/(dashboard)/insights/page.tsx"
git commit -m "feat(insights): rule-based What-stands-out panel"
```

---

### Task 8: End-to-end verification with logs (user-mandated proof)

**Files:** none (verification only)

- [ ] **Step 1: Full test suite + typecheck + lint, capture output**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: every suite green. Paste the vitest summary (files/tests counts) into the final report.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds; `/insights` listed as dynamic (ƒ). Paste the route table.

- [ ] **Step 3: Live smoke test against real data**

```bash
npm run start &   # or reuse dev server
sleep 5
# period control:
curl -s "http://localhost:3000/insights?from=2026-01-01&to=2026-03-31" | grep -o "Jan 1, 2026 – Mar 31, 2026"
# bad params fall back:
curl -s "http://localhost:3000/insights?from=nope&to=nope" | grep -oE "Jan 1, 2026 – Dec 31, 2026"
# all three new sections render:
for m in "Money Flow" "Which days cost you money?" "What stands out"; do
  printf '%s: ' "$m"
  curl -s "http://localhost:3000/insights?from=2026-04-01&to=2026-06-30" | grep -c "$m"
done
```

Expected: each grep ≥ 1 (if "What stands out" is 0, verify the chosen range's previous period really has ≥ 5 transactions and pick a range that does — the hide-when-thin behavior is by design and should be demonstrated too, with a sparse range).

- [ ] **Step 4: Report**

Paste the actual outputs of steps 1–3 (not summaries of them) in the completion message, then stop the server.

---

## Self-review notes

- Spec coverage: Stage 1 → Task 3; Sankey → Tasks 4–5; weekday heatmap → Task 6; panel → Task 7; quality/verification → Task 8. Error handling (bad params, empty states) covered in Tasks 3/4/6/7 via fallbacks and built-in empty states.
- `formatCurrency` unit (cents vs. euros) is flagged in Tasks 6 and 7 as a must-check before use.
- CVD constraint: Sankey uses `categoryPalette` order from `nivo-theme.ts`; node order comes from income/expense sort, and direct labels are built into the component — acceptable per spec.
