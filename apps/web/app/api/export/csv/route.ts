import { NextResponse } from "next/server";
import { z } from "zod";
import { PlanIR } from "@/lib/schema/plan";
import { computeBoq } from "@/lib/boq/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ plan: PlanIR });

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const boq = await computeBoq(body.plan);

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

  const csv = rows.map((r) => r.map(csvField).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${body.plan.meta.name}-BOQ.csv"`,
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

function csvField(v: string): string {
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
