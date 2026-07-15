// Goal progress + savings-coach math (M4).

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { goalContributions, goals, type Goal } from "@/db/schema";

export type GoalStatus = "done" | "on-track" | "behind";

export interface GoalOverview {
  goal: Goal;
  savedPaise: number;
  savedThisMonthPaise: number;
  remainingPaise: number;
  pct: number;
  monthsLeft: number;
  /** what you must save per month from now to still hit the date */
  neededPerMonthPaise: number;
  /** the original per-month pace when the goal was created */
  plannedPerMonthPaise: number;
  status: GoalStatus;
  /** for behind goals: extra per month to catch up */
  extraPerMonthPaise: number;
  /** for behind goals: the date the goal lands at the original pace */
  pushedDate: Date | null;
}

function monthsBetween(a: Date, b: Date): number {
  return Math.max(
    1,
    Math.ceil((b.getTime() - a.getTime()) / (30.44 * 86_400_000))
  );
}

export async function getGoalsOverview(userId: string, now = new Date()): Promise<GoalOverview[]> {
  const db = await getDb();
  const [goalRows, contribRows] = await Promise.all([
    db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.targetDate)),
    db.select().from(goalContributions).where(eq(goalContributions.userId, userId)),
  ]);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const savedByGoal = new Map<string, { total: number; thisMonth: number }>();
  for (const c of contribRows) {
    const cur = savedByGoal.get(c.goalId) ?? { total: 0, thisMonth: 0 };
    cur.total += c.amountPaise;
    if (new Date(c.occurredAt) >= monthStart) cur.thisMonth += c.amountPaise;
    savedByGoal.set(c.goalId, cur);
  }

  return goalRows.map((goal) => {
    const saved = savedByGoal.get(goal.id) ?? { total: 0, thisMonth: 0 };
    const remaining = Math.max(0, goal.targetPaise - saved.total);
    const target = new Date(goal.targetDate);
    const created = new Date(goal.createdAt);

    const monthsLeft = monthsBetween(now, target);
    const totalMonths = monthsBetween(created, target);
    const neededPerMonth = Math.ceil(remaining / monthsLeft);
    const plannedPerMonth = Math.ceil(goal.targetPaise / totalMonths);

    let status: GoalStatus;
    if (remaining === 0) status = "done";
    else if (now > target || neededPerMonth > plannedPerMonth * 1.25) status = "behind";
    else status = "on-track";

    const extraPerMonth = Math.max(0, neededPerMonth - plannedPerMonth);
    let pushedDate: Date | null = null;
    if (status === "behind" && plannedPerMonth > 0) {
      const monthsAtPlannedPace = Math.ceil(remaining / plannedPerMonth);
      pushedDate = new Date(now.getFullYear(), now.getMonth() + monthsAtPlannedPace, target.getDate());
    }

    return {
      goal,
      savedPaise: saved.total,
      savedThisMonthPaise: saved.thisMonth,
      remainingPaise: remaining,
      pct: goal.targetPaise > 0 ? Math.min(100, Math.round((saved.total / goal.targetPaise) * 100)) : 0,
      monthsLeft,
      neededPerMonthPaise: neededPerMonth,
      plannedPerMonthPaise: plannedPerMonth,
      status,
      extraPerMonthPaise: extraPerMonth,
      pushedDate,
    };
  });
}

export interface SalarySplit {
  perGoal: Array<{ goalId: string; name: string; amountPaise: number }>;
  totalPaise: number;
}

/**
 * Suggested set-aside for this month: each active goal asks for its
 * needed-per-month minus what's already been contributed this month.
 * Capped at 60% of the month's income, scaled proportionally when over.
 */
export function computeSalarySplit(
  overview: GoalOverview[],
  incomeThisMonthPaise: number
): SalarySplit | null {
  if (incomeThisMonthPaise <= 0) return null;

  let perGoal = overview
    .filter((g) => g.status !== "done")
    .map((g) => ({
      goalId: g.goal.id,
      name: g.goal.name,
      amountPaise: Math.min(
        Math.max(0, g.neededPerMonthPaise - g.savedThisMonthPaise),
        g.remainingPaise
      ),
    }))
    .filter((x) => x.amountPaise > 0);

  if (perGoal.length === 0) return null;

  let total = perGoal.reduce((s, x) => s + x.amountPaise, 0);
  const cap = Math.floor(incomeThisMonthPaise * 0.6);
  if (total > cap && total > 0) {
    const scale = cap / total;
    perGoal = perGoal
      .map((x) => ({ ...x, amountPaise: Math.floor(x.amountPaise * scale) }))
      .filter((x) => x.amountPaise > 0);
    total = perGoal.reduce((s, x) => s + x.amountPaise, 0);
  }
  if (total <= 0) return null;

  return { perGoal, totalPaise: total };
}
