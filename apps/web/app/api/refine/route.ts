import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRoomEdit, generateSpec } from "@/lib/llm/generate-spec";
import { solveLayout } from "@/lib/solver/solver";
import { solvedPlanToPlanIR } from "@/lib/solver/to-plan-ir";
import { computeBoq } from "@/lib/boq/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RoomZ = z.object({
  id: z.string(),
  name: z.string(),
  area: z.number(),
  zone: z.enum(["public", "private", "service"]),
  entry: z.boolean().optional(),
});

const SpecZ = z.object({
  prompt: z.string().optional(),
  plot: z.object({ w: z.number(), h: z.number() }),
  rooms: z.array(RoomZ),
  budget: z.number().optional(),
});

const Body = z.object({
  /** Whole-floor refine: rebuild from scratch with the new prompt */
  fullPrompt: z.string().min(3).optional(),
  /** Per-room refine: replace one room according to the instruction */
  roomEdit: z
    .object({
      spec: SpecZ,
      roomId: z.string(),
      instruction: z.string().min(3),
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
    if (body.roomEdit) {
      const { spec, roomId, instruction } = body.roomEdit;
      const room = spec.rooms.find((r) => r.id === roomId);
      if (!room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }
      const edit = await generateRoomEdit({ room, instruction });
      const newSpec = {
        ...spec,
        rooms: spec.rooms.map((r) =>
          r.id === roomId ? { ...r, name: edit.name, area: edit.area, zone: edit.zone } : r,
        ),
      };
      const plan = solveLayout(newSpec);
      const planIR = solvedPlanToPlanIR({ spec: newSpec, plan });
      const boq = await computeBoq(planIR).catch(() => null);
      return NextResponse.json({ spec: newSpec, plan, planIR, boq, source: edit.source });
    }

    if (body.fullPrompt) {
      const { spec, source, warnings } = await generateSpec({ prompt: body.fullPrompt });
      const plan = solveLayout(spec);
      const planIR = solvedPlanToPlanIR({ spec, plan });
      const boq = await computeBoq(planIR).catch(() => null);
      return NextResponse.json({ spec, plan, planIR, boq, source, warnings });
    }

    return NextResponse.json({ error: "Provide fullPrompt or roomEdit" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: "Refine failed: " + (e as Error).message },
      { status: 500 },
    );
  }
}
