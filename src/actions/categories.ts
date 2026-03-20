"use server";

import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";

export async function getCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(
      or(eq(categories.userId, userId), isNull(categories.userId))
    )
    .orderBy(categories.sortOrder);
}

export async function createCategory(
  userId: string,
  data: {
    name: string;
    nameDE?: string;
    icon?: string;
    color?: string;
    parentId?: string;
  }
) {
  const [result] = await db
    .insert(categories)
    .values({
      userId,
      ...data,
    })
    .returning();
  return result;
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  data: {
    name?: string;
    nameDE?: string;
    icon?: string;
    color?: string;
    isHidden?: boolean;
  }
) {
  await db
    .update(categories)
    .set(data)
    .where(
      and(
        eq(categories.id, categoryId),
        or(eq(categories.userId, userId), isNull(categories.userId))
      )
    );
}
