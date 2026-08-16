---
name: find-gigs
description:
  Searches the internet for post-parliamentary gigs/roles for Australian
  politicians and adds verified candidates to data/gigs.json. Use when finding
  new gigs, searching for politician jobs after parliament, or adding roles to
  the dataset.
disable-model-invocation: true
argument-hint: [pollie-slug or strategy]
model: sonnet
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task
---

# Find post-parliamentary gigs

You orchestrate a search for jobs, roles, and positions that former Australian
politicians have taken after leaving parliament. Per-pollie web research happens
in parallel subagents; you handle selection, dedup, and write-back. Each
subagent banks its own findings in `data/.find-inflight/<slug>.json` first, so a
run that stops early loses at most the pollies still in flight. Results land in
`data/gigs.json` for human verification.

## Step 0: merge leftover sidecars

`data/.find-inflight/` holds one JSON file per pollie whose research finished but
whose findings had not been merged when a run stopped. The directory is
untracked, so those files are still there on the next run.

If any are present, merge them now, before selection: Steps 3 to 5 handle them
exactly as they handle a sidecar written this run. Doing it first is what stops
those pollies being picked and researched a second time, since merging is what
records them in `find-state.json`.

If the directory is missing or empty, carry on.

## Step 1: select target politicians

Read in this order:

1. `data/pollies.csv` --- pollie metadata.
2. `data/gigs.json` --- all gigs.
3. `data/find-state.json` --- `{slug: ISO-timestamp}` of last find attempts.
   Treat as `{}` if the file doesn't exist yet.

If the invocation supplied a pollie slug (e.g. `/find-gigs christopher-pyne`),
use that single pollie and skip the eligibility check below. Read it off the
invocation line as given: do not expect it to have been substituted into this
file.

Otherwise, build the eligible set:

- A pollie is _eligible_ if their slug is either absent from `find-state.json`
  or has a `last_searched_at` more than 14 days before today.
- Put pollies who have never been searched (absent from `find-state.json`)
  ahead of those merely due a re-search. Most of the roster has never been
  searched, and treating both groups alike means a run spends most of its
  budget re-searching pollies who already came up empty.
- Within each group, sort by current gig count (ascending) so those with fewer
  gigs are checked first. Among ties, randomise.
- Select up to 15 pollies.

The 15-pollie cap bounds the run; there's no separate gig cap.

Print the selection (slug + current gig count) before dispatching.

## Step 2: dispatch one subagent per pollie in parallel

Use the `Task` tool with `subagent_type: general-purpose` and `model: "sonnet"`
(the `sonnet` alias resolves to Sonnet 5). Per-pollie web search has a strict
output shape and well-defined rules, so it doesn't need Opus. Send all
dispatches in a single message so they run concurrently.

Each subagent prompt must include:

- The pollie record: name, party, electorate, house, ceased date, slug.
- The pollie's existing gigs (so the subagent can avoid re-discovering them ---
  soft signal only; you do authoritative dedup in Step 4).
- The search instructions below (verbatim).
- The role-naming rules below (verbatim).
- The category list below (verbatim).
- The required output schema.
- An instruction to write its result to `data/.find-inflight/<pollie_slug>.json`
  (creating the directory if needed) as its last action before returning, and to
  return that same JSON in a single fenced block. The file is what survives an
  interrupted run; the returned block is only a fallback for a subagent that
  died before writing.
- An instruction to return only valid JSON in a single fenced block.

### Search instructions (verbatim in subagent prompt)

