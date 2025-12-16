---
id: task-21
title: Migrate pollie data to APH Parliamentary Handbook API
status: Done
assignee: []
created_date: '2025-12-15 09:50'
updated_date: '2025-12-15 10:01'
labels:
  - data
  - api
  - photos
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current OpenAustralia CSV files (`data/representatives.csv`, `data/senators.csv`) with a single `data/pollies.csv` populated from the official APH Parliamentary Handbook API. This provides:

- Official, canonical data source
- Politician photos via `https://www.aph.gov.au/api/parliamentarian/{PHID}/image`
- Unified data format for both MPs and senators
- Cleaner data pipeline

## API details

- **Endpoint**: `https://handbookapi.aph.gov.au/api/individuals`
- **Format**: OData with `$select`, `$filter`, `$top`, `$skip` support
- **Total records**: ~1,878 parliamentarians (all time)
- **Photo URL**: `https://www.aph.gov.au/api/parliamentarian/{PHID}/image`

## Key API fields

| Field | Description |
|-------|-------------|
| `PHID` | Unique ID (e.g., `EZ5` for Abbott) |
| `GivenName`, `MiddleNames`, `FamilyName` | Name components |
| `PartyAbbrev` | Party code (e.g., `LIB`, `ALP`) |
| `Electorate` | Division for MPs (empty for senators) |
| `SenateState` | State for senators (empty for MPs) |
| `StateAbbrev` | State code (e.g., `NSW`) |
| `MPorSenator` | Array: `["Member"]` or `["Senator"]` |
| `ServiceHistory_End` | Date left office (ISO format) |
| `InCurrentParliament` | `"True"` or `"False"` |

## New CSV format

```
phid,name,division,state,party,ceased_date,house
EZ5,Anthony John Abbott,Warringah,NSW,LIB,2019-05-18,reps
885,Malcolm Bligh Turnbull,Wentworth,NSW,LIB,2018-08-31,reps
```

## Changes required

### 1. Create fetch script (`scripts/fetch-pollies.ts`)

- Fetch all former parliamentarians from 1980 onwards
- Filter: `InCurrentParliament eq 'False'` and `ServiceHistory_End ge 1980-01-01`
- Handle pagination (API returns paginated results)
- Write to `data/pollies.csv`
- Include CLI options: `--dry-run`, `--since YYYY` (default 1980)

### 2. Update types (`.vitepress/types.ts`)

- Remove `reason` field from `Pollie` interface (already done)
- Add `phid` field to `Pollie` interface

### 3. Update loaders (`.vitepress/loaders.ts`)

- Load from single `data/pollies.csv` instead of two separate files
- Generate `photoUrl` from PHID: `https://www.aph.gov.au/api/parliamentarian/{phid}/image`
- Update date parsing to handle ISO format (YYYY-MM-DD) instead of DD.MM.YYYY

### 4. Update utils (`.vitepress/utils.ts`)

- Remove `reason` from `parsePollieFromRow` (or replace function entirely)
- Add/update date parsing for ISO format
- Keep `deduplicatePollies` (still needed for same-name pollies)

### 5. Update PollieHeader component

- Add `photoUrl` prop
- Display photo with appropriate styling and fallback

### 6. Update data flow

- Update `pollies/[slug].paths.ts` to pass `photoUrl` to pages
- Update `pollies/[slug].md` to pass `photoUrl` to PollieHeader

### 7. Clean up

- Delete `data/representatives.csv`
- Delete `data/senators.csv`
- Delete `data/openaustralia-people.csv` (if exists)
- Update `.gitignore` if needed

## Testing

### Unit tests for fetch script
- Mock API responses
- Test pagination handling
- Test CSV output format
- Test date filtering (1980 cutoff)
- Test handling of MPs vs senators

### Integration tests
- Test that photos load correctly (spot check a few PHIDs)
- Test that all existing pollie slugs still resolve
- Test PollieHeader renders photo correctly
- Test fallback when photo unavailable

### Manual verification
- Run `npm run dev` and check several pollie pages
- Verify photos display correctly
- Verify data matches APH website
- Check both MPs and senators
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fetch script successfully retrieves all former pollies from 1980 onwards
- [x] #2 Single pollies.csv file replaces representatives.csv and senators.csv
- [x] #3 Photos display on pollie pages using APH image endpoint
- [x] #4 All existing pollie slugs continue to work
- [x] #5 Build passes with no type errors
- [x] #6 Integration tests pass
- [x] #7 Date format consistently uses ISO (YYYY-MM-DD) internally
<!-- AC:END -->
