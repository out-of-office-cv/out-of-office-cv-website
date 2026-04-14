<script lang="ts">
  import { getPartyColour } from "../utils/pollie"

  import type { PolliesByDecade, House } from "../types"

  interface Props {
    polliesByDecade: PolliesByDecade[]
  }

  let { polliesByDecade }: Props = $props()

  let searchInput = $state("")
  let houseFilter = $state<House | "">("")
  let stateFilter = $state("")
  let partyFilter = $state("")
  let decadeFilter = $state("")
  let photoErrors = $state(new Set<string>())
  let searchOpen = $state(false)
  let highlightedIndex = $state(-1)

  let uniqueStates = $derived.by(() => {
    const states = new Set<string>()
    for (const group of polliesByDecade) {
      for (const p of group.pollies) {
        if (p.state) states.add(p.state)
      }
    }
    return Array.from(states).sort()
  })

  let uniqueParties = $derived.by(() => {
    const parties = new Set<string>()
    for (const group of polliesByDecade) {
      for (const p of group.pollies) {
        if (p.party) parties.add(p.party.trim())
      }
    }
    return Array.from(parties).sort()
  })

  let uniqueDecades = $derived(polliesByDecade.map((group) => group.decade))

  let allPollies = $derived(polliesByDecade.flatMap((g) => g.pollies))

  let searchResults = $derived.by(() => {
    const query = searchInput.toLowerCase().trim()
    if (!query) return []
    return allPollies
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.division.toLowerCase().includes(query) ||
          p.state.toLowerCase().includes(query) ||
          p.party.toLowerCase().includes(query),
      )
      .slice(0, 20)
  })

  function handleSearchKeydown(e: KeyboardEvent) {
    if (!searchOpen) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      highlightedIndex = Math.min(highlightedIndex + 1, searchResults.length - 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      highlightedIndex = Math.max(highlightedIndex - 1, 0)
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      window.location.href = `/pollies/${searchResults[highlightedIndex].slug}`
    } else if (e.key === "Escape") {
      searchOpen = false
    }
  }

  function handleSearchInput() {
    searchOpen = searchInput.trim().length > 0
    highlightedIndex = -1
  }

  let filteredData = $derived.by(() => {
    let result = polliesByDecade

    if (decadeFilter) {
      result = result.filter((group) => group.decade === decadeFilter)
    }

    if (houseFilter || stateFilter || partyFilter) {
      result = result
        .map((group) => ({
          ...group,
          pollies: group.pollies.filter((p) => {
            if (houseFilter && p.house !== houseFilter) return false
            if (stateFilter && p.state !== stateFilter) return false
            if (partyFilter && p.party.trim() !== partyFilter) return false
            return true
          }),
        }))
        .filter((group) => group.pollies.length > 0)
    }

    return result
  })

  function clearFilters() {
    searchInput = ""
    houseFilter = ""
    stateFilter = ""
    partyFilter = ""
    decadeFilter = ""
  }

  let hasActiveFilters = $derived(
    searchInput || houseFilter || stateFilter || partyFilter || decadeFilter,
  )

  function markerClass(party: string): string {
    const colour = getPartyColour(party)
    return `marker marker-${colour || "default"}`
  }

  function houseClass(house: House): string {
    return `marker marker-${house}`
  }
</script>

