<script lang="ts">
  import vegaEmbed from "vega-embed";
  import type { TopLevelSpec } from "vega-lite";
  import type { ColumnCell } from "../utils/analytics";
  import type { PartyGroup } from "../utils/pollie";
  import type { GigCategory } from "../types";
  import { getVegaConfig } from "../utils/vegaTheme";

  interface Props {
    byParty: ColumnCell<PartyGroup>[];
    byDecade: ColumnCell<string>[];
    categoryOrder: GigCategory[];
  }

  let { byParty, byDecade, categoryOrder }: Props = $props();
  let mode = $state<"party" | "decade">("party");
  let chartDiv: HTMLDivElement | undefined;

  function specForMode(m: "party" | "decade"): TopLevelSpec {
    const cells = m === "party" ? [...byParty] : [...byDecade];
    const order = [...categoryOrder];
    const columnTitle = m === "party" ? "Party" : "Decade";
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { values: cells },
      mark: { type: "rect", tooltip: true },
      encoding: {
        y: {
          field: "category",
          type: "nominal",
          scale: { domain: order },
          sort: order,
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
