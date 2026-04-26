import {
  type Floor,
  type Opening,
  type PlanIR,
  type Point,
  type RoomType,
  type Wall,
  WALL_THICKNESS_MM,
} from "@/lib/schema/plan";
import { signedArea, wallLength } from "@/lib/schema/validate";

// ---------- types ----------

export type TakeoffSource =
  | { kind: "wall"; id: string }
  | { kind: "opening"; id: string }
  | { kind: "room"; roomId: string }
  | { kind: "fixture"; roomId: string }
  | { kind: "rule"; rule: string };

export type Takeoff = {
  itemKey: string;
  quantity: number;
  source: TakeoffSource;
};

// ---------- tunable constants ----------

export const WASTAGE = {
  bricks: 0.05,
  sand: 0.05,
  aggregate: 0.05,
  tiles: 0.05,
  cement: 0.03,
  steel: 0.03,
} as const;

export const LABOR_UPLIFT: Record<string, number> = {
  civil: 0.35,
  masonry: 0.35,
  steel: 0.35,
  doors_windows: 0.15,
  finishes: 0.30,
  electrical: 0.40,
  plumbing: 0.40,
};

export const PLASTER_THICKNESS_M = 0.012;

// Brickwork material consumption per m³ of wall volume (1:6 cement mortar).
const BRICKS_PER_CUM = 500;
const BRICK_MORTAR_CEMENT_BAGS_PER_CUM_WALL = 1.4;
const BRICK_MORTAR_SAND_CUM_PER_CUM_WALL = 0.27;

// 12mm plaster mortar 1:4 — bags cement + m³ sand per m³ of plaster.
const PLASTER_CEMENT_BAGS_PER_CUM = 1.7;
const PLASTER_SAND_CUM_PER_CUM = 0.27;

// RCC reinforcement assumption.
const STEEL_KG_PER_CUM_RCC = 110;

// Electrical points by room type.
export const ELECTRICAL_POINTS_BY_ROOM: Record<RoomType, number> = {
  bedroom: 8,
  master_bedroom: 8,
  kids_bedroom: 8,
  guest_bedroom: 8,
  living: 12,
  dining: 6,
  kitchen: 10,
  bathroom: 4,
  toilet: 4,
  balcony: 2,
  utility: 4,
  store: 4,
  puja: 4,
  study: 4,
  corridor: 4,
  staircase: 4,
  lobby: 4,
  garage: 4,
  open_terrace: 2,
};

// ---------- opening → BOQ mapping ----------

/**
 * Resolve a (type, material) pair to a rate item key + quantity.
 * `quantity` is in the unit of the item (no for unit-priced doors, sqm for windows).
 */
export function openingItem(o: Opening): { itemKey: string; quantity: number } {
  const mat = (o.material ?? "").toLowerCase();
  const areaSqm = (o.width_mm * o.height_mm) / 1e6;

  switch (o.type) {
    case "door_single":
      if (mat === "teak") return { itemKey: "door_single_teak", quantity: 1 };
      return { itemKey: "door_single_flush", quantity: 1 };
    case "door_double":
      return { itemKey: "door_double_teak", quantity: 1 };
    case "door_sliding":
      return { itemKey: "door_sliding_alu", quantity: 1 };
    case "window_casement":
    case "window_sliding":
    case "window_fixed":
      if (mat === "aluminum" || mat === "aluminium") {
        return { itemKey: "window_alu_sqm", quantity: areaSqm };
      }
      return { itemKey: "window_upvc_sqm", quantity: areaSqm };
    case "ventilator":
      return { itemKey: "ventilator_no", quantity: 1 };
    default: {
      const _exhaustive: never = o.type;
      throw new Error(`Unknown opening type: ${_exhaustive as string}`);
    }
  }
}

const FIXTURE_TO_ITEM: Partial<Record<string, string>> = {
  wc: "plumb_wc_no",
  washbasin: "plumb_washbasin_no",
  shower: "plumb_shower_no",
  bathtub: "plumb_shower_no",
  kitchen_sink: "plumb_kitchen_sink_no",
};

// ---------- main per-floor takeoff ----------

