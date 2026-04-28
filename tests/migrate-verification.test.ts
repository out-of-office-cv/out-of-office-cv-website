import { describe, it, expect } from "vitest";
import { migrateGig } from "../scripts/migrate-verification";

const baseGig = {
  role: "Director",
  organisation: "Acme",
  category: "Professional Services & Management Consulting",
  sources: ["https://example.com"],
  pollie_slug: "x",
};

describe("migrateGig", () => {
  it("converts verified_by: ben to verification.decision verified, by ben", () => {
    const input = { ...baseGig, verified_by: "ben" };
    expect(migrateGig(input)).toEqual({
      ...baseGig,
      verification: { decision: "verified", by: "ben" },
    });
  });

  it("converts verified_by: khoi to verification.decision verified, by khoi", () => {
    const input = { ...baseGig, verified_by: "khoi" };
    expect(migrateGig(input)).toEqual({
      ...baseGig,
      verification: { decision: "verified", by: "khoi" },
    });
  });

  it("leaves a gig with no verified_by untouched", () => {
    expect(migrateGig({ ...baseGig })).toEqual({ ...baseGig });
  });

  it("is idempotent on already-migrated gigs", () => {
    const migrated = {
      ...baseGig,
      verification: { decision: "verified" as const, by: "ben" },
    };
    expect(migrateGig(migrated)).toEqual(migrated);
  });

  it("preserves other fields (start_date, end_date)", () => {
    const input = {
      ...baseGig,
      verified_by: "ben",
      start_date: "2020-01-01",
      end_date: "2024-12-31",
    };
    const result = migrateGig(input);
    expect(result.start_date).toBe("2020-01-01");
    expect(result.end_date).toBe("2024-12-31");
  });
});
