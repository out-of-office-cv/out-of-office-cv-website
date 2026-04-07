<script lang="ts">
  import type { createGitHubAuth } from "../stores/github-auth.svelte"

  interface Props {
    auth: ReturnType<typeof createGitHubAuth>
  }

  let { auth }: Props = $props()
</script>

<section class="auth-section">
  <h2>GitHub connection</h2>
  {#if auth.isAuthenticated}
    <div class="auth-status connected">
      <span class="status-indicator"></span>
      Connected as <strong>@{auth.username}</strong>
      {#if auth.verifierId}
        <span class="verifier-badge">Verifier: {auth.verifierId}</span>
      {/if}
      <button type="button" class="btn-link" onclick={() => auth.disconnectGitHub()}>
        Disconnect
      </button>
    </div>
  {:else}
    <div class="auth-setup">
      <p>
        To submit gigs, you need a GitHub Personal Access Token (PAT). This is a
        one-time setup that takes about a minute.
      </p>
      <h3>How to create a classic token</h3>
      <ol class="setup-steps">
        <li>
          <a
            href="https://github.com/settings/tokens/new?scopes=public_repo&description=Out%20of%20Office%20CV"
            target="_blank"
            rel="noopener"
          >
            Open GitHub's token creation page &rarr;
          </a>
          (you may need to log in)
        </li>
        <li>
          The form should be pre-filled. If not, add a note like "Out of Office
          CV" and tick the <code>public_repo</code> checkbox under scopes (this
          is the minimum permission needed).
        </li>
        <li>Scroll down and click <strong>Generate token</strong></li>
        <li>
          Copy the token (starts with <code>ghp_</code>) and paste it below
        </li>
      </ol>
      <p class="hint">
        Your token is stored only in this browser's localStorage and sent
        directly to GitHub.
      </p>
      <div class="token-input-row">
        <input
          bind:value={auth.token}
          type="password"
          placeholder="Paste your token here"
          class="token-input"
          disabled={auth.isValidatingToken}
        />
        <button
          type="button"
          class="btn-primary"
          disabled={!auth.token || auth.isValidatingToken}
          onclick={() => auth.saveToken()}
        >
          {auth.isValidatingToken ? "Validating..." : "Connect"}
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
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--color-bg-soft);
    border-radius: 8px;
  }

  h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
  }

  h3 {
    margin: 1rem 0 0.5rem;
    font-size: 1rem;
  }

  .setup-steps {
    margin: 0.5rem 0 1rem;
    padding-left: 1.25rem;
  }

  .setup-steps li {
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  .hint {
    font-size: 0.875rem;
    color: var(--color-text-2);
    margin-top: 1rem;
  }

  .auth-status.connected {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-green-1);
  }

  .verifier-badge {
    background: var(--color-brand-soft);
    color: var(--color-brand-1);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    margin-left: 0.5rem;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--color-brand-1);
    cursor: pointer;
    padding: 0;
    margin-left: 1rem;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .token-input-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .token-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-1);
  }

  .error-text {
    color: var(--color-red-1);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }
</style>
