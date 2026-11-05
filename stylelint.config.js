export default {
  ignoreFiles: ["dist/**", ".astro/**", ".worktrees/**", ".vitepress/**", "node_modules/**"],
  extends: [
    "stylelint-config-standard",
    "stylelint-config-html/astro",
    "stylelint-config-html/svelte",
  ],
  rules: {
    "no-descending-specificity": null,
    // Font family names and text-rendering keywords are written as their vendors spell them.
    "value-keyword-case": [
      "lower",
      { ignoreProperties: ["font-family", "font"], ignoreKeywords: ["optimizeLegibility"] },
    ],
  },
};
