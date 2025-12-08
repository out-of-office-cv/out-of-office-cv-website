---
id: task-11
title: data model changes
status: Done
assignee: []
created_date: '2025-12-08 06:21'
updated_date: '2025-12-08 06:30'
labels: []
dependencies: []
---

I want to change the Gig data model:

- start_date should be optional
- source should be a list of strings (i.e. multiple source URLs)

All existing gigs can be trivially migrated. The "verify gig" UI will need to be
updated as well.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed data model changes:
- Changed `source: string` to `sources: string[]` in Gig interface
- Made `start_date` optional
- Migrated all existing gigs in data/gigs.ts
- Updated GigEntryForm.vue with multi-source UI and optional start date
- Updated pollies/[slug].paths.ts to handle array sources and missing dates
- Updated test fixtures
- All tests passing
<!-- SECTION:NOTES:END -->
