import {
  type Floor,
  type Opening,
  type PlanIR,
  type Point,
  type Wall,
  WALL_THICKNESS_MM,
} from "./plan";

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

const ENDPOINT_TOL_MM = 5;
const ROOM_EDGE_TOL_MM = 20;

export function validateInvariants(plan: PlanIR): ValidationResult {
  const errors: string[] = [];

  errors.push(...checkUniqueIds(plan));

  for (const floor of plan.floors) {
    errors.push(...checkOpeningsRefValidWalls(floor));
    errors.push(...checkOpeningsFitOnWalls(floor));
    errors.push(...checkNoCoincidentWalls(floor));
    errors.push(...checkRoomPolygons(floor));
    errors.push(...checkWallHeightsMatchFloor(floor));
  }

  errors.push(...checkRoomAreaUnderPlot(plan));

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

function checkUniqueIds(plan: PlanIR): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const floor of plan.floors) {
    for (const w of floor.walls) {
      if (seen.has(w.id)) errors.push(`Duplicate id: wall '${w.id}' on floor ${floor.level}`);
      seen.add(w.id);
    }
    for (const o of floor.openings) {
      if (seen.has(o.id)) errors.push(`Duplicate id: opening '${o.id}' on floor ${floor.level}`);
      seen.add(o.id);
    }
    for (const r of floor.rooms) {
      if (seen.has(r.id)) errors.push(`Duplicate id: room '${r.id}' on floor ${floor.level}`);
      seen.add(r.id);
    }
  }
  return errors;
}

function checkOpeningsRefValidWalls(floor: Floor): string[] {
  const wallIds = new Set(floor.walls.map((w) => w.id));
  const errors: string[] = [];
  for (const o of floor.openings) {
    if (!wallIds.has(o.wall_id)) {
      errors.push(
        `Opening '${o.id}' on floor ${floor.level} references missing wall '${o.wall_id}'`,
      );
    }
  }
  return errors;
}

function checkOpeningsFitOnWalls(floor: Floor): string[] {
  const wallById = new Map(floor.walls.map((w) => [w.id, w] as const));
  const errors: string[] = [];
  for (const o of floor.openings) {
    const w = wallById.get(o.wall_id);
    if (!w) continue;
    const wallLen = wallLength(w);
    const center = o.position_along_wall * wallLen;
    const halfWidth = o.width_mm / 2;
    if (center - halfWidth < -0.5) {
      errors.push(
        `Opening '${o.id}' extends past start of wall '${w.id}' (center=${center.toFixed(1)}, half=${halfWidth.toFixed(1)})`,
      );
    }
    if (center + halfWidth > wallLen + 0.5) {
      errors.push(
        `Opening '${o.id}' extends past end of wall '${w.id}' (center=${center.toFixed(1)}, half=${halfWidth.toFixed(1)}, wallLen=${wallLen.toFixed(1)})`,
      );
    }
  }
  return errors;
}

function checkNoCoincidentWalls(floor: Floor): string[] {
  const errors: string[] = [];
  const walls = floor.walls;
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i]!;
      const b = walls[j]!;
      const overlap = collinearOverlapLength(a, b);
      if (overlap > ENDPOINT_TOL_MM) {
        errors.push(
          `Walls '${a.id}' and '${b.id}' on floor ${floor.level} overlap by ${overlap.toFixed(1)}mm`,
        );
      }
    }
  }
  return errors;
}

function checkRoomPolygons(floor: Floor): string[] {
  const errors: string[] = [];
  for (const r of floor.rooms) {
    if (r.polygon.length < 3) {
      errors.push(`Room '${r.id}' polygon has fewer than 3 points`);
      continue;
    }
    if (!isSimplePolygon(r.polygon)) {
      errors.push(`Room '${r.id}' polygon self-intersects`);
    }
    const area = signedArea(r.polygon);
    if (Math.abs(area) < 1) {
      errors.push(`Room '${r.id}' polygon is degenerate (zero area)`);
      continue;
    }
    if (area < 0) {
      errors.push(
        `Room '${r.id}' polygon is counter-clockwise (signed area=${area.toFixed(1)}) — must be clockwise`,
      );
    }
    for (let i = 0; i < r.polygon.length; i++) {
      const p1 = r.polygon[i]!;
      const p2 = r.polygon[(i + 1) % r.polygon.length]!;
      if (!edgeNearAnyWall(p1, p2, floor.walls, ROOM_EDGE_TOL_MM)) {
        errors.push(
          `Room '${r.id}' edge ${i} (${pp(p1)}→${pp(p2)}) is not within ${ROOM_EDGE_TOL_MM}mm of any wall`,
        );
      }
    }
  }
  return errors;
}

