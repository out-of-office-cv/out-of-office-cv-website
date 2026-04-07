<script lang="ts">
  import type { DraftGig } from "../stores/draft-gigs.svelte"

  interface Props {
    drafts: DraftGig[]
    onedit: (gig: DraftGig) => void
    ondelete: (id: string) => void
  }

  let { drafts, onedit, ondelete }: Props = $props()
</script>

{#if drafts.length > 0}
  <section class="drafts-section">
    <h2>Draft gigs ({drafts.length})</h2>
    <ul class="draft-list">
      {#each drafts as gig (gig.id)}
        <li class="draft-item">
          <div class="draft-content">
            <strong>{gig.role}</strong> at {gig.organisation}
            <span class="draft-meta">{gig.pollie_slug} &middot; {gig.category}</span>
          </div>
          <div class="draft-actions">
            <button
              type="button"
              class="btn-icon"
              title="Edit"
              onclick={() => onedit(gig)}
            >
              &#x270E;
            </button>
            <button
              type="button"
              class="btn-icon btn-danger"
              title="Delete"
              onclick={() => ondelete(gig.id)}
            >
              &times;
            </button>
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .drafts-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--color-bg-soft);
    border-radius: 8px;
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
  }

  .draft-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .draft-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.75rem;
    background: var(--color-bg);
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .draft-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .draft-meta {
    font-size: 0.875rem;
    color: var(--color-text-2);
  }

  .draft-actions {
    display: flex;
    gap: 0.25rem;
  }
</style>
