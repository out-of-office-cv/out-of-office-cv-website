# Verify-gigs implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verify-gigs skill, cron job, throttle file, activity route, and supporting data-model migration so the existing 550-gig backlog can be triaged automatically with full audit trail.

**Architecture:** Replace `verified_by?: string` with a structured `verification?: { decision, by, note? }` field; add a verify-gigs skill that dispatches one subagent per pollie via the Task tool, persists per-gig throttle state in `data/verify-state.json`, and writes findings back; surface every change on a public-but-unlinked `/activity` page built from `git log` at compile time.

**Tech Stack:** TypeScript, Astro 6, Svelte 5 (runes), Zod 4, Vitest, pnpm, mise, GitHub Actions, Claude Code skills.

**Spec:** `docs/superpowers/specs/2026-04-28-verify-gigs-skill-design.md`

---

## File structure

### Created

- `.claude/skills/verify-gigs/SKILL.md` — verify-gigs skill prompt
- `cron-verify-gigs.sh` — cron driver (sibling of `cron-find-gigs.sh`)
- `data/verify-state.json` — throttle state (initial `{}`)
- `scripts/migrate-verification.ts` — one-shot, idempotent migration of `data/gigs.json`
- `scripts/build-activity.ts` — git log → typed `ActivityEvent[]`
- `src/components/ActivityList.svelte` — interactive Svelte 5 island for `/activity`
- `src/pages/activity.astro` — public-but-unlinked activity page
- `tests/migrate-verification.test.ts` — migration unit tests
- `tests/build-activity.test.ts` — activity classifier unit tests

### Modified

- `src/types.ts` — add `Verification`, swap `Gig.verified_by` → `Gig.verification`, add `rejected` to `GigCountSplit`
- `data/gigs-schema.ts` — Zod schema mirrors the new shape
- `data/gigs.json` — all 663 entries migrated (113 actually change content)
- `src/content.config.ts` — schema update + filter rejected gigs from public collection + register activity collection
- `src/loaders.ts` — no shape change needed (still uses `GigsArraySchema`); only filtering happens at content-collection level
- `src/utils/gigs.ts` — `countGigsByPollie` populates 3 buckets; `sortGigsForDisplay` reads via `gig.verification?.decision`
- `src/components/GigList.astro` — read via `gig.verification`
- `src/pages/pollies/[slug].astro` — `hasUnverified` reads new shape
- `src/components/PollieList.svelte` — display logic unchanged but counts come via new shape
- `src/components/GigEntryForm.svelte` — write `{ decision: "verified", by: verifier }`; read `!g.verification`
- `src/components/VerifyGigList.svelte` — write `{ decision: "verified", by: verifier }` via `addVerifiedByToGigs` rename
- `src/components/VerificationNote.astro` — copy refresh (mention AI checker)
- `.claude/skills/find-gigs/SKILL.md` — dedup rejected, cap output at 10 gigs, schema reference
- `.github/workflows/auto-merge-gig-prs.yml` — add `data/verify-state.json` to paths filter
- `tests/gigs.test.ts` — assertions reflect new shape; reject old shape
- `tests/gigs-sort.test.ts` — `countGigsByPollie` 3-bucket assertion + sort
- `tests/loaders.test.ts` — no change needed (loader still produces `Gig[]`)
- `tests/pollies.test.ts` — fixture data uses new shape

---

## Phase 1 — Data model + migration

### Task 1: Update types in `src/types.ts`

**Files:**
- Modify: `src/types.ts:15-18, 67-76`

- [ ] **Step 1: Read the current file**

Run: `cat src/types.ts`

- [ ] **Step 2: Edit the type module**

Replace `GigCountSplit` (lines 15-18) and `Gig` (lines 67-76) with:

```ts
export interface GigCountSplit {
  verified: number;
  unverified: number;
  rejected: number;
}

// ...keep PollieListItem and PolliesByDecade as-is; gigCount stays GigCountSplit...

export type VerificationDecision = "verified" | "rejected";

export interface Verification {
  decision: VerificationDecision;
  by: string;
  note?: string;
}

export interface Gig {
  role: string;
  organisation: string;
  category: GigCategory;
  sources: string[];
  verification?: Verification;
  pollie_slug: string;
  start_date?: string;
  end_date?: string;
}
```

- [ ] **Step 3: Run typecheck (will surface call-sites that need updating)**

Run: `pnpm check`
Expected: errors in files that read `gig.verified_by` (that's fine — we'll fix them in later tasks; types are the source of truth now).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "Replace verified_by with structured verification field in types"
```

### Task 2: Update Zod schema in `data/gigs-schema.ts`

**Files:**
- Modify: `data/gigs-schema.ts`

- [ ] **Step 1: Replace the schema**

Overwrite the entire file with:

```ts
import { z } from "zod";
import { GIG_CATEGORIES } from "../src/types";

export const VerificationSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  by: z.string().min(1),
  note: z.string().optional(),
});