function checkRoomAreaUnderPlot(plan: PlanIR): string[] {
  const errors: string[] = [];
  const plotArea = plan.meta.plot_width_mm * plan.meta.plot_depth_mm;
  const limit = plotArea * 0.85;
  for (const floor of plan.floors) {
    let total = 0;
    for (const r of floor.rooms) total += Math.abs(signedArea(r.polygon));
    if (total > limit) {
      errors.push(
        `Floor ${floor.level} room area ${(total / 1e6).toFixed(2)}m² exceeds 85% of plot ${(limit / 1e6).toFixed(2)}m²`,
      );
    }
  }
  return errors;
}

function checkWallHeightsMatchFloor(floor: Floor): string[] {
  const errors: string[] = [];
  for (const w of floor.walls) {
    if (Math.abs(w.height_mm - floor.height_mm) > 0) {
      errors.push(
        `Wall '${w.id}' height ${w.height_mm}mm does not match floor ${floor.level} height ${floor.height_mm}mm`,
      );
    }
  }
  return errors;
}

// ---------- geometry helpers ----------

export function wallLength(w: Wall): number {
  return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
}

export function wallThickness(w: Wall): number {
  return WALL_THICKNESS_MM[w.type];
}

export function signedArea(poly: readonly Point[]): number {
  // Standard shoelace. With Y-down (canvas) coords, "clockwise" winding
  // produces a POSITIVE signed area (the +Y axis flip reverses sign vs
  // math convention). So `signedArea > 0` ⇔ clockwise on screen.
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function isSimplePolygon(poly: readonly Point[]): boolean {
  const n = poly.length;
  if (n < 4) return true;
  for (let i = 0; i < n; i++) {
    const a1 = poly[i]!;
    const a2 = poly[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      const b1 = poly[j]!;
      const b2 = poly[(j + 1) % n]!;
      if (j === i || (j + 1) % n === i) continue;
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

function segmentsProperlyIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p4.x - p3.x, p4.y - p3.y, p1.x - p3.x, p1.y - p3.y);
  const d2 = cross(p4.x - p3.x, p4.y - p3.y, p2.x - p3.x, p2.y - p3.y);
  const d3 = cross(p2.x - p1.x, p2.y - p1.y, p3.x - p1.x, p3.y - p1.y);
  const d4 = cross(p2.x - p1.x, p2.y - p1.y, p4.x - p1.x, p4.y - p1.y);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function collinearOverlapLength(a: Wall, b: Wall): number {
  // Returns the length of overlap if walls are collinear (within tolerance), else 0.
  const ax = a.end.x - a.start.x;
  const ay = a.end.y - a.start.y;
  const aLen = Math.hypot(ax, ay);
  if (aLen < 1e-6) return 0;
  const ux = ax / aLen;
  const uy = ay / aLen;

  // Both endpoints of B must lie on A's line within tolerance.
  const dStart = perpDistance(b.start, a.start, ux, uy);
  const dEnd = perpDistance(b.end, a.start, ux, uy);
  if (dStart > ENDPOINT_TOL_MM || dEnd > ENDPOINT_TOL_MM) return 0;

  // Project both A and B endpoints onto A's direction.
  const ta1 = 0;
  const ta2 = aLen;
  const tb1 = (b.start.x - a.start.x) * ux + (b.start.y - a.start.y) * uy;
  const tb2 = (b.end.x - a.start.x) * ux + (b.end.y - a.start.y) * uy;
  const aMin = Math.min(ta1, ta2);
  const aMax = Math.max(ta1, ta2);
  const bMin = Math.min(tb1, tb2);
  const bMax = Math.max(tb1, tb2);
  const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
  return overlap > 0 ? overlap : 0;
}

function perpDistance(p: Point, origin: Point, ux: number, uy: number): number {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  // perpendicular component magnitude
  return Math.abs(dx * -uy + dy * ux);
}

function edgeNearAnyWall(p1: Point, p2: Point, walls: Wall[], tol: number): boolean {
  for (const w of walls) {
    if (
      pointToSegmentDistance(p1, w.start, w.end) <= tol &&
      pointToSegmentDistance(p2, w.start, w.end) <= tol
    ) {
      return true;
    }
  }
  return false;
}

function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
  const t = c1 / c2;
  const px = a.x + t * vx;
  const py = a.y + t * vy;
  return Math.hypot(p.x - px, p.y - py);
}

function pp(p: Point): string {
  return `(${p.x.toFixed(0)},${p.y.toFixed(0)})`;
}
