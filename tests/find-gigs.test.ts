import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import type { Pollie, Gig } from "../.vitepress/types";
import { GIG_CATEGORIES } from "../.vitepress/types";
import { loadPollies } from "../.vitepress/loaders";
import {
  selectPollie,
  listCandidates,
  buildPrompt,
  readGigsJson,
  writeGigsJson,
  appendGigsToJson,
} from "../scripts/find-gigs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const mockPollies: Pollie[] = [
  {
    slug: "recent-no-gigs",
    phid: "TEST1",
    name: "Recent No Gigs",
    division: "Test",
    state: "NSW",
    party: "ALP",
    ceasedDate: "2024-06-01",
    house: "reps",
    photoUrl: "https://www.aph.gov.au/api/parliamentarian/TEST1/image",
  },
  {
    slug: "older-no-gigs",
    phid: "TEST2",
    name: "Older No Gigs",
    division: "Test",
    state: "VIC",
    party: "LIB",
    ceasedDate: "2020-01-01",
    house: "reps",
    photoUrl: "https://www.aph.gov.au/api/parliamentarian/TEST2/image",
  },
  {
    slug: "has-gigs",
    phid: "TEST3",
    name: "Has Gigs",
    division: "Test",
    state: "QLD",
    party: "GRN",
    ceasedDate: "2023-03-15",
    house: "senate",
    photoUrl: "https://www.aph.gov.au/api/parliamentarian/TEST3/image",
  },
];

const mockGigs: Gig[] = [
  {
    role: "Board Member",
    organisation: "Test Corp",
    category: "Professional Services & Management Consulting",
    sources: ["https://example.com"],
    pollie_slug: "has-gigs",
    start_date: "2023-06-01",
  },
];

describe("selectPollie", () => {
  it("selects explicit pollie by slug", () => {
    const result = selectPollie(
      mockPollies,
      mockGigs,
      "recent-no-gigs",
      "older-no-gigs",
    );
    expect(result?.slug).toBe("older-no-gigs");
  });

  it("returns null for non-existent explicit slug", () => {
    const result = selectPollie(
      mockPollies,
      mockGigs,
      "recent-no-gigs",
      "not-found",
    );
    expect(result).toBeNull();
  });

  it("selects most recent pollie without gigs for recent-no-gigs strategy", () => {
    const result = selectPollie(mockPollies, mockGigs, "recent-no-gigs");
    expect(result?.slug).toBe("recent-no-gigs");
  });

  it("excludes pollies with gigs for recent-no-gigs strategy", () => {
    const result = selectPollie(mockPollies, mockGigs, "recent-no-gigs");
    expect(result?.slug).not.toBe("has-gigs");
  });

  it("selects pollie with few gigs for recent-few-gigs strategy", () => {
    const result = selectPollie(mockPollies, mockGigs, "recent-few-gigs");
    expect(result?.slug).toBe("recent-no-gigs");
  });

  it("includes pollies with fewer than 3 gigs in recent-few-gigs strategy", () => {
    const result = selectPollie(mockPollies, mockGigs, "recent-few-gigs");
    expect(["recent-no-gigs", "older-no-gigs", "has-gigs"]).toContain(
      result?.slug,
    );
  });

  it("selects random pollie without gigs for random strategy", () => {
    const result = selectPollie(mockPollies, mockGigs, "random");
    expect(result).not.toBeNull();
    expect(result?.slug).not.toBe("has-gigs");
  });

  it("returns null when no suitable pollies exist", () => {
    const gigsForAll = mockPollies.map((p) => ({
      ...mockGigs[0],
      pollie_slug: p.slug,
    }));
    const result = selectPollie(mockPollies, gigsForAll, "recent-no-gigs");
    expect(result).toBeNull();
  });
});

describe("listCandidates", () => {
  it("returns multiple candidates sorted by recency", () => {
    const candidates = listCandidates(mockPollies, mockGigs, "recent-no-gigs");
    expect(candidates.length).toBe(2);
    expect(candidates[0].slug).toBe("recent-no-gigs");
    expect(candidates[1].slug).toBe("older-no-gigs");
  });

  it("excludes pollies with gigs for recent-no-gigs strategy", () => {
    const candidates = listCandidates(mockPollies, mockGigs, "recent-no-gigs");
    expect(candidates.map((c) => c.slug)).not.toContain("has-gigs");
  });

  it("respects limit parameter", () => {
    const candidates = listCandidates(
      mockPollies,
      mockGigs,
      "recent-no-gigs",
      1,
    );
    expect(candidates.length).toBe(1);
    expect(candidates[0].slug).toBe("recent-no-gigs");
  });

  it("includes pollies with few gigs for recent-few-gigs strategy", () => {
    const candidates = listCandidates(mockPollies, mockGigs, "recent-few-gigs");
    expect(candidates.map((c) => c.slug)).toContain("has-gigs");
  });

  it("excludes pollies with 3+ gigs for recent-few-gigs strategy", () => {
    const manyGigs: Gig[] = [
      { ...mockGigs[0], pollie_slug: "has-gigs" },
      { ...mockGigs[0], pollie_slug: "has-gigs", role: "Role 2" },
      { ...mockGigs[0], pollie_slug: "has-gigs", role: "Role 3" },
    ];
    const candidates = listCandidates(mockPollies, manyGigs, "recent-few-gigs");
    expect(candidates.map((c) => c.slug)).not.toContain("has-gigs");
  });

  it("returns all candidates without limit", () => {
    const candidates = listCandidates(mockPollies, [], "recent-no-gigs");
    expect(candidates.length).toBe(3);
  });
});

