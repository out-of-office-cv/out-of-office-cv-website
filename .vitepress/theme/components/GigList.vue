<script setup lang="ts">
import { computed } from "vue";
import type { Gig } from "../../types";

const props = defineProps<{
    gigs: Gig[];
}>();

const verifiedGigs = computed(() =>
    props.gigs.filter((gig) => gig.verified_by),
);

function formatDate(isoDateStr: string): string {
    const date = new Date(isoDateStr);
    return date.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function getDateRange(gig: Gig): string {
    if (gig.start_date) {
        return gig.end_date
            ? `${formatDate(gig.start_date)} – ${formatDate(gig.end_date)}`
            : `${formatDate(gig.start_date)} – present`;
    }
    return gig.end_date ? `until ${formatDate(gig.end_date)}` : "";
}
</script>

<template>
    <div v-if="verifiedGigs.length > 0" class="gig-section">
        <h2>Post-office roles</h2>
        <ul class="gig-list">
            <li
                v-for="(gig, index) in verifiedGigs"
                :key="index"
                class="gig-card"
            >
                <div class="gig-role">{{ gig.role }}</div>
                <div class="gig-organisation">{{ gig.organisation }}</div>
                <div class="gig-meta">
                    <span class="badge badge-category">{{ gig.category }}</span>
                    <span v-if="getDateRange(gig)" class="gig-dates">{{
                        getDateRange(gig)
                    }}</span>
                </div>
                <div class="gig-sources">
                    <template v-if="gig.sources.length === 1">
                        <a :href="gig.sources[0]" target="_blank" rel="noopener"
                            >Source</a
                        >
                    </template>
                    <template v-else>
                        <span>Sources: </span>
                        <a
                            v-for="(source, i) in gig.sources"
                            :key="i"
                            :href="source"
                            target="_blank"
                            rel="noopener"
                            class="source-link"
                            >[{{ i + 1 }}]</a
                        >
                    </template>
                </div>
            </li>
        </ul>
    </div>
</template>

<style scoped>
.gig-section h2 {
    margin-top: 2rem;
    margin-bottom: 1rem;
}

.gig-list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.gig-card {
    padding: 0.75rem 1rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
}

.gig-role {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--vp-c-text-1);
    margin-bottom: 0.25rem;
}

.gig-organisation {
    color: var(--vp-c-text-1);
    margin-bottom: 0.5rem;
}

.gig-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.gig-dates {
    color: var(--vp-c-text-2);
    font-size: 0.875rem;
}

.gig-sources {
    font-size: 0.8rem;
    color: var(--vp-c-text-3);
}

.gig-sources a {
    color: var(--vp-c-brand-1);
    text-decoration: none;
}

.gig-sources a:hover {
    text-decoration: underline;
}

.source-link {
    margin-right: 0.25rem;
}

.badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
}

.badge-category {
    background-color: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
    border: 1px solid var(--vp-c-border);
}
</style>
