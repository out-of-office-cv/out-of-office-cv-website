import DefaultTheme from "vitepress/theme";
import PollieList from "./components/PollieList.vue";
import PollieSearch from "./components/PollieSearch.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PollieList", PollieList);
    app.component("PollieSearch", PollieSearch);
  },
};
