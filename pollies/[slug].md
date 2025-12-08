---
outline: false
---

<script setup>
import { useData } from 'vitepress'
const { params } = useData()
</script>

<PollieSearch />

<PollieHeader
    :name="params.name"
    :division="params.division"
    :state="params.state"
    :party="params.party"
    :house="params.house"
    :still-in-office="params.stillInOffice"
    :left-office-date="params.leftOfficeDate"
    :left-office-ago="params.leftOfficeAgo"
/>

<GigList :gigs="params.gigs" />
