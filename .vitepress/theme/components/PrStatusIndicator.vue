<script setup lang="ts">
import type { PrStatus } from "../composables/usePullRequest";

defineProps<{
  status: PrStatus;
  prNumber: number | null;
  prUrl: string;
  prError: string;
  actionLabel: string;
}>();

defineEmits<{
  reset: [];
}>();
</script>

<template>
  <div v-if="status === 'creating'" class="pr-status">
    <span class="spinner"></span> Creating pull request...
  </div>
  <div v-else-if="status === 'created'" class="pr-status">
    <p>
      <a :href="prUrl" target="_blank" rel="noopener">PR #{{ prNumber }}</a>
      created! Waiting for merge...
    </p>
    <span class="spinner"></span>
  </div>
  <div v-else-if="status === 'merged'" class="pr-status success">
    <p>
      <a :href="prUrl" target="_blank" rel="noopener">PR #{{ prNumber }}</a>
      merged!
    </p>
    <button type="button" class="btn-secondary" @click="$emit('reset')">
      {{ actionLabel }}
    </button>
  </div>
  <div v-else-if="status === 'error'" class="pr-status error">
    <p class="error-text">{{ prError }}</p>
    <button type="button" class="btn-secondary" @click="$emit('reset')">
      Try again
    </button>
  </div>
</template>

<style scoped>
.pr-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.pr-status.success {
  color: var(--vp-c-green-1);
}

.pr-status.error {
  flex-direction: column;
  align-items: flex-start;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--vp-c-border);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--vp-c-bg-soft);
}

.error-text {
  color: var(--vp-c-red-1);
  font-size: 0.875rem;
  margin: 0.25rem 0 0;
}
</style>
