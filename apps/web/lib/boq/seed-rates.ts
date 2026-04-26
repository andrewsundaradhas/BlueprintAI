/**
 * Seed BOQ rates for Indian residential construction. INR per unit.
 *
 * RATES ARE ILLUSTRATIVE STARTING POINTS — verify against current market
 * quotations for your region before relying on them in production.
 */

export type RateUnit =
  | "bag"
  | "kg"
  | "ton"
  | "no"
  | "cum"
  | "sqm"
  | "rmt"
  | "litre"
  | "manday";

export type RateCategory =
  | "civil"
  | "steel"
  | "masonry"
  | "doors_windows"
  | "finishes"
  | "electrical"
  | "plumbing"
  | "labor";

export type RateItem = {
  unit: RateUnit;
  rate: number;
  display: string;
  category: RateCategory;
};

export type RegionRates = Record<string, RateItem>;

export const SEED_RATES: Record<string, RegionRates> = {
  south_metro_tier1: {
    // Civil & masonry
    cement_opc53_bag:           { unit: "bag",    rate: 420,   display: "OPC 53 Cement (50kg)",     category: "civil" },
    river_sand_cum:             { unit: "cum",    rate: 4500,  display: "River Sand",                category: "civil" },
    msand_cum:                  { unit: "cum",    rate: 1800,  display: "M-Sand",                    category: "civil" },
    aggregate_20mm_cum:         { unit: "cum",    rate: 1600,  display: "20mm Aggregate",            category: "civil" },
    brick_red_no:               { unit: "no",     rate: 9,     display: "Red Clay Brick",            category: "masonry" },
    aac_block_200_no:           { unit: "no",     rate: 75,    display: "AAC Block 200mm",           category: "masonry" },

    // Steel
    steel_tmt_fe550_kg:         { unit: "kg",     rate: 72,    display: "TMT Fe550",                 category: "steel" },
    binding_wire_kg:            { unit: "kg",     rate: 95,    display: "Binding Wire",              category: "steel" },

    // Concrete (in-situ — by m³ for ready-mix)
    rmc_m25_cum:                { unit: "cum",    rate: 6800,  display: "RMC M25",                   category: "civil" },
    rmc_m30_cum:                { unit: "cum",    rate: 7200,  display: "RMC M30",                   category: "civil" },

    // Doors & windows
    door_single_teak:           { unit: "no",     rate: 22000, display: "Single teak door",          category: "doors_windows" },
    door_single_flush:          { unit: "no",     rate: 8500,  display: "Flush door (commercial)",   category: "doors_windows" },
    door_double_teak:           { unit: "no",     rate: 38000, display: "Double teak door",          category: "doors_windows" },
    door_sliding_alu:           { unit: "no",     rate: 28000, display: "Aluminum sliding door",     category: "doors_windows" },
    window_upvc_sqm:            { unit: "sqm",    rate: 4800,  display: "UPVC Window",               category: "doors_windows" },
    window_alu_sqm:             { unit: "sqm",    rate: 3800,  display: "Aluminum Window",           category: "doors_windows" },
    ventilator_no:              { unit: "no",     rate: 3500,  display: "Ventilator",                category: "doors_windows" },

    // Finishes
    vitrified_tile_600x600_sqm: { unit: "sqm",    rate: 850,   display: "Vitrified Tile 600x600",    category: "finishes" },
    granite_floor_sqm:          { unit: "sqm",    rate: 1400,  display: "Granite flooring",          category: "finishes" },
    marble_floor_sqm:           { unit: "sqm",    rate: 1800,  display: "Marble flooring",           category: "finishes" },
    ceramic_tile_300x600_sqm:   { unit: "sqm",    rate: 550,   display: "Ceramic Wall Tile",         category: "finishes" },
    putty_emulsion_sqm:         { unit: "sqm",    rate: 65,    display: "Putty + Emulsion",          category: "finishes" },
    pop_false_ceiling_sqm:      { unit: "sqm",    rate: 95,    display: "POP False Ceiling",         category: "finishes" },
    gypsum_false_ceiling_sqm:   { unit: "sqm",    rate: 120,   display: "Gypsum False Ceiling",      category: "finishes" },

    // Electrical
    elec_point_no:              { unit: "no",     rate: 950,   display: "Electrical Point (PVC conduit)", category: "electrical" },
    elec_db_no:                 { unit: "no",     rate: 4500,  display: "Distribution Board",        category: "electrical" },
    wiring_per_sqft:            { unit: "sqm",    rate: 180,   display: "Concealed Wiring",          category: "electrical" },

    // Plumbing
    plumb_wc_no:                { unit: "no",     rate: 6500,  display: "WC + flush tank",           category: "plumbing" },
    plumb_washbasin_no:         { unit: "no",     rate: 4500,  display: "Wash Basin",                category: "plumbing" },
    plumb_shower_no:            { unit: "no",     rate: 5500,  display: "Shower set",                category: "plumbing" },
    plumb_kitchen_sink_no:      { unit: "no",     rate: 6500,  display: "Kitchen sink + faucet",     category: "plumbing" },

    // Labor
    labor_mason_md:             { unit: "manday", rate: 850,   display: "Mason",                     category: "labor" },
    labor_helper_md:            { unit: "manday", rate: 600,   display: "Helper",                    category: "labor" },
    labor_carpenter_md:         { unit: "manday", rate: 950,   display: "Carpenter",                 category: "labor" },
    labor_electrician_md:       { unit: "manday", rate: 900,   display: "Electrician",               category: "labor" },
    labor_plumber_md:           { unit: "manday", rate: 900,   display: "Plumber",                   category: "labor" },
    labor_painter_md:           { unit: "manday", rate: 750,   display: "Painter",                   category: "labor" },
  },
};
