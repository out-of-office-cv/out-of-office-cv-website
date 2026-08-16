---
id: TASK-29
title: Harden the gig cron jobs against overlapping and interrupted runs
status: Done
assignee: []
created_date: '2026-08-16 03:44'
updated_date: '2026-08-16 09:22'
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
- [x] #1 A run that exits because it could not take the lock says so in its log and exits zero, so systemd does not report it as a failure
- [x] #2 Both scripts capture the agent's exit code and log it, so a crashed run is distinguishable in the log from a run that legitimately found nothing
- [x] #3 A non-zero agent exit is reflected in the PR body or the log summary, so a partial run's PR is identifiable as partial when triaging it
- [x] #4 The overlap guard is verified by starting both jobs concurrently by hand and confirming one exits cleanly with the other's output intact
- [x] #5 Both cron scripts serialise on one shared lockfile in the cron worktree, so a second run starting while one is in progress never shares the checkout
- [x] #6 A run that cannot take the lock within a bounded wait gives up rather than waiting indefinitely, so it cannot outlive its systemd start timeout
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
--------------------------------------------------
Locking and exit-code observability live in cron-lib.sh, sourced by both scripts.

take_lock serialises on .cron.lock in the cron worktree and waits LOCK_WAIT_SECS (default 900) before giving up, logging the skip and exiting zero. run_agent captures the agent's status into AGENT_EXIT, logs it, and a non-zero status prefixes the PR body with a **Partial run** marker.

AC #4 exercised for real rather than in theory: both scripts were run concurrently in a scratch clone against a local bare origin, with a stub agent holding the lock for six seconds. verify-gigs logged 'Lock held by the other gig job for 2s, skipping this run' and exited zero while find-gigs completed with its output intact.

That same harness turned up a latent bug this task did not anticipate: a run checks out origin/main partway through, replacing the very script bash is reading, so it continued from a stale byte offset into a different file. Fixed by syncing first and re-execing (commit e7b1934), with the lock inherited across the exec on its fd.

## Follow-up defect, found and fixed 2026-08-16 (ada9aca)

Long matilda runs exposed a race the daily claude schedule had hidden. A run synced to origin/main, ran for the best part of an hour, then did `git reset --soft origin/main` before committing. Remote-tracking refs are shared across all worktrees of a repo, so a `git fetch` in the ordinary checkout moved origin/main mid-run: HEAD jumped to a commit the run had never checked out while the index still held the old file contents, and the resulting commit reverted everything that had landed in between. Auto-merge shipped it as PR #475, clobbering a skill file and two docs.

Fixed by pinning RUN_BASE at sync time and using it for every later git reference, then replaying the finished data-only commit onto current origin/main just before pushing --- necessary because GitHub squash-merges against main's tip, so a stale-based branch reverts rather than omits.

Reproduced in a scratch clone with an agent stub that pushes to main mid-run, and confirmed fixed: the branch is now parented on the current tip, contains only data/gigs.json, and the mid-run edit survives. Worth noting the first two attempts at that test passed misleadingly because the script re-execs the checked-out copy, so an uncommitted fix is never what runs.
<!-- SECTION:NOTES:END -->
