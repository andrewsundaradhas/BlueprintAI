import { sanitizeForLog } from "./sanitize";

/**
 * Structured logger with an explicit allowlist. PII never goes in.
 *
 * In production swap the console.* calls for your sink (Datadog, Logtail,
 * Vercel logs, GCP Cloud Logging). The contract — JSON-serializable, no PII,
 * always carries a request_id where applicable — stays the same.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const ALLOWED_KEYS = new Set([
  "level", "ts", "route", "request_id", "status",
  "ip_hash", "ms", "tokens", "provider", "source",
  "rooms", "openings", "walls", "size_bytes",
  "error", "event", "message",
]);

export type LogPayload = {
  level?: LogLevel;
  route: string;
  message?: string;
  request_id?: string;
  status?: number;
  ip_hash?: string;
  ms?: number;
  tokens?: number;
  provider?: string;
  source?: string;
  rooms?: number;
  openings?: number;
  walls?: number;
  size_bytes?: number;
  error?: string;
  event?: string;
};

export function logEvent(payload: LogPayload): void {
  const safe: Record<string, unknown> = {
    level: payload.level ?? "info",
    ts: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(payload)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (v == null) continue;
    safe[k] = typeof v === "string" ? sanitizeForLog(v, 500) : v;
  }
  // eslint-disable-next-line no-console
  (payload.level === "error" ? console.error : console.log)(JSON.stringify(safe));
}

/**
 * Stable, non-reversible hash of an IP for log correlation.
 * Uses Web Crypto SubtleCrypto when available (edge + Node 20).
 */
export async function hashIp(ip: string, salt = process.env.IP_HASH_SALT ?? "blueprintai"): Promise<string> {
  try {
    const data = new TextEncoder().encode(salt + ":" + ip);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < 8; i++) hex += bytes[i]!.toString(16).padStart(2, "0");
    return hex;
  } catch {
    // Fallback: simple non-cryptographic hash. Still better than raw IP.
    let h = 0;
    const s = salt + ":" + ip;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(8, "0");
  }
}
