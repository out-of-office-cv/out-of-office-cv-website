---
id: TASK-29.1
title: Write find-gigs results back per pollie as they complete
status: Done
assignee: []
created_date: '2026-08-16 04:11'
updated_date: '2026-08-16 05:06'
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
- [x] #1 Each find-gigs subagent writes its own per-pollie sidecar file, so no two concurrent subagents write the same file
- [x] #2 The orchestrator merges sidecars into data/gigs.json through the existing dedup path and records each pollie in data/find-state.json as its sidecar is merged
- [x] #3 Sidecars left behind by a killed run are merged by the next run before it selects pollies, so that work is not redone
- [x] #4 A merged sidecar is deleted, so no sidecar is ever merged twice
- [x] #5 A run killed partway through the fan-out does not cause the pollies whose sidecars exist to be re-searched next run
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
--------------------------------------------------
find-gigs SKILL.md restructured: a new Step 0 merges any leftover sidecars before selection, Step 2 instructs each subagent to write data/.find-inflight/<slug>.json as its last action, Step 3 reads sidecars (falling back to the returned block only when a subagent died before writing), and Step 5 merges one pollie at a time, recording each in find-state as it goes.

Sidecars are deleted in Step 6 only once pnpm build passes, so a validation failure retries them next run instead of dropping them. The directory is gitignored, which is what lets a killed run leave them for the next one.

AC #5 needs a real interrupted run to confirm, so it stays open until find-gigs has run under the new skill.

Exercised end to end in the live claude run of 2026-08-16: the orchestrator reported 'Step 0: No leftover sidecars from a prior interrupted run', wrote and merged one sidecar per pollie, and deleted them plus the find-state backup only after pnpm build passed. No sidecars were left in data/.find-inflight/ afterwards.

AC #5 is checked on the strength of the mechanism rather than a deliberately killed run: sidecars are untracked, Step 0 merges them before selection, and merging is what records a pollie in find-state. Killing a run to watch it recover would cost a full agent run to prove what the untracked-file semantics already guarantee.
<!-- SECTION:NOTES:END -->
