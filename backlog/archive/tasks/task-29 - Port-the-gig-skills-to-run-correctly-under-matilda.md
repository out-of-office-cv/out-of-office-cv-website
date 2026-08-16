---
id: TASK-29
title: Port the gig skills to run correctly under matilda
status: To Do
assignee: []
created_date: '2026-08-13 23:25'
labels:
  - ops
  - cron
  - matilda
dependencies:
  - TASK-28
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make find-gigs and verify-gigs actually produce good output under matilda, once the runner switch exists. The blocker is not auth or frontmatter --- it is that matilda serialises subagents, and find-gigs is architecturally a fan-out.

Decision taken 2026-08-14: accept the serialisation. Keep one subagent per pollie (do not batch several pollies into one subagent, which would blunt the per-pollie research), let them run serially, and pay for it with a longer timeout plus the two safety changes below that the longer timeout forces.

## Gating questions, answered empirically (2026-08-14, matilda 0.21.1 on weddle)

Probed with throwaway skills under `.matilda/skills/`, `--json-file` event logs inspected.

1. **`allowed-tools` is NOT enforced.** A skill carrying claude's exact frontmatter (`allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task`, `model: sonnet`, `disable-model-invocation: true`) ran fine, using `run_shell_command`, `read_file` and `write_file` --- none of them named in the frontmatter. Nothing was blocked. The claude-specific frontmatter is inert, so one SKILL.md can serve both CLIs without reconciliation.

2. **`$ARGUMENTS` is NOT substituted.** Invoking `/argtest christopher-pyne` delivered the literal string `$ARGUMENTS` to the model. But the argument is not lost: the event log shows the model reasoning about "the argument christopher-pyne" from the invocation line. Fixable by rewording the skill body to refer to the argument given at invocation rather than to the placeholder. The same applies to claude's inline bash injections (`` !`head -5 data/pollies.csv` ``), which land as literal text --- a body that instead instructs the agent to read the file gets equivalent context under both CLIs.

3. **Subagent fan-out does NOT run in parallel.** Matilda has an `agent` tool and the model used it correctly, emitting three `agent` tool_use blocks in a single assistant message (exactly how claude batches parallel Tasks). Matilda's runtime then ran them one at a time: three 8-second sleeps, zero overlap, ~47s total.

   ```
   fan1: 609.43 -> 617.43
   fan2: 622.52 -> 630.53   (starts 5s after fan1 ended)
   fan3: 648.22 -> 656.22   (starts 18s after fan2 ended)
   ```

   Matilda also reported "Launching three subagents in parallel now... completed successfully" --- a false claim. Do not trust a run's self-report about its own concurrency or success when comparing CLIs.

   Not chased down: the bundle has `maxConcurrentBackgroundAgents` and an agent `invocation_kind` taking `fork` and `background`, so a backgrounded-agent path exists and might be genuinely concurrent. Worth ten minutes before accepting the serial cost, but not a blocker either way.

## What serialisation costs

find-gigs selects up to 15 pollies and fans out one subagent each. Recent claude runs took 265s, 410s, 387s, 379s, 470s wall clock; because those 15 run concurrently, each pollie's research is roughly the whole run. Serialised, expect roughly 60--105 min against the unit's current `TimeoutStartSec=2h`.

Raising that timeout has two second-order consequences, both of which need handling here:

- **Shared-worktree collision.** verify starts 02:00--02:30, find 05:00--05:30, both in the same cron worktree doing `git checkout -f --detach` + `reset --hard`. The current 2h timeout means verify always ends by 04:30, a 30-minute margin. Past ~2.5h the two can overlap and clobber each other mid-run.
- **All-or-nothing write-back.** find-gigs Step 5 writes `data/gigs.json` once, after every subagent has returned. A 7-minute parallel run has almost no exposure to being killed mid-flight; a ~100-minute serial one has a lot, and a kill at minute 90 currently yields zero output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both SKILL.md files exist once in the repo and resolve under both CLIs, via symlinks from .matilda/skills/<name> to the .claude/skills copy, with no duplicated skill content to keep in sync
- [ ] #2 Skill bodies carry no claude-only mechanics: no reliance on $ARGUMENTS substitution and no inline bash injection, replaced by instructions that yield the same context under either CLI
- [ ] #3 A claude run of each job after the skill rewording still produces the same artefacts and comparable output quality to before it, so portability has not degraded the default runner
- [ ] #4 find-gigs writes each pollie's accepted gigs to data/gigs.json incrementally, so a run killed partway still banks what it found rather than losing everything
- [ ] #5 Both cron scripts take an flock on a shared lockfile in the cron worktree, so an overlapping find/verify run exits immediately rather than clobbering the shared checkout
- [ ] #6 TimeoutStartSec on both services is raised to cover a serial matilda run, with the chosen value justified against a measured run rather than guessed
- [ ] #7 A matilda run of each job produces the same artefacts as a claude run: modified data/gigs.json plus the job's state file, no commits made by the agent itself, and a PR opened by the script
- [ ] #8 A matilda find run and a claude find run over the same pinned set of pollie slugs have been compared on gig precision, not just gig count, and the result recorded on this task
- [ ] #9 Observed matilda token usage from ~/.matilda/usage_record.jsonl for a full find run is recorded on this task, so the free-access quota risk is known rather than assumed
<!-- AC:END -->
