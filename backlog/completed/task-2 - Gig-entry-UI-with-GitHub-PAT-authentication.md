---
id: task-2
title: Gig entry UI with GitHub PAT authentication
status: Done
assignee: []
created_date: "2025-12-01 09:36"
updated_date: "2025-12-08 06:00"
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

1. **Draft stage**: Users create and validate gigs locally, stored in
   localStorage. Multiple gigs can be drafted, edited, and reviewed before
   submission.

2. **Submit stage**: Authenticated users batch-submit all drafted gigs as a
   single PR. Uses GitHub Personal Access Token for authentication (persistent
   token in localStorage).

For users with write access to the repo, a GitHub Action auto-merges valid PRs.
This keeps the site fully static (GitHub Pages compatible) while providing a
smooth contribution experience.

Target users are a small group of trusted "gig reviewers" who will submit many
gigs over time. Initial setup (creating PAT) is acceptable; repeat visits should
be frictionless.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 #1 Gig entry page with form UI for all Gig fields (role, organisation,
      category, source, pollie_slug, start_date, end_date) category, source,
      pollie_slug, start_date, end_date)
- [x] #2 #2 Form validation matching the Gig TypeScript type (required fields,
      valid category enum, URL format for source, date format) valid category
      enum, URL format for source, date format)
- [x] #3 #3 Pollie slug field has autocomplete from existing pollies
- [x] #4 #4 Multiple gigs can be drafted before submitting
- [x] #5 #5 Draft gigs persist to localStorage
- [x] #6 #6 GitHub PAT authentication with clear setup instructions (link to
      token creation page with required scopes) github.com/login/device)
- [x] #7 #7 PAT persists in localStorage across sessions with validation on page
      load
- [x] #8 #8 Authenticated users can create a PR with their gig entries
- [x] #9 #9 GitHub Action auto-merges PRs from users with write access
- [x] #10 #10 Navigation link to gig entry page in site header

- [x] #11 #11 Remember last pollie slug to streamline repeat entries
- [x] #12 #12 Show GitHub username when authenticated for confirmation
- [x] #13 #13 Display PR status after submission (created → merged)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

## Implementation Plan

### 1. Create gig entry page

Create `contribute.md` with a Vue component `<GigEntryForm />`:

```md
---
layout: page
title: Add Gigs
---

<GigEntryForm />
```

### 2. Build GigEntryForm component

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
- Persist `lastPollieSlug` to localStorage for repeat entry convenience
- Load from localStorage on mount

**UI sections**:

1. Auth section (GitHub PAT setup/status)
2. Form for adding a new gig
3. List of drafted gigs with edit/delete buttons
4. Submit section (create PR) with status display

### 3. Pollie autocomplete

Create a data loader `pollies-list.data.ts` that exports just slugs and names:

```ts
// Returns: Array<{ slug: string, name: string }>
```

Use this in the component for autocomplete suggestions on `pollie_slug` field.

### 4. GitHub PAT authentication

**Setup flow (first visit)**:

1. User sees "Connect to GitHub" section
2. Instructions with direct link:
   `https://github.com/settings/tokens/new?scopes=repo&description=Out%20of%20Office%20CV`
3. User creates token, pastes into input field
4. Token stored in localStorage key `ooo-github-token`

**Validation on page load**:

1. If token exists in localStorage, call `GET https://api.github.com/user`
2. If valid: show "Connected as @username" with green indicator
3. If 401: clear token, show setup instructions again

**Token requirements**:

- Classic PAT with `repo` scope (for creating branches, commits, PRs)
- Fine-grained PAT alternative: Contents (read/write), Pull requests
  (read/write) on the specific repo

### 5. Create PR with gig entries

Using `@octokit/rest`:

1. Get current `data/gigs.ts` content from main branch
2. Parse and append new gigs
3. Create a new branch `gig-contribution-{timestamp}`
4. Commit updated file to new branch
5. Create PR from new branch to main
6. Store PR number, poll for merge status

**PR format**:

- Title: `Add {n} gig(s) for {pollie_names}`
- Body: List of gigs being added with sources

**Post-submission UI**:

- Show "PR #123 created" with link
- Poll PR status every 5 seconds
- Update to "PR #123 merged!" when complete
- Clear draft gigs on successful merge

### 6. GitHub Action for auto-merge

Create `.github/workflows/auto-merge-gig-prs.yml`:

```yaml
name: Auto-merge gig contributions

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - "data/gigs.ts"

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: |
      github.event.pull_request.author_association == 'COLLABORATOR' ||
      github.event.pull_request.author_association == 'MEMBER' ||
      github.event.pull_request.author_association == 'OWNER'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Validate gigs.ts
        run: npx tsc --noEmit data/gigs.ts

      - name: Auto-merge
        run: gh pr merge ${{ github.event.pull_request.number }} --auto --squash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 7. Register component

In `.vitepress/theme/index.ts`:

```ts
import GigEntryForm from "./components/GigEntryForm.vue";
// ...
app.component("GigEntryForm", GigEntryForm);
```

### 8. Add navigation

In `.vitepress/config.ts`, add to nav:

```ts
nav: [
  { text: "Home", link: "/" },
  { text: "Add Gigs", link: "/contribute" }
],
```

### 9. Dependencies to add

```bash
npm install @octokit/rest
```

---

## Repeat user workflow

```
Return visit (30 seconds to submit a gig):
1. Navigate to /contribute
2. Page loads → validates token → "Connected as @username"
3. Form pre-filled with last pollie slug
4. User fills: role, org, category, dates, source
5. Click "Add to draft" (or keep adding more)
6. Click "Submit PR"
7. Shows "PR #123 created" → polls → "Merged!"
8. Draft cleared, ready for next batch
```

<!-- SECTION:PLAN:END -->
