<script setup lang="ts">
import { ref, computed } from "vue";
import { data as polliesList } from "../../../pollies-list.data";
import { data as gigsList } from "../../../gigs-list.data";
import type { GigWithIndex } from "../../../gigs-list.data";
import type { Gig } from "../../types";
import { GIG_CATEGORIES } from "../../types";

const props = defineProps<{
    verifierId: string;
}>();

const emit = defineEmits<{
    submit: [
        indices: number[],
        verifierId: string,
        edits: Record<number, Partial<Gig>>,
    ];
}>();

const verifySearch = ref("");
const selectedVerifyIndices = ref<Set<number>>(new Set());
const expandedVerifyIndex = ref<number | null>(null);
const gigEdits = ref<Record<number, Partial<Gig>>>({});

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

function getFieldValue(gig: GigWithIndex, field: keyof Gig): string {
    const edits = gigEdits.value[gig.index];
    if (edits && field in edits) {
        return (edits[field] as string) ?? "";
    }
    return (gig[field] as string) ?? "";
}

function getSourcesValue(gig: GigWithIndex): string[] {
    const edits = gigEdits.value[gig.index];
    if (edits && "sources" in edits) {
        return edits.sources!;
    }
    return gig.sources;
}

function isFieldModified(index: number, field: keyof Gig): boolean {
    const edits = gigEdits.value[index];
    return edits !== undefined && field in edits;
}

function hasAnyEdits(index: number): boolean {
    const edits = gigEdits.value[index];
    return edits !== undefined && Object.keys(edits).length > 0;
}

function setEditField(index: number, field: string, value: unknown) {
    const newEdits = { ...gigEdits.value };
    newEdits[index] = { ...newEdits[index], [field]: value };
    gigEdits.value = newEdits;
}

function removeEditField(index: number, field: string) {
    const edits = gigEdits.value[index];
    if (!edits) return;
    const updated = { ...edits };
    delete (updated as Record<string, unknown>)[field];
    const newEdits = { ...gigEdits.value };
    if (Object.keys(updated).length === 0) {
        delete newEdits[index];
    } else {
        newEdits[index] = updated as Partial<Gig>;
    }
    gigEdits.value = newEdits;
}

function updateStringField(
    index: number,
    field: "role" | "organisation" | "start_date" | "end_date",
    value: string,
    original: string | undefined,
) {
    const isDateField = field === "start_date" || field === "end_date";
    const normValue = isDateField ? value || undefined : value;
    const normOriginal = isDateField
        ? original || undefined
        : (original ?? "");
    if (normValue === normOriginal) {
        removeEditField(index, field);
    } else {
        setEditField(index, field, normValue);
    }
}

function updateCategory(index: number, value: string, original: string) {
    if (value === original) {
        removeEditField(index, "category");
    } else {
        setEditField(index, "category", value);
    }
}

function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
}

function updateSource(gig: GigWithIndex, sourceIndex: number, value: string) {
    const currentSources = [...getSourcesValue(gig)];
    currentSources[sourceIndex] = value;
    if (arraysEqual(currentSources, gig.sources)) {
        removeEditField(gig.index, "sources");
    } else {
        setEditField(gig.index, "sources", currentSources);
    }
}

function addSource(gig: GigWithIndex) {
    const currentSources = [...getSourcesValue(gig), ""];
    setEditField(gig.index, "sources", currentSources);
}

function removeSource(gig: GigWithIndex, sourceIndex: number) {
    const currentSources = getSourcesValue(gig).filter(
        (_, i) => i !== sourceIndex,
    );
    if (arraysEqual(currentSources, gig.sources)) {
        removeEditField(gig.index, "sources");
    } else {
        setEditField(gig.index, "sources", currentSources);
    }
}

function revertField(index: number, field: keyof Gig) {
    removeEditField(index, field);
}

function handleSubmit() {
    emit(
        "submit",
        Array.from(selectedVerifyIndices.value),
        props.verifierId,
        gigEdits.value,
    );
}

function clearSelection() {
    selectedVerifyIndices.value = new Set();
    gigEdits.value = {};
}

defineExpose({ clearSelection });
</script>

