<script lang="ts">
  import { Combobox } from "bits-ui"
  import type { GigCategory } from "../types"
  import { GIG_CATEGORIES } from "../types"
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

  let pollieSearch = $state("")
  let pollieComboboxOpen = $state(false)
  let touchedSinceOpen = $state(false)
  let formErrors = $state<Record<string, string>>({})

  let filteredPollies = $derived.by(() => {
    const query = pollieSearch.toLowerCase().trim()
    if (!query) return pollies.slice(0, 10)
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
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      formErrors.startDate = "Must be YYYY-MM-DD format"
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      formErrors.endDate = "Must be YYYY-MM-DD format"
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

  function handlePollieSelect(slug: string | undefined) {
    if (!slug) return
    pollieSlug = slug
    const pollie = pollies.find((p) => p.slug === slug)
    if (pollie) pollieSearch = pollie.name
    pollieComboboxOpen = false
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
    <div class="form-row">
      <div class="form-group">
        <label for="pollie-search">Politician</label>
        <Combobox.Root
          type="single"
          onValueChange={handlePollieSelect}
          bind:inputValue={pollieSearch}
          bind:open={pollieComboboxOpen}
          bind:touchedSinceOpen
        >
          <Combobox.Input
            id="pollie-search"
            placeholder="Search by name..."
            autocomplete="off"
            class="form-input"
          />
          {#if filteredPollies.length > 0}
            <Combobox.Content class="autocomplete-content" sameWidth>
              {#each filteredPollies as pollie (pollie.slug)}
                <Combobox.Item value={pollie.slug} label={pollie.name} class="autocomplete-item">
                  {pollie.name}
                </Combobox.Item>
              {/each}
            </Combobox.Content>
          {/if}
        </Combobox.Root>
        {#if pollieWarning}
          <p class="warning-text">{pollieWarning}</p>
        {/if}
        {#if formErrors.pollieSlug}
          <p class="error-text">{formErrors.pollieSlug}</p>
        {/if}
      </div>
    </div>

    <div class="form-row two-col">
      <div class="form-group">
        <label for="role">Role <span class="required">*</span></label>
        <input id="role" bind:value={role} type="text" placeholder="e.g. Non-Executive Director" />
        {#if formErrors.role}
          <p class="error-text">{formErrors.role}</p>
        {/if}
      </div>
      <div class="form-group">
        <label for="organisation">Organisation <span class="required">*</span></label>
        <input id="organisation" bind:value={organisation} type="text" placeholder="e.g. Acme Corp" />
        {#if formErrors.organisation}
          <p class="error-text">{formErrors.organisation}</p>
        {/if}
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="category">Category <span class="required">*</span></label>
        <select id="category" bind:value={category}>
          <option value="">Select a category...</option>
          {#each GIG_CATEGORIES as cat}
            <option value={cat}>{cat}</option>
          {/each}
        </select>
        {#if formErrors.category}
          <p class="error-text">{formErrors.category}</p>
        {/if}
      </div>
    </div>

    <div class="form-row two-col">
      <div class="form-group">
        <label for="start-date">Start date</label>
        <input id="start-date" bind:value={startDate} type="date" />
        {#if formErrors.startDate}
          <p class="error-text">{formErrors.startDate}</p>
        {/if}
      </div>
      <div class="form-group">
        <label for="end-date">End date</label>
        <input id="end-date" bind:value={endDate} type="date" />
        {#if formErrors.endDate}
          <p class="error-text">{formErrors.endDate}</p>
        {/if}
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Source URLs <span class="required">*</span></label>
        <div class="sources-list">
          {#each sources as _, index}
            <div class="source-row">
              <input bind:value={sources[index]} type="url" placeholder="https://..." />
              {#if sources.length > 1}
                <button
                  type="button"
                  class="btn-icon btn-danger"
                  title="Remove source"
                  onclick={() => { sources = sources.filter((_, i) => i !== index) }}
                >
                  &times;
                </button>
              {/if}
            </div>
          {/each}
        </div>
        <button
          type="button"
          class="btn-secondary btn-small"
          onclick={() => { sources = [...sources, ""] }}
        >
          + Add another source
        </button>
        {#if formErrors.sources}
          <p class="error-text">{formErrors.sources}</p>
        {/if}
      </div>
    </div>

    <div class="form-actions">
      <button type="submit" class="btn-primary">
        {editingGig ? "Update gig" : "Add to draft"}
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
  .form-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--color-bg-soft);
    border-radius: 8px;
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
  }

  .form-row {
    margin-bottom: 1rem;
  }

  .form-row.two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (width <= 600px) {
    .form-row.two-col {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group label {
    font-weight: 500;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }

  .required {
    color: var(--color-red-1);
  }

  .form-group input,
  .form-group select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-1);
    font-size: 1rem;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .form-group :global(.form-input) {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-1);
    font-size: 1rem;
    width: 100%;
  }

  .form-group :global(.form-input):focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .form-group :global(.autocomplete-content) {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
  }

  .form-group :global(.autocomplete-item) {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
  }

  .form-group :global(.autocomplete-item[data-highlighted]) {
    background: var(--color-bg-soft);
  }

  .sources-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .source-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .source-row input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-1);
    font-size: 1rem;
  }

  .source-row input:focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .error-text {
    color: var(--color-red-1);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }

  .warning-text {
    color: var(--color-yellow-1);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
</style>
