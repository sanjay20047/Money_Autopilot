// Deterministic demo dataset — ~2 months of realistic activity so every
// screen has something to show before real SMS ingestion is wired up.
// Dedupe hashes are stable, so loading twice never duplicates rows.

import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  funds,
  goalContributions,
  goals,
  mfTxns,
  type NewTransaction,
} from "@/db/schema";

interface Tpl {
  merchant: string;
  category: string;
  channel: string;
  min: number; // rupees
  max: number;
}

const DAILY_POOL: Tpl[] = [
  { merchant: "Swiggy", category: "food", channel: "UPI", min: 180, max: 550 },
  { merchant: "Zomato", category: "food", channel: "UPI", min: 200, max: 600 },
  { merchant: "Zepto", category: "food", channel: "UPI", min: 120, max: 450 },
  { merchant: "Tea Kadai", category: "food", channel: "UPI", min: 20, max: 80 },
  { merchant: "Uber", category: "transport", channel: "UPI", min: 90, max: 320 },
  { merchant: "Rapido", category: "transport", channel: "UPI", min: 40, max: 150 },
  { merchant: "Chennai Metro", category: "transport", channel: "UPI", min: 30, max: 90 },
  { merchant: "Amazon", category: "shopping", channel: "CARD", min: 300, max: 2800 },
  { merchant: "Flipkart", category: "shopping", channel: "CARD", min: 250, max: 2200 },
  { merchant: "Bookmyshow", category: "entertainment", channel: "CARD", min: 250, max: 700 },
  { merchant: "Apollo Pharmacy", category: "health", channel: "UPI", min: 100, max: 500 },
];

// simple deterministic PRNG so the dataset is identical every run
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(parts: (string | number)[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function buildDemoTransactions(userId: string): NewTransaction[] {
  const rows: NewTransaction[] = [];
  const rand = mulberry32(20260714);
  const now = new Date();

  const push = (
    d: Date,
    t: Omit<Tpl, "min" | "max">,
    rupees: number,
    type: "debit" | "credit",
    key: string
  ) => {
    rows.push({
      userId,
      amountPaise: Math.round(rupees * 100),
      type,
      merchant: t.merchant,
      category: t.category,
      account: "4821",
      channel: t.channel,
      source: "demo",
      occurredAt: d,
      dedupeHash: hash(["demo", key]),
    });
  };

  // monthly fixtures for current + previous month
  for (const monthsBack of [0, 1]) {
    const y = now.getFullYear();
    const m = now.getMonth() - monthsBack;
    const mk = `m${monthsBack}`;

    const day = (dd: number, hh = 10) => new Date(y, m, dd, hh, 15);
    // skip fixtures dated in the future
    const ok = (d: Date) => d <= now;

    const fixtures: Array<[Date, Tpl["merchant"], string, string, number, "debit" | "credit"]> = [
      [day(1, 9), "Salary — Employer", "income", "NEFT", 104000, "credit"],
      [day(2), "Rent", "bills", "UPI", 18000, "debit"],
      [day(5), "Parag Parikh Flexi Cap SIP", "investments", "ACH", 10000, "debit"],
      [day(5), "UTI Nifty 50 Index SIP", "investments", "ACH", 10000, "debit"],
      [day(5), "ICICI Short Term Debt SIP", "investments", "ACH", 5000, "debit"],
      [day(7), "Netflix", "entertainment", "CARD", 199, "debit"],
      [day(8), "Jio Recharge", "bills", "UPI", 299, "debit"],
      [day(12), "TNEB Electricity", "bills", "UPI", 1240, "debit"],
      [day(15), "ATM Withdrawal", "cash", "ATM", 3000, "debit"],
    ];

    for (const [d, merchant, category, channel, amt, type] of fixtures) {
      if (ok(d)) push(d, { merchant, category, channel }, amt, type, `${mk}-${merchant}-${d.getDate()}`);
    }
  }

  // daily variable spends for the last 52 days
  for (let back = 0; back < 52; back++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const count = rand() < 0.2 ? 1 : rand() < 0.7 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const t = DAILY_POOL[Math.floor(rand() * DAILY_POOL.length)];
      const rupees = Math.round(t.min + rand() * (t.max - t.min));
      const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9 + Math.floor(rand() * 12), Math.floor(rand() * 60));
      if (at > now) continue;
      push(at, t, rupees, "debit", `d${back}-${i}-${t.merchant}`);
    }
  }

  return rows;
}

// ---------- M3/M4 demo: portfolio + goals ----------

