// Minimal in-memory sliding-window rate limiter.
//
// Good enough for a personal instance: on serverless each warm instance
// keeps its own window, which still blunts brute-force attempts. Swap for
// a durable store (Upstash/Redis) if this ever becomes multi-tenant SaaS.

const buckets = new Map<string, number[]>();

/** True when `key` has exceeded `max` recorded failures inside the window. */
export function isRateLimited(key: string, max = 5, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, hits);
  return hits.length >= max;
}

/** Record a failed attempt against `key`. */
export function recordFailure(key: string): void {
  const hits = buckets.get(key) ?? [];
  hits.push(Date.now());
  buckets.set(key, hits);
  // opportunistic cleanup so the map can't grow unbounded
  if (buckets.size > 10_000) {
    const cutoff = Date.now() - 60 * 60_000;
    for (const [k, v] of buckets) {
      if (v.every((t) => t < cutoff)) buckets.delete(k);
    }
  }
}

/** Clear failures for `key` (e.g. after a successful login). */
export function clearFailures(key: string): void {
  buckets.delete(key);
}
