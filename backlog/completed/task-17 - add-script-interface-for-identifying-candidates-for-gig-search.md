---
id: task-17
title: add script interface for identifying candidates for gig search
status: Done
assignee: []
created_date: '2025-12-12 02:48'
updated_date: '2025-12-12 03:39'
labels: []
dependencies: []
---

There's an automated @scripts/find-gigs.ts script, but often it's handy to just
print out the pollies who are worth searching for more gigs for (using similar
strategies as to the find gigs script). Can we add this? Would it be helpful to
put the shared logic into a module, which the scripts then could use? Or is
standalone fine for now?

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added `--list-candidates` (or `-l`) flag to `scripts/find-gigs.ts` that prints candidate pollies without running the API search.

Usage:
- `npx tsx scripts/find-gigs.ts --list-candidates` — list top 10 candidates
- `npx tsx scripts/find-gigs.ts -l --strategy recent-few-gigs --limit 5` — customise strategy and limit

Refactored the selection logic by extracting a `listCandidates()` function that returns multiple pollies, which `selectPollie()` now uses internally. This keeps the shared logic in one place without needing a separate module.
<!-- SECTION:NOTES:END -->
