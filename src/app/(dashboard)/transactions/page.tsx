import { TransactionTable } from "@/components/transactions/transaction-table";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Upload } from "lucide-react";
import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { eq, and, gte, lte, isNull, desc, like, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await ensureDb();

  const params = await searchParams;

  // Build conditions
  const conditions = [
    eq(transactions.userId, DEFAULT_USER_ID),
    isNull(transactions.deletedAt),
  ];

  if (params.from) {
    conditions.push(gte(transactions.date, new Date(params.from)));
  }
  if (params.to) {
    conditions.push(lte(transactions.date, new Date(params.to)));
  }
  if (params.type) {
    conditions.push(eq(transactions.type, params.type as "income" | "expense" | "transfer"));
  }
  if (params.category) {
    conditions.push(eq(transactions.categoryId, params.category));
  }

  let txRows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(100);

  // Client-side search filter (description search)
  if (params.search) {
    const q = params.search.toLowerCase();
    txRows = txRows.filter((t) => t.description.toLowerCase().includes(q));
  }

  const totalCount = txRows.length;

  const cats = await db.select().from(categories);
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const txList = txRows.map((tx) => ({
    transaction: tx,
    category: tx.categoryId ? (catMap.get(tx.categoryId) ?? null) : null,
  }));

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Transactions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} transaction{totalCount !== 1 ? "s" : ""} found
          </p>
        </div>
        <DateRangePicker />
      </div>

      {txList.length > 0 ? (
        <TransactionTable transactions={txList} categories={cats} />
      ) : (
        <EmptyState
          icon={<Upload className="h-8 w-8 text-muted-foreground" />}
          title="No transactions yet"
          description="Upload a bank statement to see your transactions here."
          actionLabel="Upload Statement"
          actionHref="/upload"
        />
      )}
    </div>
  );
}
