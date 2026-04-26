import { describe, expect, it } from "vitest";
import { migrate } from "@/lib/schema/migrate";
import { makeHut } from "../_fixtures/hut";

describe("migrate", () => {
  it("passes through plans that are already at the current version", () => {
    const p = migrate(makeHut());
    expect(p.schema_version).toBe("1.0.0");
  });

  it("rejects an older version with no registered migrator", () => {
    expect(() =>
      migrate({ ...makeHut(), schema_version: "0.0.1" }),
    ).toThrow(/no migration registered/);
  });

  it("rejects non-object input", () => {
    expect(() => migrate(null)).toThrow(/not an object/);
    expect(() => migrate("hello")).toThrow(/not an object/);
  });
});
