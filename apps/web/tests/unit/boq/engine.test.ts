import { describe, expect, it } from "vitest";
import { computeBoq, type BoqResult } from "@/lib/boq/engine";
import { type PlanIR } from "@/lib/schema/plan";
import { makeHut } from "../_fixtures/hut";

const FROZEN_NOW = () => new Date("2026-04-26T00:00:00.000Z");

function clone(p: PlanIR): PlanIR {
  return JSON.parse(JSON.stringify(p)) as PlanIR;
}

function findLine(boq: BoqResult, itemKey: string) {
  return boq.lines.filter((l) => l.itemKey === itemKey);
}

function quantityFor(boq: BoqResult, itemKey: string): number {
  return findLine(boq, itemKey).reduce((s, l) => s + l.quantity, 0);
}

function amountFor(boq: BoqResult, itemKey: string): number {
  return findLine(boq, itemKey).reduce((s, l) => s + l.amount_inr, 0);
}

describe("computeBoq — hut baseline", () => {
  it("matches a hand-calculated BOQ within ±5%", async () => {
    const boq = await computeBoq(makeHut(), { now: FROZEN_NOW });

    // ---- Bricks ----
    // 4 walls, total brick wall volume:
    //   top:    3.0 × 0.23 × 3.0 - (1.20 × 1.20 × 0.23) = 2.07 - 0.3312 = 1.7388 m³
    //   right:  4.0 × 0.23 × 3.0                        = 2.76          m³
    //   bottom: 3.0 × 0.23 × 3.0 - (0.90 × 2.10 × 0.23) = 2.07 - 0.4347 = 1.6353 m³
    //   left:   4.0 × 0.23 × 3.0                        = 2.76          m³
    //   total  = 8.8941 m³  →  500 bricks/m³ × 1.05 wastage = 4669 bricks
    const expectedBricks = 8.8941 * 500 * 1.05;
    expect(quantityFor(boq, "brick_red_no")).toBeCloseTo(expectedBricks, -1); // ±10 bricks

    // ---- Doors / windows ----
    expect(quantityFor(boq, "door_single_flush")).toBe(1);
    expect(quantityFor(boq, "window_upvc_sqm")).toBeCloseTo(1.44, 2);

    // ---- Floor finish (vitrified tile) ----
    // 3m × 4m = 12 m², × 1.05 wastage = 12.6 sqm
    expect(quantityFor(boq, "vitrified_tile_600x600_sqm")).toBeCloseTo(12.6, 2);

    // ---- Ceiling ----
    expect(quantityFor(boq, "pop_false_ceiling_sqm")).toBeCloseTo(12.0, 2);

    // ---- Wall finish (putty) ----
    // perimeter 14m × height 3m = 42 m² minus openings (1.89 + 1.44) = 38.67 m²
    expect(quantityFor(boq, "putty_emulsion_sqm")).toBeCloseTo(38.67, 1);

    // ---- Plumbing fixtures (3 fixtures with plumbing keys) ----
    expect(quantityFor(boq, "plumb_wc_no")).toBe(1);
    expect(quantityFor(boq, "plumb_washbasin_no")).toBe(1);
    expect(quantityFor(boq, "plumb_kitchen_sink_no")).toBe(1);
    // sofa_3 is decorative — not in BOQ
    expect(quantityFor(boq, "plumb_shower_no")).toBe(0);

    // ---- Electrical: living room = 12 points ----
    expect(quantityFor(boq, "elec_point_no")).toBe(12);
    // One DB on ground floor
    expect(quantityFor(boq, "elec_db_no")).toBe(1);

    // ---- Bottom-line sanity: hand-calc materials subtotal ≈ ₹1.08L,
    //      plus labor ~₹0.35L, plus 5% contingency, plus 18% GST.
    //      Expected grand total ≈ ₹1.78L. Allow ±15% on the global figure
    //      since rounding propagates through many lines.
    expect(boq.grand_total_inr).toBeGreaterThan(150_000);
    expect(boq.grand_total_inr).toBeLessThan(220_000);
  });

  it("snapshots the rate set used for reproducibility", async () => {
    const boq = await computeBoq(makeHut(), { now: FROZEN_NOW });
    expect(boq.rates_used.cement_opc53_bag).toBeDefined();
    expect(boq.rates_used.cement_opc53_bag?.rate).toBe(420);
  });

  it("sums byCategory equal to the line-item total", async () => {
    const boq = await computeBoq(makeHut(), { now: FROZEN_NOW });
    const categorySum = Object.values(boq.byCategory).reduce((s, n) => s + n, 0);
    const lineSum = boq.lines.reduce((s, l) => s + l.amount_inr, 0);
    expect(categorySum).toBeCloseTo(lineSum, 0);
  });

  it("populates byRoom with the living room id", async () => {
    const boq = await computeBoq(makeHut(), { now: FROZEN_NOW });
    expect(boq.byRoom["r_living"]).toBeGreaterThan(0);
  });
});

