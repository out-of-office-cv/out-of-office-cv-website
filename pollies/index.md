---
outline: deep
---

<script setup>
import { data as pollies } from '../data/pollies.data'
</script>

# Pollies

<div v-for="pollie in pollies" :key="pollie.slug">
  <a :href="pollie.slug">{{ pollie.name }}</a> — {{ pollie.division }}, {{ pollie.state }} ({{ pollie.party }})
</div>
