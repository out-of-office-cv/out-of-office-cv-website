import { describe, it, expect } from "vitest";
import { parseCSV } from "../src/utils/csv";
import { parseDate, formatDate, formatISODate, timeAgo } from "../src/utils/date";
import { slugify, getPartyColour, deduplicatePollies } from "../src/utils/pollie";

describe("parseCSV", () => {
  it("parses simple CSV", () => {
    const result = parseCSV("a,b,c\n1,2,3");
    expect(result).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    const result = parseCSV('"hello, world",b,c');
    expect(result[0][0]).toBe("hello, world");
  });

  it("trims whitespace", () => {
    const result = parseCSV("  a , b , c  ");
    expect(result[0]).toEqual(["a", "b", "c"]);
  });
});

describe("parseDate", () => {
  it("parses ISO date strings", () => {
    const date = parseDate("2024-01-15");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2024);
  });

  it("parses dot-separated dates", () => {
    const date = parseDate("15.01.2024");
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2024);
  });

  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("returns null for invalid date", () => {
    expect(parseDate("not-a-date")).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats ISO date to Australian locale", () => {
    const result = formatDate("2024-01-15");
    expect(result).toContain("15");
    expect(result).toContain("January");
    expect(result).toContain("2024");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDate("")).toBe("");
  });
});

describe("formatISODate", () => {
  it("formats ISO date string", () => {
    const result = formatISODate("2024-06-15");
    expect(result).toContain("15");
    expect(result).toContain("June");
    expect(result).toContain("2024");
  });
});

describe("timeAgo", () => {
  it("returns years ago for old dates", () => {
    const result = timeAgo("2020-01-01");
    expect(result).toMatch(/\d+ years? ago/);
  });

  it("returns empty string for invalid date", () => {
    expect(timeAgo("")).toBe("");
  });
});

describe("slugify", () => {
  it("converts name to slug", () => {
    expect(slugify("Tony Abbott")).toBe("tony-abbott");
  });

  it("handles apostrophes", () => {
    expect(slugify("Bridget O'Brien")).toBe("bridget-obrien");
  });

  it("handles special characters", () => {
    expect(slugify("José María")).toBe("jos-mar-a");
  });
});

describe("getPartyColour", () => {
  it("returns red for ALP", () => {
    expect(getPartyColour("ALP")).toBe("red");
  });

  it("returns blue for LIB", () => {
    expect(getPartyColour("LIB")).toBe("blue");
  });

  it("returns null for unknown party", () => {
    expect(getPartyColour("UNKNOWN")).toBeNull();
  });
});

describe("deduplicatePollies", () => {
  it("removes duplicate slugs keeping most recent", () => {
    const pollies = [
      { slug: "test", ceasedDate: "2020-01-01", name: "Old" },
      { slug: "test", ceasedDate: "2024-01-01", name: "New" },
    ];
    const result = deduplicatePollies(pollies);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("New");
  });

  it("keeps unique pollies", () => {
    const pollies = [
      { slug: "a", ceasedDate: "2020-01-01" },
      { slug: "b", ceasedDate: "2021-01-01" },
    ];
    const result = deduplicatePollies(pollies);
    expect(result).toHaveLength(2);
  });
});
