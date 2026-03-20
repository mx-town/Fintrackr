import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, categories } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const userId = "current-user-id"; // TODO: auth
  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  const data = await db
    .select({
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amountCents,
      type: transactions.type,
      currency: transactions.currency,
      category: categories.name,
      counterparty: transactions.counterpartyName,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(eq(transactions.userId, userId), isNull(transactions.deletedAt))
    )
    .orderBy(desc(transactions.date));

  if (format === "json") {
    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": 'attachment; filename="fintrackr-export.json"',
      },
    });
  }

  // CSV
  const header = "Date,Description,Amount,Type,Currency,Category,Counterparty";
  const rows = data.map((row) => {
    const amount = ((row.amount ?? 0) / 100).toFixed(2);
    return [
      row.date?.toISOString().slice(0, 10) ?? "",
      `"${(row.description ?? "").replace(/"/g, '""')}"`,
      amount,
      row.type ?? "",
      row.currency ?? "EUR",
      row.category ?? "",
      `"${(row.counterparty ?? "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="fintrackr-export.csv"',
    },
  });
}
