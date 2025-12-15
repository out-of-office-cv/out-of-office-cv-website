<script setup lang="ts">
import { ref } from "vue";
import type { House } from "../../types";
import PollieBadge from "./PollieBadge.vue";

defineProps<{
    name: string;
    division: string;
    state: string;
    party: string;
    house: House;
    stillInOffice: boolean;
    leftOfficeDate: string;
    leftOfficeAgo: string;
    photoUrl?: string;
}>();

const photoError = ref(false);

function onPhotoError() {
    photoError.value = true;
}
</script>

<template>
    <div class="pollie-header">
        <div class="pollie-header-content">
            <div v-if="photoUrl && !photoError" class="pollie-photo-container">
                <img
                    :src="photoUrl"
                    :alt="`Photo of ${name}`"
                    class="pollie-photo"
                    @error="onPhotoError"
                />
            </div>
            <div class="pollie-info">
                <h1 class="pollie-name">{{ name }}</h1>
                <div class="pollie-badges">
                    <PollieBadge variant="party" :party="party">
                        {{ party }}
                    </PollieBadge>
                    <PollieBadge variant="house" :house="house">
                        {{ house === "senate" ? "Senator" : "MP" }}
                    </PollieBadge>
                    <PollieBadge
                        v-if="stillInOffice"
                        variant="status"
                        status="in-office"
                    >
                        In office
                    </PollieBadge>
                    <PollieBadge v-else variant="status" status="left-office">
                        Left office
                    </PollieBadge>
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
                    <div
                        class="meta-item"
                        v-if="!stillInOffice && leftOfficeDate"
                    >
                        <span class="meta-label">Left office</span>
                        <span class="meta-value"
                            >{{ leftOfficeDate }} ({{ leftOfficeAgo }})</span
                        >
                    </div>
                </div>
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

.pollie-header-content {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
}

.pollie-photo-container {
    flex-shrink: 0;
}

.pollie-photo {
    width: 120px;
    height: 150px;
    object-fit: cover;
    border-radius: 4px;
    background-color: var(--vp-c-bg-soft);
}

.pollie-info {
    flex: 1;
    min-width: 0;
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

.pollie-badges :deep(.badge) {
    font-size: 0.875rem;
    padding: 0.25rem 0.75rem;
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

@media (width <= 480px) {
    .pollie-header-content {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .pollie-badges {
        justify-content: center;
    }

    .pollie-meta {
        justify-content: center;
    }
}
</style>
