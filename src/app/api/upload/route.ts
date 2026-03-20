import { NextRequest, NextResponse } from "next/server";
import { parseStatement } from "@/lib/parsers/registry";
import { db } from "@/lib/db";
import { transactions, uploads } from "@/lib/db/schema";
import { ensureDb, DEFAULT_USER_ID } from "@/lib/db/init";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await ensureDb();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json(
        { success: false, errors: ["No file provided"] },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const uploadId = nanoid();

    // Create upload record
    await db.insert(uploads).values({
      id: uploadId,
      userId: DEFAULT_USER_ID,
      fileName: file.name,
      fileType: file.name.split(".").pop() ?? "unknown",
      fileSizeBytes: file.size,
      status: "processing",
    });

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    const content = file.name.endsWith(".pdf")
      ? buffer
      : buffer.toString("utf-8");

    // Parse the statement
    const result = await parseStatement(content, file.name);

    if (result.errors.length > 0) {
      await db
        .update(uploads)
        .set({
          status: "failed",
          errorMessage: result.errors.join("; "),
          bankDetected: result.bankName,
          processingTimeMs: Date.now() - startTime,
          completedAt: new Date(),
        })
        .where(eq(uploads.id, uploadId));

      return NextResponse.json({
        success: false,
        bankDetected: result.bankName,
        errors: result.errors,
        warnings: result.warnings,
      });
    }

    // Auto-categorize using keyword matching
    const { categorizeInMemory } = await import("@/lib/categorize/simple");

    // Check existing hashes for dedup
    const existingHashes = new Set(
      (
        await db
          .select({ hash: transactions.hash })
          .from(transactions)
          .where(eq(transactions.userId, DEFAULT_USER_ID))
      )
        .map((r) => r.hash)
        .filter(Boolean)
    );

    // Insert transactions
    let added = 0;
    let duplicates = 0;

    for (const tx of result.transactions) {
      if (tx.hash && existingHashes.has(tx.hash)) {
        duplicates++;
        continue;
      }

      const categoryId = categorizeInMemory(tx.description, tx.type);

      await db.insert(transactions).values({
        id: nanoid(),
        userId: DEFAULT_USER_ID,
        date: tx.date,
        description: tx.description,
        rawDescription: tx.rawDescription,
        type: tx.type as "income" | "expense" | "transfer",
        amountCents: tx.amountCents,
        currency: tx.currency,
        counterpartyName: tx.counterpartyName,
        counterpartyIban: tx.counterpartyIban,
        bankReference: tx.bankReference,
        hash: tx.hash,
        categoryId,
        categorySource: categoryId ? "keyword" : null,
        uploadId,
      });

      added++;
    }

    const processingTime = Date.now() - startTime;

    // Update upload record
    await db
      .update(uploads)
      .set({
        status: "completed",
        bankDetected: result.bankName,
        transactionCount: added,
        duplicateCount: duplicates,
        processingTimeMs: processingTime,
        completedAt: new Date(),
      })
      .where(eq(uploads.id, uploadId));

    return NextResponse.json({
      success: true,
      uploadId,
      transactionCount: added,
      duplicateCount: duplicates,
      bankDetected: result.bankName,
      accountIban: result.accountIban,
      warnings: result.warnings,
      processingTimeMs: processingTime,
    });
  } catch (error) {
    console.error("[Upload API]", error);
    return NextResponse.json(
      { success: false, errors: [(error as Error).message] },
      { status: 500 }
    );
  }
}