export function takeoffsForPlan(plan: PlanIR): Takeoff[] {
  const takeoffs: Takeoff[] = [];
  for (const floor of plan.floors) {
    takeoffs.push(...takeoffsForFloor(floor));
  }
  return takeoffs;
}

function takeoffsForFloor(floor: Floor): Takeoff[] {
  const out: Takeoff[] = [];

  // Index openings by wall.
  const openingsByWall = new Map<string, Opening[]>();
  for (const o of floor.openings) {
    const list = openingsByWall.get(o.wall_id) ?? [];
    list.push(o);
    openingsByWall.set(o.wall_id, list);
  }

  // ----- Walls: masonry / RCC + plaster -----
  for (const w of floor.walls) {
    const ops = openingsByWall.get(w.id) ?? [];
    const lenM = wallLength(w) / 1000;
    const heightM = w.height_mm / 1000;
    const thickM = WALL_THICKNESS_MM[w.type] / 1000;
    const grossVolCum = lenM * thickM * heightM;
    const openingVolCum = ops.reduce(
      (sum, o) => sum + ((o.width_mm * o.height_mm) / 1e6) * thickM,
      0,
    );
    const netVolCum = Math.max(0, grossVolCum - openingVolCum);

    if (w.type === "exterior_brick_230" || w.type === "interior_brick_115") {
      out.push({
        itemKey: "brick_red_no",
        quantity: BRICKS_PER_CUM * netVolCum * (1 + WASTAGE.bricks),
        source: { kind: "wall", id: w.id },
      });
      out.push({
        itemKey: "cement_opc53_bag",
        quantity:
          BRICK_MORTAR_CEMENT_BAGS_PER_CUM_WALL * netVolCum * (1 + WASTAGE.cement),
        source: { kind: "wall", id: w.id },
      });
      out.push({
        itemKey: "river_sand_cum",
        quantity:
          BRICK_MORTAR_SAND_CUM_PER_CUM_WALL * netVolCum * (1 + WASTAGE.sand),
        source: { kind: "wall", id: w.id },
      });
    } else if (w.type === "rcc_150") {
      out.push({
        itemKey: "rmc_m25_cum",
        quantity: netVolCum,
        source: { kind: "wall", id: w.id },
      });
      out.push({
        itemKey: "steel_tmt_fe550_kg",
        quantity: STEEL_KG_PER_CUM_RCC * netVolCum * (1 + WASTAGE.steel),
        source: { kind: "wall", id: w.id },
      });
    }
    // drywall_100: no masonry takeoff in v1 (board+stud is a future line item).

    // Plaster on both faces (skip drywall — already finished surface).
    if (w.type !== "drywall_100") {
      const grossFaceAreaSqm = lenM * heightM;
      const openingFaceAreaSqm = ops.reduce(
        (sum, o) => sum + (o.width_mm * o.height_mm) / 1e6,
        0,
      );
      const netFaceAreaSqm = Math.max(0, grossFaceAreaSqm - openingFaceAreaSqm);
      const plasterVolPerFaceCum = netFaceAreaSqm * PLASTER_THICKNESS_M;
      const plasterTotalCum = plasterVolPerFaceCum * 2;
      out.push({
        itemKey: "cement_opc53_bag",
        quantity: PLASTER_CEMENT_BAGS_PER_CUM * plasterTotalCum * (1 + WASTAGE.cement),
        source: { kind: "wall", id: w.id },
      });
      out.push({
        itemKey: "river_sand_cum",
        quantity: PLASTER_SAND_CUM_PER_CUM * plasterTotalCum * (1 + WASTAGE.sand),
        source: { kind: "wall", id: w.id },
      });
    }
  }

  // ----- Openings: per-unit door/window items -----
  for (const o of floor.openings) {
    const it = openingItem(o);
    out.push({
      itemKey: it.itemKey,
      quantity: it.quantity,
      source: { kind: "opening", id: o.id },
    });
  }

  // ----- Rooms: floor + ceiling + wall finishes + electrical -----
  const totalElectricalPoints = floor.rooms.reduce(
    (sum, r) => sum + (ELECTRICAL_POINTS_BY_ROOM[r.type] ?? 4),
    0,
  );

  for (const r of floor.rooms) {
    const floorAreaSqm = Math.abs(signedArea(r.polygon)) / 1e6;
    const heightM = floor.height_mm / 1000;

    // Floor finish.
    if (r.finishes.floor) {
      const isTile = r.finishes.floor.includes("tile");
      const wastage = isTile ? WASTAGE.tiles : 0;
      out.push({
        itemKey: r.finishes.floor,
        quantity: floorAreaSqm * (1 + wastage),
        source: { kind: "room", roomId: r.id },
      });
    }

    // Ceiling.
    if (r.finishes.ceiling) {
      out.push({
        itemKey: r.finishes.ceiling,
        quantity: floorAreaSqm,
        source: { kind: "room", roomId: r.id },
      });
    }

    // Wall finish: sum of room edges × height − openings on those edges.
    if (r.finishes.wall_finish) {
      let wallFinishAreaSqm = 0;
      for (let i = 0; i < r.polygon.length; i++) {
        const p1 = r.polygon[i]!;
        const p2 = r.polygon[(i + 1) % r.polygon.length]!;
        const edgeLenM = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 1000;
        wallFinishAreaSqm += edgeLenM * heightM;

        // Subtract any openings on the wall this edge runs along.
        const matchedWall = wallAlongEdge(p1, p2, floor.walls, 25);
        if (matchedWall) {
          const ops = openingsByWall.get(matchedWall.id) ?? [];
          for (const o of ops) {
            if (openingCenterOnEdge(o, matchedWall, p1, p2)) {
              wallFinishAreaSqm -= (o.width_mm * o.height_mm) / 1e6;
            }
          }
        }
      }
      wallFinishAreaSqm = Math.max(0, wallFinishAreaSqm);
      const isTile = r.finishes.wall_finish.includes("tile");
      const wastage = isTile ? WASTAGE.tiles : 0;
      out.push({
        itemKey: r.finishes.wall_finish,
        quantity: wallFinishAreaSqm * (1 + wastage),
        source: { kind: "room", roomId: r.id },
      });
    }

    // Fixtures → plumbing.
    for (const f of r.fixtures) {
      const itemKey = FIXTURE_TO_ITEM[f.type];
      if (itemKey) {
        out.push({
          itemKey,
          quantity: 1,
          source: { kind: "fixture", roomId: r.id },
        });
      }
    }

    // Electrical points per room.
    const points = ELECTRICAL_POINTS_BY_ROOM[r.type] ?? 4;
    out.push({
      itemKey: "elec_point_no",
      quantity: points,
      source: { kind: "room", roomId: r.id },
    });

    // Concealed wiring: by floor area.
    out.push({
      itemKey: "wiring_per_sqft",
      quantity: floorAreaSqm,
      source: { kind: "room", roomId: r.id },
    });
  }

  // ----- Floor-wide rules -----
  // One DB per ground floor (level === 0). Other floors share.
  if (floor.level === 0 && floor.rooms.length > 0) {
    out.push({
      itemKey: "elec_db_no",
      quantity: 1,
      source: { kind: "rule", rule: "one_db_per_ground_floor" },
    });
  }

  void totalElectricalPoints; // currently per-room; reserved for future check
  return out;
}

// ---------- geometry helpers (private) ----------

function wallAlongEdge(
  p1: Point,
  p2: Point,
  walls: Wall[],
  tolMm: number,
): Wall | undefined {
  for (const w of walls) {
    if (
      pointToSegDist(p1, w.start, w.end) <= tolMm &&
      pointToSegDist(p2, w.start, w.end) <= tolMm
    ) {
      return w;
    }
  }
  return undefined;
}

function openingCenterOnEdge(o: Opening, w: Wall, p1: Point, p2: Point): boolean {
  const wlen = wallLength(w);
  if (wlen < 1e-6) return false;
  const ux = (w.end.x - w.start.x) / wlen;
  const uy = (w.end.y - w.start.y) / wlen;
  const cx = w.start.x + ux * o.position_along_wall * wlen;
  const cy = w.start.y + uy * o.position_along_wall * wlen;
  const t = ((cx - p1.x) * (p2.x - p1.x) + (cy - p1.y) * (p2.y - p1.y)) /
    Math.max(1e-9, (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  return t >= -0.01 && t <= 1.01;
}

function pointToSegDist(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
  const t = c1 / c2;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

