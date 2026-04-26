import { type PlanSpec, SEED_SPEC, type Zone } from "@/lib/solver/solver";

/**
 * Heuristic prompt parser — used when no LLM API key is configured.
 *
 * Parses the user's prompt for:
 *   • BHK count or "studio"
 *   • Plot dimensions ("8x11m", "30x40 ft", "1200 sqft")
 *   • Facing direction ("north-facing", "east entry")
 *   • Budget ("₹24L", "35 lakh", "Rs 50L")
 *   • Special rooms (puja, study, store, balcony, utility, servant, garage)
 *   • Size qualifier (compact / spacious / luxury)
 *
 * Produces a PlanSpec the solver can pack. Quality is below an LLM but
 * good enough that the editor + BOQ work end-to-end without API keys.
 */
export function buildDemoSpec(args: { prompt: string }): PlanSpec {
  const p = args.prompt;
  const bhk = parseBhk(p);
  const plot = parsePlot(p, bhk);
  const facing = parseFacing(p);
  const budget = parseBudget(p);
  const qualifier = parseQualifier(p); // 0.85 / 1 / 1.2
  const extras = parseSpecialRooms(p);

  const rooms = composeRooms(bhk, qualifier, extras);

  void facing; // PlanSpec doesn't carry facing; the editor's project meta handles it

  return {
    prompt: p,
    plot,
    rooms,
    budget,
  };
}

/** Back-compat shim: older code path imports `buildDemoPlan` and expects a full PlanIR. */
export { buildDemoSpec as buildDemoPlan };

// ────────── Parsing helpers ──────────

type BhkKind = "studio" | "1bhk" | "2bhk" | "3bhk" | "4bhk" | "5bhk";

function parseBhk(p: string): BhkKind {
  const s = p.toLowerCase();
  if (/\bstudio\b/.test(s)) return "studio";
  const m = s.match(/(\d+)\s*[- ]?\s*bhk/);
  if (m) {
    const n = parseInt(m[1]!, 10);
    if (n <= 1) return "1bhk";
    if (n === 2) return "2bhk";
    if (n === 3) return "3bhk";
    if (n === 4) return "4bhk";
    if (n >= 5) return "5bhk";
  }
  if (/\bone\s*bedroom\b|\b1\s*bedroom\b/.test(s)) return "1bhk";
  if (/\btwo\s*bedroom\b|\b2\s*bedroom\b/.test(s)) return "2bhk";
  if (/\bthree\s*bedroom\b|\b3\s*bedroom\b/.test(s)) return "3bhk";
  if (/\bfour\s*bedroom\b|\b4\s*bedroom\b/.test(s)) return "4bhk";
  if (/\bvilla\b|\bbungalow\b/.test(s)) return "4bhk";
  return "2bhk";
}

function parsePlot(p: string, bhk: BhkKind): { w: number; h: number } {
  const s = p.toLowerCase().replace(/\s+/g, " ");

  // "8x11m", "8 x 11m", "8 × 11 m", "8 by 11 meters"
  const mxm = s.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(m|meter|metre|meters|metres)\b/);
  if (mxm) {
    const w = Math.round(parseFloat(mxm[1]!) * 1000);
    const h = Math.round(parseFloat(mxm[2]!) * 1000);
    return clampPlot(w, h);
  }

  // "30x40 ft", "30 x 40 feet", "30 × 40'"
  const mxf = s.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot|')\b/);
  if (mxf) {
    const w = Math.round(parseFloat(mxf[1]!) * 304.8);
    const h = Math.round(parseFloat(mxf[2]!) * 304.8);
    return clampPlot(w, h);
  }

  // "8x11" (no unit) — assume meters when both numbers ≤ 30, else feet
  const mxn = s.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)/);
  if (mxn) {
    const a = parseFloat(mxn[1]!);
    const b = parseFloat(mxn[2]!);
    if (a <= 30 && b <= 30) {
      return clampPlot(Math.round(a * 1000), Math.round(b * 1000));
    }
    return clampPlot(Math.round(a * 304.8), Math.round(b * 304.8));
  }

  // "1200 sqft", "1500 sft", "1200 square feet"
  const sqft = s.match(/(\d{3,5})\s*(?:sqft|sft|sq\.?\s*ft|square\s*feet|s\.f\.)/);
  if (sqft) {
    const totalSqm = parseFloat(sqft[1]!) * 0.0929;
    return plotFromArea(totalSqm);
  }

  // "120 sqm", "150 m²"
  const sqm = s.match(/(\d{2,4})\s*(?:sqm|sq\.?\s*m|m²|square\s*me?tre?s)/);
  if (sqm) return plotFromArea(parseFloat(sqm[1]!));

  // Fallback by BHK
  const defaults: Record<BhkKind, [number, number]> = {
    studio: [6000, 8000],
    "1bhk": [7500, 9000],
    "2bhk": [8460, 11460],
    "3bhk": [10000, 12000],
    "4bhk": [12000, 14000],
    "5bhk": [14000, 16000],
  };
  const [w, h] = defaults[bhk];
  return { w, h };
}

