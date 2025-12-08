<script setup lang="ts">
import { ref, computed } from "vue";
import { data } from "../../../pollies.data";
import { getPartyColour, type PartyColour } from "../../utils";
import type { House } from "../../types";

const search = ref("");

function isDecade1980sOrLater(decade: string): boolean {
    if (decade === "Current") return true;
    const year = parseInt(decade.replace("s", ""), 10);
    return !isNaN(year) && year >= 1980;
}

const filteredData = computed(() => {
    const query = search.value.toLowerCase().trim();

    const recentData = data.filter((group) =>
        isDecade1980sOrLater(group.decade),
    );

    if (!query) return recentData;

    return recentData
        .map((group) => ({
            ...group,
            pollies: group.pollies.filter(
                (p) =>
                    p.name.toLowerCase().includes(query) ||
                    p.division.toLowerCase().includes(query) ||
                    p.state.toLowerCase().includes(query) ||
                    p.party.toLowerCase().includes(query),
            ),
        }))
        .filter((group) => group.pollies.length > 0);
});
</script>

<template>
    <input
        v-model="search"
        type="search"
        placeholder="Search by name, electorate, state or party..."
        class="pollie-search"
    />

    <template v-for="group of filteredData" :key="group.decade">
        <h2>{{ group.decade }}</h2>
        <ul class="pollie-list">
            <li
                v-for="pollie of group.pollies"
                :key="pollie.slug"
                class="pollie-card"
            >
                <a :href="'/pollies/' + pollie.slug" class="pollie-name">{{
                    pollie.name
                }}</a>
                <div class="pollie-meta">
                    <span
                        :class="[
                            'badge',
                            'badge-party',
                            `badge-party-${getPartyColour(pollie.party) || 'default'}`,
                        ]"
                    >
                        {{ pollie.party }}
                    </span>
                    <span
                        :class="[
                            'badge',
                            'badge-house',
                            `badge-${pollie.house}`,
                        ]"
                    >
                        {{ pollie.house === "senate" ? "Senator" : "MP" }}
                    </span>
                    <span class="pollie-location">
                        {{ pollie.division || pollie.state
                        }}<template v-if="pollie.division"
                            >, {{ pollie.state }}</template
                        >
                    </span>
                </div>
            </li>
        </ul>
    </template>
</template>

<style scoped>
.pollie-search {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    margin-bottom: 1.5rem;
}

.pollie-search:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
}

.pollie-search::placeholder {
    color: var(--vp-c-text-3);
}

.pollie-list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.pollie-card {
    padding: 0.75rem 1rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
}

.pollie-name {
    display: block;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--vp-c-text-1);
    text-decoration: none;
    margin-bottom: 0.375rem;
}

.pollie-name:hover {
    color: var(--vp-c-brand-1);
}

.pollie-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}

.pollie-location {
    color: var(--vp-c-text-2);
    font-size: 0.875rem;
}

.badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
}

.badge-senate {
    background-color: #a51c30;
    color: white;
}

.badge-reps {
    background-color: #0d5f2c;
    color: white;
}

.badge-party-red {
    background-color: #e53935;
    color: white;
}

.badge-party-blue {
    background-color: #1565c0;
    color: white;
}

.badge-party-green {
    background-color: #2e7d32;
    color: white;
}

.badge-party-grey {
    background-color: #616161;
    color: white;
}

.badge-party-orange {
    background-color: #ef6c00;
    color: white;
}

.badge-party-purple {
    background-color: #7b1fa2;
    color: white;
}

.badge-party-default {
    background-color: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
    border: 1px solid var(--vp-c-border);
}
</style>
