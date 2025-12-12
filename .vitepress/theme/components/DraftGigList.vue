<script setup lang="ts">
import type { DraftGig } from "../composables/useDraftGigs";

defineProps<{
  drafts: DraftGig[];
}>();

defineEmits<{
  edit: [gig: DraftGig];
  delete: [id: string];
}>();
</script>

<template>
  <section v-if="drafts.length > 0" class="drafts-section">
    <h2>Draft gigs ({{ drafts.length }})</h2>
    <ul class="draft-list">
      <li v-for="gig of drafts" :key="gig.id" class="draft-item">
        <div class="draft-content">
          <strong>{{ gig.role }}</strong> at {{ gig.organisation }}
          <span class="draft-meta"
            >{{ gig.pollie_slug }} · {{ gig.category }}</span
          >
        </div>
        <div class="draft-actions">
          <button
            type="button"
            class="btn-icon"
            title="Edit"
            @click="$emit('edit', gig)"
          >
            ✎
          </button>
          <button
            type="button"
            class="btn-icon btn-danger"
            title="Delete"
            @click="$emit('delete', gig.id)"
          >
            ×
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.drafts-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
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
  background: var(--vp-c-bg);
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
  color: var(--vp-c-text-2);
}

.draft-actions {
  display: flex;
  gap: 0.25rem;
}

.btn-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: var(--vp-c-text-2);
}

.btn-icon:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.btn-icon.btn-danger:hover {
  color: var(--vp-c-red-1);
  border-color: var(--vp-c-red-1);
}
</style>
