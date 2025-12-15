import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Pollie, Gig, House } from "../.vitepress/types";
import { formatDate, timeAgo } from "../.vitepress/utils";
import { loadPollies } from "../.vitepress/loaders";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function loadGigs(): Promise<Gig[]> {
  const gigsPath = resolve(rootDir, "data/gigs.ts");
  if (!existsSync(gigsPath)) {
    return [];
  }
  const module = await import(`${gigsPath}?t=${Date.now()}`);
  return module.gigs || [];
}

function getGigsByPollie(gigs: Gig[]): Map<string, Gig[]> {
  const gigsByPollie = new Map<string, Gig[]>();
  for (const gig of gigs) {
    const existing = gigsByPollie.get(gig.pollie_slug) || [];
    existing.push(gig);
    gigsByPollie.set(gig.pollie_slug, existing);
  }
  return gigsByPollie;
}

interface PolliePath {
  params: {
    slug: string;
    name: string;
    division: string;
    state: string;
    party: string;
    house: House;
    stillInOffice: boolean;
    leftOfficeDate: string;
    leftOfficeAgo: string;
    photoUrl: string;
    gigs: Gig[];
  };
}

declare const data: PolliePath[];

function transformData(
  pollies: Pollie[],
  gigsByPollie: Map<string, Gig[]>,
): PolliePath[] {
  const formerPollies = pollies.filter((p) => !p.stillInOffice);
  return formerPollies.map((pollie) => {
    const pollieGigs = gigsByPollie.get(pollie.slug) || [];
    return {
      params: {
        slug: pollie.slug,
        name: pollie.name,
        division: pollie.division,
        state: pollie.state,
        party: pollie.party,
        house: pollie.house,
        stillInOffice: pollie.stillInOffice,
        leftOfficeDate: pollie.ceasedDate ? formatDate(pollie.ceasedDate) : "",
        leftOfficeAgo: pollie.ceasedDate ? timeAgo(pollie.ceasedDate) : "",
        photoUrl: pollie.photoUrl,
        gigs: pollieGigs,
      },
    };
  });
}

export { data };

export default {
  async paths(): Promise<PolliePath[]> {
    const pollies = loadPollies(resolve(rootDir, "data"));
    const allGigs = await loadGigs();
    const gigsByPollie = getGigsByPollie(allGigs);
    return transformData(pollies, gigsByPollie);
  },
};
