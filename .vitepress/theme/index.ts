import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import PollieList from "./components/PollieList.vue";
import PollieSearch from "./components/PollieSearch.vue";
import PollieHeader from "./components/PollieHeader.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PollieList", PollieList);
    app.component("PollieSearch", PollieSearch);
    app.component("PollieHeader", PollieHeader);
  },
} satisfies Theme;
