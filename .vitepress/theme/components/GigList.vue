<script setup lang="ts">
import { computed } from "vue";
import type { Gig } from "../../types";
import { formatISODate } from "../../utils";
import PollieBadge from "./PollieBadge.vue";

const props = defineProps<{
    gigs: Gig[];
}>();

const verifiedGigs = computed(() =>
    props.gigs.filter((gig) => gig.verified_by),
);

function getDateRange(gig: Gig): string {
    if (gig.start_date) {
        return gig.end_date
            ? `${formatISODate(gig.start_date)} – ${formatISODate(gig.end_date)}`
            : `${formatISODate(gig.start_date)} – present`;
    }
    return gig.end_date ? `until ${formatISODate(gig.end_date)}` : "";
}

function getHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}
</script>

<template>
    <div class="gig-section">
        <h2>Post-office roles</h2>
        <p v-if="verifiedGigs.length === 0" class="no-gigs">
            No out-of-office gigs found yet. Know of one?
            <a href="/contribute">Help us add it.</a>
        </p>
        <ul v-else class="gig-list">
            <li
                v-for="(gig, index) in verifiedGigs"
                :key="index"
                class="gig-card"
            >
                <div class="gig-role">{{ gig.role }}</div>
                <div class="gig-organisation">{{ gig.organisation }}</div>
                <div class="gig-meta">
                    <PollieBadge variant="category">{{
                        gig.category
                    }}</PollieBadge>
                    <span v-if="getDateRange(gig)" class="gig-dates">{{
                        getDateRange(gig)
                    }}</span>
                </div>
                <div class="gig-sources">
                    <span>{{
                        gig.sources.length === 1 ? "Source: " : "Sources: "
                    }}</span>
                    <template v-for="(source, i) in gig.sources" :key="i">
                        <a
                            :href="source"
                            target="_blank"
                            rel="noopener"
                            class="source-link"
                            >{{ getHostname(source) }}</a
                        ><span v-if="i < gig.sources.length - 1">, </span>
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

.no-gigs {
    color: var(--vp-c-text-2);
    font-style: italic;
}

.no-gigs a {
    color: var(--vp-c-brand-1);
}
</style>
