import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadGigs, loadPollies } from "../src/loaders";

describe("loadGigs", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ooo-loadgigs-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns [] when gigs.json is missing", () => {
    expect(loadGigs(dir)).toEqual([]);
  });

  it("parses valid gigs", () => {
    const validGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com"],
      pollie_slug: "tony-abbott",
    };
    writeFileSync(join(dir, "gigs.json"), JSON.stringify([validGig]));
    const result = loadGigs(dir);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("Board Member");
  });

  it("throws on malformed JSON", () => {
    writeFileSync(join(dir, "gigs.json"), "{ not json");
    expect(() => loadGigs(dir)).toThrow();
  });

  it("throws on schema-invalid gig (missing required field)", () => {
    writeFileSync(
      join(dir, "gigs.json"),
      JSON.stringify([{ role: "Board Member" }]),
    );
    expect(() => loadGigs(dir)).toThrow();
  });

  it("throws on invalid source URL", () => {
    const badGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["not-a-url"],
      pollie_slug: "tony-abbott",
    };
    writeFileSync(join(dir, "gigs.json"), JSON.stringify([badGig]));
    expect(() => loadGigs(dir)).toThrow();
  });

  it("throws on unknown category", () => {
    const badGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Made Up Category",
      sources: ["https://example.com"],
      pollie_slug: "tony-abbott",
    };
    writeFileSync(join(dir, "gigs.json"), JSON.stringify([badGig]));
    expect(() => loadGigs(dir)).toThrow();
  });

  it("returns rejected gigs (filter happens at the collection layer, not here)", () => {
    const rejectedGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com"],
      pollie_slug: "tony-abbott",
      verification: { decision: "rejected", by: "claude", note: "wrong person" },
    };
    writeFileSync(join(dir, "gigs.json"), JSON.stringify([rejectedGig]));
    const result = loadGigs(dir);
    expect(result).toHaveLength(1);
    expect(result[0].verification?.decision).toBe("rejected");
  });
});

describe("loadPollies", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ooo-loadpollies-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns [] when pollies.csv is missing", () => {
    expect(loadPollies(dir)).toEqual([]);
  });

  it("parses CSV rows into Pollie objects, skipping the header", () => {
    const csv = [
      "phid,name,division,state,party,ceasedDate,house",
      "100,Tony Abbott,Warringah,NSW,LIB,2019-05-18,reps",
      "200,Penny Wong,,SA,ALP,,senate",
    ].join("\n");
    writeFileSync(join(dir, "pollies.csv"), csv);

    const pollies = loadPollies(dir);
    expect(pollies).toHaveLength(2);
    expect(pollies[0]).toMatchObject({
      slug: "tony-abbott",
      name: "Tony Abbott",
      division: "Warringah",
      state: "NSW",
      party: "LIB",
      house: "reps",
    });
    expect(pollies[0].photoUrl).toContain("100");
  });

  it("skips rows with missing name", () => {
    const csv = [
      "phid,name,division,state,party,ceasedDate,house",
      "100,,Warringah,NSW,LIB,2019-05-18,reps",
      "200,Penny Wong,,SA,ALP,,senate",
    ].join("\n");
    writeFileSync(join(dir, "pollies.csv"), csv);
    const pollies = loadPollies(dir);
    expect(pollies).toHaveLength(1);
    expect(pollies[0].name).toBe("Penny Wong");
  });

  it("defaults house to reps when omitted", () => {
    const csv = [
      "phid,name,division,state,party,ceasedDate,house",
      "100,Test Person,Div,NSW,LIB,2020-01-01,",
    ].join("\n");
    writeFileSync(join(dir, "pollies.csv"), csv);
    expect(loadPollies(dir)[0].house).toBe("reps");
  });

  it("deduplicates pollies by slug, keeping most recent ceased date", () => {
    const csv = [
      "phid,name,division,state,party,ceasedDate,house",
      "100,Russell Broadbent,McMillan,VIC,LIB,2010-01-01,reps",
      "100,Russell Broadbent,Monash,VIC,IND,2025-01-01,reps",
    ].join("\n");
    writeFileSync(join(dir, "pollies.csv"), csv);
    const pollies = loadPollies(dir);
    expect(pollies).toHaveLength(1);
    expect(pollies[0].division).toBe("Monash");
    expect(pollies[0].party).toBe("IND");
  });
});
