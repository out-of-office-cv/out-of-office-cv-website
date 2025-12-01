import DefaultTheme from "vitepress/theme";
import PollieList from "./components/PollieList.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("PollieList", PollieList);
  },
};