<template>
    <div class="verify-section">
        <p class="verify-intro">
            Select gigs you've verified are accurate, then submit a PR to mark
            them as verified by <strong>{{ verifierId }}</strong
            >. Expand a gig to edit its details before verifying.
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
                            <strong>{{
                                getFieldValue(gig, "role")
                            }}</strong>
                            at {{ getFieldValue(gig, "organisation") }}
                            <span class="verify-item-pollie">
                                {{ getPollieNameBySlug(gig.pollie_slug) }}
                                <span
                                    v-if="hasAnyEdits(gig.index)"
                                    class="edited-badge"
                                    >edited</span
                                >
                            </span>
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
                    <div class="verify-edit-fields">
                        <div class="edit-field-row">
                            <div
                                class="edit-field"
                                :class="{
                                    'field-modified': isFieldModified(
                                        gig.index,
                                        'role',
                                    ),
                                }"
                            >
                                <div class="edit-field-header">
                                    <label>Role</label>
                                    <button
                                        v-if="
                                            isFieldModified(gig.index, 'role')
                                        "
                                        type="button"
                                        class="btn-revert"
                                        title="Revert"
                                        @click="revertField(gig.index, 'role')"
                                    >
                                        ↩
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    :value="getFieldValue(gig, 'role')"
                                    @input="
                                        updateStringField(
                                            gig.index,
                                            'role',
                                            ($event.target as HTMLInputElement)
                                                .value,
                                            gig.role,
                                        )
                                    "
                                />
                                <span
                                    v-if="isFieldModified(gig.index, 'role')"
                                    class="was-text"
                                    >was: {{ gig.role }}</span
                                >
                            </div>
                            <div
                                class="edit-field"
                                :class="{
                                    'field-modified': isFieldModified(
                                        gig.index,
                                        'organisation',
                                    ),
                                }"
                            >
                                <div class="edit-field-header">
                                    <label>Organisation</label>
                                    <button
                                        v-if="
                                            isFieldModified(
                                                gig.index,
                                                'organisation',
                                            )
                                        "
                                        type="button"
                                        class="btn-revert"
                                        title="Revert"
                                        @click="
                                            revertField(
                                                gig.index,
                                                'organisation',
                                            )
                                        "
                                    >
                                        ↩
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    :value="
                                        getFieldValue(gig, 'organisation')
                                    "
                                    @input="
                                        updateStringField(
                                            gig.index,
                                            'organisation',
                                            ($event.target as HTMLInputElement)
                                                .value,
                                            gig.organisation,
                                        )
                                    "
                                />
                                <span
                                    v-if="
                                        isFieldModified(
                                            gig.index,
                                            'organisation',
                                        )
                                    "
                                    class="was-text"
                                    >was: {{ gig.organisation }}</span
                                >
                            </div>
                        </div>

                        <div
                            class="edit-field"
                            :class="{
                                'field-modified': isFieldModified(
                                    gig.index,
                                    'category',
                                ),
                            }"
                        >
                            <div class="edit-field-header">
                                <label>Category</label>
                                <button
                                    v-if="
                                        isFieldModified(gig.index, 'category')
                                    "
                                    type="button"
                                    class="btn-revert"
                                    title="Revert"
                                    @click="
                                        revertField(gig.index, 'category')
                                    "
                                >
                                    ↩
                                </button>
                            </div>
                            <select
                                :value="getFieldValue(gig, 'category')"
                                @change="
                                    updateCategory(
                                        gig.index,
                                        ($event.target as HTMLSelectElement)
                                            .value,
                                        gig.category,
                                    )
                                "
                            >
                                <option
                                    v-for="cat of GIG_CATEGORIES"
                                    :key="cat"
                                    :value="cat"
                                >
                                    {{ cat }}
                                </option>
                            </select>
                            <span
                                v-if="isFieldModified(gig.index, 'category')"
                                class="was-text"
                                >was: {{ gig.category }}</span
                            >
                        </div>

                        <div class="edit-field-row">
                            <div
                                class="edit-field"
                                :class="{
                                    'field-modified': isFieldModified(
                                        gig.index,
                                        'start_date',
                                    ),
                                }"
                            >
                                <div class="edit-field-header">
                                    <label>Start date</label>
                                    <button
                                        v-if="
                                            isFieldModified(
                                                gig.index,
                                                'start_date',
                                            )
                                        "
                                        type="button"
                                        class="btn-revert"
                                        title="Revert"
                                        @click="
                                            revertField(
                                                gig.index,
                                                'start_date',
                                            )
                                        "
                                    >
                                        ↩
                                    </button>
                                </div>
                                <input
                                    type="date"
                                    :value="getFieldValue(gig, 'start_date')"
                                    @input="
                                        updateStringField(
                                            gig.index,
                                            'start_date',
                                            ($event.target as HTMLInputElement)
                                                .value,
                                            gig.start_date,
                                        )
                                    "
                                />
                                <span
                                    v-if="
                                        isFieldModified(
                                            gig.index,
                                            'start_date',
                                        )
                                    "
                                    class="was-text"
                                    >was:
                                    {{ gig.start_date || "none" }}</span
                                >
                            </div>
                            <div
                                class="edit-field"
                                :class="{
                                    'field-modified': isFieldModified(
                                        gig.index,
                                        'end_date',
                                    ),
                                }"
                            >
                                <div class="edit-field-header">
                                    <label>End date</label>
                                    <button
                                        v-if="
                                            isFieldModified(
                                                gig.index,
                                                'end_date',
                                            )
                                        "
                                        type="button"
                                        class="btn-revert"
                                        title="Revert"
                                        @click="
                                            revertField(gig.index, 'end_date')
                                        "
                                    >
                                        ↩
                                    </button>
                                </div>
                                <input
                                    type="date"
                                    :value="getFieldValue(gig, 'end_date')"
                                    @input="
                                        updateStringField(
                                            gig.index,
                                            'end_date',
                                            ($event.target as HTMLInputElement)
                                                .value,
                                            gig.end_date,
                                        )
                                    "
                                />
                                <span
                                    v-if="
                                        isFieldModified(gig.index, 'end_date')
                                    "
                                    class="was-text"
                                    >was:
                                    {{ gig.end_date || "none" }}</span
                                >
                            </div>
                        </div>

                        <div
                            class="edit-field"
                            :class="{
                                'field-modified': isFieldModified(
                                    gig.index,
                                    'sources',
                                ),
                            }"
                        >
                            <div class="edit-field-header">
                                <label>Sources</label>
                                <button
                                    v-if="
                                        isFieldModified(gig.index, 'sources')
                                    "
                                    type="button"
                                    class="btn-revert"
                                    title="Revert"
                                    @click="revertField(gig.index, 'sources')"
                                >
                                    ↩
                                </button>
                            </div>
                            <div class="sources-list">
                                <div
                                    v-for="(src, i) in getSourcesValue(gig)"
                                    :key="i"
                                    class="source-row"
                                >
                                    <input
                                        type="url"
                                        :value="src"
                                        placeholder="https://..."
                                        @input="
                                            updateSource(
                                                gig,
                                                i,
                                                (
                                                    $event.target as HTMLInputElement
                                                ).value,
                                            )
                                        "
                                    />
                                    <button
                                        v-if="getSourcesValue(gig).length > 1"
                                        type="button"
                                        class="btn-icon btn-danger"
                                        title="Remove source"
                                        @click="removeSource(gig, i)"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                            <button
                                type="button"
                                class="btn-secondary btn-small"
                                @click="addSource(gig)"
                            >
                                + Add source
                            </button>
                            <span
                                v-if="isFieldModified(gig.index, 'sources')"
                                class="was-text"
                                >was:
                                {{
                                    gig.sources
                                        .map((s) => getHostname(s))
                                        .join(", ")
                                }}</span
                            >
                        </div>
                    </div>
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

