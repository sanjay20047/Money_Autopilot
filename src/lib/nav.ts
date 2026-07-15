// NAV data via mfapi.in — free JSON mirror of AMFI's official daily NAVs.

import { eq, and, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { funds } from "@/db/schema";

const BASE = "https://api.mfapi.in";

export interface SchemeSearchResult {
  schemeCode: number;
  schemeName: string;
}

export async function searchSchemes(query: string): Promise<SchemeSearchResult[]> {
  const res = await fetch(`${BASE}/mf/search?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`mfapi search failed: ${res.status}`);
  const data = (await res.json()) as SchemeSearchResult[];
  return data.slice(0, 20);
}

export async function fetchLatestNav(
  schemeCode: string
): Promise<{ nav: number; date: Date } | null> {
  const res = await fetch(`${BASE}/mf/${schemeCode}/latest`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{ date: string; nav: string }>;
  };
  const row = json.data?.[0];
  if (!row) return null;
  const nav = Number(row.nav);
  if (!Number.isFinite(nav) || nav <= 0) return null;
  // date format: "14-07-2026"
  const [dd, mm, yyyy] = row.date.split("-").map(Number);
  return { nav, date: new Date(yyyy, mm - 1, dd) };
}

/** Refresh NAVs for all of a user's feed-linked funds. Returns count updated. */
export async function refreshUserNavs(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(funds)
    .where(and(eq(funds.userId, userId), isNotNull(funds.schemeCode)));

  let updated = 0;
  await Promise.all(
    rows.map(async (f) => {
      try {
        const latest = await fetchLatestNav(f.schemeCode as string);
        if (latest) {
          await db
            .update(funds)
            .set({ currentNav: latest.nav, navDate: latest.date })
            .where(eq(funds.id, f.id));
          updated++;
        }
      } catch {
        // network hiccup — stale NAV is fine, next refresh will catch up
      }
    })
  );
  return updated;
}
