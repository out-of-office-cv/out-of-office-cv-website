import { describe, it, expect } from "vitest";
import {
  countGigsByPollie,
  sortGigsForDisplay,
  sortGigsForVerification,
} from "../src/utils/gigs";
import type { Gig } from "../src/types";

const baseGig = {
  role: "Board Member",
  organisation: "Org",
  category: "Professional Services & Management Consulting" as const,
  sources: ["https://example.com"],
  pollie_slug: "x",
};

describe("countGigsByPollie", () => {
  it("splits counts into verified, unverified, and rejected per pollie", () => {
    const gigs: Gig[] = [
      { ...baseGig, pollie_slug: "a", verification: { decision: "verified", by: "ben" } },
      { ...baseGig, pollie_slug: "a", verification: { decision: "verified", by: "ben" } },
      { ...baseGig, pollie_slug: "a" },
      { ...baseGig, pollie_slug: "b", verification: { decision: "verified", by: "khoi" } },
      { ...baseGig, pollie_slug: "b", verification: { decision: "rejected", by: "claude", note: "wrong person" } },
      { ...baseGig, pollie_slug: "c" },
    ];
    const counts = countGigsByPollie(gigs);
    expect(counts.get("a")).toEqual({ verified: 2, unverified: 1, rejected: 0 });
    expect(counts.get("b")).toEqual({ verified: 1, unverified: 0, rejected: 1 });
    expect(counts.get("c")).toEqual({ verified: 0, unverified: 1, rejected: 0 });
  });

  it("returns empty map for no gigs", () => {
    expect(countGigsByPollie([]).size).toBe(0);
  });
});

describe("sortGigsForDisplay", () => {
  const verified = (by = "ben") =>
    ({ decision: "verified", by } as const);

  it("puts verified gigs before unverified", () => {
    const gigs: Gig[] = [
      { ...baseGig, role: "Unverified A", end_date: "2020-01-01" },
      { ...baseGig, role: "Verified A", verification: verified(), end_date: "2010-01-01" },
      { ...baseGig, role: "Unverified B" },
      { ...baseGig, role: "Verified B", verification: verified(), end_date: "present" },
    ];
    const result = sortGigsForDisplay(gigs);
    expect(result.map((g) => g.role)).toEqual([
      "Verified B",
      "Verified A",
      "Unverified B",
      "Unverified A",
    ]);
  });

  it("within each group, sorts ongoing/unknown/missing end_date first, then dates desc", () => {
    const gigs: Gig[] = [
      { ...baseGig, role: "2018", verification: verified(), end_date: "2018-06-01" },
      { ...baseGig, role: "Present", verification: verified(), end_date: "present" },
      { ...baseGig, role: "2022", verification: verified(), end_date: "2022-12-31" },
      { ...baseGig, role: "Missing", verification: verified() },
      { ...baseGig, role: "Unknown", verification: verified(), end_date: "unknown" },
    ];
    const result = sortGigsForDisplay(gigs);
    const roles = result.map((g) => g.role);
    expect(roles.slice(0, 3).sort()).toEqual(["Missing", "Present", "Unknown"]);
    expect(roles.slice(3)).toEqual(["2022", "2018"]);
  });

  it("does not mutate the input array", () => {
    const gigs: Gig[] = [
      { ...baseGig, role: "A" },
      { ...baseGig, role: "B", verification: verified() },
    ];
    const snapshot = gigs.map((g) => g.role);
    sortGigsForDisplay(gigs);
    expect(gigs.map((g) => g.role)).toEqual(snapshot);
  });

  it("handles empty array", () => {
    expect(sortGigsForDisplay([])).toEqual([]);
  });
});

describe("sortGigsForVerification", () => {
  it("sorts by pollie_slug primary, then by hostname of sources[0]", () => {
    const gigs: Gig[] = [
      { ...baseGig, pollie_slug: "bob", sources: ["https://linkedin.com/x"] },
      { ...baseGig, pollie_slug: "alice", sources: ["https://theage.com.au/y"] },
      { ...baseGig, pollie_slug: "alice", sources: ["https://abc.net.au/z"] },
      { ...baseGig, pollie_slug: "bob", sources: ["https://abc.net.au/w"] },
    ];
    const result = sortGigsForVerification(gigs);
    expect(result.map((g) => `${g.pollie_slug}:${new URL(g.sources[0]).hostname}`)).toEqual([
      "alice:abc.net.au",
      "alice:theage.com.au",
      "bob:abc.net.au",
      "bob:linkedin.com",
    ]);
  });

  it("handles invalid source URLs without throwing", () => {
    const gigs: Gig[] = [
      { ...baseGig, pollie_slug: "a", sources: ["not-a-url"] },
      { ...baseGig, pollie_slug: "a", sources: ["https://example.com/a"] },
    ];
    expect(() => sortGigsForVerification(gigs)).not.toThrow();
  });

  it("preserves extra properties on input items", () => {
    interface GigWithIndex extends Gig {
      index: number;
    }
    const gigs: GigWithIndex[] = [
      { ...baseGig, pollie_slug: "b", index: 0 },
      { ...baseGig, pollie_slug: "a", index: 1 },
    ];
    const result = sortGigsForVerification(gigs);
    expect(result.map((g) => g.index)).toEqual([1, 0]);
  });

  it("does not mutate the input array", () => {
    const gigs: Gig[] = [
      { ...baseGig, pollie_slug: "b" },
      { ...baseGig, pollie_slug: "a" },
    ];
    const snapshot = gigs.map((g) => g.pollie_slug);
    sortGigsForVerification(gigs);
    expect(gigs.map((g) => g.pollie_slug)).toEqual(snapshot);
  });
});
