import { type PlanIR, type RoomType } from "@/lib/schema/plan";
import type { PlanSpec, SolvedPlan, SolvedRoom, Zone } from "./solver";

/**
 * Convert a SolvedPlan (from the design's solver) into the canonical Plan IR
 * so the deterministic BOQ engine can compute against it.
 *
 * Strategy:
 *  - Single floor (level 0, height 3000mm)
 *  - 4 exterior brick walls around the plot perimeter
 *  - For each shared edge between adjacent rooms, emit one interior brick wall
 *  - For each Opening from the solver, emit a Plan IR Opening on the matching wall
 *  - Each room → Plan IR room with rectangular polygon (clockwise) + default finishes
 */
export function solvedPlanToPlanIR(args: {
  spec: PlanSpec;
  plan: SolvedPlan;
  meta?: Partial<PlanIR["meta"]>;
}): PlanIR {
  const { plan, spec } = args;
  const W = plan.plot.w;
  const H = plan.plot.h;

  const meta: PlanIR["meta"] = {
    name: args.meta?.name ?? "Untitled project",
    plot_width_mm: W,
    plot_depth_mm: H,
    facing: args.meta?.facing ?? "N",
    city: args.meta?.city ?? "Chennai",
    region_pricing_key: args.meta?.region_pricing_key ?? "south_metro_tier1",
  };

  // ---------- Walls ----------
  type Wall = PlanIR["floors"][number]["walls"][number];
  const walls: Wall[] = [];

  // Perimeter (clockwise from top-left)
  walls.push({ id: "w_top",    start: { x: 0, y: 0 }, end: { x: W, y: 0 }, type: "exterior_brick_230", height_mm: 3000 });
  walls.push({ id: "w_right",  start: { x: W, y: 0 }, end: { x: W, y: H }, type: "exterior_brick_230", height_mm: 3000 });
  walls.push({ id: "w_bottom", start: { x: W, y: H }, end: { x: 0, y: H }, type: "exterior_brick_230", height_mm: 3000 });
  walls.push({ id: "w_left",   start: { x: 0, y: H }, end: { x: 0, y: 0 }, type: "exterior_brick_230", height_mm: 3000 });

  // Detect shared edges between adjacent rooms → interior walls
  const interiorWalls = detectSharedEdges(plan.rooms);
  for (let i = 0; i < interiorWalls.length; i++) {
    const seg = interiorWalls[i]!;
    walls.push({
      id: `w_int_${i}`,
      start: { x: seg.x1, y: seg.y1 },
      end: { x: seg.x2, y: seg.y2 },
      type: "interior_brick_115",
      height_mm: 3000,
    });
  }

  // ---------- Openings ----------
  type Opening = PlanIR["floors"][number]["openings"][number];
  const openings: Opening[] = [];

  for (const o of plan.openings) {
    // Map the solver opening to a Plan IR opening on the appropriate perimeter wall.
    // For interior doors (between rooms), we attach to the nearest shared interior wall.
    let wall_id: string;
    let positionAlongWall = 0.5;
    let widthMm = o.dir === "h" ? o.w : o.h;
    const heightMm = o.type === "door" ? 2100 : 1200;
    const sillMm = o.type === "door" ? 0 : 900;
    const openingType: Opening["type"] = o.type === "door" ? "door_single" : "window_casement";

    if (o.id === "entry") {
      wall_id = "w_left";
      // Position on left wall (which goes from y=H to y=0). Given solver entry y position:
      const y = o.y + o.h / 2;
      positionAlongWall = clamp01((H - y) / H);
      widthMm = 1000;
    } else if (o.id.startsWith("w-") && o.id.endsWith("-N")) {
      wall_id = "w_top";
      positionAlongWall = clamp01((o.x + o.w / 2) / W);
    } else if (o.id.startsWith("w-") && o.id.endsWith("-S")) {
      wall_id = "w_bottom";
      // bottom wall goes right→left; reverse position
      positionAlongWall = clamp01((W - (o.x + o.w / 2)) / W);
    } else if (o.id.startsWith("w-") && o.id.endsWith("-E")) {
      wall_id = "w_right";
      positionAlongWall = clamp01((o.y + o.h / 2) / H);
    } else {
      // Interior door — find the nearest interior wall
      const iw = findNearestInteriorWall(o, interiorWalls);
      if (iw == null) continue;
      wall_id = `w_int_${iw.idx}`;
      positionAlongWall = iw.t;
    }

    // Clamp width so opening always fits on its wall
    const wallLen = wallLengthFor(walls, wall_id);
    if (wallLen > 0) {
      const maxW = wallLen * 2 * Math.min(positionAlongWall, 1 - positionAlongWall) - 4;
      if (maxW > 300 && widthMm > maxW) widthMm = Math.max(300, Math.floor(maxW));
      if (widthMm > wallLen - 4) widthMm = Math.max(300, Math.floor(wallLen - 4));
      // Re-clamp position so the now-smaller opening fits
      const half = widthMm / 2;
      const minPos = half / wallLen;
      const maxPos = 1 - minPos;
      positionAlongWall = Math.max(minPos, Math.min(maxPos, positionAlongWall));
    }

    if (widthMm < 300) continue;

    openings.push({
      id: `o_${openings.length}_${o.id}`,
      wall_id,
      position_along_wall: positionAlongWall,
      width_mm: widthMm,
      height_mm: heightMm,
      sill_mm: sillMm,
      type: openingType,
      material: openingType.startsWith("window") ? "upvc" : undefined,
    });
  }

  // ---------- Rooms ----------
  type Room = PlanIR["floors"][number]["rooms"][number];
  const rooms: Room[] = plan.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    type: zoneAndNameToRoomType(r),
    polygon: [
      { x: r.x,         y: r.y         },
      { x: r.x + r.w,   y: r.y         },
      { x: r.x + r.w,   y: r.y + r.h   },
      { x: r.x,         y: r.y + r.h   },
    ],
    finishes: defaultFinishesFor(r),
    fixtures: defaultFixturesFor(r),
  }));

  return {
    schema_version: "1.0.0",
    meta,
    floors: [
      {
        level: 0,
        name: "Ground Floor",
        height_mm: 3000,
        walls,
        openings,
        rooms,
      },
    ],
    notes: spec.prompt,
  };
}

