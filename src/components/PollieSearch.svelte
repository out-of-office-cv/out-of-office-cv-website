<script lang="ts">
  import { Combobox } from "bits-ui"

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
  let touchedSinceOpen = $state(false)

  let filtered = $derived.by(() => {
    const query = inputValue.toLowerCase().trim()
    if (!query) return pollies.slice(0, 20)
    return pollies
      .filter((p) => p.name.toLowerCase().includes(query) || p.slug.includes(query))
      .slice(0, 20)
  })

  function handleSelect(slug: string | undefined) {
    if (slug) {
      window.location.href = `/pollies/${slug}`
    }
  }
</script>

<div class="pollie-search-wrapper">
  <Combobox.Root
    type="single"
    onValueChange={handleSelect}
    bind:inputValue
    bind:open
    bind:touchedSinceOpen
  >
    <div class="input-wrapper">
      <Combobox.Input
        placeholder="Search by name..."
        class="pollie-search-input"
      />
    </div>
    <Combobox.Content class="pollie-search-content" sameWidth>
      {#each filtered as pollie (pollie.slug)}
        <Combobox.Item value={pollie.slug} label={pollie.name} class="pollie-search-item">
          {pollie.name}
        </Combobox.Item>
      {:else}
        <div class="no-results">No politicians found</div>
      {/each}
    </Combobox.Content>
  </Combobox.Root>
</div>

<style>
  .pollie-search-wrapper {
    margin-bottom: 1.5rem;
  }

  .pollie-search-wrapper :global(.pollie-search-input) {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
    color: var(--color-text-1);
  }

  .pollie-search-wrapper :global(.pollie-search-input):focus {
    outline: none;
    border-color: var(--color-brand-1);
  }

  .pollie-search-wrapper :global(.pollie-search-input)::placeholder {
    color: var(--color-text-3);
  }

  .pollie-search-wrapper :global(.pollie-search-content) {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    margin-top: 4px;
  }

  .pollie-search-wrapper :global(.pollie-search-item) {
    padding: 0.75rem 1rem;
    cursor: pointer;
  }

  .pollie-search-wrapper :global(.pollie-search-item[data-highlighted]) {
    background: var(--color-bg-soft);
  }

  .no-results {
    padding: 0.75rem 1rem;
    color: var(--color-text-3);
  }
</style>