describe("buildPrompt", () => {
  const pollie: Pollie = {
    slug: "test-pollie",
    phid: "TEST5",
    name: "Test Pollie",
    division: "Testville",
    state: "NSW",
    party: "ALP",
    ceasedDate: "2023-06-15",
    house: "reps",
    photoUrl: "https://www.aph.gov.au/api/parliamentarian/TEST5/image",
  };

  it("includes pollie name", () => {
    const prompt = buildPrompt(pollie);
    expect(prompt).toContain("Test Pollie");
  });

  it("includes party and state", () => {
    const prompt = buildPrompt(pollie);
    expect(prompt).toContain("ALP");
    expect(prompt).toContain("NSW");
  });

  it("includes electorate for reps members", () => {
    const prompt = buildPrompt(pollie);
    expect(prompt).toContain("Member for Testville");
  });

  it("uses Senator for senate members", () => {
    const senator: Pollie = { ...pollie, house: "senate" };
    const prompt = buildPrompt(senator);
    expect(prompt).toContain("Senator");
    expect(prompt).not.toContain("Member for");
  });

  it("includes formatted departure date", () => {
    const prompt = buildPrompt(pollie);
    expect(prompt).toContain("June 2023");
  });

  it("includes all gig categories", () => {
    const prompt = buildPrompt(pollie);
    for (const category of GIG_CATEGORIES) {
      expect(prompt).toContain(category);
    }
  });
});

describe("JSON functions", () => {
  const testJsonPath = resolve(__dirname, "test-gigs.json");

  beforeEach(() => {
    if (existsSync(testJsonPath)) {
      unlinkSync(testJsonPath);
    }
  });

  afterEach(() => {
    if (existsSync(testJsonPath)) {
      unlinkSync(testJsonPath);
    }
  });

  describe("readGigsJson", () => {
    it("reads and parses valid JSON", () => {
      const testGigs: Gig[] = [
        {
          role: "Board Member",
          organisation: "Test Corp",
          category: "Professional Services & Management Consulting",
          sources: ["https://example.com/source"],
          pollie_slug: "test-pollie",
          start_date: "2024-01-01",
        },
      ];
      writeFileSync(testJsonPath, JSON.stringify(testGigs, null, 2));

      const result = readGigsJson(testJsonPath);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("Board Member");
    });

    it("throws on invalid JSON schema", () => {
      const invalidGigs = [{ role: "Missing fields" }];
      writeFileSync(testJsonPath, JSON.stringify(invalidGigs, null, 2));

      expect(() => readGigsJson(testJsonPath)).toThrow();
    });
  });

  describe("writeGigsJson", () => {
    it("writes valid gigs to JSON file", () => {
      const testGigs: Gig[] = [
        {
          role: "Advisor",
          organisation: "Test Org",
          category: "Education, Academia & Research",
          sources: ["https://example.com/advisor"],
          pollie_slug: "test-pollie",
        },
      ];

      writeGigsJson(testGigs, testJsonPath);
      const result = readGigsJson(testJsonPath);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("Advisor");
    });

    it("throws on invalid gigs data", () => {
      const invalidGigs = [{ role: "Missing fields" }] as unknown as Gig[];
      expect(() => writeGigsJson(invalidGigs, testJsonPath)).toThrow();
    });
  });

  describe("appendGigsToJson", () => {
    it("appends new gigs to existing file", () => {
      const existingGigs: Gig[] = [
        {
          role: "Existing Role",
          organisation: "Existing Org",
          category: "Retired",
          sources: ["https://example.com/existing"],
          pollie_slug: "existing-pollie",
        },
      ];
      writeFileSync(testJsonPath, JSON.stringify(existingGigs, null, 2));

      const newGigs: Gig[] = [
        {
          role: "New Role",
          organisation: "New Org",
          category: "Education, Academia & Research",
          sources: ["https://example.com/new"],
          pollie_slug: "new-pollie",
        },
      ];

      appendGigsToJson(newGigs, testJsonPath);

      const result = readGigsJson(testJsonPath);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("Existing Role");
      expect(result[1].role).toBe("New Role");
    });
  });
});

describe("loadPollies", () => {
  it("loads pollies from CSV files", () => {
    const pollies = loadPollies(resolve(rootDir, "data"));
    expect(pollies.length).toBeGreaterThan(700);
  });

  it("deduplicates pollies with multiple terms", () => {
    const pollies = loadPollies(resolve(rootDir, "data"));
    const slugs = pollies.map((p: Pollie) => p.slug);
    const uniqueSlugs = new Set(slugs);
    expect(slugs.length).toBe(uniqueSlugs.size);
  });

  it("keeps most recent term for duplicates", () => {
    const pollies = loadPollies(resolve(rootDir, "data"));
    const broadbent = pollies.find(
      (p: Pollie) => p.slug === "russell-broadbent",
    );
    expect(broadbent).toBeDefined();
    expect(broadbent?.division).toBe("Monash");
  });
});

describe("GIG_CATEGORIES", () => {
  it("contains expected number of categories", () => {
    expect(GIG_CATEGORIES.length).toBe(23);
  });

  it("includes Retired category", () => {
    expect(GIG_CATEGORIES).toContain("Retired");
  });
});
