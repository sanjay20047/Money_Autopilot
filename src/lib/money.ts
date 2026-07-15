// Indian-format money helpers. All amounts are stored as integer paise.

const inrFull = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,04,000 — whole rupees (rounds paise) */
export function fmt(paise: number): string {
  return inrFull.format(Math.round(paise / 100));
}

/** ₹412.50 — keeps paise when present */
export function fmtExact(paise: number): string {
  return paise % 100 === 0 ? fmt(paise) : inrWithPaise.format(paise / 100);
}

/** ₹42.3k / ₹1.2L / ₹2.4Cr — compact for tight UI spots */
export function fmtCompact(paise: number): string {
  const r = paise / 100;
  if (r >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(1)}Cr`;
  if (r >= 1_00_000) return `₹${(r / 1_00_000).toFixed(1)}L`;
  if (r >= 1_000) return `₹${(r / 1_000).toFixed(1)}k`;
  return inrFull.format(Math.round(r));
}
