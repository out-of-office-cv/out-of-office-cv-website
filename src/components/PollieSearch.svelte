<script lang="ts">
  import { getPartyColour } from "../utils/pollie"
  import type { House } from "../types"

  interface PollieOption {
    slug: string
    name: string
    party: string
    house: House
    division: string
    state: string
  }

  interface Props {
    pollies: PollieOption[]
  }

  let { pollies }: Props = $props()

  let inputValue = $state("")
  let open = $state(false)
  let highlightedIndex = $state(-1)

  let filtered = $derived.by(() => {
    const query = inputValue.toLowerCase().trim()
    if (!query) return []
    return pollies
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.slug.includes(query) ||
          p.division.toLowerCase().includes(query) ||
          p.state.toLowerCase().includes(query) ||
          p.party.toLowerCase().includes(query),
      )
      .slice(0, 20)
  })

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      highlightedIndex = Math.min(highlightedIndex + 1, filtered.length - 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      highlightedIndex = Math.max(highlightedIndex - 1, 0)
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault()
      window.location.href = `/pollies/${filtered[highlightedIndex].slug}`
    } else if (e.key === "Escape") {
      open = false
    }
  }

  function handleInput() {
    open = inputValue.trim().length > 0
    highlightedIndex = -1
  }

  function badgeClass(party: string): string {
    const colour = getPartyColour(party)
    return `badge badge-party-${colour || "default"}`
  }

  function houseClass(house: House): string {
    return `badge badge-${house}`
  }
</script>

<div class="pollie-search-wrapper">
  <div class="search-wrapper">
    <input
      type="text"
      bind:value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocusin={() => { if (inputValue.trim()) open = true }}
      onfocusout={() => { setTimeout(() => open = false, 150) }}
      placeholder="Search by name, electorate, state or party..."
      class="pollie-search-input"
      role="combobox"
      aria-expanded={open}
      aria-controls="pollie-search-listbox"
      aria-autocomplete="list"
      aria-activedescendant={highlightedIndex >= 0 ? `pollie-search-option-${highlightedIndex}` : undefined}
    />
    {#if open && inputValue.trim()}
      <ul id="pollie-search-listbox" class="pollie-search-content" role="listbox">
        {#each filtered as pollie, i (pollie.slug)}
          <li
            id={`pollie-search-option-${i}`}
            role="option"
            class="pollie-search-item"
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
</div>

<style>
  .pollie-search-wrapper {
    margin-bottom: 1.5rem;
  }

  .search-wrapper {
    position: relative;
  }

  .pollie-search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
    color: var(--color-text-1);
  }

  .pollie-search-input:focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .pollie-search-input::placeholder {
    color: var(--color-text-3);
  }

  .pollie-search-content {
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
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
  }

  .pollie-search-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
  }

  .pollie-search-item.highlighted {
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

  .pollie-location {
    color: var(--color-text-2);
    font-size: 0.875rem;
  }

  .no-results {
    padding: 0.75rem 1rem;
    color: var(--color-text-3);
  }

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
