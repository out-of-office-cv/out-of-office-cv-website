---
title: Pollies
---

# Pollies

<script setup>
import { data } from './pollies.data'
</script>

<ul>
  <li v-for="pollie of data" :key="pollie.slug">
    <a :href="'/pollies/' + pollie.slug">{{ pollie.name }}</a> — {{ pollie.division }}, {{ pollie.state }} ({{ pollie.party }})
  </li>
</ul>
