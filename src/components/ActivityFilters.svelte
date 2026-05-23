<script lang="ts">
  interface Props {
    actions: string[]
    bys: string[]
    total: number
  }

  let { actions, bys, total }: Props = $props()

  let search = $state("")
  let actionFilter = $state(new Set<string>())
  let byFilter = $state(new Set<string>())
  let sortDir = $state<"desc" | "asc">("desc")
  let visibleCount = $state(total)

  let eventEls: HTMLLIElement[] = []
  let listEl: HTMLOListElement | null = null

  function init() {
    if (typeof document === "undefined") return
    listEl = document.querySelector<HTMLOListElement>(".event-list")
    eventEls = Array.from(document.querySelectorAll<HTMLLIElement>(".event-list .event"))
    applyFilters()
  }

  function applyFilters() {
    if (eventEls.length === 0) return
    const q = search.toLowerCase().trim()
    let count = 0
    for (const el of eventEls) {
      const searchText = el.dataset.search || ""
      const action = el.dataset.action || ""
      const by = el.dataset.by || ""

      let visible = true
      if (actionFilter.size && !actionFilter.has(action)) visible = false
      if (visible && byFilter.size && !byFilter.has(by)) visible = false
      if (visible && q && !searchText.includes(q)) visible = false

      el.hidden = !visible
      if (visible) count++
    }
    visibleCount = count
  }

  function applySort() {
    if (!listEl || eventEls.length === 0) return
    const dir = sortDir
    const sorted = [...eventEls].sort((a, b) => {
      const da = a.dataset.date || ""
      const db = b.dataset.date || ""
      return dir === "desc" ? db.localeCompare(da) : da.localeCompare(db)
    })
    for (const el of sorted) listEl.appendChild(el)
    eventEls = sorted
  }

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  function toggleSort() {
    sortDir = sortDir === "desc" ? "asc" : "desc"
    applySort()
  }

  $effect(() => {
    init()
  })
</script>

<section class="controls-section" aria-label="Activity filters">
  <div class="controls">
    <input
      type="text"
      bind:value={search}
      oninput={applyFilters}
      placeholder="Search by politician, role, organisation…"
      class="search"
      aria-label="Filter activity"
    />
    <button type="button" class="sort-btn" onclick={toggleSort}>
      Date {sortDir === "desc" ? "↓" : "↑"}
    </button>
  </div>

  <div class="filter-row">
    <span class="caps filter-label">Action</span>
    {#each actions as a}
      <button
        type="button"
        class="chip"
        class:active={actionFilter.has(a)}
        onclick={() => { actionFilter = toggle(actionFilter, a); applyFilters() }}
      >
        {a}
      </button>
    {/each}
  </div>

  <div class="filter-row">
    <span class="caps filter-label">By</span>
    {#each bys as b}
      <button
        type="button"
        class="chip"
        class:active={byFilter.has(b)}
        onclick={() => { byFilter = toggle(byFilter, b); applyFilters() }}
      >
        {b}
      </button>
    {/each}
  </div>

  <p class="count">{visibleCount} of {total}</p>
</section>

<style>
  .controls-section {
    max-width: var(--measure-wide);
  }
  .controls {
    display: flex;
    gap: var(--space-md);
    align-items: baseline;
    margin-bottom: var(--space-md);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--color-rule);
  }
  .search {
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-rule);
    border-radius: 0;
    padding: var(--space-xs) 0;
    font-family: var(--font-serif-stack);
    font-style: italic;
    font-size: 1rem;
  }
  .search:focus { outline: none; border-bottom-color: var(--color-accent); }
  .sort-btn {
    background: none; border: none; cursor: pointer;
    color: var(--color-ink-2); font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
  }
  .filter-row {
    display: flex; flex-wrap: wrap; gap: var(--space-xs);
    align-items: baseline; margin-bottom: var(--space-sm);
  }
  .filter-label { color: var(--color-ink-3); margin-right: var(--space-xs); }
  .chip {
    background: transparent;
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    padding: 0.15rem 0.55rem;
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-2);
    cursor: pointer;
  }
  .chip.active {
    background: var(--color-accent-soft);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .count {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-3);
    margin: var(--space-md) 0 var(--space-sm);
  }
</style>
