import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSpec } from "@/lib/llm/generate-spec";
import { solveLayout } from "@/lib/solver/solver";
import { solvedPlanToPlanIR } from "@/lib/solver/to-plan-ir";
import { computeBoq } from "@/lib/boq/engine";
import { jsonError, newRequestId } from "@/lib/security/errors";
import { logEvent, hashIp } from "@/lib/security/logger";
import { clientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  prompt: z.string().min(3).max(2000),
  meta: z
    .object({
      name: z.string().max(120).optional(),
      city: z.string().max(80).optional(),
      facing: z.enum(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]).optional(),
      region_pricing_key: z.string().max(60).optional(),
      plot: z
        .object({
          w: z.number().min(2000).max(60000),
          h: z.number().min(2000).max(60000),
        })
        .optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const requestId = newRequestId();
  const t0 = Date.now();
  const ipHash = await hashIp(clientIp(req));

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return jsonError({
      cause: e, status: 400, message: "Invalid request",
      route: "api.generate", requestId,
      meta: { ip_hash: ipHash },
    });
  }

  try {
    const { spec, source, warnings } = await generateSpec({
      prompt: body.prompt,
      fallbackPlot: body.meta?.plot,
    });

    const plan = solveLayout(spec);
    const planIR = solvedPlanToPlanIR({
      spec,
      plan,
      meta: {
        name: body.meta?.name,
        city: body.meta?.city,
        facing: body.meta?.facing,
        region_pricing_key: body.meta?.region_pricing_key,
      },
    });

    let boq = null;
    try {
      boq = await computeBoq(planIR);
    } catch (e) {
      warnings.push(`BOQ computation failed`);
      logEvent({
        level: "warn", route: "api.generate.boq", request_id: requestId,
        error: (e as Error).message.slice(0, 200),
      });
    }

    logEvent({
      level: "info", route: "api.generate", request_id: requestId,
      status: 200, ms: Date.now() - t0, ip_hash: ipHash,
      provider: source, source, rooms: plan.rooms.length,
    });

    return NextResponse.json(
      { spec, plan, planIR, boq, source, warnings, request_id: requestId },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (e) {
    return jsonError({
      cause: e, status: 500, message: "Generation failed",
      route: "api.generate", requestId,
      meta: { ip_hash: ipHash, ms: Date.now() - t0 },
    });
  }
}
