// SMS / bank-alert parser.
//
// Strategy: layered extraction rather than one regex per bank.
//   1. safety gates (OTP / promo / balance-only messages never become txns)
//   2. amount  → required
//   3. direction (debit/credit) → required
//   4. merchant, account, channel, date → best-effort
// If the required fields are missing the message goes to the review queue.

import { categorize, type CategoryKey } from "./categories";

export interface ParsedTxn {
  amountPaise: number;
  type: "debit" | "credit";
  merchant: string;
  category: CategoryKey;
  account: string;
  channel: string;
  occurredAt: Date | null; // null → caller falls back to receivedAt
}

export type ParseResult =
  | { kind: "txn"; txn: ParsedTxn }
  | { kind: "ignore"; reason: string } // OTP / promo / balance-only — do not store body
  | { kind: "review"; reason: string }; // looks financial but couldn't parse

// ---------- safety + noise gates ----------

const OTP_RE = /\b(otp|one[\s-]?time\s+password|verification\s+code)\b/i;
const PROMO_RE =
  /\b(offer|discount|cashback\s+up\s?to|win\b|lucky|congratulations|apply\s+now|pre-?approved|loan\s+of|emi\s+starting|t&c|click|http[s]?:\/\/)/i;
const BALANCE_ONLY_RE = /\b(avl|available)\s+(bal|balance)\b/i;

const DEBIT_RE =
  /\b(debited|debit(?:ed)?|spent|sent|paid|payment\s+of|purchase(?:\s+of)?|withdrawn|w\/d|deducted|txn\s+of)\b/i;
const CREDIT_RE =
  /\b(credited|received|deposited|refund(?:ed)?|reversed|cashback\s+of)\b/i;

// ---------- field extractors ----------

const AMOUNT_RE =
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr)\b/i;

// e.g. "debited by 412.0" (SBI style, no currency symbol)
const AMOUNT_BY_RE = /\b(?:debited|credited)\s+by\s+([\d,]+(?:\.\d{1,2})?)\b/i;

const ACCOUNT_RE =
  /\b(?:a\/c|ac|acct|account|card)\s*(?:no\.?)?\s*(?:ending\s*)?[x*]*(\d{3,6})/i;

// merchant patterns, tried in order — first match wins
const MERCHANT_PATTERNS: RegExp[] = [
  /\bto\s+vpa\s+([a-z0-9._-]+)@[a-z]+/i, // to VPA swiggy.upi@icici
  /\btrf\s+to\s+([a-z0-9 &._'-]{2,40}?)(?:\s+ref|\s+on\b|\.|$)/i, // SBI: trf to SWIGGY
  /\bat\s+([a-z0-9 &._'*-]{2,40}?)\s+on\s/i, // spent ... at AMAZON on
  /\bto\s+([a-z0-9 &._'-]{2,40}?)\s+on\s+\d/i, // Sent ... To Merchant On 14/07
  /\bupi\/(?:p2m|p2a)\/\d+\/([a-z0-9 &._'-]{2,40})/i, // UPI/P2M/519.../AMAZON
  /\binfo:?\s*(?:upi|imps|neft)?[\/-]?\s*([a-z0-9 &._'-]{2,40})/i,
  /\bby\s+([a-z0-9 &._'-]{2,40}?)\s+(?:ref|on)\b/i, // credited ... by EMPLOYER on
  /;\s*([a-z0-9 &._'-]{2,40}?)\s+credited/i, // ICICI: ; MERCHANT credited
];

const CHANNEL_RE = /\b(upi|neft|imps|rtgs|atm|pos|card|netbanking|ach|nach|ecs)\b/i;

// dates seen in bank SMS: 14/07/25, 14-07-2025, 14-Jul-25, 14Jul25, 2025-07-14
const DATE_PATTERNS: Array<{ re: RegExp; build: (m: RegExpMatchArray) => Date }> = [
  {
    re: /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/,
    build: (m) => new Date(yr(m[3]), Number(m[2]) - 1, Number(m[1])),
  },
  {
    re: /\b(\d{1,2})[- ]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]?(\d{2,4})\b/i,
    build: (m) => new Date(yr(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1])),
  },
  {
    re: /\b(20\d{2})-(\d{2})-(\d{2})\b/,
    build: (m) => new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  },
];

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function yr(s: string): number {
  const n = Number(s);
  return n < 100 ? 2000 + n : n;
}

function cleanMerchant(raw: string): string {
  const s = raw
    .replace(/[*_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[.,;:-]+$/, "");
  if (!s) return "Unknown";
  // Title-case ALL-CAPS merchants for display
  if (s === s.toUpperCase()) {
    return s
      .toLowerCase()
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  return s[0].toUpperCase() + s.slice(1);
}

// ---------- main entry ----------

export function parseMessage(sender: string, body: string): ParseResult {
  const text = body.replace(/\s+/g, " ").trim();

  if (OTP_RE.test(text)) return { kind: "ignore", reason: "otp" };

  const isDebit = DEBIT_RE.test(text);
  const isCredit = CREDIT_RE.test(text);

  // promos are ignored unless they clearly describe a completed txn
  if (PROMO_RE.test(text) && !isDebit && !isCredit)
    return { kind: "ignore", reason: "promo" };

  if (!isDebit && !isCredit) {
    if (BALANCE_ONLY_RE.test(text))
      return { kind: "ignore", reason: "balance-only" };
    // no financial verbs at all → probably noise, but keep it reviewable
    if (!AMOUNT_RE.test(text)) return { kind: "ignore", reason: "not-financial" };
    return { kind: "review", reason: "no-direction" };
  }

  // amount
  const am = text.match(AMOUNT_RE) ?? text.match(AMOUNT_BY_RE);
  if (!am) return { kind: "review", reason: "no-amount" };
  const amountStr = (am[1] ?? am[2] ?? "").replace(/,/g, "");
  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount <= 0)
    return { kind: "review", reason: "bad-amount" };

  // refunds/reversals count as credits even when a debit verb also appears
  const type: "debit" | "credit" =
    isCredit && /\b(refund|revers)/i.test(text) ? "credit" : isDebit ? "debit" : "credit";

  // merchant
  let merchant = "Unknown";
  for (const re of MERCHANT_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      merchant = cleanMerchant(m[1]);
      break;
    }
  }

  // account + channel
  const account = text.match(ACCOUNT_RE)?.[1] ?? "";
  const channel = (text.match(CHANNEL_RE)?.[1] ?? "").toUpperCase();

  // date
  let occurredAt: Date | null = null;
  for (const { re, build } of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const d = build(m);
      if (!Number.isNaN(d.getTime())) {
        occurredAt = d;
        break;
      }
    }
  }

  const category =
    type === "credit" && /\b(salary|sal\b|payroll)/i.test(text)
      ? "income"
      : categorize(merchant, text);

  return {
    kind: "txn",
    txn: {
      amountPaise: Math.round(amount * 100),
      type,
      merchant,
      category,
      account,
      channel: channel === "AC" ? "" : channel,
      occurredAt,
    },
  };
}
