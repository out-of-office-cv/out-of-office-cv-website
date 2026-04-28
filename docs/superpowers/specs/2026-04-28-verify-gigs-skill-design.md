# Verify-gigs skill — design

Design for a new skill and cron job that verifies existing unverified gigs in
`data/gigs.json` by spawning per-pollie subagents to investigate sources,
correct dates, and decide whether each gig is verified, rejected, or left
unverified for a human.

This document also covers the data-model migration to support a structured
verification field, a public verification-activity route, and adjustments to
the existing find-gigs cron job.

## Goals

- Catch up on the backlog of ~550 unverified gigs (across 139 pollies) without
  needing manual review of each one.
- Identify and reject gigs that are obviously wrong --- e.g. sources that
  refer to a different person with the same name.
- Improve source quality on weakly-cited gigs (Wikipedia "citation needed"
  heuristic).
- Keep find-gigs and verify-gigs as cleanly separated jobs with one
  responsibility each.
- Provide an auditable public record of every verification decision and
  source/date edit, including those made by claude.

## Non-goals

- Re-verifying gigs already verified by a human or by claude. Once a decision
  is recorded, this skill leaves the gig alone.
- Touching role, organisation, category, or pollie_slug. Those are judgment
  calls reserved for human reviewers.
- Adding a "human override" UI for claude's rejections. Rejections are hidden
  from the public site and verification queue; if claude over-rejects, that's
  visible on the activity page and the response is to fix the prompt.
- Real-time progress UI. The cron is fire-and-forget; outputs land via PR.

## Data model

`Gig` (`src/types.ts`) and the Zod schema (`data/gigs-schema.ts`) replace
`verified_by?: string` with a structured `verification` field:

```ts
type VerificationDecision = "verified" | "rejected"

interface Verification {
  decision: VerificationDecision
  by: string         // "ben", "khoi", "claude", or any future verifier
  note?: string      // optional in schema; required by prompt for rejections
}

interface Gig {
  // existing fields unchanged
  verification?: Verification
}
```

`GigCountSplit` gains a `rejected: number` bucket so the counts type can
represent all three states. The public UI uses only `verified` and
`unverified`; `rejected` is for the activity page and internal use.

### Migration

A one-shot migration runs in the same PR as the type change:

- `{ verified_by: "ben" }` → `{ verification: { decision: "verified", by: "ben" } }`
- `{ verified_by: "khoi" }` → `{ verification: { decision: "verified", by: "khoi" } }`
- `verified_by` absent → no `verification` field

All 663 existing entries get rewritten. The migration is idempotent (running
it again is a no-op).

### Touch list

- Types & schema: `src/types.ts`, `data/gigs-schema.ts`
- Data: `data/gigs.json` (all 663 entries)
- Loaders: `src/content.config.ts`, `src/loaders.ts`
- Utilities: `src/utils/gigs.ts`
- Astro components: `src/components/GigList.astro`,
  `src/components/VerificationNote.astro`,
  `src/pages/pollies/[slug].astro`
- Svelte components: `src/components/PollieList.svelte`,
  `src/components/GigEntryForm.svelte`,
  `src/components/VerifyGigList.svelte`
- Skills: `.claude/skills/find-gigs/SKILL.md`
- Tests: all fixtures and assertions referencing `verified_by`

## Skill: verify-gigs

A new skill at `.claude/skills/verify-gigs/SKILL.md`, parallel to find-gigs.

### Frontmatter

```yaml
---
name: verify-gigs
description: Investigates existing unverified gigs in data/gigs.json, confirms or rejects them via web research, and improves source quality. Use for periodic verification sweeps.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task
---
```

`Task` is the key addition --- the skill dispatches one subagent per pollie.

### Execution flow

