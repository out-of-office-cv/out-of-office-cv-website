<script lang="ts">
  import type { Gig } from "../types"
  import { GIG_CATEGORIES } from "../types"
  import { validateGigDate, DATE_HINT, sortGigsForVerification } from "../utils"
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

  let sortedGigs = $derived(sortGigsForVerification(unverifiedGigs))

  let filteredGigs = $derived.by(() => {
    const query = verifySearch.toLowerCase().trim()
    if (!query) return sortedGigs
    return sortedGigs.filter(
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
      return new URL(url).hostname.replace(/^www\./, "")
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

  function getDateValidation(gig: GigWithIndex, field: "start_date" | "end_date") {
    const val = getFieldValue(gig, field)
    return val ? validateGigDate(val) : null
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
    Select gigs you've confirmed are accurate, then open a pull request to
    mark them as verified by <strong>{verifierId}</strong>. Expand a gig to
    edit its details before verifying.
  </p>

  <div class="verify-controls">
    <label for="verify-filter" class="visually-hidden">Filter gigs</label>
    <input
      id="verify-filter"
      bind:value={verifySearch}
      type="text"
      placeholder="Filter by role, organisation, politician…"
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
    <p class="empty-state">
      {#if verifySearch}
        <em>No unverified gigs match your filter.</em>
      {:else}
        <em>All gigs have been verified.</em>
      {/if}
    </p>
  {:else}
    <ol class="verify-list">
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
                <span class="verify-headline">
                  <span class="verify-role">{getFieldValue(gig, "role")}</span>
                  <span class="verify-at">at</span>
                  <span class="verify-org">{getFieldValue(gig, "organisation")}</span>
                  {#if hasAnyEdits(gig.index)}
                    <span class="edited-tag">· edited</span>
                  {/if}
                </span>
                <span class="verify-item-pollie">
                  {getPollieNameBySlug(gig.pollie_slug)}
                </span>
              </span>
            </label>
            <button
              type="button"
              class="btn-icon btn-expand"
              title={expandedIndex === gig.index ? "Collapse" : "Expand"}
              aria-label={expandedIndex === gig.index ? "Collapse" : "Expand"}
              aria-expanded={expandedIndex === gig.index}
              onclick={() => toggleExpand(gig.index)}
            >
              {expandedIndex === gig.index ? "▲" : "▼"}
            </button>
          </div>
          {#if expandedIndex === gig.index}
            <div class="verify-item-details">
              <div class="edit-fields">
                <div class="edit-field-row">
                  <div class="edit-field" class:field-modified={isFieldModified(gig.index, "role")}>
                    <div class="edit-field-header">
                      <label class="field-label" for={`role-${gig.index}`}>Role</label>
                      {#if isFieldModified(gig.index, "role")}
                        <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "role")}>↩ revert</button>
                      {/if}
                    </div>
                    <input
                      id={`role-${gig.index}`}
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
                      <label class="field-label" for={`org-${gig.index}`}>Organisation</label>
                      {#if isFieldModified(gig.index, "organisation")}
                        <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "organisation")}>↩ revert</button>
                      {/if}
                    </div>
                    <input
                      id={`org-${gig.index}`}
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
                    <label class="field-label" for={`cat-${gig.index}`}>Category</label>
                    {#if isFieldModified(gig.index, "category")}
                      <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "category")}>↩ revert</button>
                    {/if}
                  </div>
                  <select
                    id={`cat-${gig.index}`}
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
                      <label class="field-label" for={`sd-${gig.index}`}>Start date</label>
                      {#if isFieldModified(gig.index, "start_date")}
                        <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "start_date")}>↩ revert</button>
                      {/if}
                    </div>
                    <input
                      id={`sd-${gig.index}`}
                      type="text"
                      value={getFieldValue(gig, "start_date")}
                      placeholder={DATE_HINT}
                      class:date-invalid={getDateValidation(gig, "start_date") && !getDateValidation(gig, "start_date")?.valid}
                      class:date-valid={getDateValidation(gig, "start_date")?.valid}
                      oninput={(e) => updateStringField(gig.index, "start_date", e.currentTarget.value, gig.start_date)}
                    />
                    {#if getDateValidation(gig, "start_date") && !getDateValidation(gig, "start_date")?.valid}
                      <span class="date-error">Not a valid date — use {DATE_HINT}</span>
                    {/if}
                    {#if isFieldModified(gig.index, "start_date")}
                      <span class="was-text">was: {gig.start_date || "none"}</span>
                    {/if}
                  </div>
                  <div class="edit-field" class:field-modified={isFieldModified(gig.index, "end_date")}>
                    <div class="edit-field-header">
                      <label class="field-label" for={`ed-${gig.index}`}>End date</label>
                      {#if isFieldModified(gig.index, "end_date")}
                        <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "end_date")}>↩ revert</button>
                      {/if}
                    </div>
                    <input
                      id={`ed-${gig.index}`}
                      type="text"
                      value={getFieldValue(gig, "end_date")}
                      placeholder={DATE_HINT}
                      class:date-invalid={getDateValidation(gig, "end_date") && !getDateValidation(gig, "end_date")?.valid}
                      class:date-valid={getDateValidation(gig, "end_date")?.valid}
                      oninput={(e) => updateStringField(gig.index, "end_date", e.currentTarget.value, gig.end_date)}
                    />
                    {#if getDateValidation(gig, "end_date") && !getDateValidation(gig, "end_date")?.valid}
                      <span class="date-error">Not a valid date — use {DATE_HINT}</span>
                    {/if}
                    {#if isFieldModified(gig.index, "end_date")}
                      <span class="was-text">was: {gig.end_date || "none"}</span>
                    {/if}
                  </div>
                </div>

                <div class="edit-field" class:field-modified={isFieldModified(gig.index, "sources")}>
                  <div class="edit-field-header">
                    <span class="field-label">Sources</span>
                    {#if isFieldModified(gig.index, "sources")}
                      <button type="button" class="btn-revert" title="Revert" onclick={() => revertField(gig.index, "sources")}>↩ revert</button>
                    {/if}
                  </div>
                  <div class="sources-list">
                    {#each getSourcesValue(gig) as src, i}
                      <div class="source-row">
                        <input
                          type="url"
                          value={src}
                          placeholder="https://…"
                          oninput={(e) => updateSource(gig, i, e.currentTarget.value)}
                        />
                        {#if getSourcesValue(gig).length > 1}
                          <button
                            type="button"
                            class="btn-icon btn-danger"
                            title="Remove source"
                            aria-label="Remove source"
                            onclick={() => removeSource(gig, i)}
                          >
                            ×
                          </button>
                        {/if}
                      </div>
                    {/each}
                  </div>
                  <button type="button" class="btn-secondary btn-small add-src-btn" onclick={() => addSource(gig)}>
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
    </ol>
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
    font-family: var(--font-serif-stack);
    color: var(--color-ink-2);
    max-width: var(--measure-reading);
    margin: 0 0 var(--space-lg);
  }

  .verify-intro strong {
    color: var(--color-ink);
  }

  .verify-controls {
    display: flex;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
    align-items: center;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--color-rule);
  }

  .verify-search {
    flex: 1;
    min-width: 14rem;
    font-family: var(--font-serif-stack);
    font-style: italic;
    font-size: 1rem;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-rule);
    border-radius: 0;
    padding: var(--space-xs) 0;
  }

  .verify-search:focus {
    outline: none;
    border-bottom-color: var(--color-accent);
    box-shadow: 0 1px 0 0 var(--color-accent);
  }

  .verify-bulk-actions {
    display: flex;
    gap: var(--space-xs);
  }

  .empty-state {
    font-family: var(--font-serif-stack);
    color: var(--color-ink-2);
    padding: var(--space-xl) 0;
    max-width: var(--measure-reading);
  }

  .verify-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 32rem;
    overflow-y: auto;
  }

  .verify-item {
    border-top: 1px solid var(--color-rule);
    transition: background var(--dur-fast) var(--ease-out);
  }

  .verify-item:last-child {
    border-bottom: 1px solid var(--color-rule);
  }

  .verify-item.selected {
    background: var(--color-accent-soft);
  }

  .verify-item-header {
    display: flex;
    align-items: flex-start;
    padding: var(--space-md) var(--space-xs);
    gap: var(--space-sm);
  }

  .verify-checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    flex: 1;
    cursor: pointer;
    min-width: 0;
  }

  .verify-checkbox-label input[type="checkbox"] {
    margin-top: 0.3rem;
    width: 1.05rem;
    height: 1.05rem;
    cursor: pointer;
    accent-color: var(--color-accent);
    flex-shrink: 0;
  }

  .verify-item-summary {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
  }

  .verify-headline {
    font-family: var(--font-serif-stack);
    font-size: 1rem;
    color: var(--color-ink);
    text-wrap: pretty;
    line-height: 1.4;
  }

  .verify-role {
    font-weight: 600;
  }

  .verify-at {
    color: var(--color-ink-3);
    font-style: italic;
    margin: 0 0.2em;
    font-size: 0.95em;
  }

  .verify-item-pollie {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-3);
  }

  .edited-tag {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    font-style: italic;
    color: var(--color-accent);
    font-weight: 500;
    margin-left: 0.3rem;
    letter-spacing: 0;
  }

  .verify-item-details {
    padding: 0 var(--space-xs) var(--space-md) calc(var(--space-sm) + 1.9rem);
    border-top: 1px dashed var(--color-rule);
    margin-top: 0;
    padding-top: var(--space-md);
  }

  .edit-fields {
    display: grid;
    gap: var(--space-md);
  }

  /* Modified-field treatment: background tint + status label, no side stripe */
  .edit-field {
    display: grid;
    gap: 0.25rem;
    padding: var(--space-xs) var(--space-sm);
    background: transparent;
    border-radius: var(--radius-sm);
    transition: background var(--dur-fast) var(--ease-out);
  }

  .edit-field.field-modified {
    background: var(--color-accent-soft);
  }

  .edit-field-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }

  .field-label {
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-3);
  }

  .edit-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-sm);
  }

  @media (width <= 40rem) {
    .edit-field-row {
      grid-template-columns: 1fr;
    }
  }

  .btn-revert {
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-accent);
    padding: 0;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
  }

  .btn-revert:hover {
    color: var(--color-accent-hover);
    text-decoration: underline;
  }

  .was-text {
    font-family: var(--font-serif-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-3);
    font-style: italic;
    margin-top: 0.15rem;
  }

  .sources-list {
    display: grid;
    gap: var(--space-xs);
    margin-bottom: var(--space-xs);
  }

  .source-row {
    display: flex;
    gap: var(--space-xs);
    align-items: center;
  }

  .source-row input {
    flex: 1;
  }

  .add-src-btn {
    justify-self: start;
  }

  .verify-submit-section {
    margin-top: var(--space-lg);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-rule);
  }

  .date-invalid {
    border-color: var(--color-error) !important;
  }

  .date-valid {
    border-color: var(--color-success) !important;
  }

  .date-error {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-error);
    margin-top: 0.1rem;
  }

  .btn-expand {
    flex-shrink: 0;
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
</style>
