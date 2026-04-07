import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import remarkSmartypants from "remark-smartypants";

export default defineConfig({
  site: "https://www.outofoffice.cv",
  trailingSlash: "never",
  integrations: [svelte()],
  vite: {},
  markdown: {
    remarkPlugins: [[remarkSmartypants as never, { dashes: "oldschool" }]],
  },
});
