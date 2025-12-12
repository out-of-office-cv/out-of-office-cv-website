import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pollie, Gig } from "../.vitepress/types";
import { GIG_CATEGORIES } from "../.vitepress/types";
import { loadPollies } from "../.vitepress/loaders";
import {
  selectPollie,
  listCandidates,
  buildPrompt,
  formatGig,
  formatGigsFile,
} from "../scripts/find-gigs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const mockPollies: Pollie[] = [
  {
    slug: "recent-no-gigs",
    name: "Recent No Gigs",
    division: "Test",
    state: "NSW",
    party: "ALP",
    ceasedDate: "01.06.2024",
    reason: "Retired",
    stillInOffice: false,
    house: "reps",
  },
  {
    slug: "older-no-gigs",
    name: "Older No Gigs",
    division: "Test",
    state: "VIC",
    party: "LIB",
    ceasedDate: "01.01.2020",
    reason: "Defeated",
    stillInOffice: false,
    house: "reps",
  },
  {
    slug: "has-gigs",
    name: "Has Gigs",
    division: "Test",
    state: "QLD",
    party: "GRN",
    ceasedDate: "15.03.2023",
    reason: "Retired",
    stillInOffice: false,
    house: "senate",
  },
  {
    slug: "still-in-office",
    name: "Still In Office",
    division: "Test",
    state: "SA",
    party: "ALP",
    ceasedDate: "",
    reason: "",
    stillInOffice: true,
    house: "reps",
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

  it("excludes current members for recent-no-gigs strategy", () => {
    const result = selectPollie(mockPollies, mockGigs, "recent-no-gigs");
    expect(result?.slug).not.toBe("still-in-office");
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
    expect(result?.slug).not.toBe("still-in-office");
  });

  it("returns null when no suitable pollies exist", () => {
    const allWithGigs = mockPollies.filter((p) => !p.stillInOffice);
    const gigsForAll = allWithGigs.map((p) => ({
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

  it("excludes current members", () => {
    const candidates = listCandidates(mockPollies, mockGigs, "recent-no-gigs");
    expect(candidates.map((c) => c.slug)).not.toContain("still-in-office");
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
    name: "Test Pollie",
    division: "Testville",
    state: "NSW",
    party: "ALP",
    ceasedDate: "15.06.2023",
    reason: "Retired",
    stillInOffice: false,
    house: "reps",
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

describe("formatGig", () => {
  it("formats gig with all fields", () => {
    const gig: Gig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/source1", "https://example.com/source2"],
      pollie_slug: "test-pollie",
      start_date: "2023-06-01",
      end_date: "2024-12-31",
    };
    const formatted = formatGig(gig);

    expect(formatted).toContain('"Board Member"');
    expect(formatted).toContain('"Test Corp"');
    expect(formatted).toContain(
      '"Professional Services & Management Consulting"',
    );
    expect(formatted).toContain('"https://example.com/source1"');
    expect(formatted).toContain('"https://example.com/source2"');
    expect(formatted).toContain('"test-pollie"');
    expect(formatted).toContain('"2023-06-01"');
    expect(formatted).toContain('"2024-12-31"');
  });

  it("omits end_date when not present", () => {
    const gig: Gig = {
      role: "Advisor",
      organisation: "Corp",
      category: "Education, Academia & Research",
      sources: ["https://example.com"],
      pollie_slug: "test",
      start_date: "2023-01-01",
    };
    const formatted = formatGig(gig);

    expect(formatted).toContain("start_date");
    expect(formatted).not.toContain("end_date");
  });

  it("omits start_date when not present", () => {
    const gig: Gig = {
      role: "Advisor",
      organisation: "Corp",
      category: "Education, Academia & Research",
      sources: ["https://example.com"],
      pollie_slug: "test",
    };
    const formatted = formatGig(gig);

    expect(formatted).not.toContain("start_date");
    expect(formatted).not.toContain("end_date");
  });
});

describe("formatGigsFile", () => {
  const existingContent = `import type { Gig } from "../.vitepress/types";

export const gigs: Gig[] = [
  {
    role: "Existing Role",
    organisation: "Existing Org",
    category: "Retired",
    sources: ["https://example.com"],
    pollie_slug: "existing-pollie",
  },
];
`;

  it("appends new gigs before closing bracket", () => {
    const newGigs: Gig[] = [
      {
        role: "New Role",
        organisation: "New Org",
        category: "Education, Academia & Research",
        sources: ["https://new.com"],
        pollie_slug: "new-pollie",
      },
    ];
    const result = formatGigsFile(existingContent, newGigs);

    expect(result).toContain("Existing Role");
    expect(result).toContain("New Role");
    expect(result).toContain('"new-pollie"');
    expect(result.endsWith("];\n")).toBe(true);
  });

  it("throws error if closing bracket not found", () => {
    const badContent = "export const gigs = [";
    expect(() => formatGigsFile(badContent, [])).toThrow(
      "Could not find closing bracket",
    );
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
      (p: Pollie) => p.slug === "russell-evan-broadbent",
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
