<script setup lang="ts">
import { computed } from "vue";
import { getPartyColour } from "../../utils";
import type { House } from "../../types";

const props = defineProps<{
  variant: "party" | "house" | "status" | "category";
  party?: string;
  house?: House;
  status?: "in-office" | "left-office";
}>();

const badgeClass = computed(() => {
  if (props.variant === "party" && props.party) {
    const colour = getPartyColour(props.party);
    return `badge-party badge-party-${colour || "default"}`;
  }
  if (props.variant === "house" && props.house) {
    return `badge-house badge-${props.house}`;
  }
  if (props.variant === "status" && props.status) {
    return `badge-status badge-${props.status}`;
  }
  if (props.variant === "category") {
    return "badge-category";
  }
  return "";
});
</script>

<template>
  <span :class="['badge', badgeClass]">
    <slot />
  </span>
</template>

<style scoped>
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

.badge-in-office {
  background-color: #2e7d32;
  color: white;
}

.badge-left-office {
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
}

.badge-category {
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
}
</style>
