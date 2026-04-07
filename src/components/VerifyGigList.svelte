<script lang="ts">
  import type { Gig } from "../types"
  import { GIG_CATEGORIES } from "../types"
  import type { Snippet } from "svelte"

  interface GigWithIndex extends Gig {
    index: number
  }

  interface PollieOption {
    slug: string
    name: string
  }

  interface Props {
    verifierId: string
    unverifiedGigs: GigWithIndex[]
    pollies: PollieOption[]
    onsubmit: (
      indices: number[],
      verifierId: string,
      edits: Record<number, Partial<Gig>>,
    ) => void
    submitSlot?: Snippet<[{ count: number; onSubmit: () => void }]>
  }

  let { verifierId, unverifiedGigs, pollies, onsubmit, submitSlot }: Props = $props()

  let verifySearch = $state("")
  let selectedIndices = $state(new Set<number>())
  let expandedIndex = $state<number | null>(null)
  let gigEdits = $state<Record<number, Partial<Gig>>>({})

  let filteredGigs = $derived.by(() => {
    const query = verifySearch.toLowerCase().trim()
    if (!query) return unverifiedGigs
    return unverifiedGigs.filter(
      (gig) =>
        gig.role.toLowerCase().includes(query) ||
        gig.organisation.toLowerCase().includes(query) ||
        gig.pollie_slug.toLowerCase().includes(query) ||
        gig.category.toLowerCase().includes(query),
    )
  })

  function getPollieNameBySlug(slug: string): string {
    const pollie = pollies.find((p) => p.slug === slug)
    return pollie?.name || slug
  }

  function getHostname(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  function toggleSelection(index: number) {
    if (selectedIndices.has(index)) {
      selectedIndices.delete(index)
    } else {
      selectedIndices.add(index)
    }
    selectedIndices = new Set(selectedIndices)
  }

  function selectAllVisible() {
    for (const gig of filteredGigs) {
      selectedIndices.add(gig.index)
    }
    selectedIndices = new Set(selectedIndices)
  }

  function clearSelection() {
    selectedIndices = new Set()
    gigEdits = {}
  }

  function toggleExpand(index: number) {
    expandedIndex = expandedIndex === index ? null : index
  }

  function getFieldValue(gig: GigWithIndex, field: keyof Gig): string {
    const edits = gigEdits[gig.index]
    if (edits && field in edits) {
      return (edits[field] as string) ?? ""
    }
    return (gig[field] as string) ?? ""
  }

  function getSourcesValue(gig: GigWithIndex): string[] {
    const edits = gigEdits[gig.index]
    if (edits && "sources" in edits) {
      return edits.sources!
    }
    return gig.sources
  }

  function isFieldModified(index: number, field: keyof Gig): boolean {
    const edits = gigEdits[index]
    return edits !== undefined && field in edits
  }

  function hasAnyEdits(index: number): boolean {
    const edits = gigEdits[index]
    return edits !== undefined && Object.keys(edits).length > 0
  }

  function setEditField(index: number, field: string, value: unknown) {
    gigEdits = { ...gigEdits, [index]: { ...gigEdits[index], [field]: value } }
  }

  function removeEditField(index: number, field: string) {
    const edits = gigEdits[index]
    if (!edits) return
    const updated = { ...edits }
    delete (updated as Record<string, unknown>)[field]
    const newEdits = { ...gigEdits }
    if (Object.keys(updated).length === 0) {
      delete newEdits[index]
    } else {
      newEdits[index] = updated as Partial<Gig>
    }
    gigEdits = newEdits
  }

  function updateStringField(
    index: number,
    field: "role" | "organisation" | "start_date" | "end_date",
    value: string,
    original: string | undefined,
  ) {
    const isDateField = field === "start_date" || field === "end_date"
    const normValue = isDateField ? value || undefined : value
    const normOriginal = isDateField ? original || undefined : (original ?? "")
    if (normValue === normOriginal) {
      removeEditField(index, field)
    } else {
      setEditField(index, field, normValue)
    }
  }

  function updateCategory(index: number, value: string, original: string) {
    if (value === original) {
      removeEditField(index, "category")
    } else {
      setEditField(index, "category", value)
    }
  }

  function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    return a.every((val, i) => val === b[i])
  }

  function updateSource(gig: GigWithIndex, sourceIndex: number, value: string) {
    const currentSources = [...getSourcesValue(gig)]
    currentSources[sourceIndex] = value
    if (arraysEqual(currentSources, gig.sources)) {
      removeEditField(gig.index, "sources")
    } else {
      setEditField(gig.index, "sources", currentSources)
    }
  }

  function addSource(gig: GigWithIndex) {
    const currentSources = [...getSourcesValue(gig), ""]
    setEditField(gig.index, "sources", currentSources)
  }

  function removeSource(gig: GigWithIndex, sourceIndex: number) {
    const currentSources = getSourcesValue(gig).filter((_, i) => i !== sourceIndex)
    if (arraysEqual(currentSources, gig.sources)) {
      removeEditField(gig.index, "sources")
    } else {
      setEditField(gig.index, "sources", currentSources)
    }
  }

  function revertField(index: number, field: keyof Gig) {
    removeEditField(index, field)
  }

  function handleSubmit() {
    onsubmit(Array.from(selectedIndices), verifierId, gigEdits)
  }

  export { clearSelection }
