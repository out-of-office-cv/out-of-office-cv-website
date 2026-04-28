import type { Config } from "vega-lite";

function readVar(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

export function getVegaConfig(): Config {
  const styles = getComputedStyle(document.documentElement);
  const ink = readVar(styles, "--color-ink") || "#1a1a1a";
  const ink2 = readVar(styles, "--color-ink-2") || "#555";
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
  };
}