> Conduct a thorough web search using multiple query patterns:
>
> 1. `"[Name]" former politician board director appointment`
> 2. `"[Name]" after parliament consulting advisory role`
> 3. `"[Name]" [party] [state] new role position`
> 4. `"[Name]" company board OR director OR chair OR advisor`
> 5. Site-specific: `site:linkedin.com "[Name]"`, `site:afr.com "[Name]"`
>
> Look for ALL types of post-parliamentary roles:
>
> - Board positions (director, chair, advisory board member)
> - Consulting or lobbying work
> - Academic positions (professor, fellow, visiting scholar)
> - Corporate roles (CEO, executive, advisor)
> - Nonprofit or charity work
> - Government appointments (ambassador, commissioner)
> - Media roles (columnist, commentator, presenter)
> - Industry association roles
>
> For each potential gig, use WebFetch to visit the source page and confirm:
>
> - The person is indeed the former politician (not a namesake).
> - The role was taken AFTER leaving parliament.
> - The source URL actually confirms the role.
>
> **What counts as a gig.** A gig is a _position held over time_: a board seat,
> a standing column, a professorship, an appointment, an executive or advisory
> role. A one-off act is not a gig, however well sourced --- a single opinion
> piece, one conference talk, a one-time award, a single quoted comment. If the
> evidence shows the person doing something once, there is no gig to add.
>
> **The source must state the role.** At least one source has to say, in its own
> words, that this person holds or held this position. A source that merely
> shows them doing the activity does not establish a role: three bylined
> articles are not evidence of the title "Columnist" unless something says they
> write a column. Quote the sentence that states it --- see `role_evidence` in
> the output schema. If you cannot quote one, do not return the candidate.
>
> **Self-published sources.** The person's own LinkedIn _profile_ is fine
> evidence of their own roles. Their own LinkedIn _posts_, X, or personal blog
> are not, when they are the only evidence: those show activity, not
> appointment. Pair them with something independent, or drop the candidate.
>
> **Obituaries and vale pieces** are good evidence for roles they explicitly
> name, and no evidence at all for roles you infer from them.
>
> Missing dates are still fine --- omit `start_date` rather than guessing. It is
> role existence that has to be evidenced, not its detail.
>
> Prefer precision over coverage. A wrong gig goes onto a public site and costs
> a human a verification pass to remove; a missed gig is picked up next sweep.
> Do NOT fabricate gigs or source URLs. If your search turns up nothing, return
> an empty `candidates` array rather than making things up.

### Role-naming rules (verbatim in subagent prompt)

> To keep the dataset consistent and reduce accidental duplicates across runs:
>
> - **Expand acronyms** to their canonical full form. Write
>   `Chief Executive Officer` not `CEO`, `Chief Financial Officer` not `CFO`,
>   `Chief Operating Officer` not `COO`, `Non-Executive Director` not `NED`,
>   `Australian Broadcasting Corporation` not `ABC` (in the organisation field),
>   and so on. If the source uses an acronym, expand it before storing.
> - **Use Australian English** spellings (`organisation`, not `organization`).
> - **Strip leading articles** ("The", "A") from organisation names unless
>   they're part of a registered legal name.
> - **Drop redundant qualifiers** that don't change the role's identity: prefer
>   `Director` over `Board Director` (a director is by definition on the board);
>   prefer `Chair` over `Chairperson` / `Chairman` / `Chairwoman`.

### Categories (verbatim in subagent prompt)

> Each gig must use one of these exact categories:
>
> - Natural Resources (Mining, Oil & Gas)
> - Energy (Renewables & Traditional)
> - Agriculture, Forestry & Fisheries
> - Environment, Climate & Sustainability
> - Health, Medical & Aged Care
> - Pharmaceutical & Biotechnology
> - Education, Academia & Research
> - Government, Public Administration & Civil Service
> - Diplomacy & International Relations
> - Politics, Campaigning & Party Operations
> - Defence & Military and Security
> - Nonprofit, NGO and Charity
> - Legal & Judicial
> - Professional Services & Management Consulting
> - Financial Services and Banking
> - Technology (Software, IT & Digital Services)
> - Telecommunications & Network Infrastructure
> - Media, Communications & Public Relations
> - Gambling, Gaming and Racing
> - Retail, Hospitality & Tourism
> - Arts, Culture & Sport
> - Science, Engineering & Technical Professions
> - Retired

### Required output schema

```ts
type Candidate = {
  role: string;
  organisation: string;
  category: string; // one of the categories listed above
  sources: string[]; // at least one URL
  role_evidence: {
    url: string; // which source, must be one of `sources`
    quote: string; // sentence from that page stating the person holds the role
  };
  start_date?: string; // YYYY-MM-DD if known, omit otherwise
  end_date?: string; // YYYY-MM-DD if known, omit otherwise
};

type SubagentOutput = {
  pollie_slug: string;
  candidates: Candidate[]; // empty array if nothing found
};
```

The subagent must return exactly one fenced JSON block matching
`SubagentOutput`. Do NOT include a `verification` field --- these are unverified
candidates.

`role_evidence.quote` must be copied from the page, not paraphrased or composed.
It is what Step 3a checks, and a candidate that cannot supply one does not
belong in the output.

## Step 3: collect findings

Wait for all subagent tasks to return. Then, for each pollie dispatched this run
and each leftover sidecar found in Step 0:

- Read `data/.find-inflight/<slug>.json`. Fall back to the subagent's returned
  fenced JSON block only when the sidecar is missing.
- Parse the JSON.
- Validate against the schema. Drop entire subagent outputs that fail to parse;
  log which slugs were dropped.
- A subagent that returns nothing parseable causes that pollie to be skipped,
  not the whole run aborted.

Attach `pollie_slug` (from the wrapper) to each candidate before passing to
Step 4.

## Step 3a: evidence screen

Before deduplicating, drop any candidate that fails the bar the subagents were
given. Judge from `role_evidence` and `sources`, not from how plausible the gig
sounds:

