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

1. `data/pollies.csv` --- pollie metadata.
2. `data/gigs.json` --- all gigs.
3. `data/verify-state.json` --- `{key: ISO-timestamp}` of last verify attempts.

Build the eligible set:

- A gig is *eligible* if it has no `verification` field AND its key is either
  absent from `verify-state.json` or has a `last_examined_at` more than 7 days
  before today.
- Key format: `<pollie_slug>|<role>|<organisation>|<start_date|null>` (use the
  literal string `null` if `start_date` is absent).

Group eligible gigs by `pollie_slug`. Sort pollies by eligible-gig-count
descending; tiebreak by pollie slug ascending. Accumulate pollies until the
running eligible-gig total would exceed 20, then stop. A run typically picks
4--7 pollies covering 15--25 gigs.

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
> - `"verified"` --- high confidence (Wikipedia "would not need [citation
>   needed]" standard). All of: (1) at least one authoritative source clearly
>   refers to this specific former MP/Senator (not a namesake); (2) role and
>   organisation match; (3) dates plausible (after they left parliament).
> - `"rejected"` --- high confidence the gig is wrong. Includes: source
>   refers to a different person with the same name; role doesn't exist or
>   never happened; pre-parliament role mistakenly tagged as
>   post-parliament. A `note` explaining the rejection is required.
> - `"unverified"` --- anything else. Sources too weak, ambiguous identity,
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

> Applies to `verified` and `unverified` decisions (not `rejected` --- those
> are recorded as-is for the audit trail):
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

Each finding's `gig_index` refers to the position in *that subagent's input
slice* (the per-pollie eligible-gig list you passed in Step 2), NOT the
position in `data/gigs.json`. Before mutating, look up the corresponding gig
in `gigs.json` by its `(pollie_slug, role, organisation, start_date)` tuple
and mutate that entry. Never index into `gigs.json` by `gig_index` directly.

Single read-modify-write pass. For each finding:

- `verified` → set
  `gig.verification = { decision: "verified", by: "claude" }`. If the finding
  has a `note`, include it.
- `rejected` → set
  `gig.verification = { decision: "rejected", by: "claude", note: <note> }`.
  Drop findings where `note` is missing or empty.
- `unverified` → leave `verification` absent.
- For `verified` and `unverified`: apply `source_changes` (add new URLs,
  remove matching URLs); apply `date_changes` (set fields, or remove if
  null).
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

- Do NOT touch role, organisation, category, or pollie_slug --- ever.
- Always supply a `note` for rejections. Findings without a note are dropped.
- Do not rerun against gigs that already have a `verification` field (those
  are filtered in Step 1's eligibility check; double-check before writing).
- Use Australian English in all communication.
