# Agents

Astro 6 site with TypeScript, Svelte 5, and Bits UI. Data loaded at build time
from CSV and JSON. Always do things the idiomatic Astro way, using modern
TypeScript, Svelte 5 runes, and Astro best practices.

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
- `pnpm find-gigs` --- search for post-parliament gigs using OpenAI
  - `--list-candidates` or `-l` --- list candidate pollies without running API
    search
  - `--limit N` --- limit number of candidates shown (default 10)
  - `--pollie <slug>` --- search for a specific pollie by slug
  - `--dry-run` --- use mock data, don't write to file

## Structure

The two main types in this site's data model are `Pollie` (a politician) and
`Gig` (a gig/job/role they take after leaving office). These are defined in
`src/types.ts`.

- `astro.config.ts` --- site config
- `src/types.ts` --- shared TypeScript interfaces
- `src/utils/` --- shared utility functions (CSV parsing, date formatting, pollie helpers)
- `src/loaders.ts` --- data loading from CSV and JSON
- `src/content.config.ts` --- Astro content collection with custom loader
- `src/layouts/BaseLayout.astro` --- main page layout
- `src/components/*.astro` --- server-rendered Astro components (zero JS)
- `src/components/*.svelte` --- interactive Svelte 5 islands (client:load)
- `src/stores/*.svelte.ts` --- Svelte 5 reactive stores (draft gigs, GitHub auth, PR)
- `src/pages/index.astro` --- home page with PollieList island
- `src/pages/pollies/[slug].astro` --- dynamic pollie detail pages
- `data/pollies.csv` --- pollie data from APH Parliamentary Handbook API
- `data/gigs.json` --- post-office roles data
- `data/gigs-schema.ts` --- Zod schema for gig validation
