import { type PlanIR } from "@/lib/schema/plan";

/**
 * Procedural fallback used when no LLM API key is configured. Produces a
 * valid 2BHK or 3BHK shaped to the requested plot, so the editor and BOQ
 * engine work end-to-end in demo mode.
 *
 * Layout (Y-down, clockwise polygons):
 *
 *   ┌─────────┬─────┬───────────┐
 *   │ Master  │ Bed2│ Bed3*     │  ← splitY (* only when isLarge)
 *   ├─────────┴─────┴───┬───────┤
 *   │                   │ Bath  │
 *   │   Living/Dining   ├───────┤
 *   │                   │       │
 *   ├──────┐            │       │
 *   │ Kitchen           │       │
 *   └──────┴────────────┴───────┘
 */
export function buildDemoPlan(args: {
  prompt: string;
  meta: PlanIR["meta"];
}): PlanIR {
  const { plot_width_mm: pw, plot_depth_mm: pd } = args.meta;
  const setback = 900;
  const ix = setback;             // inner left
  const iy = setback;             // inner top
  const iw = pw - 2 * setback;    // inner width
  const ih = pd - 2 * setback;    // inner height

  const isLarge = (iw / 1000) * (ih / 1000) >= 90 ||
    /3\s*bhk|three.bedroom|3-bhk/i.test(args.prompt);

  // Splits
  const splitY     = iy + Math.round(ih * 0.5);
  const bedSplitX  = ix + Math.round(iw * (isLarge ? 0.45 : 0.5));
  const bath1X     = ix + Math.round(iw * 0.65);  // bedroom 2/3 split (isLarge)

  // Bathroom (top-right of bottom half) — 1.8m × 2.4m
  const bathW = 1800;
  const bathH = 2400;
  const bathX0 = ix + iw - bathW;       // bathroom left
  const bathY0 = splitY;                // bathroom top
  const bathY1 = bathY0 + bathH;        // bathroom bottom

  // Kitchen (bottom-left of bottom half) — 3.0m × 2.7m
  const kitW = 3000;
  const kitH = 2700;
  const kitX0 = ix;                     // kitchen left
  const kitX1 = ix + kitW;              // kitchen right
  const kitY0 = iy + ih - kitH;         // kitchen top
  const kitY1 = iy + ih;                // kitchen bottom

  const walls: PlanIR["floors"][number]["walls"] = [];
  const openings: PlanIR["floors"][number]["openings"] = [];
  const rooms: PlanIR["floors"][number]["rooms"] = [];

  const W = (
    id: string,
    a: { x: number; y: number },
    b: { x: number; y: number },
    type: PlanIR["floors"][number]["walls"][number]["type"] = "interior_brick_115",
  ) => walls.push({ id, start: a, end: b, type, height_mm: 3000 });

  // ---------- Perimeter (clockwise) ----------
  W("w_top",    { x: ix,      y: iy      }, { x: ix + iw, y: iy      }, "exterior_brick_230");
  W("w_right",  { x: ix + iw, y: iy      }, { x: ix + iw, y: iy + ih }, "exterior_brick_230");
  W("w_bottom", { x: ix + iw, y: iy + ih }, { x: ix,      y: iy + ih }, "exterior_brick_230");
  W("w_left",   { x: ix,      y: iy + ih }, { x: ix,      y: iy      }, "exterior_brick_230");

  // ---------- Internal walls ----------
  // Horizontal divider between top (bedrooms) and bottom (living/kitchen) halves
  W("w_mid_h", { x: ix, y: splitY }, { x: ix + iw, y: splitY });

  // Bedroom verticals (top half)
  W("w_bed_v", { x: bedSplitX, y: iy }, { x: bedSplitX, y: splitY });
  if (isLarge) {
    W("w_bed3_v", { x: bath1X, y: iy }, { x: bath1X, y: splitY });
  }

  // Bathroom partitions (in bottom half)
  W("w_bath_left",   { x: bathX0, y: bathY1 }, { x: bathX0,  y: bathY0 });
  W("w_bath_bottom", { x: bathX0, y: bathY1 }, { x: ix + iw, y: bathY1 });

  // Kitchen partitions (in bottom half)
  W("w_kit_top",   { x: kitX0, y: kitY0 }, { x: kitX1, y: kitY0 });
  W("w_kit_right", { x: kitX1, y: kitY0 }, { x: kitX1, y: kitY1 });

  // ---------- Openings ----------
  const O = (
    id: string,
    wall_id: string,
    pos: number,
    width_mm: number,
    height_mm: number,
    type: PlanIR["floors"][number]["openings"][number]["type"],
    sill_mm = 0,
    material?: string,
  ) => openings.push({ id, wall_id, position_along_wall: pos, width_mm, height_mm, sill_mm, type, material });

  // Front door on bottom wall (south facade by default)
  O("o_main_door", "w_bottom", 0.55, 1000, 2100, "door_single", 0, "teak");

  // Bedroom windows on top wall
  O("o_win_bed1", "w_top", 0.22, 1500, 1200, "window_casement", 900, "upvc");
  O("o_win_bed2", "w_top", isLarge ? 0.55 : 0.75, 1500, 1200, "window_casement", 900, "upvc");
  if (isLarge) {
    O("o_win_bed3", "w_top", 0.82, 1200, 1200, "window_casement", 900, "upvc");
  }

  // Bedroom side windows on left/right walls
  // Left wall covers y=iy+ih (start) → y=iy (end). Position 0.7 → y near iy + 0.3*ih (top half).
  O("o_win_bed1_side", "w_left", 0.75, 1200, 1200, "window_sliding", 900, "upvc");
  // Right wall covers y=iy → y=iy+ih. Position 0.2 → y near iy + 0.2*ih (top half = bedroom area).
  O("o_win_bed2_side", "w_right", 0.18, 1200, 1200, "window_sliding", 900, "upvc");

  // Bedroom doors (from corridor/living onto w_mid_h)
  // w_mid_h is from (ix, splitY) → (ix+iw, splitY), length=iw.
  // Bedroom 1 spans x=ix to bedSplitX, midpoint at (bedSplitX-ix)/2 + ix.
  const bed1Center = (ix + bedSplitX) / 2;
  const bed1Pos = (bed1Center - ix) / iw;
  O("o_bed1_door", "w_mid_h", bed1Pos, 900, 2100, "door_single", 0);

  if (isLarge) {
    const bed2Center = (bedSplitX + bath1X) / 2;
    const bed2Pos = (bed2Center - ix) / iw;
    O("o_bed2_door", "w_mid_h", bed2Pos, 900, 2100, "door_single", 0);
    const bed3Center = (bath1X + ix + iw) / 2;
    const bed3Pos = (bed3Center - ix) / iw;
    // Make sure bed3 door doesn't collide with bath area (bath spans bathX0..ix+iw)
    O("o_bed3_door", "w_mid_h", Math.min(bed3Pos, (bathX0 - 600 - ix) / iw), 900, 2100, "door_single", 0);
  } else {
    const bed2Center = (bedSplitX + ix + iw) / 2;
    let bed2Pos = (bed2Center - ix) / iw;
    // Avoid the bathroom range on w_mid_h
    const maxPos = (bathX0 - 600 - ix) / iw;
    if (bed2Pos > maxPos) bed2Pos = maxPos;
    O("o_bed2_door", "w_mid_h", bed2Pos, 900, 2100, "door_single", 0);
  }

  // Bathroom door (on bathroom's left wall = w_bath_left)
  O("o_bath_door", "w_bath_left", 0.5, 750, 2100, "door_single", 0);
  // Bathroom ventilator on the outer right wall, aligned with bathroom interior
  // Bathroom y range: bathY0..bathY1. w_right covers iy..iy+ih, length ih.
  const bathCenterY = (bathY0 + bathY1) / 2;
  const ventPos = (bathCenterY - iy) / ih;
  O("o_bath_vent", "w_right", ventPos, 600, 600, "ventilator", 1800);

  // Kitchen door (sliding) on w_kit_right
  O("o_kit_door", "w_kit_right", 0.4, 900, 2100, "door_sliding", 0, "aluminum");
  // Kitchen window on outer left wall (w_left covers y=iy+ih→iy, length ih)
  // Kitchen y range = kitY0..kitY1. Position from start (y=iy+ih): (iy+ih - centerY)/ih
  const kitCenterY = (kitY0 + kitY1) / 2;
  const kitWinPos = (iy + ih - kitCenterY) / ih;
  O("o_kit_win", "w_left", kitWinPos, 1200, 1200, "window_casement", 900, "upvc");

  // ---------- Rooms ----------
  // Bedroom 1 (top-left)
  rooms.push({
    id: "r_bed1",
    name: "Master Bedroom",
    type: "master_bedroom",
    polygon: [
      { x: ix,        y: iy     },
      { x: bedSplitX, y: iy     },
      { x: bedSplitX, y: splitY },
      { x: ix,        y: splitY },
    ],
    finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "putty_emulsion_sqm", ceiling: "pop_false_ceiling_sqm" },
    fixtures: [
      { type: "bed_king",  position: { x: (ix + bedSplitX) / 2,  y: (iy + splitY) / 2 - 100 }, rotation_deg: 0 },
      { type: "wardrobe",  position: { x: ix + 400,              y: splitY - 500             }, rotation_deg: 0 },
    ],
  });

  if (isLarge) {
    rooms.push({
      id: "r_bed2",
      name: "Bedroom 2",
      type: "bedroom",
      polygon: [
        { x: bedSplitX, y: iy     },
        { x: bath1X,    y: iy     },
        { x: bath1X,    y: splitY },
        { x: bedSplitX, y: splitY },
      ],
      finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "putty_emulsion_sqm", ceiling: "pop_false_ceiling_sqm" },
      fixtures: [
        { type: "bed_double", position: { x: (bedSplitX + bath1X) / 2, y: (iy + splitY) / 2 - 100 }, rotation_deg: 0 },
      ],
    });
    rooms.push({
      id: "r_bed3",
      name: "Bedroom 3",
      type: "kids_bedroom",
      polygon: [
        { x: bath1X,  y: iy     },
        { x: ix + iw, y: iy     },
        { x: ix + iw, y: splitY },
        { x: bath1X,  y: splitY },
      ],
      finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "putty_emulsion_sqm", ceiling: "pop_false_ceiling_sqm" },
      fixtures: [
        { type: "bed_single",  position: { x: (bath1X + ix + iw) / 2, y: (iy + splitY) / 2 - 100 }, rotation_deg: 0 },
        { type: "study_table", position: { x: ix + iw - 500,           y: iy + 500                }, rotation_deg: 0 },
      ],
    });
  } else {
    rooms.push({
      id: "r_bed2",
      name: "Bedroom 2",
      type: "bedroom",
      polygon: [
        { x: bedSplitX, y: iy     },
        { x: ix + iw,   y: iy     },
        { x: ix + iw,   y: splitY },
        { x: bedSplitX, y: splitY },
      ],
      finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "putty_emulsion_sqm", ceiling: "pop_false_ceiling_sqm" },
      fixtures: [
        { type: "bed_double", position: { x: (bedSplitX + ix + iw) / 2, y: (iy + splitY) / 2 - 100 }, rotation_deg: 0 },
        { type: "wardrobe",   position: { x: ix + iw - 400,             y: splitY - 500             }, rotation_deg: 0 },
      ],
    });
  }

  // Bathroom (top-right of bottom half)
  rooms.push({
    id: "r_bath",
    name: "Bathroom",
    type: "bathroom",
    polygon: [
      { x: bathX0,  y: bathY0 },
      { x: ix + iw, y: bathY0 },
      { x: ix + iw, y: bathY1 },
      { x: bathX0,  y: bathY1 },
    ],
    finishes: { floor: "ceramic_tile_300x600_sqm", wall_finish: "ceramic_tile_300x600_sqm", ceiling: "gypsum_false_ceiling_sqm" },
    fixtures: [
      { type: "wc",        position: { x: bathX0 + 400,         y: bathY1 - 400 }, rotation_deg: 0 },
      { type: "washbasin", position: { x: bathX0 + bathW - 400, y: bathY0 + 400 }, rotation_deg: 0 },
      { type: "shower",    position: { x: bathX0 + bathW - 500, y: bathY1 - 500 }, rotation_deg: 0 },
    ],
  });

  // Kitchen (bottom-left of bottom half)
  rooms.push({
    id: "r_kit",
    name: "Kitchen",
    type: "kitchen",
    polygon: [
      { x: kitX0, y: kitY0 },
      { x: kitX1, y: kitY0 },
      { x: kitX1, y: kitY1 },
      { x: kitX0, y: kitY1 },
    ],
    finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "ceramic_tile_300x600_sqm", ceiling: "pop_false_ceiling_sqm" },
    fixtures: [
      { type: "kitchen_sink",   position: { x: kitX0 + 600,        y: kitY0 + 400  }, rotation_deg: 0 },
      { type: "stove_platform", position: { x: kitX1 - 800,        y: kitY0 + 400  }, rotation_deg: 0 },
      { type: "fridge",         position: { x: kitX1 - 400,        y: kitY1 - 400  }, rotation_deg: 0 },
    ],
  });

  // Living / Dining — L-shape that wraps around bathroom and kitchen
  // Polygon clockwise:
  //   (ix, splitY) → (bathX0, splitY) → (bathX0, bathY1) → (ix+iw, bathY1)
  //   → (ix+iw, iy+ih) → (kitX1, iy+ih) → (kitX1, kitY0) → (ix, kitY0) → close
  rooms.push({
    id: "r_living",
    name: "Living / Dining",
    type: "living",
    polygon: [
      { x: ix,      y: splitY  },
      { x: bathX0,  y: splitY  },
      { x: bathX0,  y: bathY1  },
      { x: ix + iw, y: bathY1  },
      { x: ix + iw, y: iy + ih },
      { x: kitX1,   y: iy + ih },
      { x: kitX1,   y: kitY0   },
      { x: ix,      y: kitY0   },
    ],
    finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "putty_emulsion_sqm", ceiling: "pop_false_ceiling_sqm" },
    fixtures: [
      { type: "sofa_3",         position: { x: ix + 1500,            y: splitY + 800             }, rotation_deg: 0 },
      { type: "tv_unit",        position: { x: ix + iw - 800,        y: splitY + 600             }, rotation_deg: 0 },
      { type: "dining_table_4", position: { x: kitX1 + 1500,         y: iy + ih - 1100           }, rotation_deg: 0 },
    ],
  });

  return {
    schema_version: "1.0.0",
    meta: args.meta,
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
    notes: "Generated in demo mode (no LLM API key configured).",
  };
}
