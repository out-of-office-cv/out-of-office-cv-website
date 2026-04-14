<script lang="ts">
  import type { GigCategory } from "../types"
  import { GIG_CATEGORIES } from "../types"
  import { validateGigDate, DATE_HINT } from "../utils"
  import type { DraftGig } from "../stores/draft-gigs.svelte"

  interface PollieOption {
    slug: string
    name: string
  }

  interface Props {
    editingGig: DraftGig | null
    lastPollieSlug: string | null
    pollies: PollieOption[]
    onsubmit: (gig: Omit<DraftGig, "id">) => void
    oncancel: () => void
  }

  let { editingGig, lastPollieSlug, pollies, onsubmit, oncancel }: Props = $props()

  let role = $state("")
  let organisation = $state("")
  let category = $state<GigCategory | "">("")
  let sources = $state<string[]>([""])
  let pollieSlug = $state("")
  let startDate = $state("")
  let endDate = $state("")

  let startDateValidation = $derived(startDate ? validateGigDate(startDate) : null)
  let endDateValidation = $derived(endDate ? validateGigDate(endDate) : null)

  let pollieSearch = $state("")
  let pollieComboboxOpen = $state(false)
  let pollieHighlightedIndex = $state(-1)
  let formErrors = $state<Record<string, string>>({})

  let filteredPollies = $derived.by(() => {
    const query = pollieSearch.toLowerCase().trim()
    if (!query) return []
    return pollies
      .filter((p) => p.name.toLowerCase().includes(query) || p.slug.includes(query))
      .slice(0, 10)
  })

  let pollieWarning = $derived.by(() => {
    if (!pollieSlug) return ""
    const exists = pollies.some((p) => p.slug === pollieSlug)
    return exists ? "" : "This slug doesn't match any known politician"
  })

  function validateForm(): boolean {
    formErrors = {}

    if (!role.trim()) formErrors.role = "Role is required"
    if (!organisation.trim()) formErrors.organisation = "Organisation is required"
    if (!category) formErrors.category = "Category is required"
    const validSources = sources.filter((s) => s.trim())
    if (validSources.length === 0) {
      formErrors.sources = "At least one source URL is required"
    } else {
      for (const s of validSources) {
        try {
          new URL(s)
        } catch {
          formErrors.sources = "All sources must be valid URLs"
          break
        }
      }
    }
    if (!pollieSlug.trim()) formErrors.pollieSlug = "Pollie slug is required"
    if (startDate && !validateGigDate(startDate).valid) {
      formErrors.startDate = `Must be ${DATE_HINT}`
    }
    if (endDate && !validateGigDate(endDate).valid) {
      formErrors.endDate = `Must be ${DATE_HINT}`
    }

    return Object.keys(formErrors).length === 0
  }

  function handleSubmit() {
    if (!validateForm()) return

    const validSources = sources.filter((s) => s.trim()).map((s) => s.trim())

    const gig: Omit<DraftGig, "id"> = {
      role: role.trim(),
      organisation: organisation.trim(),
      category: category as GigCategory,
      sources: validSources,
      pollie_slug: pollieSlug.trim(),
    }

    if (startDate) gig.start_date = startDate
    if (endDate) gig.end_date = endDate

    onsubmit(gig)
    clearForm()
  }

  function clearForm() {
    role = ""
    organisation = ""
    category = ""
    sources = [""]
    startDate = ""
    endDate = ""
    formErrors = {}
  }

  function handlePollieSelect(slug: string) {
    pollieSlug = slug
    const pollie = pollies.find((p) => p.slug === slug)
    if (pollie) pollieSearch = pollie.name
    pollieComboboxOpen = false
  }

  function handlePollieInput() {
    pollieComboboxOpen = pollieSearch.trim().length > 0
    pollieHighlightedIndex = -1
    pollieSlug = ""
  }

  function handlePollieKeydown(e: KeyboardEvent) {
    if (!pollieComboboxOpen) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      pollieHighlightedIndex = Math.min(pollieHighlightedIndex + 1, filteredPollies.length - 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      pollieHighlightedIndex = Math.max(pollieHighlightedIndex - 1, 0)
    } else if (e.key === "Enter" && pollieHighlightedIndex >= 0) {
      e.preventDefault()
      handlePollieSelect(filteredPollies[pollieHighlightedIndex].slug)
    } else if (e.key === "Escape") {
      pollieComboboxOpen = false
    }
  }

  $effect(() => {
    if (editingGig) {
      role = editingGig.role
      organisation = editingGig.organisation
      category = editingGig.category
      sources = editingGig.sources.length > 0 ? [...editingGig.sources] : [""]
      pollieSlug = editingGig.pollie_slug
      pollieSearch =
        pollies.find((p) => p.slug === editingGig.pollie_slug)?.name ||
        editingGig.pollie_slug
      startDate = editingGig.start_date || ""
      endDate = editingGig.end_date || ""
    }
  })

  $effect(() => {
    if (lastPollieSlug && !editingGig) {
      pollieSlug = lastPollieSlug
      const pollie = pollies.find((p) => p.slug === lastPollieSlug)
      if (pollie) pollieSearch = pollie.name
    }
  })
