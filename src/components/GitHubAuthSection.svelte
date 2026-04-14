<script lang="ts">
  import type { createGitHubAuth } from "../stores/github-auth.svelte"

  interface Props {
    auth: ReturnType<typeof createGitHubAuth>
  }

  let { auth }: Props = $props()
</script>

<section class="auth-section" aria-labelledby="auth-heading">
  <header class="auth-header">
    <h2 id="auth-heading">GitHub connection</h2>
    {#if auth.isAuthenticated}
      <span class="auth-status connected" role="status">
        <span class="status-indicator" aria-hidden="true"></span>
        <span>
          Connected as <strong>@{auth.username}</strong>
        </span>
      </span>
    {:else}
      <span class="auth-status disconnected" role="status">
        <span class="status-indicator status-indicator-off" aria-hidden="true"></span>
        <span>Not connected</span>
      </span>
    {/if}
  </header>

  {#if auth.isAuthenticated}
    <div class="auth-connected">
      {#if auth.verifierId}
        <p class="verifier-line">
          <span class="caps">Verifier ID</span>
          <span class="verifier-id">{auth.verifierId}</span>
        </p>
      {/if}
      <button type="button" class="btn-link" onclick={() => auth.disconnectGitHub()}>
        Disconnect
      </button>
    </div>
  {:else}
    <div class="auth-setup">
      <p>
        Submitting gigs requires a GitHub Personal Access Token. One-time setup,
        about a minute.
      </p>
      <h3>Create a classic token</h3>
      <ol class="setup-steps">
        <li>
          <a
            href="https://github.com/settings/tokens/new?scopes=public_repo&description=Out%20of%20Office%20CV"
            target="_blank"
            rel="noopener"
          >
            Open GitHub's token creation page →
          </a>
          (log in if prompted).
        </li>
        <li>
          The form should be pre-filled. If not, add a note like "Out of Office
          CV" and tick <code>public_repo</code> under scopes (the minimum
          permission needed).
        </li>
        <li>Scroll down and click <strong>Generate token</strong>.</li>
        <li>
          Copy the token (starts with <code>ghp_</code>) and paste it below.
        </li>
      </ol>
      <p class="hint">
        Your token is stored only in this browser's <code>localStorage</code>
        and sent directly to GitHub.
      </p>
      <div class="token-input-row">
        <label for="github-token" class="visually-hidden">GitHub token</label>
        <input
          id="github-token"
          bind:value={auth.token}
          type="password"
          placeholder="Paste your token here"
          class="token-input"
          disabled={auth.isValidatingToken}
          autocomplete="off"
        />
        <button
          type="button"
          class="btn-primary"
          disabled={!auth.token || auth.isValidatingToken}
          onclick={() => auth.saveToken()}
        >
          {auth.isValidatingToken ? "Validating…" : "Connect"}
        </button>
      </div>
      {#if auth.tokenError}
        <p class="error-text">{auth.tokenError}</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .auth-section {
    margin-bottom: var(--space-lg);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--color-rule);
  }

  .auth-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  h2 {
    margin: 0;
  }

  h3 {
    margin: var(--space-md) 0 var(--space-xs);
    font-size: 1rem;
  }

  .auth-status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-sans-stack);
    font-size: var(--text-meta);
    color: var(--color-ink-2);
  }

  .status-indicator {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--color-success);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-success) 15%, transparent);
  }

  .status-indicator-off {
    background: var(--color-ink-3);
    box-shadow: none;
  }

  .auth-connected {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-md);
    font-family: var(--font-sans-stack);
    font-size: var(--text-small);
  }

  .verifier-line {
    margin: 0;
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-xs);
  }

  .verifier-id {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.9em;
    color: var(--color-accent);
    font-weight: 600;
  }

  .setup-steps {
    margin: var(--space-xs) 0 var(--space-md);
    padding-left: var(--space-lg);
    font-family: var(--font-serif-stack);
    line-height: 1.6;
  }

  .setup-steps li {
    margin-bottom: var(--space-xs);
  }

  .setup-steps li::marker {
    font-family: var(--font-serif-stack);
    font-variant-numeric: lining-nums;
    color: var(--color-ink-3);
  }

  .hint {
    font-family: var(--font-serif-stack);
    font-style: italic;
    font-size: var(--text-small);
    color: var(--color-ink-2);
    margin-top: var(--space-md);
  }

  .token-input-row {
    display: flex;
    gap: var(--space-xs);
    margin-top: var(--space-sm);
    max-width: 34rem;
  }

  .token-input {
    flex: 1;
  }

  .error-text {
    font-family: var(--font-sans-stack);
    color: var(--color-error);
    font-size: var(--text-meta);
    margin: var(--space-xs) 0 0;
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
