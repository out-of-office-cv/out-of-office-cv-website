<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vitepress";
import { data } from "../../../pollies.data";

const router = useRouter();
const search = ref("");
const showResults = ref(false);

const allPollies = computed(() => data.flatMap((group) => group.pollies));

const filteredPollies = computed(() => {
  const query = search.value.toLowerCase().trim();
  if (!query) return [];

  return allPollies.value
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.division.toLowerCase().includes(query) ||
        p.state.toLowerCase().includes(query) ||
        p.party.toLowerCase().includes(query)
    )
    .slice(0, 10);
});

function selectPollie(slug: string) {
  search.value = "";
  showResults.value = false;
  router.go(`/pollies/${slug}`);
}

function onFocus() {
  showResults.value = true;
}

function onBlur() {
  setTimeout(() => {
    showResults.value = false;
  }, 200);
}
</script>

<template>
  <div class="pollie-search-wrapper">
    <input
      v-model="search"
      type="search"
      placeholder="Search by name, electorate, state or party..."
      class="pollie-search"
      @focus="onFocus"
      @blur="onBlur"
    />
    <ul v-if="showResults && filteredPollies.length > 0" class="pollie-search-results">
      <li
        v-for="pollie of filteredPollies"
        :key="pollie.slug"
        @mousedown="selectPollie(pollie.slug)"
      >
        <strong>{{ pollie.name }}</strong>
        <span class="pollie-meta">{{ pollie.division }}, {{ pollie.state }} ({{ pollie.party }})</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pollie-search-wrapper {
  position: relative;
  margin-bottom: 1.5rem;
}

.pollie-search {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.pollie-search:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.pollie-search::placeholder {
  color: var(--vp-c-text-3);
}

.pollie-search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
}

.pollie-search-results li {
  padding: 0.75rem 1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pollie-search-results li:hover {
  background: var(--vp-c-bg-soft);
}

.pollie-meta {
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
}
</style>
