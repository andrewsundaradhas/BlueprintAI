import { describe, expect, it } from "vitest";
import { PlanIR, Wall, WALL_THICKNESS_MM } from "@/lib/schema/plan";
import { makeHut } from "../_fixtures/hut";

describe("PlanIR Zod schema", () => {
  it("parses the canonical hut fixture", () => {
    const r = PlanIR.safeParse(makeHut());
    expect(r.success).toBe(true);
  });

  it("rejects an unknown schema_version", () => {
    const bad = { ...makeHut(), schema_version: "0.9.0" };
    const r = PlanIR.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("rejects a plot smaller than the 2000mm minimum", () => {
    const bad = makeHut();
    bad.meta.plot_width_mm = 500;
    expect(PlanIR.safeParse(bad).success).toBe(false);
  });

  it("rejects a wall height below 2100mm", () => {
    const r = Wall.safeParse({
      id: "w1",
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 0 },
      type: "interior_brick_115",
      height_mm: 1500,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an opening with position_along_wall > 1", () => {
    const bad = makeHut();
    bad.floors[0]!.openings[0]!.position_along_wall = 1.4;
    const r = PlanIR.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("requires at least one floor", () => {
    const bad = { ...makeHut(), floors: [] };
    expect(PlanIR.safeParse(bad).success).toBe(false);
  });

  it("exposes wall thicknesses for every WallType", () => {
    expect(WALL_THICKNESS_MM.exterior_brick_230).toBe(230);
    expect(WALL_THICKNESS_MM.interior_brick_115).toBe(115);
    expect(WALL_THICKNESS_MM.rcc_150).toBe(150);
    expect(WALL_THICKNESS_MM.drywall_100).toBe(100);
  });
});
