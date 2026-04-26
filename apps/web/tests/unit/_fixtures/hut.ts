import { type PlanIR } from "@/lib/schema/plan";

/**
 * A 3m × 4m single-room "hut" — the smallest valid PlanIR we can build.
 * Used as a hand-calculable BOQ baseline.
 *
 * Layout (Y-down, clockwise polygon):
 *
 *   (0,0)  ────────  (3000,0)     ← top wall  (window in middle)
 *     │                  │
 *     │     LIVING       │        ← left & right walls
 *     │                  │
 *   (0,4000)──────  (3000,4000)   ← bottom wall (door in middle)
 */
export function makeHut(): PlanIR {
  return {
    schema_version: "1.0.0",
    meta: {
      name: "Test Hut",
      plot_width_mm: 5000,
      plot_depth_mm: 6000,
      facing: "N",
      city: "Chennai",
      region_pricing_key: "south_metro_tier1",
    },
    floors: [
      {
        level: 0,
        name: "Ground",
        height_mm: 3000,
        walls: [
          { id: "w_top",    start: { x: 0,    y: 0    }, end: { x: 3000, y: 0    }, type: "exterior_brick_230", height_mm: 3000 },
          { id: "w_right",  start: { x: 3000, y: 0    }, end: { x: 3000, y: 4000 }, type: "exterior_brick_230", height_mm: 3000 },
          { id: "w_bottom", start: { x: 3000, y: 4000 }, end: { x: 0,    y: 4000 }, type: "exterior_brick_230", height_mm: 3000 },
          { id: "w_left",   start: { x: 0,    y: 4000 }, end: { x: 0,    y: 0    }, type: "exterior_brick_230", height_mm: 3000 },
        ],
        openings: [
          {
            id: "o_door",
            wall_id: "w_bottom",
            position_along_wall: 0.5,
            width_mm: 900,
            height_mm: 2100,
            sill_mm: 0,
            type: "door_single",
          },
          {
            id: "o_win",
            wall_id: "w_top",
            position_along_wall: 0.5,
            width_mm: 1200,
            height_mm: 1200,
            sill_mm: 900,
            type: "window_casement",
          },
        ],
        rooms: [
          {
            id: "r_living",
            name: "Living",
            type: "living",
            polygon: [
              { x: 0,    y: 0    },
              { x: 3000, y: 0    },
              { x: 3000, y: 4000 },
              { x: 0,    y: 4000 },
            ],
            finishes: {
              floor: "vitrified_tile_600x600_sqm",
              wall_finish: "putty_emulsion_sqm",
              ceiling: "pop_false_ceiling_sqm",
            },
            fixtures: [
              { type: "wc",            position: { x:  500, y: 3500 }, rotation_deg: 0 },
              { type: "washbasin",     position: { x: 1500, y: 3500 }, rotation_deg: 0 },
              { type: "kitchen_sink",  position: { x: 2500, y: 3500 }, rotation_deg: 0 },
              { type: "sofa_3",        position: { x: 1500, y: 1500 }, rotation_deg: 0 },
            ],
          },
        ],
      },
    ],
  };
}
