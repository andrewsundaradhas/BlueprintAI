import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSpec } from "@/lib/llm/generate-spec";
import { solveLayout } from "@/lib/solver/solver";
import { solvedPlanToPlanIR } from "@/lib/solver/to-plan-ir";
import { computeBoq } from "@/lib/boq/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  prompt: z.string().min(3).max(2000),
  meta: z
    .object({
      name: z.string().optional(),
      city: z.string().optional(),
      facing: z.enum(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]).optional(),
      region_pricing_key: z.string().optional(),
      plot: z
        .object({ w: z.number().min(2000), h: z.number().min(2000) })
        .optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request: " + (e as Error).message },
      { status: 400 },
    );
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
      warnings.push(`BOQ computation failed: ${(e as Error).message}`);
    }

    return NextResponse.json({ spec, plan, planIR, boq, source, warnings });
  } catch (e) {
    return NextResponse.json(
      { error: "Generation failed: " + (e as Error).message },
      { status: 500 },
    );
  }
}