function plotFromArea(sqm: number): { w: number; h: number } {
  // Assume 2:3 aspect (typical Indian residential plot)
  const longSide = Math.sqrt((sqm * 1.5) / 1) * 1000;
  const shortSide = (sqm * 1e6) / longSide;
  return clampPlot(Math.round(shortSide), Math.round(longSide));
}

function clampPlot(w: number, h: number): { w: number; h: number } {
  return {
    w: Math.max(4000, Math.min(60000, w)),
    h: Math.max(4000, Math.min(60000, h)),
  };
}

function parseFacing(p: string): "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW" {
  const s = p.toLowerCase();
  if (/\bnorth.?east\b|\bne(\s|-)?facing\b/.test(s)) return "NE";
  if (/\bnorth.?west\b|\bnw(\s|-)?facing\b/.test(s)) return "NW";
  if (/\bsouth.?east\b|\bse(\s|-)?facing\b/.test(s)) return "SE";
  if (/\bsouth.?west\b|\bsw(\s|-)?facing\b/.test(s)) return "SW";
  if (/\bnorth\b/.test(s)) return "N";
  if (/\bsouth\b/.test(s)) return "S";
  if (/\beast\b/.test(s)) return "E";
  if (/\bwest\b/.test(s)) return "W";
  return "N";
}

