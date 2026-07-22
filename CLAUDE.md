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
