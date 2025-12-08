---
id: task-11
title: data model changes
status: To Do
assignee: []
created_date: "2025-12-08 06:21"
labels: []
dependencies: []
---

I want to change the Gig data model:

- start_date should be optional
- source should be a list of strings (i.e. multiple source URLs)

All existing gigs can be trivially migrated. The "verify gig" UI will need to be
updated as well.
