import { PlanIR, SCHEMA_VERSION } from "./plan";

/**
 * Migrate a raw PlanIR-shaped object up to the current schema version.
 * Returns a parsed PlanIR or throws if the input is unmigratable.
 *
 * Migration registry: add a new entry whenever SCHEMA_VERSION bumps.
 * Each migrator takes the previous-version object and returns the next.
 */
type RawPlan = { schema_version?: string } & Record<string, unknown>;
type Migrator = (input: RawPlan) => RawPlan;

const MIGRATIONS: Record<string, { to: string; up: Migrator }> = {
  // Example placeholder. Real migrations land here as the schema evolves.
  // "0.9.0": { to: "1.0.0", up: (p) => ({ ...p, schema_version: "1.0.0" }) },
};

export function migrate(raw: unknown): PlanIR {
  if (!raw || typeof raw !== "object") {
    throw new Error("migrate: input is not an object");
  }
  let cur = raw as RawPlan;
  let version = cur.schema_version ?? "unknown";

  let safety = 16;
  while (version !== SCHEMA_VERSION) {
    if (safety-- <= 0) {
      throw new Error(`migrate: too many migration steps from ${version}`);
    }
    const step = MIGRATIONS[version];
    if (!step) {
      throw new Error(
        `migrate: no migration registered from schema_version '${version}' to '${SCHEMA_VERSION}'`,
      );
    }
    cur = step.up(cur);
    version = step.to;
  }
  return PlanIR.parse(cur);
}
