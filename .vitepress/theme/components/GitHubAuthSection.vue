<script setup lang="ts">
import { useGitHubAuth } from "../composables/useGitHubAuth";

const {
  githubToken,
  githubUsername,
  isValidatingToken,
  tokenError,
  isAuthenticated,
  verifierId,
  saveToken,
  disconnectGitHub,
} = useGitHubAuth();
</script>

<template>
  <section class="auth-section">
    <h2>GitHub connection</h2>
    <div v-if="isAuthenticated" class="auth-status connected">
      <span class="status-indicator"></span>
      Connected as <strong>@{{ githubUsername }}</strong>
      <span v-if="verifierId" class="verifier-badge"
        >Verifier: {{ verifierId }}</span
      >
      <button type="button" class="btn-link" @click="disconnectGitHub">
        Disconnect
      </button>
    </div>
    <div v-else class="auth-setup">
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
            Open GitHub's token creation page →
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
          v-model="githubToken"
          type="password"
          placeholder="Paste your token here"
          class="token-input"
          :disabled="isValidatingToken"
        />
        <button
          type="button"
          class="btn-primary"
          :disabled="!githubToken || isValidatingToken"
          @click="saveToken"
        >
          {{ isValidatingToken ? "Validating..." : "Connect" }}
        </button>
      </div>
      <p v-if="tokenError" class="error-text">{{ tokenError }}</p>
    </div>
  </section>
</template>

<style scoped>
.auth-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
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
  color: var(--vp-c-text-2);
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
  background: var(--vp-c-green-1);
}

.verifier-badge {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  margin-left: 0.5rem;
}

.btn-link {
  background: none;
  border: none;
  color: var(--vp-c-brand-1);
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
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-primary:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  color: var(--vp-c-red-1);
  font-size: 0.875rem;
  margin: 0.25rem 0 0;
}

code {
  background: var(--vp-c-bg);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.9em;
}
</style>
