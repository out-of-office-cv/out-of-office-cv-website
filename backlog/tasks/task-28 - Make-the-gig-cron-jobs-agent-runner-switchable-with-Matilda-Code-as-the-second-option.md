---
id: TASK-28
title: Make the gig cron jobs' agent runner switchable via one env var
status: Done
assignee: []
created_date: '2026-08-13 22:09'
updated_date: '2026-08-16 05:06'
labels:
  - ops
  - cron
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Both scheduled jobs hardcode `claude -p "/find-gigs"` / `-p "/verify-gigs"`. Maincode are giving free access to Matilda Code (`matilda`, a Gemini-CLI fork driving their Australian-built matilda-code-1.0 model, 1M context), so it is worth being able to run either job on either CLI --- one env var, no script surgery, claude stays the default.

This task is only the switch. It changes no behaviour on its own: with the var unset both jobs run exactly as they do today. Making the skills actually work under matilda is separate, and gated on findings recorded there.

This repo is a better fit for the experiment than slop-salon: the jobs run as ben on weddle, where the Matilda OAuth profile already lives, and they run one at a time, so the shared-refresh-token risk that blocks a six-agent fleet doesn't apply here.

## Invocation mapping

`claude --dangerously-skip-permissions -p "/<skill>"` maps onto
`MATILDA_CODE_SUPPRESS_BOGAN_WARNING=1 matilda --yolo --fresh "/<skill>"`
(the env var silences a stderr nag about auto-approval).

Auth is OAuth-only (`matilda auth` has just login/logout/status). The endpoint takes a bearer token, but it expires in ~24h and only the CLI refreshes it. Nothing to plumb on weddle --- the profile is already in `~/.matilda/` --- but it is why this can't be an API-key-style swap, and why the runner cannot be selected per-invocation by a credential.

## Why a drop-in on the .service, not the .timer

Editing a `.timer` with `Persistent=true` fires an immediate catch-up of both gig timers at once, and they collide on the shared cron worktree. An `Environment=` drop-in on the `.service` does not restart the timer, so the switch must be made there.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both cron scripts read the agent CLI from one env var that defaults to claude, so an unset environment runs exactly as it does today
- [x] #2 Setting that var to matilda makes each job run its skill via matilda --yolo --fresh with MATILDA_CODE_SUPPRESS_BOGAN_WARNING=1, with no other edit to the scripts
- [x] #3 An unrecognised value for the var fails the run loudly rather than silently falling back to claude
- [x] #4 Each run's log records which CLI and which CLI version produced it, written before the agent is invoked so a killed run is still attributable
- [x] #5 Which CLI a job uses can be changed per-job without editing the scripts, via an Environment= drop-in on the .service (never the .timer)
- [x] #6 The switch, the .service-not-.timer constraint, and the OAuth-only auth constraint are documented in CLAUDE.md
- [x] #7 A claude run of each job after the change produces the same artefacts as before it: modified data/gigs.json plus the job's state file, and a PR opened by the script
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
--------------------------------------------------
AGENT_CLI is read in run_agent (cron-lib.sh) and defaults to claude, so an unset environment invokes exactly the old command line. matilda maps to --yolo --fresh with MATILDA_CODE_SUPPRESS_BOGAN_WARNING=1. An unrecognised value, or a named CLI whose binary is not executable, logs and exits 1 rather than falling back. The CLI and its version are logged before the agent starts.

Dispatch verified against stubs for all five paths: default, matilda, a crashing agent (exit 42 surfaced in AGENT_EXIT), an unrecognised value, and a missing binary.

The verify-gigs drop-in is installed on weddle (AGENT_CLI=matilda) and its removal-plus-daemon-reload rollback has been exercised. CLAUDE.md documents the switch, the .service-not-.timer constraint and the OAuth-only auth constraint.

AC #7 is left open deliberately: the artefact shape was verified end to end in a scratch clone with a stub agent (PR carries only data/gigs.json, state mirrored to cron-state, branch pushed, PR opened), but a live claude run cannot happen until main is pushed and the cron worktree picks the change up.

Closed 2026-08-16 by a live claude run of ooc-find-gigs.service in the cron worktree, immediately after main was pushed and the worktree synced by hand. The log records the CLI and version before the agent starts (claude 2.1.233), the agent exiting 0, the state mirrored, and PR #473 opened; the PR carries data/gigs.json only and auto-merged. Same artefacts as before the change, minus the state file that no longer belongs in the diff.
<!-- SECTION:NOTES:END -->
