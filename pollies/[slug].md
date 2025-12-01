---
outline: false
---

<script setup>
import { useData } from 'vitepress'
const { params } = useData()
</script>

<PollieSearch />

# {{ params.name }}

<!-- @content -->
