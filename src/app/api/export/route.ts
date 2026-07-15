// CSV export of all transactions — GET /api/export (session-protected).

import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { transactions } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth";
import { categoryDef } from "@/lib/categories";

function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(asc(transactions.occurredAt));

  const header = "date,time,type,amount_inr,merchant,category,account,channel,source";
  const lines = rows.map((t) => {
    const d = new Date(t.occurredAt);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return [
      date,
      time,
      t.type,
      (t.amountPaise / 100).toFixed(2),
      csvField(t.merchant),
      categoryDef(t.category).label,
      t.account,
      t.channel,
      t.source,
    ].join(",");
  });

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse([header, ...lines].join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="money-autopilot-transactions-${today}.csv"`,
    },
  });
}
