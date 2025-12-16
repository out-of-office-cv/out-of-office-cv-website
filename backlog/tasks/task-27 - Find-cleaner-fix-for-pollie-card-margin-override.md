---
id: task-27
title: Find cleaner fix for pollie card margin override
status: To Do
assignee: []
created_date: '2025-12-16 00:52'
labels:
  - tech-debt
  - css
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The pollie card grid currently uses `margin-top: 0` on `.pollie-card` to override VitePress's default `.vp-doc li + li { margin-top: 8px }` rule. This works but is a workaround rather than addressing the root cause.

Attempted `vp-raw` class on the `<ul>` but it didn't prevent the rule from applying.

Investigate cleaner approaches:
- Custom VitePress theme that doesn't apply prose styles to component areas
- Scoped reset at the `.pollie-list` level
- Moving the grid outside `.vp-doc` context entirely
<!-- SECTION:DESCRIPTION:END -->
