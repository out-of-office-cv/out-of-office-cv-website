<script setup lang="ts">
import { ref, computed } from "vue";
import { data } from "../../../pollies.data";
import type { House } from "../../types";
import PollieBadge from "./PollieBadge.vue";

const search = ref("");
const houseFilter = ref<House | "">("");
const stateFilter = ref("");
const partyFilter = ref("");
const decadeFilter = ref("");
const photoErrors = ref(new Set<string>());

function isDecade1980sOrLater(decade: string): boolean {
    if (decade === "Current") return true;
    const year = parseInt(decade.replace("s", ""), 10);
    return !isNaN(year) && year >= 1980;
}

const recentData = computed(() =>
    data.filter((group) => isDecade1980sOrLater(group.decade)),
);

const uniqueStates = computed(() => {
    const states = new Set<string>();
    for (const group of recentData.value) {
        for (const p of group.pollies) {
            if (p.state) states.add(p.state);
        }
    }
    return Array.from(states).sort();
});

const uniqueParties = computed(() => {
    const parties = new Set<string>();
    for (const group of recentData.value) {
        for (const p of group.pollies) {
            if (p.party) parties.add(p.party.trim());
        }
    }
    return Array.from(parties).sort();
});

const uniqueDecades = computed(() =>
    recentData.value.map((group) => group.decade),
);

const filteredData = computed(() => {
    const query = search.value.toLowerCase().trim();

    let result = recentData.value;

    if (decadeFilter.value) {
        result = result.filter((group) => group.decade === decadeFilter.value);
    }

    if (query || houseFilter.value || stateFilter.value || partyFilter.value) {
        result = result
            .map((group) => ({
                ...group,
                pollies: group.pollies.filter((p) => {
                    if (houseFilter.value && p.house !== houseFilter.value)
                        return false;
                    if (stateFilter.value && p.state !== stateFilter.value)
                        return false;
                    if (
                        partyFilter.value &&
                        p.party.trim() !== partyFilter.value
                    )
                        return false;
                    if (query) {
                        return (
                            p.name.toLowerCase().includes(query) ||
                            p.division.toLowerCase().includes(query) ||
                            p.state.toLowerCase().includes(query) ||
                            p.party.toLowerCase().includes(query)
                        );
                    }
                    return true;
                }),
            }))
            .filter((group) => group.pollies.length > 0);
    }

    return result;
});

function clearFilters() {
    search.value = "";
    houseFilter.value = "";
    stateFilter.value = "";
    partyFilter.value = "";
    decadeFilter.value = "";
}

const hasActiveFilters = computed(
    () =>
        search.value ||
        houseFilter.value ||
        stateFilter.value ||
        partyFilter.value ||
        decadeFilter.value,
);
</script>

<template>
    <div class="pollie-filters">
        <h2 class="filter-heading">Find a politician</h2>
        <input
            v-model="search"
            type="search"
            placeholder="Search by name, electorate, state or party..."
            class="pollie-search"
        />

        <div class="filter-row">
            <select v-model="houseFilter" class="filter-select">
                <option value="">All chambers</option>
                <option value="senate">Senators</option>
                <option value="reps">MPs</option>
            </select>

            <select v-model="stateFilter" class="filter-select">
                <option value="">All states</option>
                <option
                    v-for="state in uniqueStates"
                    :key="state"
                    :value="state"
                >
                    {{ state }}
                </option>
            </select>

            <select v-model="partyFilter" class="filter-select">
                <option value="">All parties</option>
                <option
                    v-for="party in uniqueParties"
                    :key="party"
                    :value="party"
                >
                    {{ party }}
                </option>
            </select>

            <select v-model="decadeFilter" class="filter-select">
                <option value="">All decades</option>
                <option
                    v-for="decade in uniqueDecades"
                    :key="decade"
                    :value="decade"
                >
                    {{ decade }}
                </option>
            </select>

            <button
                v-if="hasActiveFilters"
                type="button"
                class="clear-filters"
                @click="clearFilters"
            >
                Clear filters
            </button>
        </div>
    </div>

    <template v-for="group of filteredData" :key="group.decade">
        <h2>{{ group.decade }}</h2>
        <ul class="pollie-list">
            <li
                v-for="pollie of group.pollies"
                :key="pollie.slug"
                class="pollie-card"
            >
                <a :href="'/pollies/' + pollie.slug" class="pollie-link">
                    <img
                        v-if="pollie.photoUrl && !photoErrors.has(pollie.slug)"
                        :src="pollie.photoUrl"
                        :alt="`Photo of ${pollie.name}`"
                        class="pollie-photo"
                        @error="photoErrors.add(pollie.slug)"
                    />
                    <div class="pollie-content">
                        <span class="pollie-name">{{ pollie.name }}</span>
                        <div class="pollie-meta">
                            <PollieBadge variant="party" :party="pollie.party">
                                {{ pollie.party }}
                            </PollieBadge>
                            <PollieBadge variant="house" :house="pollie.house">
                                {{
                                    pollie.house === "senate" ? "Senator" : "MP"
                                }}
                            </PollieBadge>
                            <span class="pollie-location">
                                {{ pollie.division || pollie.state
                                }}<template v-if="pollie.division"
                                    >, {{ pollie.state }}</template
                                >
                            </span>
                        </div>
                    </div>
                </a>
            </li>
        </ul>
    </template>

    <p v-if="filteredData.length === 0" class="no-results">
        No results found. Try adjusting your filters.
    </p>
</template>

<style scoped>
.pollie-filters {
    margin-bottom: 1.5rem;
}

.filter-heading {
    margin-top: 0;
    margin-bottom: 0.75rem;
    border-top: none;
}

.pollie-search {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    margin-bottom: 0.75rem;
}

.pollie-search:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
}

.pollie-search::placeholder {
    color: var(--vp-c-text-3);
}

.filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
}

.filter-select {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 6px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    cursor: pointer;
    min-width: 120px;
}

.filter-select:focus {
    outline: none;
    border-color: var(--vp-c-brand-1);
}

.clear-filters {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--vp-c-border);
    border-radius: 6px;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
    cursor: pointer;
}

.clear-filters:hover {
    background: var(--vp-c-bg-alt);
    color: var(--vp-c-text-1);
}

.pollie-list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.pollie-card {
    border: 1px solid var(--vp-c-border);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
    overflow: hidden;
}

.pollie-link {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    text-decoration: none;
    color: inherit;
}

.pollie-link:hover {
    background: var(--vp-c-bg-alt);
}

.pollie-photo {
    width: 48px;
    height: 60px;
    object-fit: cover;
    border-radius: 4px;
    background-color: var(--vp-c-bg-alt);
    flex-shrink: 0;
}

.pollie-content {
    flex: 1;
    min-width: 0;
}

.pollie-name {
    display: block;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--vp-c-text-1);
    margin-bottom: 0.375rem;
}

.pollie-link:hover .pollie-name {
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

.no-results {
    text-align: center;
    color: var(--vp-c-text-2);
    padding: 2rem;
}
</style>
