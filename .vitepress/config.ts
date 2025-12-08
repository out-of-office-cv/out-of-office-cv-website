import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Out of Office CV",
  description:
    "Tracking what Australian Parliamentarians do when they leave office",
  head: [["link", { rel: "canonical", href: "https://outofoffice.cv" }]],
  cleanUrls: true,
  ignoreDeadLinks: false,
  themeConfig: {
    search: false,
    nav: [{ text: "Home", link: "/" }],
    sidebar: [],
  },
});
