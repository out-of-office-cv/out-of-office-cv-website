---
id: TASK-29
title: Harden the gig cron jobs against overlapping and interrupted runs
status: To Do
assignee: []
created_date: '2026-08-16 03:44'
updated_date: '2026-08-16 04:11'
labels:
  - ops
  - cron
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The two gig cron jobs share one worktree and write their output in a single step at the end of a run. Both are fine at the current one-run-a-day cadence with prompt PR merges, and both break down as soon as runs get longer or more frequent. This hardening pays off on the existing claude setup and is not gated on any agent-runner change.

The write-back half was split into task-29.1 on 2026-08-16, so this task is locking and observability only --- both cheap, and neither gated on the skill redesign that per-pollie write-back needs.

## Shared-worktree collision

Both jobs run in `../out-of-office-cv-website-cron` and start with `git checkout -f --detach origin/main` + `git reset --hard`. There is no guard against two runs doing that at once. The 30-minute margin between verify (02:00--02:30) and find (05:00--05:30) only holds when both timers fire on schedule. Three cases already break it:

- editing a `.timer` with `Persistent=true` fires an immediate catch-up of both timers at once --- this has already happened
- the machine being off overnight fires both catch-ups together on boot
- a manual `systemctl --user start` while the other job is mid-run

A bounded wait rather than an instant exit, because at the raised cadence of task-31 a serial matilda run can hold the lock for over an hour, and a job that gives up the moment it finds the lock held would silently skip its slot entirely.

## Crashes are invisible

Both scripts invoke the agent with a trailing `|| true`, so a crashed agent and a genuine no-op both land in the log as `No new gigs found, nothing to commit`. A broken run currently cannot be distinguished from a quiet one after the fact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A run that exits because it could not take the lock says so in its log and exits zero, so systemd does not report it as a failure
- [ ] #2 Both scripts capture the agent's exit code and log it, so a crashed run is distinguishable in the log from a run that legitimately found nothing
- [ ] #3 A non-zero agent exit is reflected in the PR body or the log summary, so a partial run's PR is identifiable as partial when triaging it
- [ ] #4 The overlap guard is verified by starting both jobs concurrently by hand and confirming one exits cleanly with the other's output intact
- [ ] #5 Both cron scripts serialise on one shared lockfile in the cron worktree, so a second run starting while one is in progress never shares the checkout
- [ ] #6 A run that cannot take the lock within a bounded wait gives up rather than waiting indefinitely, so it cannot outlive its systemd start timeout
<!-- AC:END -->
