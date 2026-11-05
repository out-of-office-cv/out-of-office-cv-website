import { defineConfig, fontProviders } from "astro/config";
import svelte from "@astrojs/svelte";
import { unified } from "@astrojs/markdown-remark";
import remarkSmartypants from "remark-smartypants";

export default defineConfig({
  site: "https://www.outofoffice.cv",
  trailingSlash: "never",
  compressHTML: true,
  integrations: [svelte()],
  vite: {},
  markdown: {
    processor: unified(),
    remarkPlugins: [[remarkSmartypants as never, { dashes: "oldschool" }]],
  },
  fonts: [
    {
      name: "Source Serif 4",
      cssVariable: "--font-serif",
      provider: fontProviders.google(),
      weights: ["300 900"],
      styles: ["normal", "italic"],
      subsets: ["latin"],
    },
    {
      name: "Public Sans",
      cssVariable: "--font-sans",
      provider: fontProviders.google(),
      weights: ["300 700"],
      styles: ["normal"],
      subsets: ["latin"],
    },
  ],
});
