# Public unverified gigs + sorted verify UX

Date: 2026-04-13

## Background

The site currently hides any gig that lacks a `verified_by` field. Unverified
gigs sit in `data/gigs.json` until a human reviews them via the
`VerifyGigList` UI on `/contribute`. This design makes unverified gigs
publicly visible (clearly marked as such) and improves the verify UX so that
related gigs cluster together.

## Goals

- All gigs are listed publicly. Verified gigs sort ahead of unverified ones.
- Unverified gigs are visibly distinguished so readers understand the
  difference in provenance.
- A short explainer communicates what "verified" vs "unverified" means on
  pollie detail pages where it's relevant.
- The verify UX groups related gigs together by pollie and by source domain
  to make batch verification faster.

## Non-goals

- No change to how gigs are added, fetched, or validated at build time.
- No new "hidden" override field for suppressing individual unverified gigs.
- No change to how pollies are ordered on the index page.

## Design

### 1. Public gig list (`src/components/GigList.astro`)

- Remove the `verified_by` filter at line 11.
- Sort gigs two-tier:
  1. Primary: verified (has `verified_by`) before unverified.
  2. Secondary: by `end_date` descending, treating "present", "unknown", or
     missing as the latest possible value (so ongoing roles rise to the top
     of their group).
- Unverified gigs render with `opacity: 0.6` on the `<li class="gig-card">`
  and an inline `<span class="unverified-label">Unverified</span>` adjacent
  to the role or in the meta row.
- Empty-state copy triggers on zero total gigs (verified + unverified), not
  zero verified.
- Extract the sort into a pure helper in `src/utils/gigs.ts`
  (`sortGigsForDisplay`) so it can be unit tested.

### 2. `gigCount` on pollie list (`PollieList.svelte`, `content.config.ts`,
`src/utils/decade.ts`, `src/types.ts`)

- Replace `countVerifiedGigsByPollie` with `countGigsByPollie`, returning
  `Map<string, { verified: number; unverified: number }>`.
- Update the content collection schema and loader to store both counts per
  pollie: `gigCount: { verified: number; unverified: number }`.
- Update the `PollieListItem` / related types in `src/types.ts`.
- `PollieList.svelte` rendering:
  - If verified > 0 and unverified === 0 → `"N gigs"` (singular when N === 1).
  - If verified > 0 and unverified > 0 → `"N gigs (M unverified)"`.
  - If verified === 0 and unverified > 0 → `"M unverified"`.
  - If both 0 → render nothing (current behaviour).
- Anywhere else that reads `pollie.gigCount` as a number (e.g. search/filter
  logic, `[slug].astro`) is updated to use the verified count for prominence
  decisions.

### 3. Verification explainer (`src/components/VerificationNote.astro`)

New presentational component. Short (2-3 sentence) copy along the lines of:

> Gigs on this site come from public reporting, parliamentary records, and
> AI-assisted searches. Verified gigs have been human-reviewed against their
> sources; unverified gigs (shown faded and labelled) haven't been reviewed
> yet and may be inaccurate. Know of one we've missed or got wrong?
> [Help us verify](/contribute).

Rendered once on `src/pages/pollies/[slug].astro` above the `GigList`, only
when the pollie has at least one unverified gig.

### 4. Verify UX sort (`src/components/VerifyGigList.svelte`)

- Apply a pre-filter sort to `unverifiedGigs`:
  1. Primary: `pollie_slug` ascending.
  2. Secondary: hostname of `sources[0]` ascending (via existing
     `getHostname` helper).
- Extract into a pure helper (`sortGigsForVerification` in the same
  `src/utils/gigs.ts`) for testability.

### 5. Tests

- Update `tests/decade.test.ts` to cover `countGigsByPollie` returning the
  split shape.
- New `tests/gigs-sort.test.ts` covering:
  - `sortGigsForDisplay`: verified before unverified; within each group,
    ongoing/unknown end dates come first, then by end date descending.
  - `sortGigsForVerification`: pollie_slug primary, domain secondary;
    missing sources handled without throwing.
- Update `tests/gigs.test.ts` only if existing assertions conflict.

## Risk notes

Making unverified gigs public exposes possibly-wrong information. The opacity
treatment and inline label mitigate but don't eliminate this. Accepted.

## Files touched

- `src/components/GigList.astro` — remove filter, add sort + unverified
  styling.
- `src/components/PollieList.svelte` — new `gigCount` display logic.
- `src/components/VerifyGigList.svelte` — apply new sort before filter.
- `src/components/VerificationNote.astro` — new file.
- `src/pages/pollies/[slug].astro` — include `VerificationNote` when
  needed.
- `src/content.config.ts` — schema and loader updates.
- `src/utils/decade.ts` — rename/reshape count function.
- `src/utils/gigs.ts` — new file, sort helpers.
- `src/utils/index.ts` — re-export new utilities.
- `src/types.ts` — update `PollieListItem.gigCount` shape.
- `tests/decade.test.ts` — updated assertions.
- `tests/gigs-sort.test.ts` — new tests.
