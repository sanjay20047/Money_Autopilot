// Scheme search for the add-fund flow (proxies mfapi.in, session-protected).

import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { searchSchemes } from "@/lib/nav";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ results: [] });

  try {
    const results = await searchSchemes(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "scheme search unavailable — add the fund manually instead" },
      { status: 502 }
    );
  }
}
