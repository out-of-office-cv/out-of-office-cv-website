---
id: TASK-31
title: Raise the find-gigs cadence to saturate the search throttle
status: To Do
assignee: []
created_date: '2026-08-16 03:45'
updated_date: '2026-08-16 04:12'
labels:
  - ops
  - cron
dependencies:
  - TASK-29
  - TASK-29.1
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

## Decision (2026-08-16): take state out of the PR flow

Of the two candidates --- runs accumulating onto a rolling branch, or state leaving the PR flow --- the second wins on both simplicity and robustness.

`data/find-state.json` and `data/verify-state.json` become untracked, and the copy in the cron worktree is authoritative. Untracked files survive both `git checkout -f --detach origin/main` and `git reset --hard`, so the read path is just "the file is already there": no fetch, no branch, no merge, and no path by which a PR's state could be what a later run reads. After each run the pair is mirrored best-effort onto a long-lived `cron-state` branch for durability and inspection; a failed mirror push cannot fail a run, because the local file is the source of truth.

Rejected: the rolling branch would forfeit the "start detached at origin/main, never rebase, can never wedge on a conflict" property the jobs were built around, which is the main reason they have been reliable.

The bounded failure mode is losing the cron worktree, which makes the whole roster eligible again --- a re-sweep costs tokens but corrupts nothing, since dedup catches the re-found gigs, and the mirror branch makes it recoverable with a `git show`.

This decision leaves PR volume unaddressed: gig PRs still accumulate one per run. That is deliberately deferred to observation rather than solved up front, since four small PRs a day may simply not be a problem outside the catch-up burst.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run-to-run search state no longer depends on PR merge latency: two consecutive runs with the first run's PR left unmerged do not re-search the same pollies
- [ ] #2 That same scenario produces no duplicate gigs across the two runs' output
- [ ] #3 The find timer runs approximately every 6 hours in steady state, set via a .timer drop-in with an empty OnCalendar= first so the tracked daily schedule is cleared rather than added to
- [ ] #4 Reverting to the daily schedule is a drop-in removal plus daemon-reload with no edit to the tracked unit, and has been exercised
- [ ] #5 A temporary higher-cadence catch-up phase to clear the 570-pollie backlog is documented in CLAUDE.md, including how to start it and how to drop back to steady state
- [ ] #6 Token usage at the raised cadence has been observed over at least a week and recorded, so the free-access quota position is known before the catch-up burst is run
- [ ] #7 The verify job's cadence is reviewed against the raised find cadence, so newly found gigs do not sit unverified for longer than they do today
- [ ] #8 PR volume at the raised cadence has been observed and judged reviewable, or a rolling-branch scheme adopted if it is not
<!-- AC:END -->
