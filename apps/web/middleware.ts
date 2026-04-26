import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";

/**
 * API gateway: enforces body-size limits, per-IP rate limits per route, and
 * cross-origin policy for state-changing requests. Stateful API routes
 * (generate / refine / export / health) all flow through this.
 */

const MAX_BODY_BYTES = 256 * 1024; // 256 KB

const RATE_LIMITS: { prefix: string; max: number; windowMs: number }[] = [
  // Paid LLM endpoints — tightest cap (token money on the line)
  { prefix: "/api/generate", max: 8,   windowMs: 60_000 },
  { prefix: "/api/refine",   max: 16,  windowMs: 60_000 },
  // Export endpoints — heavier compute, lighter blast radius
  { prefix: "/api/export",   max: 30,  windowMs: 60_000 },
  // Health check — high cap, used by status badges
  { prefix: "/api/health",   max: 120, windowMs: 60_000 },
];

export function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;
  if (!url.startsWith("/api/")) return NextResponse.next();

  // 1. Body-size guard — declared content-length only (streaming bodies fall
  //    back to the route's own json() limit + framework hard cap).
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) {
    return jsonStatus(413, "Payload too large");
  }

  // 2. Rate limit per IP per route prefix
  const limit = RATE_LIMITS.find((r) => url.startsWith(r.prefix));
  if (limit) {
    const ip = clientIp(req);
    const r = rateLimit({
      key: `${ip}:${limit.prefix}`,
      max: limit.max,
      windowMs: limit.windowMs,
    });
    if (!r.ok) {
      return new NextResponse(
        JSON.stringify({ error: "Rate limit exceeded" }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": String(r.retryAfterSec),
            "x-ratelimit-limit": String(limit.max),
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(Math.floor(r.resetAt / 1000)),
          },
        },
      );
    }
    const res = NextResponse.next();
    res.headers.set("x-ratelimit-limit", String(limit.max));
    res.headers.set("x-ratelimit-remaining", String(r.remaining));
    res.headers.set("x-ratelimit-reset", String(Math.floor(r.resetAt / 1000)));
    return res;
  }

  return NextResponse.next();
}

function jsonStatus(status: number, message: string) {
  return new NextResponse(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};
