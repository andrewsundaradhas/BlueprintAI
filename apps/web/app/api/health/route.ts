import { NextResponse } from "next/server";
import { aiProviders } from "@/lib/llm/generate-spec";
import { budgetStatus } from "@/lib/security/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports active AI provider + per-provider readiness so the in-app status
 * badge can show "Powered by Gemini" vs "Heuristic mode".
 *
 * Lockdown:
 *  - HEALTH_PUBLIC=false  → returns minimal { ok, activeProvider } only
 *  - HEALTH_DETAILED=true → also returns daily-token-budget status (admin-only)
 *
 * Don't expose token-budget numbers on a public endpoint — they help an
 * attacker time spend-cap attacks.
 */
export async function GET() {
  const providers = aiProviders();
  const active = providers.find((p) => p.available && p.id !== "demo");
  const isPublic = process.env.HEALTH_PUBLIC !== "false";
  const detailed = process.env.HEALTH_DETAILED === "true";

  const base = {
    ok: true,
    activeProvider: active?.id ?? "demo",
    activeLabel: active?.label ?? "Heuristic parser",
  };
  if (!isPublic) return NextResponse.json(base);

  return NextResponse.json({
    ...base,
    providers,
    ...(detailed ? { budget: budgetStatus() } : {}),
  });
}
