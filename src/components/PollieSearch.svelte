<script lang="ts">
  interface PollieOption {
    slug: string
    name: string
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
      .filter((p) => p.name.toLowerCase().includes(query) || p.slug.includes(query))
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
      placeholder="Search by name..."
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
            {pollie.name}
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

  .no-results {
    padding: 0.75rem 1rem;
    color: var(--color-text-3);
  }
</style>
