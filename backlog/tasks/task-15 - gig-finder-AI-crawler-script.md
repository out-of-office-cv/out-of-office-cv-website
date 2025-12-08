---
id: task-15
title: gig finder AI crawler script
status: To Do
assignee: []
created_date: '2025-12-08 22:02'
updated_date: '2025-12-08 22:18'
labels: []
dependencies: []
---

I'd like to add another node script which

- chooses a pollie from the list (based on some criteria - initially it should
  choose the most "recent" one that has no associated gigs, but this should be
  configurable)
- using an API token stored in a GH secret/env var, hit a ChatGPT API endpoint
  (one with "web search" tools enabled) and search the web for any other gigs -
  with sources - that can be added to the list (these will initially be
  unverified)

The basic idea is that while all gigs need to be verified by a human (khoi/ben
initially, but more in future) there's a script which can run in a cronjob which
will identify candidate gigs with sources (using a tailored prompt should give
us a reasonably high hit-rate). These can then be verified, after which time
they'll show up on the website.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Script runs via `npm run find-gigs`
- [ ] #2 Selects pollie based on configurable strategy
- [ ] #3 Calls OpenAI Responses API with web_search tool
- [ ] #4 Returns multiple gigs with sources per pollie
- [ ] #5 Appends unverified gigs to data/gigs.ts
- [ ] #6 Validates output with tsc before saving
- [ ] #7 Handles API errors gracefully
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Script: `scripts/find-gigs.ts`

**Dependencies:**
- `openai` npm package (OpenAI SDK)

**Environment:**
- `OPENAI_API_KEY` required

**CLI:**
```bash
npm run find-gigs                              # default: most recent pollie with no gigs
npm run find-gigs -- --pollie <slug>           # explicit pollie
npm run find-gigs -- --strategy random         # random selection
```

### Flow

1. Load all pollies from CSVs (using existing utils)
2. Load existing gigs from `data/gigs.ts`
3. Select target pollie based on strategy
4. Call OpenAI Responses API with:
   - Model: `gpt-5-nano`
   - Tool: `web_search` (built-in)
   - Structured output: JSON array of `Gig` objects
5. Parse response, validate against `Gig` interface
6. Append new gigs to `data/gigs.ts` (without `verified_by`)
7. Run `tsc --noEmit` to validate
8. If validation fails, revert and exit with error

### Pollie Selection Strategies

- `recent-no-gigs` (default): most recently departed with no associated gigs
- `recent-few-gigs`: recently departed with fewer than N gigs  
- `random`: random selection from those without gigs
- `--pollie <slug>`: explicit selection

### API Details

Using Responses API which handles multi-turn web search automatically:
- Multiple searches per request as needed
- Aggregates results before structured output
- Returns multiple gigs with multiple sources each

### Output

Gigs appended to `data/gigs.ts` without `verified_by` field.
Human verification required before `verified_by` is added.
<!-- SECTION:PLAN:END -->
