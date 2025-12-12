<script setup lang="ts">
import { getPartyColour } from "../../utils";
import type { House } from "../../types";

defineProps<{
    name: string;
    division: string;
    state: string;
    party: string;
    house: House;
    stillInOffice: boolean;
    leftOfficeDate: string;
    leftOfficeAgo: string;
}>();
</script>

<template>
    <div class="pollie-header">
        <h1 class="pollie-name">{{ name }}</h1>
        <div class="pollie-badges">
            <span
                :class="[
                    'badge',
                    'badge-party',
                    `badge-party-${getPartyColour(party) || 'default'}`,
                ]"
            >
                {{ party }}
            </span>
            <span :class="['badge', 'badge-house', `badge-${house}`]">
                {{ house === "senate" ? "Senator" : "MP" }}
            </span>
            <span
                v-if="stillInOffice"
                class="badge badge-status badge-in-office"
            >
                In office
            </span>
            <span v-else class="badge badge-status badge-left-office">
                Left office
            </span>
        </div>
        <div class="pollie-meta">
            <div class="meta-item" v-if="division">
                <span class="meta-label">Electorate</span>
                <span class="meta-value">{{ division }}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">State</span>
                <span class="meta-value">{{ state }}</span>
            </div>
            <div class="meta-item" v-if="!stillInOffice && leftOfficeDate">
                <span class="meta-label">Left office</span>
                <span class="meta-value"
                    >{{ leftOfficeDate }} ({{ leftOfficeAgo }})</span
                >
            </div>
        </div>
    </div>
</template>

<style scoped>
.pollie-header {
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--vp-c-border);
}

.pollie-name {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
    line-height: 1.2;
}

.pollie-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.badge {
    display: inline-block;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.25rem 0.75rem;
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

.badge-in-office {
    background-color: #2e7d32;
    color: white;
}

.badge-left-office {
    background-color: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
    border: 1px solid var(--vp-c-border);
}

.pollie-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
}

.meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.meta-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--vp-c-text-3);
}

.meta-value {
    font-size: 1rem;
    color: var(--vp-c-text-1);
}
</style>
