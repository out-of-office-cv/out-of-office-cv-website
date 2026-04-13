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

  function badgeClass(party: string): string {
    const colour = getPartyColour(party)
    return `badge badge-party-${colour || "default"}`
  }

  function houseClass(house: House): string {
    return `badge badge-${house}`
  }
</script>

<div class="pollie-filters">
  <h2 class="filter-heading">Find a politician</h2>

  <div class="search-wrapper">
    <label for="pollie-search" class="visually-hidden">
      Search politicians by name, electorate, state or party
    </label>
    <!--
      Svelte's a11y linter follows ARIA 1.1, where role="combobox" had to wrap
      the input. ARIA 1.2 (the current spec) puts the role on the input itself,
      so this pattern is correct — see WAI-ARIA Authoring Practices "Combobox".
    -->
    <!-- svelte-ignore a11y_role_supports_aria_props -->
    <input
      id="pollie-search"
      type="text"
      bind:value={searchInput}
      oninput={handleSearchInput}
      onkeydown={handleSearchKeydown}
      onfocusin={() => { if (searchInput.trim()) searchOpen = true }}
      onfocusout={() => { setTimeout(() => searchOpen = false, 150) }}
      placeholder="Search by name, electorate, state or party..."
      class="pollie-search"
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
            <div class="combobox-item-inner">
              <strong>{pollie.name}</strong>
              <span class="combobox-meta">
                <span class={badgeClass(pollie.party)}>{pollie.party}</span>
                <span class={houseClass(pollie.house)}>
                  {pollie.house === "senate" ? "Senator" : "MP"}
                </span>
                <span class="pollie-location">
                  {pollie.division || pollie.state}{pollie.division ? `, ${pollie.state}` : ""}
                </span>
              </span>
            </div>
          </li>
        {:else}
          <li class="no-results">No politicians found</li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="filter-row">
    <select bind:value={houseFilter} class="filter-select">
      <option value="">All chambers</option>
      <option value="senate">Senators</option>
      <option value="reps">MPs</option>
    </select>

    <select bind:value={stateFilter} class="filter-select">
      <option value="">All states</option>
      {#each uniqueStates as state}
        <option value={state}>{state}</option>
      {/each}
    </select>

    <select bind:value={partyFilter} class="filter-select">
      <option value="">All parties</option>
      {#each uniqueParties as party}
        <option value={party}>{party}</option>
      {/each}
    </select>

    <select bind:value={decadeFilter} class="filter-select">
      <option value="">All decades</option>
      {#each uniqueDecades as decade}
        <option value={decade}>{decade}</option>
      {/each}
    </select>

    {#if hasActiveFilters}
      <button type="button" class="clear-filters" onclick={clearFilters}>
        Clear filters
      </button>
    {/if}
  </div>
</div>

{#each filteredData as group (group.decade)}
  <h2>{group.decade}</h2>
  <ul class="pollie-list">
    {#each group.pollies as pollie (pollie.slug)}
      <li class="pollie-card">
        <a href={`/pollies/${pollie.slug}`} class="pollie-link">
          {#if pollie.photoUrl && !photoErrors.has(pollie.slug)}
            <img
              src={pollie.photoUrl}
              alt={`Photo of ${pollie.name}`}
              class="pollie-photo"
              onerror={() => {
                photoErrors.add(pollie.slug)
                photoErrors = new Set(photoErrors)
              }}
            />
          {:else}
            <div class="pollie-photo" aria-hidden="true"></div>
          {/if}
          <div class="pollie-content">
            <span class="pollie-name">{pollie.name}</span>
            <div class="pollie-meta">
              <span class={badgeClass(pollie.party)}>{pollie.party}</span>
              <span class={houseClass(pollie.house)}>
                {pollie.house === "senate" ? "Senator" : "MP"}
              </span>
              <span class="pollie-location">
                {pollie.division || pollie.state}{pollie.division ? `, ${pollie.state}` : ""}
              </span>
              {#if pollie.gigCount.verified > 0 && pollie.gigCount.unverified === 0}
                <span class="gig-count">
                  {pollie.gigCount.verified} {pollie.gigCount.verified === 1 ? "gig" : "gigs"}
                </span>
              {:else if pollie.gigCount.verified > 0}
                <span class="gig-count">
                  {pollie.gigCount.verified} {pollie.gigCount.verified === 1 ? "gig" : "gigs"} ({pollie.gigCount.unverified} unverified)
                </span>
              {:else if pollie.gigCount.unverified > 0}
                <span class="gig-count gig-count-unverified">
                  {pollie.gigCount.unverified} unverified
                </span>
              {/if}
            </div>
          </div>
        </a>
      </li>
    {/each}
  </ul>
{/each}

{#if filteredData.length === 0}
  <p class="no-results">No results found. Try adjusting your filters.</p>
{/if}

<style>
  .pollie-filters {
    margin-bottom: 1.5rem;
  }

  .filter-heading {
    margin-top: 0;
    margin-bottom: 0.75rem;
    border-top: none;
  }

  .search-wrapper {
    position: relative;
    margin-bottom: 0.75rem;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .pollie-search {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
    color: var(--color-text-1);
  }

  .pollie-search:focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .pollie-search::placeholder {
    color: var(--color-text-3);
  }

  .combobox-content {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    list-style: none;
    padding: 0;
    margin: 4px 0 0;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
    max-height: 350px;
    overflow-y: auto;
    z-index: 100;
  }

  .combobox-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
  }

  .combobox-item.highlighted {
    background: var(--color-bg-soft);
  }

  .combobox-item-inner {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .combobox-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text-1);
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .clear-filters {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-soft);
    color: var(--color-text-2);
    cursor: pointer;
  }

  .clear-filters:hover {
    background: var(--color-bg-alt);
    color: var(--color-text-1);
  }

  .pollie-list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }

  .pollie-card {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-soft);
    overflow: hidden;
    margin-top: 0;
  }

  .pollie-link {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    text-decoration: none;
    color: inherit;
  }

  .pollie-link:hover {
    background: var(--color-bg-alt);
  }

  .pollie-photo {
    width: 48px;
    height: 60px;
    object-fit: cover;
    border-radius: 4px;
    background-color: var(--color-bg-alt);
    flex-shrink: 0;
  }

  .pollie-content {
    flex: 1;
    min-width: 0;
  }

  .pollie-name {
    display: block;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text-1);
    margin-bottom: 0.375rem;
  }

  .pollie-link:hover .pollie-name {
    color: var(--color-brand-1);
  }

  .pollie-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .pollie-location {
    color: var(--color-text-2);
    font-size: 0.875rem;
  }

  .gig-count {
    font-size: 0.75rem;
    color: var(--color-text-3);
    background: var(--color-bg-alt);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }

  .gig-count-unverified {
    font-style: italic;
  }

  .no-results {
    text-align: center;
    color: var(--color-text-2);
    padding: 2rem;
  }

  /* Badge styles (inline since these are in a Svelte component) */
  .badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    color: white;
  }

  .badge-party-red { background-color: var(--badge-party-red); }
  .badge-party-blue { background-color: var(--badge-party-blue); }
  .badge-party-green { background-color: var(--badge-party-green); }
  .badge-party-grey { background-color: var(--badge-party-grey); }
  .badge-party-orange { background-color: var(--badge-party-orange); }
  .badge-party-purple { background-color: var(--badge-party-purple); }
  .badge-party-default {
    background-color: var(--color-bg-soft);
    color: var(--color-text-2);
    border: 1px solid var(--color-border);
  }

  .badge-senate { background-color: var(--badge-senate); }
  .badge-reps { background-color: var(--badge-reps); }
</style>
