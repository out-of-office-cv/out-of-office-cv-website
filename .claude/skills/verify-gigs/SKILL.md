---
name: verify-gigs
description:
  Investigates existing unverified gigs in data/gigs.json, confirms or rejects
  them via web research, and improves source quality. Use for periodic
  verification sweeps.
disable-model-invocation: true
model: sonnet
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task
---

# Verify post-parliamentary gigs

You are verifying existing unverified gigs in `data/gigs.json`. For each
candidate gig you investigate the original source, check it really refers to the
named former MP/Senator, and decide whether to mark it `verified`, `rejected`,
or leave it `unverified` for a human.

## Step 1: select a batch of gigs

Read in this order:

1. `data/pollies.csv` --- pollie metadata.
2. `data/gigs.json` --- all gigs.
3. `data/verify-state.json` --- per-gig verify history, keyed by gig key.

Build the eligible set:

- Key format: `<pollie_slug>|<role>|<organisation>|<start_date|null>` (use the
  literal string `null` if `start_date` is absent).
- `verify-state.json` maps each key to `{ last_examined_at: ISO, attempts: N }`.
  A bare ISO string is legacy shorthand for
  `{ last_examined_at: <string>, attempts: 1 }`; read it that way.
- A gig is _eligible_ only if ALL of these hold:
  - it has no `verification` field (verified and rejected gigs are done); AND
  - its key has fewer than 3 recorded `attempts`. After three passes that failed
    to confirm it, a gig is _exhausted_: stop spending runs on it. It stays
    visibly unverified on the site and becomes the human-review backlog; AND
  - its key is absent from `verify-state.json`, OR its `last_examined_at` is
    more than 7 days before today.

Group eligible gigs by `pollie_slug`. Sort pollies by eligible-gig-count
descending; tiebreak by pollie slug ascending. Accumulate pollies until the
running eligible-gig total would exceed 60, then stop.

Print the selection (pollie slug + count) before dispatching.

## Step 2: dispatch one subagent per pollie in parallel

Use the `Task` tool with `subagent_type: general-purpose` and `model: "sonnet"`
(the `sonnet` alias resolves to Sonnet 5). Per-pollie verification hinges on
identity disambiguation (is this the former MP, or a namesake?) and weighing
source authority --- judgement calls where a stronger model reduces the pile of
borderline `"unverified"` gigs. The conservative `"unverified"` default still
backstops anything genuinely ambiguous. Send all dispatches in a single message
so they run concurrently.

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
> - `"verified"` --- high confidence, to the standard where a Wikipedia claim
>   would not be flagged as needing a citation. ALL of: (1) at least one
>   authoritative source clearly refers to this specific former MP/Senator, not
>   a namesake; (2) that same source substantiates THIS role at THIS
>   organisation --- not merely that the person exists or had some other career;
>   (3) dates plausible (after they left parliament). In the `note`, name the
>   confirming source and quote or paraphrase the words that establish the role.
>   A bio that proves the person but never mentions this role is NOT enough ---
>   that is `"unverified"`.
> - `"rejected"` --- high confidence the gig is wrong. Includes: source refers
>   to a different person with the same name; the cited source is about someone
>   else entirely; the role or title contradicts what the source says; role
>   never happened; pre-parliament role mistakenly tagged as post-parliament. A
>   `note` explaining the rejection is required.
> - `"unverified"` --- anything else. Sources too weak, ambiguous identity, the
>   source confirms the person but not this specific role, dates uncertain, role
>   unclear. Default if you can't reach high confidence either way.

### Investigation method (verbatim in subagent prompt)

> Do not judge on the cited sources alone. For every gig:
>
> 1. WebFetch each cited source and check it actually names this person AND this
>    role at this organisation --- not just the person.
> 2. If the cited sources don't clearly confirm the role, run fresh targeted
>    searches for one that does: the organisation's own "about"/board/annual-
>    report page, Hansard, `.gov.au`/`.edu.au` pages, or reputable Australian
>    news. Many records were added with a source that proves the person but not
>    the role --- your job is to find the source that proves the role, or to
>    establish that none exists.
> 3. If you find a strong source, `"verified"` and add it via
>    `source_changes.add`. If a genuine hunt turns up nothing better,
>    `"unverified"` is correct --- but say in the `note` what you searched, so
>    the effort is on the record.

