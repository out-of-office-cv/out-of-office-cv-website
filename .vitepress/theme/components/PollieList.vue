<script setup lang="ts">
import { ref, computed } from "vue";
import { data } from "../../../pollies.data";

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
        <ul>
            <li v-for="pollie of group.pollies" :key="pollie.slug">
                <a :href="'/pollies/' + pollie.slug">{{ pollie.name }}</a> —
                {{ pollie.division }}, {{ pollie.state }} ({{ pollie.party }})
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
</style>
