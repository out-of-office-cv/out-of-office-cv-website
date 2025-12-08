import { defineConfig } from "vitepress";
import checker from "vite-plugin-checker";

export default defineConfig({
  markdown: {
    typographer: true,
  },
  vite: {
    plugins: [
      checker({
        typescript: true,
        vueTsc: true,
      }),
    ],
  },
  title: "Out of Office CV",
  description:
    "Tracking what Australian Parliamentarians do when they leave office",
  head: [["link", { rel: "canonical", href: "https://outofoffice.cv" }]],
  cleanUrls: true,
  ignoreDeadLinks: false,
  themeConfig: {
    // @ts-expect-error disable search widget
    search: false,
    nav: [
      { text: "Home", link: "/" },
      { text: "About", link: "/about" },
    ],
    sidebar: [],
  },
});
