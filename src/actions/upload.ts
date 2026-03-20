"use server";

import { db } from "@/lib/db";
import { uploads, transactions as txTable } from "@/lib/db/schema";
import { parseStatement } from "@/lib/parsers/registry";
import { deduplicateTransactions } from "@/lib/parsers/validate";
import { categorizeTransactions } from "@/lib/categorize/engine";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function processUpload(formData: FormData, userId: string) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const accountId = formData.get("accountId") as string | null;
  const startTime = Date.now();

  // Create upload record
  const uploadId = nanoid();
  await db.insert(uploads).values({
    id: uploadId,
    userId,
    accountId,
    fileName: file.name,
    fileType: file.name.split(".").pop() || "unknown",
    fileSizeBytes: file.size,
    status: "processing",
  });

  try {
    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    const content = file.name.endsWith(".pdf")
      ? buffer
      : buffer.toString("utf-8");

    // Parse
    const result = await parseStatement(content, file.name);

    if (result.errors.length > 0) {
      await db
        .update(uploads)
        .set({
          status: "failed",
          errorMessage: result.errors.join("; "),
          bankDetected: result.bankName,
          formatDetected: result.format,
        })
        .where(eq(uploads.id, uploadId));

      return {
        success: false,
        errors: result.errors,
        warnings: result.warnings,
      };
    }

    // Deduplicate against existing transactions
    const existingHashes = new Set(
      (
        await db
          .select({ hash: txTable.hash })
          .from(txTable)
          .where(eq(txTable.userId, userId))
      )
        .map((r) => r.hash)
        .filter(Boolean) as string[]
    );

    const { unique, duplicateCount } = deduplicateTransactions(
      result.transactions,
      existingHashes
    );

    // Insert transactions (uncategorized first)
    const insertedIds: string[] = [];
    for (const tx of unique) {
      const id = nanoid();
      insertedIds.push(id);
      await db.insert(txTable).values({
        id,
        userId,
        accountId,
        uploadId,
        date: tx.date,
        valueDate: tx.valueDate,
        description: tx.description,
        rawDescription: tx.rawDescription,
        type: tx.type,
        amountCents: tx.amountCents,
        currency: tx.currency,
        counterpartyName: tx.counterpartyName,
        counterpartyIban: tx.counterpartyIban,
        bankReference: tx.bankReference,
        hash: tx.hash,
      });
    }

    // Categorize all inserted transactions
    const toCateg = unique.map((tx, i) => ({
      id: insertedIds[i],
      description: tx.description,
      rawDescription: tx.rawDescription,
      amountCents: tx.amountCents,
      type: tx.type,
      counterpartyName: tx.counterpartyName,
      counterpartyIban: tx.counterpartyIban,
    }));

    const categories = await categorizeTransactions(toCateg, userId);

    // Update transactions with categories
    for (const cat of categories) {
      await db
        .update(txTable)
        .set({
          categoryId: cat.categoryId,
          categorySource: cat.source,
          categoryConfidence: cat.confidence,
        })
        .where(eq(txTable.id, cat.id));
    }

    // Update upload record
    const processingTime = Date.now() - startTime;
    await db
      .update(uploads)
      .set({
        status: "completed",
        bankDetected: result.bankName,
        formatDetected: result.format,
        transactionCount: unique.length,
        duplicateCount,
        processingTimeMs: processingTime,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        completedAt: new Date(),
      })
      .where(eq(uploads.id, uploadId));

    return {
      success: true,
      uploadId,
      transactionCount: unique.length,
      duplicateCount,
      bankDetected: result.bankName,
      warnings: result.warnings,
      processingTimeMs: processingTime,
    };
  } catch (error) {
    await db
      .update(uploads)
      .set({
        status: "failed",
        errorMessage: (error as Error).message,
      })
      .where(eq(uploads.id, uploadId));

    throw error;
  }
}
