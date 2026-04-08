# Budget Insights & Optimizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a budget health scorecard and money flow visualization to the budget plan page, and create a new Budget Optimizer page with cut suggestions and an interactive what-if simulator.

**Architecture:** Page-native sections — scorecard + money flow built directly into the existing `/budget-plan` page, optimizer as a new sub-page at `/budget-plan/optimizer`. Business logic in `src/lib/budget-plan/`, server actions in `src/actions/`, UI components in `src/components/budget-plan/`.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + SQLite, Recharts + @nivo/sankey, Tailwind CSS 4, shadcn/ui, date-fns, lucide-react

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src/lib/budget-plan/scoring.ts` | Budget health score computation (pure functions) |
| `src/lib/budget-plan/suggestions.ts` | Cut suggestion generation (pure functions) |
| `src/actions/budget-score.ts` | Server action: getBudgetScore |
| `src/actions/cut-suggestions.ts` | Server action: getCutSuggestions |
| `src/actions/category-targets.ts` | Server actions: saveCategoryTargets, getCategoryTargets, simulateBudget |
| `src/components/budget-plan/budget-scorecard.tsx` | Scorecard UI (overall + per-tier scores) |
| `src/components/budget-plan/money-flow.tsx` | Money flow Sankey/list visualization |
| `src/components/budget-plan/money-flow-list.tsx` | Mobile nested list fallback for money flow |
| `src/components/budget-plan/optimizer-cta.tsx` | CTA button linking to optimizer page |
| `src/components/budget-plan/optimizer/cut-suggestion-card.tsx` | Individual cut suggestion card |
| `src/components/budget-plan/optimizer/cut-suggestions-list.tsx` | Filterable list of cut suggestions |
| `src/components/budget-plan/optimizer/what-if-simulator.tsx` | Interactive budget simulator |
| `src/components/budget-plan/optimizer/score-comparison.tsx` | Side panel showing score changes |
| `src/app/(dashboard)/budget-plan/optimizer/page.tsx` | Optimizer page |
| `src/app/(dashboard)/budget-plan/optimizer/loading.tsx` | Optimizer loading skeleton |

### Modified Files

| File | Changes |
|---|---|
| `src/lib/db/schema.ts` | Add `categoryTargets` table |
| `src/lib/db/init.ts` | Add migration for `categoryTargets` table |
| `src/app/(dashboard)/budget-plan/page.tsx` | Add scorecard + money flow sections above existing content |
| `src/components/budget-plan/budget-insights-view.tsx` | Accept and render scorecard + money flow + optimizer CTA |

---

## Task 1: Database — categoryTargets Table

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/init.ts`

- [ ] **Step 1: Add categoryTargets table to schema**

In `src/lib/db/schema.ts`, add the new table after the existing `budgets` table definition:

```typescript
export const categoryTargets = sqliteTable(
  "category_targets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    categoryId: text("category_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    period: text("period").notNull().default("monthly"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("category_targets_user_idx").on(table.userId),
    index("category_targets_user_category_idx").on(table.userId, table.categoryId),
  ]
);
```

Add the relation after the existing relations:

```typescript
export const categoryTargetsRelations = relations(categoryTargets, ({ one }) => ({
  user: one(users, {
    fields: [categoryTargets.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [categoryTargets.categoryId],
    references: [categories.id],
  }),
}));
```

- [ ] **Step 2: Add migration in init.ts**

In `src/lib/db/init.ts`, inside the `runMigrations()` function, add a new migration block following the existing pattern:

```typescript
// Migration: Add category_targets table
try {
  db.run(sql.raw(`
    CREATE TABLE IF NOT EXISTS category_targets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS category_targets_user_idx ON category_targets(user_id)`));
  db.run(sql.raw(`CREATE INDEX IF NOT EXISTS category_targets_user_category_idx ON category_targets(user_id, category_id)`));
} catch (e) {
  // Migration already applied
}
```

- [ ] **Step 3: Verify migration runs**

Run: `npm run dev` (start the dev server briefly to trigger ensureDb())

Expected: No errors. The `category_targets` table is created in the SQLite database.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/init.ts
git commit -m "feat: add categoryTargets table for custom budget targets"
```

---

## Task 2: Scoring Algorithm — Pure Business Logic

**Files:**
- Create: `src/lib/budget-plan/scoring.ts`

- [ ] **Step 1: Define types and constants**

Create `src/lib/budget-plan/scoring.ts`:

```typescript
import { TIER_TARGETS, type BudgetTier } from "./tiers";

export interface TierScore {
  tier: "needs" | "wants" | "savings";
  score: number; // 0-100
  targetAdherence: number; // 0-100
  trend: number; // 0-100
  customTargetCompliance: number; // 0-100
}

export interface BudgetScore {
  overall: number; // 0-100
  tiers: TierScore[];
}

export interface TierSpending {
  tier: "needs" | "wants" | "savings";
  amountCents: number;
}

export interface CategorySpendingHistory {
  categoryId: string;
  tier: "needs" | "wants" | "savings";
  currentAmountCents: number;
  avg3MonthCents: number;
  targetCents: number | null; // null = no custom target
}

const TIER_WEIGHTS = { needs: 0.4, wants: 0.35, savings: 0.25 } as const;
const ADHERENCE_WEIGHT = 0.6;
const TREND_WEIGHT = 0.25;
const COMPLIANCE_WEIGHT = 0.15;
```

- [ ] **Step 2: Implement computeTargetAdherence**

Add to `src/lib/budget-plan/scoring.ts`:

```typescript
/**
 * Computes how close tier spending is to the 50/30/20 target.
 * At target = 100, at 2x target = 0, linear interpolation.
 * Under target = 100 (no bonus for underspending).
 */
export function computeTargetAdherence(
  tierAmountCents: number,
  incomeCents: number,
  tier: "needs" | "wants" | "savings"
): number {
  if (incomeCents <= 0) return 0;
  const targetPct = TIER_TARGETS[tier]; // e.g. 50
  const targetCents = (incomeCents * targetPct) / 100;
  if (tierAmountCents <= targetCents) return 100;
  // Linear from 100 at target to 0 at 2x target
  const overRatio = (tierAmountCents - targetCents) / targetCents;
  return Math.max(0, Math.round(100 - overRatio * 100));
}
```

- [ ] **Step 3: Implement computeTrendScore**

Add to `src/lib/budget-plan/scoring.ts`:

```typescript
/**
 * Compares current spending to 3-month average.
 * Flat or decreasing = 100. Increasing = penalized proportionally.
 * Doubling vs average = 0.
 */
export function computeTrendScore(
  currentCents: number,
  avg3MonthCents: number
): number {
  if (avg3MonthCents <= 0) return 100; // No history = no penalty
  if (currentCents <= avg3MonthCents) return 100;
  const increaseRatio = (currentCents - avg3MonthCents) / avg3MonthCents;
  return Math.max(0, Math.round(100 - increaseRatio * 100));
}
```

- [ ] **Step 4: Implement computeCustomTargetCompliance**

Add to `src/lib/budget-plan/scoring.ts`:

```typescript
/**
 * Percentage of categories within the tier that are under their custom targets.
 * Categories without targets are ignored. If no targets exist, returns 100.
 */
