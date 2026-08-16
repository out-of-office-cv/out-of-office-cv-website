---
id: TASK-31
title: Raise the find-gigs cadence to saturate the search throttle
status: To Do
assignee: []
created_date: '2026-08-16 03:45'
updated_date: '2026-08-16 06:38'
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
- [x] #1 Run-to-run search state no longer depends on PR merge latency: two consecutive runs with the first run's PR left unmerged do not re-search the same pollies
- [ ] #2 That same scenario produces no duplicate gigs across the two runs' output
- [x] #3 A temporary higher-cadence catch-up phase to clear the 570-pollie backlog is documented in CLAUDE.md, including how to start it and how to drop back to steady state
- [ ] #4 Token usage at the raised cadence has been observed over at least a week and recorded, so the free-access quota position is known before the catch-up burst is run
- [x] #5 The verify job's cadence is reviewed against the raised find cadence, so newly found gigs do not sit unverified for longer than they do today
- [ ] #6 PR volume at the raised cadence has been observed and judged reviewable, or a rolling-branch scheme adopted if it is not
- [x] #7 The find timer runs on a 3-hourly grid during catch-up and can be dropped back to steady state later, set via a .timer drop-in whose first entry is an empty OnCalendar= so the tracked daily schedule is cleared rather than added to
- [x] #8 Reverting to the daily schedule is a drop-in removal plus daemon-reload with no edit to the tracked unit, and has been exercised
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
--------------------------------------------------
Blocker cleared ahead of the cadence work: both state files are untracked as of commit 49cd8b5, the cron worktree's copy is authoritative, and each run mirrors the pair onto the cron-state branch.

AC #1 verified in a scratch clone against a local bare origin: two consecutive runs with both PRs left unmerged and main never advancing, and the throttle state survived each run's checkout -f and reset --hard intact (248 entries, the pollie recorded by run 1 still present after run 2's sync). The PR branches carry data/gigs.json only.

Worth knowing before sizing the PR-volume worry: .github/workflows/auto-merge-gig-prs.yml already squash-merges collaborator gig PRs once tests pass, so merge latency in practice is minutes, and the queue this task feared only forms when auto-merge fails (a test failure, or a gigs.json conflict between two PRs branched from the same main). Also, verify runs that only advanced the throttle no longer open a PR at all, since state is not in the diff --- so the no-op PR class is gone.

Still open: everything from AC #4 on, which is the cadence change itself, plus AC #2's duplicate check, which needs two live runs rather than a stubbed pair.

## Cadence raised 2026-08-16

Ben's call: a 3-hourly grid with verify holding the 02:00 slot and find taking the other seven (05, 08, 11, 14, 17, 20, 23). Seven find runs/day is 105 pollies/day against a saturation point of 58.4, so it is explicitly a catch-up setting to clear the never-searched backlog, with a drop back to ~6-hourly once the first sweep completes. Both documented in CLAUDE.md under 'Cadence'.

Set via ~/.config/systemd/user/ooc-find-gigs.timer.d/cadence.conf, with the bare OnCalendar= reset first. Rollback exercised: deleting the file and reloading restored the tracked daily 05:00, reinstating it restored the seven slots, and neither triggered a spurious run.

AC #8 answered with data rather than judgement: verify's batch cap is 60 gigs per run and the whole dataset currently holds 23 unverified gigs, 21 of them exhausted. Seven find runs produce roughly 7--14 new gigs a day, so one verify run a day has four to eight times the headroom it needs. No verify cadence change.

As predicted by the note in this task, editing the timer with Persistent=true fired an immediate catch-up run. Harmless now the jobs hold a lock --- it just cost one unplanned agent run.

Still open: AC #2 needs two runs with the first PR deliberately left unmerged, which auto-merge makes awkward to arrange and which #1 plus per-pollie selection already implies; AC #3 needs a few days of watching PR volume; AC #6's catch-up phase is running now, so its token cost accrues over the coming week.
<!-- SECTION:NOTES:END -->
