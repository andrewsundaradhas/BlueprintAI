import { NextResponse } from "next/server";
import { aiProviders } from "@/lib/llm/generate-spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providers = aiProviders();
  const active = providers.find((p) => p.available && p.id !== "demo");
  return NextResponse.json({
    ok: true,
    providers,
    activeProvider: active?.id ?? "demo",
    activeLabel: active?.label ?? "Heuristic parser",
  });
}
