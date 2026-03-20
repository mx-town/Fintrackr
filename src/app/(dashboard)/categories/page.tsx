import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schema";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { eq, and, gte, lte, isNull } from "drizzle-orm";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";
import { CategoriesGrid } from "@/components/categories/categories-grid";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await ensureDb();

  const now = new Date();
  const sixMonthsAgo = subMonths(startOfMonth(now), 5);

  // Period ranges for the toggles
  const periodRanges = {
    month: { start: startOfMonth(now), end: endOfMonth(now) },
    "3m": { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) },
    ytd: { start: startOfYear(now), end: now },
    year: { start: subMonths(startOfMonth(now), 11), end: endOfMonth(now) },
  };

  // Broadest range across all periods + sparkline range
  const yearStart = periodRanges.year.start;
  const broadStart = sixMonthsAgo < yearStart ? sixMonthsAgo : yearStart;

  // All categories
  const allCategories = await db.select().from(categories);

  // Fetch all transactions (expense + income) in the broad window
  const broadTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, DEFAULT_USER_ID),
        gte(transactions.date, broadStart),
        lte(transactions.date, endOfMonth(now)),
        isNull(transactions.deletedAt)
      )
    );

  // Build parent/child map
  const parentCategories = allCategories.filter((c) => !c.parentId);
  const childMap = new Map<string, typeof allCategories>();
  for (const cat of allCategories) {
    if (cat.parentId) {
      const children = childMap.get(cat.parentId) ?? [];
      children.push(cat);
      childMap.set(cat.parentId, children);
    }
  }

  // Helper: aggregate expense + income per parent category from a tx list
  type CatAgg = { expense: number; income: number; count: number };
  function aggregateByParent(txList: typeof broadTx) {
    const map = new Map<string, CatAgg>();
    for (const tx of txList) {
      if (tx.type === "transfer") continue;
      const catId = tx.categoryId;
      if (!catId) continue;
      const cat = allCategories.find((c) => c.id === catId);
      if (!cat) continue;
      const parentId = cat.parentId ?? cat.id;
      const prev = map.get(parentId) ?? { expense: 0, income: 0, count: 0 };
      if (tx.type === "expense") {
        prev.expense += tx.amountCents;
      } else if (tx.type === "income") {
        prev.income += tx.amountCents;
      }
      prev.count += 1;
      map.set(parentId, prev);
    }
    return map;
  }

  // Compute spending per parent category for each period
  type PKey = keyof typeof periodRanges;
  const periodSpendingMaps = {} as Record<PKey, Map<string, CatAgg>>;
  for (const [key, range] of Object.entries(periodRanges) as [PKey, { start: Date; end: Date }][]) {
    const filtered = broadTx.filter((tx) => tx.date >= range.start && tx.date <= range.end);
    periodSpendingMaps[key] = aggregateByParent(filtered);
  }

  // Aggregate monthly data per parent category for sparklines (expense + income combined)
  const monthlyDataMap = new Map<string, Map<string, number>>();
  for (const tx of broadTx.filter((t) => t.date >= sixMonthsAgo && t.type !== "transfer")) {
    const catId = tx.categoryId;
    if (!catId) continue;
    const cat = allCategories.find((c) => c.id === catId);
    if (!cat) continue;
    const parentId = cat.parentId ?? cat.id;
    const monthKey = format(tx.date, "MMM yy");
    if (!monthlyDataMap.has(parentId)) {
      monthlyDataMap.set(parentId, new Map());
    }
    const m = monthlyDataMap.get(parentId)!;
    m.set(monthKey, (m.get(monthKey) ?? 0) + tx.amountCents);
  }

  // Build ordered monthly data per category
  function getMonthlyData(catId: string) {
    const m = monthlyDataMap.get(catId);
    const result: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, "MMM yy");
      result.push({ month: key, amount: (m?.get(key) ?? 0) / 100 });
    }
    return result;
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Categories
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click a category to see detailed spending breakdown, trends, and
          transactions.
        </p>
      </div>

      <CategoriesGrid
        items={parentCategories.map((cat) => {
          const children = childMap.get(cat.id) ?? [];
          const periodSpending = Object.fromEntries(
            (Object.keys(periodRanges) as PKey[]).map((k) => {
              const s = periodSpendingMaps[k].get(cat.id) ?? { expense: 0, income: 0, count: 0 };
              return [k, { expense: s.expense, income: s.income, count: s.count }];
            })
          ) as Record<PKey, { expense: number; income: number; count: number }>;
          return {
            id: cat.id,
            name: cat.name,
            nameDE: cat.nameDE,
            icon: cat.icon,
            color: cat.color,
            monthlyData: getMonthlyData(cat.id),
            periodSpending,
            children: children.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
          };
        })}
      />
    </div>
  );
}
