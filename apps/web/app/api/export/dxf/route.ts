import { NextResponse } from "next/server";
import { z } from "zod";
import Drawing from "dxf-writer";
import { PlanIR } from "@/lib/schema/plan";
import { safeFilename, sanitizeForLog } from "@/lib/security/sanitize";
import { jsonError, newRequestId } from "@/lib/security/errors";
import { logEvent } from "@/lib/security/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ plan: PlanIR });

type DrawingApi = {
  setActiveLayer: (name: string) => void;
  drawLine: (x1: number, y1: number, x2: number, y2: number) => DrawingApi;
  drawText: (x: number, y: number, h: number, rot: number, value: string) => DrawingApi;
  addLayer: (name: string, color: number, lineType: string) => DrawingApi;
  toDxfString: () => string;
};

export async function POST(req: Request) {
  const requestId = newRequestId();
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return jsonError({
      cause: e, status: 400, message: "Invalid request",
      route: "api.export.dxf", requestId,
    });
  }

  let dxf: string;
  try {
    const d = new (Drawing as unknown as { new (): DrawingApi })();
    d.addLayer("WALLS",      Drawing.ACI.WHITE,  "CONTINUOUS");
    d.addLayer("OPENINGS",   Drawing.ACI.CYAN,   "CONTINUOUS");
    d.addLayer("ROOMS",      Drawing.ACI.GREEN,  "CONTINUOUS");
    d.addLayer("DIMENSIONS", Drawing.ACI.YELLOW, "CONTINUOUS");

    const f = body.plan.floors[0]!;

    d.setActiveLayer("WALLS");
    for (const w of f.walls) {
      d.drawLine(w.start.x, -w.start.y, w.end.x, -w.end.y);
    }

    d.setActiveLayer("ROOMS");
    for (const r of f.rooms) {
      for (let i = 0; i < r.polygon.length; i++) {
        const a = r.polygon[i]!;
        const b = r.polygon[(i + 1) % r.polygon.length]!;
        d.drawLine(a.x, -a.y, b.x, -b.y);
      }
      let cx = 0, cy = 0;
      for (const p of r.polygon) { cx += p.x; cy += p.y; }
      cx /= r.polygon.length;
      cy /= r.polygon.length;
      // Sanitize the room name before writing into DXF text — DXF treats
      // some characters specially (^M control, etc.).
      d.drawText(cx, -cy, 250, 0, sanitizeForLog(r.name, 80));
    }

    d.setActiveLayer("OPENINGS");
    for (const o of f.openings) {
      const wall = f.walls.find((w) => w.id === o.wall_id);
      if (!wall) continue;
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ux = dx / len;
      const uy = dy / len;
      const cx = wall.start.x + ux * o.position_along_wall * len;
      const cy = wall.start.y + uy * o.position_along_wall * len;
      const halfW = o.width_mm / 2;
      d.drawLine(cx - ux * halfW, -(cy - uy * halfW), cx + ux * halfW, -(cy + uy * halfW));
    }

    dxf = d.toDxfString();
  } catch (e) {
    return jsonError({
      cause: e, status: 500, message: "Export failed",
      route: "api.export.dxf", requestId,
    });
  }

  logEvent({
    level: "info", route: "api.export.dxf", request_id: requestId,
    status: 200, size_bytes: dxf.length,
  });

  return new NextResponse(dxf, {
    headers: {
      "Content-Type": "application/dxf",
      "Content-Disposition": `attachment; filename="${safeFilename(body.plan.meta.name)}.dxf"`,
      "X-Request-Id": requestId,
    },
  });
}
