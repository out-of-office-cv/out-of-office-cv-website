---
id: task-3
title: Deploy site to GitHub Pages
status: Done
assignee: []
created_date: "2025-12-01 09:44"
updated_date: "2025-12-08 05:10"
labels:
  - infrastructure
  - deployment
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Set up GitHub Actions workflow to automatically deploy the VitePress site to
GitHub Pages on push to main.

Requirements:

- Use the same Node.js version as local development (check package.json or
  .nvmrc)
- Build the site with `npm run build`
- Deploy the `.vitepress/dist` output to GitHub Pages
- Configure the repository settings for Pages deployment
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 GitHub Actions workflow file exists in `.github/workflows/`
- [x] #2 Workflow triggers on push to main branch
- [x] #3 Uses matching Node.js version from local dev environment
- [x] #4 Site builds and deploys successfully to GitHub Pages
- [x] #5 Pages URL serves the live site
<!-- AC:END -->
