---
id: task-9
title: Add gig verification workflow to contribute page
status: Done
assignee: []
created_date: '2025-12-08 06:18'
updated_date: '2025-12-08 06:22'
labels:
  - feature
  - frontend
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the contribute page to support two workflows:

1. **Add new gigs** (existing functionality)
2. **Verify existing gigs** (new)

The verification workflow allows trusted reviewers to browse unverified gigs (those without a `verified_by` field) and mark them as verified. This adds their verifier ID to the gig entry via a PR.

GitHub username to verifier ID mapping:
- `out-of-office-cv` -> `khoi`
- `benswift` -> `ben`

The PR should modify the existing gig entry in `data/gigs.ts` to add the `verified_by` field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tab or toggle to switch between 'Add new gig' and 'Verify existing gigs' modes
- [x] #2 Verify mode shows list of unverified gigs (those without verified_by)
- [x] #3 Gigs can be filtered/searched in verify mode
- [x] #4 Clicking a gig shows its details for review
- [x] #5 Verify button adds the reviewer's verifier ID based on GitHub username mapping
- [x] #6 Multiple gigs can be selected for batch verification
- [x] #7 Submitting creates a PR that modifies existing gig entries to add verified_by
- [x] #8 Only mapped GitHub users can verify (out-of-office-cv -> khoi, benswift -> ben)
<!-- AC:END -->
