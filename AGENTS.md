# Out of Office CV

Astro 7 site with TypeScript and Svelte 5. Data loaded at build time from CSV
and JSON.

This static site is hosted at `https://www.outofoffice.cv` using GitHub Pages.

## Commands

Node and pnpm come from `mise.toml`; prefix with `mise exec --` outside a mise
shell.

The scripts are in `package.json` (`pnpm lint` runs oxlint, then stylelint).

CI (`.github/workflows/deploy.yml`) runs typecheck, lint, format:check and test
before building.

## Scripts

- `pnpm fetch-pollies` --- fetch pollie data from APH Parliamentary Handbook API
  - `--since YYYY` --- fetch pollies who left since year (default 1980)
  - `--dry-run` --- preview without writing file
  - `--output <path>` --- custom output path (default `data/pollies.csv`)

## Scheduled jobs

`cron-find-gigs.sh` and `cron-verify-gigs.sh` run on weddle from systemd user
timers (`ops/systemd/`), through matilda, in a separate detached worktree at
`../out-of-office-cv-website-cron`. Never work in that worktree. The scripts'
headers and `cron-lib.sh` explain the lock, the sync and re-exec, `RUN_BASE`,
the `cron-state` mirror and the agent profile; read them before changing the git
plumbing.

- A run executes the scripts it checked out, so a change to them first takes
  effect on the run after it. After pushing one, sync the worktree by hand
  (`git -C ../out-of-office-cv-website-cron fetch origin` then
  `checkout -f --detach origin/main`).
- After the initial sync, a run must never refer to `origin/main` again: a fetch
  in another worktree moves it mid-run. Use `RUN_BASE`.
- Never edit the tracked units to change behaviour; use drop-ins in
  `~/.config/systemd/user/`. `AGENT_PROFILE` and `AGENT_MODEL` go in a
  `.service` drop-in. Cadence goes in a `.timer` drop-in that starts with a bare
  `OnCalendar=` to reset the tracked schedule. Editing a `Persistent=true` timer
  fires a catch-up run of both jobs at once.
- `data/find-state.json` and `data/verify-state.json` are untracked throttle
  state, mirrored to the `cron-state` branch. Never merge that branch into
  `main`. Read it with `git fetch origin cron-state` and
  `git show origin/cron-state:data/find-state.json`.
- Logs: `journalctl --user -u <name>.service`, or `logs/` in the worktree.

## Structure

The two main types in this site's data model are `Pollie` (a politician) and
`Gig` (a gig/job/role they take after leaving office). These are defined in
`src/types.ts`.

`data/` holds `pollies.csv` (from the APH Parliamentary Handbook API),
`gigs.json` (post-office roles), `gigs.ts` (typed re-export as `Gig[]`) and
`gigs-schema.ts` (Zod schema for gig validation).
