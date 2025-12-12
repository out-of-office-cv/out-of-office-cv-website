---
id: task-17
title: add script interface for identifying candidates for gig search
status: To Do
assignee: []
created_date: "2025-12-12 02:48"
labels: []
dependencies: []
---

There's an automated @scripts/find-gigs.ts script, but often it's handy to just
print out the pollies who are worth searching for more gigs for (using similar
strategies as to the find gigs script). Can we add this? Would it be helpful to
put the shared logic into a module, which the scripts then could use? Or is
standalone fine for now?
