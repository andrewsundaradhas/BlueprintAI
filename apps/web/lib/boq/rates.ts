import { type RateItem, type RegionRates, SEED_RATES } from "./seed-rates";

/**
 * Rate provider abstraction. The default implementation reads from
 * SEED_RATES so unit tests run without Firebase. In production this
 * is replaced with a Firestore-backed implementation that fetches
 * `pricing/{regionKey}/items/{itemKey}` documents.
 */
export interface RateProvider {
  getRegion(regionKey: string): Promise<RegionRates>;
}

export class SeedRateProvider implements RateProvider {
  async getRegion(regionKey: string): Promise<RegionRates> {
    const region = SEED_RATES[regionKey];
    if (!region) {
      throw new Error(`Unknown region pricing key: '${regionKey}'`);
    }
    return region;
  }
}

export function lookupRate(
  rates: RegionRates,
  itemKey: string,
): RateItem | undefined {
  return rates[itemKey];
}
