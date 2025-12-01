# Agents

VitePress site with TypeScript. Data loaded at build time from CSV.

## Commands

- `npm run dev` — development server
- `npm run build` — production build

## Structure

- `.vitepress/config.ts` — site config
- `data/pollies.data.ts` — data loader for CSV
- `pollies/[slug].paths.ts` — dynamic route generation
