import { NextResponse } from "next/server";
import { z } from "zod";
import { PlanIR } from "@/lib/schema/plan";
import { computeBoq } from "@/lib/boq/engine";
import { safeFilename, safeCsvCell } from "@/lib/security/sanitize";
import { jsonError, newRequestId } from "@/lib/security/errors";
import { logEvent } from "@/lib/security/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ plan: PlanIR });

export async function POST(req: Request) {
  const requestId = newRequestId();
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return jsonError({
      cause: e, status: 400, message: "Invalid request",
      route: "api.export.csv", requestId,
    });
  }

  let boq;
  try {
    boq = await computeBoq(body.plan);
  } catch (e) {
    return jsonError({
      cause: e, status: 500, message: "Export failed",
      route: "api.export.csv", requestId,
    });
  }

  const header = ["Category", "Item", "Unit", "Quantity", "Rate (INR)", "Amount (INR)", "Source"];
  const rows: string[][] = [header];
  for (const line of boq.lines) {
    rows.push([
      line.category,
      line.display_name,
      line.unit,
      String(line.quantity),
      String(line.rate_inr),
      String(line.amount_inr),
      sourceLabel(line.source),
    ]);
  }
  rows.push([]);
  rows.push(["", "", "", "", "Subtotal", String(boq.subtotal_inr), ""]);
  rows.push(["", "", "", "", `Contingency ${boq.contingency_pct}%`, String(boq.contingency_inr), ""]);
  rows.push(["", "", "", "", `GST ${boq.gst_pct}%`, String(boq.gst_inr), ""]);
  rows.push(["", "", "", "", "Grand Total", String(boq.grand_total_inr), ""]);

  // Excel reads UTF-8 BOM so ₹ + non-ASCII chars render correctly.
  const BOM = "﻿";
  const csv = BOM + rows.map((r) => r.map(safeCsvCell).join(",")).join("\r\n");

  logEvent({
    level: "info", route: "api.export.csv", request_id: requestId,
    status: 200, size_bytes: csv.length,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(body.plan.meta.name)}-BOQ.csv"`,
      "X-Request-Id": requestId,
    },
  });
}

function sourceLabel(s: { kind: string; id?: string; roomId?: string; rule?: string }): string {
  if (s.kind === "wall") return `wall:${s.id}`;
  if (s.kind === "opening") return `opening:${s.id}`;
  if (s.kind === "room") return `room:${s.roomId}`;
  if (s.kind === "fixture") return `fixture:${s.roomId}`;
  if (s.kind === "rule") return `rule:${s.rule}`;
  return s.kind;
}
