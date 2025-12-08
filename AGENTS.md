# Agents

VitePress site with TypeScript. Data loaded at build time from CSV. Always do
things the idiomatic VitePress way, using modern TypeScript and Vue best
practices.

This static site is hosted at `https://www.outofoffice.cv` using GitHub Pages.

## Commands

- `npm run dev` — development server (includes TypeScript type checking)
- `npm run build` — production build (includes TypeScript type checking)
- `npm run test` — run integration tests

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
