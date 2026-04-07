import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import remarkSmartypants from "remark-smartypants";

export default defineConfig({
  site: "https://www.outofoffice.cv",
  trailingSlash: "never",
  integrations: [svelte()],
  vite: {
    resolve: {
      noExternal: ["bits-ui"],
    },
  },
  markdown: {
    remarkPlugins: [[remarkSmartypants as never, { dashes: "oldschool" }]],
  },
});
