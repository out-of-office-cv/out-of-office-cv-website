# Agents

Astro 6 site with TypeScript and Svelte 5. Data loaded at build time from CSV
and JSON. Always do things the idiomatic Astro way, using modern TypeScript,
Svelte 5 runes, and Astro best practices.

This static site is hosted at `https://www.outofoffice.cv` using GitHub Pages.

## Commands

- `pnpm dev` --- development server
- `pnpm build` --- production build
- `pnpm check` --- Astro type checking
- `pnpm test` --- run integration tests

## Scripts

- `pnpm fetch-pollies` --- fetch pollie data from APH Parliamentary Handbook API
  - `--since YYYY` --- fetch pollies who left since year (default 1980)
  - `--dry-run` --- preview without writing file
  - `--output <path>` --- custom output path (default `data/pollies.csv`)

## Scheduled jobs

Two scripts run on weddle via systemd user timers (canonical unit files in
`ops/systemd/`):

- `cron-verify-gigs.sh` --- daily 02:00 local; rechecks each known gig
- `cron-find-gigs.sh` --- 05, 08, 11, 14, 17, 20 and 23:00 local; searches for
  new gigs

Both have 30 min `RandomizedDelaySec` jitter and `Persistent=true`. The tracked
units say daily 05:00 for find; the seven-slot schedule is a `.timer` drop-in
(see "Cadence" below), so deleting one file restores daily.

Both jobs run under matilda as of 2026-08-16.

They do not run in this checkout. They run in a dedicated git worktree at
`../out-of-office-cv-website-cron`, kept permanently detached at `origin/main`,
so cron never touches whatever branch you have checked out here (and vice
versa). Each run starts with `git fetch` +
`git checkout -f --detach origin/main`, so it never rebases and can never wedge
on a conflict. Detached rather than on `main` because two worktrees cannot check
out the same branch.

The worktree needs its own `node_modules` --- the skills run `pnpm build` (and
`pnpm test`) --- but only once. Set up:

```sh
git worktree add --detach ../out-of-office-cv-website-cron origin/main
cd ../out-of-office-cv-website-cron && pnpm install
```

Install the units (paths inside them point at the worktree):

```sh
cp ops/systemd/*.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now ooc-verify-gigs.timer ooc-find-gigs.timer
```

Logs via `journalctl --user -u <name>.service -n 50`, or the per-day files in
the worktree's `logs/`.

Both jobs serialise on `.cron.lock` in the worktree, waiting up to 15 minutes
(`LOCK_WAIT_SECS`) before skipping their slot, so two runs can never share the
checkout. A skipped run logs why and exits zero.

A crashed agent instead exits with the agent's own status, so systemd marks the
unit failed and `systemctl --user --failed` shows it. That holds even when the
run still committed and opened a PR (whose body is marked partial): the exit
status is the only signal a health check reads, and partial work is still a
fault. It matters because a dead agent and a genuinely quiet search leave the
same absent diff --- for a day from 2026-08-25 every run died on a bad
dispatcher flag while the log said "No new gigs found" and the unit said it had
succeeded.

### Cadence

The roster is 817 pollies at 15 per find run, and a pollie becomes eligible
again 14 days after its last search, so saturation is about 58 pollies/day ---
just under 4 runs/day. Seven runs/day is deliberately above that: it is a
catch-up setting for the several-hundred-pollie never-searched backlog, not a
steady state. Once the first full sweep completes, drop back to every 6h, or
runs increasingly find fewer than 15 eligible pollies and taper into no-ops that
still cost a full agent invocation.

Verify stays at one run a day and has ample headroom either way: its batch cap
is 60 gigs per run, against the 7--14 new gigs a day seven find runs produce.

Change the cadence with a `.timer` drop-in, never the tracked unit:

```sh
mkdir -p ~/.config/systemd/user/ooc-find-gigs.timer.d
cat > ~/.config/systemd/user/ooc-find-gigs.timer.d/cadence.conf <<'CONF'
[Timer]
OnCalendar=
OnCalendar=*-*-* 05,08,11,14,17,20,23:00:00
CONF
systemctl --user daemon-reload
```

The bare `OnCalendar=` first is a reset: systemd accumulates `OnCalendar`
entries across drop-ins, so without it the new schedule is _added_ to the
tracked 05:00 rather than replacing it. Dropping back to steady state means
editing that file to `*-*-* 02/6:00:00`-style hours, or deleting it for the
tracked daily schedule. Either way `daemon-reload` after.

Expect a run to fire immediately after a timer edit: with `Persistent=true`
systemd treats a slot that has passed since the last trigger as a missed run and
catches it up. That is safe now the jobs hold a lock, but it does mean an edit
can cost an unplanned agent run.

### Editing these scripts

A run syncs the worktree to `origin/main` and then re-execs itself, because the
scripts are among the files that checkout replaces, and bash reads a script
incrementally --- without the re-exec, the rest of the run would execute a
different file from a stale byte offset.

That protects every change except the one that introduced it, since the run that
first picks it up is still executing the old code. After pushing a change to
these scripts, sync the cron worktree by hand before the next timer fires:

```sh
git -C ../out-of-office-cv-website-cron fetch origin
git -C ../out-of-office-cv-website-cron checkout -f --detach origin/main
```

