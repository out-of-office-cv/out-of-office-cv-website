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
- `cron-find-gigs.sh` --- daily 05:00 local; searches for new gigs

Both have 30 min `RandomizedDelaySec` jitter and `Persistent=true`.

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
checkout. A skipped run logs why and exits zero; a crashed agent logs its exit
code and marks the PR body as partial.

### Search-throttle state

`data/find-state.json` and `data/verify-state.json` are untracked. They are
machine bookkeeping, and routing them through a PR made the throttle depend on
merge latency: every run in a queue of unmerged PRs saw the same stale state,
re-picked the same pollies, and duplicated the work.

The copy in the cron worktree is authoritative --- untracked files survive both
`git checkout -f --detach` and `git reset --hard`, so it is simply always there.
Each run mirrors it onto the long-lived `cron-state` branch, and restores it from
there when it is missing (a fresh worktree). The mirror is best effort: a failed
push logs and moves on, because local is the source of truth.

Read the current throttle without ssh:

```sh
git fetch origin cron-state
git show origin/cron-state:data/find-state.json
```

Never merge `cron-state` into `main`; it is a parallel history holding only
those two files.

### Choosing the agent CLI

`AGENT_CLI` selects the runner and defaults to `claude`, so an unset environment
behaves exactly as it always has. `matilda` is the other accepted value; anything
else fails the run rather than falling back. Switch one job without touching the
scripts:

```sh
mkdir -p ~/.config/systemd/user/ooc-find-gigs.service.d
cat > ~/.config/systemd/user/ooc-find-gigs.service.d/runner.conf <<'CONF'
[Service]
Environment=AGENT_CLI=matilda
CONF
systemctl --user daemon-reload
```

Roll back by deleting that file and reloading. Two constraints worth knowing:

- **Drop-ins go on the `.service`, never the `.timer`.** Editing a timer with
  `Persistent=true` fires an immediate catch-up of both gig timers at once.
- **Matilda auth is OAuth-only.** `matilda auth` has only login/logout/status,
  the bearer token expires in ~24h, and only the CLI refreshes it. The profile
  lives in `~/.matilda/`, so there is nothing to plumb into the unit --- but a
  stale profile fails the job rather than degrading it. Matilda also serialises
  subagent fan-out, so its runs take far longer than claude's.

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