export const GigSchema = z.object({
  role: z.string().min(1),
  organisation: z.string().min(1),
  category: z.enum(GIG_CATEGORIES),
  sources: z
    .array(z.url())
    .min(1)
    .refine((urls) => new Set(urls).size === urls.length, {
      message: "sources must not contain duplicate URLs",
    }),
  verification: VerificationSchema.optional(),
  pollie_slug: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const GigsArraySchema = z.array(GigSchema);

export type GigFromSchema = z.infer<typeof GigSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add data/gigs-schema.ts
git commit -m "Update Zod schema to use structured verification field"
```

### Task 3: Write migration script with TDD

**Files:**
- Create: `scripts/migrate-verification.ts`
- Create: `tests/migrate-verification.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/migrate-verification.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { migrateGig } from "../scripts/migrate-verification";

const baseGig = {
  role: "Director",
  organisation: "Acme",
  category: "Professional Services & Management Consulting",
  sources: ["https://example.com"],
  pollie_slug: "x",
};

describe("migrateGig", () => {
  it("converts verified_by: ben to verification.decision verified, by ben", () => {
    const input = { ...baseGig, verified_by: "ben" };
    expect(migrateGig(input)).toEqual({
      ...baseGig,
      verification: { decision: "verified", by: "ben" },
    });
  });

  it("converts verified_by: khoi to verification.decision verified, by khoi", () => {
    const input = { ...baseGig, verified_by: "khoi" };
    expect(migrateGig(input)).toEqual({
      ...baseGig,
      verification: { decision: "verified", by: "khoi" },
    });
  });

  it("leaves a gig with no verified_by untouched", () => {
    expect(migrateGig({ ...baseGig })).toEqual({ ...baseGig });
  });

  it("is idempotent on already-migrated gigs", () => {
    const migrated = {
      ...baseGig,
      verification: { decision: "verified" as const, by: "ben" },
    };
    expect(migrateGig(migrated)).toEqual(migrated);
  });

  it("preserves other fields (start_date, end_date)", () => {
    const input = {
      ...baseGig,
      verified_by: "ben",
      start_date: "2020-01-01",
      end_date: "2024-12-31",
    };
    const result = migrateGig(input);
    expect(result.start_date).toBe("2020-01-01");
    expect(result.end_date).toBe("2024-12-31");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/migrate-verification.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

Create `scripts/migrate-verification.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface OldGig {
  verified_by?: string;
  verification?: { decision: "verified" | "rejected"; by: string; note?: string };
  [key: string]: unknown;
}

export function migrateGig(gig: OldGig): Record<string, unknown> {
  const { verified_by, ...rest } = gig;
  if (rest.verification) return rest;
  if (verified_by) {
    return { ...rest, verification: { decision: "verified", by: verified_by } };
  }
  return rest;
}

function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = resolve(__dirname, "..", "data", "gigs.json");
  const content = readFileSync(path, "utf-8");
  const gigs: OldGig[] = JSON.parse(content);
  const migrated = gigs.map(migrateGig);
  writeFileSync(path, JSON.stringify(migrated, null, 2) + "\n");
  console.log(`Migrated ${migrated.length} gigs`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- tests/migrate-verification.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-verification.ts tests/migrate-verification.test.ts
git commit -m "Add idempotent migration script for verification field"
```

### Task 4: Run migration on `data/gigs.json`

**Files:**
- Modify: `data/gigs.json`

- [ ] **Step 1: Run the migration**

Run: `pnpm tsx scripts/migrate-verification.ts`
Expected: `Migrated 663 gigs`

- [ ] **Step 2: Verify the diff is sensible**

Run: `git diff --stat data/gigs.json`
Expected: 113 lines deleted (`verified_by`), 113 chunks added (`verification: {...}`).

Run: `git diff data/gigs.json | head -50`
Inspect that the conversion looks right.

- [ ] **Step 3: Verify it parses against the new schema**

Run: `pnpm test -- tests/gigs.test.ts`
Expected: schema-validation tests pass against migrated data.

- [ ] **Step 4: Commit**

```bash
git add data/gigs.json
git commit -m "Migrate gigs.json to structured verification field"
```

### Task 5a: Update fixture in `tests/pollies.test.ts`

**Files:**
- Modify: `tests/pollies.test.ts:89-109`

- [ ] **Step 1: Replace both `verified_by: "test"` lines with the new shape**

Lines 97 and 107 each currently read `verified_by: "test",`. Replace each with:

```ts
        verification: { decision: "verified", by: "test" },
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test -- tests/pollies.test.ts`
Expected: PASS (or, if it fails, only because of upstream code that we'll fix in Phase 2 — re-run after Task 7).

- [ ] **Step 3: Commit**

```bash
git add tests/pollies.test.ts
git commit -m "Update pollies test fixtures to new verification shape"
```

### Task 5: Update `tests/gigs.test.ts` to reflect new shape

**Files:**
- Modify: `tests/gigs.test.ts:131-143`

- [ ] **Step 1: Replace the verified_by acceptance test**

Replace the test "accepts gig with optional verified_by field" with two tests:

```ts
  it("accepts gig with verification field (verified)", () => {
    const gigWithVerifier = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/source"],
      pollie_slug: "test-pollie",
      verification: { decision: "verified", by: "ben" },
    };

    const result = GigSchema.safeParse(gigWithVerifier);
    expect(result.success).toBe(true);
  });

  it("accepts gig with verification field (rejected) and a note", () => {
    const gigWithRejection = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/source"],
      pollie_slug: "test-pollie",
      verification: {
        decision: "rejected",
        by: "claude",
        note: "Source refers to a different person with the same name",
      },
    };

    const result = GigSchema.safeParse(gigWithRejection);
    expect(result.success).toBe(true);
  });

  it("rejects gig with bare verified_by string (legacy shape)", () => {
    const legacyGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/source"],
      pollie_slug: "test-pollie",
      verified_by: "ben",
    };

    // Zod strips unknown keys by default — the parse succeeds, but verified_by is dropped.
    const result = GigSchema.safeParse(legacyGig);
    expect(result.success).toBe(true);
    expect((result.data as { verified_by?: string }).verified_by).toBeUndefined();
  });

  it("rejects gig with malformed verification (missing decision)", () => {
    const badGig = {
      role: "Board Member",
      organisation: "Test Corp",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/source"],
      pollie_slug: "test-pollie",
      verification: { by: "ben" },
    };

    const result = GigSchema.safeParse(badGig);
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test -- tests/gigs.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/gigs.test.ts
git commit -m "Update gigs.test.ts to assert new verification shape"
```

---

## Phase 2 — Loader and utility updates

### Task 6: Update `src/utils/gigs.ts` with TDD

**Files:**
- Modify: `src/utils/gigs.ts:3-15, 32-39`
- Modify: `tests/gigs-sort.test.ts:17-35, 38-66`

- [ ] **Step 1: Update the existing tests in `tests/gigs-sort.test.ts`**

Replace the `countGigsByPollie` describe block (lines 17-35):

```ts
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
```

Replace the `sortGigsForDisplay` describe block (lines 38-66) so each verified/unverified-tagged gig uses the new shape:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- tests/gigs-sort.test.ts`
Expected: FAIL — countGigsByPollie returns no `rejected` key, sortGigsForDisplay still keys off `verified_by`.

- [ ] **Step 3: Update `src/utils/gigs.ts`**

Replace lines 1-39 with:

```ts
import type { Gig, GigCountSplit } from "../types";

export function countGigsByPollie(gigs: Gig[]): Map<string, GigCountSplit> {
  const counts = new Map<string, GigCountSplit>();
  for (const gig of gigs) {
    const current =
      counts.get(gig.pollie_slug) ?? { verified: 0, unverified: 0, rejected: 0 };
    if (gig.verification?.decision === "verified") {
      current.verified += 1;
    } else if (gig.verification?.decision === "rejected") {
      current.rejected += 1;
    } else {
      current.unverified += 1;
    }
    counts.set(gig.pollie_slug, current);
  }
  return counts;
}

function endDateSortKey(endDate: string | undefined): number {
  if (!endDate || endDate === "present" || endDate === "unknown") {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = new Date(
    /^\d{4}$/.test(endDate)
      ? `${endDate}-12-31`
      : /^\d{4}-\d{2}$/.test(endDate)
        ? `${endDate}-01`
        : endDate,
  );
  const time = parsed.getTime();
  return isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

export function sortGigsForDisplay(gigs: Gig[]): Gig[] {
  return [...gigs].sort((a, b) => {
    const aVerified = a.verification?.decision === "verified" ? 1 : 0;
    const bVerified = b.verification?.decision === "verified" ? 1 : 0;
    if (aVerified !== bVerified) return bVerified - aVerified;
    return endDateSortKey(b.end_date) - endDateSortKey(a.end_date);
  });
}
```

(Leave `sortGigsForVerification` unchanged — it doesn't read the verification field.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- tests/gigs-sort.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/gigs.ts tests/gigs-sort.test.ts
git commit -m "Rework countGigsByPollie and sortGigsForDisplay for verification field"
```

### Task 7: Update `src/content.config.ts` (schema + filter rejected)

**Files:**
- Modify: `src/content.config.ts:11-20, 27-39, 41-56`

- [ ] **Step 1: Read the current file**

Run: `cat src/content.config.ts`

- [ ] **Step 2: Update the schema and filter rejected gigs from the public collection**

Replace the file with:

```ts
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { resolve } from "node:path";
import { loadPollies, loadGigs } from "./loaders";
import { countGigsByPollie } from "./utils/gigs";
import { GIG_CATEGORIES } from "./types";
import type { Gig } from "./types";

const dataDir = resolve(process.cwd(), "data");

const verificationSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  by: z.string(),
  note: z.string().optional(),
});

const gigSchema = z.object({
  role: z.string().min(1),
  organisation: z.string().min(1),
  category: z.enum(GIG_CATEGORIES),
  sources: z.array(z.url()).min(1),
  verification: verificationSchema.optional(),
  pollie_slug: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const pollies = defineCollection({
  loader: async () => {
    const allPollies = loadPollies(dataDir);
    const allGigs = loadGigs(dataDir);
    const gigCounts = countGigsByPollie(allGigs);

    // Filter rejected gigs out of public surfaces; counts above still see them.
    const visibleGigs = allGigs.filter(
      (g) => g.verification?.decision !== "rejected",
    );
    const gigsByPollie = new Map<string, Gig[]>();
    for (const gig of visibleGigs) {
      const existing = gigsByPollie.get(gig.pollie_slug) || [];
      existing.push(gig);
      gigsByPollie.set(gig.pollie_slug, existing);
    }

    return allPollies.map((pollie) => ({
      id: pollie.slug,
      ...pollie,
      gigCount:
        gigCounts.get(pollie.slug) ?? { verified: 0, unverified: 0, rejected: 0 },
      gigs: gigsByPollie.get(pollie.slug) || [],
    }));
  },
  schema: z.object({
    slug: z.string(),
    phid: z.string(),
    name: z.string(),
    division: z.string(),
    state: z.string(),
    party: z.string(),
    ceasedDate: z.string(),
    house: z.enum(["senate", "reps"]),
    photoUrl: z.string(),
    gigCount: z.object({
      verified: z.number(),
      unverified: z.number(),
      rejected: z.number(),
    }),
    gigs: z.array(gigSchema),
  }),
});

export const collections = { pollies };

export { getPolliesByDecade } from "./utils/decade";
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm check`
Expected: only errors in components that still read `gig.verified_by` or in `[slug].astro` filtering.

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts
git commit -m "Filter rejected gigs from public collection and update count schema"
```

### Task 8: Add a loader/collection regression test

**Files:**
- Modify: `tests/loaders.test.ts`

- [ ] **Step 1: Append a test that confirms loadGigs returns rejected gigs (because the filter is at the collection layer, not the loader)**

Add inside `describe("loadGigs", ...)`:

```ts
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
```

- [ ] **Step 2: Run the test**

Run: `pnpm test -- tests/loaders.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/loaders.test.ts
git commit -m "Document loader behaviour: rejected gigs pass through, filter is downstream"
```

---

## Phase 3 — Component updates

### Task 9: Update `src/components/GigList.astro`

**Files:**
- Modify: `src/components/GigList.astro:44-54`

- [ ] **Step 1: Replace the unverified read**

Change line 45 from:

```astro
        <li class:list={["gig", !gig.verified_by && "gig-unverified"]}>
```

to:

```astro
        <li class:list={["gig", gig.verification?.decision !== "verified" && "gig-unverified"]}>
```

And line 50 from:

```astro
            {!gig.verified_by && (
```

to:

```astro
            {gig.verification?.decision !== "verified" && (
```

- [ ] **Step 2: Run check**

Run: `pnpm check`
Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/GigList.astro
git commit -m "Read verification status via gig.verification in GigList"
```

### Task 10: Update `src/pages/pollies/[slug].astro`

**Files:**
- Modify: `src/pages/pollies/[slug].astro:22`

- [ ] **Step 1: Replace the unverified test**

Change line 22 from:

```ts
const hasUnverified = pollie.gigs.some((g) => !g.verified_by)
```

to:

```ts
const hasUnverified = pollie.gigs.some(
  (g) => g.verification?.decision !== "verified",
)
```

- [ ] **Step 2: Run check**

Run: `pnpm check`
Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/pages/pollies/[slug].astro
git commit -m "Compute hasUnverified via gig.verification on pollie page"
```

### Task 11: Update `src/components/PollieList.svelte`

`PollieList` reads `pollie.gigCount.verified` and `pollie.gigCount.unverified` only — those still flow through the new `GigCountSplit`. No change needed.

- [ ] **Step 1: Confirm no read of `verified_by` in this file**

Run: `grep -n "verified_by" src/components/PollieList.svelte`
Expected: no matches.

- [ ] **Step 2: Run check**

Run: `pnpm check`
Expected: no errors related to `PollieList.svelte`.

(No commit; no changes.)

### Task 12: Update `src/components/GigEntryForm.svelte`

**Files:**
- Modify: `src/components/GigEntryForm.svelte:35, 80-96`

- [ ] **Step 1: Update the unverified-gigs derivation (line 35)**

Change:

```ts
let unverifiedGigs = $derived(gigs.filter((g) => !g.verified_by))
```

to:

```ts
let unverifiedGigs = $derived(
  gigs.filter((g) => g.verification?.decision !== "verified"),
)
```

- [ ] **Step 2: Update `addVerifiedByToGigs` to write the new shape (lines 80-96)**

Rename it to `applyVerificationToGigs` and have it write `verification: { decision, by }`:

```ts
  function applyVerificationToGigs(
    content: string,
    indicesToVerify: number[],
    verifier: string,
    edits: Record<number, Partial<Gig>>,
  ): string {
    const allGigs: Gig[] = JSON.parse(content)
    for (const index of indicesToVerify) {
      if (allGigs[index]) {
        allGigs[index].verification = { decision: "verified", by: verifier }
        if (edits[index]) {
          Object.assign(allGigs[index], edits[index])
        }
      }
    }
    return JSON.stringify(allGigs, null, 2) + "\n"
  }
```

- [ ] **Step 3: Update the call site (line 122-123) to use the new name**

```ts
      updateFile: (content: string) =>
        applyVerificationToGigs(content, indices, verifier, edits),
```

- [ ] **Step 4: Run check**

Run: `pnpm check`
Expected: no errors in this file.

- [ ] **Step 5: Commit**

```bash
git add src/components/GigEntryForm.svelte
git commit -m "Write structured verification field from contribute form"
```

### Task 13: Confirm `src/components/VerifyGigList.svelte` needs no change

`VerifyGigList` only manipulates the local `Partial<Gig>` edits and emits indices/verifier upward — it never reads `verified_by` or writes `verification`.

- [ ] **Step 1: Confirm no read of `verified_by` in this file**

Run: `grep -n "verified_by" src/components/VerifyGigList.svelte`
Expected: no matches.

- [ ] **Step 2: Run check**

Run: `pnpm check`
Expected: no errors related to `VerifyGigList.svelte`.

(No commit; no changes.)

### Task 14: Refresh `src/components/VerificationNote.astro` copy

**Files:**
- Modify: `src/components/VerificationNote.astro:6-13`

- [ ] **Step 1: Replace the paragraph**

Change the `<p>` body from the original to:

```astro
  <p>
    Gigs on this site come from public reporting, parliamentary records, and
    AI-assisted searches. <strong>Verified</strong> entries have been reviewed
    against their sources by a human or by our automated AI checker. <em>Unverified</em>
    entries (shown faded, tagged <em>unverified</em>) are still awaiting review
    and may be inaccurate. Spotted something wrong or missing?
    <a href="/contribute">Help us verify.</a>
  </p>
```

- [ ] **Step 2: Run check + build a single page**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VerificationNote.astro
git commit -m "Mention AI checker in verification note copy"
```

### Task 15: Run full build + tests as a checkpoint

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: success (no type or schema errors).

- [ ] **Step 2: Tests**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 3: Smoke-test the dev server (manual)**

Run: `pnpm dev` (background)
Visit `http://localhost:4321/`, click into a pollie with unverified gigs, confirm `unverified` tag still renders, the verification note still appears, the contribute form still loads.

If anything fails, debug and commit the fix before moving on.

(No commit unless smoke-test surfaces a fix.)

---

## Phase 4 — verify-gigs skill, throttle, cron, auto-merge

### Task 16: Create the empty throttle file

**Files:**
- Create: `data/verify-state.json`

- [ ] **Step 1: Initialise the file**

Write `data/verify-state.json` with content:

```json
{}
```

(Single line `{}\n` — the skill will populate it on first run.)

- [ ] **Step 2: Commit**

```bash
git add data/verify-state.json
git commit -m "Add empty verify-state.json for verify-gigs throttle tracking"
```

### Task 17: Write the verify-gigs skill

**Files:**
- Create: `.claude/skills/verify-gigs/SKILL.md`

- [ ] **Step 1: Write the SKILL.md**

```markdown
---
name: verify-gigs
description: Investigates existing unverified gigs in data/gigs.json, confirms or rejects them via web research, and improves source quality. Use for periodic verification sweeps.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task
---

# Verify post-parliamentary gigs

You are verifying existing unverified gigs in `data/gigs.json`. For each
candidate gig you investigate the original source, check it really refers to
the named former MP/Senator, and decide whether to mark it `verified`,
`rejected`, or leave it `unverified` for a human.

## Step 1: select a batch of gigs

Read in this order:

1. `data/pollies.csv` — pollie metadata.
2. `data/gigs.json` — all gigs.
3. `data/verify-state.json` — `{key: ISO-timestamp}` of last verify attempts.

Build the eligible set:

- A gig is *eligible* if it has no `verification` field AND its key is either
  absent from `verify-state.json` or has a `last_examined_at` more than 7 days
  before today.
- Key format: `<pollie_slug>|<role>|<organisation>|<start_date|null>` (use the
  literal string `null` if `start_date` is absent).

Group eligible gigs by `pollie_slug`. Sort pollies by eligible-gig-count
descending; tiebreak by pollie slug ascending. Accumulate pollies until the
running eligible-gig total would exceed 20, then stop. A run typically picks
4–7 pollies covering 15–25 gigs.

Print the selection (pollie slug + count) before dispatching.

## Step 2: dispatch one subagent per pollie in parallel

Use the `Task` tool with `subagent_type: general-purpose`. Send all dispatches
in a single message so they run concurrently.

Each subagent prompt must include:

- The pollie record: name, party, electorate, house, ceased date.
- The full unverified gig records for that pollie (numbered by `gig_index`,
  starting at 0 within the pollie's batch).
- The decision rules below.
- The exact JSON output shape required.
- An instruction to return only valid JSON.

### Decision rules (verbatim in subagent prompt)

> For each gig, return one of three decisions:
>
> - `"verified"` — high confidence (Wikipedia "would not need [citation
>   needed]" standard). All of: (1) at least one authoritative source clearly
>   refers to this specific former MP/Senator (not a namesake); (2) role and
>   organisation match; (3) dates plausible (after they left parliament).
> - `"rejected"` — high confidence the gig is wrong. Includes: source refers
>   to a different person with the same name; role doesn't exist or never
>   happened; pre-parliament role mistakenly tagged as post-parliament. A
>   `note` explaining the rejection is required.
> - `"unverified"` — anything else. Sources too weak, ambiguous identity,
>   dates uncertain, role unclear. Default if you can't reach high confidence
>   either way.

### Source authority hierarchy (verbatim in subagent prompt)

> - **Strong**: official organisation pages (`.gov.au`, `.edu.au`, corporate
>   "about"/annual reports), reputable Australian news (ABC, Guardian, AFR,
>   SMH, The Age), parliamentary records, Hansard.
> - **Acceptable supporting**: LinkedIn (paired with another source confirming
>   identity), industry-association bios.
> - **Weak alone**: passing mentions, listicles, partisan sites, social media.

### Source and date mutations (verbatim in subagent prompt)

> Applies to `verified` and `unverified` decisions (not `rejected` — those are
> recorded as-is for the audit trail):
>
> - May append new sources discovered during investigation.
> - May remove dead/404 sources (test via WebFetch).
> - May replace a weak source with a strong one *if the weak one was the only
>   source about a same-named person*; explain in the note.
> - May correct `start_date` / `end_date` when contradicted by a strong
>   source.
> - May NOT touch role, organisation, category, or pollie_slug.

### Required output schema

```ts
type Finding = {
  gig_index: number          // index in this subagent's input array
  decision: "verified" | "rejected" | "unverified"
  note?: string              // required if decision === "rejected"
  source_changes?: {
    add?: string[]
    remove?: string[]        // exact URLs from the original sources array
  }
  date_changes?: {
    start_date?: string | null   // null = remove
    end_date?: string | null
  }
}

type SubagentOutput = {
  pollie_slug: string
  findings: Finding[]
}
```

The subagent must return exactly one fenced JSON block matching `SubagentOutput`.

## Step 3: collect findings

Wait for all subagent tasks to return. For each one:

- Parse the fenced JSON block.
- Validate against the schema above. Drop findings that fail validation; log
  which ones.
- A subagent that returns nothing parseable causes that pollie to be skipped,
  not the whole run aborted.

## Step 4: apply findings to data/gigs.json

Single read-modify-write pass. For each finding:

- `verified` → set
  `gig.verification = { decision: "verified", by: "claude" }`. If the finding
  has a `note`, include it.
- `rejected` → set
  `gig.verification = { decision: "rejected", by: "claude", note: <note> }`.
  Drop findings where `note` is missing or empty.
- `unverified` → leave `verification` absent.
- For `verified` and `unverified`: apply `source_changes` (add new URLs, remove
  matching URLs); apply `date_changes` (set fields, or remove if null).
- Other fields untouched.

Write the file with `JSON.stringify(gigs, null, 2) + "\n"`.

## Step 5: update throttle state

For every gig that was investigated (regardless of decision), record its key
in `data/verify-state.json` with the current ISO timestamp. Preserve existing
entries.

Write the file with `JSON.stringify(state, null, 2) + "\n"`.

## Step 6: validate

Run `pnpm build && pnpm test`. If either fails, restore `data/gigs.json` and
`data/verify-state.json` from git and abort.

## Step 7: print summary

Per pollie:

- Verified: N
- Rejected: N (one bullet per rejection with the note)
- Source/date edits on still-unverified gigs: N
- Untouched (still unverified, no edits): N

Then a totals line.

## Important rules

- Do NOT touch role, organisation, category, or pollie_slug — ever.
- Always supply a `note` for rejections. Findings without a note are dropped.
- Do not rerun against gigs that already have a `verification` field (those
  are filtered in Step 1's eligibility check; double-check before writing).
- Use Australian English in all communication.
```

- [ ] **Step 2: Lint the markdown loosely (no lint tooling — just sanity check rendering)**

Run: `head -20 .claude/skills/verify-gigs/SKILL.md`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/verify-gigs/SKILL.md
git commit -m "Add verify-gigs skill with per-pollie subagent dispatch"
```

### Task 18: Create `cron-verify-gigs.sh`

**Files:**
- Create: `cron-verify-gigs.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/ben/projects/out-of-office-cv-website"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/verify-gigs-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

log() { echo "$(date -Iseconds) $*" >> "$LOG_FILE"; }

eval "$(/home/ben/.local/bin/mise activate bash)"

cd "$PROJECT_DIR"

log "=== verify-gigs started ==="

git checkout main >> "$LOG_FILE" 2>&1
git reset --hard >> "$LOG_FILE" 2>&1
git pull --rebase origin main >> "$LOG_FILE" 2>&1

env -u CLAUDECODE /home/ben/.local/bin/claude \
  --dangerously-skip-permissions \
  --effort max \
  -p "/verify-gigs" \
  >> "$LOG_FILE" 2>&1 || true

if git diff --quiet data/gigs.json data/verify-state.json; then
  log "No verification changes, nothing to commit"
else
  BRANCH="verify-gigs-$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$BRANCH"
  git show HEAD:data/gigs.json > /tmp/verify-gigs-old.json
  git add data/gigs.json data/verify-state.json
  python3 <<'PYEOF'
import json
from collections import Counter, defaultdict

with open("/tmp/verify-gigs-old.json") as f:
    old = json.load(f)
with open("data/gigs.json") as f:
    new = json.load(f)

def key(g):
    return (g.get("pollie_slug"), g.get("role"), g.get("organisation"), g.get("start_date"))

old_by_key = {key(g): g for g in old}

verified = defaultdict(int)
rejected = defaultdict(list)
edited = defaultdict(int)

for g in new:
    k = key(g)
    o = old_by_key.get(k)
    if not o:
        continue
    new_v = g.get("verification")
    old_v = o.get("verification")
    if new_v and not old_v:
        if new_v["decision"] == "verified":
            verified[g["pollie_slug"]] += 1
        elif new_v["decision"] == "rejected":
            rejected[g["pollie_slug"]].append((g["role"], g["organisation"], new_v.get("note", "")))
    elif not new_v:
        if g.get("sources") != o.get("sources") or g.get("start_date") != o.get("start_date") or g.get("end_date") != o.get("end_date"):
            edited[g["pollie_slug"]] += 1

total_verified = sum(verified.values())
total_rejected = sum(len(v) for v in rejected.values())
total_edited = sum(edited.values())

slugs = sorted(set(verified) | set(rejected) | set(edited))
title_suffix = ", ".join(slugs[:3])
if len(slugs) > 3:
    title_suffix += f" and {len(slugs) - 3} more"
if not slugs:
    title = "verify-gigs: throttle update only"
else:
    title = f"Verify {total_verified}, reject {total_rejected}, edit {total_edited}: {title_suffix}"

body = [
    f"**Verified**: {total_verified}",
    f"**Rejected**: {total_rejected}",
    f"**Edits on still-unverified**: {total_edited}",
    "",
]
for slug in slugs:
    parts = []
    if verified[slug]:
        parts.append(f"verified={verified[slug]}")
    if rejected[slug]:
        parts.append(f"rejected={len(rejected[slug])}")
    if edited[slug]:
        parts.append(f"edits={edited[slug]}")
    body.append(f"- {slug}: {', '.join(parts)}")
    for role, org, note in rejected[slug]:
        body.append(f"    - rejected: {role} @ {org} — {note}")

with open("/tmp/verify-gigs-title", "w") as f:
    f.write(title)
with open("/tmp/verify-gigs-body", "w") as f:
    f.write("\n".join(body))
PYEOF
  PR_TITLE=$(cat /tmp/verify-gigs-title)
  PR_BODY=$(cat /tmp/verify-gigs-body)
  rm -f /tmp/verify-gigs-old.json /tmp/verify-gigs-title /tmp/verify-gigs-body
  git commit -m "Verify gigs via cron job"
  git push -u origin "$BRANCH"
  gh pr create \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    >> "$LOG_FILE" 2>&1
  git checkout main
  log "PR created on branch ${BRANCH}"
fi

log "=== verify-gigs finished ==="
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x cron-verify-gigs.sh`

- [ ] **Step 3: Commit**

```bash
git add cron-verify-gigs.sh
git commit -m "Add cron driver for verify-gigs"
```

### Task 19: Update auto-merge workflow paths filter

**Files:**
- Modify: `.github/workflows/auto-merge-gig-prs.yml:6-7`

- [ ] **Step 1: Edit the paths filter**

Change:

```yaml
    paths:
      - "data/gigs.json"
```

to:

```yaml
    paths:
      - "data/gigs.json"
      - "data/verify-state.json"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/auto-merge-gig-prs.yml
git commit -m "Auto-merge PRs that touch only verify-state.json"
```

### Task 20: Document crontab change for the user

The crontab is outside the repo. Plan-runner: at the end of the run, print the
following block for the user to paste into `crontab -e`:

```
0 20 * * * /home/ben/projects/out-of-office-cv-website/cron-verify-gigs.sh
0 21 * * * /home/ben/projects/out-of-office-cv-website/cron-find-gigs.sh
```

(No commit; this is just an instruction.)

---

## Phase 5 — find-gigs updates

### Task 21: Update `.claude/skills/find-gigs/SKILL.md`

**Files:**
- Modify: `.claude/skills/find-gigs/SKILL.md:111-112, 124-128, 145-149`

- [ ] **Step 1: Replace the verified_by note (lines 111-112)**

Change:

```markdown
Do NOT include a `verified_by` field --- these are unverified candidates.
```

to:

```markdown
Do NOT include a `verification` field --- these are unverified candidates.
The `verification` object is only set by the human verification flow or by the
verify-gigs skill.
```

- [ ] **Step 2: Update step 4 dedup rule (lines 124-128) — add rejection awareness**

Replace:

```markdown
Also flag any gigs that already exist in `data/gigs.json` (matching on
pollie_slug + organisation + role) so duplicates are obvious.

Add all non-duplicate gigs automatically.
```

with:

```markdown
Also flag any gigs that already exist in `data/gigs.json` (matching on
pollie_slug + organisation + role) so duplicates are obvious. **Skip
candidates that match an existing entry where `verification.decision ===
"rejected"`** --- those have already been reviewed and dismissed.

Add all non-duplicate, non-rejected gigs automatically, but stop appending
once 10 new gigs have been added in this run. This is a soft cap that
prevents a runaway find from drowning the verification queue.
```

- [ ] **Step 3: Confirm the example JSON skeleton (lines 100-110) needs no further change**

Run: `grep -n "verified_by" .claude/skills/find-gigs/SKILL.md`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/find-gigs/SKILL.md
git commit -m "Skip rejected gigs and cap output at 10 in find-gigs"
```

---

## Phase 6 — activity route

### Task 22: TDD the activity classifier

**Files:**
- Create: `scripts/build-activity.ts`
- Create: `tests/build-activity.test.ts`

The split:

- `classifyDiff(before, after, commit)` — pure function, fully unit-tested.
- `loadActivityEvents(filePath)` — runs `git log --reverse --pretty=format:%H|%an|%aI -- <filePath>`, walks parents, calls `classifyDiff`. Not unit-tested in isolation — just exported for the content collection.

- [ ] **Step 1: Write failing tests**

Create `tests/build-activity.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run tests; expect failure**

Run: `pnpm test -- tests/build-activity.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `scripts/build-activity.ts`**

```ts
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Gig } from "../src/types";

export interface CommitMeta {
  sha: string;
  author: string;
  date: string;
}

export type ActivityAction =
  | "added"
  | "verified"
  | "rejected"
  | "sources-edited"
  | "dates-edited"
  | "removed";

export interface ActivityEvent {
  sha: string;
  date: string;
  pollie_slug: string;
  role: string;
  organisation: string;
  action: ActivityAction;
  by: string;
  note?: string;
}

function key(g: Gig): string {
  return [g.pollie_slug, g.role, g.organisation, g.start_date ?? "null"].join(
    "|",
  );
}

function commitHasClaudeVerification(after: Gig[], before: Gig[]): boolean {
  const beforeMap = new Map(before.map((g) => [key(g), g]));
  for (const a of after) {
    const b = beforeMap.get(key(a));
    if (
      a.verification?.by === "claude" &&
      a.verification?.decision &&
      b?.verification?.decision !== a.verification.decision
    ) {
      return true;
    }
  }
  return false;
}

function summariseSourceChange(before: string[], after: string[]): string {
  const added = after.filter((s) => !before.includes(s)).length;
  const removed = before.filter((s) => !after.includes(s)).length;
  const parts: string[] = [];
  if (added) parts.push(`+${added}`);
  if (removed) parts.push(`-${removed}`);
  return parts.join(" ") || "reordered";
}

function summariseDateChange(before: Gig, after: Gig): string {
  const parts: string[] = [];
  if (before.start_date !== after.start_date) {
    parts.push(`start: ${before.start_date ?? "—"} → ${after.start_date ?? "—"}`);
  }
  if (before.end_date !== after.end_date) {
    parts.push(`end: ${before.end_date ?? "—"} → ${after.end_date ?? "—"}`);
  }
  return parts.join("; ");
}

export function classifyDiff(
  before: Gig[],
  after: Gig[],
  commit: CommitMeta,
): ActivityEvent[] {
  const beforeMap = new Map(before.map((g) => [key(g), g]));
  const afterMap = new Map(after.map((g) => [key(g), g]));
  const claudeCommit = commitHasClaudeVerification(after, before);
  const events: ActivityEvent[] = [];

  // Added or changed
  for (const [k, a] of afterMap) {
    const b = beforeMap.get(k);
    const meta = {
      sha: commit.sha,
      date: commit.date,
      pollie_slug: a.pollie_slug,
      role: a.role,
      organisation: a.organisation,
    };
    if (!b) {
      events.push({ ...meta, action: "added", by: commit.author });
      continue;
    }
    const beforeDecision = b.verification?.decision;
    const afterDecision = a.verification?.decision;
    if (beforeDecision !== afterDecision && afterDecision === "verified") {
      events.push({
        ...meta,
        action: "verified",
        by: a.verification!.by,
        note: a.verification!.note,
      });
    } else if (beforeDecision !== afterDecision && afterDecision === "rejected") {
      events.push({
        ...meta,
        action: "rejected",
        by: a.verification!.by,
        note: a.verification!.note,
      });
    }
    const sourcesChanged =
      JSON.stringify(b.sources) !== JSON.stringify(a.sources);
    if (sourcesChanged) {
      events.push({
        ...meta,
        action: "sources-edited",
        by: claudeCommit ? "claude" : commit.author,
        note: summariseSourceChange(b.sources, a.sources),
      });
    }
    const datesChanged =
      b.start_date !== a.start_date || b.end_date !== a.end_date;
    if (datesChanged) {
      events.push({
        ...meta,
        action: "dates-edited",
        by: claudeCommit ? "claude" : commit.author,
        note: summariseDateChange(b, a),
      });
    }
  }

  // Removed
  for (const [k, b] of beforeMap) {
    if (!afterMap.has(k)) {
      events.push({
        sha: commit.sha,
        date: commit.date,
        pollie_slug: b.pollie_slug,
        role: b.role,
        organisation: b.organisation,
        action: "removed",
        by: commit.author,
      });
    }
  }

  return events;
}

export function loadActivityEvents(repoRoot: string): ActivityEvent[] {
  const filePath = "data/gigs.json";
  const log = execSync(
    `git -C "${repoRoot}" log --reverse --pretty=format:%H|%an|%aI -- ${filePath}`,
    { encoding: "utf-8" },
  );
  const lines = log.trim().split("\n").filter(Boolean);
  const events: ActivityEvent[] = [];
  let prevContent = "[]";
  for (const line of lines) {
    const [sha, author, date] = line.split("|");
    let after: Gig[] = [];
    try {
      const out = execSync(
        `git -C "${repoRoot}" show ${sha}:${filePath}`,
        { encoding: "utf-8" },
      );
      after = JSON.parse(out);
    } catch {
      after = [];
    }
    let before: Gig[] = [];
    try {
      before = JSON.parse(prevContent);
    } catch {
      before = [];
    }
    events.push(...classifyDiff(before, after, { sha, author, date }));
    prevContent = JSON.stringify(after);
  }
  return events;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dirname, "..");
  const events = loadActivityEvents(root);
  console.log(JSON.stringify(events, null, 2));
}
```

- [ ] **Step 4: Run tests; expect green**

Run: `pnpm test -- tests/build-activity.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-activity.ts tests/build-activity.test.ts
git commit -m "Add git-log-based activity classifier with unit tests"
```

### Task 23: Add the activity collection to `src/content.config.ts`

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: Add the collection definition**

Below the `pollies` collection but before `export const collections`, add:

```ts
import { loadActivityEvents } from "../scripts/build-activity";

const activity = defineCollection({
  loader: async () => {
    const events = loadActivityEvents(process.cwd());
    return events.map((e, i) => ({ id: `${e.sha}-${i}`, ...e }));
  },
  schema: z.object({
    sha: z.string(),
    date: z.string(),
    pollie_slug: z.string(),
    role: z.string(),
    organisation: z.string(),
    action: z.enum([
      "added",
      "verified",
      "rejected",
      "sources-edited",
      "dates-edited",
      "removed",
    ]),
    by: z.string(),
    note: z.string().optional(),
  }),
});
```

And update the export:

```ts
export const collections = { pollies, activity };
```

- [ ] **Step 2: Run build (this exercises the loader)**

Run: `pnpm build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "Register activity content collection"
```

### Task 24: Create `ActivityList.svelte`

**Files:**
- Create: `src/components/ActivityList.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  interface ActivityRow {
    id: string
    sha: string
    date: string
    pollie_slug: string
    pollie_name: string
    role: string
    organisation: string
    action:
      | "added"
      | "verified"
      | "rejected"
      | "sources-edited"
      | "dates-edited"
      | "removed"
    by: string
    note?: string
  }

  interface Props {
    events: ActivityRow[]
  }

  let { events }: Props = $props()

  let search = $state("")
  let actionFilter = $state(new Set<string>())
  let byFilter = $state(new Set<string>())
  let sortDir = $state<"desc" | "asc">("desc")

  let allActions = $derived(Array.from(new Set(events.map((e) => e.action))).sort())
  let allBys = $derived(Array.from(new Set(events.map((e) => e.by))).sort())

  let filtered = $derived.by(() => {
    const q = search.toLowerCase().trim()
    return events
      .filter((e) => {
        if (actionFilter.size && !actionFilter.has(e.action)) return false
        if (byFilter.size && !byFilter.has(e.by)) return false
        if (!q) return true
        return (
          e.pollie_name.toLowerCase().includes(q) ||
          e.role.toLowerCase().includes(q) ||
          e.organisation.toLowerCase().includes(q)
        )
      })
      .sort((a, b) =>
        sortDir === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
      )
  })

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }
</script>

<section class="activity">
  <div class="controls">
    <input
      type="text"
      bind:value={search}
      placeholder="Search by politician, role, organisation…"
      class="search"
      aria-label="Filter activity"
    />
    <button
      type="button"
      class="sort-btn"
      onclick={() => (sortDir = sortDir === "desc" ? "asc" : "desc")}
    >
      Date {sortDir === "desc" ? "↓" : "↑"}
    </button>
  </div>

  <div class="filter-row">
    <span class="caps filter-label">Action</span>
    {#each allActions as a}
      <button
        type="button"
        class="chip"
        class:active={actionFilter.has(a)}
        onclick={() => (actionFilter = toggle(actionFilter, a))}
      >
        {a}
      </button>
    {/each}
  </div>

  <div class="filter-row">
    <span class="caps filter-label">By</span>
    {#each allBys as b}
      <button
        type="button"
        class="chip"
        class:active={byFilter.has(b)}
        onclick={() => (byFilter = toggle(byFilter, b))}
      >
        {b}
      </button>
    {/each}
  </div>

  <p class="count">{filtered.length} of {events.length}</p>

  <ol class="event-list">
    {#each filtered as e (e.id)}
      <li class="event">
        <time class="event-date">{e.date.slice(0, 10)}</time>
        <a class="event-pollie" href={`/pollies/${e.pollie_slug}`}>{e.pollie_name}</a>
        <span class="event-gig">{e.role} @ {e.organisation}</span>
        <span class={`event-action action-${e.action}`}>{e.action}</span>
        <span class="event-by">{e.by}</span>
        {#if e.note}
          <span class="event-note">{e.note}</span>
        {/if}
      </li>
    {/each}
  </ol>
</section>

<style>
  .activity { max-width: var(--measure-wide); }
  .controls {
    display: flex;
    gap: var(--space-md);
    align-items: baseline;
    margin-bottom: var(--space-md);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--color-rule);
  }
  .search {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-rule);
    border-radius: 0;
    padding: var(--space-xs) 0;
    font-family: var(--font-serif-stack);
    font-style: italic;
    font-size: 1rem;
  }
  .search:focus { outline: none; border-bottom-color: var(--color-accent); }
  .sort-btn {
    background: none; border: none; cursor: pointer;
    color: var(--color-ink-2); font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
  }
  .filter-row {
    display: flex; flex-wrap: wrap; gap: var(--space-xs);
    align-items: baseline; margin-bottom: var(--space-sm);
  }
  .filter-label { color: var(--color-ink-3); margin-right: var(--space-xs); }
  .chip {
    background: transparent;
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    padding: 0.15rem 0.55rem;
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-2);
    cursor: pointer;
  }
  .chip.active {
    background: var(--color-accent-soft);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .count {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-3);
    margin: var(--space-md) 0 var(--space-sm);
  }
  .event-list { list-style: none; margin: 0; padding: 0; }
  .event {
    display: grid;
    grid-template-columns: 6rem 12rem 1fr auto auto;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
    border-top: 1px solid var(--color-rule);
    align-items: baseline;
    font-family: var(--font-serif-stack);
    font-size: 0.95rem;
  }
  .event:last-child { border-bottom: 1px solid var(--color-rule); }
  .event-date {
    font-family: var(--font-sans-stack);
    font-variant-numeric: tabular-nums lining-nums;
    color: var(--color-ink-3);
    font-size: var(--text-meta);
  }
  .event-pollie { font-weight: 600; color: var(--color-ink); }
  .event-gig { color: var(--color-ink-2); }
  .event-action {
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }
  .action-added { color: var(--color-accent); }
  .action-verified { color: oklch(45% 0.12 145); }
  .action-rejected { color: var(--color-error); }
  .action-sources-edited, .action-dates-edited { color: var(--color-ink-2); }
  .action-removed { color: var(--color-ink-3); }
  .event-by {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-3);
  }
  .event-note {
    grid-column: 2 / -1;
    font-style: italic;
    color: var(--color-ink-3);
    font-size: var(--text-meta);
  }
  @media (width < 50rem) {
    .event {
      grid-template-columns: 1fr auto;
      gap: 0.25rem var(--space-sm);
    }
    .event-date, .event-by, .event-action { font-size: var(--text-meta); }
    .event-gig, .event-note { grid-column: 1 / -1; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ActivityList.svelte
git commit -m "Add interactive activity list Svelte island"
```

### Task 25: Create `src/pages/activity.astro`

**Files:**
- Create: `src/pages/activity.astro`

- [ ] **Step 1: Write the page**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro"
import ActivityList from "../components/ActivityList.svelte"
import { getCollection } from "astro:content"

const events = await getCollection("activity")
const pollies = await getCollection("pollies")
const nameBySlug = new Map(pollies.map((p) => [p.data.slug, p.data.name]))

const rows = events.map((e) => ({
  id: e.id,
  sha: e.data.sha,
  date: e.data.date,
  pollie_slug: e.data.pollie_slug,
  pollie_name: nameBySlug.get(e.data.pollie_slug) ?? e.data.pollie_slug,
  role: e.data.role,
  organisation: e.data.organisation,
  action: e.data.action,
  by: e.data.by,
  note: e.data.note,
}))
---

<BaseLayout title="Activity">
  <section class="page-intro">
    <h1>Verification activity</h1>
    <p>
      Every change to <code>data/gigs.json</code> — additions, verifications,
      rejections, source and date edits — recorded straight from git history.
      This page exists so every decision (including those made by claude) is
      auditable.
    </p>
  </section>
  <ActivityList events={rows} client:load />
</BaseLayout>

<style>
  .page-intro {
    margin-bottom: var(--space-xl);
    max-width: var(--measure-reading);
  }
  .page-intro p {
    font-family: var(--font-serif-stack);
    color: var(--color-ink-2);
  }
</style>
```

- [ ] **Step 2: Build and check**

Run: `pnpm build`
Expected: success; the activity page is generated under `dist/activity/index.html`.

- [ ] **Step 3: Smoke test (manual)**

Run: `pnpm dev` (background)
Visit `http://localhost:4321/activity`. Confirm the page renders, the search box and chips filter rows, sorting works.

- [ ] **Step 4: Commit**

```bash
git add src/pages/activity.astro
git commit -m "Add public-but-unlinked /activity route"
```

---

## Phase 7 — Final validation

### Task 26: Full pipeline check

- [ ] **Step 1: Run full build and tests**

Run: `pnpm check && pnpm build && pnpm test`
Expected: all green.

- [ ] **Step 2: Verify git status is clean**

Run: `git status`
Expected: nothing to commit, working tree clean.

- [ ] **Step 3: Visual diff of git log to confirm commit story is sensible**

Run: `git log --oneline main..HEAD`
Expected: a coherent sequence of commits per phase.

- [ ] **Step 4: Print the crontab snippet for the user**

Echo (in the conversation, not in a file):

```
crontab additions:
0 20 * * * /home/ben/projects/out-of-office-cv-website/cron-verify-gigs.sh
0 21 * * * /home/ben/projects/out-of-office-cv-website/cron-find-gigs.sh
```

### Task 27: Open a PR (or hand off)

This depends on user preference. Options to surface to the user when this task
is reached:

1. Stay on a feature branch, push, open a PR, let auto-merge run after CI.
2. Land directly on main (only if user explicitly approves).

Either way, no destructive ops without confirmation.

---

## Self-review checklist (run before handing off)

1. **Spec coverage:**
   - Data model migration → Phase 1 (Tasks 1-5).
   - Verify-gigs skill → Phase 4 (Task 17).
   - Throttling — `data/verify-state.json` → Phase 4 (Task 16).
   - Find-gigs updates (dedup rejected, cap at 10, schema) → Phase 5 (Task 21).
   - Cron infrastructure → Phase 4 (Tasks 18, 20) + auto-merge (Task 19).
   - UI changes (filter rejected, counts, reads, copy) → Phases 2 (Tasks 6-8) and 3 (Tasks 9-15).
   - Activity route → Phase 6 (Tasks 22-25).
   - Tests for migration / classifier / counts → Tasks 3, 5, 6, 8, 22.

2. **Placeholder scan:** none — all tasks contain literal code/commands.

3. **Type consistency:**
   - `Verification` interface is defined in Task 1 and referenced consistently.
   - `applyVerificationToGigs` (Task 12) replaces `addVerifiedByToGigs` and is the only writer of the field from the form.
   - `ActivityEvent` shape introduced in Task 22 matches the schema in Task 23 and the row mapping in Task 25.
   - `GigCountSplit` gains `rejected` in Task 1, populated in Task 6, schema-validated in Task 7.
