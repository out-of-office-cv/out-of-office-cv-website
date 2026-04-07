import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import type { Pollie, Gig } from "../src/types";
import { GIG_CATEGORIES } from "../src/types";
import { loadPollies } from "../src/loaders";
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
    const result = selectPollie(mockPollies, mockGigs, "older-no-gigs");
    expect(result?.slug).toBe("older-no-gigs");
  });

  it("returns null for non-existent explicit slug", () => {
    const result = selectPollie(mockPollies, mockGigs, "not-found");
    expect(result).toBeNull();
  });

  it("selects a pollie with fewest gigs", () => {
    const result = selectPollie(mockPollies, mockGigs);
    expect(result).not.toBeNull();
    expect(result?.slug).not.toBe("has-gigs");
  });

  it("returns a pollie when all have gigs", () => {
    const gigsForAll = mockPollies.map((p) => ({
      ...mockGigs[0],
      pollie_slug: p.slug,
    }));
    const result = selectPollie(mockPollies, gigsForAll);
    expect(result).not.toBeNull();
  });

  it("returns null for empty pollie list", () => {
    const result = selectPollie([], mockGigs);
    expect(result).toBeNull();
  });
});

describe("listCandidates", () => {
  it("sorts by gig count ascending", () => {
    const candidates = listCandidates(mockPollies, mockGigs);
    const hasGigsIndex = candidates.findIndex((c) => c.slug === "has-gigs");
    const noGigsSlugs = ["recent-no-gigs", "older-no-gigs"];
    const noGigsIndices = candidates
      .map((c, i) => (noGigsSlugs.includes(c.slug) ? i : -1))
      .filter((i) => i >= 0);
    for (const i of noGigsIndices) {
      expect(i).toBeLessThan(hasGigsIndex);
    }
  });

  it("respects limit parameter", () => {
    const candidates = listCandidates(mockPollies, mockGigs, 1);
    expect(candidates.length).toBe(1);
  });

  it("includes all pollies regardless of gig count", () => {
    const candidates = listCandidates(mockPollies, mockGigs);
    expect(candidates.length).toBe(3);
    expect(candidates.map((c) => c.slug)).toContain("has-gigs");
  });

  it("returns all candidates without limit", () => {
    const candidates = listCandidates(mockPollies, []);
    expect(candidates.length).toBe(3);
  });

  it("pollies with more gigs sort later", () => {
    const manyGigs: Gig[] = [
      { ...mockGigs[0], pollie_slug: "has-gigs" },
      { ...mockGigs[0], pollie_slug: "has-gigs", role: "Role 2" },
      { ...mockGigs[0], pollie_slug: "has-gigs", role: "Role 3" },
      { ...mockGigs[0], pollie_slug: "older-no-gigs", role: "Role 1" },
    ];
    const candidates = listCandidates(mockPollies, manyGigs);
    const slugs = candidates.map((c) => c.slug);
    expect(slugs.indexOf("recent-no-gigs")).toBeLessThan(
      slugs.indexOf("older-no-gigs"),
    );
    expect(slugs.indexOf("older-no-gigs")).toBeLessThan(
      slugs.indexOf("has-gigs"),
    );
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
