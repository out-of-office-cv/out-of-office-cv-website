import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { resolve } from "node:path";
import { loadPollies, loadGigs } from "./loaders";
import { countGigsByPollie } from "./utils/gigs";
import { GIG_CATEGORIES } from "./types";
import type { Gig } from "./types";

const dataDir = resolve(process.cwd(), "data");

const verificationSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  by: z.string(),
  note: z.string().optional(),
});

const gigSchema = z.object({
  role: z.string().min(1),
  organisation: z.string().min(1),
  category: z.enum(GIG_CATEGORIES),
  sources: z.array(z.url()).min(1),
  verification: verificationSchema.optional(),
  pollie_slug: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const pollies = defineCollection({
  loader: async () => {
    const allPollies = loadPollies(dataDir);
    const allGigs = loadGigs(dataDir);
    const gigCounts = countGigsByPollie(allGigs);

    // Filter rejected gigs out of public surfaces; counts above still see them.
    const visibleGigs = allGigs.filter(
      (g) => g.verification?.decision !== "rejected",
    );
    const gigsByPollie = new Map<string, Gig[]>();
    for (const gig of visibleGigs) {
      const existing = gigsByPollie.get(gig.pollie_slug) || [];
      existing.push(gig);
      gigsByPollie.set(gig.pollie_slug, existing);
    }

    return allPollies.map((pollie) => ({
      id: pollie.slug,
      ...pollie,
      gigCount:
        gigCounts.get(pollie.slug) ?? { verified: 0, unverified: 0, rejected: 0 },
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
    gigCount: z.object({
      verified: z.number(),
      unverified: z.number(),
      rejected: z.number(),
    }),
    gigs: z.array(gigSchema),
  }),
});

export const collections = { pollies };

export { getPolliesByDecade } from "./utils/decade";