<section class="directory-controls" aria-label="Directory filters">
  <h2 class="directory-heading">The directory</h2>

  <div class="search-wrapper">
    <label for="pollie-search" class="visually-hidden">
      Search politicians by name, electorate, state or party
    </label>
    <!-- svelte-ignore a11y_role_supports_aria_props -->
    <input
      id="pollie-search"
      type="text"
      bind:value={searchInput}
      oninput={handleSearchInput}
      onkeydown={handleSearchKeydown}
      onfocusin={() => { if (searchInput.trim()) searchOpen = true }}
      onfocusout={() => { setTimeout(() => searchOpen = false, 150) }}
      placeholder="Search by name, electorate, state or party"
      class="search-input"
      role="combobox"
      aria-expanded={searchOpen}
      aria-controls="pollie-search-listbox"
      aria-autocomplete="list"
      aria-activedescendant={highlightedIndex >= 0 ? `pollie-option-${highlightedIndex}` : undefined}
    />
    {#if searchOpen && searchInput.trim()}
      <ul id="pollie-search-listbox" class="combobox-content" role="listbox">
        {#each searchResults as pollie, i (pollie.slug)}
          <li
            id={`pollie-option-${i}`}
            role="option"
            class="combobox-item"
            class:highlighted={i === highlightedIndex}
            aria-selected={i === highlightedIndex}
            onmousedown={() => { window.location.href = `/pollies/${pollie.slug}` }}
            onmouseenter={() => { highlightedIndex = i }}
          >
            <span class="combobox-name">{pollie.name}</span>
            <span class="combobox-meta">
              <span class={markerClass(pollie.party)}>{pollie.party}</span>
              <span class={houseClass(pollie.house)}>
                {pollie.house === "senate" ? "Senator" : "MP"}
              </span>
              <span class="combobox-location">
                {pollie.division || pollie.state}{pollie.division ? `, ${pollie.state}` : ""}
              </span>
            </span>
          </li>
        {:else}
          <li class="combobox-empty">No politicians found</li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="filter-row">
    <span class="filter-label caps">Filter</span>
    <select bind:value={houseFilter} class="filter-select" aria-label="Filter by chamber">
      <option value="">All chambers</option>
      <option value="senate">Senators</option>
      <option value="reps">MPs</option>
    </select>

    <select bind:value={stateFilter} class="filter-select" aria-label="Filter by state">
      <option value="">All states</option>
      {#each uniqueStates as state}
        <option value={state}>{state}</option>
      {/each}
    </select>

    <select bind:value={partyFilter} class="filter-select" aria-label="Filter by party">
      <option value="">All parties</option>
      {#each uniqueParties as party}
        <option value={party}>{party}</option>
      {/each}
    </select>

    <select bind:value={decadeFilter} class="filter-select" aria-label="Filter by decade">
      <option value="">All decades</option>
      {#each uniqueDecades as decade}
        <option value={decade}>{decade}</option>
      {/each}
    </select>

    {#if hasActiveFilters}
      <button type="button" class="btn-link clear-link" onclick={clearFilters}>
        Clear
      </button>
    {/if}
  </div>
</section>

{#each filteredData as group (group.decade)}
  <section class="decade-section" aria-labelledby={`decade-${group.decade}`}>
    <header class="decade-header">
      <h2 id={`decade-${group.decade}`} class="decade-heading">{group.decade}</h2>
      <span class="decade-count caps">
        {group.pollies.length} {group.pollies.length === 1 ? "entry" : "entries"}
      </span>
    </header>
    <ol class="entry-list">
      {#each group.pollies as pollie (pollie.slug)}
        <li class="entry">
          <a href={`/pollies/${pollie.slug}`} class="entry-link">
            {#if pollie.photoUrl && !photoErrors.has(pollie.slug)}
              <img
                src={pollie.photoUrl}
                alt=""
                class="entry-portrait"
                loading="lazy"
                onerror={() => {
                  photoErrors.add(pollie.slug)
                  photoErrors = new Set(photoErrors)
                }}
              />
            {:else}
              <span class="entry-portrait entry-portrait-placeholder" aria-hidden="true">
                {pollie.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("")}
              </span>
            {/if}
            <div class="entry-body">
              <span class="entry-name">{pollie.name}</span>
              <span class="entry-meta">
                <span class={markerClass(pollie.party)}>{pollie.party}</span>
                <span class={houseClass(pollie.house)}>
                  {pollie.house === "senate" ? "Senator" : "MP"}
                </span>
                <span class="entry-location">
                  {pollie.division || pollie.state}{pollie.division ? `, ${pollie.state}` : ""}
                </span>
              </span>
            </div>
            <span class="entry-gigs">
              {#if pollie.gigCount.verified > 0 && pollie.gigCount.unverified === 0}
                <span class="gig-count">
                  <span class="gig-number">{pollie.gigCount.verified}</span>
                  <span class="gig-label">{pollie.gigCount.verified === 1 ? "gig" : "gigs"}</span>
                </span>
              {:else if pollie.gigCount.verified > 0}
                <span class="gig-count">
                  <span class="gig-number">{pollie.gigCount.verified}</span>
                  <span class="gig-label">{pollie.gigCount.verified === 1 ? "gig" : "gigs"}</span>
                  <span class="gig-plus">+ {pollie.gigCount.unverified} unverified</span>
                </span>
              {:else if pollie.gigCount.unverified > 0}
                <span class="gig-count gig-count-unverified">
                  <span class="gig-number">{pollie.gigCount.unverified}</span>
                  <span class="gig-label">unverified</span>
                </span>
              {:else}
                <span class="gig-count gig-count-empty">
                  <span class="gig-label">—</span>
                </span>
              {/if}
            </span>
          </a>
        </li>
      {/each}
    </ol>
  </section>
{/each}

{#if filteredData.length === 0}
  <p class="empty-state">
    <em>No entries match those filters.</em>
    {#if hasActiveFilters}
      <button type="button" class="btn-link" onclick={clearFilters}>
        Clear filters
      </button>
    {/if}
  </p>
{/if}

<style>
  /* ------------------------------------------------------------
     Controls block
     ------------------------------------------------------------ */

  .directory-controls {
    margin-bottom: var(--space-2xl);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--color-rule);
  }

  .directory-heading {
    margin-top: 0;
    margin-bottom: var(--space-md);
  }

  .search-wrapper {
    position: relative;
    margin-bottom: var(--space-md);
  }

  /* Editorial underline-rule input — no boxed field */
  .search-input {
    width: 100%;
    font-family: var(--font-serif-stack);
    font-size: 1.2rem;
    font-style: italic;
    padding: var(--space-sm) 0;
    background: transparent;
    color: var(--color-ink);
    border: none;
    border-bottom: 1px solid var(--color-rule-strong);
    border-radius: 0;
    box-shadow: none;
    transition: border-bottom-color var(--dur-fast) var(--ease-out),
                border-bottom-width var(--dur-fast) var(--ease-out);
  }

  .search-input::placeholder {
    color: var(--color-ink-3);
    font-style: italic;
  }

  .search-input:focus {
    outline: none;
    border-bottom-color: var(--color-accent);
    box-shadow: 0 1px 0 0 var(--color-accent);
  }

  /* ------------------------------------------------------------
     Combobox dropdown
     ------------------------------------------------------------ */

  .combobox-content {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    list-style: none;
    padding: 0;
    margin: 0;
    background: var(--color-paper);
    border: 1px solid var(--color-rule-strong);
    border-top: none;
    max-height: 22rem;
    overflow-y: auto;
    z-index: 100;
  }

  .combobox-item {
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    border-bottom: 1px solid var(--color-rule);
    display: grid;
    gap: 0.2rem;
    transition: background var(--dur-fast) var(--ease-out);
  }

  .combobox-item:last-child {
    border-bottom: none;
  }

  .combobox-item.highlighted {
    background: var(--color-paper-tint);
  }

  .combobox-name {
    font-family: var(--font-serif-stack);
    font-weight: 600;
    color: var(--color-ink);
  }

  .combobox-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
  }

  .combobox-location {
    color: var(--color-ink-3);
  }

  .combobox-empty {
    padding: var(--space-md);
    font-style: italic;
    color: var(--color-ink-3);
  }

  /* ------------------------------------------------------------
     Filter row
     ------------------------------------------------------------ */

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
  }

  .filter-label {
    color: var(--color-ink-3);
    margin-right: var(--space-2xs);
  }

  .filter-select {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    padding: 0.3rem 1.8rem 0.3rem 0.55rem;
    background: transparent;
    color: var(--color-ink-2);
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    cursor: pointer;
    width: auto;
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, var(--color-ink-3) 50%),
                      linear-gradient(-45deg, transparent 50%, var(--color-ink-3) 50%);
    background-position: calc(100% - 0.8rem) 50%, calc(100% - 0.5rem) 50%;
    background-size: 5px 5px;
    background-repeat: no-repeat;
    transition: border-color var(--dur-fast) var(--ease-out),
                color var(--dur-fast) var(--ease-out);
  }

  .filter-select:hover {
    color: var(--color-ink);
    border-color: var(--color-ink-2);
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-accent);
    color: var(--color-ink);
  }

  .clear-link {
    margin-left: auto;
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* ------------------------------------------------------------
     Decade sections
     ------------------------------------------------------------ */

  .decade-section {
    margin-bottom: var(--space-3xl);
  }

  .decade-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-lg);
    margin-bottom: var(--space-lg);
    padding-bottom: var(--space-xs);
    border-bottom: 1px solid var(--color-rule);
  }

  .decade-heading {
    margin: 0;
    font-variant-numeric: lining-nums;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .decade-count {
    color: var(--color-ink-3);
    font-variant-numeric: tabular-nums lining-nums;
  }

  /* ------------------------------------------------------------
     Entry list
     ------------------------------------------------------------ */

  .entry-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .entry {
    border-bottom: 1px solid var(--color-rule);
  }

  .entry:first-child {
    border-top: 1px solid var(--color-rule);
  }

  .entry-link {
    display: grid;
    grid-template-columns: 3rem 1fr auto;
    gap: var(--space-md);
    align-items: center;
    padding: var(--space-md) 0;
    color: inherit;
    text-decoration: none;
    transition: background var(--dur-fast) var(--ease-out);
  }

  .entry-link:hover {
    background: var(--color-paper-alt);
  }

  .entry-link:hover .entry-name {
    color: var(--color-accent);
  }

  /* Portrait: small reserved column, square-ish */
  .entry-portrait {
    width: 3rem;
    height: 3.75rem;
    object-fit: cover;
    background: var(--color-paper-deep);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-sm);
    display: block;
  }

  .entry-portrait-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif-stack);
    font-style: italic;
    font-size: 0.92rem;
    color: var(--color-ink-3);
    font-feature-settings: "lnum";
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .entry-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .entry-name {
    font-family: var(--font-serif-stack);
    font-size: 1.15rem;
    font-weight: 500;
    color: var(--color-ink);
    letter-spacing: -0.005em;
    transition: color var(--dur-fast) var(--ease-out);
  }

  .entry-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
  }

  .entry-location {
    color: var(--color-ink-3);
  }

  /* ------------------------------------------------------------
     Gig count, right-hand column
     ------------------------------------------------------------ */

  .entry-gigs {
    font-family: var(--font-sans-stack);
    text-align: right;
    color: var(--color-ink-2);
    font-feature-settings: "tnum", "lnum";
  }

  .gig-count {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: baseline;
    gap: 0.3rem;
  }

  .gig-number {
    font-family: var(--font-serif-stack);
    font-size: 1.4rem;
    font-weight: 500;
    color: var(--color-ink);
    font-variant-numeric: lining-nums tabular-nums;
    letter-spacing: -0.01em;
  }

  .gig-label {
    font-size: var(--text-caps);
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--color-ink-3);
  }

  .gig-plus {
    display: block;
    flex-basis: 100%;
    font-size: var(--text-caps);
    font-style: italic;
    text-transform: none;
    letter-spacing: normal;
    color: var(--color-ink-3);
    margin-top: 0.1rem;
  }

  .gig-count-unverified .gig-number {
    color: var(--color-ink-3);
    font-style: italic;
  }

  .gig-count-empty .gig-label {
    color: var(--color-ink-3);
    font-family: var(--font-serif-stack);
    font-size: 1.1rem;
    text-transform: none;
    letter-spacing: normal;
  }

  /* ------------------------------------------------------------
     Markers (party / chamber) — archival stamp style
     ------------------------------------------------------------ */

  .marker {
    display: inline-block;
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    padding: 0.1rem 0.5rem 0.125rem;
    border-radius: var(--radius-sm);
    white-space: nowrap;
    line-height: 1.3;
  }

  .marker-senate {
    background: var(--marker-senate-bg);
    color: var(--marker-senate-ink);
    border: 1px solid var(--marker-senate-rule);
  }

  .marker-reps {
    background: var(--marker-reps-bg);
    color: var(--marker-reps-ink);
    border: 1px solid var(--marker-reps-rule);
  }

  .marker-red {
    background: var(--marker-red-bg);
    color: var(--marker-red-ink);
    border: 1px solid var(--marker-red-rule);
  }

  .marker-blue {
    background: var(--marker-blue-bg);
    color: var(--marker-blue-ink);
    border: 1px solid var(--marker-blue-rule);
  }

  .marker-green {
    background: var(--marker-green-bg);
    color: var(--marker-green-ink);
    border: 1px solid var(--marker-green-rule);
  }

  .marker-grey {
    background: var(--marker-grey-bg);
    color: var(--marker-grey-ink);
    border: 1px solid var(--marker-grey-rule);
  }

  .marker-orange {
    background: var(--marker-orange-bg);
    color: var(--marker-orange-ink);
    border: 1px solid var(--marker-orange-rule);
  }

  .marker-purple {
    background: var(--marker-purple-bg);
    color: var(--marker-purple-ink);
    border: 1px solid var(--marker-purple-rule);
  }

  .marker-default {
    background: var(--marker-default-bg);
    color: var(--marker-default-ink);
    border: 1px solid var(--marker-default-rule);
  }

  /* ------------------------------------------------------------
     Empty state
     ------------------------------------------------------------ */

  .empty-state {
    font-family: var(--font-serif-stack);
    font-size: 1.05rem;
    color: var(--color-ink-2);
    padding: var(--space-xl) 0;
    max-width: var(--measure-reading);
  }

  .empty-state .btn-link {
    margin-left: var(--space-xs);
  }

  /* ------------------------------------------------------------
     Responsive: on narrow screens, collapse gig column below body
     ------------------------------------------------------------ */

  @media (width < 40rem) {
    .entry-link {
      grid-template-columns: 2.5rem 1fr;
      grid-template-areas:
        "portrait body"
        "portrait gigs";
      gap: var(--space-sm) var(--space-md);
    }

    .entry-portrait {
      grid-area: portrait;
      width: 2.5rem;
      height: 3.125rem;
    }

    .entry-body {
      grid-area: body;
    }

    .entry-gigs {
      grid-area: gigs;
      text-align: left;
    }

    .gig-count {
      justify-content: flex-start;
    }

    .gig-number {
      font-size: 1rem;
    }

    .decade-header {
      flex-wrap: wrap;
    }
  }
</style>
