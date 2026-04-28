# Analytics page — design

Design for a new `/analytics/` route that visualises the distribution of
post-parliament gigs by category, with a comparison view that splits the same
distribution by party group or by decade.

## Goals

- Answer "what is the distribution of post-parliament gigs by category?" at a
  glance.
- Answer "what differences are there between parties and between eras?"
  without forcing the reader to switch modes and remember what they saw.
- Reuse the same data source, decade window, and verification policy as the
  rest of the public site, so figures are consistent with the directory.
- Keep the page legible without JavaScript via a tabular fallback.

## Non-goals

- Drill-down from chart to pollie list. Categories are not clickable in this
  design; the directory remains the entry point for per-pollie data.
- Time-series animation or "play through the decades" interactivity.
- Custom filters (state, house, gender, etc.). Adding more split dimensions is
  a future iteration.
- Statistical inference or significance testing on small samples. Tooltips
  surface raw counts so readers can judge sample size themselves.

## Data scope

- Source: the `pollies` content collection (`src/content.config.ts`), which
  already attaches each pollie's gigs and filters out `rejected` gigs.
- Includes both `verified` and `unverified` gigs, matching the public
  directory's policy.
- Excludes pollies whose `ceasedDate` falls before 1980, matching the
  directory's `isDecade1980sOrLater` filter. This drops their gigs entirely
  from both charts.
- Categories with zero gigs across the whole dataset are dropped from the
  category axis. Party groups and decades with zero gigs are dropped from
  their respective column axes.
- `byParty` and `byDecade` only contain cells with non-zero counts. Empty
  cells in the heatmap are produced by Vega-Lite's normal missing-value
  rendering (no fill), which is what we want visually --- a blank cell reads
  as "zero gigs in this group" without needing a special palette entry.

## Party grouping

A new helper `groupParty(party: string): PartyGroup` lives in
`src/utils/pollie.ts`. The mapping:

| Group     | Codes                              |
|-----------|------------------------------------|
| ALP       | ALP                                |
| Liberal   | LIB, LNP, CLP                      |
| National  | NPA, NP, Nats, NCP                 |
| Greens    | GRN                                |
| Other     | IND, PHON, UAP, PUP, AD, plus any unknown code |

`PartyGroup` is a string-literal union exported alongside the function. The
existing `getPartyColour` map is unchanged.

## Page structure

`src/pages/analytics.astro`:

1. `<h1>Analytics</h1>`.
2. Preamble paragraph: figures are derived from the same data as the
   directory (verified and unverified gigs, rejected gigs excluded, pollies
   who left office from 1980 onwards). Data may have errors --- link to
   `/contribute` to flag corrections.
3. `<section>` containing the headline chart, with a `<figcaption>`
   summarising the takeaway in prose and a `<details><summary>Data
   table</summary><table>` fallback.
4. `<section>` containing the comparison chart, with the same caption +
   table-fallback pattern, plus a segmented toggle (Party / Decade) above the
   chart.

`Nav.astro` gains an "Analytics" link between **Directory** and **About**.

## Data pipeline

A new pure-function module `src/utils/analytics.ts` exports:

```ts
export interface AnalyticsRow {
  category: GigCategory;
  partyGroup: PartyGroup;
  decade: string;
}

export interface CategoryTotal {
  category: GigCategory;
  count: number;
}

export interface ColumnCell<Col extends string> {
  category: GigCategory;
  column: Col;
  count: number;
  proportion: number;     // count / columnTotal
  columnTotal: number;
}

export interface AnalyticsData {
  categoryTotals: CategoryTotal[];        // sorted desc, ties broken alphabetically
  byParty: ColumnCell<PartyGroup>[];
  byDecade: ColumnCell<string>[];
}

export function computeAnalytics(rows: AnalyticsRow[]): AnalyticsData;
```

`analytics.astro` frontmatter:

1. `await getCollection("pollies")`.
2. For each pollie, derive `partyGroup` (via `groupParty`) and `decade` (via
   `getDecade(parseDate(ceasedDate))`).
3. Drop pollies whose decade fails `isDecade1980sOrLater`.
4. Flatten to `AnalyticsRow[]` --- one row per remaining gig.
5. `const data = computeAnalytics(rows)`.
6. Pass `data.categoryTotals` to `CategoryDistributionChart`, and `data.byParty`
   + `data.byDecade` to `CategoryComparisonChart`.

