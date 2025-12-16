import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PollieListItem, PolliesByDecade, Gig } from "./.vitepress/types";
import { parseDate } from "./.vitepress/utils";
import { loadPollies } from "./.vitepress/loaders";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

async function loadGigs(): Promise<Gig[]> {
  const gigsPath = resolve(rootDir, "data/gigs.ts");
  if (!existsSync(gigsPath)) {
    return [];
  }
  const module = await import(`${gigsPath}?t=${Date.now()}`);
  return module.gigs || [];
}

function countVerifiedGigsByPollie(gigs: Gig[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const gig of gigs) {
    if (gig.verified_by) {
      const current = counts.get(gig.pollie_slug) || 0;
      counts.set(gig.pollie_slug, current + 1);
    }
  }
  return counts;
}

declare const data: PolliesByDecade[];
export { data };
export type { PollieListItem, PolliesByDecade };

function getDecade(date: Date | null): string {
  if (!date) return "Current";
  const year = date.getFullYear();
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

interface PollieWithParsedDate extends PollieListItem {
  _ceasedDateParsed: Date | null;
}

export default {
  watch: ["./data/pollies.csv", "./data/gigs.ts"],
  async load(): Promise<PolliesByDecade[]> {
    const allPollies = loadPollies(resolve(rootDir, "data"));
    const allGigs = await loadGigs();
    const gigCounts = countVerifiedGigsByPollie(allGigs);

    const pollies: PollieWithParsedDate[] = allPollies
      .map((pollie) => ({
        slug: pollie.slug,
        name: pollie.name,
        division: pollie.division,
        state: pollie.state,
        party: pollie.party,
        ceasedDate: pollie.ceasedDate,
        house: pollie.house,
        photoUrl: pollie.photoUrl,
        gigCount: gigCounts.get(pollie.slug) || 0,
        _ceasedDateParsed: parseDate(pollie.ceasedDate),
      }))
      .sort((a, b) => {
        if (!a._ceasedDateParsed && b._ceasedDateParsed) return -1;
        if (a._ceasedDateParsed && !b._ceasedDateParsed) return 1;
        if (a._ceasedDateParsed && b._ceasedDateParsed) {
          return b._ceasedDateParsed.getTime() - a._ceasedDateParsed.getTime();
        }
        return a.name.localeCompare(b.name);
      });

    const decadeMap = new Map<string, PollieListItem[]>();
    for (const pollie of pollies) {
      if (!pollie._ceasedDateParsed) continue;

      const decade = getDecade(pollie._ceasedDateParsed);
      const list = decadeMap.get(decade) || [];
      const { _ceasedDateParsed: _, ...pollieData } = pollie;
      list.push(pollieData);
      decadeMap.set(decade, list);
    }

    const decadeOrder = Array.from(decadeMap.keys()).sort((a, b) =>
      b.localeCompare(a),
    );

    return decadeOrder
      .filter((decade) => decadeMap.has(decade))
      .map((decade) => ({
        decade,
        pollies: decadeMap.get(decade)!,
      }));
  },
};
