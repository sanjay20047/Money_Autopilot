// Read-side queries for the dashboard screens.
// "Spent" always excludes investments (transfers to your future self, not spending).

import { and, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rawMessages, transactions, type Transaction } from "@/db/schema";

export interface MonthStats {
  inPaise: number;
  spentPaise: number;
  investedPaise: number;
  savingsRatePct: number | null; // null when no income yet
}

function monthStart(d: Date, offsetMonths = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
}

async function statsBetween(userId: string, from: Date, to: Date): Promise<MonthStats> {
  const db = await getDb();
  const [row] = await db
    .select({
      inPaise: sql<number>`coalesce(sum(${transactions.amountPaise}) filter (where ${transactions.type} = 'credit'), 0)`,
      spentPaise: sql<number>`coalesce(sum(${transactions.amountPaise}) filter (where ${transactions.type} = 'debit' and ${transactions.category} <> 'investments'), 0)`,
      investedPaise: sql<number>`coalesce(sum(${transactions.amountPaise}) filter (where ${transactions.type} = 'debit' and ${transactions.category} = 'investments'), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredAt, from),
        lt(transactions.occurredAt, to)
      )
    );

  const inPaise = Number(row.inPaise);
  const spentPaise = Number(row.spentPaise);
  const investedPaise = Number(row.investedPaise);
  return {
    inPaise,
    spentPaise,
    investedPaise,
    savingsRatePct: inPaise > 0 ? Math.round(((inPaise - spentPaise) / inPaise) * 100) : null,
  };
}

export async function getCurrentMonthStats(userId: string, now = new Date()) {
  return statsBetween(userId, monthStart(now), monthStart(now, 1));
}

export async function getPreviousMonthStats(userId: string, now = new Date()) {
  return statsBetween(userId, monthStart(now, -1), monthStart(now));
}

/** Daily spend (debits excl. investments) for the last `days` days, oldest first. */
export async function getDailySpend(userId: string, days = 14, now = new Date()): Promise<number[]> {
  const db = await getDb();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const rows = await db
    .select({
      day: sql<string>`to_char(${transactions.occurredAt}, 'YYYY-MM-DD')`,
      total: sql<number>`sum(${transactions.amountPaise})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "debit"),
        ne(transactions.category, "investments"),
        gte(transactions.occurredAt, from)
      )
    )
    .groupBy(sql`1`);

  const byDay = new Map(rows.map((r) => [r.day, Number(r.total)]));
  const series: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    series.push(byDay.get(key) ?? 0);
  }
  return series;
}

export interface CategorySlice {
  category: string;
  totalPaise: number;
}

export async function getCategorySplit(userId: string, now = new Date()): Promise<CategorySlice[]> {
  const db = await getDb();
  const rows = await db
    .select({
      category: transactions.category,
      totalPaise: sql<number>`sum(${transactions.amountPaise})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "debit"),
        ne(transactions.category, "investments"),
        gte(transactions.occurredAt, monthStart(now))
      )
    )
    .groupBy(transactions.category)
    .orderBy(desc(sql`sum(${transactions.amountPaise})`));
  return rows.map((r) => ({ category: r.category, totalPaise: Number(r.totalPaise) }));
}

export async function getRecentTransactions(userId: string, limit = 30): Promise<Transaction[]> {
  const db = await getDb();
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.occurredAt))
    .limit(limit);
}

export async function getReviewCount(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(rawMessages)
    .where(and(eq(rawMessages.userId, userId), eq(rawMessages.status, "review")));
  return Number(row.n);
}

export async function hasAnyTransactions(userId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .limit(1);
  return Boolean(row);
}
