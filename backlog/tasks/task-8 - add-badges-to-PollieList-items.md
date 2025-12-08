---
id: task-8
title: add badges to PollieList items
status: Done
assignee: []
created_date: '2025-12-08 05:39'
updated_date: '2025-12-08 05:48'
labels: []
dependencies: []
---

In the PollieList component, I'd like
[badges](https://vitepress.dev/reference/default-theme-badge#badge) for each
pollie, for:

- senator or MP
- Party (ALP, LIB, etc)

I'd like the senator badge to be "senate red" and the MP badge to be "MP green".
And for the parties, I'd like to have a lookup table (in ts) which maps similar
parties to colours, e.g consider Lib and LNP to be the same party, and use blue.
Other colours:

- red for ALP
- blue for LIB/LNP
- green for Greens
- grey for Independent
- orange for One Nation (PHON, etc)

all others, just list them and we'll try to figure out what colour they should
be
