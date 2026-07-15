// SMS / email alert ingestion webhook.
//
// Called by the iOS Shortcut (or any forwarder):
//   POST /api/ingest
//   Authorization: Bearer <your-webhook-token>   (or ?token=... / body.token)
//   { "sender": "VM-HDFCBK", "message": "<the SMS text>", "receivedAt": "..." }

import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { merchantRules, rawMessages, transactions, users } from "@/db/schema";
import { parseMessage } from "@/lib/parser";

const bodySchema = z.object({
  sender: z.string().max(100).optional().default(""),
  message: z.string().min(1).max(4000),
  receivedAt: z.coerce.date().optional(),
  token: z.string().optional(),
});

function extractToken(req: NextRequest, bodyToken?: string): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.nextUrl.searchParams.get("token") ?? bodyToken ?? null;
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "expected { sender?, message, receivedAt? }" },
      { status: 400 }
    );
  }
  const { sender, message, receivedAt, token: bodyToken } = parsedBody.data;

  const token = extractToken(req, bodyToken);
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 401 });

  const db = await getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.webhookToken, token))
    .limit(1);
  if (!user) return NextResponse.json({ error: "invalid token" }, { status: 401 });

  const received = receivedAt ?? new Date();
  const result = parseMessage(sender, message);

  // OTPs and noise are never stored — not even the raw body.
  if (result.kind === "ignore") {
    return NextResponse.json({ status: "ignored", reason: result.reason });
  }

  if (result.kind === "review") {
    const [raw] = await db
      .insert(rawMessages)
      .values({ userId: user.id, sender, body: message, receivedAt: received, status: "review" })
      .returning({ id: rawMessages.id });
    return NextResponse.json({ status: "review", reason: result.reason, rawId: raw.id });
  }

  const t = result.txn;

  // user's learned rules beat the built-in keyword categorizer
  const [rule] = await db
    .select({ category: merchantRules.category })
    .from(merchantRules)
    .where(
      and(
        eq(merchantRules.userId, user.id),
        eq(merchantRules.merchant, t.merchant.toLowerCase())
      )
    )
    .limit(1);
  const category = rule?.category ?? t.category;

  // if the SMS carried only a date (no time) and it's the same day the
  // message arrived, prefer the arrival timestamp for ordering
  const occurredAt =
    t.occurredAt && t.occurredAt.toDateString() !== received.toDateString()
      ? t.occurredAt
      : received;

  const dayKey = occurredAt.toISOString().slice(0, 10);
  const dedupeHash = createHash("sha256")
    .update([t.amountPaise, t.type, t.merchant.toLowerCase(), t.account, dayKey].join("|"))
    .digest("hex");

  const [raw] = await db
    .insert(rawMessages)
    .values({ userId: user.id, sender, body: message, receivedAt: received, status: "parsed" })
    .returning({ id: rawMessages.id });

  const inserted = await db
    .insert(transactions)
    .values({
      userId: user.id,
      amountPaise: t.amountPaise,
      type: t.type,
      merchant: t.merchant,
      category,
      account: t.account,
      channel: t.channel,
      source: "sms",
      occurredAt,
      rawMessageId: raw.id,
      dedupeHash,
    })
    .onConflictDoNothing()
    .returning({ id: transactions.id });

  if (inserted.length === 0) {
    return NextResponse.json({ status: "duplicate" });
  }
  return NextResponse.json({ status: "created", txnId: inserted[0].id });
}

export function GET() {
  return NextResponse.json({
    service: "money-autopilot ingest",
    usage: "POST { sender?, message, receivedAt? } with Authorization: Bearer <webhook token>",
  });
}
