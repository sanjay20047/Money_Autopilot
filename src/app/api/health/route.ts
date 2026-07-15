// Keep-warm health check — point a free uptime pinger (UptimeRobot,
// cron-job.org) at this every 5 minutes and the Neon database never
// auto-suspends, killing the cold-start delay on first tap.
// Cheap by design: one trivial query, no auth, no user data.

import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
