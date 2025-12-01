# Agents

VitePress site with TypeScript. Data loaded at build time from CSV.

## Commands

- `npm run dev` — development server
- `npm run build` — production build
- `npm run test` — run integration tests

## Structure

- `.vitepress/config.ts` — site config
- `.vitepress/types.ts` — shared TypeScript interfaces
- `.vitepress/utils.ts` — shared utility functions (CSV parsing, date
  formatting)
- `pollies.data.ts` — data loader for home page (groups by decade)
- `pollies/[slug].paths.ts` — dynamic route generation for individual pages
- `data/gigs.ts` — post-office roles data
- `data/representatives.csv` — source data from OpenAustralia