</script>

<div class="verify-section">
  <p class="verify-intro">
    Select gigs you've verified are accurate, then submit a PR to mark
    them as verified by <strong>{verifierId}</strong>.
    Expand a gig to edit its details before verifying.
  </p>

  <div class="verify-controls">
    <input
      bind:value={verifySearch}
      type="text"
      placeholder="Filter by role, organisation, politician..."
      class="verify-search"
    />
    <div class="verify-bulk-actions">
      <button type="button" class="btn-secondary btn-small" onclick={selectAllVisible}>
        Select all visible
      </button>
      <button
        type="button"
        class="btn-secondary btn-small"
        disabled={selectedIndices.size === 0}
        onclick={clearSelection}
      >
        Clear selection
      </button>
    </div>
  </div>

  {#if filteredGigs.length === 0}
    <div class="empty-state">
      {#if verifySearch}
        <p>No unverified gigs match your search.</p>
      {:else}
        <p>All gigs have been verified!</p>
      {/if}
    </div>
  {:else}
    <ul class="verify-list">
      {#each filteredGigs as gig (gig.index)}
        <li
          class="verify-item"
          class:selected={selectedIndices.has(gig.index)}
          class:expanded={expandedIndex === gig.index}
        >
          <div class="verify-item-header">
            <label class="verify-checkbox-label">
              <input
                type="checkbox"
                checked={selectedIndices.has(gig.index)}
                onchange={() => toggleSelection(gig.index)}
              />
              <span class="verify-item-summary">
                <strong>{getFieldValue(gig, "role")}</strong>
                at {getFieldValue(gig, "organisation")}
                <span class="verify-item-pollie">
                  {getPollieNameBySlug(gig.pollie_slug)}
                  {#if hasAnyEdits(gig.index)}
                    <span class="edited-badge">edited</span>
                  {/if}
                </span>
              </span>
            </label>
            <button
              type="button"
              class="btn-icon btn-expand"
              title={expandedIndex === gig.index ? "Collapse" : "Expand"}
              onclick={() => toggleExpand(gig.index)}
            >
              {expandedIndex === gig.index ? "▲" : "▼"}
            </button>
          </div>
          {#if expandedIndex === gig.index}
            <div class="verify-item-details">
              <div class="verify-edit-fields">
                <div class="edit-field-row">
                  <div class="edit-field" class:field-modified={isFieldModified(gig.index, "role")}>
                    <div class="edit-field-header">
                      <label>Role</label>
                      {#if isFieldModified(gig.index, "role")}
                        <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "role")}>↩</button>
                      {/if}
                    </div>
                    <input
                      type="text"
                      value={getFieldValue(gig, "role")}
                      oninput={(e) => updateStringField(gig.index, "role", e.currentTarget.value, gig.role)}
                    />
                    {#if isFieldModified(gig.index, "role")}
                      <span class="was-text">was: {gig.role}</span>
                    {/if}
                  </div>
                  <div class="edit-field" class:field-modified={isFieldModified(gig.index, "organisation")}>
                    <div class="edit-field-header">
                      <label>Organisation</label>
                      {#if isFieldModified(gig.index, "organisation")}
                        <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "organisation")}>↩</button>
                      {/if}
                    </div>
                    <input
                      type="text"
                      value={getFieldValue(gig, "organisation")}
                      oninput={(e) => updateStringField(gig.index, "organisation", e.currentTarget.value, gig.organisation)}
                    />
                    {#if isFieldModified(gig.index, "organisation")}
                      <span class="was-text">was: {gig.organisation}</span>
                    {/if}
                  </div>
                </div>

                <div class="edit-field" class:field-modified={isFieldModified(gig.index, "category")}>
                  <div class="edit-field-header">
                    <label>Category</label>
                    {#if isFieldModified(gig.index, "category")}
                      <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "category")}>↩</button>
                    {/if}
                  </div>
                  <select
                    value={getFieldValue(gig, "category")}
                    onchange={(e) => updateCategory(gig.index, e.currentTarget.value, gig.category)}
                  >
                    {#each GIG_CATEGORIES as cat}
                      <option value={cat}>{cat}</option>
                    {/each}
                  </select>
                  {#if isFieldModified(gig.index, "category")}
                    <span class="was-text">was: {gig.category}</span>
                  {/if}
                </div>

                <div class="edit-field-row">
                  <div class="edit-field" class:field-modified={isFieldModified(gig.index, "start_date")}>
                    <div class="edit-field-header">
                      <label>Start date</label>
                      {#if isFieldModified(gig.index, "start_date")}
                        <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "start_date")}>↩</button>
                      {/if}
                    </div>
                    <input
                      type="date"
                      value={getFieldValue(gig, "start_date")}
                      oninput={(e) => updateStringField(gig.index, "start_date", e.currentTarget.value, gig.start_date)}
                    />
                    {#if isFieldModified(gig.index, "start_date")}
                      <span class="was-text">was: {gig.start_date || "none"}</span>
                    {/if}
                  </div>
                  <div class="edit-field" class:field-modified={isFieldModified(gig.index, "end_date")}>
                    <div class="edit-field-header">
                      <label>End date</label>
                      {#if isFieldModified(gig.index, "end_date")}
                        <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "end_date")}>↩</button>
                      {/if}
                    </div>
                    <input
                      type="date"
                      value={getFieldValue(gig, "end_date")}
                      oninput={(e) => updateStringField(gig.index, "end_date", e.currentTarget.value, gig.end_date)}
                    />
                    {#if isFieldModified(gig.index, "end_date")}
                      <span class="was-text">was: {gig.end_date || "none"}</span>
                    {/if}
                  </div>
                </div>

                <div class="edit-field" class:field-modified={isFieldModified(gig.index, "sources")}>
                  <div class="edit-field-header">
                    <label>Sources</label>
                    {#if isFieldModified(gig.index, "sources")}
                      <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "sources")}>↩</button>
                    {/if}
                  </div>
                  <div class="sources-list">
                    {#each getSourcesValue(gig) as src, i}
                      <div class="source-row">
                        <input
                          type="url"
                          value={src}
                          placeholder="https://..."
                          oninput={(e) => updateSource(gig, i, e.currentTarget.value)}
                        />
                        {#if getSourcesValue(gig).length > 1}
                          <button
                            type="button"
                            class="btn-icon btn-danger"
                            title="Remove source"
                            onclick={() => removeSource(gig, i)}
                          >
                            &times;
                          </button>
                        {/if}
                      </div>
                    {/each}
                  </div>
                  <button type="button" class="btn-secondary btn-small" onclick={() => addSource(gig)}>
                    + Add source
                  </button>
                  {#if isFieldModified(gig.index, "sources")}
                    <span class="was-text">was: {gig.sources.map((s) => getHostname(s)).join(", ")}</span>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if selectedIndices.size > 0}
    <div class="verify-submit-section">
      {#if submitSlot}
        {@render submitSlot({ count: selectedIndices.size, onSubmit: handleSubmit })}
      {:else}
        <button type="button" class="btn-primary btn-large" onclick={handleSubmit}>
          Verify {selectedIndices.size} gig(s) as {verifierId}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .verify-section {
    margin-top: 0;
  }

  .verify-intro {
    margin-bottom: 1rem;
    color: var(--color-text-2);
  }

  .verify-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .verify-search {
    flex: 1;
    min-width: 200px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-1);
    font-size: 1rem;
  }

  .verify-search:focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .verify-bulk-actions {
    display: flex;
    gap: 0.5rem;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-2);
  }

  .verify-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 400px;
    overflow-y: auto;
  }

  .verify-item {
    background: var(--color-bg);
    border-radius: 4px;
    margin-bottom: 0.5rem;
    border: 2px solid transparent;
    transition: border-color 0.2s;
  }

  .verify-item.selected {
    border-color: var(--color-brand-1);
  }

  .verify-item-header {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .verify-checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
    cursor: pointer;
  }

  .verify-checkbox-label input[type="checkbox"] {
    margin-top: 0.25rem;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .verify-item-summary {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .verify-item-pollie {
    font-size: 0.875rem;
    color: var(--color-text-2);
  }

  .edited-badge {
    display: inline-block;
    font-size: 0.75rem;
    padding: 0.0625rem 0.375rem;
    background: var(--color-brand-soft);
    color: var(--color-brand-1);
    border-radius: 3px;
    margin-left: 0.5rem;
    font-weight: 500;
  }

  .verify-item-details {
    padding: 0 0.75rem 0.75rem 2.75rem;
    border-top: 1px solid var(--color-border);
    margin-top: 0.5rem;
    padding-top: 0.75rem;
  }

  .verify-edit-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .edit-field {
    display: flex;
    flex-direction: column;
    padding-left: 0.5rem;
    border-left: 3px solid transparent;
    transition: border-color 0.2s;
  }

  .edit-field.field-modified {
    border-left-color: var(--color-brand-1);
  }

  .edit-field-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .edit-field-header label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--color-text-2);
  }

  .edit-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  @media (width <= 600px) {
    .edit-field-row {
      grid-template-columns: 1fr;
    }
  }

  .edit-field input,
  .edit-field select {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-1);
    font-size: 0.875rem;
  }

  .edit-field input:focus,
  .edit-field select:focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .btn-revert {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--color-brand-1);
    padding: 0 0.25rem;
    line-height: 1;
  }

  .btn-revert:hover {
    color: var(--color-brand-2);
  }

  .was-text {
    font-size: 0.75rem;
    color: var(--color-text-3);
    margin-top: 0.125rem;
    font-style: italic;
  }

  .sources-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 0.375rem;
  }

  .source-row {
    display: flex;
    gap: 0.375rem;
    align-items: center;
  }

  .source-row input {
    flex: 1;
  }

  .verify-submit-section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .btn-expand {
    font-size: 0.75rem;
  }
</style>
