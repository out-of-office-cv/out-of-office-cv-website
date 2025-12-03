import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Out of Office",
  description:
    "Tracking what Australian Parliamentarians do when they leave office",
  head: [["link", { rel: "canonical", href: "https://outofoffice.cv" }]],
  cleanUrls: true,
  ignoreDeadLinks: false,
  themeConfig: {
    search: {
      provider: "local",
    },
    nav: [{ text: "Home", link: "/" }],
    sidebar: [],
  },
});
