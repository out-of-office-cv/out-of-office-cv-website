<script lang="ts">
  interface ActivityRow {
    id: string
    sha: string
    date: string
    pollie_slug: string
    pollie_name: string
    role: string
    organisation: string
    action:
      | "added"
      | "verified"
      | "rejected"
      | "sources-edited"
      | "dates-edited"
      | "removed"
    by: string
    note?: string
  }

  interface Props {
    events: ActivityRow[]
  }

  let { events }: Props = $props()

  let search = $state("")
  let actionFilter = $state(new Set<string>())
  let byFilter = $state(new Set<string>())
  let sortDir = $state<"desc" | "asc">("desc")

  let allActions = $derived(Array.from(new Set(events.map((e) => e.action))).sort())
  let allBys = $derived(Array.from(new Set(events.map((e) => e.by))).sort())

  let filtered = $derived.by(() => {
    const q = search.toLowerCase().trim()
    return events
      .filter((e) => {
        if (actionFilter.size && !actionFilter.has(e.action)) return false
        if (byFilter.size && !byFilter.has(e.by)) return false
        if (!q) return true
        return (
          e.pollie_name.toLowerCase().includes(q) ||
          e.role.toLowerCase().includes(q) ||
          e.organisation.toLowerCase().includes(q)
        )
      })
      .sort((a, b) =>
        sortDir === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
      )
  })

  function toggle(set: Set<string>, value: string): Set<string> {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }
</script>

<section class="activity">
  <div class="controls">
    <input
      type="text"
      bind:value={search}
      placeholder="Search by politician, role, organisation…"
      class="search"
      aria-label="Filter activity"
    />
    <button
      type="button"
      class="sort-btn"
      onclick={() => (sortDir = sortDir === "desc" ? "asc" : "desc")}
    >
      Date {sortDir === "desc" ? "↓" : "↑"}
    </button>
  </div>

  <div class="filter-row">
    <span class="caps filter-label">Action</span>
    {#each allActions as a}
      <button
        type="button"
        class="chip"
        class:active={actionFilter.has(a)}
        onclick={() => (actionFilter = toggle(actionFilter, a))}
      >
        {a}
      </button>
    {/each}
  </div>

  <div class="filter-row">
    <span class="caps filter-label">By</span>
    {#each allBys as b}
      <button
        type="button"
        class="chip"
        class:active={byFilter.has(b)}
        onclick={() => (byFilter = toggle(byFilter, b))}
      >
        {b}
      </button>
    {/each}
  </div>

  <p class="count">{filtered.length} of {events.length}</p>

  <ol class="event-list">
    {#each filtered as e (e.id)}
      <li class="event">
        <time class="event-date">{e.date.slice(0, 10)}</time>
        <a class="event-pollie" href={`/pollies/${e.pollie_slug}`}>{e.pollie_name}</a>
        <span class="event-gig">{e.role} @ {e.organisation}</span>
        <span class={`event-action action-${e.action}`}>{e.action}</span>
        <span class="event-by">{e.by}</span>
        {#if e.note}
          <span class="event-note">{e.note}</span>
        {/if}
      </li>
    {/each}
  </ol>
</section>

<style>
  .activity { max-width: var(--measure-wide); }
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
  .event-list { list-style: none; margin: 0; padding: 0; }
  .event {
    display: grid;
    grid-template-columns: 6rem 12rem 1fr auto auto;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
    border-top: 1px solid var(--color-rule);
    align-items: baseline;
    font-family: var(--font-serif-stack);
    font-size: 0.95rem;
  }
  .event:last-child { border-bottom: 1px solid var(--color-rule); }
  .event-date {
    font-family: var(--font-sans-stack);
    font-variant-numeric: tabular-nums lining-nums;
    color: var(--color-ink-3);
    font-size: var(--text-meta);
  }
  .event-pollie { font-weight: 600; color: var(--color-ink); }
  .event-gig { color: var(--color-ink-2); }
  .event-action {
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }
  .action-added { color: var(--color-accent); }
  .action-verified { color: oklch(45% 0.12 145); }
  .action-rejected { color: var(--color-error); }
  .action-sources-edited, .action-dates-edited { color: var(--color-ink-2); }
  .action-removed { color: var(--color-ink-3); }
  .event-by {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-3);
  }
  .event-note {
    grid-column: 2 / -1;
    font-style: italic;
    color: var(--color-ink-3);
    font-size: var(--text-meta);
  }
  @media (width < 50rem) {
    .event {
      grid-template-columns: 1fr auto;
      gap: 0.25rem var(--space-sm);
    }
    .event-date, .event-by, .event-action { font-size: var(--text-meta); }
    .event-gig, .event-note { grid-column: 1 / -1; }
  }
</style>