// ---------- helpers ----------

type Seg = { x1: number; y1: number; x2: number; y2: number };

function detectSharedEdges(rooms: SolvedRoom[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      // Vertical shared edge
      if (Math.abs(a.x + a.w - b.x) < 200 || Math.abs(b.x + b.w - a.x) < 200) {
        const x =
          Math.abs(a.x + a.w - b.x) < 200
            ? (a.x + a.w + b.x) / 2
            : (a.x + b.x + b.w) / 2;
        const y1 = Math.max(a.y, b.y);
        const y2 = Math.min(a.y + a.h, b.y + b.h);
        if (y2 > y1 + 200) out.push({ x1: x, y1, x2: x, y2 });
      }
      // Horizontal shared edge
      if (Math.abs(a.y + a.h - b.y) < 200 || Math.abs(b.y + b.h - a.y) < 200) {
        const y =
          Math.abs(a.y + a.h - b.y) < 200
            ? (a.y + a.h + b.y) / 2
            : (a.y + b.y + b.h) / 2;
        const x1 = Math.max(a.x, b.x);
        const x2 = Math.min(a.x + a.w, b.x + b.w);
        if (x2 > x1 + 200) out.push({ x1, y1: y, x2, y2: y });
      }
    }
  }
  return out;
}

function findNearestInteriorWall(
  o: { x: number; y: number; w: number; h: number; dir: "h" | "v" },
  walls: Seg[],
): { idx: number; t: number } | null {
  if (!walls.length) return null;
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;
  let bestIdx = -1;
  let bestD = Infinity;
  let bestT = 0.5;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i]!;
    // Projection of (cx,cy) onto segment
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) continue;
    const t = clamp01(((cx - w.x1) * dx + (cy - w.y1) * dy) / len2);
    const px = w.x1 + t * dx;
    const py = w.y1 + t * dy;
    const d = Math.hypot(cx - px, cy - py);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
      bestT = t;
    }
  }
  if (bestIdx < 0 || bestD > 800) return null;
  return { idx: bestIdx, t: bestT };
}