### Source authority hierarchy (verbatim in subagent prompt)

> - **Strong**: official organisation pages (`.gov.au`, `.edu.au`, corporate
>   "about"/annual reports), reputable Australian news (ABC, Guardian, AFR, SMH,
>   The Age), parliamentary records, Hansard.
> - **Acceptable supporting**: LinkedIn (paired with another source confirming
>   identity), industry-association bios.
> - **Weak alone**: passing mentions, listicles, partisan sites, social media.

### Source and date mutations (verbatim in subagent prompt)

> Applies to `verified` and `unverified` decisions (not `rejected` --- those are
> recorded as-is for the audit trail):
>
> - May append new sources discovered during investigation.
> - May remove dead/404 sources (test via WebFetch).
> - May replace a weak source with a strong one _if the weak one was the only
>   source about a same-named person_; explain in the note.
> - May correct `start_date` / `end_date` when contradicted by a strong source.
> - May NOT touch role, organisation, category, or pollie_slug.

### Required output schema

```ts
type Finding = {
  gig_index: number; // index in this subagent's input array
  decision: "verified" | "rejected" | "unverified";
  note?: string; // required if decision === "rejected"
  source_changes?: {
    add?: string[];
    remove?: string[]; // exact URLs from the original sources array
  };
  date_changes?: {
    start_date?: string | null; // null = remove
    end_date?: string | null;
  };
};

type SubagentOutput = {
  pollie_slug: string;
  findings: Finding[];
};
```

The subagent must return exactly one fenced JSON block matching
`SubagentOutput`.

## Step 3: collect findings

Wait for all subagent tasks to return. For each one:

- Parse the fenced JSON block.
- Validate against the schema above. Drop findings that fail validation; log
  which ones.
- A subagent that returns nothing parseable causes that pollie to be skipped,
  not the whole run aborted.

## Step 4: apply findings to data/gigs.json

Each finding's `gig_index` refers to the position in _that subagent's input
slice_ (the per-pollie eligible-gig list you passed in Step 2), NOT the position
in `data/gigs.json`. Before mutating, look up the corresponding gig in
`gigs.json` by its `(pollie_slug, role, organisation, start_date)` tuple and
mutate that entry. Never index into `gigs.json` by `gig_index` directly.

Single read-modify-write pass. For each finding:

- `verified` → set `gig.verification = { decision: "verified", by: "claude" }`.
  If the finding has a `note`, include it.
- `rejected` → set
  `gig.verification = { decision: "rejected", by: "claude", note: <note> }`.
  Drop findings where `note` is missing or empty.
- `unverified` → leave `verification` absent.
- For `verified` and `unverified`: apply `source_changes` (add new URLs, remove
  matching URLs); apply `date_changes` (set fields, or remove if null).
- Other fields untouched.

Write the file with `JSON.stringify(gigs, null, 2) + "\n"`.

## Step 5: update throttle state

For every gig that was investigated (regardless of decision), write its key in
`data/verify-state.json` as
`{ last_examined_at: <now ISO>, attempts: <previous attempts + 1> }`. A gig seen
for the first time gets `attempts: 1`; a bare-string legacy value counts as one
prior attempt. Preserve all other entries.

Gigs that a `verified` or `rejected` decision resolved this run no longer matter
for throttling (they now carry a `verification` field), but recording their
attempt is harmless. Gigs left `unverified` that this write pushes to
`attempts: 3` are now exhausted and won't be re-selected --- they are the ones
worth a human's eyes.

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

Then a totals line, and a count of gigs that reached `attempts: 3` this run and
are now exhausted (the human-review backlog).

## Important rules

- Do NOT touch role, organisation, category, or pollie_slug --- ever.
- Always supply a `note` for rejections. Findings without a note are dropped.
- Do not rerun against gigs that already have a `verification` field (those are
  filtered in Step 1's eligibility check; double-check before writing).
- Do not rerun against exhausted gigs (`attempts >= 3` and still unverified) ---
  they are also filtered in Step 1. A `verified`/`rejected` decision is the only
  thing that ever clears a gig; three unconfirmed passes park it for a human.
- Use Australian English in all communication.
