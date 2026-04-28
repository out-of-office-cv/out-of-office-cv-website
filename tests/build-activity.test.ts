import { describe, it, expect } from "vitest";
import { classifyDiff } from "../scripts/build-activity";
import type { Gig } from "../src/types";

const baseGig: Gig = {
  role: "Director",
  organisation: "Acme",
  category: "Professional Services & Management Consulting",
  sources: ["https://example.com/a"],
  pollie_slug: "x",
};

const commit = {
  sha: "abc123",
  author: "Ben Swift",
  date: "2026-04-28T20:00:00Z",
};

describe("classifyDiff", () => {
  it("emits an `added` event when a gig is new", () => {
    const events = classifyDiff([], [baseGig], commit);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "added",
      pollie_slug: "x",
      role: "Director",
      organisation: "Acme",
      by: "Ben Swift",
    });
  });

  it("emits a `verified` event when verification.decision becomes verified", () => {
    const before = [baseGig];
    const after = [
      { ...baseGig, verification: { decision: "verified" as const, by: "ben" } },
    ];
    const events = classifyDiff(before, after, commit);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "verified", by: "ben" });
  });

  it("emits a `rejected` event with the note when verification.decision becomes rejected", () => {
    const before = [baseGig];
    const after = [
      {
        ...baseGig,
        verification: {
          decision: "rejected" as const,
          by: "claude",
          note: "wrong person",
        },
      },
    ];
    const events = classifyDiff(before, after, commit);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "rejected",
      by: "claude",
      note: "wrong person",
    });
  });

  it("emits `sources-edited` when only sources change", () => {
    const before = [baseGig];
    const after = [{ ...baseGig, sources: ["https://example.com/b"] }];
    const events = classifyDiff(before, after, commit);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "sources-edited" });
    expect(events[0].note).toMatch(/[+-]/);
  });

  it("emits `dates-edited` when only dates change", () => {
    const before = [baseGig];
    const after = [{ ...baseGig, start_date: "2024-01-01" }];
    const events = classifyDiff(before, after, commit);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "dates-edited" });
  });

  it("emits a `removed` event when a gig disappears", () => {
    const events = classifyDiff([baseGig], [], commit);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "removed" });
  });

  it("attributes source/date edits to claude when verification.by becomes claude in the same commit", () => {
    const before = [baseGig, { ...baseGig, role: "Other", sources: ["https://example.com/old"] }];
    const after = [
      { ...baseGig, verification: { decision: "verified" as const, by: "claude" } },
      { ...baseGig, role: "Other", sources: ["https://example.com/new"] },
    ];
    const events = classifyDiff(before, after, commit);
    const editEvent = events.find((e) => e.action === "sources-edited");
    expect(editEvent?.by).toBe("claude");
  });

  it("emits no event when nothing changed for a gig", () => {
    expect(classifyDiff([baseGig], [baseGig], commit)).toEqual([]);
  });

  it("treats two distinct-tenure gigs (same pollie/role/org, different start_date) as separate", () => {
    const tenure1 = { ...baseGig, start_date: "2021-01-01", end_date: "2023-03-01" };
    const tenure2 = { ...baseGig, start_date: "2026-03-31" };
    const events = classifyDiff([tenure1], [tenure1, tenure2], commit);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "added" });
    // tenure1 wasn't touched: no spurious dates-edited or removed events
    expect(events.every((e) => e.action !== "dates-edited")).toBe(true);
    expect(events.every((e) => e.action !== "removed")).toBe(true);
  });
});