function parseBudget(p: string): number | undefined {
  const s = p.toLowerCase();

  // "₹24L", "rs 24L", "24l budget", "24 lakh", "24 lakhs"
  const lakh = s.match(/(?:₹|rs\.?\s*|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(?:l\b|lakh|lakhs|lac|lacs)/);
  if (lakh) return Math.round(parseFloat(lakh[1]!) * 100000);

  // "₹2.5cr", "2.5 crore"
  const cr = s.match(/(?:₹|rs\.?\s*|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/);
  if (cr) return Math.round(parseFloat(cr[1]!) * 1e7);

  // "₹2,40,000"
  const inr = s.match(/(?:₹|rs\.?\s*|inr\s*)([\d,]+)/);
  if (inr) {
    const v = parseInt(inr[1]!.replace(/,/g, ""), 10);
    if (v >= 100000) return v;
  }
  return undefined;
}

function parseQualifier(p: string): number {
  const s = p.toLowerCase();
  if (/\b(luxury|spacious|premium|large)\b/.test(s)) return 1.2;
  if (/\b(compact|small|tight|economy|economical)\b/.test(s)) return 0.85;
  return 1;
}

type ExtraRoom = { name: string; area: number; zone: Zone };
function parseSpecialRooms(p: string): ExtraRoom[] {
  const s = p.toLowerCase();
  const out: ExtraRoom[] = [];
  if (/\b(puja|pooja|prayer|mandir)\b/.test(s)) out.push({ name: "Puja Room", area: 4, zone: "private" });
  if (/\bstudy\b/.test(s)) out.push({ name: "Study", area: 8, zone: "private" });
  if (/\bstore\b/.test(s)) out.push({ name: "Store", area: 5, zone: "service" });
  if (/\bservant\s*room\b|\bservant\s*qtrs?\b/.test(s)) out.push({ name: "Servant Quarters", area: 9, zone: "service" });
  if (/\bgarage\b|\bcar\s*park\b/.test(s)) out.push({ name: "Garage", area: 16, zone: "service" });
  if (/\bhome\s*office\b|\bworkspace\b/.test(s)) out.push({ name: "Home Office", area: 9, zone: "private" });
  if (/\bguest\s*room\b/.test(s)) out.push({ name: "Guest Bedroom", area: 11, zone: "private" });
  // Don't add balcony from generic mention (most of our presets already include one)
  return out;
}

// ────────── Composition ──────────

function composeRooms(bhk: BhkKind, q: number, extras: ExtraRoom[]): PlanSpec["rooms"] {
  const scale = (n: number) => Math.round(n * q * 10) / 10;
  const rooms: PlanSpec["rooms"] = [];

  const livingArea = bhk === "studio" ? 18 : bhk === "1bhk" ? 18 : bhk === "2bhk" ? 22 : bhk === "3bhk" ? 26 : bhk === "4bhk" ? 30 : 34;
  const kitchenArea = bhk === "studio" ? 6 : bhk === "1bhk" ? 8 : bhk === "2bhk" ? 9 : bhk === "3bhk" ? 10 : 11;
  const utilityArea = bhk === "studio" || bhk === "1bhk" ? 0 : bhk === "2bhk" ? 5 : 6.5;
  const bathBig = 4.5;
  const bathSmall = 3.5;

  rooms.push({ id: "living", name: bhk === "studio" ? "Studio" : "Living / Dining", area: scale(livingArea), zone: "public", entry: true });
  if (bhk !== "studio") {
    rooms.push({ id: "kitchen", name: "Kitchen", area: scale(kitchenArea), zone: "public" });
  } else {
    // Studio: tiny kitchenette merged into the studio area
    rooms.push({ id: "kitchenette", name: "Kitchenette", area: scale(5), zone: "service" });
  }
  if (utilityArea > 0) rooms.push({ id: "utility", name: "Utility", area: scale(utilityArea), zone: "service" });

  // Bedrooms
  const beds: { count: number; bath: number } = {
    studio: { count: 0, bath: 1 },
    "1bhk": { count: 1, bath: 1 },
    "2bhk": { count: 2, bath: 2 },
    "3bhk": { count: 3, bath: 2 },
    "4bhk": { count: 4, bath: 3 },
    "5bhk": { count: 5, bath: 3 },
  }[bhk];

  if (beds.count >= 1) {
    rooms.push({ id: "mbr", name: "Master Bedroom", area: scale(14), zone: "private" });
    rooms.push({ id: "mbath", name: "Master Bath", area: scale(bathBig), zone: "private" });
  }
  for (let i = 2; i <= beds.count; i++) {
    rooms.push({ id: `br${i}`, name: `Bedroom ${i}`, area: scale(11 - (i - 2)), zone: "private" });
  }
  // Common bath
  if (beds.bath >= 2) {
    rooms.push({ id: "bath", name: "Common Bath", area: scale(bathSmall), zone: "private" });
  } else if (beds.count === 1) {
    // 1BHK already has master bath; nothing else
  } else if (beds.count === 0) {
    rooms.push({ id: "bath", name: "Bath", area: scale(bathSmall), zone: "private" });
  }
  if (beds.bath >= 3) {
    rooms.push({ id: "bath3", name: "Powder Room", area: scale(2.5), zone: "private" });
  }

  // Balcony for everything but studio
  if (bhk !== "studio") {
    rooms.push({ id: "balcony", name: "Balcony", area: scale(5), zone: "private" });
  }

  // Apply extras (deduplicate by id-friendly version of name)
  for (const e of extras) {
    const id = `x_${e.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    if (!rooms.find((r) => r.id === id || r.name.toLowerCase() === e.name.toLowerCase())) {
      rooms.push({ id, name: e.name, area: scale(e.area), zone: e.zone });
    }
  }

  return rooms;
}

// Re-export the seed for any place that needs a deterministic baseline.
export { SEED_SPEC };
