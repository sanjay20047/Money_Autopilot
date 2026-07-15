"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { funds, mfTxns, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fetchLatestNav, refreshUserNavs } from "@/lib/nav";

const assetClasses = ["equity", "debt", "gold", "hybrid"] as const;

const addFundSchema = z.object({
  name: z.string().trim().min(2).max(160),
  assetClass: z.enum(assetClasses),
  schemeCode: z.string().trim().regex(/^\d+$/).optional().or(z.literal("")),
  amount: z.coerce.number().positive().optional().or(z.literal("")),
  units: z.coerce.number().positive().optional().or(z.literal("")),
  date: z.coerce.date().optional().or(z.literal("")),
});

export async function addFundAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = addFundSchema.safeParse({
    name: formData.get("name"),
    assetClass: formData.get("assetClass"),
    schemeCode: formData.get("schemeCode") ?? "",
    amount: formData.get("amount") ?? "",
    units: formData.get("units") ?? "",
    date: formData.get("date") ?? "",
  });
  if (!parsed.success) {
    redirect(`/invest/add?error=${encodeURIComponent("Check the fund details and try again")}`);
  }
  const { name, assetClass, schemeCode, amount, units, date } = parsed.data;

  const db = await getDb();
  const [fund] = await db
    .insert(funds)
    .values({
      userId: user.id,
      name,
      assetClass,
      schemeCode: schemeCode || null,
    })
    .returning({ id: funds.id });

  // best-effort initial NAV fetch for feed-linked funds
  if (schemeCode) {
    try {
      const latest = await fetchLatestNav(schemeCode);
      if (latest) {
        await db
          .update(funds)
          .set({ currentNav: latest.nav, navDate: latest.date })
          .where(eq(funds.id, fund.id));
      }
    } catch {
      // NAV arrives on the next refresh
    }
  }

  // optional opening transaction
  if (typeof amount === "number" && typeof units === "number" && units > 0) {
    await db.insert(mfTxns).values({
      userId: user.id,
      fundId: fund.id,
      type: "buy",
      units,
      nav: amount / units,
      amountPaise: Math.round(amount * 100),
      occurredAt: date instanceof Date ? date : new Date(),
    });
  }

  revalidatePath("/invest");
  redirect("/invest");
}

const addTxnSchema = z.object({
  fundId: z.string().uuid(),
  type: z.enum(["buy", "sell"]),
  amount: z.coerce.number().positive(),
  units: z.coerce.number().positive(),
  date: z.coerce.date(),
});

export async function addMfTxnAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = addTxnSchema.safeParse({
    fundId: formData.get("fundId"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    units: formData.get("units"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    redirect(`/invest?error=${encodeURIComponent("Check the transaction details")}`);
  }
  const { fundId, type, amount, units, date } = parsed.data;

  const db = await getDb();
  const [fund] = await db
    .select({ id: funds.id })
    .from(funds)
    .where(and(eq(funds.id, fundId), eq(funds.userId, user.id)))
    .limit(1);
  if (!fund) redirect("/invest");

  await db.insert(mfTxns).values({
    userId: user.id,
    fundId,
    type,
    units,
    nav: amount / units,
    amountPaise: Math.round(amount * 100),
    occurredAt: date,
  });

  revalidatePath("/invest");
  redirect(`/invest/fund/${fundId}`);
}

export async function deleteMfTxnAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const txnId = String(formData.get("txnId") ?? "");
  const fundId = String(formData.get("fundId") ?? "");
  const db = await getDb();
  await db
    .delete(mfTxns)
    .where(and(eq(mfTxns.id, txnId), eq(mfTxns.userId, user.id)));
  revalidatePath("/invest");
  redirect(fundId ? `/invest/fund/${fundId}` : "/invest");
}

export async function deleteFundAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const fundId = String(formData.get("fundId") ?? "");
  const db = await getDb();
  await db
    .delete(funds)
    .where(and(eq(funds.id, fundId), eq(funds.userId, user.id)));
  revalidatePath("/invest");
  redirect("/invest");
}

export async function refreshNavAction(): Promise<void> {
  const user = await requireUser();
  await refreshUserNavs(user.id);
  revalidatePath("/invest");
  redirect("/invest");
}

const allocationSchema = z.object({
  equity: z.coerce.number().int().min(0).max(100),
  debt: z.coerce.number().int().min(0).max(100),
  gold: z.coerce.number().int().min(0).max(100),
});

export async function updateAllocationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = allocationSchema.safeParse({
    equity: formData.get("equity"),
    debt: formData.get("debt"),
    gold: formData.get("gold"),
  });
  if (!parsed.success || parsed.data.equity + parsed.data.debt + parsed.data.gold !== 100) {
    redirect(`/invest?error=${encodeURIComponent("Target allocation must add up to 100%")}`);
  }
  const db = await getDb();
  await db
    .update(users)
    .set({
      targetEquityPct: parsed.data.equity,
      targetDebtPct: parsed.data.debt,
      targetGoldPct: parsed.data.gold,
    })
    .where(eq(users.id, user.id));
  revalidatePath("/invest");
  redirect("/invest");
}
