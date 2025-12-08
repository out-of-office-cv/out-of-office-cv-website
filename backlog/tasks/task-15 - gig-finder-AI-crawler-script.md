---
id: task-15
title: gig finder AI crawler script
status: To Do
assignee: []
created_date: "2025-12-08 22:02"
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
