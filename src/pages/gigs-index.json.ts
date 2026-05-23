import type { APIRoute } from "astro"
import { loadGigs } from "../loaders"
import { resolve } from "node:path"

export const GET: APIRoute = async () => {
  const dataDir = resolve(process.cwd(), "data")
  const gigs = loadGigs(dataDir)
  const withIndex = gigs.map((gig, index) => ({ ...gig, index }))
  return new Response(JSON.stringify(withIndex), {
    headers: { "content-type": "application/json" },
  })
}
