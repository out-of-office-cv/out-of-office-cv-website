---
id: TASK-29.1
title: Write find-gigs results back per pollie as they complete
status: To Do
assignee: []
created_date: '2026-08-16 04:11'
labels:
  - ops
  - cron
dependencies: []
parent_task_id: TASK-29
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
find-gigs writes `data/gigs.json` at Step 5 and `data/find-state.json` at Step 6, both after every subagent has returned. A run killed before then loses everything --- including the record of which pollies were searched, so those pollies stay eligible and the next run picks the same ones and redoes the work. A job that reliably dies late would re-search the same pollies forever and never advance through the roster.

Split out of task-29 (2026-08-16): the locking half of that task is cheap and lands immediately, this half is a skill redesign and is only truly needed once runs get long (serial matilda) or frequent (task-31).

## Why the obvious fix does not work

The skill puts the fan-out in the subagents but the write in the orchestrator --- "you handle selection, dedup, and write-back", with Steps 4--6 all running after "Wait for all subagent tasks to return". Under claude the orchestrator dispatches all 15 Tasks in one parallel batch, so they land back together and there is no meaningful "as that pollie completes" moment to write at. Simply moving the write inside the loop buys almost nothing on claude, and having each subagent read-modify-write `data/gigs.json` directly would introduce a lost-update race between 15 concurrent writers.

## Sidecar files

Each subagent writes its own `data/.find-inflight/<slug>.json` instead. One file per pollie means no shared-file race under claude and no ordering problem under serial matilda. The orchestrator merges sidecars through the existing dedup and write path, recording each pollie in find-state as its sidecar is merged, and deletes each sidecar once merged.

Because the sidecars are untracked and the cron worktree is never cleaned, a run killed mid-fan-out leaves them on disk for the next run to merge before it selects, so the work survives rather than being redone. A subagent that died without writing a sidecar leaves its pollie unrecorded, which correctly makes it eligible again.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each find-gigs subagent writes its own per-pollie sidecar file, so no two concurrent subagents write the same file
- [ ] #2 The orchestrator merges sidecars into data/gigs.json through the existing dedup path and records each pollie in data/find-state.json as its sidecar is merged
- [ ] #3 Sidecars left behind by a killed run are merged by the next run before it selects pollies, so that work is not redone
- [ ] #4 A merged sidecar is deleted, so no sidecar is ever merged twice
- [ ] #5 A run killed partway through the fan-out does not cause the pollies whose sidecars exist to be re-searched next run
<!-- AC:END -->
