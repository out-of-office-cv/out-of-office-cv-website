import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { resolve } from "node:path";
import { loadPollies, loadGigs } from "./loaders";
import { countVerifiedGigsByPollie } from "./utils/decade";
import { GIG_CATEGORIES } from "./types";
import type { Gig } from "./types";

const dataDir = resolve(process.cwd(), "data");

const gigSchema = z.object({
  role: z.string().min(1),
  organisation: z.string().min(1),
  category: z.enum(GIG_CATEGORIES),
  sources: z.array(z.url()).min(1),
  verified_by: z.string().optional(),
  pollie_slug: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const pollies = defineCollection({
  loader: async () => {
    const allPollies = loadPollies(dataDir);
    const allGigs = loadGigs(dataDir);
    const gigCounts = countVerifiedGigsByPollie(allGigs);
    const gigsByPollie = new Map<string, Gig[]>();
    for (const gig of allGigs) {
      const existing = gigsByPollie.get(gig.pollie_slug) || [];
      existing.push(gig);
      gigsByPollie.set(gig.pollie_slug, existing);
    }

    return allPollies.map((pollie) => ({
      id: pollie.slug,
      ...pollie,
      gigCount: gigCounts.get(pollie.slug) || 0,
      gigs: gigsByPollie.get(pollie.slug) || [],
    }));
  },
  schema: z.object({
    slug: z.string(),
    phid: z.string(),
    name: z.string(),
    division: z.string(),
    state: z.string(),
    party: z.string(),
    ceasedDate: z.string(),
    house: z.enum(["senate", "reps"]),
    photoUrl: z.string(),
    gigCount: z.number(),
    gigs: z.array(gigSchema),
  }),
});

export const collections = { pollies };

export { getPolliesByDecade } from "./utils/decade";
