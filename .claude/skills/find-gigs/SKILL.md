---
name: find-gigs
description: Searches the internet for post-parliamentary gigs/roles for Australian politicians and adds verified candidates to data/gigs.json. Use when finding new gigs, searching for politician jobs after parliament, or adding roles to the dataset.
disable-model-invocation: true
argument-hint: [pollie-slug or strategy]
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
---

# Find post-parliamentary gigs

**Non-interactive mode:** When there is no interactive user (e.g. running from a
cron job):

1. Skip ALL confirmations---do not ask questions or wait for input at any step
2. The calling script handles git pull, commit, push, and PR creation---just
   write to the data file and verify the build

You are searching the internet for jobs, roles, and positions that former
Australian politicians have taken after leaving parliament. Results will be
added to `data/gigs.json` for human verification.

## Step 1: select target politicians

Current pollie data: !`head -5 data/pollies.csv`
Current gig count: !`cat data/gigs.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"`

If `$ARGUMENTS` is a pollie slug (e.g. `christopher-pyne`), search for that
specific politician.

If `$ARGUMENTS` is a strategy name (`recent-no-gigs`, `recent-few-gigs`,
`random`), use that to select candidates.

If no arguments, pick candidates using the default heuristic described below.

### Selection heuristic

The goal is to find new gigs for any pollie, including those who already have
gigs listed (they may have taken on new roles). Search broadly and rely on
duplicate detection to avoid re-adding existing entries.

Prioritise those who:

1. have no gigs listed at all
2. left parliament recently (more likely to have findable news coverage)
3. haven't been searched recently --- spread coverage across all pollies over time

To select candidates:

1. Read `data/pollies.csv` and `data/gigs.json`.
2. Select up to 3 politicians to search for (or just the one if a slug was
   given), using the priorities above.
3. Show the user who you've selected and ask for confirmation before searching.

## Step 2: search the internet

For each selected politician, conduct a thorough web search. Use multiple search
queries to maximise coverage:

1. `"[Name]" former politician board director appointment`
2. `"[Name]" after parliament consulting advisory role`
3. `"[Name]" [party] [state] new role position`
4. `"[Name]" company board OR director OR chair OR advisor`
5. Site-specific: `site:linkedin.com "[Name]"`, `site:afr.com "[Name]"`

Look for ALL types of post-parliamentary roles:

- Board positions (director, chair, advisory board member)
- Consulting or lobbying work
- Academic positions (professor, fellow, visiting scholar)
- Corporate roles (CEO, executive, advisor)
- Nonprofit or charity work
- Government appointments (ambassador, commissioner)
- Media roles (columnist, commentator, presenter)
- Industry association roles

For each potential gig found, use WebFetch to visit the source page and confirm
the details. Verify:

- The person is indeed the former politician (not someone with the same name)
- The role was taken AFTER leaving parliament
- The source URL actually confirms the role

## Step 3: categorise and format results

Each gig must use one of these exact categories:

- Natural Resources (Mining, Oil & Gas)
- Energy (Renewables & Traditional)
- Agriculture, Forestry & Fisheries
- Environment, Climate & Sustainability
- Health, Medical & Aged Care
- Pharmaceutical & Biotechnology
- Education, Academia & Research
- Government, Public Administration & Civil Service
- Diplomacy & International Relations
- Politics, Campaigning & Party Operations
- Defence & Military and Security
- Nonprofit, NGO and Charity
- Legal & Judicial
- Professional Services & Management Consulting
- Financial Services and Banking
- Technology (Software, IT & Digital Services)
- Telecommunications & Network Infrastructure
- Media, Communications & Public Relations
- Gambling, Gaming and Racing
- Retail, Hospitality & Tourism
- Arts, Culture & Sport
- Science, Engineering & Technical Professions
- Retired

Format each gig as a JSON object matching this schema:

```json
{
  "role": "the job title or position",
  "organisation": "the company or organisation name",
  "category": "one of the categories above",
  "sources": ["https://url-that-verifies-this-role"],
  "pollie_slug": "the-pollie-slug",
  "start_date": "YYYY-MM-DD or omit if unknown",
  "end_date": "YYYY-MM-DD or omit if ongoing/unknown"
}
```

Do NOT include a `verified_by` field --- these are unverified candidates.

## Step 4: present results for review

Present all found gigs in a clear table showing:

- Politician name and slug
- Role and organisation
- Category
- Source URL(s)
- Dates (if known)

Also flag any gigs that already exist in `data/gigs.json` (matching on
pollie_slug + organisation + role) so duplicates are obvious.

Ask the user which gigs to add. They may want to:

- Add all of them
- Add only some (specify which)
- Skip all (if none look right)
- Edit details before adding

## Step 5: write to data file

For approved gigs only:

1. Read the current `data/gigs.json`.
2. Append the new gigs to the array.
3. Write the updated array back (pretty-printed with 2-space indent, trailing
   newline).
4. Run `npm run build` to verify the data is valid and the site builds
   correctly.
5. Show a summary of what was added.

Do NOT commit the changes. In interactive mode, the user will review and commit.
In non-interactive mode (cron), the calling script handles git operations.

## Important rules

- Every gig MUST have at least one source URL. No exceptions.
- It's fine if sources are a bit weak (e.g. LinkedIn only, or a passing mention
  in an article) or if some details like dates are missing --- that's the whole
  point of having the human verification step afterwards. Err on the side of
  including a candidate gig rather than leaving it out.
- Only include roles taken AFTER the politician left parliament.
- Do not fabricate gigs or source URLs --- but a plausible gig with imperfect
  sourcing is still worth presenting.
- Check for duplicates against existing gigs before presenting results.
- If a search turns up nothing, say so clearly rather than making things up.
- Use Australian English in all communication.
