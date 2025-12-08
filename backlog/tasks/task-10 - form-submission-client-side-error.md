---
id: task-10
title: form submission client-side error
status: Done
assignee: []
created_date: '2025-12-08 06:20'
updated_date: '2025-12-08 06:36'
labels: []
dependencies: []
---

I tried to use the "admin" gig verification workflow and when I hit "add to
draft" I got a console error:

crypto.randomUUID is not a function

can you reproduce and fix this bug?

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed by adding a fallback UUID generator in `GigEntryForm.vue`. The `crypto.randomUUID()` API is only available in secure contexts (HTTPS) and modern browsers. The fix checks if `crypto.randomUUID` is available and falls back to a standard UUID v4 generator using `Math.random()`.
<!-- SECTION:NOTES:END -->
