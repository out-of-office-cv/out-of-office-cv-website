<script lang="ts">
  import type { PrStatus } from "../stores/pull-request.svelte"

  interface Props {
    status: PrStatus
    prNumber: number | null
    prUrl: string
    prError: string
    actionLabel: string
    onreset: () => void
  }

  let { status, prNumber, prUrl, prError, actionLabel, onreset }: Props = $props()
</script>

{#if status === "creating"}
  <div class="pr-status">
    <span class="spinner"></span> Creating pull request...
  </div>
{:else if status === "created"}
  <div class="pr-status">
    <p>
      <a href={prUrl} target="_blank" rel="noopener">PR #{prNumber}</a>
      created! Waiting for merge...
    </p>
    <span class="spinner"></span>
  </div>
{:else if status === "merged"}
  <div class="pr-status success">
    <p>
      <a href={prUrl} target="_blank" rel="noopener">PR #{prNumber}</a>
      merged!
    </p>
    <button type="button" class="btn-secondary" onclick={onreset}>
      {actionLabel}
    </button>
  </div>
{:else if status === "error"}
  <div class="pr-status error">
    <p class="error-text">{prError}</p>
    <button type="button" class="btn-secondary" onclick={onreset}>
      Try again
    </button>
  </div>
{/if}

<style>
  .pr-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .pr-status.success {
    color: var(--color-green-1);
  }

  .pr-status.error {
    flex-direction: column;
    align-items: flex-start;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-brand-1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-text {
    color: var(--color-red-1);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }
</style>
