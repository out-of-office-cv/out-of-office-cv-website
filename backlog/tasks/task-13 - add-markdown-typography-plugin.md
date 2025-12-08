---
id: task-13
title: add markdown typography plugin
status: Done
assignee: []
created_date: '2025-12-08 10:17'
updated_date: '2025-12-08 10:31'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add markdown-it typographer to VitePress to automatically convert ASCII typography to proper typographic characters.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Enabled `typographer: true` in `.vitepress/config.ts` markdown options.

This converts:
- `---` → em dash (—)
- `--` → en dash (–)
- Straight quotes → smart quotes ("" '')
- `...` → ellipsis (…)
<!-- SECTION:NOTES:END -->