.edited-badge {
    display: inline-block;
    font-size: 0.75rem;
    padding: 0.0625rem 0.375rem;
    background: var(--vp-c-brand-soft);
    color: var(--vp-c-brand-1);
    border-radius: 3px;
    margin-left: 0.5rem;
    font-weight: 500;
}

.verify-item-details {
    padding: 0 0.75rem 0.75rem 2.75rem;
    border-top: 1px solid var(--vp-c-border);
    margin-top: 0.5rem;
    padding-top: 0.75rem;
}

.verify-edit-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.edit-field {
    display: flex;
    flex-direction: column;
    padding-left: 0.5rem;
    border-left: 3px solid transparent;
    transition: border-color 0.2s;
}

.edit-field.field-modified {
    border-left-color: var(--vp-c-brand-1);
}

.edit-field-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
}

.edit-field-header label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
}

.edit-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
}

@media (width <= 600px) {
    .edit-field-row {
        grid-template-columns: 1fr;
    }
}

.edit-field input,
.edit-field select {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 4px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 0.875rem;
}

.edit-field input:focus,
.edit-field select:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
}

.btn-revert {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--vp-c-brand-1);
    padding: 0 0.25rem;
    line-height: 1;
}

.btn-revert:hover {
    color: var(--vp-c-brand-2);
}

.was-text {
    font-size: 0.75rem;
    color: var(--vp-c-text-3);
    margin-top: 0.125rem;
    font-style: italic;
}

.sources-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 0.375rem;
}

.source-row {
    display: flex;
    gap: 0.375rem;
    align-items: center;
}

.source-row input {
    flex: 1;
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

.btn-icon.btn-danger:hover {
    color: var(--vp-c-red-1);
    border-color: var(--vp-c-red-1);
}
</style>