describe("computeBoq — determinism", () => {
  it("produces identical results on repeated calls with the same inputs", async () => {
    const a = await computeBoq(makeHut(), { now: FROZEN_NOW });
    const b = await computeBoq(makeHut(), { now: FROZEN_NOW });
    expect(b.grand_total_inr).toBe(a.grand_total_inr);
    expect(b.lines.length).toBe(a.lines.length);
    expect(b.lines.map((l) => l.itemKey)).toEqual(a.lines.map((l) => l.itemKey));
    expect(b.lines.map((l) => l.amount_inr)).toEqual(a.lines.map((l) => l.amount_inr));
  });

  it("uses the injected clock for generated_at", async () => {
    const boq = await computeBoq(makeHut(), { now: FROZEN_NOW });
    expect(boq.generated_at).toBe("2026-04-26T00:00:00.000Z");
  });
});

describe("computeBoq — edits recompute deterministically", () => {
  it("changing wall length increases brick + cement + sand quantities monotonically", async () => {
    const before = await computeBoq(makeHut(), { now: FROZEN_NOW });

    // Stretch the right wall from 4m to 6m, and expand polygon to match.
    const longer = clone(makeHut());
    longer.floors[0]!.walls[1]!.end.y = 6000;     // right wall
    longer.floors[0]!.walls[2]!.start.y = 6000;   // bottom wall start
    longer.floors[0]!.walls[2]!.end.y = 6000;     // bottom wall end
    longer.floors[0]!.walls[3]!.start.y = 6000;   // left wall start
    longer.floors[0]!.rooms[0]!.polygon = [
      { x: 0,    y: 0    },
      { x: 3000, y: 0    },
      { x: 3000, y: 6000 },
      { x: 0,    y: 6000 },
    ];
    // Plot must accommodate room within 85% — bump it.
    longer.meta.plot_width_mm = 5000;
    longer.meta.plot_depth_mm = 8000;

    const after = await computeBoq(longer, { now: FROZEN_NOW });

    expect(quantityFor(after, "brick_red_no")).toBeGreaterThan(
      quantityFor(before, "brick_red_no"),
    );
    expect(quantityFor(after, "vitrified_tile_600x600_sqm")).toBeGreaterThan(
      quantityFor(before, "vitrified_tile_600x600_sqm"),
    );
    // Determinism: same input twice → same output
    const after2 = await computeBoq(longer, { now: FROZEN_NOW });
    expect(after2.grand_total_inr).toBe(after.grand_total_inr);
  });
});

describe("computeBoq — fixture removal", () => {
  it("removing the WC drops the WC plumbing line exactly", async () => {
    const before = await computeBoq(makeHut(), { now: FROZEN_NOW });
    expect(quantityFor(before, "plumb_wc_no")).toBe(1);

    const noWc = clone(makeHut());
    noWc.floors[0]!.rooms[0]!.fixtures = noWc.floors[0]!.rooms[0]!.fixtures
      .filter((f) => f.type !== "wc");

    const after = await computeBoq(noWc, { now: FROZEN_NOW });
    expect(quantityFor(after, "plumb_wc_no")).toBe(0);

    // The other plumbing lines remain unchanged.
    expect(quantityFor(after, "plumb_washbasin_no")).toBe(1);
    expect(quantityFor(after, "plumb_kitchen_sink_no")).toBe(1);

    // The total decreases by ≈ ₹6500 + uplift + 5% + 18% GST  →  ≈ ₹9700.
    expect(before.grand_total_inr - after.grand_total_inr).toBeGreaterThan(8000);
    expect(before.grand_total_inr - after.grand_total_inr).toBeLessThan(13000);
  });
});

describe("computeBoq — opening type → BOQ item mapping", () => {
  it("maps a teak single door to the teak rate", async () => {
    const p = clone(makeHut());
    p.floors[0]!.openings[0]!.material = "teak";
    const boq = await computeBoq(p, { now: FROZEN_NOW });
    expect(quantityFor(boq, "door_single_teak")).toBe(1);
    expect(quantityFor(boq, "door_single_flush")).toBe(0);
  });

  it("maps an aluminum window to the aluminum rate (sqm)", async () => {
    const p = clone(makeHut());
    p.floors[0]!.openings[1]!.material = "aluminum";
    const boq = await computeBoq(p, { now: FROZEN_NOW });
    expect(quantityFor(boq, "window_alu_sqm")).toBeCloseTo(1.44, 2);
    expect(amountFor(boq, "window_alu_sqm")).toBeCloseTo(1.44 * 3800, 0);
  });
});
