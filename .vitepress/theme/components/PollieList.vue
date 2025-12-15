<script setup lang="ts">
import { ref, computed } from "vue";
import { data } from "../../../pollies.data";
import PollieBadge from "./PollieBadge.vue";

const search = ref("");
const photoErrors = ref(new Set<string>());

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
</style>
