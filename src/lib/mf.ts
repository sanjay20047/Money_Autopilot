// Portfolio math for the Invest module.

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { funds, mfTxns, type Fund, type MfTxn } from "@/db/schema";
import { xirr, type Cashflow } from "./xirr";

export interface Holding {
  fund: Fund;
  units: number;
  investedPaise: number; // net cost (buys − sells)
  valuePaise: number; // units × NAV (falls back to cost when NAV unknown)
  navKnown: boolean;
  xirrPct: number | null;
  txnCount: number;
}

export interface Portfolio {
  holdings: Holding[];
  investedPaise: number;
  valuePaise: number;
  gainPaise: number;
  xirrPct: number | null;
  allocation: Array<{ assetClass: string; valuePaise: number; pct: number }>;
}

export async function getPortfolio(userId: string, now = new Date()): Promise<Portfolio> {
  const db = await getDb();
  const [fundRows, txnRows] = await Promise.all([
    db.select().from(funds).where(eq(funds.userId, userId)).orderBy(asc(funds.createdAt)),
    db.select().from(mfTxns).where(eq(mfTxns.userId, userId)).orderBy(asc(mfTxns.occurredAt)),
  ]);

  const byFund = new Map<string, MfTxn[]>();
  for (const t of txnRows) {
    if (!byFund.has(t.fundId)) byFund.set(t.fundId, []);
    byFund.get(t.fundId)!.push(t);
  }

  const holdings: Holding[] = fundRows.map((fund) => {
    const txns = byFund.get(fund.id) ?? [];
    let units = 0;
    let investedPaise = 0;
    const flows: Cashflow[] = [];

    for (const t of txns) {
      if (t.type === "buy") {
        units += t.units;
        investedPaise += t.amountPaise;
        flows.push({ amount: -t.amountPaise, date: new Date(t.occurredAt) });
      } else {
        units -= t.units;
        investedPaise -= t.amountPaise;
        flows.push({ amount: t.amountPaise, date: new Date(t.occurredAt) });
      }
    }

    units = Math.max(0, Math.round(units * 10_000) / 10_000);
    const navKnown = fund.currentNav !== null && fund.currentNav > 0;
    const valuePaise = navKnown
      ? Math.round(units * (fund.currentNav as number) * 100)
      : Math.max(0, investedPaise);

    if (valuePaise > 0) flows.push({ amount: valuePaise, date: now });
    const rate = xirr(flows);

    return {
      fund,
      units,
      investedPaise,
      valuePaise,
      navKnown,
      xirrPct: rate !== null ? Math.round(rate * 1000) / 10 : null,
      txnCount: txns.length,
    };
  });

  const investedPaise = holdings.reduce((s, h) => s + Math.max(0, h.investedPaise), 0);
  const valuePaise = holdings.reduce((s, h) => s + h.valuePaise, 0);

  // overall XIRR across every fund's flows + total current value today
  const allFlows: Cashflow[] = txnRows.map((t) => ({
    amount: t.type === "buy" ? -t.amountPaise : t.amountPaise,
    date: new Date(t.occurredAt),
  }));
  if (valuePaise > 0) allFlows.push({ amount: valuePaise, date: now });
  const overall = xirr(allFlows);

  const byClass = new Map<string, number>();
  for (const h of holdings) {
    byClass.set(h.fund.assetClass, (byClass.get(h.fund.assetClass) ?? 0) + h.valuePaise);
  }
  const allocation = [...byClass.entries()]
    .map(([assetClass, v]) => ({
      assetClass,
      valuePaise: v,
      pct: valuePaise > 0 ? Math.round((v / valuePaise) * 100) : 0,
    }))
    .sort((a, b) => b.valuePaise - a.valuePaise);

  return {
    holdings,
    investedPaise,
    valuePaise,
    gainPaise: valuePaise - investedPaise,
    xirrPct: overall !== null ? Math.round(overall * 1000) / 10 : null,
    allocation,
  };
}

export const ASSET_CLASS_META: Record<string, { label: string; color: string }> = {
  equity: { label: "Equity", color: "#2a78d6" },
  debt: { label: "Debt", color: "#1baf7a" },
  gold: { label: "Gold", color: "#eda100" },
  hybrid: { label: "Hybrid", color: "#4a3aa7" },
};
