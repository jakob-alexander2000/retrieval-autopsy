export type LimitDecision = { ok: boolean; hits: number[] };

export function allow(now: number, hits: number[], windowMs: number, max: number): LimitDecision {
  const kept = hits.filter((stamp) => now - stamp < windowMs);
  if (kept.length >= max) return { ok: false, hits: kept };
  kept.push(now);
  return { ok: true, hits: kept };
}

export function createLimiter(max = 8, windowMs = 60_000) {
  const buckets = new Map<string, number[]>();
  return {
    allow(key: string, now = Date.now()): boolean {
      const decision = allow(now, buckets.get(key) ?? [], windowMs, max);
      buckets.set(key, decision.hits);
      return decision.ok;
    },
  };
}
