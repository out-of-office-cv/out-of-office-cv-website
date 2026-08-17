---
id: TASK-32
title: Make matilda subagents actually write their find-gigs sidecars
status: To Do
assignee: []
created_date: '2026-08-16 09:52'
updated_date: '2026-08-17 09:08'
labels:
  - ops
  - cron
  - matilda
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The per-pollie sidecar in task-29.1 is what makes a killed find run keep the pollies it had already researched. It matters most under matilda, where a run takes 45--105 minutes instead of 7, so there is far more run to lose.

Matilda does not reliably honour the instruction. In the pinned comparison of 2026-08-16 the orchestrator reported: "No sidecar was written (directory doesn't exist). Falling back to the returned JSON". The fallback did its job, so nothing was lost in that run --- but a run killed mid-fan-out has no returned JSON to fall back to, which is the entire scenario the sidecar exists for.

The same run of matilda's orchestrator also improvised around the skill's Step 5, writing a `.tmp-merge.cjs` helper and batching the merge; a subagent result that arrived after that script was written was dropped, and the orchestrator said so ("kerry-rea recorded as 0 candidates"). So the deviation is not only in the subagents.

Worth checking before assuming the instruction is at fault: whether matilda subagents can write files at all in this configuration, and whether the instruction lands in the subagent prompt intact under matilda's `agent` tool.

## Update 2026-08-17: they do write them, but not to one shape

The 20:12 run on 2026-08-16 was killed mid-fan-out by matilda's `403 account_inactive` and left 14 sidecars in `data/.find-inflight/` for the 15 pollies it dispatched (christian-porter missing). So the answer to "can they write files at all" is yes, and AC #1 and #2 are closer than the description above suggests --- the failure is narrower than a blanket refusal.

The narrower failure is schema drift. Thirteen sidecars have the documented shape, `{pollie_slug, candidates}`. `peter-georgiou.json` instead has `{slug, name, party, state, house, ceased_date, searched_at, gigs, existing_gigs, search_summary}` --- the subagent serialised its whole working context rather than the output schema. The merge step reads `candidates`, so that pollie silently contributes nothing while still being recorded as searched, which is the same lost-work outcome the sidecar was meant to prevent, just quieter.

The sidecars are still on disk in the cron worktree, so this is reproducible without a fresh matilda run.

Two things follow. The merge in Step 5 should reject a sidecar that does not parse against the schema, and say so in the run summary, rather than treating a missing `candidates` key as an empty result. And the skill should state the sidecar's shape as a schema in its own right, next to `SubagentOutput`, rather than leaving it implied by a filename and a sentence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A matilda find run leaves one sidecar per dispatched pollie in data/.find-inflight/ while the fan-out is in progress, verified by inspecting the directory mid-run
- [ ] #2 A matilda find run killed partway through the fan-out leaves sidecars behind, and the next run merges them rather than re-searching those pollies
- [ ] #3 The orchestrator merges per pollie as Step 5 describes rather than batching through an improvised script, or the skill is reworded so that whatever it does reliably is what the skill asks for
- [ ] #4 A sidecar that does not match the documented shape is reported as a validation failure in the run summary rather than silently contributing zero candidates
<!-- AC:END -->
