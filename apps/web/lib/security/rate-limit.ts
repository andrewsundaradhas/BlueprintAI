/**
 * In-memory token-bucket rate limiter.
 *
 * Production note: the per-process Map is ONLY safe for a single Node instance
 * (e.g. a small VPS or `next start` on one container). On Vercel serverless
 * each cold start has a fresh Map, so this enforces "best effort" — swap for
 * @upstash/ratelimit (Redis-backed) when you need distributed enforcement.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true;  remaining: number; resetAt: number }
  | { ok: false; remaining: 0;     resetAt: number; retryAfterSec: number };

export function rateLimit(opts: {
  /** Composite key — e.g. `${ip}:${route}` */
  key: string;
  /** Max requests in the window */
  max: number;
  /** Window length in milliseconds */
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(opts.key);
  if (!b || now > b.resetAt) {
    const reset = now + opts.windowMs;
    buckets.set(opts.key, { count: 1, resetAt: reset });
    // Cheap janitor: at most one cleanup per insertion when the map gets big
    if (buckets.size > 5000) cleanupExpired(now);
    return { ok: true, remaining: opts.max - 1, resetAt: reset };
  }
  b.count++;
  if (b.count > opts.max) {
    return {
      ok: false,
      remaining: 0,
      resetAt: b.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: opts.max - b.count, resetAt: b.resetAt };
}

function cleanupExpired(now: number) {
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}

/** Best-effort client IP extraction from common proxy headers. */
export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")
      ?? req.headers.get("cf-connecting-ip")
      ?? "anon";
}
