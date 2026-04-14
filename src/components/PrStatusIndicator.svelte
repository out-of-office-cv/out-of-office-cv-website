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
  <div class="pr-status" role="status">
    <span class="dots" aria-hidden="true">
      <span></span><span></span><span></span>
    </span>
    <span>Opening pull request…</span>
  </div>
{:else if status === "created"}
  <div class="pr-status" role="status">
    <span class="dots" aria-hidden="true">
      <span></span><span></span><span></span>
    </span>
    <p class="pr-line">
      <a href={prUrl} target="_blank" rel="noopener">PR #{prNumber}</a>
      opened — waiting for merge…
    </p>
  </div>
{:else if status === "merged"}
  <div class="pr-status success" role="status">
    <span class="success-mark" aria-hidden="true">✓</span>
    <p class="pr-line">
      <a href={prUrl} target="_blank" rel="noopener">PR #{prNumber}</a>
      merged. Thank you.
    </p>
    <button type="button" class="btn-secondary" onclick={onreset}>
      {actionLabel}
    </button>
  </div>
{:else if status === "error"}
  <div class="pr-status error" role="alert">
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
    gap: var(--space-sm);
    flex-wrap: wrap;
    font-family: var(--font-serif-stack);
    color: var(--color-ink);
    padding: var(--space-sm) 0;
  }

  .pr-status.success {
    color: var(--color-success);
  }

  .pr-status.error {
    flex-direction: column;
    align-items: flex-start;
  }

  .pr-line {
    margin: 0;
    font-size: 1rem;
  }

  .success-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: var(--color-success);
    color: var(--color-paper);
    font-size: 0.9rem;
    font-weight: 700;
    font-family: var(--font-sans-stack);
  }

  /* Subtle ellipsis dot animation, respects reduced-motion */
  .dots {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  }

  .dots span {
    width: 0.35rem;
    height: 0.35rem;
    border-radius: 50%;
    background: var(--color-accent);
    opacity: 0.35;
    animation: dot-pulse 1.4s ease-in-out infinite;
  }

  .dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes dot-pulse {
    0%, 70%, 100% {
      opacity: 0.35;
      transform: scale(1);
    }
    35% {
      opacity: 1;
      transform: scale(1.25);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dots span {
      animation: none;
      opacity: 0.7;
    }
  }

  .error-text {
    font-family: var(--font-sans-stack);
    color: var(--color-error);
    font-size: var(--text-small);
    margin: 0 0 var(--space-xs);
  }
</style>
