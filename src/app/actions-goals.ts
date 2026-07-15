"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { goalContributions, goals } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { computeSalarySplit, getGoalsOverview } from "@/lib/goals";
import { getCurrentMonthStats } from "@/lib/data";

const addGoalSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target: z.coerce.number().positive().max(100_00_00_000),
  targetDate: z.coerce.date(),
});

export async function addGoalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = addGoalSchema.safeParse({
    name: formData.get("name"),
    target: formData.get("target"),
    targetDate: formData.get("targetDate"),
  });
  if (!parsed.success || parsed.data.targetDate <= new Date()) {
    redirect(`/goals?error=${encodeURIComponent("Give the goal a name, amount, and a future date")}`);
  }
  const db = await getDb();
  await db.insert(goals).values({
    userId: user.id,
    name: parsed.data.name,
    targetPaise: Math.round(parsed.data.target * 100),
    targetDate: parsed.data.targetDate,
  });
  revalidatePath("/goals");
  redirect("/goals");
}

const contributionSchema = z.object({
  goalId: z.string().uuid(),
  amount: z.coerce.number().positive(),
});

export async function addContributionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = contributionSchema.safeParse({
    goalId: formData.get("goalId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) redirect("/goals");

  const db = await getDb();
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, parsed.data.goalId), eq(goals.userId, user.id)))
    .limit(1);
  if (!goal) redirect("/goals");

  await db.insert(goalContributions).values({
    userId: user.id,
    goalId: parsed.data.goalId,
    amountPaise: Math.round(parsed.data.amount * 100),
    occurredAt: new Date(),
  });
  revalidatePath("/goals");
  redirect("/goals");
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const goalId = String(formData.get("goalId") ?? "");
  const db = await getDb();
  await db
    .delete(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, user.id)));
  revalidatePath("/goals");
  redirect("/goals");
}

/** One tap on the salary-day card: contribute the suggested split to every goal. */
export async function applySalarySplitAction(): Promise<void> {
  const user = await requireUser();

  // recompute server-side — never trust amounts from the client
  const [overview, stats] = await Promise.all([
    getGoalsOverview(user.id),
    getCurrentMonthStats(user.id),
  ]);
  const split = computeSalarySplit(overview, stats.inPaise);
  if (!split) redirect("/goals");

  const db = await getDb();
  const now = new Date();
  await db.insert(goalContributions).values(
    split.perGoal.map((g) => ({
      userId: user.id,
      goalId: g.goalId,
      amountPaise: g.amountPaise,
      occurredAt: now,
    }))
  );
  revalidatePath("/goals");
  redirect("/goals");
}
