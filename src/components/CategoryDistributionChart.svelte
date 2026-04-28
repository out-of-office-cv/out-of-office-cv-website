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
