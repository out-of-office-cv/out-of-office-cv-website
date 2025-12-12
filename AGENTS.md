# Agents

VitePress site with TypeScript. Data loaded at build time from CSV. Always do
things the idiomatic VitePress way, using modern TypeScript and Vue best
practices.

This static site is hosted at `https://www.outofoffice.cv` using GitHub Pages.

## Commands

- `npm run dev` — development server (includes TypeScript type checking)
- `npm run build` — production build (includes TypeScript type checking)
- `npm run test` — run integration tests

## Scripts

- `npx tsx scripts/find-gigs.ts` — search for post-parliament gigs using OpenAI
  - `--list-candidates` or `-l` — list candidate pollies without running API
    search
  - `--strategy <name>` — selection strategy: `recent-no-gigs`,
    `recent-few-gigs`, `random`
  - `--limit N` — limit number of candidates shown (default 10)
  - `--pollie <slug>` — search for a specific pollie by slug
  - `--dry-run` — use mock data, don't write to file

## Type checking

vite-plugin-checker runs TypeScript and Vue type checking during dev and build.
Errors appear in the terminal and browser overlay. The build will fail on type
errors.

## Structure

The two main types in this site's data model are `Pollie` (a politician) and
`Gig` (a gig/job/role they take after leaving office). This (and a few other
helper types) are defined in `.vitepress/types.ts`.

- `.vitepress/config.ts` — site config
- `.vitepress/types.ts` — shared TypeScript interfaces
- `.vitepress/utils.ts` — shared utility functions (CSV parsing, date
  formatting)
- `pollies.data.ts` — data loader for home page (groups by decade)
- `pollies/[slug].paths.ts` — dynamic route generation for individual pages
- `data/gigs.ts` — post-office roles data
- `data/representatives.csv` — source data from OpenAustralia