function wallLengthFor(walls: PlanIR["floors"][number]["walls"], id: string): number {
  const w = walls.find((x) => x.id === id);
  if (!w) return 0;
  return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function zoneAndNameToRoomType(r: { name: string; zone: Zone }): RoomType {
  const n = r.name.toLowerCase();
  if (n.includes("master")) return "master_bedroom";
  if (n.includes("kids") || n.includes("child")) return "kids_bedroom";
  if (n.includes("guest")) return "guest_bedroom";
  if (n.includes("bedroom") || n.includes("br ") || n.match(/\bbr\d/)) return "bedroom";
  if (n.includes("kitchen")) return "kitchen";
  if (n.includes("dining")) return "dining";
  if (n.includes("living") || n.includes("hall") || n.includes("foyer")) return "living";
  if (n.includes("bath") || n.includes("toilet") || n.includes("wc")) return "bathroom";
  if (n.includes("balcony")) return "balcony";
  if (n.includes("utility")) return "utility";
  if (n.includes("store")) return "store";
  if (n.includes("puja") || n.includes("pooja") || n.includes("prayer")) return "puja";
  if (n.includes("study")) return "study";
  if (n.includes("corridor") || n.includes("passage")) return "corridor";
  if (n.includes("stair")) return "staircase";
  if (n.includes("garage")) return "garage";
  if (n.includes("terrace")) return "open_terrace";
  if (r.zone === "private") return "bedroom";
  if (r.zone === "public") return "living";
  return "store";
}

function defaultFinishesFor(r: SolvedRoom): PlanIR["floors"][number]["rooms"][number]["finishes"] {
  const t = zoneAndNameToRoomType(r);
  const isWet = t === "bathroom" || t === "toilet";
  const isKitchen = t === "kitchen";
  return {
    floor: isWet ? "ceramic_tile_300x600_sqm" : "vitrified_tile_600x600_sqm",
    wall_finish: isWet || isKitchen ? "ceramic_tile_300x600_sqm" : "putty_emulsion_sqm",
    ceiling: isWet ? "gypsum_false_ceiling_sqm" : "pop_false_ceiling_sqm",
  };
}

function defaultFixturesFor(r: SolvedRoom): PlanIR["floors"][number]["rooms"][number]["fixtures"] {
  const t = zoneAndNameToRoomType(r);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  switch (t) {
    case "bathroom":
    case "toilet":
      return [
        { type: "wc",        position: { x: r.x + 400,        y: r.y + r.h - 400 }, rotation_deg: 0 },
        { type: "washbasin", position: { x: r.x + r.w - 400, y: r.y + 400        }, rotation_deg: 0 },
        { type: "shower",    position: { x: r.x + r.w - 400, y: r.y + r.h - 400 }, rotation_deg: 0 },
      ];
    case "kitchen":
      return [
        { type: "kitchen_sink",   position: { x: r.x + 600,        y: r.y + 400        }, rotation_deg: 0 },
        { type: "stove_platform", position: { x: r.x + r.w - 800, y: r.y + 400        }, rotation_deg: 0 },
        { type: "fridge",         position: { x: r.x + r.w - 400, y: r.y + r.h - 400 }, rotation_deg: 0 },
      ];
    case "master_bedroom":
      return [
        { type: "bed_king", position: { x: cx, y: cy - 200 }, rotation_deg: 0 },
        { type: "wardrobe", position: { x: r.x + 400, y: r.y + r.h - 500 }, rotation_deg: 0 },
      ];
    case "bedroom":
    case "guest_bedroom":
      return [{ type: "bed_double", position: { x: cx, y: cy - 200 }, rotation_deg: 0 }];
    case "kids_bedroom":
      return [
        { type: "bed_single", position: { x: cx, y: cy - 200 }, rotation_deg: 0 },
        { type: "study_table", position: { x: r.x + r.w - 500, y: r.y + 500 }, rotation_deg: 0 },
      ];
    case "living":
    case "dining":
      return [
        { type: "sofa_3",          position: { x: r.x + 1500,        y: r.y + 800            }, rotation_deg: 0 },
        { type: "tv_unit",         position: { x: r.x + r.w - 800,  y: r.y + 600            }, rotation_deg: 0 },
        { type: "dining_table_4",  position: { x: r.x + r.w - 1500, y: r.y + r.h - 1100   }, rotation_deg: 0 },
      ];
    default:
      return [];
  }
}
