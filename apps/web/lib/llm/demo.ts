import { type PlanIR } from "@/lib/schema/plan";

/**
 * Procedural fallback used when no LLM API key is configured. Produces a
 * plausible 2BHK / 3BHK shaped to the requested plot, so the editor and
 * BOQ engine work end-to-end in demo mode.
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

  // Heuristic: 3BHK if total area > 90 m², else 2BHK
  const isLarge = (iw / 1000) * (ih / 1000) >= 90 ||
    /3\s*bhk|three.bedroom|3-bhk/i.test(args.prompt);

  // Layout grid: kitchen + dining strip on bottom (40% h),
  // living on bottom-right, bedrooms on top half.
  const splitY = iy + Math.round(ih * 0.5);
  const bedSplitX = ix + Math.round(iw * (isLarge ? 0.45 : 0.5));
  const bath1X = ix + Math.round(iw * 0.6);

  // Walls
  const walls: PlanIR["floors"][number]["walls"] = [];
  const openings: PlanIR["floors"][number]["openings"] = [];
  const rooms: PlanIR["floors"][number]["rooms"] = [];

  const W = (
    id: string,
    a: { x: number; y: number },
    b: { x: number; y: number },
    type: PlanIR["floors"][number]["walls"][number]["type"] = "interior_brick_115",
  ) => walls.push({ id, start: a, end: b, type, height_mm: 3000 });

  // Perimeter (clockwise)
  W("w_top",    { x: ix,         y: iy         }, { x: ix + iw,   y: iy         }, "exterior_brick_230");
  W("w_right",  { x: ix + iw,    y: iy         }, { x: ix + iw,   y: iy + ih    }, "exterior_brick_230");
  W("w_bottom", { x: ix + iw,    y: iy + ih    }, { x: ix,        y: iy + ih    }, "exterior_brick_230");
  W("w_left",   { x: ix,         y: iy + ih    }, { x: ix,        y: iy         }, "exterior_brick_230");

  // Horizontal divider between bedrooms (top half) and living/kitchen (bottom half)
  W("w_mid_h",  { x: ix,         y: splitY     }, { x: ix + iw,   y: splitY     });

  // Vertical divider between bedrooms (top half)
  W("w_bed_v",  { x: bedSplitX,  y: iy         }, { x: bedSplitX, y: splitY     });

  // Bathroom on bottom-right corner
  const bathW = 1800;
  const bathH = 2400;
  const bathX0 = ix + iw - bathW;
  const bathY0 = splitY;
  W("w_bath_top",  { x: bathX0,         y: bathY0 + bathH }, { x: bathX0,         y: bathY0 });
  W("w_bath_left", { x: bathX0,         y: bathY0         }, { x: ix + iw,        y: bathY0 });

  // Kitchen partition (top of kitchen) — left-bottom corner
  const kitW = 3000;
  const kitH = 2700;
  const kitX0 = ix;
  const kitY0 = iy + ih - kitH;
  W("w_kit_right", { x: kitX0 + kitW, y: kitY0           }, { x: kitX0 + kitW, y: iy + ih });
  W("w_kit_top",   { x: kitX0,        y: kitY0           }, { x: kitX0 + kitW, y: kitY0   });

  // 3rd bedroom — only for large plots: split bottom-middle of the bedroom band
  if (isLarge) {
    W("w_bed3_v", { x: bath1X, y: iy }, { x: bath1X, y: splitY });
  }

  // Openings
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

  // Main door on bottom (front) wall — facing south by default
  O("o_main_door", "w_bottom", 0.5, 1000, 2100, "door_single", 0, "teak");

  // Windows on bedroom (top) wall
  O("o_win_bed1", "w_top", 0.25, 1500, 1200, "window_casement", 900, "upvc");
  O("o_win_bed2", "w_top", 0.75, 1500, 1200, "window_casement", 900, "upvc");

  // Windows on side walls
  O("o_win_left",  "w_left",  0.3, 1200, 1200, "window_sliding", 900, "upvc");
  O("o_win_right", "w_right", 0.3, 1200, 1200, "window_sliding", 900, "upvc");

  // Bedroom doors (on the horizontal divider)
  O("o_bed1_door", "w_mid_h", 0.2, 900, 2100, "door_single", 0);
  O("o_bed2_door", "w_mid_h", isLarge ? 0.55 : 0.7, 900, 2100, "door_single", 0);

  // Bathroom door (on the bath_left wall)
  O("o_bath_door", "w_bath_left", 0.5, 750, 2100, "door_single", 0);
  // Bathroom ventilator
  O("o_bath_vent", "w_right", 0.85, 600, 600, "ventilator", 1800);

  // Kitchen — opening (no door — open kitchen) on kit_right
  // (we still need a door visually — sliding)
  O("o_kit_door", "w_kit_right", 0.4, 900, 2100, "door_sliding", 0, "aluminum");

  // Kitchen window
  O("o_kit_win", "w_left", 0.85, 1200, 1200, "window_casement", 900, "upvc");

  // ---------- Rooms ----------
  // Bedroom 1 (top-left)
  rooms.push({
    id: "r_bed1",
    name: "Master Bedroom",
    type: "master_bedroom",
    polygon: [
      { x: ix,        y: iy       },
      { x: bedSplitX, y: iy       },
      { x: bedSplitX, y: splitY   },
      { x: ix,        y: splitY   },
    ],
    finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "putty_emulsion_sqm", ceiling: "pop_false_ceiling_sqm" },
    fixtures: [
      { type: "bed_king",  position: { x: ix + (bedSplitX - ix) / 2,    y: iy + (splitY - iy) / 2 - 200 }, rotation_deg: 0 },
      { type: "wardrobe",  position: { x: ix + 400,                      y: splitY - 500                  }, rotation_deg: 0 },
    ],
  });

  // Bedroom 2 (top-right) or split bedrooms 2 & 3
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
        { type: "bed_double", position: { x: (bedSplitX + bath1X) / 2, y: iy + (splitY - iy) / 2 - 200 }, rotation_deg: 0 },
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
        { type: "bed_single", position: { x: (bath1X + ix + iw) / 2, y: iy + (splitY - iy) / 2 - 200 }, rotation_deg: 0 },
        { type: "study_table", position: { x: ix + iw - 500,         y: iy + 500                       }, rotation_deg: 0 },
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
        { type: "bed_double", position: { x: (bedSplitX + ix + iw) / 2, y: iy + (splitY - iy) / 2 - 200 }, rotation_deg: 0 },
        { type: "wardrobe",   position: { x: ix + iw - 400,             y: splitY - 500                   }, rotation_deg: 0 },
      ],
    });
  }

  // Bathroom
  rooms.push({
    id: "r_bath",
    name: "Bathroom",
    type: "bathroom",
    polygon: [
      { x: bathX0,     y: bathY0         },
      { x: ix + iw,    y: bathY0         },
      { x: ix + iw,    y: bathY0 + bathH },
      { x: bathX0,     y: bathY0 + bathH },
    ],
    finishes: { floor: "ceramic_tile_300x600_sqm", wall_finish: "ceramic_tile_300x600_sqm", ceiling: "gypsum_false_ceiling_sqm" },
    fixtures: [
      { type: "wc",        position: { x: bathX0 + 400,        y: bathY0 + bathH - 600 }, rotation_deg: 0 },
      { type: "washbasin", position: { x: bathX0 + bathW - 400, y: bathY0 + 400         }, rotation_deg: 0 },
      { type: "shower",    position: { x: bathX0 + bathW - 400, y: bathY0 + bathH - 400 }, rotation_deg: 0 },
    ],
  });

  // Kitchen
  rooms.push({
    id: "r_kit",
    name: "Kitchen",
    type: "kitchen",
    polygon: [
      { x: kitX0,        y: kitY0           },
      { x: kitX0 + kitW, y: kitY0           },
      { x: kitX0 + kitW, y: iy + ih         },
      { x: kitX0,        y: iy + ih         },
    ],
    finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "ceramic_tile_300x600_sqm", ceiling: "pop_false_ceiling_sqm" },
    fixtures: [
      { type: "kitchen_sink",   position: { x: kitX0 + 600,        y: kitY0 + 400 }, rotation_deg: 0 },
      { type: "stove_platform", position: { x: kitX0 + kitW - 800, y: kitY0 + 400 }, rotation_deg: 0 },
      { type: "fridge",         position: { x: kitX0 + kitW - 400, y: iy + ih - 400 }, rotation_deg: 0 },
    ],
  });

  // Living + Dining (the rest of the bottom half)
  rooms.push({
    id: "r_living",
    name: "Living / Dining",
    type: "living",
    polygon: [
      { x: kitX0 + kitW, y: splitY         },
      { x: bathX0,       y: splitY         },
      { x: bathX0,       y: bathY0 + bathH },
      { x: ix + iw,      y: bathY0 + bathH },
      { x: ix + iw,      y: iy + ih        },
      { x: kitX0 + kitW, y: iy + ih        },
    ],
    finishes: { floor: "vitrified_tile_600x600_sqm", wall_finish: "putty_emulsion_sqm", ceiling: "pop_false_ceiling_sqm" },
    fixtures: [
      { type: "sofa_3",         position: { x: kitX0 + kitW + 1200, y: splitY + 800 }, rotation_deg: 0 },
      { type: "tv_unit",        position: { x: ix + iw - 800,       y: splitY + 600 }, rotation_deg: 0 },
      { type: "dining_table_4", position: { x: kitX0 + kitW + 1500, y: iy + ih - 1200 }, rotation_deg: 0 },
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
