---
id: TASK-29
title: Harden the gig cron jobs against overlapping and interrupted runs
status: To Do
assignee: []
created_date: '2026-08-16 03:44'
labels:
  - ops
  - cron
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The two gig cron jobs share one worktree and write their output in a single step at the end of a run. Both are fine at the current one-run-a-day cadence with prompt PR merges, and both break down as soon as runs get longer or more frequent. This hardening pays off on the existing claude setup and is not gated on any agent-runner change.

## Shared-worktree collision

Both jobs run in `../out-of-office-cv-website-cron` and start with `git checkout -f --detach origin/main` + `git reset --hard`. There is no guard against two runs doing that at once. The 30-minute margin between verify (02:00--02:30) and find (05:00--05:30) only holds when both timers fire on schedule. Three cases already break it:

- editing a `.timer` with `Persistent=true` fires an immediate catch-up of both timers at once --- this has already happened
- the machine being off overnight fires both catch-ups together on boot
- a manual `systemctl --user start` while the other job is mid-run

## All-or-nothing write-back

find-gigs writes `data/gigs.json` at Step 5 and `data/find-state.json` at Step 6, both after every subagent has returned. A run killed before then loses everything --- including the record of which pollies were searched, so those pollies stay eligible and the next run picks the same ones and redoes the work. A job that reliably dies late would re-search the same pollies forever and never advance through the roster.

Dedup makes this cheap to fix: Step 4 scopes comparison to gigs with the same `pollie_slug`, and each subagent handles exactly one pollie, so per-pollie writes introduce no cross-pollie ordering problem.

## Crashes are invisible

Both scripts invoke the agent with a trailing `|| true`, so a crashed agent and a genuine no-op both land in the log as `No new gigs found, nothing to commit`. A broken run currently cannot be distinguished from a quiet one after the fact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both cron scripts take an flock on a shared lockfile in the cron worktree, so a second run starting while one is in progress exits immediately instead of sharing the checkout
- [ ] #2 A run that exits because it could not take the lock says so in its log and exits zero, so systemd does not report it as a failure
- [ ] #3 find-gigs writes each pollie's accepted gigs to data/gigs.json as that pollie completes, rather than once after all subagents return
- [ ] #4 find-gigs records each pollie in data/find-state.json as that pollie completes, so a run killed partway does not cause those pollies to be re-searched next run
- [ ] #5 Both scripts capture the agent's exit code and log it, so a crashed run is distinguishable in the log from a run that legitimately found nothing
- [ ] #6 A non-zero agent exit is reflected in the PR body or the log summary, so a partial run's PR is identifiable as partial when triaging it
- [ ] #7 The overlap guard is verified by starting both jobs concurrently by hand and confirming one exits cleanly with the other's output intact
<!-- AC:END -->
