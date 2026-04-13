import { describe, it, expect } from "vitest";
import {
  countVerifiedGigsByPollie,
  getDecade,
  isDecade1980sOrLater,
  getPolliesByDecade,
} from "../src/utils/decade";
import type { Gig } from "../src/types";

const baseGig = {
  role: "Board Member",
  organisation: "Org",
  category: "Professional Services & Management Consulting" as const,
  sources: ["https://example.com"],
  pollie_slug: "x",
};

describe("countVerifiedGigsByPollie", () => {
  it("counts only verified gigs per pollie", () => {
    const gigs: Gig[] = [
      { ...baseGig, pollie_slug: "a", verified_by: "ben" },
      { ...baseGig, pollie_slug: "a", verified_by: "ben" },
      { ...baseGig, pollie_slug: "a" },
      { ...baseGig, pollie_slug: "b", verified_by: "khoi" },
    ];
    const counts = countVerifiedGigsByPollie(gigs);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
  });

  it("returns empty map for no gigs", () => {
    expect(countVerifiedGigsByPollie([]).size).toBe(0);
  });

  it("ignores pollies with no verified gigs", () => {
    const gigs: Gig[] = [{ ...baseGig, pollie_slug: "a" }];
    const counts = countVerifiedGigsByPollie(gigs);
    expect(counts.has("a")).toBe(false);
  });
});

describe("getDecade", () => {
  it("returns Current for null", () => {
    expect(getDecade(null)).toBe("Current");
  });

  it("returns decade string for a date", () => {
    expect(getDecade(new Date("2024-06-15"))).toBe("2020s");
    expect(getDecade(new Date("1999-01-01"))).toBe("1990s");
    expect(getDecade(new Date("1980-12-31"))).toBe("1980s");
  });

  it("rounds correctly at decade boundaries", () => {
    expect(getDecade(new Date("2030-01-01"))).toBe("2030s");
    expect(getDecade(new Date("2029-12-31"))).toBe("2020s");
  });
});

describe("isDecade1980sOrLater", () => {
  it("accepts 1980s and onwards", () => {
    expect(isDecade1980sOrLater("1980s")).toBe(true);
    expect(isDecade1980sOrLater("2020s")).toBe(true);
    expect(isDecade1980sOrLater("2090s")).toBe(true);
  });

  it("rejects pre-1980s", () => {
    expect(isDecade1980sOrLater("1970s")).toBe(false);
    expect(isDecade1980sOrLater("1900s")).toBe(false);
  });

  it("treats Current as included", () => {
    expect(isDecade1980sOrLater("Current")).toBe(true);
  });

  it("rejects garbage strings", () => {
    expect(isDecade1980sOrLater("nonsense")).toBe(false);
    expect(isDecade1980sOrLater("")).toBe(false);
  });
});

describe("getPolliesByDecade", () => {
  function makeEntry(over: Partial<{ slug: string; name: string; ceasedDate: string }>) {
    return {
      data: {
        slug: over.slug ?? "x",
        name: over.name ?? "X",
        division: "",
        state: "",
        party: "",
        ceasedDate: over.ceasedDate ?? "",
        house: "reps" as const,
        photoUrl: "",
        gigCount: 0,
      },
    };
  }

  it("groups pollies by decade and sorts decades newest first", () => {
    const result = getPolliesByDecade([
      makeEntry({ slug: "a", ceasedDate: "2024-01-01" }),
      makeEntry({ slug: "b", ceasedDate: "1990-06-15" }),
      makeEntry({ slug: "c", ceasedDate: "2021-03-10" }),
    ]);
    expect(result.map((g) => g.decade)).toEqual(["2020s", "1990s"]);
    expect(result[0].pollies.map((p) => p.slug)).toEqual(["a", "c"]);
    expect(result[1].pollies.map((p) => p.slug)).toEqual(["b"]);
  });

  it("excludes pollies from before the 1980s", () => {
    const result = getPolliesByDecade([
      makeEntry({ slug: "old", ceasedDate: "1975-01-01" }),
      makeEntry({ slug: "new", ceasedDate: "2024-01-01" }),
    ]);
    expect(result.flatMap((g) => g.pollies).map((p) => p.slug)).toEqual([
      "new",
    ]);
  });

  it("excludes pollies with unparseable dates", () => {
    const result = getPolliesByDecade([
      makeEntry({ slug: "missing", ceasedDate: "" }),
      makeEntry({ slug: "valid", ceasedDate: "2024-01-01" }),
    ]);
    expect(result.flatMap((g) => g.pollies).map((p) => p.slug)).toEqual([
      "valid",
    ]);
  });

  it("sorts pollies within a decade by ceased date desc", () => {
    const result = getPolliesByDecade([
      makeEntry({ slug: "early", ceasedDate: "2020-01-01" }),
      makeEntry({ slug: "late", ceasedDate: "2024-12-31" }),
      makeEntry({ slug: "mid", ceasedDate: "2022-06-15" }),
    ]);
    expect(result[0].pollies.map((p) => p.slug)).toEqual([
      "late",
      "mid",
      "early",
    ]);
  });
});
