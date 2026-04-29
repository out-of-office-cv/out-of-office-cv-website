# Analytics page implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/analytics/` route that visualises the post-parliament-gig category distribution and a comparison view (party group / decade), with a table fallback for no-JS readers.

**Architecture:** Pure data pipeline (`computeAnalytics`) feeds two Svelte 5 client islands rendering Vega-Lite charts. Page frontmatter does the data flattening at build time and renders a server-side `<details><table>` fallback alongside each chart. Nav gains an Analytics link.

**Tech Stack:** TypeScript, Astro 6, Svelte 5 (runes), Vega / Vega-Lite / vega-embed, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-28-analytics-page-design.md`

---

## File structure

### Created

- `src/utils/analytics.ts` — `AnalyticsRow`, `CategoryTotal`, `ColumnCell`, `AnalyticsData`, `computeAnalytics`
- `src/utils/categoryColours.ts` — 23-entry palette keyed by `GigCategory`
- `src/utils/vegaTheme.ts` — runtime Vega config from CSS custom properties
- `src/components/CategoryDistributionChart.svelte` — horizontal bar chart island
- `src/components/CategoryComparisonChart.svelte` — heatmap with party/decade toggle island
- `src/pages/analytics.astro` — page with both charts + table fallbacks
- `tests/analytics.test.ts` — `computeAnalytics` unit tests

### Modified

- `src/utils/pollie.ts` — add `PartyGroup` type and `groupParty` helper
- `src/utils/index.ts` — re-export `groupParty` and `PartyGroup`
- `src/components/Nav.astro` — add Analytics link between Directory and About
- `tests/utils.test.ts` — extend with `groupParty` cases (lives next to the existing `getPartyColour` tests)
- `package.json` — add `vega`, `vega-lite`, `vega-embed` runtime deps

> **Note on test placement.** The spec mentions `tests/pollie.test.ts (extend if present, create otherwise)`. The existing pollie helpers (`slugify`, `getPartyColour`, `deduplicatePollies`) are already covered by `tests/utils.test.ts`; a sibling `tests/pollies.test.ts` (note the plural `s`) covers build-time integration. Creating a new singular `tests/pollie.test.ts` would invite confusion, so this plan extends `tests/utils.test.ts` instead.

---

## Phase 1 — Data layer (pure functions, TDD)

### Task 1: Add `PartyGroup` type and `groupParty` helper

**Files:**
- Modify: `src/utils/pollie.ts`
- Modify: `tests/utils.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/utils.test.ts`, right after the existing `describe("getPartyColour", ...)` block:

```ts
import { groupParty } from "../src/utils/pollie";