export async function seedDemoPortfolioAndGoals(db: Db, userId: string): Promise<void> {
  const now = new Date();
  const monthsAgo = (n: number, day = 5) =>
    new Date(now.getFullYear(), now.getMonth() - n, day, 10, 0);

  // --- funds (skip if demo funds already exist) ---
  const existingFunds = await db
    .select({ id: funds.id })
    .from(funds)
    .where(and(eq(funds.userId, userId), eq(funds.isDemo, true)))
    .limit(1);

  if (existingFunds.length === 0) {
    const demoFunds: Array<{
      name: string;
      assetClass: "equity" | "debt" | "gold";
      nav: number; // today's NAV
      sip: number; // ₹ per month, 0 = lumpsum-only
      months: number;
      navGrowth: number; // total NAV growth over the SIP window
      lumpsum?: { rupees: number; nav: number; monthsBack: number };
    }> = [
      { name: "Parag Parikh Flexi Cap Direct Growth", assetClass: "equity", nav: 84.2, sip: 10_000, months: 12, navGrowth: 0.18 },
      { name: "UTI Nifty 50 Index Direct Growth", assetClass: "equity", nav: 158.6, sip: 10_000, months: 12, navGrowth: 0.14 },
      { name: "ICICI Pru Short Term Debt Direct Growth", assetClass: "debt", nav: 61.4, sip: 5_000, months: 12, navGrowth: 0.07 },
      { name: "SBI Gold Fund Direct Growth", assetClass: "gold", nav: 26.8, sip: 0, months: 0, navGrowth: 0, lumpsum: { rupees: 45_000, nav: 23.1, monthsBack: 10 } },
    ];

    for (const f of demoFunds) {
      const [fund] = await db
        .insert(funds)
        .values({
          userId,
          name: f.name,
          assetClass: f.assetClass,
          currentNav: f.nav,
          navDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
          isDemo: true,
        })
        .returning({ id: funds.id });

      if (f.sip > 0) {
        // SIP installments with NAV rising toward today's value
        const startNav = f.nav / (1 + f.navGrowth);
        for (let m = f.months; m >= 1; m--) {
          const progress = (f.months - m) / f.months;
          const nav = startNav * (1 + f.navGrowth * progress);
          const at = monthsAgo(m);
          if (at > now) continue;
          await db.insert(mfTxns).values({
            userId,
            fundId: fund.id,
            type: "buy",
            units: Math.round((f.sip / nav) * 10_000) / 10_000,
            nav: Math.round(nav * 10_000) / 10_000,
            amountPaise: f.sip * 100,
            occurredAt: at,
          });
        }
      }
      if (f.lumpsum) {
        await db.insert(mfTxns).values({
          userId,
          fundId: fund.id,
          type: "buy",
          units: Math.round((f.lumpsum.rupees / f.lumpsum.nav) * 10_000) / 10_000,
          nav: f.lumpsum.nav,
          amountPaise: f.lumpsum.rupees * 100,
          occurredAt: monthsAgo(f.lumpsum.monthsBack, 15),
        });
      }
    }
  }

  // --- goals (skip if demo goals already exist) ---
  const existingGoals = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.isDemo, true)))
    .limit(1);

  if (existingGoals.length === 0) {
    const demoGoals: Array<{
      name: string;
      target: number; // ₹
      monthsToTarget: number;
      createdMonthsAgo: number;
      contributions: Array<{ rupees: number; monthsAgo: number }>;
    }> = [
      {
        name: "Emergency fund",
        target: 300_000,
        monthsToTarget: 11,
        createdMonthsAgo: 12,
        contributions: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((m) => ({ rupees: 10_000, monthsAgo: m })),
      },
      {
        name: "iPhone 17",
        target: 90_000,
        monthsToTarget: 5,
        createdMonthsAgo: 9,
        contributions: [9, 8, 7, 6, 5, 4, 3, 2, 1].map((m) => ({ rupees: 6_500, monthsAgo: m })),
      },
      {
        name: "Goa trip",
        target: 40_000,
        monthsToTarget: 4,
        createdMonthsAgo: 6,
        contributions: [
          { rupees: 5_000, monthsAgo: 6 },
          { rupees: 4_000, monthsAgo: 5 },
          { rupees: 3_000, monthsAgo: 4 },
        ],
      },
    ];

    for (const g of demoGoals) {
      const [goal] = await db
        .insert(goals)
        .values({
          userId,
          name: g.name,
          targetPaise: g.target * 100,
          targetDate: monthsAgo(-g.monthsToTarget, 28),
          isDemo: true,
          createdAt: monthsAgo(g.createdMonthsAgo, 1),
        })
        .returning({ id: goals.id });

      const rows = g.contributions
        .map((c) => ({
          userId,
          goalId: goal.id,
          amountPaise: c.rupees * 100,
          occurredAt: monthsAgo(c.monthsAgo, 2),
        }))
        .filter((c) => c.occurredAt <= now);
      if (rows.length > 0) await db.insert(goalContributions).values(rows);
    }
  }
}
