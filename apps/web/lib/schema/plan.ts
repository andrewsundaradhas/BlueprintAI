import { z } from "zod";

export const Point = z.object({
  x: z.number(),
  y: z.number(),
});
export type Point = z.infer<typeof Point>;

export const WallType = z.enum([
  "exterior_brick_230",
  "interior_brick_115",
  "rcc_150",
  "drywall_100",
]);
export type WallType = z.infer<typeof WallType>;

export const WALL_THICKNESS_MM: Record<WallType, number> = {
  exterior_brick_230: 230,
  interior_brick_115: 115,
  rcc_150: 150,
  drywall_100: 100,
};

export const Wall = z.object({
  id: z.string().min(1),
  start: Point,
  end: Point,
  type: WallType,
  height_mm: z.number().min(2100).max(6000).default(3000),
});
export type Wall = z.infer<typeof Wall>;

export const OpeningType = z.enum([
  "door_single",
  "door_double",
  "door_sliding",
  "window_casement",
  "window_sliding",
  "window_fixed",
  "ventilator",
]);
export type OpeningType = z.infer<typeof OpeningType>;

export const Opening = z.object({
  id: z.string().min(1),
  wall_id: z.string().min(1),
  position_along_wall: z.number().min(0).max(1),
  width_mm: z.number().min(300).max(4000),
  height_mm: z.number().min(300).max(3000),
  sill_mm: z.number().min(0).default(0),
  type: OpeningType,
  material: z.string().optional(),
});
export type Opening = z.infer<typeof Opening>;

export const RoomType = z.enum([
  "bedroom",
  "master_bedroom",
  "kids_bedroom",
  "guest_bedroom",
  "living",
  "dining",
  "kitchen",
  "bathroom",
  "toilet",
  "balcony",
  "utility",
  "store",
  "puja",
  "study",
  "corridor",
  "staircase",
  "lobby",
  "garage",
  "open_terrace",
]);
export type RoomType = z.infer<typeof RoomType>;

export const FinishSpec = z.object({
  floor: z.string().default("vitrified_tile_600x600"),
  wall_finish: z.string().default("putty_emulsion"),
  ceiling: z.string().default("pop_false_ceiling"),
});
export type FinishSpec = z.infer<typeof FinishSpec>;

export const FixtureType = z.enum([
  "wc",
  "washbasin",
  "shower",
  "bathtub",
  "kitchen_sink",
  "stove_platform",
  "wardrobe",
  "bed_single",
  "bed_double",
  "bed_king",
  "sofa_2",
  "sofa_3",
  "dining_table_4",
  "dining_table_6",
  "study_table",
  "tv_unit",
  "fridge",
  "washing_machine",
]);
export type FixtureType = z.infer<typeof FixtureType>;

export const Fixture = z.object({
  type: FixtureType,
  position: Point,
  rotation_deg: z.number().default(0),
});
export type Fixture = z.infer<typeof Fixture>;

export const Room = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: RoomType,
  polygon: z.array(Point).min(3),
  finishes: FinishSpec,
  fixtures: z.array(Fixture).default([]),
});
export type Room = z.infer<typeof Room>;

export const Floor = z.object({
  level: z.number().int(),
  name: z.string(),
  height_mm: z.number().default(3000),
  walls: z.array(Wall),
  openings: z.array(Opening),
  rooms: z.array(Room),
});
export type Floor = z.infer<typeof Floor>;

export const ProjectMeta = z.object({
  name: z.string(),
  plot_width_mm: z.number().min(2000),
  plot_depth_mm: z.number().min(2000),
  facing: z.enum(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]),
  city: z.string(),
  region_pricing_key: z.string(),
});
export type ProjectMeta = z.infer<typeof ProjectMeta>;

export const PlanIR = z.object({
  schema_version: z.literal("1.0.0"),
  meta: ProjectMeta,
  floors: z.array(Floor).min(1),
  notes: z.string().optional(),
});
export type PlanIR = z.infer<typeof PlanIR>;

export const SCHEMA_VERSION = "1.0.0" as const;
