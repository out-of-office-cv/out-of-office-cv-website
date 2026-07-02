---
name: find-gigs
description:
  Searches the internet for post-parliamentary gigs/roles for Australian
  politicians and adds verified candidates to data/gigs.json. Use when finding
  new gigs, searching for politician jobs after parliament, or adding roles to
  the dataset.
disable-model-invocation: true
argument-hint: [pollie-slug or strategy]
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task
---

# Find post-parliamentary gigs

You orchestrate a search for jobs, roles, and positions that former Australian
politicians have taken after leaving parliament. Per-pollie web research happens
in parallel subagents; you handle selection, dedup, and write-back. Results land
in `data/gigs.json` for human verification.

## Step 1: select target politicians

Current pollie data: !`head -5 data/pollies.csv` Current gig count:
!`cat data/gigs.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"`

Read in this order:

1. `data/pollies.csv` --- pollie metadata.
2. `data/gigs.json` --- all gigs.
3. `data/find-state.json` --- `{slug: ISO-timestamp}` of last find attempts.
   Treat as `{}` if the file doesn't exist yet.

If `$ARGUMENTS` is a pollie slug (e.g. `christopher-pyne`), use that single
pollie and skip the eligibility check below.

Otherwise, build the eligible set:

- A pollie is _eligible_ if their slug is either absent from `find-state.json`
  or has a `last_searched_at` more than 14 days before today.
- Among eligible pollies, sort by current gig count (ascending) so those with
  fewer gigs are checked first. Among ties, randomise.
- Select up to 5 pollies.

The 5-pollie cap bounds the run; there's no separate gig cap.

Print the selection (slug + current gig count) before dispatching.

## Step 2: dispatch one subagent per pollie in parallel

Use the `Task` tool with `subagent_type: general-purpose` and `model: "sonnet"`
(per-pollie web search has a strict output shape and well-defined rules, so it
doesn't need Opus). Send all dispatches in a single message so they run
concurrently.

Each subagent prompt must include:

- The pollie record: name, party, electorate, house, ceased date, slug.
- The pollie's existing gigs (so the subagent can avoid re-discovering them ---
  soft signal only; you do authoritative dedup in Step 4).
- The search instructions below (verbatim).
- The role-naming rules below (verbatim).
- The category list below (verbatim).
- The required output schema.
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
> Every gig MUST have at least one source URL. It's fine if sources are weak
> (e.g. LinkedIn only, or a passing mention) or if some details like dates are
> missing --- that's the point of the human verification step. Err on inclusion.
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

## Step 3: collect findings

Wait for all subagent tasks to return. For each one:

- Parse the fenced JSON block.
- Validate against the schema. Drop entire subagent outputs that fail to parse;
  log which slugs were dropped.
- A subagent that returns nothing parseable causes that pollie to be skipped,
  not the whole run aborted.

Attach `pollie_slug` (from the wrapper) to each candidate before passing to
Step 4.

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

For all non-duplicate, non-rejected candidates:

1. Read the current `data/gigs.json`.
2. Append the new gigs to the array.
3. Write the updated array back (pretty-printed with 2-space indent, trailing
   newline).

## Step 6: update find-state.json

For every pollie that was searched (regardless of whether anything was found),
record `slug: <ISO-timestamp>` in `data/find-state.json`. Preserve existing
entries. Write with `JSON.stringify(state, null, 2) + "\n"`.

## Step 7: validate

Run `pnpm build`. If it fails, restore `data/gigs.json` and
`data/find-state.json` from git and abort.

## Step 8: print summary

Per pollie:

- Candidates returned: N
- Added: N
- Tier 1 skipped (hard duplicates): N
- Tier 2 flagged (possible duplicates): N

Then a totals line.

## Important rules

- Every gig MUST have at least one source URL. No exceptions.
- Only include roles taken AFTER the politician left parliament.
- Do not fabricate gigs or source URLs.
- Do NOT include a `verification` field --- these are unverified candidates. The
  `verification` object is only set by the human verification flow or by the
  verify-gigs skill.
- Do NOT commit the changes --- the calling script handles git operations.
- Use Australian English in all communication.
