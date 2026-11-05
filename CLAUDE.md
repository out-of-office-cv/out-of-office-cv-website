# Out of Office CV

Astro 7 site with TypeScript and Svelte 5. Data loaded at build time from CSV
and JSON. Always do things the idiomatic Astro way, using modern TypeScript,
Svelte 5 runes, and Astro best practices.

This static site is hosted at `https://www.outofoffice.cv` using GitHub Pages.

## Commands

Node and pnpm come from `mise.toml`; prefix with `mise exec --` outside a mise
shell.

- `pnpm dev` --- development server
- `pnpm build` --- production build
- `pnpm typecheck` --- Astro type checking
- `pnpm lint` --- oxlint, then stylelint (`pnpm lint:css`)
- `pnpm format` / `pnpm format:check` --- oxfmt
- `pnpm test` --- run integration tests

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
- `src/pages/index.astro` --- home page with DirectoryFilters island
- `src/pages/about.md` --- about page
- `src/pages/contribute.astro` --- contribute page with GigEntryForm island
  (`client:idle`)
- `src/pages/pollies/[slug].astro` --- dynamic pollie detail pages
- `data/pollies.csv` --- pollie data from APH Parliamentary Handbook API
- `data/gigs.json` --- post-office roles data
- `data/gigs.ts` --- typed re-export of `gigs.json` as `Gig[]`
- `data/gigs-schema.ts` --- Zod schema for gig validation
