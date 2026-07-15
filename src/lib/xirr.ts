// XIRR — annualized internal rate of return for irregular cashflows.
// Convention: investments (buys) are negative, redemptions and the current
// portfolio value are positive.

export interface Cashflow {
  amount: number; // any consistent unit (we use paise)
  date: Date;
}

const DAY_MS = 86_400_000;

function npv(rate: number, flows: Cashflow[], t0: number): number {
  return flows.reduce((sum, f) => {
    const years = (f.date.getTime() - t0) / DAY_MS / 365;
    return sum + f.amount / Math.pow(1 + rate, years);
  }, 0);
}

/**
 * Returns the annualized rate (e.g. 0.142 → 14.2%), or null when a rate
 * can't be computed (all flows one-signed, no convergence, degenerate data).
 */
export function xirr(flows: Cashflow[]): number | null {
  if (flows.length < 2) return null;
  const hasNeg = flows.some((f) => f.amount < 0);
  const hasPos = flows.some((f) => f.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = Math.min(...flows.map((f) => f.date.getTime()));

  // bracket the root, then bisect — robust against Newton blow-ups
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo, flows, t0);
  const fHi = npv(hi, flows, t0);
  if (Number.isNaN(fLo) || Number.isNaN(fHi) || fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows, t0);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}
