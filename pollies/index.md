---
title: Pollies
---

# Pollies

<script setup>
import { data } from './pollies.data'
</script>

<template v-for="group of data" :key="group.decade">
  <h2>{{ group.decade }}</h2>
  <ul>
    <li v-for="pollie of group.pollies" :key="pollie.slug">
      <a :href="'/pollies/' + pollie.slug">{{ pollie.name }}</a> — {{ pollie.division }}, {{ pollie.state }} ({{ pollie.party }})
    </li>
  </ul>
</template>
