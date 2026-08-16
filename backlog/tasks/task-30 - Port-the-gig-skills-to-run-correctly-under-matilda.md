---
id: TASK-30
title: Port the gig skills to run correctly under matilda
status: Done
assignee: []
created_date: '2026-08-16 03:44'
updated_date: '2026-08-16 09:52'
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
- [x] #3 A claude run of each job after the skill rewording produces the same artefacts and comparable output quality to before it, so portability has not degraded the default runner
- [x] #4 TimeoutStartSec on both services covers a serial matilda run, with the value justified against a measured run rather than guessed, and set via drop-in so removing it restores the current 2h
- [x] #5 A matilda run of each job produces the same artefacts as a claude run: modified data/gigs.json plus the job's state file, no commits made by the agent itself, and a PR opened by the script
- [x] #6 A matilda find run and a claude find run over the same pinned set of pollie slugs have been compared on gig precision, not just gig count, and the result recorded on this task
- [x] #7 Measured matilda token usage from ~/.matilda/usage_record.jsonl for one full find run is recorded on this task, with the implied daily cost at 4 runs/day extrapolated from it
- [x] #8 Switching a job back to claude is a single drop-in removal plus daemon-reload, with no script or skill edit, and this has been exercised rather than only documented
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
--------------------------------------------------
--------------------------------------------------
--------------------------------------------------
--------------------------------------------------
Symlinks .matilda/skills/{find,verify}-gigs point at the .claude/skills copies, so there is one SKILL.md per skill.

Probed matilda 0.21.2 on weddle to settle two things the task had not: it discovers skills through a symlinked directory (a real dir and a symlinked dir were both listed), and it still honours a slash invocation of a skill carrying disable-model-invocation: true. The gig skills are absent from the model-visible skill list precisely because of that flag, which is intended --- they are slash-invoked by the cron scripts.

Claude-only mechanics removed from find-gigs: $ARGUMENTS now reads as an instruction to take the slug off the invocation line, and the two inline bash injections were dropped as redundant with Step 1's read list. verify-gigs had neither.

AC #8 exercised: removing ~/.config/systemd/user/ooc-verify-gigs.service.d/runner.conf plus a daemon-reload drops AGENT_CLI from the unit's environment, and reinstating it restores it, with no script or skill edit.

Open: ACs 3, 5, 6 and 7 all need live runs, and AC 4's timeout must be justified against a measured serial matilda run rather than guessed. verify-gigs is switched to matilda and will produce the first of those measurements on its next fire.

AC #3 closed 2026-08-16: a live claude run of find-gigs after the rewording behaved exactly as before --- Step 0 reported no leftover sidecars, 15 pollies selected from 729 eligible, one new gig found (wendy-fatin), pnpm build passed, sidecars and the state backup cleaned up, PR #473 opened and auto-merged. The reworded argument handling and the dropped inline-bash peeks cost nothing.

## First live matilda find run, 2026-08-16 15:36--16:22

Ran ./cron-find-gigs.sh with AGENT_CLI=matilda directly rather than through systemd, so a long run would be measured rather than killed at TimeoutStartSec.

Wall clock: 45 min 30 s agent time (15:36:39 to 16:22:09), against 6 min 44 s for the claude run of the same job three hours earlier --- about 6.8x. Consistent with serial fan-out: 15 agent tool calls at roughly 3 minutes each. The task estimated 60--105 min, so the real number is better than feared.

AC #4: the existing TimeoutStartSec=2h leaves 2.6x headroom on this run, so no timeout drop-in is needed. Left unchecked because one sample is thin --- a batch of pollies with richer web presence would run longer, and the value should be revisited if a run ever approaches 90 min.

AC #7, measured from the single new record in ~/.matilda/usage_record.jsonl:
  totalTokens   7,434,216   (inputTokens 7,331,043, of which cachedTokens 5,794,528)
  outputTokens    103,173   (thoughtsTokens 42,430)
  tools: agent 15, web_search 280, web_fetch 99, read_file 12, run_shell_command 9
Extrapolated: ~29.7M tokens/day at 4 runs/day, ~52M/day at the 7 find runs/day a 3-hourly cadence would give. Whether the free tier tolerates that is still unknown.

AC #5: artefacts match a claude run exactly --- data/gigs.json modified, state mirrored to cron-state, no commits made by the agent (worktree HEAD unmoved), sidecars written, merged and cleaned up, and PR #474 opened by the script. It auto-merged on its own checks.

AC #6 is NOT satisfied by this run and stays open: matilda selected its own 15 pollies, so this is not a like-for-like comparison. Doing it properly needs both CLIs run over a pinned slug list.

Output quality, for what one run is worth: 3 gigs from 15 pollies (matilda) against 1 from 15 (claude, same day). Of matilda's three, mark-coulton as Director of the Page Research Centre is solid and sourced to the organisation's own people page; david-tollner as NT News columnist is sourced only to his own LinkedIn posts; stewart-west as SMH 'Opinion Contributor' is really a single 2014 op-ed plus an obituary, which is a source artefact rather than a role. So matilda is looser than claude here. verify-gigs is the filter for exactly this, and all three are unverified until it runs.

## Timeout, settled 2026-08-16 (AC #4)

Three measured matilda find runs: 45m30s, 57m, and 1h43m. The last had only 17 minutes of headroom against the tracked TimeoutStartSec=2h, so the earlier 'no drop-in needed' read from a single 45-minute sample was wrong. Both services now carry a timeout.conf drop-in setting 4h, with the measurements in a comment; deleting the file restores the tracked 2h.

The 1h43m run was the second of two back-to-back runs: the 17:00 timer fired while the 16:32 catch-up was still going, so systemd queued it and started it the moment the first finished.

## Pinned precision comparison, 2026-08-16 (AC #6)

Three pollies, never searched, chosen to probe a different failure mode each: tony-windsor (prolific op-ed writer, tests the one-off-act rule), sue-boyce (senator likely to hold board roles), craig-thomson (heavy press coverage that is about scandal, not roles). Both CLIs over the same three, run directly rather than through the cron script, with data restored to baseline before each of the six runs. Find timer stopped for the duration.

Result --- gigs added:
  claude:  tony-windsor 0, sue-boyce 1, craig-thomson 0
  matilda: tony-windsor 0, sue-boyce 0, craig-thomson 0

claude's single gig, Director @ Everhard Industries, carried two sources and a clean evidence quote from the company's own announcement ('Sue will continue as a director of the company'), and was correctly Tier 2 flagged as the same organisation as an existing gig. Nothing was screened out on either side: matilda's subagents simply returned empty candidate arrays.

So on this sample the difference is recall, not precision --- matilda found less rather than proposing worse. That is the opposite of the pre-screen picture, where matilda returned three gigs to claude's one and two of the three were marginal. The evidence screen appears to have removed the precision gap by removing the looseness that produced it.

Runtime per single-pollie run: claude 164s/269s/122s, matilda 268s/578s/392s --- roughly 2--3x, consistent with the 6.8x seen on a full 15-pollie fan-out where serialisation compounds.

Three pollies is a small sample and both CLIs finding nothing on two of them limits what it shows. It is enough to say matilda is not producing worse gigs under the new bar; it is not enough to conclude it finds fewer in general. The comparison worth trusting is the running one: claude's daily baseline against matilda's runs from here, which the nightly health check now surfaces.

Also surfaced, and filed as task-32: matilda's subagents did not write their sidecars ('No sidecar was written (directory doesn't exist). Falling back to the returned JSON'), which undermines task-29.1's crash resilience for exactly the CLI whose runs are longest.
<!-- SECTION:NOTES:END -->
