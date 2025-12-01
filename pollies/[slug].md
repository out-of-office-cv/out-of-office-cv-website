---
outline: deep
---

<script setup>
import { useData } from 'vitepress'

const { params } = useData()
</script>

# {{ params.name }}

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Electorate** | {{ params.division }}                                    |
| **State**      | {{ params.state }}                                       |
| **Party**      | {{ params.party }}                                       |
| **Status**     | {{ params.stillInOffice ? 'In office' : params.reason }} |
