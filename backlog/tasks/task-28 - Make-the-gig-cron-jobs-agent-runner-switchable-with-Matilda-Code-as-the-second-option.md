---
id: TASK-28
title: >-
  Make the gig cron jobs' agent runner switchable, with Matilda Code as the
  second option
status: To Do
assignee: []
created_date: '2026-08-13 22:09'
labels:
  - ops
  - cron
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Both scheduled jobs currently hardcode `claude -p "/find-gigs"` / `-p "/verify-gigs"`. Maincode are giving free access to Matilda Code (`matilda`, a Gemini-CLI fork driving their Australian-built matilda-code-1.0 model, 1M context), so it is worth being able to run either job on either CLI --- one env var, no script surgery, claude stays the default.

This repo is a better fit for the experiment than slop-salon: the jobs run as ben on weddle, where the Matilda OAuth profile already lives, and they run one at a time, so the shared-refresh-token risk that blocks a six-agent fleet doesn't apply here.

## What was already checked (2026-08-14, matilda 0.21.1 on weddle)

- headless one-shot works: `matilda --yolo --fresh "<prompt>"` runs, executes tools, exits 0. `MATILDA_CODE_SUPPRESS_BOGAN_WARNING=1` silences a stderr nag about auto-approval.
- a slash-style prompt invokes a skill, so `-p "/find-gigs"` maps onto `matilda --yolo --fresh "/find-gigs"`.
- skills are discovered at `.matilda/skills/<name>/SKILL.md`, plus `~/.matilda/skills` and `~/.agents/skills`. `.claude/skills/` is **not** read --- confirmed by a skill that claude can see and matilda cannot.
- a symlinked skill directory works, so `.matilda/skills/find-gigs -> ../../.claude/skills/find-gigs` keeps one copy of each SKILL.md.
- matilda's tools are named differently: `web_search`, `web_fetch`, `read_file`, `grep_search`, `glob`, `run_shell_command`, `skill`, `agent` (its subagent tool), `todo_write`.
- auth is OAuth-only (`matilda auth` has just login/logout/status). The endpoint takes a bearer token, but it expires in ~24h and only the CLI refreshes it. Nothing to plumb on weddle --- the profile is already in `~/.matilda/` --- but it is why this can't be an API-key-style swap.

## Open questions for whoever picks this up

- both SKILL.md files carry claude-specific frontmatter: `allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task`, `model: sonnet`, `disable-model-invocation: true`. Does matilda enforce `allowed-tools` (which would strip every tool, since none of those names exist there) or ignore it?
- the skill bodies use claude's inline bash injection (`` !`head -5 data/pollies.csv` ``). Matilda has no equivalent in SKILL.md, so those lines land as literal text --- check whether the run still gathers the same context.
- find-gigs fans out one subagent per pollie via `Task` with `subagent_type: general-purpose`. Does matilda's `agent` tool support the same parallel fan-out, and what replaces `model: sonnet`?
- search quality is the whole job: compare the gigs a matilda run finds against a claude run over the same pollie set before trusting it.
- free-access terms and rate limits are unknown; a find run is a big fan-out, so watch `~/.matilda/usage_record.jsonl` (one JSON line per session with requests/input/output/cached tokens).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both cron scripts read the agent CLI from one env var that defaults to claude, so an unset environment runs exactly as it does today
- [ ] #2 Setting that var to matilda makes each job run its skill under matilda --yolo --fresh, with no other edit to the scripts
- [ ] #3 Each SKILL.md exists once in the repo and resolves under both CLIs, with no duplicated skill content to keep in sync
- [ ] #4 Both skills run under matilda with working web search, web fetch, file reads and subagent fan-out, after whatever frontmatter and tool-name reconciliation that needs
- [ ] #5 A matilda run of each job produces the same artefacts as a claude run: modified data/gigs.json plus the job's state file, no commits made by the agent itself, and a PR opened by the script
- [ ] #6 Each run's log records which CLI produced it, so a PR's provenance is inspectable after the fact
- [ ] #7 Which CLI a job uses can be changed without editing the scripts (unit Environment= or a systemd drop-in), and the switch is documented in CLAUDE.md along with the OAuth-only auth constraint
- [ ] #8 A matilda find run and a claude find run over the same pollie set have been compared, and the result recorded on this task
<!-- AC:END -->
