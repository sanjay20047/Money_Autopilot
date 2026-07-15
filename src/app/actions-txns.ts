"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { merchantRules, transactions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";

const categoryKeys = Object.keys(CATEGORIES) as [CategoryKey, ...CategoryKey[]];

// ---------------- edit / re-categorize ----------------

const editSchema = z.object({
  txnId: z.string().uuid(),
  merchant: z.string().trim().min(1).max(120),
  category: z.enum(categoryKeys),
  amount: z.coerce.number().positive().max(10_00_00_000),
  remember: z.string().optional(),
});

export async function updateTxnAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = editSchema.safeParse({
    txnId: formData.get("txnId"),
    merchant: formData.get("merchant"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    remember: formData.get("remember") ?? undefined,
  });
  if (!parsed.success) redirect("/spends");
  const { txnId, merchant, category, amount, remember } = parsed.data;

  const db = await getDb();
  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txnId), eq(transactions.userId, user.id)))
    .limit(1);
  if (!existing) redirect("/spends");

  await db
    .update(transactions)
    .set({ merchant, category, amountPaise: Math.round(amount * 100) })
    .where(eq(transactions.id, txnId));

  // "remember" → this merchant always gets this category from now on
  if (remember === "on") {
    await db
      .insert(merchantRules)
      .values({ userId: user.id, merchant: merchant.toLowerCase(), category })
      .onConflictDoUpdate({
        target: [merchantRules.userId, merchantRules.merchant],
        set: { category },
      });
  }

  revalidatePath("/", "layout");
  redirect("/spends");
}

export async function deleteTxnAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const txnId = String(formData.get("txnId") ?? "");
  const db = await getDb();
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, txnId), eq(transactions.userId, user.id)));
  revalidatePath("/", "layout");
  redirect("/spends");
}

// ---------------- manual entry ----------------

const manualSchema = z.object({
  type: z.enum(["debit", "credit"]),
  merchant: z.string().trim().min(1).max(120),
  category: z.enum(categoryKeys),
  amount: z.coerce.number().positive().max(10_00_00_000),
  date: z.coerce.date(),
});

export async function addManualTxnAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = manualSchema.safeParse({
    type: formData.get("type"),
    merchant: formData.get("merchant"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    redirect(`/spends?error=${encodeURIComponent("Check the transaction details")}`);
  }
  const { type, merchant, category, amount, date } = parsed.data;

  const db = await getDb();
  await db.insert(transactions).values({
    userId: user.id,
    amountPaise: Math.round(amount * 100),
    type,
    merchant,
    category,
    source: "manual",
    occurredAt: date,
    dedupeHash: createHash("sha256").update(`manual|${randomUUID()}`).digest("hex"),
  });

  revalidatePath("/", "layout");
  redirect("/spends");
}
