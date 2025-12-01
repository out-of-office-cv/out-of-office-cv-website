---
outline: deep
---

<script setup>
import { useData, useRoute } from 'vitepress'
import { watchEffect } from 'vue'

const { params } = useData()
const route = useRoute()

watchEffect(() => {
  if (typeof document !== 'undefined' && params.value?.name) {
    document.title = `${params.value.name} | Out of Office`
  }
})
</script>

# {{ params.name }}

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Electorate** | {{ params.division }}                                    |
| **State**      | {{ params.state }}                                       |
| **Party**      | {{ params.party }}                                       |
| **Status**     | {{ params.stillInOffice ? 'In office' : params.reason }} |