export function computeCustomTargetCompliance(
  categories: CategorySpendingHistory[]
): number {
  const withTargets = categories.filter((c) => c.targetCents !== null);
  if (withTargets.length === 0) return 100;
  const compliant = withTargets.filter(
    (c) => c.currentAmountCents <= c.targetCents!
  );
  return Math.round((compliant.length / withTargets.length) * 100);
}
```

- [ ] **Step 5: Implement computeBudgetScore (main function)**

Add to `src/lib/budget-plan/scoring.ts`:

```typescript
/**
 * Computes the full budget health score: overall + per-tier.
 */
export function computeBudgetScore(
  incomeCents: number,
  tierSpending: TierSpending[],
  tierHistories: Record<"needs" | "wants" | "savings", CategorySpendingHistory[]>,
  tierAvg3MonthCents: Record<"needs" | "wants" | "savings", number>
): BudgetScore {
  const tiers: TierScore[] = (["needs", "wants", "savings"] as const).map((tier) => {
    const spending = tierSpending.find((t) => t.tier === tier);
    const amountCents = spending?.amountCents ?? 0;
    const categories = tierHistories[tier] ?? [];
    const avg3Month = tierAvg3MonthCents[tier] ?? 0;

    const targetAdherence = computeTargetAdherence(amountCents, incomeCents, tier);
    const trend = computeTrendScore(amountCents, avg3Month);
    const customTargetCompliance = computeCustomTargetCompliance(categories);

    const score = Math.round(
      targetAdherence * ADHERENCE_WEIGHT +
      trend * TREND_WEIGHT +
      customTargetCompliance * COMPLIANCE_WEIGHT
    );

    return { tier, score, targetAdherence, trend, customTargetCompliance };
  });

  const overall = Math.round(
    tiers.reduce((sum, t) => sum + t.score * TIER_WEIGHTS[t.tier], 0)
  );

  return { overall, tiers };
}
```

- [ ] **Step 6: Export getScoreColor helper**

Add to `src/lib/budget-plan/scoring.ts`:

```typescript
export function getScoreColor(score: number): "green" | "amber" | "red" {
  if (score >= 80) return "green";
  if (score >= 50) return "amber";
  return "red";
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/budget-plan/scoring.ts
git commit -m "feat: add budget scoring algorithm (target adherence, trend, compliance)"
```

---

## Task 3: Cut Suggestions — Pure Business Logic

**Files:**
- Create: `src/lib/budget-plan/suggestions.ts`

- [ ] **Step 1: Define types**

Create `src/lib/budget-plan/suggestions.ts`:

```typescript
import type { BudgetTier } from "./tiers";

export interface CategoryMonthlySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  tier: "needs" | "wants" | "savings";
  currentCents: number;
  previousMonthCents: number;
  avg3MonthCents: number;
  consecutiveMonthsRising: number;
  targetCents: number | null;
}

export interface CutSuggestion {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  tier: "needs" | "wants" | "savings";
  currentCents: number;
  baselineCents: number; // avg3Month or previousMonth, whichever is lower
  savingsCents: number;
  pctChange: number; // % change vs baseline
  consecutiveMonthsRising: number;
  exceedsTarget: boolean;
  targetCents: number | null;
}
```

- [ ] **Step 2: Implement generateCutSuggestions**

Add to `src/lib/budget-plan/suggestions.ts`:

```typescript
/**
 * Generates ranked cut suggestions from spending data.
 * Only includes categories where current spending exceeds the baseline (avg3Month)
 * or exceeds a custom target. Ranked by potential savings descending.
 */
export function generateCutSuggestions(
  categories: CategoryMonthlySpending[]
): CutSuggestion[] {
  const suggestions: CutSuggestion[] = [];

  for (const cat of categories) {
    const baselineCents = Math.min(cat.avg3MonthCents, cat.previousMonthCents);
    const exceedsTarget =
      cat.targetCents !== null && cat.currentCents > cat.targetCents;
    const isAboveBaseline = cat.currentCents > baselineCents && baselineCents > 0;

    if (!isAboveBaseline && !exceedsTarget) continue;

    const savingsCents = isAboveBaseline
      ? cat.currentCents - baselineCents
      : exceedsTarget
        ? cat.currentCents - cat.targetCents!
        : 0;

    const pctChange =
      baselineCents > 0
        ? Math.round(((cat.currentCents - baselineCents) / baselineCents) * 100)
        : 0;

    suggestions.push({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      categoryIcon: cat.categoryIcon,
      tier: cat.tier,
      currentCents: cat.currentCents,
      baselineCents,
      savingsCents,
      pctChange,
      consecutiveMonthsRising: cat.consecutiveMonthsRising,
      exceedsTarget,
      targetCents: cat.targetCents,
    });
  }

  // Sort by potential savings descending
  suggestions.sort((a, b) => b.savingsCents - a.savingsCents);

  return suggestions;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/budget-plan/suggestions.ts
git commit -m "feat: add cut suggestion generation with trend and target analysis"
```

---

## Task 4: Server Actions — Budget Score & Suggestions

**Files:**
- Create: `src/actions/budget-score.ts`
- Create: `src/actions/cut-suggestions.ts`
- Create: `src/actions/category-targets.ts`

- [ ] **Step 1: Create getBudgetScore server action**

Create `src/actions/budget-score.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { transactions, categories, categoryTargets } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { computeNetSpending } from "@/lib/spending/net-spending";
import { getCategoryTier, type BudgetTier } from "@/lib/budget-plan/tiers";
import {
  computeBudgetScore,
  type BudgetScore,
  type TierSpending,
  type CategorySpendingHistory,
} from "@/lib/budget-plan/scoring";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
} from "date-fns";

