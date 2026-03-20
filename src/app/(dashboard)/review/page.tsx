import { EmptyState } from "@/components/shared/empty-state";
import { ReviewQueue } from "@/components/transactions/review-queue";
import { getTransactionsForReview } from "@/actions/transactions";
import { getCategories } from "@/actions/categories";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  await ensureDb();

  const [reviewTxs, allCategories] = await Promise.all([
    getTransactionsForReview(DEFAULT_USER_ID),
    getCategories(DEFAULT_USER_ID),
  ]);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Review Queue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Transactions the AI is unsure about &middot; {reviewTxs.length} items
        </p>
      </div>

      {reviewTxs.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-[var(--color-income)]" />}
          title="All caught up!"
          description="No transactions need review. New uncertain categorizations will appear here automatically."
        />
      ) : (
        <ReviewQueue
          transactions={reviewTxs}
          categories={allCategories}
          userId={DEFAULT_USER_ID}
        />
      )}
    </div>
  );
}