Skipping it costs one failed run, not data: state lives on the `cron-state`
branch and the next run restores it.

One invariant to preserve if you touch the git plumbing: **after the initial
sync, a run must never refer to `origin/main` again.** Remote-tracking refs are
shared across every worktree of a repository, so a `git fetch` in your checkout
moves `origin/main` inside a job that is halfway through a 45-minute agent run.
The script pins `RUN_BASE` at sync time and uses that instead; the finished
data-only commit is then replayed onto current `origin/main` immediately before
pushing. Both halves matter --- GitHub squash-merges a PR against main's tip, so
a branch built on a stale base does not merely omit what landed in between, it
reverts it.

### Search-throttle state

`data/find-state.json` and `data/verify-state.json` are untracked. They are
machine bookkeeping, and routing them through a PR made the throttle depend on
merge latency: every run in a queue of unmerged PRs saw the same stale state,
re-picked the same pollies, and duplicated the work.

The copy in the cron worktree is authoritative --- untracked files survive both
`git checkout -f --detach` and `git reset --hard`, so it is simply always there.
Each run mirrors it onto the long-lived `cron-state` branch, and restores it
from there when it is missing (a fresh worktree). The mirror is best effort: a
failed push logs and moves on, because local is the source of truth.

Read the current throttle without ssh:

```sh
git fetch origin cron-state
git show origin/cron-state:data/find-state.json
```

Both jobs share that one branch, so a mirror must carry the file it does not
own. `mirror_state` seeds its scratch index from the current mirror before
adding the caller's paths; without that seed `write-tree` serialises an index
holding only the caller's file and the commit deletes the other job's state.
That is exactly what happened on 2026-08-16 --- the seed carried both files, the
next find run replaced the tree with `find-state.json` alone, and
`verify-state.json` was gone until it was restored from the last tracked copy.

Never merge `cron-state` into `main`; it is a parallel history holding only
those two files.

### Interrupted find runs

Each find-gigs subagent banks its pollie in `data/.find-inflight/<slug>.json`
before returning, and the orchestrator merges those into `gigs.json` one pollie
at a time. The directory is untracked, so a run killed mid-fan-out leaves its
sidecars for the next run, which merges them before selecting --- those pollies
are then recorded as searched instead of being researched again. Sidecars are
deleted only after `pnpm build` passes, so a validation failure retries them
rather than dropping them.

### Choosing the agent profile

The jobs run through `~/.dotfiles/bin/agent-run`. `AGENT_PROFILE` selects its
profile and defaults to `claude-sub`, so an unset environment still runs native
Claude Code against Ben's subscription. Switch one job without touching the
scripts:

```sh
mkdir -p ~/.config/systemd/user/ooc-find-gigs.service.d
cat > ~/.config/systemd/user/ooc-find-gigs.service.d/runner.conf <<'CONF'
[Service]
Environment=AGENT_PROFILE=codex-sub
CONF
systemctl --user daemon-reload
```

`AGENT_MODEL` picks the model the same way and takes the same kind of drop-in.
Unset takes the profile's model, or the native CLI's default when that profile
does not declare one. The live service drop-ins keep both jobs on `sonnet`,
exactly as before this migration. A model name is only as portable as the
provider that serves it, so change or remove that drop-in when changing from
`claude-sub` to `deepseek` or `openrouter`.

The shared profiles are `claude-sub`, `codex-sub`, `deepseek` and `openrouter`;
list them with `agent-run --list-profiles`. DeepSeek and OpenRouter use API keys
from the untracked local mise environment. The subscription profiles invoke the
official CLIs directly; the dispatcher never imports their OAuth tokens.

Roll back by deleting either file and reloading. One constraint is load-bearing:

- **Drop-ins go on the `.service`, never the `.timer`.** Editing a timer with
  `Persistent=true` fires an immediate catch-up of both gig timers at once.

## Structure

The two main types in this site's data model are `Pollie` (a politician) and
`Gig` (a gig/job/role they take after leaving office). These are defined in
`src/types.ts`.

- `astro.config.ts` --- site config
- `src/types.ts` --- shared TypeScript interfaces
- `src/utils/` --- shared utility functions (CSV parsing, date formatting,
  pollie helpers)
- `src/loaders.ts` --- data loading from CSV and JSON
- `src/content.config.ts` --- Astro content collection with custom loader
- `src/layouts/BaseLayout.astro` --- main page layout
- `src/components/*.astro` --- server-rendered Astro components (zero JS)
- `src/components/*.svelte` --- interactive Svelte 5 islands (client:load)
- `src/stores/*.svelte.ts` --- Svelte 5 reactive stores (draft gigs, GitHub
  auth, PR)
- `src/pages/index.astro` --- home page with PollieList island
- `src/pages/about.md` --- about page
- `src/pages/contribute.astro` --- contribute page with GigEntryForm island
- `src/pages/pollies/[slug].astro` --- dynamic pollie detail pages
- `data/pollies.csv` --- pollie data from APH Parliamentary Handbook API
- `data/gigs.json` --- post-office roles data
- `data/gigs.ts` --- typed re-export of `gigs.json` as `Gig[]`
- `data/gigs-schema.ts` --- Zod schema for gig validation