## Components

Two Svelte 5 islands, both `client:load`, both rendering Vega-Lite charts via
`vega-embed`:

### `src/components/CategoryDistributionChart.svelte`

- Props: `{ data: CategoryTotal[] }`.
- Horizontal bar chart, one row per category, sorted descending by count
  (order locked by passing the array verbatim to Vega and disabling its
  internal sort).
- Each bar coloured by category, drawing from a 23-entry categorical palette
  defined in a new `src/utils/categoryColours.ts` (also exported as a
  `Record<GigCategory, string>` so future surfaces can re-use it).
- Tooltip per bar: `{category}: {count} gigs`.
- Vega-Lite spec is built inline in the `<script>` block; no external
  `.vl.json` files.

### `src/components/CategoryComparisonChart.svelte`

- Props: `{ byParty: ColumnCell<PartyGroup>[]; byDecade: ColumnCell<string>[] }`.
- Local state: `let mode = $state<"party" | "decade">("party")`.
- Above the chart: a two-button segmented control with `aria-pressed` on the
  active button and an `aria-label` of "Split by".
- Heatmap: Y axis = category (same locked order as the headline chart, even
  for categories that have zero gigs in the current split --- they appear as
  empty rows so the eye can compare across modes), X axis = party group or
  decade, cell fill = `proportion` on a sequential single-hue ramp.
- Tooltip per cell: `{category} · {column}: {count} of {columnTotal}
  ({proportion as %})`.
- One `<div>` render target. On `mode` change, an `$effect` re-calls
  `vegaEmbed(div, specForMode(mode))` with the appropriate dataset.

### Vega configuration

A shared `src/utils/vegaTheme.ts` exports a Vega config object that pulls
axis/title/font colours from CSS custom properties at runtime (read via
`getComputedStyle(document.documentElement)`). This keeps the chart
typography aligned with the rest of the site without duplicating the design
tokens.

## Accessibility

- Each chart has a visible `<figcaption>` summarising the takeaway in prose.
- Each chart has a `<details><summary>Data table</summary><table>` fallback
  rendering the same data, server-rendered in the `.astro` page so it's
  available without JavaScript.
- Toggle buttons use `aria-pressed`. Their target chart is referenced via
  `aria-controls`.
- Tooltips are not the only path to exact figures --- the table fallback
  carries the same data.

## Dependencies

Add to `dependencies` in `package.json`:

- `vega`
- `vega-lite`
- `vega-embed`

These are runtime deps because the chart specs are compiled in the browser by
the Svelte islands. Bundle size will increase by ~200&nbsp;KB gzipped on the
analytics page only --- other pages are unaffected because the islands aren't
imported elsewhere.

## Testing

- `tests/analytics.test.ts` covers `computeAnalytics`:
  - empty input → empty `categoryTotals`, `byParty`, `byDecade`
  - `categoryTotals` sorted descending by count, ties broken alphabetically
  - per-column proportions sum to 1.0 within float tolerance
  - `columnTotal` matches the sum of `count` over each column's cells
  - categories with zero overall gigs are dropped
  - party groups / decades with zero gigs are absent from their axis
- `tests/pollie.test.ts` (extend if present, create otherwise) covers
  `groupParty`:
  - each known code maps to the expected group
  - unknown code → "Other"
- No Vega rendering tests in this iteration. Vega-Lite specs are
  configuration; the data they consume is exercised by the unit tests above,
  and the rendered page has the table fallback for ground truth.

## Manual verification checklist (pre-merge)

- `pnpm dev`, navigate to `/analytics/`.
- Headline chart renders, categories sorted desc, hover shows tooltip.
- Comparison chart starts in Party mode; toggle to Decade re-renders without
  flicker.
- Both charts share identical category row order.
- Tab order: nav → toggle buttons → details summary → table.
- With JavaScript disabled: page still loads, both `<details>` tables are
  present and contain the same numbers as the rendered charts.
- `pnpm check`, `pnpm test`, `pnpm build` all pass.

## Out of scope / future iterations

- Per-state, per-house, per-gender splits.
- Time-series view (e.g. each decade as a small-multiple line chart of
  category share over time).
- Drill-down from a category to the pollies who took those gigs.
- Significance tests / confidence intervals on small samples.
