import { NextResponse } from "next/server";
import { logEvent } from "./logger";

/**
 * Generates a fresh request ID. Uses globalThis.crypto if available
 * (Node 18+ + edge), falls back to Math.random for the rare absence.
 */
export function newRequestId(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "req_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

/**
 * Generic error response — never leaks internal details to the client.
 * The actual exception is logged server-side with the same request_id so
 * support can trace a complaint back to the offending request.
 */
export function jsonError(args: {
  /** Internal error to log (never returned to the client). */
  cause: unknown;
  /** HTTP status code. */
  status: number;
  /** Public, generic error message. NEVER include user input. */
  message: string;
  /** Logical route name for the log line, e.g. "api.generate". */
  route: string;
  /** Optional request id; one is generated if absent. */
  requestId?: string;
  /** Allowlisted, non-PII fields to include in the structured log. */
  meta?: Record<string, string | number | boolean | null>;
}): NextResponse {
  const requestId = args.requestId ?? newRequestId();
  logEvent({
    level: args.status >= 500 ? "error" : "warn",
    route: args.route,
    request_id: requestId,
    status: args.status,
    error: errorSummary(args.cause),
    ...args.meta,
  });
  return NextResponse.json(
    { error: args.message, request_id: requestId },
    { status: args.status },
  );
}

function errorSummary(e: unknown): string {
  if (e instanceof Error) return e.name + ": " + e.message.slice(0, 500);
  return typeof e === "string" ? e.slice(0, 500) : String(e);
}
