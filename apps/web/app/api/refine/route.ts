import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRoomEdit, generateSpec } from "@/lib/llm/generate-spec";
import { solveLayout } from "@/lib/solver/solver";
import { solvedPlanToPlanIR } from "@/lib/solver/to-plan-ir";
import { computeBoq } from "@/lib/boq/engine";
import { jsonError, newRequestId } from "@/lib/security/errors";
import { logEvent, hashIp } from "@/lib/security/logger";
import { clientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RoomZ = z.object({
  id:    z.string().min(1).max(40),
  name:  z.string().min(1).max(80),
  area:  z.number().min(1).max(80),
  zone:  z.enum(["public", "private", "service"]),
  entry: z.boolean().optional(),
});

const SpecZ = z.object({
  prompt: z.string().max(2000).optional(),
  plot: z.object({
    w: z.number().min(2000).max(60000),
    h: z.number().min(2000).max(60000),
  }),
  rooms: z.array(RoomZ).min(1).max(40),
  budget: z.number().min(0).max(1e9).optional(),
});

const Body = z.object({
  fullPrompt: z.string().min(3).max(2000).optional(),
  roomEdit: z
    .object({
      spec: SpecZ,
      roomId: z.string().min(1).max(40),
      instruction: z.string().min(3).max(1000),
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
      route: "api.refine", requestId,
      meta: { ip_hash: ipHash },
    });
  }

  try {
    if (body.roomEdit) {
      const { spec, roomId, instruction } = body.roomEdit;
      const room = spec.rooms.find((r) => r.id === roomId);
      if (!room) {
        return jsonError({
          cause: new Error("room not found"), status: 404,
          message: "Room not found",
          route: "api.refine", requestId,
          meta: { ip_hash: ipHash },
        });
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
      logEvent({
        level: "info", route: "api.refine.room", request_id: requestId,
        status: 200, ms: Date.now() - t0, ip_hash: ipHash,
        source: edit.source, provider: edit.source,
      });
      return NextResponse.json(
        { spec: newSpec, plan, planIR, boq, source: edit.source, request_id: requestId },
        { headers: { "X-Request-Id": requestId } },
      );
    }

    if (body.fullPrompt) {
      const { spec, source, warnings } = await generateSpec({ prompt: body.fullPrompt });
      const plan = solveLayout(spec);
      const planIR = solvedPlanToPlanIR({ spec, plan });
      const boq = await computeBoq(planIR).catch(() => null);
      logEvent({
        level: "info", route: "api.refine.full", request_id: requestId,
        status: 200, ms: Date.now() - t0, ip_hash: ipHash,
        source, provider: source, rooms: plan.rooms.length,
      });
      return NextResponse.json(
        { spec, plan, planIR, boq, source, warnings, request_id: requestId },
        { headers: { "X-Request-Id": requestId } },
      );
    }

    return jsonError({
      cause: new Error("missing operation"), status: 400,
      message: "Provide fullPrompt or roomEdit",
      route: "api.refine", requestId,
      meta: { ip_hash: ipHash },
    });
  } catch (e) {
    return jsonError({
      cause: e, status: 500, message: "Refine failed",
      route: "api.refine", requestId,
      meta: { ip_hash: ipHash, ms: Date.now() - t0 },
    });
  }
}
