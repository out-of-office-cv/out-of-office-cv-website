---
outline: deep
---

<script setup>
import { useData, useRoute } from 'vitepress'
import { watchEffect, computed } from 'vue'

const { params } = useData()
const route = useRoute()

watchEffect(() => {
  if (typeof document !== 'undefined' && params.value?.name) {
    document.title = `${params.value.name} | Out of Office`
  }
})

function parseDate(dateStr) {
  const [day, month, year] = dateStr.split('.')
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function formatDate(dateStr) {
  const date = parseDate(dateStr)
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function timeAgo(dateStr) {
  const date = parseDate(dateStr)
  const now = new Date()
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth())
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'} ago`
  }
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

const formattedCeasedDate = computed(() => 
  params.value.ceasedDate ? `${formatDate(params.value.ceasedDate)} (${timeAgo(params.value.ceasedDate)})` : ''
)
</script>

# {{ params.name }}

<dl>
  <dt>Electorate</dt>
  <dd>{{ params.division }}</dd>
  <dt>State</dt>
  <dd>{{ params.state }}</dd>
  <dt>Party</dt>
  <dd>{{ params.party }}</dd>
  <dt>Status</dt>
  <dd>{{ params.stillInOffice ? 'In office' : params.reason }}</dd>
  <template v-if="!params.stillInOffice && params.ceasedDate">
    <dt>Left office</dt>
    <dd>{{ formattedCeasedDate }}</dd>
  </template>
</dl>
