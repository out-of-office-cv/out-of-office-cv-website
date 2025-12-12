<script setup lang="ts">
import { ref, computed } from "vue";
import { data as polliesList } from "../../../pollies-list.data";
import { data as gigsList } from "../../../gigs-list.data";

const props = defineProps<{
    verifierId: string;
}>();

const emit = defineEmits<{
    submit: [indices: number[], verifierId: string];
}>();

const verifySearch = ref("");
const selectedVerifyIndices = ref<Set<number>>(new Set());
const expandedVerifyIndex = ref<number | null>(null);

const unverifiedGigs = computed(() =>
    gigsList.filter((gig) => !gig.verified_by),
);

const filteredUnverifiedGigs = computed(() => {
    const query = verifySearch.value.toLowerCase().trim();
    if (!query) return unverifiedGigs.value;
    return unverifiedGigs.value.filter(
        (gig) =>
            gig.role.toLowerCase().includes(query) ||
            gig.organisation.toLowerCase().includes(query) ||
            gig.pollie_slug.toLowerCase().includes(query) ||
            gig.category.toLowerCase().includes(query),
    );
});

function getPollieNameBySlug(slug: string): string {
    const pollie = polliesList.find((p) => p.slug === slug);
    return pollie?.name || slug;
}

function getHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

function toggleVerifySelection(index: number) {
    if (selectedVerifyIndices.value.has(index)) {
        selectedVerifyIndices.value.delete(index);
    } else {
        selectedVerifyIndices.value.add(index);
    }
    selectedVerifyIndices.value = new Set(selectedVerifyIndices.value);
}

function selectAllVisible() {
    for (const gig of filteredUnverifiedGigs.value) {
        selectedVerifyIndices.value.add(gig.index);
    }
    selectedVerifyIndices.value = new Set(selectedVerifyIndices.value);
}

function clearVerifySelection() {
    selectedVerifyIndices.value = new Set();
}

function toggleExpandGig(index: number) {
    expandedVerifyIndex.value =
        expandedVerifyIndex.value === index ? null : index;
}

function handleSubmit() {
    emit("submit", Array.from(selectedVerifyIndices.value), props.verifierId);
}

function clearSelection() {
    selectedVerifyIndices.value = new Set();
}

defineExpose({ clearSelection });
</script>