describe("groupParty", () => {
  it("maps ALP to ALP", () => {
    expect(groupParty("ALP")).toBe("ALP");
  });

  it("maps Liberal-family codes to Liberal", () => {
    expect(groupParty("LIB")).toBe("Liberal");
    expect(groupParty("LNP")).toBe("Liberal");
    expect(groupParty("CLP")).toBe("Liberal");
  });

  it("maps National-family codes to National", () => {
    expect(groupParty("NPA")).toBe("National");
    expect(groupParty("NP")).toBe("National");
    expect(groupParty("Nats")).toBe("National");
    expect(groupParty("NCP")).toBe("National");
  });

  it("maps GRN to Greens", () => {
    expect(groupParty("GRN")).toBe("Greens");
  });

  it("maps independents and minor parties to Other", () => {
    expect(groupParty("IND")).toBe("Other");
    expect(groupParty("PHON")).toBe("Other");
    expect(groupParty("UAP")).toBe("Other");
    expect(groupParty("PUP")).toBe("Other");
    expect(groupParty("AD")).toBe("Other");
  });

  it("maps unknown codes to Other", () => {
    expect(groupParty("XXX")).toBe("Other");
    expect(groupParty("")).toBe("Other");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test tests/utils.test.ts`
Expected: FAIL with `groupParty is not a function` (or similar import error).

- [ ] **Step 3: Implement the helper**

In `src/utils/pollie.ts`, after the `getPartyColour` function (line 38) and before `deduplicatePollies` (line 40), add:

```ts
export type PartyGroup = "ALP" | "Liberal" | "National" | "Greens" | "Other";

const partyGroupMap: Record<string, PartyGroup> = {
  ALP: "ALP",
  LIB: "Liberal",
  LNP: "Liberal",
  CLP: "Liberal",
  NPA: "National",
  NP: "National",
  Nats: "National",
  NCP: "National",
  GRN: "Greens",
};

export function groupParty(party: string): PartyGroup {
  return partyGroupMap[party] ?? "Other";
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm test tests/utils.test.ts`
Expected: PASS (all `groupParty` cases).

- [ ] **Step 5: Re-export from the utils barrel**

In `src/utils/index.ts`, change the existing pollie re-export block (lines 11-16) to:

```ts
export {
  slugify,
  getPartyColour,
  groupParty,
  deduplicatePollies,
  type PartyColour,
  type PartyGroup,
} from "./pollie";
```

- [ ] **Step 6: Run the typecheck**

Run: `pnpm check`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/pollie.ts src/utils/index.ts tests/utils.test.ts
git commit -m "Add groupParty helper and PartyGroup type"
```

### Task 2: Create `computeAnalytics` and supporting types (TDD)

**Files:**
- Create: `src/utils/analytics.ts`
- Create: `tests/analytics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/analytics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeAnalytics } from "../src/utils/analytics";

describe("computeAnalytics", () => {
  it("returns empty totals for empty input", () => {
    const result = computeAnalytics([]);
    expect(result.categoryTotals).toEqual([]);
    expect(result.byParty).toEqual([]);
    expect(result.byDecade).toEqual([]);
  });

  it("aggregates a single row across all three views", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
    ]);
    expect(result.categoryTotals).toEqual([
      { category: "Legal & Judicial", count: 1 },
    ]);
    expect(result.byParty).toEqual([
      {
        category: "Legal & Judicial",
        column: "ALP",
        count: 1,
        proportion: 1,
        columnTotal: 1,
      },
    ]);
    expect(result.byDecade).toEqual([
      {
        category: "Legal & Judicial",
        column: "2010s",
        count: 1,
        proportion: 1,
        columnTotal: 1,
      },
    ]);
  });

  it("sorts categoryTotals desc by count, ties broken alphabetically", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Retired", partyGroup: "ALP", decade: "2010s" },
      { category: "Retired", partyGroup: "ALP", decade: "2010s" },
      {
        category: "Media, Communications & Public Relations",
        partyGroup: "ALP",
        decade: "2010s",
      },
    ]);
    expect(result.categoryTotals.map((t) => t.category)).toEqual([
      "Legal & Judicial",
      "Retired",
      "Media, Communications & Public Relations",
    ]);
  });

  it("computes per-column proportions that sum to 1 within float tolerance", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Legal & Judicial", partyGroup: "Liberal", decade: "2010s" },
      {
        category: "Media, Communications & Public Relations",
        partyGroup: "ALP",
        decade: "2020s",
      },
    ]);

    const sumPerColumn = (cells: { column: string; proportion: number }[]) => {
      const sums = new Map<string, number>();
      for (const c of cells) {
        sums.set(c.column, (sums.get(c.column) ?? 0) + c.proportion);
      }
      return sums;
    };

    for (const sum of sumPerColumn(result.byParty).values()) {
      expect(sum).toBeCloseTo(1, 10);
    }
    for (const sum of sumPerColumn(result.byDecade).values()) {
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("ensures columnTotal matches sum of count over each column", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      {
        category: "Media, Communications & Public Relations",
        partyGroup: "ALP",
        decade: "2010s",
      },
      {
        category: "Media, Communications & Public Relations",
        partyGroup: "Liberal",
        decade: "2020s",
      },
    ]);

    const totalByCol = new Map<string, number>();
    for (const cell of result.byParty) {
      totalByCol.set(cell.column, (totalByCol.get(cell.column) ?? 0) + cell.count);
      expect(cell.columnTotal).toBe(
        result.byParty
          .filter((c) => c.column === cell.column)
          .reduce((acc, c) => acc + c.count, 0),
      );
    }
    expect(totalByCol.get("ALP")).toBe(3);
    expect(totalByCol.get("Liberal")).toBe(1);
  });

  it("drops categories with zero gigs (impossible by construction — covered by empty input)", () => {
    // Placeholder: every row contributes a category, so no category can appear
    // with zero count in the output. The `categoryTotals: []` from empty input
    // already covers the "zero gigs across the dataset" case.
    const result = computeAnalytics([]);
    expect(result.categoryTotals).toEqual([]);
  });

  it("does not emit cells for column/category pairs with zero gigs", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
      { category: "Retired", partyGroup: "Liberal", decade: "2010s" },
    ]);
    // ALP has Legal but not Retired; Liberal has Retired but not Legal.
    expect(
      result.byParty.find(
        (c) => c.column === "ALP" && c.category === "Retired",
      ),
    ).toBeUndefined();
    expect(
      result.byParty.find(
        (c) => c.column === "Liberal" && c.category === "Legal & Judicial",
      ),
    ).toBeUndefined();
  });

  it("does not emit cells for party groups or decades with zero gigs", () => {
    const result = computeAnalytics([
      { category: "Legal & Judicial", partyGroup: "ALP", decade: "2010s" },
    ]);
    const partyColumns = new Set(result.byParty.map((c) => c.column));
    const decadeColumns = new Set(result.byDecade.map((c) => c.column));
    expect(partyColumns).toEqual(new Set(["ALP"]));
    expect(decadeColumns).toEqual(new Set(["2010s"]));
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm test tests/analytics.test.ts`
Expected: FAIL with `Cannot find module '../src/utils/analytics'`.

- [ ] **Step 3: Implement `computeAnalytics`**

Create `src/utils/analytics.ts`:

```ts
import type { GigCategory } from "../types";
import type { PartyGroup } from "./pollie";

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
  proportion: number;
  columnTotal: number;
}

export interface AnalyticsData {
  categoryTotals: CategoryTotal[];
  byParty: ColumnCell<PartyGroup>[];
  byDecade: ColumnCell<string>[];
}

function buildColumnCells<Col extends string>(
  rows: AnalyticsRow[],
  columnOf: (row: AnalyticsRow) => Col,
  categoryOrder: GigCategory[],
): ColumnCell<Col>[] {
  const counts = new Map<Col, Map<GigCategory, number>>();
  const columnTotals = new Map<Col, number>();

  for (const row of rows) {
    const col = columnOf(row);
    const inner = counts.get(col) ?? new Map<GigCategory, number>();
    inner.set(row.category, (inner.get(row.category) ?? 0) + 1);
    counts.set(col, inner);
    columnTotals.set(col, (columnTotals.get(col) ?? 0) + 1);
  }

  const columns = Array.from(counts.keys()).sort((a, b) =>
    String(a).localeCompare(String(b)),
  );

  const cells: ColumnCell<Col>[] = [];
  for (const col of columns) {
    const total = columnTotals.get(col) ?? 0;
    const inner = counts.get(col)!;
    for (const category of categoryOrder) {
      const count = inner.get(category) ?? 0;
      if (count === 0) continue;
      cells.push({
        category,
        column: col,
        count,
        columnTotal: total,
        proportion: total === 0 ? 0 : count / total,
      });
    }
  }

  return cells;
}

export function computeAnalytics(rows: AnalyticsRow[]): AnalyticsData {
  const categoryCounts = new Map<GigCategory, number>();
  for (const row of rows) {
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
  }

  const categoryTotals: CategoryTotal[] = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.category.localeCompare(b.category);
    });

  const categoryOrder = categoryTotals.map((t) => t.category);

  return {
    categoryTotals,
    byParty: buildColumnCells(rows, (r) => r.partyGroup, categoryOrder),
    byDecade: buildColumnCells(rows, (r) => r.decade, categoryOrder),
  };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `pnpm test tests/analytics.test.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `pnpm test && pnpm check`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/utils/analytics.ts tests/analytics.test.ts
git commit -m "Add computeAnalytics with category/party/decade aggregation"
```

---

## Phase 2 — Static assets (palette, vega theme, deps)

### Task 3: Add the category colour palette

**Files:**
- Create: `src/utils/categoryColours.ts`

- [ ] **Step 1: Create the palette module**

The palette uses oklch values that sit comfortably on the warm-paper background. Hue progression mirrors GIG_CATEGORIES order so visually adjacent industries are also adjacent on screen.

Create `src/utils/categoryColours.ts`:

```ts
import { GIG_CATEGORIES, type GigCategory } from "../types";

const palette: readonly string[] = [
  "oklch(52% 0.10 35)",   // Natural Resources (Mining, Oil & Gas)
  "oklch(58% 0.13 65)",   // Energy (Renewables & Traditional)
  "oklch(60% 0.11 110)",  // Agriculture, Forestry & Fisheries
  "oklch(50% 0.10 145)",  // Environment, Climate & Sustainability
  "oklch(54% 0.10 175)",  // Health, Medical & Aged Care
  "oklch(50% 0.10 200)",  // Pharmaceutical & Biotechnology
  "oklch(48% 0.09 230)",  // Education, Academia & Research
  "oklch(46% 0.10 255)",  // Government, Public Administration & Civil Service
  "oklch(50% 0.11 280)",  // Diplomacy & International Relations
  "oklch(48% 0.12 305)",  // Politics, Campaigning & Party Operations
  "oklch(46% 0.10 335)",  // Defence & Military and Security
  "oklch(56% 0.09 5)",    // Nonprofit, NGO and Charity
  "oklch(50% 0.09 50)",   // Legal & Judicial
  "oklch(54% 0.07 90)",   // Professional Services & Management Consulting
  "oklch(50% 0.10 130)",  // Financial Services and Banking
  "oklch(54% 0.11 165)",  // Technology (Software, IT & Digital Services)
  "oklch(50% 0.10 195)",  // Telecommunications & Network Infrastructure
  "oklch(48% 0.11 220)",  // Media, Communications & Public Relations
  "oklch(50% 0.13 25)",   // Gambling, Gaming and Racing
  "oklch(58% 0.10 75)",   // Retail, Hospitality & Tourism
  "oklch(54% 0.12 320)",  // Arts, Culture & Sport
  "oklch(48% 0.08 155)",  // Science, Engineering & Technical Professions
  "oklch(58% 0.02 90)",   // Retired
];

if (palette.length !== GIG_CATEGORIES.length) {
  throw new Error(
    `Category palette length (${palette.length}) must match GIG_CATEGORIES length (${GIG_CATEGORIES.length})`,
  );
}

export const categoryColours: Record<GigCategory, string> = Object.fromEntries(
  GIG_CATEGORIES.map((cat, i) => [cat, palette[i]]),
) as Record<GigCategory, string>;

export const categoryColourArray: readonly string[] = palette;
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/categoryColours.ts
git commit -m "Add 23-entry category colour palette"
```

### Task 4: Add Vega and supporting deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the runtime deps**

Run: `pnpm add vega vega-lite vega-embed`
Expected: `package.json` and `pnpm-lock.yaml` updated; the three packages appear under `dependencies`.

- [ ] **Step 2: Verify versions are recent**

Run: `pnpm list vega vega-lite vega-embed`
Expected: `vega@6+`, `vega-lite@6+`, `vega-embed@7+` (or whatever pnpm chose). If the resolved `vega-lite` is older than 6, run `pnpm add vega-lite@^6`.

- [ ] **Step 3: Sanity-check the install**

Run: `pnpm check`
Expected: no new errors. (We haven't imported anything from vega yet, so this just confirms the install didn't break the existing TypeScript graph.)

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "Add vega, vega-lite, vega-embed for analytics charts"
```

### Task 5: Add the runtime Vega theme helper

**Files:**
- Create: `src/utils/vegaTheme.ts`

- [ ] **Step 1: Create the helper**

Create `src/utils/vegaTheme.ts`:

```ts
import type { Config } from "vega-lite";

function readVar(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

export function getVegaConfig(): Config {
  const styles = getComputedStyle(document.documentElement);
  const ink = readVar(styles, "--color-ink") || "#1a1a1a";
  const ink2 = readVar(styles, "--color-ink-2") || "#555";
  const ink3 = readVar(styles, "--color-ink-3") || "#888";
  const rule = readVar(styles, "--color-rule") || "#ddd";
  const sansStack =
    readVar(styles, "--font-sans-stack") || "Public Sans, sans-serif";
  const serifStack =
    readVar(styles, "--font-serif-stack") || "Source Serif 4, serif";

  return {
    background: "transparent",
    font: sansStack,
    axis: {
      labelColor: ink2,
      labelFont: sansStack,
      labelFontSize: 11,
      titleColor: ink,
      titleFont: sansStack,
      titleFontSize: 12,
      titleFontWeight: 600,
      domainColor: rule,
      tickColor: rule,
      gridColor: rule,
      gridOpacity: 0.5,
    },
    title: {
      color: ink,
      font: serifStack,
      fontSize: 16,
      fontWeight: 500,
      anchor: "start",
    },
    legend: {
      labelColor: ink2,
      labelFont: sansStack,
      titleColor: ink,
      titleFont: sansStack,
      titleFontWeight: 600,
    },
    view: {
      stroke: "transparent",
    },
    range: {
      heatmap: { scheme: "greens" },
    },
    style: {
      "guide-label": { fill: ink2 },
      "guide-title": { fill: ink },
      cell: { stroke: rule },
    },
    customFormatTypes: false,
    color: ink3,
  };
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/vegaTheme.ts
git commit -m "Add Vega config helper that reads CSS custom properties"
```

---

## Phase 3 — Components

### Task 6: Build the headline distribution chart

**Files:**
- Create: `src/components/CategoryDistributionChart.svelte`

- [ ] **Step 1: Create the component**

Create `src/components/CategoryDistributionChart.svelte`:

```svelte
<script lang="ts">
  import vegaEmbed from "vega-embed";
  import type { TopLevelSpec } from "vega-lite";
  import type { CategoryTotal } from "../utils/analytics";
  import { categoryColourArray } from "../utils/categoryColours";
  import { getVegaConfig } from "../utils/vegaTheme";

  interface Props {
    data: CategoryTotal[];
  }

  let { data }: Props = $props();
  let chartDiv: HTMLDivElement;

  function buildSpec(): TopLevelSpec {
    const categoryOrder = data.map((d) => d.category);
    const colourRange = categoryOrder.map((_, i) => categoryColourArray[i]);
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { values: data },
      mark: { type: "bar", tooltip: true },
      encoding: {
        y: {
          field: "category",
          type: "nominal",
          sort: null,
          axis: { title: null, labelLimit: 280 },
        },
        x: {
          field: "count",
          type: "quantitative",
          axis: { title: "Gigs", tickMinStep: 1 },
        },
        color: {
          field: "category",
          type: "nominal",
          scale: { domain: categoryOrder, range: colourRange },
          legend: null,
        },
        tooltip: [
          { field: "category", type: "nominal", title: "Category" },
          { field: "count", type: "quantitative", title: "Gigs" },
        ],
      },
      width: "container",
      height: { step: 22 },
      config: getVegaConfig(),
    };
  }

  $effect(() => {
    if (!chartDiv) return;
    let cancelled = false;
    let result: { finalize?: () => void } | null = null;

    vegaEmbed(chartDiv, buildSpec(), { actions: false, renderer: "svg" })
      .then((r) => {
        if (cancelled) {
          r.finalize?.();
          return;
        }
        result = r;
      })
      .catch((err) => {
        console.error("Failed to render distribution chart", err);
      });

    return () => {
      cancelled = true;
      result?.finalize?.();
    };
  });
</script>

<div class="chart" bind:this={chartDiv} aria-hidden="true"></div>

<style>
  .chart {
    width: 100%;
    min-height: 18rem;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryDistributionChart.svelte
git commit -m "Add CategoryDistributionChart Svelte island"
```

### Task 7: Build the comparison chart with Party/Decade toggle

**Files:**
- Create: `src/components/CategoryComparisonChart.svelte`

- [ ] **Step 1: Create the component**

Create `src/components/CategoryComparisonChart.svelte`:

```svelte
<script lang="ts">
  import vegaEmbed from "vega-embed";
  import type { TopLevelSpec } from "vega-lite";
  import type { ColumnCell } from "../utils/analytics";
  import type { PartyGroup } from "../utils/pollie";
  import { getVegaConfig } from "../utils/vegaTheme";

  interface Props {
    byParty: ColumnCell<PartyGroup>[];
    byDecade: ColumnCell<string>[];
    categoryOrder: string[];
  }

  let { byParty, byDecade, categoryOrder }: Props = $props();
  let mode = $state<"party" | "decade">("party");
  let chartDiv: HTMLDivElement;

  function specForMode(m: "party" | "decade"): TopLevelSpec {
    const cells = m === "party" ? byParty : byDecade;
    const columnTitle = m === "party" ? "Party" : "Decade";
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { values: cells },
      mark: { type: "rect", tooltip: true, stroke: null },
      encoding: {
        y: {
          field: "category",
          type: "nominal",
          scale: { domain: categoryOrder },
          sort: categoryOrder,
          axis: { title: null, labelLimit: 280 },
        },
        x: {
          field: "column",
          type: "nominal",
          axis: { title: columnTitle, labelAngle: 0 },
        },
        color: {
          field: "proportion",
          type: "quantitative",
          scale: { scheme: "greens", domain: [0, 1] },
          legend: { title: "Share", format: ".0%" },
        },
        tooltip: [
          { field: "category", type: "nominal", title: "Category" },
          { field: "column", type: "nominal", title: columnTitle },
          { field: "count", type: "quantitative", title: "Gigs" },
          { field: "columnTotal", type: "quantitative", title: "Column total" },
          { field: "proportion", type: "quantitative", title: "Share", format: ".1%" },
        ],
      },
      width: "container",
      height: { step: 22 },
      config: getVegaConfig(),
    };
  }

  $effect(() => {
    if (!chartDiv) return;
    let cancelled = false;
    let result: { finalize?: () => void } | null = null;

    vegaEmbed(chartDiv, specForMode(mode), { actions: false, renderer: "svg" })
      .then((r) => {
        if (cancelled) {
          r.finalize?.();
          return;
        }
        result = r;
      })
      .catch((err) => {
        console.error("Failed to render comparison chart", err);
      });

    return () => {
      cancelled = true;
      result?.finalize?.();
    };
  });
</script>

<div class="toggle" role="group" aria-label="Split by">
  <button
    type="button"
    class="toggle-btn"
    class:active={mode === "party"}
    aria-pressed={mode === "party"}
    aria-controls="comparison-chart"
    onclick={() => (mode = "party")}
  >
    Party
  </button>
  <button
    type="button"
    class="toggle-btn"
    class:active={mode === "decade"}
    aria-pressed={mode === "decade"}
    aria-controls="comparison-chart"
    onclick={() => (mode = "decade")}
  >
    Decade
  </button>
</div>

<div
  id="comparison-chart"
  class="chart"
  bind:this={chartDiv}
  aria-hidden="true"
></div>

<style>
  .toggle {
    display: inline-flex;
    gap: 0;
    margin-bottom: var(--space-md);
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .toggle-btn {
    background: transparent;
    border: none;
    border-right: 1px solid var(--color-rule-strong);
    padding: 0.4rem 1rem;
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink-2);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .toggle-btn:last-child {
    border-right: none;
  }
  .toggle-btn:hover {
    color: var(--color-ink);
    background: var(--color-paper-alt);
  }
  .toggle-btn.active {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
  .chart {
    width: 100%;
    min-height: 22rem;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryComparisonChart.svelte
git commit -m "Add CategoryComparisonChart with party/decade toggle"
```

---

## Phase 4 — Page assembly

### Task 8: Wire up `analytics.astro`

**Files:**
- Create: `src/pages/analytics.astro`

- [ ] **Step 1: Create the page**

Create `src/pages/analytics.astro`:

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro"
import CategoryDistributionChart from "../components/CategoryDistributionChart.svelte"
import CategoryComparisonChart from "../components/CategoryComparisonChart.svelte"
import { getCollection, type CollectionEntry } from "astro:content"
import { groupParty, type PartyGroup } from "../utils/pollie"
import { getDecade, isDecade1980sOrLater } from "../utils/decade"
import { parseDate } from "../utils/date"
import { computeAnalytics, type AnalyticsRow } from "../utils/analytics"
import type { GigCategory } from "../types"

const pollies = await getCollection("pollies")

const rows: AnalyticsRow[] = []
for (const entry of pollies as CollectionEntry<"pollies">[]) {
  const decade = getDecade(parseDate(entry.data.ceasedDate))
  if (!isDecade1980sOrLater(decade)) continue
  const partyGroup = groupParty(entry.data.party.trim())
  for (const gig of entry.data.gigs) {
    rows.push({
      category: gig.category as GigCategory,
      partyGroup,
      decade,
    })
  }
}

const data = computeAnalytics(rows)
const totalGigs = data.categoryTotals.reduce((acc, t) => acc + t.count, 0)
const topCategory = data.categoryTotals[0]
const partyColumns = Array.from(
  new Set(data.byParty.map((c) => c.column)),
).sort() as PartyGroup[]
const decadeColumns = Array.from(
  new Set(data.byDecade.map((c) => c.column)),
).sort()

function cellsToMatrix<Col extends string>(
  cells: { category: GigCategory; column: Col; count: number; columnTotal: number; proportion: number }[],
  rowOrder: GigCategory[],
  colOrder: Col[],
) {
  const lookup = new Map<string, { count: number; columnTotal: number; proportion: number }>()
  for (const c of cells) {
    lookup.set(`${c.category}|${c.column}`, {
      count: c.count,
      columnTotal: c.columnTotal,
      proportion: c.proportion,
    })
  }
  return { lookup, rowOrder, colOrder }
}

const partyMatrix = cellsToMatrix(
  data.byParty,
  data.categoryTotals.map((t) => t.category),
  partyColumns,
)
const decadeMatrix = cellsToMatrix(
  data.byDecade,
  data.categoryTotals.map((t) => t.category),
  decadeColumns,
)

function fmtPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

const categoryOrder = data.categoryTotals.map((t) => t.category)
---

<BaseLayout title="Analytics">
  <section class="page-intro">
    <h1>Analytics</h1>
    <p>
      Figures here are derived from the same data as the directory: verified
      and unverified gigs (rejected gigs excluded), restricted to politicians
      who left office from the 1980s onwards. Numbers will have errors. If you
      spot one, <a href="/contribute">please flag it</a>.
    </p>
  </section>

  <section class="chart-section" aria-labelledby="distribution-heading">
    <h2 id="distribution-heading">Distribution by category</h2>
    <figure>
      <CategoryDistributionChart data={data.categoryTotals} client:load />
      <figcaption>
        {totalGigs.toLocaleString()} post-parliament gigs across {data.categoryTotals.length} categories
        {topCategory ? `; ${topCategory.category} leads with ${topCategory.count}` : ""}.
      </figcaption>
    </figure>
    <details class="data-table">
      <summary>Data table</summary>
      <table>
        <caption class="visually-hidden">Gig counts by category</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Gigs</th>
          </tr>
        </thead>
        <tbody>
          {data.categoryTotals.map((row) => (
            <tr>
              <th scope="row">{row.category}</th>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  </section>

  <section class="chart-section" aria-labelledby="comparison-heading">
    <h2 id="comparison-heading">Comparison: party and decade</h2>
    <figure>
      <CategoryComparisonChart
        byParty={data.byParty}
        byDecade={data.byDecade}
        categoryOrder={categoryOrder}
        client:load
      />
      <figcaption>
        Each cell shows what share of a column's gigs fall in each category.
        Brighter cells mean a larger share; empty cells mean zero gigs in that
        group. Toggle between party and decade to compare.
      </figcaption>
    </figure>
    <details class="data-table">
      <summary>Data table</summary>
      <h3>By party</h3>
      <table>
        <caption class="visually-hidden">Share by party group</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {partyMatrix.colOrder.map((col) => (
              <th scope="col">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {partyMatrix.rowOrder.map((cat) => (
            <tr>
              <th scope="row">{cat}</th>
              {partyMatrix.colOrder.map((col) => {
                const cell = partyMatrix.lookup.get(`${cat}|${col}`)
                return (
                  <td>
                    {cell ? `${cell.count} (${fmtPct(cell.proportion)})` : "—"}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <h3>By decade</h3>
      <table>
        <caption class="visually-hidden">Share by decade</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {decadeMatrix.colOrder.map((col) => (
              <th scope="col">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {decadeMatrix.rowOrder.map((cat) => (
            <tr>
              <th scope="row">{cat}</th>
              {decadeMatrix.colOrder.map((col) => {
                const cell = decadeMatrix.lookup.get(`${cat}|${col}`)
                return (
                  <td>
                    {cell ? `${cell.count} (${fmtPct(cell.proportion)})` : "—"}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  </section>
</BaseLayout>

<style>
  .page-intro {
    margin-bottom: var(--space-xl);
    max-width: var(--measure-reading);
  }
  .page-intro p {
    font-family: var(--font-serif-stack);
    color: var(--color-ink-2);
  }

  .chart-section {
    margin-bottom: var(--space-3xl);
  }

  .chart-section h2 {
    margin-top: 0;
  }

  figure {
    margin: 0 0 var(--space-md);
  }

  figcaption {
    margin-top: var(--space-sm);
    font-family: var(--font-serif-stack);
    font-style: italic;
    font-size: var(--text-meta);
    color: var(--color-ink-3);
    max-width: var(--measure-reading);
  }

  .data-table {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-2);
  }

  .data-table summary {
    cursor: pointer;
    color: var(--color-ink-3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    padding: var(--space-xs) 0;
  }

  .data-table summary:hover {
    color: var(--color-accent);
  }

  .data-table h3 {
    margin: var(--space-md) 0 var(--space-xs);
  }

  .data-table table {
    width: 100%;
    border-collapse: collapse;
    margin-top: var(--space-sm);
  }

  .data-table th,
  .data-table td {
    padding: var(--space-2xs) var(--space-sm);
    border-bottom: 1px solid var(--color-rule);
    text-align: left;
    font-variant-numeric: tabular-nums lining-nums;
  }

  .data-table thead th {
    border-bottom: 1px solid var(--color-rule-strong);
    color: var(--color-ink);
    font-weight: 600;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/analytics.astro
git commit -m "Add /analytics/ page with charts and table fallback"
```

### Task 9: Add Analytics link to Nav

**Files:**
- Modify: `src/components/Nav.astro`

- [ ] **Step 1: Insert the new link**

In `src/components/Nav.astro`, find the existing Directory `<li>` (lines 15-19) and add a new `<li>` for Analytics directly after it, before the About link:

```astro
        <li>
          <a href="/" class:list={[{ active: currentPath === "/" }]}>
            Directory
          </a>
        </li>
        <li>
          <a
            href="/analytics"
            class:list={[{ active: currentPath === "/analytics" }]}
          >
            Analytics
          </a>
        </li>
        <li>
          <a href="/about" class:list={[{ active: currentPath === "/about" }]}>
            About
          </a>
        </li>
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.astro
git commit -m "Add Analytics link to primary nav"
```

---

## Phase 5 — Verification

### Task 10: Run the full toolchain

**Files:** none modified.

- [ ] **Step 1: Run unit tests**

Run: `pnpm test`
Expected: all suites green, including `tests/analytics.test.ts` and the extended `tests/utils.test.ts`.

- [ ] **Step 2: Run typecheck**

Run: `pnpm check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Run production build**

Run: `pnpm build`
Expected: build succeeds; `dist/analytics/index.html` exists; bundle includes a vega chunk for the analytics page only.

- [ ] **Step 4: Confirm no-JS table fallback in built HTML**

Run: `grep -c "Data table" dist/analytics/index.html`
Expected: at least `2` (one for each chart's `<details>` summary).

Run: `grep -c "<table" dist/analytics/index.html`
Expected: at least `3` (one for headline, two for comparison).

### Task 11: Manual browser verification

**Files:** none modified.

> Run these checks in the dev server. The spec's "Manual verification checklist" governs — this task just makes the steps explicit. If anything fails, capture the failure and fix before declaring done.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Expected: server up on `http://localhost:4321/`.

- [ ] **Step 2: Visit `/analytics/` and confirm the headline chart**

Open `http://localhost:4321/analytics/`.
Expected:
- Page renders with the "Analytics" heading and intro paragraph.
- Headline horizontal bar chart shows categories sorted descending by count.
- Hovering a bar shows a tooltip with `Category: <name>, Gigs: <n>`.

- [ ] **Step 3: Confirm the comparison chart and toggle**

Expected:
- Comparison chart starts in Party mode (Party button has the active style and `aria-pressed="true"`).
- Toggle to Decade — chart re-renders without flicker (no double-render, no leftover SVG from the previous mode).
- Both charts share the same category row order.
- Hovering a cell shows tooltip with category, column, count, column total, and share %.

- [ ] **Step 4: Confirm tab order and accessibility**

Press Tab from the URL bar:
Expected: focus visits nav links → toggle buttons → details summary → table cells in that order. Toggle buttons report `Split by` group via screenreader (or inspect with devtools: outer wrapper has `role="group"` and `aria-label="Split by"`).

- [ ] **Step 5: Confirm no-JS fallback**

Open devtools → Settings → Disable JavaScript → reload `/analytics/`.
Expected:
- Page renders.
- Charts are absent (the Svelte islands don't hydrate).
- Both `<details>` blocks render and, when expanded, show tables with the same numbers as the charts produced with JS on.

Re-enable JavaScript when done.

- [ ] **Step 6: Final commit if anything was tweaked**

If steps 2-5 surfaced bugs that needed fixing, commit them now with descriptive messages. Otherwise nothing to commit.

---

## Self-review notes

Coverage check against the spec:

- **Goals (lines 8-15)** — distribution chart (Task 6), comparison chart (Task 7), shared data source via content collection (Task 8), table fallback (Task 8).
- **Data scope (lines 27-42)** — content-collection source filters rejected gigs at the loader; analytics.astro frontmatter applies the 1980s decade filter; `computeAnalytics` drops zero-count categories and columns (Task 2).
- **Party grouping (lines 44-58)** — `groupParty` and `PartyGroup` (Task 1).
- **Page structure (lines 60-76)** — h1 + preamble + two sections with figcaption + details/table; nav link added (Tasks 8-9).
- **Data pipeline (lines 78-120)** — `AnalyticsRow`, `CategoryTotal`, `ColumnCell`, `AnalyticsData`, `computeAnalytics` (Task 2); page frontmatter pipeline (Task 8).
- **Components (lines 122-155)** — `CategoryDistributionChart` (Task 6), `CategoryComparisonChart` with mode toggle and `$effect`-driven re-render (Task 7).
- **Vega configuration (lines 156-161)** — `getVegaConfig` reads CSS custom properties (Task 5).
- **Accessibility (lines 163-172)** — figcaption + table fallback (Task 8); `aria-pressed` and `aria-controls` on toggle buttons (Task 7).
- **Dependencies (lines 174-185)** — vega/vega-lite/vega-embed added (Task 4).
- **Testing (lines 187-202)** — `tests/analytics.test.ts` (Task 2), `groupParty` cases extended into `tests/utils.test.ts` (Task 1).
- **Manual verification checklist (lines 204-214)** — Task 11.

No placeholders, no `TBD`s, every code block is complete. Type names match across tasks (`AnalyticsRow`, `ColumnCell<Col>`, `PartyGroup` consistent). Function names match across tasks (`groupParty`, `computeAnalytics`, `getVegaConfig`, `buildSpec`/`specForMode` only inside their owning components).
