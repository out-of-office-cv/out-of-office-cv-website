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
  <section class="drafts-section" aria-labelledby="drafts-heading">
    <header class="drafts-header">
      <h2 id="drafts-heading">Draft gigs</h2>
      <span class="drafts-count caps">{drafts.length} queued</span>
    </header>
    <ol class="draft-list">
      {#each drafts as gig (gig.id)}
        <li class="draft-item">
          <div class="draft-body">
            <span class="draft-headline">
              <span class="draft-role">{gig.role}</span>
              <span class="draft-at">at</span>
              <span class="draft-org">{gig.organisation}</span>
            </span>
            <span class="draft-meta">
              <span class="draft-slug">{gig.pollie_slug}</span>
              <span class="draft-sep" aria-hidden="true">·</span>
              <span>{gig.category}</span>
            </span>
          </div>
          <div class="draft-actions">
            <button
              type="button"
              class="btn-icon"
              title="Edit draft"
              aria-label="Edit draft"
              onclick={() => onedit(gig)}
            >
              ✎
            </button>
            <button
              type="button"
              class="btn-icon btn-danger"
              title="Delete draft"
              aria-label="Delete draft"
              onclick={() => ondelete(gig.id)}
            >
              ×
            </button>
          </div>
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .drafts-section {
    margin-top: var(--space-2xl);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-rule);
  }

  .drafts-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  h2 {
    margin: 0;
  }

  .drafts-count {
    color: var(--color-ink-3);
    font-variant-numeric: tabular-nums lining-nums;
  }

  .draft-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .draft-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md) 0;
    border-top: 1px solid var(--color-rule);
  }

  .draft-item:last-child {
    border-bottom: 1px solid var(--color-rule);
  }

  .draft-body {
    min-width: 0;
    display: grid;
    gap: 0.15rem;
  }

  .draft-headline {
    font-family: var(--font-serif-stack);
    font-size: 1.05rem;
    color: var(--color-ink);
    text-wrap: pretty;
  }

  .draft-role {
    font-weight: 600;
  }

  .draft-at {
    color: var(--color-ink-3);
    font-style: italic;
    margin: 0 0.2em;
    font-size: 0.95em;
  }

  .draft-meta {
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-3);
  }

  .draft-slug {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.85em;
    color: var(--color-ink-2);
  }

  .draft-sep {
    margin: 0 var(--space-xs);
  }

  .draft-actions {
    display: flex;
    gap: var(--space-2xs);
    flex-shrink: 0;
  }
</style>
