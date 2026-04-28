import { describe, it, expect } from "vitest";
import { computeAnalytics } from "../src/utils/analytics";

describe("computeAnalytics", () => {
  it("returns empty totals for empty input", () => {
    const result = computeAnalytics([]);
    expect(result.categoryTotals).toEqual([]);
    expect(result.byParty).toEqual([]);
    expect(result.byDecade).toEqual([]);
  });

  it("aggregates a single row across all three views", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
    ]);
    expect(result.categoryTotals).toEqual([
      { category: "Legal & Judicial", count: 1 },
    ]);
    expect(result.byParty).toEqual([
      {
        category: "Legal & Judicial",
        column: "ALP",
        count: 1,
        proportion: 1,
        columnTotal: 1,
      },
    ]);
    expect(result.byDecade).toEqual([
      {
        category: "Legal & Judicial",
        column: "2010s",
        count: 1,
        proportion: 1,
        columnTotal: 1,
      },
    ]);
  });

  it("sorts categoryTotals desc by count, ties broken alphabetically", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Retired", partyGroup: "ALP", decade: "2010s" },
      { category: "Retired", partyGroup: "ALP", decade: "2010s" },
      {
        category: "Media, Communications & Public Relations",
        partyGroup: "ALP",
        decade: "2010s",
      },
    ]);
    expect(result.categoryTotals.map((t) => t.category)).toEqual([
      "Legal & Judicial",
      "Retired",
      "Media, Communications & Public Relations",
    ]);
  });

  it("computes per-column proportions that sum to 1 within float tolerance", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Legal & Judicial", partyGroup: "Liberal", decade: "2010s" },
      {
        category: "Media, Communications & Public Relations",
        partyGroup: "ALP",
        decade: "2020s",
      },
    ]);

    const sumPerColumn = (cells: { column: string; proportion: number }[]) => {
      const sums = new Map<string, number>();
      for (const c of cells) {
        sums.set(c.column, (sums.get(c.column) ?? 0) + c.proportion);
      }
      return sums;
    };

    for (const sum of sumPerColumn(result.byParty).values()) {
      expect(sum).toBeCloseTo(1, 10);
    }
    for (const sum of sumPerColumn(result.byDecade).values()) {
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("ensures columnTotal matches sum of count over each column", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      {
        category: "Media, Communications & Public Relations",
        partyGroup: "ALP",
        decade: "2010s",
      },
      {
        category: "Media, Communications & Public Relations",
        partyGroup: "Liberal",
        decade: "2020s",
      },
    ]);

    const totalByCol = new Map<string, number>();
    for (const cell of result.byParty) {
      totalByCol.set(cell.column, (totalByCol.get(cell.column) ?? 0) + cell.count);
      expect(cell.columnTotal).toBe(
        result.byParty
          .filter((c) => c.column === cell.column)
          .reduce((acc, c) => acc + c.count, 0),
      );
    }
    expect(totalByCol.get("ALP")).toBe(3);
    expect(totalByCol.get("Liberal")).toBe(1);
  });

  it("drops categories with zero gigs (impossible by construction — covered by empty input)", () => {
    // Placeholder: every row contributes a category, so no category can appear
    // with zero count in the output. The `categoryTotals: []` from empty input
    // already covers the "zero gigs across the dataset" case.
    const result = computeAnalytics([]);
    expect(result.categoryTotals).toEqual([]);
  });

  it("does not emit cells for column/category pairs with zero gigs", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Retired", partyGroup: "Liberal", decade: "2010s" },
    ]);
    // ALP has Legal but not Retired; Liberal has Retired but not Legal.
    expect(
      result.byParty.find(
        (c) => c.column === "ALP" && c.category === "Retired",
      ),
    ).toBeUndefined();
    expect(
      result.byParty.find(
        (c) => c.column === "Liberal" && c.category === "Legal & Judicial",
      ),
    ).toBeUndefined();
  });

  it("does not emit cells for party groups or decades with zero gigs", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
    ]);
    const partyColumns = new Set(result.byParty.map((c) => c.column));
    const decadeColumns = new Set(result.byDecade.map((c) => c.column));
    expect(partyColumns).toEqual(new Set(["ALP"]));
    expect(decadeColumns).toEqual(new Set(["2010s"]));
  });
});
