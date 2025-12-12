<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { data as polliesList } from "../../../pollies-list.data";
import type { GigCategory } from "../../types";
import { GIG_CATEGORIES } from "../../types";
import type { DraftGig } from "../composables/useDraftGigs";

const props = defineProps<{
  editingGig: DraftGig | null;
  lastPollieSlug: string | null;
}>();

const emit = defineEmits<{
  submit: [gig: Omit<DraftGig, "id">];
  cancel: [];
}>();

const role = ref("");
const organisation = ref("");
const category = ref<GigCategory | "">("");
const sources = ref<string[]>([""]);
const pollieSlug = ref("");
const startDate = ref("");
const endDate = ref("");

const pollieSearch = ref("");
const showPollieResults = ref(false);
const formErrors = ref<Record<string, string>>({});

const filteredPollies = computed(() => {
  const query = pollieSearch.value.toLowerCase().trim();
  if (!query) return polliesList.slice(0, 10);
  return polliesList
    .filter(
      (p) => p.name.toLowerCase().includes(query) || p.slug.includes(query),
    )
    .slice(0, 10);
});

const pollieWarning = computed(() => {
  if (!pollieSlug.value) return "";
  const exists = polliesList.some((p) => p.slug === pollieSlug.value);
  return exists ? "" : "This slug doesn't match any known politician";
});

function validateForm(): boolean {
  formErrors.value = {};

  if (!role.value.trim()) formErrors.value.role = "Role is required";
  if (!organisation.value.trim())
    formErrors.value.organisation = "Organisation is required";
  if (!category.value) formErrors.value.category = "Category is required";
  const validSources = sources.value.filter((s) => s.trim());
  if (validSources.length === 0) {
    formErrors.value.sources = "At least one source URL is required";
  } else {
    for (const s of validSources) {
      try {
        new URL(s);
      } catch {
        formErrors.value.sources = "All sources must be valid URLs";
        break;
      }
    }
  }
  if (!pollieSlug.value.trim())
    formErrors.value.pollieSlug = "Pollie slug is required";
  if (startDate.value && !/^\d{4}-\d{2}-\d{2}$/.test(startDate.value)) {
    formErrors.value.startDate = "Must be YYYY-MM-DD format";
  }
  if (endDate.value && !/^\d{4}-\d{2}-\d{2}$/.test(endDate.value)) {
    formErrors.value.endDate = "Must be YYYY-MM-DD format";
  }

  return Object.keys(formErrors.value).length === 0;
}

function handleSubmit() {
  if (!validateForm()) return;

  const validSources = sources.value
    .filter((s) => s.trim())
    .map((s) => s.trim());

  const gig: Omit<DraftGig, "id"> = {
    role: role.value.trim(),
    organisation: organisation.value.trim(),
    category: category.value as GigCategory,
    sources: validSources,
    pollie_slug: pollieSlug.value.trim(),
  };

  if (startDate.value) gig.start_date = startDate.value;
  if (endDate.value) gig.end_date = endDate.value;

  emit("submit", gig);
  clearForm();
}

function clearForm() {
  role.value = "";
  organisation.value = "";
  category.value = "";
  sources.value = [""];
  startDate.value = "";
  endDate.value = "";
  formErrors.value = {};
}

function selectPollie(slug: string, name: string) {
  pollieSlug.value = slug;
  pollieSearch.value = name;
  showPollieResults.value = false;
}

function onPollieInputFocus() {
  showPollieResults.value = true;
}

function onPollieInputBlur() {
  setTimeout(() => {
    showPollieResults.value = false;
  }, 200);
}

watch(pollieSearch, (val) => {
  if (!val) pollieSlug.value = "";
});

