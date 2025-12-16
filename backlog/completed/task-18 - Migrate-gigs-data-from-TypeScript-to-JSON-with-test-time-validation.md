---
id: task-18
title: Migrate gigs data from TypeScript to JSON with test-time validation
status: Done
assignee: []
created_date: '2025-12-15 09:08'
updated_date: '2025-12-15 09:17'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current `data/gigs.ts` file stores gig data as a TypeScript array. The `find-gigs.ts` script updates this file using fragile string templating to generate TypeScript syntax.

This should be migrated to a JSON-based approach that:
1. Makes it trivial for scripts and the frontend "raise PR" workflow to write valid data
2. Provides clean diffs for PR reviewers
3. Validates the schema in CI (via tests) rather than at import-time
4. Avoids complex module resolution issues with VitePress
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 data/gigs.json contains the gig data as a JSON array
- [x] #2 data/gigs.ts is a simple re-export: imports from gigs.json with Gig[] type annotation
- [x] #3 tests/gigs.test.ts validates the JSON against the Gig schema (Zod)
- [x] #4 scripts/find-gigs.ts writes to gigs.json using JSON.stringify
- [x] #5 gigs-list.data.ts watches gigs.json instead of gigs.ts
- [x] #6 npm run build succeeds
- [x] #7 npm run test succeeds
- [x] #8 Existing PR workflow for adding gigs continues to work
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create `data/gigs.json` by extracting the array from `data/gigs.ts`
2. Simplify `data/gigs.ts` to:
   ```typescript
   import type { Gig } from "../.vitepress/types";
   import gigsJson from "./gigs.json";
   export const gigs: Gig[] = gigsJson;
   ```
3. Add Zod dependency: `npm install zod`
4. Create `tests/gigs.test.ts` with Zod schema validation:
   - Define GigSchema using z.object with GIG_CATEGORIES enum
   - Test that gigs.json parses successfully
   - Test that invalid data fails validation
5. Update `scripts/find-gigs.ts`:
   - Remove `formatGig`, `formatGigsFile`, `appendGigsToFile` functions
   - Add `readGigsJson`, `writeGigsJson`, `appendGigsToJson` functions using JSON.parse/stringify
   - Replace TypeScript validation with Zod validation
6. Update `gigs-list.data.ts` to watch `./data/gigs.json` instead of `./data/gigs.ts`
7. Update `tests/find-gigs.test.ts` to test the new JSON functions instead of the old formatting functions
8. Update `tests/pollies.test.ts` integration tests to write JSON instead of TypeScript
9. Run build and tests to verify
<!-- SECTION:PLAN:END -->