export async function getBudgetScore(
  userId: string,
  month: Date
): Promise<BudgetScore | null> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // Get current month transactions
  const currentTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd)
      )
    );

  if (currentTxs.length === 0) return null;

  // Get income
  const incomeCents = currentTxs
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  if (incomeCents <= 0) return null;

  // Get current net spending by category
  const netSpending = computeNetSpending(currentTxs);

  // Get category metadata
  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map((c) => [c.id, c]));

  // Build current tier spending
  const tierTotals: Record<"needs" | "wants" | "savings", number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };

  for (const [catId, spending] of netSpending) {
    if (!catId || spending.netSpending <= 0) continue;
    const cat = catMap.get(catId);
    const tier = getCategoryTier(catId, cat?.budgetTier);
    if (tier === "needs" || tier === "wants" || tier === "savings") {
      tierTotals[tier] += spending.netSpending;
    } else if (tier === "other") {
      tierTotals.wants += spending.netSpending; // "other" buckets into wants
    }
  }

  const tierSpending: TierSpending[] = [
    { tier: "needs", amountCents: tierTotals.needs },
    { tier: "wants", amountCents: tierTotals.wants },
    { tier: "savings", amountCents: tierTotals.savings },
  ];

  // Get previous 3 months for trend
  const tierAvg3MonthCents: Record<"needs" | "wants" | "savings", number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };

  for (let i = 1; i <= 3; i++) {
    const prevMonth = subMonths(month, i);
    const prevStart = startOfMonth(prevMonth);
    const prevEnd = endOfMonth(prevMonth);

    const prevTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, prevStart),
          lte(transactions.date, prevEnd)
        )
      );

    const prevNet = computeNetSpending(prevTxs);

    for (const [catId, spending] of prevNet) {
      if (!catId || spending.netSpending <= 0) continue;
      const cat = catMap.get(catId);
      const tier = getCategoryTier(catId, cat?.budgetTier);
      if (tier === "needs" || tier === "wants" || tier === "savings") {
        tierAvg3MonthCents[tier] += spending.netSpending;
      } else if (tier === "other") {
        tierAvg3MonthCents.wants += spending.netSpending;
      }
    }
  }

  // Average the 3-month totals
  tierAvg3MonthCents.needs = Math.round(tierAvg3MonthCents.needs / 3);
  tierAvg3MonthCents.wants = Math.round(tierAvg3MonthCents.wants / 3);
  tierAvg3MonthCents.savings = Math.round(tierAvg3MonthCents.savings / 3);

  // Get custom targets
  const targets = await db
    .select()
    .from(categoryTargets)
    .where(eq(categoryTargets.userId, userId));

  const targetMap = new Map(targets.map((t) => [t.categoryId, t.amountCents]));

  // Build category spending histories by tier
  const tierHistories: Record<"needs" | "wants" | "savings", CategorySpendingHistory[]> = {
    needs: [],
    wants: [],
    savings: [],
  };

  for (const [catId, spending] of netSpending) {
    if (!catId || spending.netSpending <= 0) continue;
    const cat = catMap.get(catId);
    let tier = getCategoryTier(catId, cat?.budgetTier);
    if (tier === "other") tier = "wants" as BudgetTier;
    if (tier !== "needs" && tier !== "wants" && tier !== "savings") continue;

    tierHistories[tier as "needs" | "wants" | "savings"].push({
      categoryId: catId,
      tier: tier as "needs" | "wants" | "savings",
      currentAmountCents: spending.netSpending,
      avg3MonthCents: 0, // per-category avg not needed for compliance check
      targetCents: targetMap.get(catId) ?? null,
    });
  }

  return computeBudgetScore(
    incomeCents,
    tierSpending,
    tierHistories,
    tierAvg3MonthCents
  );
}
```

- [ ] **Step 2: Create getCutSuggestions server action**

Create `src/actions/cut-suggestions.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { transactions, categories, categoryTargets } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { computeNetSpending } from "@/lib/spending/net-spending";
import { getCategoryTier } from "@/lib/budget-plan/tiers";
import {
  generateCutSuggestions,
  type CategoryMonthlySpending,
  type CutSuggestion,
} from "@/lib/budget-plan/suggestions";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export async function getCutSuggestions(
  userId: string,
  month: Date
): Promise<CutSuggestion[]> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  // Fetch current month
  const currentTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd)
      )
    );

  const currentNet = computeNetSpending(currentTxs);

  // Fetch previous month
  const prevStart = startOfMonth(subMonths(month, 1));
  const prevEnd = endOfMonth(subMonths(month, 1));
  const prevTxs = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, prevStart),
        lte(transactions.date, prevEnd)
      )
    );
  const prevNet = computeNetSpending(prevTxs);

  // Fetch 3-month average (months -1, -2, -3)
  const monthlyNets: Map<string | null, number>[] = [];
  for (let i = 1; i <= 3; i++) {
    const mStart = startOfMonth(subMonths(month, i));
    const mEnd = endOfMonth(subMonths(month, i));
    const mTxs = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, mStart),
          lte(transactions.date, mEnd)
        )
      );
    const mNet = computeNetSpending(mTxs);
    const catTotals = new Map<string | null, number>();
    for (const [catId, s] of mNet) {
      catTotals.set(catId, s.netSpending);
    }
    monthlyNets.push(catTotals);
  }

  // Compute consecutive months rising (check up to 6 months back)
  const risingMonths = new Map<string, number>();
  const allCatIds = new Set<string>();
  for (const [catId] of currentNet) {
    if (catId) allCatIds.add(catId);
  }

  for (const catId of allCatIds) {
    let consecutive = 0;
    let prevAmount = currentNet.get(catId)?.netSpending ?? 0;
    for (let i = 1; i <= 6; i++) {
      const mStart = startOfMonth(subMonths(month, i));
      const mEnd = endOfMonth(subMonths(month, i));
      const mTxs = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, mStart),
            lte(transactions.date, mEnd)
          )
        );
      const mNet = computeNetSpending(mTxs);
      const mAmount = mNet.get(catId)?.netSpending ?? 0;
      if (prevAmount > mAmount && mAmount > 0) {
        consecutive++;
        prevAmount = mAmount;
      } else {
        break;
      }
    }
    risingMonths.set(catId, consecutive);
  }

  // Get category metadata and targets
  const allCategories = await db.select().from(categories);
  const catMap = new Map(allCategories.map((c) => [c.id, c]));

  const targets = await db
    .select()
    .from(categoryTargets)
    .where(eq(categoryTargets.userId, userId));
  const targetMap = new Map(targets.map((t) => [t.categoryId, t.amountCents]));

  // Build CategoryMonthlySpending array
  const catSpending: CategoryMonthlySpending[] = [];

  for (const [catId, spending] of currentNet) {
    if (!catId || spending.netSpending <= 0) continue;
    const cat = catMap.get(catId);
    if (!cat) continue;

    let tier = getCategoryTier(catId, cat.budgetTier);
    if (tier === "other") tier = "wants";
    if (tier !== "needs" && tier !== "wants" && tier !== "savings") continue;

    const prevSpending = prevNet.get(catId)?.netSpending ?? 0;
    const avg3Month = Math.round(
      monthlyNets.reduce((sum, m) => sum + (m.get(catId) ?? 0), 0) / 3
    );

    catSpending.push({
      categoryId: catId,
      categoryName: cat.nameDE || cat.name,
      categoryIcon: cat.icon,
      tier: tier as "needs" | "wants" | "savings",
      currentCents: spending.netSpending,
      previousMonthCents: prevSpending,
      avg3MonthCents: avg3Month,
      consecutiveMonthsRising: risingMonths.get(catId) ?? 0,
      targetCents: targetMap.get(catId) ?? null,
    });
  }

  return generateCutSuggestions(catSpending);
}
```

- [ ] **Step 3: Create category targets server actions**

Create `src/actions/category-targets.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { categoryTargets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { computeBudgetScore, type BudgetScore, type TierSpending, type CategorySpendingHistory } from "@/lib/budget-plan/scoring";
import { TIER_TARGETS } from "@/lib/budget-plan/tiers";

export interface CategoryTargetInput {
  categoryId: string;
  amountCents: number;
}

export async function saveCategoryTargets(
  userId: string,
  targets: CategoryTargetInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const target of targets) {
      // Upsert: delete existing, then insert
      await db
        .delete(categoryTargets)
        .where(
          and(
            eq(categoryTargets.userId, userId),
            eq(categoryTargets.categoryId, target.categoryId)
          )
        );

      await db.insert(categoryTargets).values({
        id: nanoid(),
        userId,
        categoryId: target.categoryId,
        amountCents: target.amountCents,
        period: "monthly",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    revalidatePath("/budget-plan");
    revalidatePath("/budget-plan/optimizer");
    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to save targets" };
  }
}

export async function getCategoryTargets(
  userId: string
): Promise<Map<string, number>> {
  const targets = await db
    .select()
    .from(categoryTargets)
    .where(eq(categoryTargets.userId, userId));

  return new Map(targets.map((t) => [t.categoryId, t.amountCents]));
}

/**
 * Client-callable simulation: takes hypothetical amounts per category,
 * recomputes budget score without persisting.
 */
export async function simulateBudget(
  incomeCents: number,
  adjustments: { categoryId: string; amountCents: number; tier: "needs" | "wants" | "savings"; targetCents: number | null }[]
): Promise<BudgetScore> {
  // Aggregate by tier
  const tierTotals: Record<"needs" | "wants" | "savings", number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };

  for (const adj of adjustments) {
    tierTotals[adj.tier] += adj.amountCents;
  }

  const tierSpending: TierSpending[] = [
    { tier: "needs", amountCents: tierTotals.needs },
    { tier: "wants", amountCents: tierTotals.wants },
    { tier: "savings", amountCents: tierTotals.savings },
  ];

  // Build category histories for compliance check
  const tierHistories: Record<"needs" | "wants" | "savings", CategorySpendingHistory[]> = {
    needs: [],
    wants: [],
    savings: [],
  };

  for (const adj of adjustments) {
    tierHistories[adj.tier].push({
      categoryId: adj.categoryId,
      tier: adj.tier,
      currentAmountCents: adj.amountCents,
      avg3MonthCents: 0,
      targetCents: adj.targetCents,
    });
  }

  // For simulation, trend is irrelevant — use 100 (no penalty)
  const tierAvg3MonthCents: Record<"needs" | "wants" | "savings", number> = {
    needs: tierTotals.needs, // same = no trend penalty
    wants: tierTotals.wants,
    savings: tierTotals.savings,
  };

  return computeBudgetScore(incomeCents, tierSpending, tierHistories, tierAvg3MonthCents);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/budget-score.ts src/actions/cut-suggestions.ts src/actions/category-targets.ts
git commit -m "feat: add server actions for budget score, cut suggestions, and category targets"
```

---

## Task 5: Budget Scorecard Component

**Files:**
- Create: `src/components/budget-plan/budget-scorecard.tsx`

- [ ] **Step 1: Create the scorecard component**

Create `src/components/budget-plan/budget-scorecard.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { getScoreColor, type BudgetScore } from "@/lib/budget-plan/scoring";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";
import { ShieldCheck, ShoppingBag, PiggyBank, Activity } from "lucide-react";

const TIER_ICONS = {
  needs: ShieldCheck,
  wants: ShoppingBag,
  savings: PiggyBank,
} as const;

const SCORE_STYLES = {
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-500",
    label: "On track",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-500",
    label: "Needs attention",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-red-500",
    label: "Over budget",
  },
} as const;

interface BudgetScorecardProps {
  score: BudgetScore;
}

export function BudgetScorecard({ score }: BudgetScorecardProps) {
  const overallColor = getScoreColor(score.overall);
  const styles = SCORE_STYLES[overallColor];

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border p-6 text-center",
          styles.bg,
          styles.border
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <Activity className={cn("h-5 w-5", styles.text)} />
          <p className="text-sm font-medium text-muted-foreground">
            Budget Health Score
          </p>
          <div className={cn("text-5xl font-bold tabular-nums", styles.text)}>
            {score.overall}
          </div>
          <p className={cn("text-sm font-medium", styles.text)}>
            {styles.label}
          </p>
        </div>
      </div>

      {/* Per-Tier Scores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {score.tiers.map((tierScore) => {
          const color = getScoreColor(tierScore.score);
          const tierStyles = SCORE_STYLES[color];
          const Icon = TIER_ICONS[tierScore.tier];

          return (
            <div
              key={tierScore.tier}
              className={cn(
                "rounded-lg border p-4",
                tierStyles.bg,
                tierStyles.border
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-4 w-4", tierStyles.text)} />
                <span className="text-sm font-medium">
                  {TIER_LABELS[tierScore.tier]}
                </span>
              </div>
              <div className={cn("text-3xl font-bold tabular-nums", tierStyles.text)}>
                {tierScore.score}
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Target</span>
                  <span>{tierScore.targetAdherence}/100</span>
                </div>
                <div className="flex justify-between">
                  <span>Trend</span>
                  <span>{tierScore.trend}/100</span>
                </div>
                <div className="flex justify-between">
                  <span>Targets</span>
                  <span>{tierScore.customTargetCompliance}/100</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/budget-plan/budget-scorecard.tsx
git commit -m "feat: add budget health scorecard component"
```

---

## Task 6: Money Flow Visualization

**Files:**
- Create: `src/components/budget-plan/money-flow.tsx`
- Create: `src/components/budget-plan/money-flow-list.tsx`

- [ ] **Step 1: Create the mobile-friendly list fallback**

Create `src/components/budget-plan/money-flow-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";

export interface MoneyFlowCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  amountCents: number;
  pctOfIncome: number;
  counterparties: { name: string; amountCents: number }[];
}

export interface MoneyFlowTier {
  tier: "needs" | "wants" | "savings";
  amountCents: number;
  pctOfIncome: number;
  categories: MoneyFlowCategory[];
}

export interface MoneyFlowData {
  incomeCents: number;
  tiers: MoneyFlowTier[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function MoneyFlowList({ data }: { data: MoneyFlowData }) {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {/* Income row */}
      <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-200 dark:border-emerald-800">
        <span className="font-medium">Income</span>
        <span className="font-semibold tabular-nums">
          {formatCurrency(data.incomeCents)}
        </span>
      </div>

      {/* Tier rows */}
      {data.tiers.map((tier) => (
        <div key={tier.tier}>
          <button
            onClick={() =>
              setExpandedTier(expandedTier === tier.tier ? null : tier.tier)
            }
            className={cn(
              "flex w-full items-center justify-between rounded-lg p-3 border transition-colors",
              "hover:bg-muted/50",
              expandedTier === tier.tier && "bg-muted/30"
            )}
          >
            <div className="flex items-center gap-2">
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedTier === tier.tier && "rotate-90"
                )}
              />
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: TIER_COLORS[tier.tier] }}
              />
              <span className="font-medium">{TIER_LABELS[tier.tier]}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {tier.pctOfIncome.toFixed(1)}%
              </span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(tier.amountCents)}
              </span>
            </div>
          </button>

          {/* Expanded categories */}
          {expandedTier === tier.tier && (
            <div className="ml-6 space-y-0.5 py-1">
              {tier.categories.map((cat) => (
                <div key={cat.categoryId}>
                  <button
                    onClick={() =>
                      setExpandedCat(
                        expandedCat === cat.categoryId ? null : cat.categoryId
                      )
                    }
                    className="flex w-full items-center justify-between rounded-md p-2 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {cat.counterparties.length > 0 && (
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform",
                            expandedCat === cat.categoryId && "rotate-90"
                          )}
                        />
                      )}
                      <span className="text-sm">
                        {cat.categoryIcon && `${cat.categoryIcon} `}
                        {cat.categoryName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {cat.pctOfIncome.toFixed(1)}%
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(cat.amountCents)}
                      </span>
                    </div>
                  </button>

                  {/* Expanded counterparties */}
                  {expandedCat === cat.categoryId &&
                    cat.counterparties.length > 0 && (
                      <div className="ml-8 space-y-0.5 py-1">
                        {cat.counterparties.map((cp) => (
                          <div
                            key={cp.name}
                            className="flex items-center justify-between rounded-md p-1.5 text-xs text-muted-foreground"
                          >
                            <span>{cp.name}</span>
                            <span className="tabular-nums">
                              {formatCurrency(cp.amountCents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the Sankey/desktop money flow component**

Create `src/components/budget-plan/money-flow.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";
import { MoneyFlowList, type MoneyFlowData } from "./money-flow-list";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

interface MoneyFlowProps {
  data: MoneyFlowData;
}

export function MoneyFlow({ data }: MoneyFlowProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  if (isMobile) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Where Your Money Goes</CardTitle>
        </CardHeader>
        <CardContent>
          <MoneyFlowList data={data} />
        </CardContent>
      </Card>
    );
  }

  // Build Sankey data: Income -> Tiers (level 1)
  // If a tier is expanded, also show Tier -> Categories (level 2)
  const nodes: { id: string; color?: string }[] = [
    { id: "Income", color: "#22c55e" },
  ];
  const links: { source: string; target: string; value: number }[] = [];

  for (const tier of data.tiers) {
    if (tier.amountCents <= 0) continue;
    const tierLabel = TIER_LABELS[tier.tier];
    nodes.push({ id: tierLabel, color: TIER_COLORS[tier.tier] });
    links.push({
      source: "Income",
      target: tierLabel,
      value: tier.amountCents / 100,
    });

    // If this tier is expanded, add category nodes
    if (expandedTier === tier.tier) {
      for (const cat of tier.categories) {
        if (cat.amountCents <= 0) continue;
        const catLabel = `${cat.categoryName}`;
        nodes.push({ id: catLabel, color: TIER_COLORS[tier.tier] });
        links.push({
          source: tierLabel,
          target: catLabel,
          value: cat.amountCents / 100,
        });
      }
    }
  }

  // Add unspent/savings remainder
  const totalSpent = data.tiers.reduce((s, t) => s + t.amountCents, 0);
  const remainder = data.incomeCents - totalSpent;
  if (remainder > 0) {
    nodes.push({ id: "Unallocated", color: "#94a3b8" });
    links.push({
      source: "Income",
      target: "Unallocated",
      value: remainder / 100,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Where Your Money Goes</CardTitle>
        <p className="text-xs text-muted-foreground">
          Click a tier to expand categories
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveSankey
            data={{ nodes, links }}
            margin={{ top: 10, right: 160, bottom: 10, left: 10 }}
            align="justify"
            colors={(node: { id: string; color?: string }) => node.color ?? "#94a3b8"}
            nodeOpacity={1}
            nodeHoverOpacity={1}
            nodeThickness={18}
            nodeSpacing={14}
            nodeBorderWidth={0}
            nodeBorderRadius={3}
            linkOpacity={0.3}
            linkHoverOpacity={0.6}
            linkContract={2}
            enableLinkGradient
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={12}
            labelTextColor={{ from: "color", modifiers: [["darker", 1]] }}
            nodeTooltip={({ node }) => (
              <div className="rounded-md bg-popover px-3 py-1.5 text-sm shadow-md border">
                <strong>{node.id}</strong>: {formatCurrency(node.value * 100)}
              </div>
            )}
            onClick={(nodeOrLink) => {
              // Check if it's a tier node click
              const tierEntry = data.tiers.find(
                (t) => TIER_LABELS[t.tier] === (nodeOrLink as { id?: string }).id
              );
              if (tierEntry) {
                setExpandedTier(
                  expandedTier === tierEntry.tier ? null : tierEntry.tier
                );
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create the useMediaQuery hook (if it doesn't exist)**

Check if `src/lib/hooks/use-media-query.ts` exists. If not, create it:

```typescript
"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/budget-plan/money-flow.tsx src/components/budget-plan/money-flow-list.tsx src/lib/hooks/use-media-query.ts
git commit -m "feat: add money flow visualization with Sankey chart and mobile list"
```

---

## Task 7: Optimizer CTA Button

**Files:**
- Create: `src/components/budget-plan/optimizer-cta.tsx`

- [ ] **Step 1: Create the CTA component**

Create `src/components/budget-plan/optimizer-cta.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OptimizerCtaProps {
  hasLowScore: boolean; // true if any tier score < 50
}

export function OptimizerCta({ hasLowScore }: OptimizerCtaProps) {
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");
  const href = monthParam
    ? `/budget-plan/optimizer?month=${monthParam}`
    : "/budget-plan/optimizer";

  return (
    <div className="flex justify-center">
      <Button asChild variant="outline" size="lg" className="group relative">
        <Link href={href}>
          {hasLowScore && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
          )}
          Optimize your budget
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/budget-plan/optimizer-cta.tsx
git commit -m "feat: add optimizer CTA button with attention indicator"
```

---

## Task 8: Integrate Scorecard + Money Flow into Budget Plan Page

**Files:**
- Modify: `src/app/(dashboard)/budget-plan/page.tsx`
- Modify: `src/components/budget-plan/budget-insights-view.tsx`

- [ ] **Step 1: Add data fetching to the budget plan page**

In `src/app/(dashboard)/budget-plan/page.tsx`, add imports and fetch the budget score and money flow data. Add these imports at the top:

```typescript
import { getBudgetScore } from "@/actions/budget-score";
```

Then in the page function, after the existing `getBudgetInsights` call, add:

```typescript
const budgetScore = await getBudgetScore(DEFAULT_USER_ID, targetDate);
```

Update the component rendering to pass the score:

```tsx
<BudgetInsightsView
  data={data}
  currentMonth={format(targetDate, "yyyy-MM")}
  budgetScore={budgetScore}
/>
```

- [ ] **Step 2: Build the money flow data from existing budget insights**

In `src/app/(dashboard)/budget-plan/page.tsx`, after the budgetScore fetch, build the money flow data from the existing `data` object:

```typescript
import type { MoneyFlowData } from "@/components/budget-plan/money-flow-list";
import { getCategoryTier, TIER_LABELS } from "@/lib/budget-plan/tiers";
```

```typescript
// Build money flow data from budget insights
const moneyFlowData: MoneyFlowData | null = data
  ? (() => {
      const tierMap = new Map<"needs" | "wants" | "savings", {
        amountCents: number;
        pctOfIncome: number;
        categories: MoneyFlowData["tiers"][0]["categories"];
      }>();

      for (const tier of ["needs", "wants", "savings"] as const) {
        tierMap.set(tier, { amountCents: 0, pctOfIncome: 0, categories: [] });
      }

      for (const cat of data.categories) {
        let tier = cat.tier as "needs" | "wants" | "savings";
        if (tier !== "needs" && tier !== "wants" && tier !== "savings") {
          tier = "wants";
        }
        const entry = tierMap.get(tier)!;
        entry.amountCents += cat.amountCents;
        entry.categories.push({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          categoryIcon: cat.categoryIcon ?? null,
          amountCents: cat.amountCents,
          pctOfIncome:
            data.income > 0
              ? Math.round((cat.amountCents / data.income) * 1000) / 10
              : 0,
          counterparties: [], // populated if we add counterparty query later
        });
      }

      const tiers = (["needs", "wants", "savings"] as const).map((t) => {
        const entry = tierMap.get(t)!;
        return {
          tier: t,
          amountCents: entry.amountCents,
          pctOfIncome:
            data.income > 0
              ? Math.round((entry.amountCents / data.income) * 1000) / 10
              : 0,
          categories: entry.categories.sort(
            (a, b) => b.amountCents - a.amountCents
          ),
        };
      });

      return { incomeCents: data.income, tiers };
    })()
  : null;
```

Pass it to the view:

```tsx
<BudgetInsightsView
  data={data}
  currentMonth={format(targetDate, "yyyy-MM")}
  budgetScore={budgetScore}
  moneyFlowData={moneyFlowData}
/>
```

- [ ] **Step 3: Update BudgetInsightsView to render new sections**

In `src/components/budget-plan/budget-insights-view.tsx`, add the new props and components. Add imports:

```typescript
import { BudgetScorecard } from "./budget-scorecard";
import { MoneyFlow } from "./money-flow";
import { OptimizerCta } from "./optimizer-cta";
import type { BudgetScore } from "@/lib/budget-plan/scoring";
import type { MoneyFlowData } from "./money-flow-list";
```

Update the props interface to include:

```typescript
interface BudgetInsightsViewProps {
  data: BudgetInsightsData;
  currentMonth: string;
  budgetScore?: BudgetScore | null;
  moneyFlowData?: MoneyFlowData | null;
}
```

At the top of the component's return JSX, before the existing KPI cards, add:

```tsx
{/* Budget Health Scorecard */}
{budgetScore && (
  <BudgetScorecard score={budgetScore} />
)}

{/* Money Flow */}
{moneyFlowData && (
  <MoneyFlow data={moneyFlowData} />
)}

{/* Optimizer CTA */}
{budgetScore && (
  <OptimizerCta
    hasLowScore={budgetScore.tiers.some((t) => t.score < 50)}
  />
)}
```

- [ ] **Step 4: Verify the page renders**

Run: `npm run dev`

Navigate to `/budget-plan` in the browser. Verify:
- Scorecard shows at the top with overall + 3 tier scores
- Money flow chart renders below (Sankey on desktop, list on mobile)
- Optimizer CTA button appears
- Existing content (KPI cards, 50/30/20 bar, donut, table) still renders below

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/budget-plan/page.tsx src/components/budget-plan/budget-insights-view.tsx
git commit -m "feat: integrate scorecard and money flow into budget plan page"
```

---

## Task 9: Cut Suggestions Components

**Files:**
- Create: `src/components/budget-plan/optimizer/cut-suggestion-card.tsx`
- Create: `src/components/budget-plan/optimizer/cut-suggestions-list.tsx`

- [ ] **Step 1: Create the individual suggestion card**

Create `src/components/budget-plan/optimizer/cut-suggestion-card.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import type { CutSuggestion } from "@/lib/budget-plan/suggestions";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

interface CutSuggestionCardProps {
  suggestion: CutSuggestion;
}

export function CutSuggestionCard({ suggestion }: CutSuggestionCardProps) {
  const {
    categoryName,
    categoryIcon,
    tier,
    currentCents,
    baselineCents,
    savingsCents,
    pctChange,
    consecutiveMonthsRising,
    exceedsTarget,
    targetCents,
  } = suggestion;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {categoryIcon && <span className="text-lg">{categoryIcon}</span>}
          <div>
            <p className="font-medium">{categoryName}</p>
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: TIER_COLORS[tier] }}
              />
              <span className="text-xs text-muted-foreground">
                {TIER_LABELS[tier]}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums text-lg">
            {formatCurrency(currentCents)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            avg {formatCurrency(baselineCents)}
          </p>
        </div>
      </div>

      {/* Trend and savings info */}
      <div className="flex flex-wrap gap-2">
        {pctChange > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400">
            <TrendingUp className="h-3 w-3" />
            {pctChange}%
          </div>
        )}

        {consecutiveMonthsRising > 0 && (
          <div className="rounded-full bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 text-xs font-medium text-orange-700 dark:text-orange-400">
            Rising {consecutiveMonthsRising} month{consecutiveMonthsRising > 1 ? "s" : ""}
          </div>
        )}

        {exceedsTarget && targetCents !== null && (
          <div className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Over target ({formatCurrency(targetCents)})
          </div>
        )}
      </div>

      {/* Savings potential */}
      <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 p-2.5">
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Potential savings:{" "}
          <span className="font-semibold">{formatCurrency(savingsCents)}/mo</span>
          {" "}
          <span className="text-emerald-600 dark:text-emerald-500">
            ({formatCurrency(savingsCents * 12)}/yr)
          </span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the filterable suggestions list**

Create `src/components/budget-plan/optimizer/cut-suggestions-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CutSuggestionCard } from "./cut-suggestion-card";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";
import type { CutSuggestion } from "@/lib/budget-plan/suggestions";

interface CutSuggestionsListProps {
  suggestions: CutSuggestion[];
}

const TIER_FILTERS = ["all", "needs", "wants", "savings"] as const;

export function CutSuggestionsList({ suggestions }: CutSuggestionsListProps) {
  const [filter, setFilter] = useState<(typeof TIER_FILTERS)[number]>("all");

  const filtered =
    filter === "all"
      ? suggestions
      : suggestions.filter((s) => s.tier === filter);

  const totalSavings = filtered.reduce((sum, s) => sum + s.savingsCents, 0);

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Cut Suggestions</h2>
        <div className="flex gap-1">
          {TIER_FILTERS.map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t)}
              className="text-xs"
            >
              {t === "all" ? "All" : TIER_LABELS[t]}
            </Button>
          ))}
        </div>
      </div>

      {/* Total savings summary */}
      {filtered.length > 0 && totalSavings > 0 && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          Total potential savings:{" "}
          <span className="font-bold">
            {new Intl.NumberFormat("de-AT", {
              style: "currency",
              currency: "EUR",
            }).format(totalSavings / 100)}
            /mo
          </span>
        </div>
      )}

      {/* Suggestion cards or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8" />
          <p className="font-medium">Looking good!</p>
          <p className="text-sm">No major areas to cut right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((suggestion) => (
            <CutSuggestionCard
              key={suggestion.categoryId}
              suggestion={suggestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/budget-plan/optimizer/cut-suggestion-card.tsx src/components/budget-plan/optimizer/cut-suggestions-list.tsx
git commit -m "feat: add cut suggestion card and filterable list components"
```

---

## Task 10: What-If Simulator Components

**Files:**
- Create: `src/components/budget-plan/optimizer/score-comparison.tsx`
- Create: `src/components/budget-plan/optimizer/what-if-simulator.tsx`

- [ ] **Step 1: Create the score comparison panel**

Create `src/components/budget-plan/optimizer/score-comparison.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { getScoreColor, type BudgetScore } from "@/lib/budget-plan/scoring";
import { TIER_LABELS } from "@/lib/budget-plan/tiers";
import { ArrowRight } from "lucide-react";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

const COLOR_MAP = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
} as const;

interface ScoreComparisonProps {
  currentScore: BudgetScore;
  simulatedScore: BudgetScore | null;
  totalSavingsCents: number;
}

export function ScoreComparison({
  currentScore,
  simulatedScore,
  totalSavingsCents,
}: ScoreComparisonProps) {
  const simScore = simulatedScore ?? currentScore;
  const scoreDiff = simScore.overall - currentScore.overall;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Impact Preview</h3>

      {/* Overall score comparison */}
      <div className="rounded-lg border p-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground">Overall Score</p>
        <div className="flex items-center justify-center gap-3">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              COLOR_MAP[getScoreColor(currentScore.overall)]
            )}
          >
            {currentScore.overall}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              COLOR_MAP[getScoreColor(simScore.overall)]
            )}
          >
            {simScore.overall}
          </span>
          {scoreDiff !== 0 && (
            <span
              className={cn(
                "text-sm font-medium",
                scoreDiff > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {scoreDiff > 0 ? "+" : ""}
              {scoreDiff}
            </span>
          )}
        </div>
      </div>

      {/* Per-tier scores */}
      <div className="space-y-2">
        {simScore.tiers.map((tier) => {
          const currentTier = currentScore.tiers.find(
            (t) => t.tier === tier.tier
          );
          const diff = tier.score - (currentTier?.score ?? 0);

          return (
            <div
              key={tier.tier}
              className="flex items-center justify-between text-sm"
            >
              <span>{TIER_LABELS[tier.tier]}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-muted-foreground">
                  {currentTier?.score ?? 0}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    COLOR_MAP[getScoreColor(tier.score)]
                  )}
                >
                  {tier.score}
                </span>
                {diff !== 0 && (
                  <span
                    className={cn(
                      "text-xs",
                      diff > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Savings summary */}
      {totalSavingsCents > 0 && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3 space-y-1 text-center">
          <p className="text-sm text-muted-foreground">Monthly savings</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatCurrency(totalSavingsCents)}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">
            {formatCurrency(totalSavingsCents * 12)}/year
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the what-if simulator**

Create `src/components/budget-plan/optimizer/what-if-simulator.tsx`:

```tsx
"use client";

import { useState, useCallback, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RotateCcw, Save } from "lucide-react";
import { TIER_LABELS, TIER_COLORS } from "@/lib/budget-plan/tiers";
import { type BudgetScore } from "@/lib/budget-plan/scoring";
import { simulateBudget } from "@/actions/category-targets";
import { saveCategoryTargets } from "@/actions/category-targets";
import { ScoreComparison } from "./score-comparison";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { toast } from "sonner";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export interface SimulatorCategory {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  tier: "needs" | "wants" | "savings";
  actualCents: number;
  targetCents: number | null;
}

interface WhatIfSimulatorProps {
  userId: string;
  incomeCents: number;
  categories: SimulatorCategory[];
  currentScore: BudgetScore;
}

export function WhatIfSimulator({
  userId,
  incomeCents,
  categories,
  currentScore,
}: WhatIfSimulatorProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaving] = useTransition();

  // Track adjusted amounts (cents)
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const cat of categories) {
      initial[cat.categoryId] = cat.actualCents;
    }
    return initial;
  });

  const [simulatedScore, setSimulatedScore] = useState<BudgetScore | null>(
    null
  );

  const totalActual = categories.reduce((s, c) => s + c.actualCents, 0);
  const totalAdjusted = Object.values(adjustments).reduce((s, v) => s + v, 0);
  const totalSavingsCents = Math.max(0, totalActual - totalAdjusted);

  const handleAdjust = useCallback(
    (categoryId: string, cents: number) => {
      const newAdj = { ...adjustments, [categoryId]: Math.max(0, cents) };
      setAdjustments(newAdj);

      // Debounced simulation via server action
      startTransition(async () => {
        const adjArray = categories.map((c) => ({
          categoryId: c.categoryId,
          amountCents: newAdj[c.categoryId] ?? c.actualCents,
          tier: c.tier,
          targetCents: c.targetCents,
        }));

        const result = await simulateBudget(incomeCents, adjArray);
        setSimulatedScore(result);
      });
    },
    [adjustments, categories, incomeCents]
  );

  const handleReset = () => {
    const initial: Record<string, number> = {};
    for (const cat of categories) {
      initial[cat.categoryId] = cat.actualCents;
    }
    setAdjustments(initial);
    setSimulatedScore(null);
  };

  const handleSaveTargets = () => {
    startSaving(async () => {
      const targets = categories
        .filter((c) => adjustments[c.categoryId] !== c.actualCents)
        .map((c) => ({
          categoryId: c.categoryId,
          amountCents: adjustments[c.categoryId],
        }));

      if (targets.length === 0) {
        toast.info("No changes to save");
        return;
      }

      const result = await saveCategoryTargets(userId, targets);
      if (result.success) {
        toast.success(`Saved ${targets.length} budget target${targets.length > 1 ? "s" : ""}`);
      } else {
        toast.error(result.error ?? "Failed to save targets");
      }
    });
  };

  // Group categories by tier
  const grouped = new Map<"needs" | "wants" | "savings", SimulatorCategory[]>();
  for (const tier of ["needs", "wants", "savings"] as const) {
    grouped.set(
      tier,
      categories
        .filter((c) => c.tier === tier)
        .sort((a, b) => b.actualCents - a.actualCents)
    );
  }

  const comparisonPanel = (
    <ScoreComparison
      currentScore={currentScore}
      simulatedScore={simulatedScore}
      totalSavingsCents={totalSavingsCents}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">What-If Simulator</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSaveTargets}
            disabled={isSaving || totalSavingsCents === 0}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Apply as targets
          </Button>
        </div>
      </div>

      <div className={cn("gap-6", isMobile ? "space-y-6" : "flex")}>
        {/* Category adjustments */}
        <div className={cn("space-y-6", isMobile ? "w-full" : "flex-1")}>
          {(["needs", "wants", "savings"] as const).map((tier) => {
            const cats = grouped.get(tier) ?? [];
            if (cats.length === 0) return null;

            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[tier] }}
                  />
                  <h3 className="text-sm font-semibold">
                    {TIER_LABELS[tier]}
                  </h3>
                </div>

                <div className="space-y-3">
                  {cats.map((cat) => {
                    const adjusted = adjustments[cat.categoryId] ?? cat.actualCents;
                    const maxVal = Math.max(cat.actualCents * 2, 1);
                    const isChanged = adjusted !== cat.actualCents;

                    return (
                      <div
                        key={cat.categoryId}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          isChanged && "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/10"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            {cat.categoryIcon && `${cat.categoryIcon} `}
                            {cat.categoryName}
                          </span>
                          <div className="flex items-center gap-2">
                            {isChanged && (
                              <span className="text-xs text-muted-foreground line-through tabular-nums">
                                {formatCurrency(cat.actualCents)}
                              </span>
                            )}
                            {isMobile ? (
                              <Input
                                type="number"
                                value={Math.round(adjusted / 100)}
                                onChange={(e) =>
                                  handleAdjust(
                                    cat.categoryId,
                                    Math.round(Number(e.target.value) * 100)
                                  )
                                }
                                className="w-24 h-8 text-right text-sm tabular-nums"
                                min={0}
                              />
                            ) : (
                              <span className="text-sm font-semibold tabular-nums w-20 text-right">
                                {formatCurrency(adjusted)}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isMobile && (
                          <Slider
                            value={[adjusted]}
                            onValueChange={([val]) =>
                              handleAdjust(cat.categoryId, val)
                            }
                            max={maxVal}
                            step={100} // 1 EUR steps
                            className="w-full"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Score comparison panel */}
        <div className={cn(isMobile ? "w-full" : "w-72 shrink-0")}>
          <div className="sticky top-4">{comparisonPanel}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/budget-plan/optimizer/score-comparison.tsx src/components/budget-plan/optimizer/what-if-simulator.tsx
git commit -m "feat: add what-if simulator with score comparison panel"
```

---

## Task 11: Optimizer Page

**Files:**
- Create: `src/app/(dashboard)/budget-plan/optimizer/page.tsx`
- Create: `src/app/(dashboard)/budget-plan/optimizer/loading.tsx`

- [ ] **Step 1: Create the optimizer page**

Create `src/app/(dashboard)/budget-plan/optimizer/page.tsx`:

```tsx
import { ensureDb } from "@/lib/db/init";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { getBudgetScore } from "@/actions/budget-score";
import { getCutSuggestions } from "@/actions/cut-suggestions";
import { getBudgetInsights } from "@/actions/budget-insights";
import { getCategoryTargets } from "@/actions/category-targets";
import { getCategoryTier } from "@/lib/budget-plan/tiers";
import { MonthPicker } from "@/components/budget-plan/month-picker";
import { CutSuggestionsList } from "@/components/budget-plan/optimizer/cut-suggestions-list";
import { WhatIfSimulator, type SimulatorCategory } from "@/components/budget-plan/optimizer/what-if-simulator";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DEFAULT_USER_ID = "local";

export default async function OptimizerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await ensureDb();
  const params = await searchParams;

  let targetDate = new Date();
  if (params.month) {
    const parsed = parseISO(params.month + "-01");
    if (!isNaN(parsed.getTime())) targetDate = parsed;
  }

  const currentMonth = format(targetDate, "yyyy-MM");
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);

  // Fetch all data in parallel
  const [budgetScore, suggestions, insightsData, targetMap] = await Promise.all([
    getBudgetScore(DEFAULT_USER_ID, targetDate),
    getCutSuggestions(DEFAULT_USER_ID, targetDate),
    getBudgetInsights(DEFAULT_USER_ID, monthStart, monthEnd),
    getCategoryTargets(DEFAULT_USER_ID),
  ]);

  // Build simulator categories from insights data
  const simulatorCategories: SimulatorCategory[] = [];
  if (insightsData) {
    for (const cat of insightsData.categories) {
      let tier = cat.tier as "needs" | "wants" | "savings";
      if (tier !== "needs" && tier !== "wants" && tier !== "savings") {
        tier = "wants";
      }

      simulatorCategories.push({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        categoryIcon: cat.categoryIcon ?? null,
        tier,
        actualCents: cat.amountCents,
        targetCents: targetMap.get(cat.categoryId) ?? null,
      });
    }
  }

  const backHref = params.month
    ? `/budget-plan?month=${params.month}`
    : "/budget-plan";

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Budget Optimizer</h1>
            <p className="text-sm text-muted-foreground">
              Find savings and simulate changes
            </p>
          </div>
        </div>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {!insightsData || !budgetScore ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
          <p className="font-medium">No data for this month</p>
          <p className="text-sm">
            Add income and expense transactions to see optimization suggestions.
          </p>
        </div>
      ) : (
        <>
          {/* Cut Suggestions */}
          <CutSuggestionsList suggestions={suggestions} />

          {/* Separator */}
          <div className="border-t" />

          {/* What-If Simulator */}
          <WhatIfSimulator
            userId={DEFAULT_USER_ID}
            incomeCents={insightsData.income}
            categories={simulatorCategories}
            currentScore={budgetScore}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update MonthPicker to support optimizer route**

The existing `MonthPicker` hardcodes the route to `/budget-plan`. Update it to accept an optional `basePath` prop. In `src/components/budget-plan/month-picker.tsx`, change:

```typescript
interface MonthPickerProps {
  currentMonth: string;
  basePath?: string;
}

export function MonthPicker({ currentMonth, basePath = "/budget-plan" }: MonthPickerProps) {
```

And update the `navigate` function to use `basePath`:

```typescript
const navigate = (newDate: Date) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set("month", format(newDate, "yyyy-MM"));
  router.push(`${basePath}?${params.toString()}`);
};
```

Then in the optimizer page, pass:

```tsx
<MonthPicker currentMonth={currentMonth} basePath="/budget-plan/optimizer" />
```

- [ ] **Step 3: Create loading skeleton**

Create `src/app/(dashboard)/budget-plan/optimizer/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function OptimizerLoading() {
  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Cut Suggestions */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>

      <div className="border-t" />

      {/* Simulator */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 w-72 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the full optimizer page**

Run: `npm run dev`

Navigate to `/budget-plan/optimizer` in the browser. Verify:
- Back arrow links to `/budget-plan`
- Month picker works and carries `?month` param
- Cut suggestions list renders with filter buttons
- What-if simulator shows categories with sliders
- Score comparison panel updates when adjusting sliders
- "Apply as targets" saves targets
- "Reset" restores original values
- Empty state shows when no data

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/budget-plan/optimizer/page.tsx src/app/(dashboard)/budget-plan/optimizer/loading.tsx src/components/budget-plan/month-picker.tsx
git commit -m "feat: add budget optimizer page with cut suggestions and simulator"
```

---

## Task 12: Final Integration & Polish

**Files:**
- Modify: `src/app/(dashboard)/budget-plan/page.tsx` (if any remaining wiring)
- Verify all pages work end-to-end

- [ ] **Step 1: Verify full flow end-to-end**

Run: `npm run dev`

Test the complete flow:
1. Go to `/budget-plan` — scorecard + money flow + CTA should render above existing content
2. Click "Optimize your budget" — should navigate to `/budget-plan/optimizer` with month param
3. On optimizer, adjust sliders — score comparison should update
4. Click "Apply as targets" — toast should confirm save
5. Navigate back to `/budget-plan` — scorecard should reflect new custom target compliance
6. Test month navigation on both pages
7. Test mobile responsive layout (resize browser to <640px)

- [ ] **Step 2: Run build check**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat: complete budget insights and optimizer integration"
```
