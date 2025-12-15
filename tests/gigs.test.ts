import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GIG_CATEGORIES } from "../.vitepress/types";
import { GigSchema, GigsArraySchema } from "../data/gigs-schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gigsJsonPath = resolve(__dirname, "../data/gigs.json");

describe("gigs.json schema validation", () => {
  it("parses gigs.json successfully", () => {
    const content = readFileSync(gigsJsonPath, "utf-8");
    const data = JSON.parse(content);
    const result = GigsArraySchema.safeParse(data);

    if (!result.success) {
      console.error("Validation errors:", result.error.format());
    }

    expect(result.success).toBe(true);
  });

  it("contains at least one gig", () => {
    const content = readFileSync(gigsJsonPath, "utf-8");
    const data = JSON.parse(content);
    expect(data.length).toBeGreaterThan(0);
  });

  it("has valid source URLs", () => {
    const content = readFileSync(gigsJsonPath, "utf-8");
    const data = JSON.parse(content);
    const result = GigsArraySchema.parse(data);

    for (const gig of result) {
      for (const source of gig.sources) {
        expect(() => new URL(source)).not.toThrow();
      }
    }
  });

  it("has valid category values", () => {
    const content = readFileSync(gigsJsonPath, "utf-8");
    const data = JSON.parse(content);
    const result = GigsArraySchema.parse(data);

    for (const gig of result) {
      expect(GIG_CATEGORIES).toContain(gig.category);
    }
  });
});

describe("GigSchema validation", () => {
  it("accepts valid gig data", () => {
    const validGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/source"],
      pollie_slug: "test-pollie",
      start_date: "2024-01-01",
    };

    const result = GigSchema.safeParse(validGig);
    expect(result.success).toBe(true);
  });

  it("rejects gig with invalid category", () => {
    const invalidGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Invalid Category",
      sources: ["https://example.com/source"],
      pollie_slug: "test-pollie",
    };

    const result = GigSchema.safeParse(invalidGig);
    expect(result.success).toBe(false);
  });

  it("rejects gig with empty sources array", () => {
    const invalidGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: [],
      pollie_slug: "test-pollie",
    };

    const result = GigSchema.safeParse(invalidGig);
    expect(result.success).toBe(false);
  });

  it("rejects gig with invalid source URL", () => {
    const invalidGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["not-a-valid-url"],
      pollie_slug: "test-pollie",
    };

    const result = GigSchema.safeParse(invalidGig);
    expect(result.success).toBe(false);
  });

  it("rejects gig with missing required fields", () => {
    const invalidGig = {
      role: "Board Member",
      organisation: "Test Corp",
    };

    const result = GigSchema.safeParse(invalidGig);
    expect(result.success).toBe(false);
  });

  it("accepts gig with optional verified_by field", () => {
    const gigWithVerifier = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/source"],
      pollie_slug: "test-pollie",
      verified_by: "ben",
    };

    const result = GigSchema.safeParse(gigWithVerifier);
    expect(result.success).toBe(true);
  });

  it("accepts gig with end_date", () => {
    const gigWithEndDate = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/source"],
      pollie_slug: "test-pollie",
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    };

    const result = GigSchema.safeParse(gigWithEndDate);
    expect(result.success).toBe(true);
  });
});
