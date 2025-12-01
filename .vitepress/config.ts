import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Out of Office',
  description: 'Tracking what Australian Parliamentarians do when they leave office',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Pollies', link: '/pollies/' }
    ],
    sidebar: [
      {
        text: 'Pollies',
        link: '/pollies/'
      }
    ]
  }
})
