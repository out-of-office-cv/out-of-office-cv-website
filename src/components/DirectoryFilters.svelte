<script lang="ts">
  import type { House } from "../types"
  import { getPartyColour } from "../utils/pollie"

  interface Props {
    decades: string[]
    states: string[]
    parties: string[]
  }

  let { decades, states, parties }: Props = $props()

  interface SearchEntry {
    slug: string
    name: string
    party: string
    house: House
    division: string
    state: string
    searchText: string
  }

  let searchInput = $state("")
  let houseFilter = $state<House | "">("")
  let stateFilter = $state("")
  let partyFilter = $state("")
  let decadeFilter = $state("")
  let searchOpen = $state(false)
  let highlightedIndex = $state(-1)

  let searchIndex = $state<SearchEntry[]>([])

  let entryEls: HTMLLIElement[] = []
  let sectionEls: HTMLElement[] = []

  function buildIndex() {
    if (typeof document === "undefined") return
    entryEls = Array.from(document.querySelectorAll<HTMLLIElement>(".decade-section .entry"))
    sectionEls = Array.from(document.querySelectorAll<HTMLElement>(".decade-section"))
    searchIndex = entryEls.map((el) => {
      const a = el.querySelector("a")
      const slug = a?.getAttribute("href")?.replace(/^\/pollies\//, "") || ""
      const name = el.querySelector(".entry-name")?.textContent?.trim() || ""
      const party = el.dataset.party || ""
      const house = (el.dataset.house || "reps") as House
      const division = el.querySelector(".entry-location")?.textContent?.trim() || ""
      const state = el.dataset.state || ""
      return {
        slug,
        name,
        party,
        house,
        division: division.split(",")[0]?.trim() || "",
        state,
        searchText: `${name} ${division} ${state} ${party}`.toLowerCase(),
      }
    })
  }

  function applyFilters() {
    if (entryEls.length === 0) return
    const query = searchInput.toLowerCase().trim()
    const sectionVisible = new Map<HTMLElement, number>()
    for (const section of sectionEls) sectionVisible.set(section, 0)

    for (let i = 0; i < entryEls.length; i++) {
      const el = entryEls[i]
      const entry = searchIndex[i]
      const section = el.closest<HTMLElement>(".decade-section")
      const sectionDecade = section?.dataset.decade || ""

      let visible = true
      if (decadeFilter && sectionDecade !== decadeFilter) visible = false
      if (visible && houseFilter && entry.house !== houseFilter) visible = false
      if (visible && stateFilter && entry.state !== stateFilter) visible = false
      if (visible && partyFilter && entry.party !== partyFilter) visible = false
      if (visible && query && !entry.searchText.includes(query)) visible = false

      el.hidden = !visible
      if (visible && section) sectionVisible.set(section, (sectionVisible.get(section) || 0) + 1)
    }

    let anyVisible = false
    for (const [section, count] of sectionVisible) {
      section.hidden = count === 0
      if (count > 0) anyVisible = true
      const countEl = section.querySelector("[data-visible-count]")
      const labelEl = section.querySelector("[data-entry-label]")
      if (countEl) countEl.textContent = String(count)
      if (labelEl) labelEl.textContent = count === 1 ? "entry" : "entries"
    }
    showEmptyState(!anyVisible)
  }

  function showEmptyState(show: boolean) {
    if (typeof document === "undefined") return
    const el = document.querySelector<HTMLElement>(".empty-state")
    if (el) el.hidden = !show
  }

  let searchResults = $derived.by(() => {
    const query = searchInput.toLowerCase().trim()
    if (!query) return []
    return searchIndex
      .filter((p) => p.searchText.includes(query))
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
    applyFilters()
  }

  function clearFilters() {
    searchInput = ""
    houseFilter = ""
    stateFilter = ""
    partyFilter = ""
    decadeFilter = ""
    applyFilters()
  }

  let hasActiveFilters = $derived(
    !!(searchInput || houseFilter || stateFilter || partyFilter || decadeFilter),
  )

  function markerClass(party: string): string {
    const colour = getPartyColour(party)
    return `marker marker-${colour || "default"}`
  }

  function houseClass(house: House): string {
    return `marker marker-${house}`
  }

  $effect(() => {
    buildIndex()
  })
</script>

<search class="directory-controls">
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
    <select bind:value={houseFilter} onchange={applyFilters} class="filter-select" aria-label="Filter by chamber">
      <option value="">All chambers</option>
      <option value="senate">Senators</option>
      <option value="reps">MPs</option>
    </select>

    <select bind:value={stateFilter} onchange={applyFilters} class="filter-select" aria-label="Filter by state">
      <option value="">All states</option>
      {#each states as state}
        <option value={state}>{state}</option>
      {/each}
    </select>

    <select bind:value={partyFilter} onchange={applyFilters} class="filter-select" aria-label="Filter by party">
      <option value="">All parties</option>
      {#each parties as party}
        <option value={party}>{party}</option>
      {/each}
    </select>

    <select bind:value={decadeFilter} onchange={applyFilters} class="filter-select" aria-label="Filter by decade">
      <option value="">All decades</option>
      {#each decades as decade}
        <option value={decade}>{decade}</option>
      {/each}
    </select>

    {#if hasActiveFilters}
      <button type="button" class="btn-link clear-link" onclick={clearFilters}>
        Clear
      </button>
    {/if}
  </div>
</search>

<style>
  .directory-controls {
    display: block;
    margin-bottom: var(--space-2xl);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--color-rule);
  }

  .directory-heading {
    margin-top: 0;
    margin-bottom: var(--space-md);
    font-size: var(--text-h2);
    font-weight: 600;
    letter-spacing: -0.005em;
  }

  .search-wrapper {
    position: relative;
    margin-bottom: var(--space-md);
  }

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
    transition: border-bottom-color var(--dur-fast) var(--ease-out);
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
  .marker-senate { background: var(--marker-senate-bg); color: var(--marker-senate-ink); border: 1px solid var(--marker-senate-rule); }
  .marker-reps { background: var(--marker-reps-bg); color: var(--marker-reps-ink); border: 1px solid var(--marker-reps-rule); }
  .marker-red { background: var(--marker-red-bg); color: var(--marker-red-ink); border: 1px solid var(--marker-red-rule); }
  .marker-blue { background: var(--marker-blue-bg); color: var(--marker-blue-ink); border: 1px solid var(--marker-blue-rule); }
  .marker-green { background: var(--marker-green-bg); color: var(--marker-green-ink); border: 1px solid var(--marker-green-rule); }
  .marker-grey { background: var(--marker-grey-bg); color: var(--marker-grey-ink); border: 1px solid var(--marker-grey-rule); }
  .marker-orange { background: var(--marker-orange-bg); color: var(--marker-orange-ink); border: 1px solid var(--marker-orange-rule); }
  .marker-purple { background: var(--marker-purple-bg); color: var(--marker-purple-ink); border: 1px solid var(--marker-purple-rule); }
  .marker-default { background: var(--marker-default-bg); color: var(--marker-default-ink); border: 1px solid var(--marker-default-rule); }

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
</style>