1. **Select pollies.** Read `data/pollies.csv`, `data/gigs.json`, and
   `data/verify-state.json` (see [Throttling](#throttling) below). Build the
   set of *eligible* gigs: those without `verification` AND not examined by
   verify-gigs in the last 7 days. Group eligible gigs by pollie. Sort
   pollies by eligible-gig-count descending (drains the biggest backlogs
   first), tiebreak by pollie slug ascending (deterministic). Accumulate
   pollies until the running eligible-gig total would exceed 20, then stop.
   Subagents are grouped per pollie, so a run typically processes 15--25
   gigs across 4--7 subagents.

2. **Dispatch subagents in parallel.** One Task per selected pollie. Each
   subagent receives the pollie's metadata (name, party, electorate, dates in
   parliament), the full unverified-gig records for that pollie, the decision
   rules below, and the structured-output schema it must return.

3. **Collect findings.** Each subagent returns a JSON object with one entry
   per gig it investigated. The orchestrator validates the response against
   a Zod schema. Findings that fail validation are dropped and logged. A
   subagent that returns nothing parseable causes that pollie to be skipped,
   not the whole run aborted.

4. **Apply findings to `data/gigs.json`.** Single read-modify-write pass:
   - `verified` → set `verification: { decision: "verified", by: "claude", note? }`
   - `rejected` → set `verification: { decision: "rejected", by: "claude", note }`
     (note required; orchestrator drops findings missing a note for
     rejections)
   - `unverified` → apply source/date edits if any
   - Other fields untouched

5. **Update throttle state.** Write `data/verify-state.json` recording
   `last_examined_at` for every gig that was investigated this run,
   regardless of decision. This file is committed alongside `gigs.json`
   changes (see [Throttling](#throttling)).

6. **Validate.** Run `pnpm build && pnpm test`. If either fails, abort
   without writing.

7. **Print summary.** Verified / rejected / edited counts per pollie.

The cron script wraps this with git/PR plumbing.

### Throttling

`data/verify-state.json` is a small side file tracking when each gig was last
examined by verify-gigs:

```json
{
  "<pollie_slug>|<role>|<organisation>|<start_date|null>": "2026-04-28T20:15:00Z",
  ...
}
```

The composite key matches the same `(pollie_slug, role, organisation,
start_date)` tuple used by find-gigs for dedup. A gig is *eligible* for a
verify-gigs run if it has no `verification` field AND its key is either
absent from `verify-state.json` or has a `last_examined_at` more than 7 days
old.

The file is committed in the same PR as the corresponding `gigs.json`
changes. The auto-merge workflow's `paths` filter is updated to include it
so it doesn't block merging.

The 7-day window is a soft default; tunable later if find-gigs throughput
changes.

### Subagent prompt

Each subagent receives roughly:

> You are investigating post-parliamentary gigs for `{name}` ({party},
> {electorate}, in parliament {entered}--{ceased}). Below are unverified gigs
> from our dataset. For each gig: confirm it really refers to this person
> (not a same-named individual); check the role, organisation, dates, and
> category against authoritative sources; find better sources where possible.
>
> For each gig, return one of three decisions:
>
> - `"verified"` --- high confidence (Wikipedia "would not need [citation
>   needed]" standard). All of: (1) at least one authoritative source clearly
>   refers to this specific former MP/Senator (not a namesake); (2) role and
>   organisation match; (3) dates plausible (after they left parliament).
> - `"rejected"` --- high confidence the gig is wrong. Includes: source
>   refers to a different person with the same name; role doesn't exist /
>   never happened; pre-parliament role mistakenly tagged as
>   post-parliament. A `note` explaining the rejection is required.
> - `"unverified"` --- anything else. Sources too weak, ambiguous identity,
>   dates uncertain, role unclear. Default if you can't reach high confidence
>   either way.

#### Source authority hierarchy

- **Strong**: official organisation pages (`.gov.au`, `.edu.au`, corporate
  "about" / annual reports), reputable Australian news (ABC, Guardian, AFR,
  SMH, The Age), parliamentary records, Hansard.
- **Acceptable supporting**: LinkedIn (when paired with another source
  confirming identity), industry-association bios.
- **Weak alone**: passing mentions, listicles, partisan sites, social media.

#### Source and date mutations

Applies to `verified` and `unverified` decisions alike (not `rejected` ---
those are recorded as-is for the audit trail):

- May append new sources discovered during investigation.
- May remove dead/404 sources (tested via WebFetch).
- May replace a weak source with a strong one *if the weak one was the only
  source about a same-named person* --- the agent must explain in the note.
- May correct `start_date` / `end_date` when contradicted by a strong source.
- May NOT touch role, organisation, category, pollie_slug.

#### Output schema

```ts
type Finding = {
  gig_index: number          // index in the original input array
  decision: "verified" | "rejected" | "unverified"
  note?: string              // required if decision === "rejected"
  source_changes?: {
    add?: string[]
    remove?: string[]        // exact URLs from original sources
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

## UI changes

### Filtering rejected gigs

Rejected gigs are filtered out at the loader level
(`src/content.config.ts`) so no public component sees them. They remain in
`data/gigs.json` for find-gigs dedup memory and surface only on the
verification activity page.

### Counts

`GigCountSplit` gains `rejected: number`. `countGigsByPollie`
(`src/utils/gigs.ts`) populates all three buckets. The public UI continues to
display only verified and unverified.

### Reads through the verification field

Anywhere the codebase truthy-checks `gig.verified_by`, the new shape is
`gig.verification?.decision === "verified"`. Anywhere the verifier name is
shown, reads now go through `gig.verification?.by`.

Mechanical updates:

- `src/components/GigList.astro:45-52`
- `src/pages/pollies/[slug].astro:22`
- `src/components/PollieList.svelte:258-272`
- `src/utils/gigs.ts:7-10,34-35`
- `src/components/GigEntryForm.svelte:35,89`
- `src/components/VerifyGigList.svelte`

### VerificationNote copy

`src/components/VerificationNote.astro` copy refresh: mention that
verification is performed by humans *and* by an automated AI checker, and
that unverified entries are awaiting review. One paragraph; existing layout
and styling unchanged.

### No new visual treatment for claude-verified gigs

Claude-verified gigs render identically to human-verified gigs on public
pages. The verifier identity appears only on the activity page and inside
the contribute form's verification queue. A future change can add a "verified
by claude" subtitle if desired.

### Contribute form

`GigEntryForm.svelte` writes verification as
`{ decision: "verified", by: verifier }`. It reads "is this gig unverified"
as `!g.verification`. Rejected gigs never reach the form because they're
filtered at the loader. No new "I disagree with claude's rejection"
affordance.

## Verification activity route

A new public-but-unlinked route at `src/pages/activity.astro` listing every
change to `data/gigs.json` --- additions, verifications, rejections,
source/date edits --- regardless of who or what made the change.

### Data source

Built at compile time from `git log` on `data/gigs.json`. A new
`scripts/build-activity.ts` walks `git log --reverse data/gigs.json`, diffs
each commit against its parent, and emits structured events keyed by
`(pollie_slug, role, organisation, start_date)`:

- `added` --- gig appears in the new state but not the old
- `verified` / `rejected` --- `verification.decision` transitions to a
  defined value
- `sources-edited` --- any change to the `sources` array
- `dates-edited` --- any change to `start_date` or `end_date`
- `removed` --- gig disappears entirely (rare)

Output is consumed by an Astro content collection alongside pollies.

### Page

`src/pages/activity.astro` is public but not linked from the nav. Renders
one row per event:

- Date (commit timestamp)
- Pollie (linked to `/pollies/[slug]`)
- Gig (role @ organisation)
- Action: `added` / `verified` / `rejected` / `sources-edited` /
  `dates-edited` / `removed`
- By: commit author for added/manual edits; `verification.by` for
  verify/reject events; "claude" for claude-side source/date edits
- Note: rejection note, or a short summary like "+2 sources, -1 dead link"

### Interactivity

A Svelte 5 island, similar pattern to `PollieList.svelte`:

- Sort: date desc (default) / asc
- Filter: by action (multi-select), by verifier (multi-select), by pollie
  (combobox)
- Free-text search: matches pollie name, role, or organisation

### Visibility of rejected gigs

This is the only public surface where rejected gigs appear. That's by
design --- the page exists for auditability of all decisions, including
rejections.

### Tests

Synthetic git-history fixtures asserting that the event classifier produces
the correct events for each diff shape (additions, decision transitions,
source-only edits, date-only edits, removals).

## Cron infrastructure

### `cron-verify-gigs.sh`

Sibling to `cron-find-gigs.sh`, same skeleton: checkout main, hard reset,
pull, run `claude -p "/verify-gigs" --effort max`, then if `data/gigs.json`
or `data/verify-state.json` changed, branch off as
`verify-gigs-YYYYMMDD-HHMMSS`, commit, push, open a PR. Title/body
summarise verified / rejected / edited counts per pollie (Python heredoc,
similar pattern to find-gigs). The throttle file changes every run, so
this branch always opens a PR --- which is fine, since auto-merge handles
no-decision-change runs cleanly.

### Crontab

```
0 20 * * * /home/ben/projects/out-of-office-cv-website/cron-verify-gigs.sh
0 21 * * * /home/ben/projects/out-of-office-cv-website/cron-find-gigs.sh
```

Verify-gigs at 8pm local; find-gigs moves from 3am to 9pm local. System runs
in `Australia/Canberra` so DST is handled by the OS.

### Auto-merge

The existing `auto-merge-gig-prs.yml` workflow triggers on PRs touching
`data/gigs.json` from collaborators. Update its `paths` filter to also
include `data/verify-state.json`, so a verify-gigs run that only updates
the throttle file (no decisions changed) still auto-merges. The existing
`pnpm test` step still validates `gigs.json`.

## find-gigs updates

Three changes to `.claude/skills/find-gigs/SKILL.md`:

1. **Dedup against rejected gigs.** Step 4 currently dedups candidates
   against existing entries by `(pollie_slug, organisation, role)`. Add: also
   skip candidates matching an existing entry where
   `verification?.decision === "rejected"` --- those have been reviewed and
   dismissed.
2. **Cap output at 10 new gigs per run.** The selection heuristic is
   unchanged (fewest-gigs-first, per the existing skill); the termination
   condition shifts from "up to 5 politicians" to "stop adding new gigs once
   10 have been appended". Soft cap; protects against a runaway run finding
   30 weak candidates.
3. **Schema reference.** Replace any `verified_by` mentions with the new
   `verification` shape; the example JSON skeleton continues to omit
   `verification` since these are unverified candidates.

## Testing strategy

- **Schema migration**: `tests/gigs.test.ts` updated to assert the new
  `verification` shape and reject the old `verified_by` shape.
- **Loader filtering**: new test asserts rejected gigs don't reach the
  collection.
- **Counts**: `tests/gigs-sort.test.ts` asserts the three-bucket
  `GigCountSplit`.
- **Components**: existing tests updated for the new field; integration
  tests for `[slug].astro` and `PollieList.svelte` confirm rejected gigs
  don't render.
- **Activity classifier**: synthetic git fixtures cover each event shape.
- **Verify-gigs orchestrator**: unit tests for finding validation and
  application against in-memory `gigs.json`.

`pnpm test` runs in CI via `auto-merge-gig-prs.yml`, so a malformed
verify-gigs PR can't auto-merge.

## Open questions

None at design time. Items deferred for future iteration:

- Human override UI for claude rejections (Q4 option b).
- "Verified by claude" subtitle on public pages.
- Re-verification of claude-verified gigs (e.g. periodic source-rot check).