watch(
  () => props.editingGig,
  (gig) => {
    if (gig) {
      role.value = gig.role;
      organisation.value = gig.organisation;
      category.value = gig.category;
      sources.value = gig.sources.length > 0 ? [...gig.sources] : [""];
      pollieSlug.value = gig.pollie_slug;
      pollieSearch.value =
        polliesList.find((p) => p.slug === gig.pollie_slug)?.name ||
        gig.pollie_slug;
      startDate.value = gig.start_date || "";
      endDate.value = gig.end_date || "";
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (props.lastPollieSlug && !props.editingGig) {
    pollieSlug.value = props.lastPollieSlug;
    const pollie = polliesList.find((p) => p.slug === props.lastPollieSlug);
    if (pollie) pollieSearch.value = pollie.name;
  }
});
</script>

<template>
  <section class="form-section">
    <h2>{{ editingGig ? "Edit gig" : "Add a new gig" }}</h2>
    <form @submit.prevent="handleSubmit">
      <div class="form-row">
        <div class="form-group">
          <label for="pollie-search">Politician</label>
          <div class="autocomplete-wrapper">
            <input
              id="pollie-search"
              v-model="pollieSearch"
              type="text"
              placeholder="Search by name..."
              autocomplete="off"
              @focus="onPollieInputFocus"
              @blur="onPollieInputBlur"
            />
            <ul
              v-if="showPollieResults && filteredPollies.length > 0"
              class="autocomplete-results"
            >
              <li
                v-for="pollie of filteredPollies"
                :key="pollie.slug"
                @mousedown="selectPollie(pollie.slug, pollie.name)"
              >
                {{ pollie.name }}
              </li>
            </ul>
          </div>
          <input type="hidden" v-model="pollieSlug" />
          <p v-if="pollieWarning" class="warning-text">
            {{ pollieWarning }}
          </p>
          <p v-if="formErrors.pollieSlug" class="error-text">
            {{ formErrors.pollieSlug }}
          </p>
        </div>
      </div>

      <div class="form-row two-col">
        <div class="form-group">
          <label for="role">Role <span class="required">*</span></label>
          <input
            id="role"
            v-model="role"
            type="text"
            placeholder="e.g. Non-Executive Director"
          />
          <p v-if="formErrors.role" class="error-text">
            {{ formErrors.role }}
          </p>
        </div>
        <div class="form-group">
          <label for="organisation"
            >Organisation <span class="required">*</span></label
          >
          <input
            id="organisation"
            v-model="organisation"
            type="text"
            placeholder="e.g. Acme Corp"
          />
          <p v-if="formErrors.organisation" class="error-text">
            {{ formErrors.organisation }}
          </p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="category">Category <span class="required">*</span></label>
          <select id="category" v-model="category">
            <option value="">Select a category...</option>
            <option v-for="cat of GIG_CATEGORIES" :key="cat" :value="cat">
              {{ cat }}
            </option>
          </select>
          <p v-if="formErrors.category" class="error-text">
            {{ formErrors.category }}
          </p>
        </div>
      </div>

      <div class="form-row two-col">
        <div class="form-group">
          <label for="start-date">Start date</label>
          <input id="start-date" v-model="startDate" type="date" />
          <p v-if="formErrors.startDate" class="error-text">
            {{ formErrors.startDate }}
          </p>
        </div>
        <div class="form-group">
          <label for="end-date">End date</label>
          <input id="end-date" v-model="endDate" type="date" />
          <p v-if="formErrors.endDate" class="error-text">
            {{ formErrors.endDate }}
          </p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Source URLs <span class="required">*</span></label>
          <div class="sources-list">
            <div
              v-for="(_, index) in sources"
              :key="index"
              class="source-row"
            >
              <input
                v-model="sources[index]"
                type="url"
                placeholder="https://..."
              />
              <button
                v-if="sources.length > 1"
                type="button"
                class="btn-icon btn-danger"
                title="Remove source"
                @click="sources.splice(index, 1)"
              >
                ×
              </button>
            </div>
          </div>
          <button
            type="button"
            class="btn-secondary btn-small"
            @click="sources.push('')"
          >
            + Add another source
          </button>
          <p v-if="formErrors.sources" class="error-text">
            {{ formErrors.sources }}
          </p>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary">
          {{ editingGig ? "Update gig" : "Add to draft" }}
        </button>
        <button
          v-if="editingGig"
          type="button"
          class="btn-secondary"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.form-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}

h2 {
  margin: 0 0 1rem;
  font-size: 1.25rem;
}

.form-row {
  margin-bottom: 1rem;
}

.form-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (width <= 600px) {
  .form-row.two-col {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 500;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.required {
  color: var(--vp-c-red-1);
}

.form-group input,
.form-group select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.autocomplete-wrapper {
  position: relative;
}

.autocomplete-results {
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
  border-radius: 0 0 4px 4px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.autocomplete-results li {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.autocomplete-results li:hover {
  background: var(--vp-c-bg-soft);
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.source-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.source-row input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 1rem;
}

.source-row input:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.error-text {
  color: var(--vp-c-red-1);
  font-size: 0.875rem;
  margin: 0.25rem 0 0;
}

.warning-text {
  color: var(--vp-c-yellow-1);
  font-size: 0.875rem;
  margin: 0.25rem 0 0;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
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

.btn-secondary.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
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
