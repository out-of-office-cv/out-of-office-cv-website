---
id: doc-1
title: Matilda switchover runbook
type: guide
created_date: '2026-08-16 03:45'
---


The plan for moving the gig cron jobs from claude to Matilda Code, and back
again. Four tasks, in dependency order, each independently landable. Nothing
here is irreversible: every step is either a default-off switch or a systemd
drop-in that backs out by deleting a file.

## Why this order

task-29 (hardening) comes first and has no dependencies, because everything else
either lengthens runs or multiplies them, and both make the current
shared-worktree and all-or-nothing-write-back weaknesses much likelier to fire.
It is worth landing on the claude setup regardless of whether matilda ever
happens.

task-28 (the switch) changes no behaviour on its own --- with the env var unset,
both jobs run exactly as today.

task-30 (the port) is what makes a matilda run actually good. It is gated on
both of the above.

task-31 (cadence) is last because raising frequency is unsafe until run-to-run
state stops depending on PR merge latency.

## Sequence

1. **Harden** (task-29). flock on the shared worktree, per-pollie write-back for
   both `gigs.json` and `find-state.json`, agent exit code captured and logged.
   Verify by starting both jobs by hand at once.
2. **Land the switch** (task-28). `AGENT_CLI` defaults to claude. Confirm a
   normal claude run is byte-for-byte unchanged in behaviour before going on.
3. **Port the skills** (task-30). Symlink `.matilda/skills/<name>` at the
   `.claude/skills` copy; strip `$ARGUMENTS` and inline-bash dependence from the
   bodies; re-run under claude first to prove no regression, then under matilda.
4. **Switch one job** via drop-in. verify-gigs first: it is the smaller job and
   the cheaper mistake. Watch a few runs, compare PR quality, then decide about
   find-gigs.
5. **Raise cadence** (task-31), only once find-state no longer round-trips
   through an unmerged PR.

## Switching a job to matilda

```sh
mkdir -p ~/.config/systemd/user/ooc-find-gigs.service.d
cat > ~/.config/systemd/user/ooc-find-gigs.service.d/runner.conf <<'CONF'
[Service]
Environment=AGENT_CLI=matilda
CONF
systemctl --user daemon-reload
```

Drop-ins go on the `.service`, never the `.timer`: editing a timer with
`Persistent=true` fires an immediate catch-up of both gig timers at once, and
before task-29 lands they collide on the shared worktree.

## Switching back

```sh
rm ~/.config/systemd/user/ooc-find-gigs.service.d/runner.conf
systemctl --user daemon-reload
```

That is the whole rollback for the runner. No script edit, no skill edit, no
revert. The same applies to the timeout drop-in from task-30 and the cadence
drop-in from task-31 --- delete the file, reload, and the tracked unit's value
applies again.

Two rollback properties are acceptance criteria rather than prose, so they get
exercised rather than assumed: task-30 requires the runner rollback to have been
performed, and task-31 requires the cadence rollback to have been performed.

Rolling back the *skills* is different in kind: the task-30 rewording is a
permanent change to the shared SKILL.md files, deliberately kept good under both
CLIs. It is covered by its own AC (a claude run after rewording must match one
before it), not by a switch.

## Known constraints

- **Auth is OAuth-only.** `matilda auth` has just login/logout/status. The
  bearer token expires in ~24h and only the CLI refreshes it. The profile
  already exists in `~/.matilda/` on weddle, so there is nothing to plumb --- but
  it is why the runner cannot be selected by credential, and why a stale profile
  fails the job rather than degrading it.
- **Matilda serialises subagents.** Confirmed empirically; see task-30. Costs
  wall-clock per run, but does not limit coverage at the ~4 runs/day the roster
  actually needs.
- **Matilda misreports its own concurrency.** It claimed a serial fan-out ran in
  parallel and succeeded. Do not trust a run's self-report when comparing CLIs;
  compare artefacts.
- **Free-access terms and rate limits are unknown.** Measure one full find run's
  usage from `~/.matilda/usage_record.jsonl` before raising cadence, not after.
