---
id: task-2
title: Gig entry UI with GitHub device flow authentication
status: To Do
assignee: []
created_date: '2025-12-01 09:36'
updated_date: '2025-12-01 09:39'
labels:
  - feature
  - frontend
  - github-integration
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a web UI for creating new Gig entries with a two-stage workflow:

1. **Draft stage**: Users create and validate gigs locally, stored in localStorage. Multiple gigs can be drafted, edited, and reviewed before submission.

2. **Submit stage**: Authenticated users batch-submit all drafted gigs as a single PR. Uses GitHub device flow for authentication (persistent token in localStorage).

For users with write access to the repo, a GitHub Action auto-merges valid PRs. This keeps the site fully static (GitHub Pages compatible) while providing a smooth contribution experience.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gig entry page with form UI for all Gig fields (role, organisation, category, source, pollie_slug, start_date, end_date)
- [ ] #2 Form validation matching the Gig TypeScript type (required fields, valid category enum, URL format for source, date format)
- [ ] #3 Pollie slug field has autocomplete from existing pollies
- [ ] #4 Multiple gigs can be drafted before submitting
- [ ] #5 Draft gigs persist to localStorage
- [ ] #6 GitHub device flow authentication (user enters code at github.com/login/device)
- [ ] #7 Auth token persists in localStorage across sessions
- [ ] #8 Authenticated users can create a PR with their gig entries
- [ ] #9 GitHub Action auto-merges PRs from users with write access
- [ ] #10 Navigation link to gig entry page in site header
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### 1. Create GitHub App "Out of Office AU"

1. Go to https://github.com/settings/apps/new
2. Fill in:
   - **App name**: Out of Office AU
   - **Homepage URL**: your GitHub Pages URL
   - **Device flow**: Enable "Request user authorization (OAuth) during installation" is NOT needed; instead enable **"Enable Device Flow"** under OAuth settings
3. Permissions required:
   - **Repository permissions**:
     - Contents: Read and write (to create branches and commits)
     - Pull requests: Read and write (to create PRs)
4. After creation, note the **Client ID** (not the App ID)
5. No client secret needed for device flow

### 2. Create gig entry page

Create `contribute.md` with a Vue component `<GigEntryForm />`:

```
---
layout: page
title: Add Gigs
---

<GigEntryForm />
```

### 3. Build GigEntryForm component

Location: `.vitepress/theme/components/GigEntryForm.vue`

**Form fields** (matching `Gig` type):
- `role` (text, required)
- `organisation` (text, required)
- `category` (select, required) — options from `GigCategory` type
- `source` (url, required)
- `verified_by` (url, optional)
- `pollie_slug` (text with autocomplete, required)
- `start_date` (date, required) — format YYYY-MM-DD
- `end_date` (date, optional)

**Validation**:
- Required field checks
- URL format for `source` and `verified_by`
- Date format YYYY-MM-DD
- `category` must be valid enum value
- `pollie_slug` should match existing pollie (warning if not, not blocking)

**State management**:
- `draftGigs: Gig[]` — array of gigs being drafted
- `currentGig: Partial<Gig>` — form state for current entry
- Persist `draftGigs` to localStorage key `ooo-draft-gigs`
- Load from localStorage on mount

**UI sections**:
1. Form for adding a new gig
2. List of drafted gigs with edit/delete buttons
3. Auth section (see below)
4. Submit section (create PR)

### 4. Pollie autocomplete

Create a data loader `pollies-list.data.ts` that exports just slugs and names:

```ts
// Returns: Array<{ slug: string, name: string }>
```

Use this in the component for autocomplete suggestions on `pollie_slug` field.

### 5. GitHub device flow authentication

**Flow**:
1. User clicks "Connect to GitHub"
2. Call `POST https://github.com/login/device/code` with client_id and scope
3. Display the `user_code` and link to `verification_uri`
4. Poll `POST https://github.com/login/oauth/access_token` until user completes auth
5. Store `access_token` in localStorage key `ooo-github-token`

**CORS issue**: GitHub's OAuth endpoints don't support CORS. Options:
- Use a CORS proxy (not ideal for auth)
- Better: Use `@octokit/oauth-app` with device flow which handles this
- Or: Embed a minimal proxy in a Cloudflare Worker (see alternative plan below)

**Recommended approach**: Use `octokit/auth-oauth-device` package:
```ts
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device";
```

This handles the polling automatically.

**Store auth state**:
```ts
const token = localStorage.getItem('ooo-github-token');
const isAuthenticated = !!token;
```

### 6. Create PR with gig entries

Using `@octokit/rest`:

1. Get current `data/gigs.ts` content from main branch
2. Parse and append new gigs
3. Create a new branch `gig-contribution-{timestamp}`
4. Commit updated file to new branch
5. Create PR from new branch to main

**PR format**:
- Title: `Add {n} gig(s) for {pollie_names}`
- Body: List of gigs being added with sources

### 7. GitHub Action for auto-merge

Create `.github/workflows/auto-merge-gig-prs.yml`:

```yaml
name: Auto-merge gig contributions

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - 'data/gigs.ts'

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.event.pull_request.author_association == 'COLLABORATOR' || 
        github.event.pull_request.author_association == 'MEMBER' || 
        github.event.pull_request.author_association == 'OWNER'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate gigs.ts
        run: npx tsc --noEmit data/gigs.ts
      
      - name: Auto-merge
        run: gh pr merge ${{ github.event.pull_request.number }} --auto --squash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 8. Register component

In `.vitepress/theme/index.ts`:
```ts
import GigEntryForm from "./components/GigEntryForm.vue";
// ...
app.component("GigEntryForm", GigEntryForm);
```

### 9. Add navigation

In `.vitepress/config.ts`, add to nav:
```ts
nav: [
  { text: "Home", link: "/" },
  { text: "Add Gigs", link: "/contribute" }
],
```

### 10. Dependencies to add

```bash
npm install @octokit/rest @octokit/auth-oauth-device
```

---

## Alternative: CORS workaround

If the device flow CORS issues are problematic, fall back to copy/paste approach:

1. Build the form and localStorage persistence (steps 2-4)
2. Add "Copy to clipboard" button that formats gigs as TypeScript
3. Show link to `https://github.com/{owner}/{repo}/edit/main/data/gigs.ts`
4. Instructions: paste at end of array, before `];`

This can be a fallback mode if auth isn't configured.
<!-- SECTION:PLAN:END -->
