---
id: TASK-31
title: Raise the find-gigs cadence to saturate the search throttle
status: To Do
assignee: []
created_date: '2026-08-16 03:45'
labels:
  - ops
  - cron
dependencies:
  - TASK-29
  - TASK-30
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Daily find runs are badly under-provisioned for the roster, and free Matilda tokens make a higher cadence affordable. Raising it is not safe today, though: one specific interaction silently breaks the search throttle as soon as PRs stop being merged promptly.

## The roster arithmetic

817 pollies; 570 of them (70%) have never been searched. At 15 pollies per run, one run a day covers 210 pollies per 14-day throttle window --- 26% of the roster --- so the first sweep never completes and the backlog grows.

To re-search every pollie inside the 14-day window needs 58.4 pollies/day, i.e. **3.9 runs/day, about one every 6 hours**. That is the saturation point: past it, runs increasingly find no eligible pollies and no-op. Running "constantly" buys nothing in steady state.

It does buy something during catch-up. Clearing the 570-pollie backlog takes 9.5 days at 4 runs/day, 4.8 days at 8, 3.2 days at 12. So a temporary burst then a drop back to ~4/day is the shape, not a permanently high cadence.

Prefer more frequent small runs over a bigger per-run cap: each run is a checkpoint that banks find-state and opens a PR, and under serial matilda a 58-pollie run would hold the lock for hours.

## Blocker: unmerged PRs silently reset the throttle

Each run does `git reset --hard origin/main`, so it sees whatever `data/find-state.json` is on main. find-state is only committed on the PR branch. The script comment ("included so the search throttle survives the next run's reset --hard") holds only once that PR is merged.

At one run a day with same-day merging this rarely bites. At 4+ runs a day PRs queue, and every run in the queue sees the same stale find-state, re-picks the same pollies, re-searches them, and opens another PR with gigs that duplicate the pending one --- dedup cannot catch it, because dedup compares against origin/main's gigs.json, which also lacks them.

So cadence cannot be raised until run-to-run state stops depending on merge latency. Either runs accumulate onto a single rolling branch rather than starting from main each time, or find-state stops travelling through the PR flow at all (it is bookkeeping, not reviewable content, and nothing about it needs human review).

## Reversibility

The cadence change belongs in a `.timer` drop-in, not the tracked unit, so backing it out is a file removal. Note that `OnCalendar=` is additive in systemd: a drop-in must set an empty `OnCalendar=` first to clear the tracked value, or the old and new schedules both apply. With the overlap guard from the hardening task in place, editing timers is no longer hazardous.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run-to-run search state no longer depends on PR merge latency: two consecutive runs with the first run's PR left unmerged do not re-search the same pollies
- [ ] #2 That same scenario produces no duplicate gigs across the two runs' output
- [ ] #3 PR volume stays reviewable as cadence rises, rather than growing linearly with run count
- [ ] #4 The find timer runs approximately every 6 hours in steady state, set via a .timer drop-in with an empty OnCalendar= first so the tracked daily schedule is cleared rather than added to
- [ ] #5 Reverting to the daily schedule is a drop-in removal plus daemon-reload with no edit to the tracked unit, and has been exercised
- [ ] #6 A temporary higher-cadence catch-up phase to clear the 570-pollie backlog is documented in CLAUDE.md, including how to start it and how to drop back to steady state
- [ ] #7 Token usage at the raised cadence has been observed over at least a week and recorded, so the free-access quota position is known before the catch-up burst is run
- [ ] #8 The verify job's cadence is reviewed against the raised find cadence, so newly found gigs do not sit unverified for longer than they do today
<!-- AC:END -->
