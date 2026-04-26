import { type PlanIR } from "@/lib/schema/plan";
import { type RegionRates } from "./seed-rates";
import { type RateProvider, SeedRateProvider } from "./rates";
import { LABOR_UPLIFT, takeoffsForPlan, type TakeoffSource } from "./takeoff";

export type BoqLine = {
  itemKey: string;
  display_name: string;
  unit: string;
  quantity: number;
  rate_inr: number;
  amount_inr: number;
  category: string;
  source: TakeoffSource;
};

export type BoqResult = {
  lines: BoqLine[];
  byCategory: Record<string, number>;
  byRoom: Record<string, number>;
  subtotal_inr: number;
  labor_inr: number;
  contingency_pct: number;
  contingency_inr: number;
  gst_pct: number;
  gst_inr: number;
  grand_total_inr: number;
  rates_used: RegionRates;
  generated_at: string;
};

export type BoqOptions = {
  contingency_pct?: number; // default 5
  gst_pct?: number;         // default 18
  rateProvider?: RateProvider;
  /** If false, omit the labor uplift line. Default true. */
  applyLaborUplift?: boolean;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
};

/**
 * Compute the BOQ for a plan. Pure function given a fixed rate snapshot:
 * the rates are fetched once at the top and recorded onto the result so
 * historical estimates remain reproducible.
 */
export async function computeBoq(
  plan: PlanIR,
  opts: BoqOptions = {},
): Promise<BoqResult> {
  const provider = opts.rateProvider ?? new SeedRateProvider();
  const contingency_pct = opts.contingency_pct ?? 5;
  const gst_pct = opts.gst_pct ?? 18;
  const applyLaborUplift = opts.applyLaborUplift ?? true;

  const rates = await provider.getRegion(plan.meta.region_pricing_key);

  const takeoffs = takeoffsForPlan(plan);

  // Aggregate quantities per (itemKey, source-fingerprint).
  // We aggregate same itemKey+source so multiple wall takeoffs collapse
  // into a single line per source — keeps "click line → highlight source"
  // working without losing precision.
  type Key = string;
  const aggregated = new Map<Key, BoqLine>();

  for (const t of takeoffs) {
    const item = rates[t.itemKey];
    if (!item) {
      // Skip silently — unknown item keys mean the plan references
      // a finish/material that's not priced in this region. Logged
      // upstream; here we just don't add a line.
      continue;
    }
    const sourceKey = sourceFingerprint(t.source);
    const key = `${t.itemKey}::${sourceKey}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += t.quantity;
      existing.amount_inr = round2(existing.quantity * existing.rate_inr);
    } else {
      aggregated.set(key, {
        itemKey: t.itemKey,
        display_name: item.display,
        unit: item.unit,
        quantity: t.quantity,
        rate_inr: item.rate,
        amount_inr: round2(t.quantity * item.rate),
        category: item.category,
        source: t.source,
      });
    }
  }

  // Round quantities for display sanity (but compute amount from raw qty).
  for (const line of aggregated.values()) {
    line.quantity = round3(line.quantity);
    line.amount_inr = round2(line.quantity * line.rate_inr);
  }

  // Sort lines by category, then itemKey, then source fingerprint for
  // deterministic output.
  const lines = [...aggregated.values()].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.itemKey !== b.itemKey) return a.itemKey.localeCompare(b.itemKey);
    return sourceFingerprint(a.source).localeCompare(sourceFingerprint(b.source));
  });

  const byCategory: Record<string, number> = {};
  const byRoom: Record<string, number> = {};
  let materialSubtotal = 0;
  let laborSubtotal = 0;

  for (const line of lines) {
    materialSubtotal += line.amount_inr;
    byCategory[line.category] = (byCategory[line.category] ?? 0) + line.amount_inr;
    const roomId = roomIdFromSource(line.source);
    if (roomId) {
      byRoom[roomId] = (byRoom[roomId] ?? 0) + line.amount_inr;
    }
  }

  if (applyLaborUplift) {
    for (const [category, amt] of Object.entries(byCategory)) {
      const uplift = LABOR_UPLIFT[category];
      if (uplift && category !== "labor") {
        const laborAmt = round2(amt * uplift);
        laborSubtotal += laborAmt;
        lines.push({
          itemKey: `labor_uplift_${category}`,
          display_name: `Labor uplift (${category})`,
          unit: "lump",
          quantity: 1,
          rate_inr: laborAmt,
          amount_inr: laborAmt,
          category: "labor",
          source: { kind: "rule", rule: `labor_uplift_${category}` },
        });
      }
    }
    if (laborSubtotal > 0) {
      byCategory["labor"] = (byCategory["labor"] ?? 0) + laborSubtotal;
    }
  }

  const subtotal_inr = round2(materialSubtotal + laborSubtotal);
  const contingency_inr = round2((subtotal_inr * contingency_pct) / 100);
  const taxable = subtotal_inr + contingency_inr;
  const gst_inr = round2((taxable * gst_pct) / 100);
  const grand_total_inr = round2(taxable + gst_inr);

  return {
    lines,
    byCategory: roundMap(byCategory),
    byRoom: roundMap(byRoom),
    subtotal_inr,
    labor_inr: round2(laborSubtotal),
    contingency_pct,
    contingency_inr,
    gst_pct,
    gst_inr,
    grand_total_inr,
    rates_used: rates,
    generated_at: (opts.now?.() ?? new Date()).toISOString(),
  };
}

// ---------- helpers ----------

function sourceFingerprint(s: TakeoffSource): string {
  switch (s.kind) {
    case "wall": return `wall:${s.id}`;
    case "opening": return `opening:${s.id}`;
    case "room": return `room:${s.roomId}`;
    case "fixture": return `fixture:${s.roomId}`;
    case "rule": return `rule:${s.rule}`;
  }
}

function roomIdFromSource(s: TakeoffSource): string | undefined {
  if (s.kind === "room" || s.kind === "fixture") return s.roomId;
  return undefined;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function roundMap(m: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) out[k] = round2(v);
  return out;
}