- **No usable evidence.** `role_evidence` missing, `quote` empty, or `url` not
  present in `sources`.
- **Quote does not state a role.** It describes an action, an opinion or an
  event rather than a position held: an op-ed byline, "spoke at", "wrote in",
  "was awarded". A quote naming the position ("was appointed a director of",
  "chairs the board of", "writes a weekly column for") passes.
- **Self-published only.** Every source is the person's own posting on a social
  platform or personal site, and none is a profile page listing the role.
- **One-off act.** The evidence covers a single dated occurrence and nothing
  suggests an ongoing position.

Print a "Screened out" section listing each drop with its pollie, role,
organisation and which rule caught it. Those lines go into the cron log, and are
how a bar that is too tight gets noticed --- if a run screens out most of what
it found, say so in the summary rather than silently shrinking.

Screening is not dedup: a screened candidate is discarded, not flagged.

## Step 4: orchestrator dedup (tiered)

For each candidate, compare against every existing gig in `data/gigs.json` with
the same `pollie_slug`. Apply the strongest signal that matches:

**Tier 1 --- hard skip (do not add).** Almost certainly the same gig as an
existing entry:

- Same organisation AND any source URL appears in both gigs (exact URL match).
- Same organisation AND the role matches after normalisation. Normalisation:
  lowercase, expand common acronyms (`ceo` ↔ `chief executive officer`, `cfo` ↔
  `chief financial officer`, `coo` ↔ `chief operating officer`, `ned` ↔
  `non-executive director`), strip leading qualifiers (`board`, `senior`,
  `acting`, `interim`, `deputy`), and treat `chair` / `chairperson` / `chairman`
  / `chairwoman` as equivalent.
- Same organisation AND same `start_date` (or both missing a `start_date` but
  the start year inferred from sources is the same).

**Tier 2 --- flag for human review (still add, but list under "Possible
duplicates" in the run summary).** A weaker signal worth a sanity-check:

- Same organisation AND any source domain (e.g. `foodbank.org.au`) appears in
  both gigs, even if the URL paths differ.
- Same organisation AND the role is unrelated/different on its face (e.g. pollie
  was Director then later Chair) --- usually a legitimate second gig, but worth
  confirming it isn't a re-announcement of the same role.

**Tier 3 --- skip silently.** An existing entry has
`verification.decision === "rejected"` --- already reviewed and dismissed; do
not re-add even if the role/organisation match.

Print a clear "Duplicate report" section listing every Tier 1 skip and every
Tier 2 flag with the reason and the existing-gig key (`role @ organisation`).
This goes into the cron log, where the human reviewer can find it when triaging
the PR.

## Step 5: write to data file

`data/find-state.json` is untracked, so git cannot restore it if validation
fails later. Copy it to `data/find-state.json.bak` before writing anything.

Merge one pollie at a time, finishing each completely before starting the next,
so a run that stops midway leaves whole pollies done rather than losing
everything. For each pollie in turn:

1. Read the current `data/gigs.json`.
2. Append that pollie's non-duplicate, non-rejected candidates.
3. Write the updated array back (pretty-printed with 2-space indent, trailing
   newline).
4. Record `slug: <ISO-timestamp>` in `data/find-state.json`, whether or not
   anything was found for them. Preserve existing entries. Write with
   `JSON.stringify(state, null, 2) + "\n"`.

Leave the sidecars in place until Step 6 has passed.

## Step 6: validate

Run `pnpm build`.

If it passes, delete every sidecar merged in Step 5 and the
`data/find-state.json.bak` backup.

If it fails, restore `data/gigs.json` with `git checkout -- data/gigs.json` and
`data/find-state.json` from the backup, leave the sidecars where they are so the
next run can retry them, and abort.

## Step 7: print summary

Per pollie:

- Candidates returned: N
- Screened out on evidence (Step 3a): N
- Added: N
- Tier 1 skipped (hard duplicates): N
- Tier 2 flagged (possible duplicates): N

Then a totals line. If screened-out exceeds added across the run, say so
explicitly --- either the bar is mis-tuned or the subagents are not reading it.

## Important rules

- Every gig MUST have at least one source URL. No exceptions.
- Every candidate MUST carry a quoted `role_evidence` that states the role, and
  is dropped in Step 3a if it does not. A position held, never a one-off act.
- Only include roles taken AFTER the politician left parliament.
- Do not fabricate gigs or source URLs.
- Do NOT include a `verification` field --- these are unverified candidates. The
  `verification` object is only set by the human verification flow or by the
  verify-gigs skill.
- Do NOT commit the changes --- the calling script handles git operations.
- Use Australian English in all communication.
