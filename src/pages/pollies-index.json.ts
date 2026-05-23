import type { APIRoute } from "astro"
import { getCollection, type CollectionEntry } from "astro:content"

export const GET: APIRoute = async () => {
  const all = await getCollection("pollies")
  const data = all
    .map((p: CollectionEntry<"pollies">) => ({
      slug: p.data.slug,
      name: p.data.name,
      party: p.data.party,
      house: p.data.house,
      division: p.data.division,
      state: p.data.state,
    }))
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  })
}
