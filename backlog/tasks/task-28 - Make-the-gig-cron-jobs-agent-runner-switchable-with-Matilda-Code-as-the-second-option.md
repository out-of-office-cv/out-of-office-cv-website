---
id: TASK-28
title: Make the gig cron jobs' agent runner switchable via one env var
status: To Do
assignee: []
created_date: '2026-08-13 22:09'
updated_date: '2026-08-13 23:25'
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
- [ ] #1 Both cron scripts read the agent CLI from one env var that defaults to claude, so an unset environment runs exactly as it does today
- [ ] #2 Setting that var to matilda makes each job run its skill via matilda --yolo --fresh with MATILDA_CODE_SUPPRESS_BOGAN_WARNING=1, with no other edit to the scripts
- [ ] #3 An unrecognised value for the var fails the run loudly rather than silently falling back to claude
- [ ] #4 Each run's log records which CLI and which CLI version produced it, written before the agent is invoked so a killed run is still attributable
- [ ] #5 Which CLI a job uses can be changed per-job without editing the scripts, via an Environment= drop-in on the .service (never the .timer)
- [ ] #6 The switch, the .service-not-.timer constraint, and the OAuth-only auth constraint are documented in CLAUDE.md
- [ ] #7 A claude run of each job after the change produces the same artefacts as before it: modified data/gigs.json plus the job's state file, and a PR opened by the script
<!-- AC:END -->
