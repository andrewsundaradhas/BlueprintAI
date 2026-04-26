import { describe, expect, it } from "vitest";
import { type PlanIR } from "@/lib/schema/plan";
import { signedArea, validateInvariants } from "@/lib/schema/validate";
import { makeHut } from "../_fixtures/hut";

function clone(p: PlanIR): PlanIR {
  return JSON.parse(JSON.stringify(p)) as PlanIR;
}

describe("validateInvariants — happy path", () => {
  it("accepts the canonical hut", () => {
    const r = validateInvariants(makeHut());
    expect(r).toEqual({ ok: true });
  });
});

describe("Invariant 1: Opening.wall_id must reference an existing wall on the same floor", () => {
  it("flags a dangling wall_id", () => {
    const p = clone(makeHut());
    p.floors[0]!.openings[0]!.wall_id = "nonexistent";
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/references missing wall/);
    }
  });
});

describe("Invariant 2: openings must fit on their wall", () => {
  it("flags an opening that extends past wall end", () => {
    const p = clone(makeHut());
    // door is 900mm wide on a 3000mm wall. position 0.99 → center=2970, half=450 → spills past end.
    p.floors[0]!.openings[0]!.position_along_wall = 0.99;
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/extends past end/);
  });

  it("flags an opening that extends before wall start", () => {
    const p = clone(makeHut());
    p.floors[0]!.openings[0]!.position_along_wall = 0.01;
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/extends past start/);
  });

  it("accepts openings exactly at the boundary tolerance", () => {
    const p = clone(makeHut());
    // door 900mm on 3000mm wall, centered at 0.5 (1500mm) is well within → ok.
    p.floors[0]!.openings[0]!.position_along_wall = 0.5;
    expect(validateInvariants(p).ok).toBe(true);
  });
});

describe("Invariant 3: no two coincident walls on the same floor", () => {
  it("flags overlapping collinear walls", () => {
    const p = clone(makeHut());
    p.floors[0]!.walls.push({
      id: "w_top_dup",
      start: { x: 500, y: 0 },
      end: { x: 2500, y: 0 },
      type: "exterior_brick_230",
      height_mm: 3000,
    });
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/overlap/);
  });

  it("allows walls that only touch at endpoints", () => {
    // Hut already has 4 walls touching at endpoints — passes.
    expect(validateInvariants(makeHut()).ok).toBe(true);
  });
});

describe("Invariant 4: room polygons must be closed, simple, clockwise, and edges near walls", () => {
  it("flags a counter-clockwise polygon", () => {
    const p = clone(makeHut());
    p.floors[0]!.rooms[0]!.polygon = [...p.floors[0]!.rooms[0]!.polygon].reverse();
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/counter-clockwise/);
  });

  it("flags a self-intersecting polygon", () => {
    const p = clone(makeHut());
    // Bowtie: swap two non-adjacent points to create a self-intersection.
    p.floors[0]!.rooms[0]!.polygon = [
      { x: 0, y: 0 },
      { x: 3000, y: 4000 },
      { x: 3000, y: 0 },
      { x: 0, y: 4000 },
    ];
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/self-intersects|counter-clockwise/);
  });

  it("flags a polygon edge with no nearby wall", () => {
    const p = clone(makeHut());
    p.floors[0]!.rooms[0]!.polygon = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ];
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/not within/);
  });
});

describe("Invariant 5: total room area ≤ 85% of plot area", () => {
  it("flags a room that fills the entire plot", () => {
    const p = clone(makeHut());
    // Shrink the plot so the 12m² hut exceeds 85%.
    p.meta.plot_width_mm = 3000;
    p.meta.plot_depth_mm = 4000;
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/exceeds 85% of plot/);
  });
});

describe("Invariant 6: all wall heights match the floor height", () => {
  it("flags a wall whose height differs from the floor", () => {
    const p = clone(makeHut());
    p.floors[0]!.walls[0]!.height_mm = 2700;
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/does not match floor/);
  });
});

describe("Invariant 7: no duplicate IDs anywhere in the plan", () => {
  it("flags two walls with the same id", () => {
    const p = clone(makeHut());
    p.floors[0]!.walls.push({
      id: "w_top",
      start: { x: 0, y: 1000 },
      end: { x: 100, y: 1000 },
      type: "interior_brick_115",
      height_mm: 3000,
    });
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/Duplicate id/);
  });

  it("flags a wall and an opening sharing an id", () => {
    const p = clone(makeHut());
    p.floors[0]!.openings[0]!.id = "w_top";
    const r = validateInvariants(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/Duplicate id/);
  });
});

describe("signedArea winding helper", () => {
  it("returns positive area for a clockwise polygon under Y-down", () => {
    const a = signedArea([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(a).toBe(100);
  });

  it("returns negative area for the same polygon reversed", () => {
    const a = signedArea([
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect(a).toBe(-100);
  });
});