<template>
    <div class="verify-section">
        <p class="verify-intro">
            Select gigs you've verified are accurate, then submit a PR to mark
            them as verified by <strong>{{ verifierId }}</strong
            >.
        </p>

        <div class="verify-controls">
            <input
                v-model="verifySearch"
                type="text"
                placeholder="Filter by role, organisation, politician..."
                class="verify-search"
            />
            <div class="verify-bulk-actions">
                <button
                    type="button"
                    class="btn-secondary btn-small"
                    @click="selectAllVisible"
                >
                    Select all visible
                </button>
                <button
                    type="button"
                    class="btn-secondary btn-small"
                    @click="clearVerifySelection"
                    :disabled="selectedVerifyIndices.size === 0"
                >
                    Clear selection
                </button>
            </div>
        </div>

        <div v-if="filteredUnverifiedGigs.length === 0" class="empty-state">
            <p v-if="verifySearch">No unverified gigs match your search.</p>
            <p v-else>All gigs have been verified!</p>
        </div>

        <ul v-else class="verify-list">
            <li
                v-for="gig of filteredUnverifiedGigs"
                :key="gig.index"
                :class="[
                    'verify-item',
                    {
                        selected: selectedVerifyIndices.has(gig.index),
                        expanded: expandedVerifyIndex === gig.index,
                    },
                ]"
            >
                <div class="verify-item-header">
                    <label class="verify-checkbox-label">
                        <input
                            type="checkbox"
                            :checked="selectedVerifyIndices.has(gig.index)"
                            @change="toggleVerifySelection(gig.index)"
                        />
                        <span class="verify-item-summary">
                            <strong>{{ gig.role }}</strong> at
                            {{ gig.organisation }}
                            <span class="verify-item-pollie">{{
                                getPollieNameBySlug(gig.pollie_slug)
                            }}</span>
                        </span>
                    </label>
                    <button
                        type="button"
                        class="btn-icon btn-expand"
                        :title="
                            expandedVerifyIndex === gig.index
                                ? 'Collapse'
                                : 'Expand'
                        "
                        @click="toggleExpandGig(gig.index)"
                    >
                        {{ expandedVerifyIndex === gig.index ? "▲" : "▼" }}
                    </button>
                </div>
                <div
                    v-if="expandedVerifyIndex === gig.index"
                    class="verify-item-details"
                >
                    <dl>
                        <dt>Category</dt>
                        <dd>{{ gig.category }}</dd>
                        <dt>Dates</dt>
                        <dd>
                            {{ gig.start_date ? gig.start_date : "unknown" }}
                            {{
                                gig.end_date ? `– ${gig.end_date}` : "– present"
                            }}
                        </dd>
                        <dt>
                            {{
                                gig.sources.length === 1 ? "Source" : "Sources"
                            }}
                        </dt>
                        <dd>
                            <template v-for="(src, i) in gig.sources" :key="i">
                                <a :href="src" target="_blank" rel="noopener">{{
                                    getHostname(src)
                                }}</a
                                ><span v-if="i < gig.sources.length - 1"
                                    >,
                                </span>
                            </template>
                        </dd>
                    </dl>
                </div>
            </li>
        </ul>

        <div
            v-if="selectedVerifyIndices.size > 0"
            class="verify-submit-section"
        >
            <slot
                name="submit"
                :count="selectedVerifyIndices.size"
                :on-submit="handleSubmit"
            >
                <button
                    type="button"
                    class="btn-primary btn-large"
                    @click="handleSubmit"
                >
                    Verify {{ selectedVerifyIndices.size }} gig(s) as
                    {{ verifierId }}
                </button>
            </slot>
        </div>
    </div>
</template>

<style scoped>
.verify-section {
    margin-top: 0;
}

.verify-intro {
    margin-bottom: 1rem;
    color: var(--vp-c-text-2);
}

.verify-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.verify-search {
    flex: 1;
    min-width: 200px;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 1rem;
}

.verify-search:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
}

.verify-bulk-actions {
    display: flex;
    gap: 0.5rem;
}

.empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--vp-c-text-2);
}

.verify-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 400px;
    overflow-y: auto;
}

.verify-item {
    background: var(--vp-c-bg);
    border-radius: 4px;
    margin-bottom: 0.5rem;
    border: 2px solid transparent;
    transition: border-color 0.2s;
}

.verify-item.selected {
    border-color: var(--vp-c-brand-1);
}

.verify-item-header {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    gap: 0.5rem;
}

.verify-checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
    cursor: pointer;
}

.verify-checkbox-label input[type="checkbox"] {
    margin-top: 0.25rem;
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.verify-item-summary {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.verify-item-pollie {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
}

.verify-item-details {
    padding: 0 0.75rem 0.75rem 2.75rem;
    border-top: 1px solid var(--vp-c-border);
    margin-top: 0.5rem;
    padding-top: 0.75rem;
}

.verify-item-details dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 1rem;
    font-size: 0.875rem;
}

.verify-item-details dt {
    color: var(--vp-c-text-2);
}

.verify-item-details dd {
    margin: 0;
}

.verify-item-details a {
    color: var(--vp-c-brand-1);
    word-break: break-all;
}

.verify-submit-section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--vp-c-border);
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

.btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-secondary.btn-small {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
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

.btn-primary.btn-large {
    padding: 0.75rem 1.5rem;
    font-size: 1.1rem;
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

.btn-icon.btn-expand {
    font-size: 0.75rem;
}
</style>
