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

  function markerClass(party: string): string {
    const colour = getPartyColour(party)
    return `marker marker-${colour || "default"}`
  }

  function houseClass(house: House): string {
    return `marker marker-${house}`
  }
</script>

<div class="pollie-search-wrapper">
  <label for="pollie-detail-search" class="visually-hidden">
    Jump to another politician
  </label>
  <div class="search-wrapper">
    <!-- svelte-ignore a11y_role_supports_aria_props -->
    <input
      id="pollie-detail-search"
      type="text"
      bind:value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocusin={() => { if (inputValue.trim()) open = true }}
      onfocusout={() => { setTimeout(() => open = false, 150) }}
      placeholder="Jump to another politician…"
      class="search-input"
      role="combobox"
      aria-expanded={open}
      aria-controls="pollie-search-listbox"
      aria-autocomplete="list"
      aria-activedescendant={highlightedIndex >= 0 ? `pollie-search-option-${highlightedIndex}` : undefined}
    />
    {#if open && inputValue.trim()}
      <ul id="pollie-search-listbox" class="combobox-content" role="listbox">
        {#each filtered as pollie, i (pollie.slug)}
          <li
            id={`pollie-search-option-${i}`}
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
</div>

<style>
  .pollie-search-wrapper {
    margin-bottom: var(--space-xl);
    max-width: 34rem;
  }

  .search-wrapper {
    position: relative;
  }

  .search-input {
    width: 100%;
    font-family: var(--font-serif-stack);
    font-size: 1rem;
    font-style: italic;
    padding: var(--space-xs) 0;
    background: transparent;
    color: var(--color-ink);
    border: none;
    border-bottom: 1px solid var(--color-rule);
    border-radius: 0;
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
    max-height: 20rem;
    overflow-y: auto;
    z-index: 100;
  }

  .combobox-item {
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    border-bottom: 1px solid var(--color-rule);
    display: grid;
    gap: 0.2rem;
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
</style>