</script>

<section class="form-section">
  <h2>{editingGig ? "Edit gig" : "Add a new gig"}</h2>
  <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }}>
    <div class="form-group">
      <label for="pollie-search" class="field-label">Politician <span class="required" aria-hidden="true">·</span></label>
      <div class="autocomplete-wrapper">
        <!-- svelte-ignore a11y_role_supports_aria_props -->
        <input
          id="pollie-search"
          type="text"
          bind:value={pollieSearch}
          oninput={handlePollieInput}
          onkeydown={handlePollieKeydown}
          onfocusin={() => { if (pollieSearch.trim()) pollieComboboxOpen = true }}
          onfocusout={() => { setTimeout(() => pollieComboboxOpen = false, 150) }}
          placeholder="Search by name…"
          autocomplete="off"
          role="combobox"
          aria-expanded={pollieComboboxOpen}
          aria-controls="pollie-autocomplete-listbox"
          aria-autocomplete="list"
          aria-activedescendant={pollieHighlightedIndex >= 0 ? `pollie-ac-option-${pollieHighlightedIndex}` : undefined}
        />
        {#if pollieComboboxOpen && filteredPollies.length > 0}
          <ul id="pollie-autocomplete-listbox" class="autocomplete-content" role="listbox">
            {#each filteredPollies as pollie, i (pollie.slug)}
              <li
                id={`pollie-ac-option-${i}`}
                role="option"
                class="autocomplete-item"
                class:highlighted={i === pollieHighlightedIndex}
                aria-selected={i === pollieHighlightedIndex}
                onmousedown={() => handlePollieSelect(pollie.slug)}
                onmouseenter={() => { pollieHighlightedIndex = i }}
              >
                {pollie.name}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      {#if pollieWarning}
        <p class="warning-text">{pollieWarning}</p>
      {/if}
      {#if formErrors.pollieSlug}
        <p class="error-text">{formErrors.pollieSlug}</p>
      {/if}
    </div>

    <div class="form-grid-two">
      <div class="form-group">
        <label for="role" class="field-label">Role <span class="required" aria-hidden="true">·</span></label>
        <input id="role" bind:value={role} type="text" placeholder="e.g. Non-Executive Director" />
        {#if formErrors.role}
          <p class="error-text">{formErrors.role}</p>
        {/if}
      </div>
      <div class="form-group">
        <label for="organisation" class="field-label">Organisation <span class="required" aria-hidden="true">·</span></label>
        <input id="organisation" bind:value={organisation} type="text" placeholder="e.g. Acme Corp" />
        {#if formErrors.organisation}
          <p class="error-text">{formErrors.organisation}</p>
        {/if}
      </div>
    </div>

    <div class="form-group">
      <label for="category" class="field-label">Category <span class="required" aria-hidden="true">·</span></label>
      <select id="category" bind:value={category}>
        <option value="">Select a category…</option>
        {#each GIG_CATEGORIES as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
      {#if formErrors.category}
        <p class="error-text">{formErrors.category}</p>
      {/if}
    </div>

    <div class="form-grid-two">
      <div class="form-group">
        <label for="start-date" class="field-label">Start date</label>
        <input
          id="start-date"
          bind:value={startDate}
          type="text"
          placeholder={DATE_HINT}
          class:date-invalid={startDateValidation && !startDateValidation.valid}
          class:date-valid={startDateValidation?.valid}
        />
        {#if startDateValidation && !startDateValidation.valid}
          <p class="error-text">Not a valid date — use {DATE_HINT}</p>
        {/if}
        {#if formErrors.startDate}
          <p class="error-text">{formErrors.startDate}</p>
        {/if}
      </div>
      <div class="form-group">
        <label for="end-date" class="field-label">End date</label>
        <input
          id="end-date"
          bind:value={endDate}
          type="text"
          placeholder={DATE_HINT}
          class:date-invalid={endDateValidation && !endDateValidation.valid}
          class:date-valid={endDateValidation?.valid}
        />
        {#if endDateValidation && !endDateValidation.valid}
          <p class="error-text">Not a valid date — use {DATE_HINT}</p>
        {/if}
        {#if formErrors.endDate}
          <p class="error-text">{formErrors.endDate}</p>
        {/if}
      </div>
    </div>

    <div class="form-group">
      <span class="field-label">Source URLs <span class="required" aria-hidden="true">·</span></span>
      <div class="sources-list">
        {#each sources as _, index}
          <div class="source-row">
            <input bind:value={sources[index]} type="url" placeholder="https://…" />
            {#if sources.length > 1}
              <button
                type="button"
                class="btn-icon btn-danger"
                title="Remove source"
                aria-label="Remove source"
                onclick={() => { sources = sources.filter((_, i) => i !== index) }}
              >
                ×
              </button>
            {/if}
          </div>
        {/each}
      </div>
      <button
        type="button"
        class="btn-secondary btn-small add-source-btn"
        onclick={() => { sources = [...sources, ""] }}
      >
        + Add another source
      </button>
      {#if formErrors.sources}
        <p class="error-text">{formErrors.sources}</p>
      {/if}
    </div>

    <div class="form-actions">
      <button type="submit" class="btn-primary">
        {editingGig ? "Update gig" : "Add to drafts"}
      </button>
      {#if editingGig}
        <button type="button" class="btn-secondary" onclick={oncancel}>
          Cancel
        </button>
      {/if}
    </div>
  </form>
</section>

<style>
  .form-section h2 {
    margin: 0 0 var(--space-lg);
  }

  form {
    display: grid;
    gap: var(--space-md);
  }

  .form-grid-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
  }

  @media (width <= 40rem) {
    .form-grid-two {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
  }

  .field-label {
    font-family: var(--font-sans-stack);
    font-size: var(--text-caps);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-3);
  }

  .required {
    color: var(--color-accent);
    font-weight: 700;
    letter-spacing: 0;
  }

  .autocomplete-wrapper {
    position: relative;
  }

  .autocomplete-content {
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
    z-index: 100;
    max-height: 14rem;
    overflow-y: auto;
  }

  .autocomplete-item {
    padding: var(--space-xs) var(--space-md);
    cursor: pointer;
    font-family: var(--font-serif-stack);
    border-bottom: 1px solid var(--color-rule);
  }

  .autocomplete-item:last-child {
    border-bottom: none;
  }

  .autocomplete-item.highlighted {
    background: var(--color-paper-tint);
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

  .add-source-btn {
    justify-self: start;
  }

  .date-invalid {
    border-color: var(--color-error) !important;
  }

  .date-valid {
    border-color: var(--color-success) !important;
  }

  .error-text {
    font-family: var(--font-sans-stack);
    color: var(--color-error);
    font-size: var(--text-meta);
    margin: 0;
  }

  .warning-text {
    font-family: var(--font-sans-stack);
    color: oklch(40% 0.1 75);
    font-size: var(--text-meta);
    margin: 0;
    font-style: italic;
  }

  .form-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }
</style>
