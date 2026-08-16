---
id: TASK-30
title: Port the gig skills to run correctly under matilda
status: In Progress
assignee: []
created_date: '2026-08-16 03:44'
updated_date: '2026-08-16 04:29'
labels:
  - ops
  - cron
  - matilda
dependencies:
  - TASK-28
  - TASK-29
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make find-gigs and verify-gigs produce good output under matilda, once the runner switch exists and the jobs are hardened. The blocker is not auth or frontmatter --- it is that matilda serialises subagents, and find-gigs is architecturally a fan-out.

Decision taken 2026-08-14: accept the serialisation. Keep one subagent per pollie (do not batch several pollies into one subagent, which would blunt the per-pollie research), let them run serially, and pay for it with a longer timeout.

## Gating questions, answered empirically (2026-08-14, matilda 0.21.1 on weddle)

Probed with throwaway skills under `.matilda/skills/`, `--json-file` event logs inspected.

1. **`allowed-tools` is NOT enforced.** A skill carrying claude's exact frontmatter (`allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task`, `model: sonnet`, `disable-model-invocation: true`) ran fine, using `run_shell_command`, `read_file` and `write_file` --- none of them named in the frontmatter. Nothing was blocked. The claude-specific frontmatter is inert, so one SKILL.md can serve both CLIs without reconciliation.

2. **`$ARGUMENTS` is NOT substituted.** Invoking `/argtest christopher-pyne` delivered the literal string `$ARGUMENTS` to the model. The argument is not lost: the event log shows the model reasoning about "the argument christopher-pyne" from the invocation line. Fixable by rewording the skill body to refer to the argument given at invocation rather than to the placeholder. The same applies to claude's inline bash injections (`` !`head -5 data/pollies.csv` ``), which land as literal text --- a body that instead instructs the agent to read the file gets equivalent context under both CLIs.

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

Note this does not limit coverage: the useful steady-state cadence is about 4 runs a day, and even a 105-minute run leaves ample headroom for that.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both SKILL.md files exist once in the repo and resolve under both CLIs, via symlinks from .matilda/skills/<name> to the .claude/skills copy, with no duplicated skill content to keep in sync
- [x] #2 Skill bodies carry no claude-only mechanics: no reliance on $ARGUMENTS substitution and no inline bash injection, replaced by instructions that yield the same context under either CLI
- [ ] #3 A claude run of each job after the skill rewording produces the same artefacts and comparable output quality to before it, so portability has not degraded the default runner
- [ ] #4 TimeoutStartSec on both services covers a serial matilda run, with the value justified against a measured run rather than guessed, and set via drop-in so removing it restores the current 2h
- [ ] #5 A matilda run of each job produces the same artefacts as a claude run: modified data/gigs.json plus the job's state file, no commits made by the agent itself, and a PR opened by the script
- [ ] #6 A matilda find run and a claude find run over the same pinned set of pollie slugs have been compared on gig precision, not just gig count, and the result recorded on this task
- [ ] #7 Measured matilda token usage from ~/.matilda/usage_record.jsonl for one full find run is recorded on this task, with the implied daily cost at 4 runs/day extrapolated from it
- [x] #8 Switching a job back to claude is a single drop-in removal plus daemon-reload, with no script or skill edit, and this has been exercised rather than only documented
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Symlinks .matilda/skills/{find,verify}-gigs point at the .claude/skills copies, so there is one SKILL.md per skill.

Probed matilda 0.21.2 on weddle to settle two things the task had not: it discovers skills through a symlinked directory (a real dir and a symlinked dir were both listed), and it still honours a slash invocation of a skill carrying disable-model-invocation: true. The gig skills are absent from the model-visible skill list precisely because of that flag, which is intended --- they are slash-invoked by the cron scripts.

Claude-only mechanics removed from find-gigs: $ARGUMENTS now reads as an instruction to take the slug off the invocation line, and the two inline bash injections were dropped as redundant with Step 1's read list. verify-gigs had neither.

AC #8 exercised: removing ~/.config/systemd/user/ooc-verify-gigs.service.d/runner.conf plus a daemon-reload drops AGENT_CLI from the unit's environment, and reinstating it restores it, with no script or skill edit.

Open: ACs 3, 5, 6 and 7 all need live runs, and AC 4's timeout must be justified against a measured serial matilda run rather than guessed. verify-gigs is switched to matilda and will produce the first of those measurements on its next fire.
<!-- SECTION:NOTES:END -->
